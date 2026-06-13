import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { cronProcedure } from "../trpc";

const BUY_IN_MAX = 1_000_000;
const SESSION_CHIPS_MAX = 1_000_000_000;

async function debitWalletForBuyIn(
	tx: Prisma.TransactionClient,
	userId: string,
	buyIn: number,
) {
	const debit = await tx.user.updateMany({
		where: {
			id: userId,
			wallet: { gte: buyIn },
		},
		data: {
			wallet: { decrement: buyIn },
		},
	});

	if (debit.count !== 1) {
		throw new Error("Nicht genug Guthaben.");
	}
}

async function cashOutSessionUser(
	tx: Prisma.TransactionClient,
	sessionUser: { id: string; userId: string; chips: number },
) {
	if (sessionUser.chips > 0) {
		await tx.user.update({
			where: { id: sessionUser.userId },
			data: { wallet: { increment: sessionUser.chips } },
		});
	}

	return sessionUser.chips;
}

async function cashOutAllSessionUsers(
	tx: Prisma.TransactionClient,
	sessionId: string,
) {
	const sessionUsers = await tx.pokerSessionUser.findMany({
		where: { pokerSessionId: sessionId },
		select: { id: true, userId: true, chips: true },
	});

	for (const sessionUser of sessionUsers) {
		await cashOutSessionUser(tx, sessionUser);
	}

	return sessionUsers.reduce((sum, sessionUser) => sum + sessionUser.chips, 0);
}

async function joinSessionWithBuyIn(
	tx: Prisma.TransactionClient,
	sessionId: string,
	userId: string,
) {
	const session = await tx.pokerSession.findUnique({
		where: { id: sessionId },
		select: { id: true, status: true, buyIn: true },
	});

	if (!session) throw new Error("Session nicht gefunden.");
	if (session.status === "gestartet") {
		throw new Error("Das Spiel ist bereits gestartet.");
	}
	if (session.status === "beendet" || session.status === "finished") {
		throw new Error("Die Session ist bereits beendet.");
	}

	const existing = await tx.pokerSessionUser.findFirst({
		where: { pokerSessionId: session.id, userId },
	});

	if (existing) return { sessionId: session.id };

	await debitWalletForBuyIn(tx, userId, session.buyIn);

	await tx.pokerSessionUser.create({
		data: {
			userId,
			pokerSessionId: session.id,
			buyIn: session.buyIn,
			chips: session.buyIn,
			isActive: true,
		},
	});

	return { sessionId: session.id };
}

export const pokerRouter = createTRPCRouter({
	// Neue Session erstellen
	createSession: protectedProcedure
		.input(
			z.object({
				name: z.string().min(3).max(50),
				privateSession: z.boolean().default(false),
				buyIn: z.number().int().min(1).max(BUY_IN_MAX),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				await debitWalletForBuyIn(tx, userId, input.buyIn);

				const session = await tx.pokerSession.create({
					data: {
						name: input.name,
						private: input.privateSession,
						createdBy: userId,
						buyIn: input.buyIn,
						sessionCode: Math.floor(Math.random() * 1000000),
						status: "laufend",
						users: {
							create: {
								userId,
								buyIn: input.buyIn,
								chips: input.buyIn,
								isActive: true,
							},
						},
					},
					include: { users: { include: { user: true } } },
				});

				return { session, sessionID: session.id };
			});
		}),

	// Session beenden
	endSession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				const userSession = await tx.pokerSessionUser.findFirst({
					where: {
						userId,
						pokerSessionId: input.sessionId,
					},
					include: { pokerSession: true },
				});

				if (!userSession) {
					throw new Error("Du bist nicht Teil dieser Session.");
				}

				const firstUser = await tx.pokerSessionUser.findFirst({
					where: { pokerSessionId: input.sessionId },
					orderBy: { id: "asc" },
				});

				if (firstUser?.userId !== userId) {
					throw new Error("Nur der Host darf die Session beenden.");
				}

				await cashOutAllSessionUsers(tx, input.sessionId);

				await tx.pokerSessionUser.updateMany({
					where: { pokerSessionId: input.sessionId },
					data: { chips: 0, isActive: false },
				});

				return await tx.pokerSession.update({
					where: { id: input.sessionId },
					data: { status: "beendet" },
				});
			});
		}),

	// Session löschen (Host only)
	clearSession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				const userSession = await tx.pokerSessionUser.findFirst({
					where: {
						userId,
						pokerSessionId: input.sessionId,
					},
					include: { pokerSession: true },
				});

				if (!userSession) {
					throw new Error("Du bist nicht Teil dieser Session.");
				}

				const firstUser = await tx.pokerSessionUser.findFirst({
					where: { pokerSessionId: input.sessionId },
					orderBy: { id: "asc" },
				});

				if (firstUser?.userId !== userId) {
					throw new Error("Nur der Host darf die Session löschen.");
				}

				await cashOutAllSessionUsers(tx, input.sessionId);

				await tx.pokerSessionUser.deleteMany({
					where: { pokerSessionId: input.sessionId },
				});

				return await tx.pokerSession.delete({
					where: { id: input.sessionId },
				});
			});
		}),

	// Session updatedAt aktualisieren
	updateUpdateAt: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.pokerSession.update({
				where: { id: input.sessionId },
				data: { updatedAt: new Date() },
			});
		}),

	// Session beitreten
	joinSession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				return await joinSessionWithBuyIn(tx, input.sessionId, userId);
			});
		}),

	// Session per Code beitreten
	joinSessionByCode: protectedProcedure
		.input(z.object({ sessionCode: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;
			const parsedCode = Number.parseInt(input.sessionCode);

			if (Number.isNaN(parsedCode)) {
				throw new Error("Ungültiger Code.");
			}

			return await ctx.db.$transaction(async (tx) => {
				const session = await tx.pokerSession.findUnique({
					where: { sessionCode: parsedCode },
					select: { id: true },
				});

				if (!session) {
					throw new Error("Ungültiger Session-Code.");
				}

				return await joinSessionWithBuyIn(tx, session.id, userId);
			});
		}),

	// Spiel starten
	startSession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			return await ctx.db.pokerSession.update({
				where: { id: input.sessionId },
				data: { status: "gestartet" },
			});
		}),
  
  // Eigene Benutzerdaten abrufen
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.session.user.id },
      select: {
        id: true,
        name: true,
        image: true,
        wallet: true,
        developer: true,
      },
    });
  }),

	// Alle Sessions abrufen
	getSessions: protectedProcedure.query(async ({ ctx }) => {
		return ctx.db.pokerSession.findMany({
			include: { users: { include: { user: true } } },
			orderBy: { createdAt: "desc" },
			where: {
				OR: [
					{ private: false },
					{
						AND: [{ private: true }, { createdBy: ctx.session.user.id }],
					},
					{
						users: {
							some: {
								userId: ctx.session.user.id,
							},
						},
					},
				],
			},
		});
	}),

	// Chips aktualisieren
	updateChips: protectedProcedure
		.input(z.object({ chips: z.number().min(0).max(1_000_000) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const updated = await ctx.db.user.update({
				where: { id: userId },
				data: { chips: input.chips },
			});

			return { chips: updated.chips };
		}),

	// Session nach ID abrufen
	getSessionById: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.query(async ({ ctx, input }) => {
			return ctx.db.pokerSession.findUnique({
				where: { id: input.sessionId },
				include: {
					users: { include: { user: true } },
				},
			});
		}),

	isUserDeveloper: protectedProcedure.query(async ({ ctx }) => {
		const userId = ctx.session.user.id;

		const user = await ctx.db.user.findUnique({
			where: { id: userId },
			select: { developer: true },
		});

		return user?.developer ?? false;
	}),

	// Session löschen (Developer only)
	developerClearSession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				const isDev = await tx.user.findUnique({
					where: { id: userId },
					select: { developer: true },
				});

				if (!isDev?.developer) {
					throw new Error("Nur Entwickler dürfen diese Aktion ausführen.");
				}

				await cashOutAllSessionUsers(tx, input.sessionId);

				await tx.pokerSessionUser.deleteMany({
					where: { pokerSessionId: input.sessionId },
				});

				return await tx.pokerSession.delete({
					where: { id: input.sessionId },
				});
			});
		}),

	// Inaktive Sessions beenden (72h Inaktivität)
	terminateSessionForInactivity: cronProcedure.mutation(
		async ({ ctx, input }) => {
			const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5);
			await ctx.db.$transaction(async (tx) => {
				const sessions = await tx.pokerSession.findMany({
					where: { updatedAt: { lt: cutoff } },
					select: { id: true },
				});

				const ids = sessions.map((s) => s.id);

				for (const sessionId of ids) {
					await cashOutAllSessionUsers(tx, sessionId);
				}

				await tx.pokerSessionUser.deleteMany({
					where: { pokerSessionId: { in: ids } },
				});

				await tx.pokerSession.deleteMany({
					where: { id: { in: ids } },
				});
			});
		},
	),

	// Startchips für alle Spieler in einer Session setzen
	updateSessionChips: protectedProcedure
		.input(z.object({ sessionId: z.string(), chips: z.number().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			const session = await ctx.db.pokerSession.findUnique({
				where: { id: input.sessionId },
			});

			if (session?.createdBy !== userId) {
				throw new Error("Nur der Host darf die Chips anpassen.");
			}

			await ctx.db.pokerSessionUser.updateMany({
				where: { pokerSessionId: input.sessionId },
				data: { chips: input.chips },
			});
		}),

	// Aktuelle Spielchips aus dem laufenden Socket-Spiel persistieren
	syncSessionChips: protectedProcedure
		.input(
			z.object({
				sessionId: z.string(),
				players: z.array(
					z.object({
						userId: z.string(),
						chips: z.number().int().min(0).max(SESSION_CHIPS_MAX),
					}),
				),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				const session = await tx.pokerSession.findUnique({
					where: { id: input.sessionId },
					select: { createdBy: true },
				});

				if (session?.createdBy !== userId) {
					throw new Error("Nur der Host darf Spielchips synchronisieren.");
				}

				for (const player of input.players) {
					await tx.pokerSessionUser.updateMany({
						where: {
							pokerSessionId: input.sessionId,
							userId: player.userId,
						},
						data: {
							chips: player.chips,
							isActive: player.chips > 0,
						},
					});
				}

				return { updated: input.players.length };
			});
		}),

	// Spieler aus Session entfernen (Host only)
	kickPlayer: protectedProcedure
		.input(z.object({ sessionId: z.string(), userId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const hostId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				const session = await tx.pokerSession.findUnique({
					where: { id: input.sessionId },
				});

				if (session?.createdBy !== hostId) {
					throw new Error("Nur der Host darf Spieler entfernen.");
				}

				const sessionUser = await tx.pokerSessionUser.findFirst({
					where: {
						pokerSessionId: input.sessionId,
						userId: input.userId,
					},
					select: { id: true, userId: true, chips: true },
				});

				if (!sessionUser) {
					throw new Error("Spieler ist nicht Teil dieser Session.");
				}

				const cashedOut = await cashOutSessionUser(tx, sessionUser);

				await tx.pokerSessionUser.delete({
					where: { id: sessionUser.id },
				});

				return { sessionId: input.sessionId, userId: input.userId, cashedOut };
			});
		}),

	// Spieler verlässt die Session (selbst entfernen)
	leaveSession: protectedProcedure
		.input(z.object({ sessionId: z.string() }))
		.mutation(async ({ ctx, input }) => {
			const userId = ctx.session.user.id;

			return await ctx.db.$transaction(async (tx) => {
				const sessionUser = await tx.pokerSessionUser.findFirst({
					where: {
						pokerSessionId: input.sessionId,
						userId,
					},
					select: { id: true, userId: true, chips: true },
				});

				if (!sessionUser) {
					throw new Error("Du bist nicht Teil dieser Session.");
				}

				const cashedOut = await cashOutSessionUser(tx, sessionUser);

				await tx.pokerSessionUser.delete({
					where: { id: sessionUser.id },
				});

				return {
					sessionId: input.sessionId,
					cashedOut,
				};
			});
		}),
});

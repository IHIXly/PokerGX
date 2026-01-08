import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { Session } from "inspector/promises";
import { z } from "zod";
import { cronProcedure } from "../trpc";

export const pokerRouter = createTRPCRouter({
  // ✅ Neue Session erstellen
  createSession: protectedProcedure
    .input(z.object({ name: z.string().min(3).max(50), privateSession: z.boolean().default(false), createdBy: z.string() }))
    .mutation(async ({ ctx, input }) => {
      console.log("RECEIVED INPUT:", input);
      const userId = ctx.session.user.id;

      const session = await ctx.db.pokerSession.create({
        data: {
          name: input.name,
          private: input.privateSession,
          createdBy: input.createdBy,
          sessionCode: Math.floor(Math.random() * 1000000),
          status: "laufend",
          users: {
            create: {
              userId,
              chips: ctx.session.user.chips,
              isActive: true,
            },
          },
        },
        include: { users: { include: { user: true } } },
      });

      return { session, sessionID: session.id };
    }),

  // ✅ Session beenden
  endSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const userSession = await ctx.db.pokerSessionUser.findFirst({
        where: {
          userId,
          pokerSessionId: input.sessionId,
        },
        include: { pokerSession: true },
      });

      if (!userSession) {
        throw new Error("Du bist nicht Teil dieser Session.");
      }

      const firstUser = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: input.sessionId },
        orderBy: { id: "asc" },
      });

      if (firstUser?.userId !== userId) {
        throw new Error("Nur der Host darf die Session beenden.");
      }

      return await ctx.db.pokerSession.update({
        where: { id: input.sessionId },
        data: { status: "beendet" },
      });
    }),

  // ✅ Session löschen (Host only)
  clearSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const userSession = await ctx.db.pokerSessionUser.findMany({
        where: {
          userId,
          pokerSessionId: input.sessionId,
        },
        include: { pokerSession: true },
      });

      if (!userSession) {
        throw new Error("Du bist nicht Teil dieser Session.");
      }

      const firstUser = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: input.sessionId },
        orderBy: { id: "asc" },
      });

      if (firstUser?.userId !== userId) {
        throw new Error("Nur der Host darf die Session löschen.");
      }

      await ctx.db.pokerSessionUser.deleteMany({
        where: { pokerSessionId: input.sessionId },
      });

      return await ctx.db.pokerSession.delete({
        where: { id: input.sessionId },
      });
    }),

  // ✅ Session updatedAt aktualisieren
  updateUpdateAt: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.pokerSession.update({
        where: { id: input.sessionId },
        data: { updatedAt: new Date() },
      });
    }),

  // ✅ Session beitreten
  joinSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const session = await ctx.db.pokerSession.findUnique({
        where: { id: input.sessionId },
        select: { status: true },
      });

      if (!session) {
        throw new Error("Session nicht gefunden.");
      }

      if (session.status === "gestartet") {
        throw new Error("Das Spiel ist bereits gestartet.");
      }

      const existing = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: input.sessionId, userId },
      });

      if (!existing) {
        await ctx.db.pokerSessionUser.create({
          data: {
            userId,
            pokerSessionId: input.sessionId,
            chips: ctx.session.user.chips ?? 1000,
          },
        });
      }

      return { sessionId: input.sessionId };
    }),

  // ✅ Session per Code beitreten
  joinSessionByCode: protectedProcedure
    .input(z.object({ sessionCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const parsedCode = parseInt(input.sessionCode);

      if (isNaN(parsedCode)) {
        throw new Error("Ungültiger Code.");
      }

      const session = await ctx.db.pokerSession.findUnique({
        where: { sessionCode: parsedCode },
      });

      if (!session) {
        throw new Error("Ungültiger Session-Code.");
      }

      if (session.status === "gestartet") {
        throw new Error("Das Spiel ist bereits gestartet.");
      }

      const existing = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: session.id, userId },
      });

      if (!existing) {
        await ctx.db.pokerSessionUser.create({
          data: {
            userId,
            pokerSessionId: session.id,
            chips: ctx.session.user.chips ?? 1000,
          },
        });
      }

      return { sessionId: session.id };
    }),

  // ✅ Spiel starten
  startSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      return await ctx.db.pokerSession.update({
        where: { id: input.sessionId },
        data: { status: "gestartet" },
      });
    }),

  // ✅ Alle Sessions abrufen
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.pokerSession.findMany({
      include: { users: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      where: {
        OR: [
          { private: false },
          {
            AND: [
              { private: true },
              { createdBy: ctx.session.user.id },
            ],
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

  // ✅ Chips aktualisieren
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

  // ✅ Session nach ID abrufen
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

  isUserDeveloper: protectedProcedure
  .query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const user = await ctx.db.user.findUnique({
      where: { id: userId },
      select: { developer: true },
    });

    return user?.developer ?? false;
  }),


  // ✅ Session löschen (Developer only)
  developerClearSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      const isDev = await ctx.db.user.findUnique({
        where: { id: userId },
        select: { developer: true },
      });

      if (!isDev?.developer) {
        throw new Error("Nur Entwickler dürfen diese Aktion ausführen.");
      }

      await ctx.db.pokerSessionUser.deleteMany({
        where: { pokerSessionId: input.sessionId },
      });

      return await ctx.db.pokerSession.delete({
        where: { id: input.sessionId },
      });
    }),
  
    // ✅ Inaktive Sessions beenden (72h Inaktivität)
  terminateSessionForInactivity: cronProcedure
    .mutation(async ({ ctx, input }) => {
      const cutoff = new Date(Date.now() - (1000 * 60 * 60 * 24) * 5); // 5 Tage
      //const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 0.1); // 0.1h // Testzwecke
      const sessions = await ctx.db.pokerSession.findMany({
        where: { updatedAt: { lt: cutoff } },
        select: { id: true },
      })

      const ids = sessions.map(s => s.id)

      await ctx.db.pokerSessionUser.deleteMany({
        where: { pokerSessionId: { in: ids } },
      })

      await ctx.db.pokerSession.deleteMany({
        where: { id: { in: ids } },
      })
    }),

});

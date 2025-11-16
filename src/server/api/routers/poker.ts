import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { z } from "zod";

export const pokerRouter = createTRPCRouter({
  // ✅ Neue Session erstellen
  createSession: protectedProcedure
    .input(z.object({ name: z.string().min(3).max(50) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Session anlegen
      const session = await ctx.db.pokerSession.create({
        data: {
          name: input.name,
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

      return {session, sessionID: session.id};
    }),

    // ✅ Session beenden
  endSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Prüfen, ob User Teil der Session ist
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

      // Nur der Ersteller darf beenden (erster User in der Session gilt als Host)
      const firstUser = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: input.sessionId },
        orderBy: { id: "asc" },
      });

      if (firstUser?.userId !== userId) {
        throw new Error("Nur der Host darf die Session beenden.");
      }

      // Session-Status ändern
      return await ctx.db.pokerSession.update({
        where: { id: input.sessionId },
        data: { status: "beendet" },
      });
    }),

    clearSession: protectedProcedure //✅ Session löschen (Host only (test))
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Prüfen, ob User Teil der Session ist
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

      // Nur der Ersteller darf löschen (erster User in der Session gilt als Host)
      const firstUser = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: input.sessionId },
        orderBy: { id: "asc" },
      });

      if (firstUser?.userId !== userId) {
        throw new Error("Nur der Host darf die Session löschen.");
      }

      // Session löschen
      await ctx.db.pokerSessionUser.deleteMany({
        where: { pokerSessionId: input.sessionId },
      });

      return await ctx.db.pokerSession.delete({
        where: { id: input.sessionId },
      });
    }),

   // ✅ Session beitreten
  joinSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Check: Status der Session
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

      // Check: ist User schon drin?
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

  // ✅ Spiel starten
  startSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Status auf "gestartet" setzen
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
    });
  }),

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

  getSessionById: protectedProcedure //provisorisch!!
  .input(z.object({ sessionId: z.string() }))
  .query(async ({ ctx, input }) => {
    return ctx.db.pokerSession.findUnique({
      where: { id: input.sessionId },
      include: {
        users: { include: { user: true } },
      },
    });
  }),
});

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
              chips: ctx.session.user.chips ?? 1000,
              isActive: true,
            },
          },
        },
        include: { users: { include: { user: true } } },
      });

      return session;
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

  // ✅ Bestehender Session beitreten
  joinSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Prüfen, ob der User schon in der Session ist
      const alreadyJoined = await ctx.db.pokerSessionUser.findFirst({
        where: {
          userId,
          pokerSessionId: input.sessionId,
        },
      });

      if (alreadyJoined) {
        return alreadyJoined;
      }

      // Hinzufügen
      return await ctx.db.pokerSessionUser.create({
        data: {
          userId,
          pokerSessionId: input.sessionId,
          chips: ctx.session.user.chips ?? 1000,
        },
      });
    }),

  // ✅ Alle Sessions abrufen
  getSessions: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.pokerSession.findMany({
      include: {
        users: { include: { user: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),
});

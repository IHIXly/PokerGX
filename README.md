# Create T3 App

This is a [T3 Stack](https://create.t3.gg/) project bootstrapped with `create-t3-app`.

## What's next? How do I make an app with this?

We try to keep this project as simple as possible, so you can start with just the scaffolding we set up for you, and add additional things later when they become necessary.

If you are not familiar with the different technologies used in this project, please refer to the respective docs. If you still are in the wind, please join our [Discord](https://t3.gg/discord) and ask for help.

- [Next.js](https://nextjs.org)
- [NextAuth.js](https://next-auth.js.org)
- [Prisma](https://prisma.io)
- [Drizzle](https://orm.drizzle.team)
- [Tailwind CSS](https://tailwindcss.com)
- [tRPC](https://trpc.io)

## Learn More

To learn more about the [T3 Stack](https://create.t3.gg/), take a look at the following resources:

- [Documentation](https://create.t3.gg/)
- [Learn the T3 Stack](https://create.t3.gg/en/faq#what-learning-resources-are-currently-available) — Check out these awesome tutorials

You can check out the [create-t3-app GitHub repository](https://github.com/t3-oss/create-t3-app) — your feedback and contributions are welcome!

## How do I deploy this?

Follow our deployment guides for [Vercel](https://create.t3.gg/en/deployment/vercel), [Netlify](https://create.t3.gg/en/deployment/netlify) and [Docker](https://create.t3.gg/en/deployment/docker) for more information.

## Changes by Tim

part of joinSession in server/api/routers/poker.ts
```ts
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
```

new function in server/api/routers/poker.ts
```ts
// ✅ Spiel starten (nur Host)
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
```

new function in app/room/page.ts
```ts
const startSession = api.poker.startSession.useMutation({
    onSuccess: () => {
      utils.poker.getSessions.invalidate();
      utils.poker.getSessionById.invalidate({ sessionId });
    },
  });
```

new "Spiel starten" and "Verlassen" button in app/room/page.ts
```ts
{session.status !== "gestartet" && (
        <div className="fixed bottom-6 right-6 flex flex-col items-end space-y-2">
          {/* Spiel starten */}
          <button
            onClick={() => startSession.mutate({ sessionId })}
            disabled={startSession.isLoading}
            className="text-indigo-400 hover:underline disabled:opacity-50"
          >
            {startSession.isLoading ? "Startet..." : "Spiel starten"}
          </button>

          {/* Verlassen */}
          <button
            onClick={() => leaveSession.mutate({ sessionId })}
            disabled={leaveSession.isLoading}
            className="text-indigo-400 hover:underline disabled:opacity-50"
          >
            {leaveSession.isLoading ? "Verlasse..." : "Verlassen"}
          </button>
        </div>
      )}
```
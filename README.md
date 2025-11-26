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

### Start Game

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

### Set Chips

new function in server/api/routers/poker.ts
```ts
SetChips: protectedProcedure
    .input(z.object({ sessionId: z.string(), amount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const { sessionId, amount } = input;

      // Prüfen, ob Session existiert und gestartet ist
      const session = await ctx.db.pokerSession.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });

      if (!session) throw new Error("Session nicht gefunden.");
      if (session.status !== "gestartet") throw new Error("Das Spiel läuft nicht.");

      // Prüfen, ob User Teil der Session ist
      const psUser = await ctx.db.pokerSessionUser.findFirst({
        where: { pokerSessionId: sessionId, userId },
      });

      if (!psUser) throw new Error("Du bist nicht Teil dieser Session.");

      // Bei Erhöhung sicherstellen, dass genug Chips vorhanden sind
      if (amount > 0 && psUser.chips < amount) {
        throw new Error("Nicht genügend Chips.");
      }

      // Update: setChips += amount, chips -= amount (bei positiver amount)
      const updated = await ctx.db.pokerSessionUser.update({
        where: { id: psUser.id },
        data: {
          setChips: { increment: amount },
          chips: { increment: -amount },
        },
      });
      return updated;
    }),
```
new function in app/room/page.ts
```ts
// neue Mutation, die setChips anpasst
  const SetChips = api.poker.SetChips.useMutation({
    onSuccess: () => {
      utils.poker.getSessionById.invalidate({ sessionId });
      utils.poker.getSessions.invalidate();
    },
  });
```

new button in app/room/page.ts
```ts
{session.users.map((u) => (
            <li key={u.id} className="flex justify-between">
              <div>
                <div className="font-medium">{u.user.name ?? "Unbekannt"}</div>
                <div className="text-sm text-gray-400 mt-1">
                   Chips: <span className="text-indigo-400">{u.chips}</span>
                </div>

                {session.status === "gestartet" && (
                  <div className="text-sm text-gray-400 mt-1">
                    Einsatz: <span className="text-indigo-400">{u.setChips ?? 0} Chips</span>
                  </div>
                )}
              </div>
              {session.status === "gestartet" && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => SetChips.mutate({ sessionId, amount: 10 })}
                      disabled={SetChips.isLoading || u.chips < 10}
                      className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm disabled:opacity-50"
                    >
                      +10
                    </button>
                  </div>
                )}
            </li>
          ))}
```


## Sessions

````prisma
model Session {
    id           String   @id @default(cuid())
    sessionToken String   @unique
    userId       String
    expires      DateTime
    user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model User { //bearbeitet
    id            String    @id @default(cuid())
    name          String?
    email         String?   @unique
    emailVerified DateTime?
    chips         Int       @default(1000)    // Aktuelle Chips
    sessions      Session[]
    pokerSessions PokerSessionUser[]
    image         String?
    accounts      Account[]
}

model PokerSession { //bearbeitet
    id            String    @id @default(cuid())
    name          String
    status        String    // laufend, beendet, pausiert
    createdAt     DateTime  @default(now())
    users         PokerSessionUser[]
    gameState     Json?     // komplexer Spielzustand, optional gespeichert
}

model PokerSessionUser {
    id            String     @id @default(cuid())
    user          User       @relation(fields: [userId], references: [id])
    userId        String
    pokerSession  PokerSession @relation(fields: [pokerSessionId], references: [id])
    pokerSessionId String
    chips         Int        // Chips zu Beginn der Session oder aktuell
    seatNumber    Int?       // Sitzplatz-Nummer am Tisch
    isActive      Boolean    @default(true)
    setChips      Int       // Die gesetzten Chips
    activ         Boolean   //Wenn du noch im Spiel bist und nicht gefoldet hast
    maxed         Boolean   //Wenn du nicht zu erhöhen brauchst
    checked       Boolean   //Wenn du mit dem Einsatz zufrieden bist
    valid         Boolean   //Wenn du noch zusetzendes Geld hast
    yourTurn      Boolean   //Wenn du an der Reihe bist
}
````

````
User
 ├── accounts (1-to-many)
 ├── sessions (1-to-many)
 └── pokerSessions (1-to-many via PokerSessionUser)

PokerSession
 └── users (1-to-many via PokerSessionUser)

PokerSessionUser
 ├── user (many-to-1)
 └── pokerSession (many-to-1)
````

The endpoint:
````ts
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
````

````ts
// Daten der PokerSession laden
  const { data: session, isLoading } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
````

structure:
````
PokerSession {
  id
  name
  ...
  users: [
    PokerSessionUser {
      chips
      checked
      yourTurn
      ...
      user: User {
        name
        email
        image
        ...
      }
    }
  ]
}
````
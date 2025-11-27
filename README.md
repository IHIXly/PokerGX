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
```js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
});

// Räume
const rooms = {};

io.on("connection", (socket) => {
  console.log("🔌 Neuer Client:", socket.id);

  // Client explicitly joins the session room
  socket.on("join_session", (sessionId) => {
    socket.join(sessionId);
    console.log("👋 Client ist Raum beigetreten:", sessionId, socket.id);
  });

  socket.on("start_session", ({ sessionId, players }) => {
    console.log("📝 Session wird gestartet:", sessionId, players);

    // Ensure the starter is in the room
    socket.join(sessionId);

    // @ts-ignore
    if (!rooms[sessionId]) {
      // @ts-ignore
      rooms[sessionId] = {
        members: [],
        locked: false,
        totalChips: 0,
        round: 1,
        turnOrder: [],
        currentTurnIndex: 0,
      };
    }

    // @ts-ignore
    const room = rooms[sessionId];
    room.members = players.map((p) => ({ name: p.name, chips: p.chips ?? 1000 }));
    room.locked = true;

    io.to(sessionId).emit("update_members", room.members);
    io.to(sessionId).emit("session_started");
  });
});

const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));
app.get("/", (_, res) => res.sendFile(path.join(clientPath, "index.html")));

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server läuft auf Port ${PORT}`));
```

````
npm install express socket.io
````

````
npm i --save-dev @types/express
````

````
npm install socket.io-client
````
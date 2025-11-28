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
    // @ts-ignore
    const room = rooms[sessionId];
    if (room && room.turnOrder && room.turnOrder.length > 0) {
      socket.emit("update_turn", {
        turnOrder: room.turnOrder,
        currentPlayer: room.turnOrder[room.currentTurnIndex],
      });
      socket.emit("update_members", room.members);
    }
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
    room.members.forEach((p) => (p.setchips = 0));
    room.turnOrder = room.members.map((p) => p.name);

    io.to(sessionId).emit("update_members", room.members);
    io.to(sessionId).emit("session_started");
    io.to(sessionId).emit("update_turn", {
      turnOrder: room.turnOrder,
      currentPlayer: room.turnOrder[room.currentTurnIndex],
    });
  });

  socket.on("check_call", ({ sessionId, playerName, amount }) => {
    console.log("📥 check_call received:", { sessionId, playerName });
    // @ts-ignore
    const room = rooms[sessionId];
    const currentPlayer = room.turnOrder[room.currentTurnIndex];

    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;

    io.to(sessionId).emit("update_turn", {
      turnOrder: room.turnOrder,
      currentPlayer: room.turnOrder[room.currentTurnIndex],
    });

  });
});

const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));
app.get("/", (_, res) => res.sendFile(path.join(clientPath, "index.html")));

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server läuft auf Port ${PORT}`));
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import type {
  ChatData,
  ReadyData,
  Room,
  RoundResult,
} from "./poker";
import { PokerGame } from "./poker";

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

interface StartSessionData {
  sessionId: string;
  players: Array<{ name: string; chips?: number }>;
  gameMode: string;
}

const rooms: Record<string, Room> = {};
const readyState: Record<string, string[]> = {};

io.on("connection", (socket: Socket) => {
  console.log("🔌 Neuer Client:", socket.id);

  socket.on("join_session", (sessionId: string) => {
    socket.join(sessionId);
    console.log("👋 Client ist Raum beigetreten:", sessionId, socket.id);
    socket.to(sessionId).emit("player_joined");

    if (readyState[sessionId]) {
      socket.emit("update_ready", readyState[sessionId]);
    }
  });

  socket.on("chat_message", ({ sessionId, playerName, message }: ChatData) => {
    io.to(sessionId).emit("chat_message", {
      playerName,
      message,
      timestamp: Date.now(),
    });
  });

  socket.on("player_ready", ({ sessionId, playerName }: ReadyData) => {
    if (!readyState[sessionId]) readyState[sessionId] = [];
    const idx = readyState[sessionId].indexOf(playerName);
    if (idx === -1) {
      readyState[sessionId].push(playerName);
    } else {
      readyState[sessionId].splice(idx, 1);
    }
    io.to(sessionId).emit("update_ready", readyState[sessionId]);
  });

  socket.on("leave_session", (sessionId: string) => {
    console.log("👋 Client verlässt den Raum:", sessionId, socket.id);
    socket.to(sessionId).emit("player_left");
    socket.leave(sessionId);
  });

  socket.on("chips_updated", (sessionId: string) => {
    io.to(sessionId).emit("chips_updated");
  });

  socket.on("kick_player", ({ sessionId, kickedUserId }: { sessionId: string; kickedUserId: string }) => {
    io.to(sessionId).emit("player_kicked", { kickedUserId });
  });

  socket.on("start_session", ({ sessionId, players, gameMode }: StartSessionData) => {
    console.log("📝 Session wird gestartet:", sessionId, players);

    socket.join(sessionId);

    readyState[sessionId] = [];
    io.to(sessionId).emit("update_ready", []);

    let Game: any;

    switch (gameMode) {
      case "poker":
        Game = PokerGame;
        
        break;

      default:
        console.warn("Unbekannter Spielmodus:", gameMode);
        return;
    }

    if (!rooms[sessionId]) {
      rooms[sessionId] = Game.createRoom();
    }

    const room = rooms[sessionId]!;

    room.locked = true;
    room.roundNumber = 0;

    Game.initializeRoomMembers(room, players);

    const roundResult = Game.startNewRound(room);

    emitSessionStarted(room, sessionId);

    if (roundResult) {
      emitRoundResult(room, sessionId, roundResult);
    }

    socket.on("continue", (sessionId: string) => {
      const room = rooms[sessionId];
      if (!room) return;

      const roundResult = Game.handleContinue(room);
      emitSessionStarted(room, sessionId);

      if (roundResult) {
        emitRoundResult(room, sessionId, roundResult);
      }
    });

    socket.on("finish", (sessionId: string) => {
      const room = rooms[sessionId];
      if (!room) return;

      Game.closeTheGame(room);
      io.to(sessionId).emit("game_finished");
      delete rooms[sessionId];
      delete readyState[sessionId];
    });
  });

  

  


  // Poker
  socket.on("check_call", ({ sessionId, playerName }: { sessionId: string; playerName: string }) => {
    const room = rooms[sessionId];
    if (!room) return;

    const result = PokerGame.handleCheckCall(room, playerName);
    if (!result) return;

    io.to(sessionId).emit("player_action", {
      playerName: result.playerName,
      action: result.action,
      amount: result.amount,
    });
    io.to(sessionId).emit("update_members", room.members);

    if (result.roundResult) {
      emitRoundResult(room, sessionId, result.roundResult);
    } else {
      emitTurnUpdate(room, sessionId);
    }
  });

  socket.on("fold", ({ sessionId, playerName }: { sessionId: string; playerName: string }) => {
    const room = rooms[sessionId];
    if (!room) return;

    const result = PokerGame.handleFold(room, playerName);
    io.to(sessionId).emit("player_action", {
      playerName,
      action: "fold",
    });
    io.to(sessionId).emit("update_members", room.members);

    if (result?.roundResult) {
      emitRoundResult(room, sessionId, result.roundResult);
    } else {
      emitTurnUpdate(room, sessionId);
    }
  });

  socket.on("raise", ({ sessionId, playerName, amount }: { sessionId: string; playerName: string; amount?: number }) => {
    const room = rooms[sessionId];
    if (!room || amount === undefined) return;

    const result = PokerGame.handleRaise(room, playerName, amount);
    if (!result) return;

    io.to(sessionId).emit("player_action", {
      playerName,
      action: result.action,
      amount: result.amount,
    });
    io.to(sessionId).emit("update_members", room.members);

    if (result.roundResult) {
      emitRoundResult(room, sessionId, result.roundResult);
    } else {
      emitTurnUpdate(room, sessionId);
    }
  });

  
});



function emitSessionStarted(room: Room, sessionId: string): void {
  io.to(sessionId).emit("update_members", room.members);
  io.to(sessionId).emit("session_started");
  io.to(sessionId).emit("round_continues");
  emitTurnUpdate(room, sessionId);
}

function emitTurnUpdate(room: Room, sessionId: string): void {
  io.to(sessionId).emit("update_turn", {
    turnOrder: room.turnOrder,
    currentPlayer: room.turnOrder[room.currentTurnIndex],
    phase: room.phase,
    tableCards: room.cards,
    smallBlind: room.smallBlind,
    bigBlind: room.bigBlind,
    roundNumber: room.roundNumber,
  });
}

function emitRoundResult(room: Room, sessionId: string, result: RoundResult): void {
  io.to(sessionId).emit("update_members", room.members);
  io.to(sessionId).emit("round_ends", result);
}

const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));
app.get("/", (_, res) => res.sendFile(path.join(clientPath, "index.html")));

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server läuft auf Port ${PORT}`));
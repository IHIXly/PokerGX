import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Deck, evaluateHighestCard } from "./cards";

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

interface Player {
  name: string;
  chips: number;
  settedChips: number;
  checked: boolean;
  allIn: boolean;
  cards: number[][];
  score: number;
}

interface Room {
  members: Player[];
  locked: boolean;
  phase: number;
  turnOrder: string[];
  currentTurnIndex: number;
  blindsIndex: number;
  deck: Deck;
  cards: number[][];
  roundNumber: number;
  smallBlind: string;
  bigBlind: string;
}

interface StartSessionData {
  sessionId: string;
  players: Array<{ name: string; chips?: number }>;
}

interface CheckCallData {
  sessionId: string;
  playerName: string;
  amount?: number;
}

interface FoldData {
  sessionId: string;
  playerName: string;
}

interface ChatData {
  sessionId: string;
  playerName: string;
  message: string;
}

interface ReadyData {
  sessionId: string;
  playerName: string;
}

const rooms: Record<string, Room> = {};
const readyState: Record<string, string[]> = {};

io.on("connection", (socket: Socket) => {
  console.log("🔌 Neuer Client:", socket.id);

  socket.on("join_session", (sessionId: string) => {
    socket.join(sessionId);
    console.log("👋 Client ist Raum beigetreten:", sessionId, socket.id);
    socket.to(sessionId).emit("player_joined");
    const room = rooms[sessionId];
    if (room && room.turnOrder && room.turnOrder.length > 0) {
      socket.emit("update_turn", {
        turnOrder: room.turnOrder,
        currentPlayer: room.turnOrder[room.currentTurnIndex],
        phase: room.phase,
        tableCards: room.cards,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
        roundNumber: room.roundNumber,
      });
      socket.emit("update_members", room.members);
    }
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

  socket.on("chips_updated", (sessionId: string) => {
    io.to(sessionId).emit("chips_updated");
  });

  socket.on("kick_player", ({ sessionId, kickedUserId }: { sessionId: string; kickedUserId: string }) => {
    io.to(sessionId).emit("player_kicked", { kickedUserId });
  });

  socket.on("start_session", ({ sessionId, players }: StartSessionData) => {
    console.log("📝 Session wird gestartet:", sessionId, players);
    socket.join(sessionId);

    readyState[sessionId] = [];
    io.to(sessionId).emit("update_ready", []);

    if (!rooms[sessionId]) {
      rooms[sessionId] = {
        members: [],
        locked: false,
        phase: 0,
        turnOrder: [],
        currentTurnIndex: 0,
        blindsIndex: 0,
        deck: new Deck(),
        cards: [],
        roundNumber: 0,
        smallBlind: "",
        bigBlind: "",
      };
    }

    const room = rooms[sessionId]!;
    room.members = players.map((p) => ({
      name: p.name,
      chips: p.chips ?? 1000,
      settedChips: 0,
      checked: false,
      allIn: false,
      cards: [],
      score: 0,
    }));
    room.locked = true;
    room.roundNumber = 0;

    StartNewRound(room, sessionId);
  });

  socket.on("check_call", ({ sessionId, playerName }: CheckCallData) => {
    const room = rooms[sessionId];
    if (!room) return;

    const member = room.members.find((m) => m.name === playerName);
    const maxSettedChips = Math.max(...room.members.map((m) => m.settedChips));
    const currentPlayerBet = member ? member.settedChips : 0;
    const amountToCall = maxSettedChips - currentPlayerBet;

    if (member && amountToCall > 0) ChipsTransfer(room, sessionId, member, amountToCall);
    if (member) CheckThePlayers(room, sessionId, member);

    io.to(sessionId).emit("player_action", {
      playerName,
      action: "call",
      amount: amountToCall,
    });

    NextTurn(room, sessionId, 1);
  });

  socket.on("fold", ({ sessionId, playerName }: FoldData) => {
    const room = rooms[sessionId];
    if (!room) return;

    io.to(sessionId).emit("player_action", {
      playerName,
      action: "fold",
    });

    QuitTurnOrder(room, sessionId);
    io.to(sessionId).emit("update_members", room.members);
    NextTurn(room, sessionId, 0);
  });

  socket.on("raise", ({ sessionId, playerName, amount }: CheckCallData) => {
    const room = rooms[sessionId];
    if (!room) return;
    const member = room.members.find((m) => m.name === playerName);

    if (member) {
      ChipsTransfer(room, sessionId, member, amount ?? 0);
      KillCheckedStatus(room, sessionId);
      CheckThePlayers(room, sessionId, member);

      io.to(sessionId).emit("player_action", {
        playerName,
        action: "raise",
        amount,
      });

      NextTurn(room, sessionId, 1);
    }
  });

  socket.on("continue", (sessionId: string) => {
    const room = rooms[sessionId];
    if (!room) return;
    StartNewRound(room, sessionId);
  });

  socket.on("finish", (sessionId: string) => {
    const room = rooms[sessionId];
    if (!room) return;
    CloseTheGame(room, sessionId);
  });

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

  function CloseTheGame(room: Room, sessionId: string): void {
    room.locked = false;
    io.to(sessionId).emit("game_finished");
  }

  function NextTurn(room: Room, sessionId: string, turnSteps: number): void {
    if (turnSteps) {
      room.currentTurnIndex = (room.currentTurnIndex + turnSteps) % room.turnOrder.length;
    }

    if (room.turnOrder.every((playerName) => {
      const player = room.members.find((p) => p.name === playerName);
      return player?.checked ?? false;
    })) {
      NextPhase(room, sessionId);
    }

    emitTurnUpdate(room, sessionId);
  }

  function ChipsTransfer(room: Room, sessionId: string, player: Player, amount: number): void {
    if (amount < player.chips) {
      player.chips -= amount;
      player.settedChips += amount;
    } else {
      player.settedChips += player.chips;
      player.chips = 0;
      GoAllin(room, sessionId, player);
    }
    io.to(sessionId).emit("update_members", room.members);
  }

  function CheckThePlayers(room: Room, sessionId: string, player: Player): void {
    player.checked = true;
    io.to(sessionId).emit("update_members", room.members);
  }

  function StartNewRound(room: Room, sessionId: string): void {
    room.phase = 0;
    room.roundNumber += 1;
    room.members.forEach((p) => {
      p.settedChips = 0;
      p.checked = false;
      p.allIn = false;
      p.score = 0;
    });

    room.turnOrder = room.members.filter((p) => p.chips > 0).map((p) => p.name);
    room.cards = [];
    room.deck.reset();

    room.members.forEach((p) => {
      if (room.turnOrder.includes(p.name)) {
        const playerCards = room.deck.drawTwoCards();
        p.cards = playerCards ? playerCards : [];
      }
    });

    room.currentTurnIndex = room.blindsIndex % room.turnOrder.length;
    room.blindsIndex += 1;

    room.smallBlind = room.turnOrder[room.currentTurnIndex] ?? "";
    room.bigBlind = room.turnOrder[(room.currentTurnIndex + 1) % room.turnOrder.length] ?? "";

    io.to(sessionId).emit("update_members", room.members);
    io.to(sessionId).emit("session_started");
    io.to(sessionId).emit("round_continues");
    emitTurnUpdate(room, sessionId);

    NextPhase(room, sessionId);
  }

  function KillCheckedStatus(room: Room, sessionId: string): void {
    room.members.forEach((p) => (p.checked = false));
    io.to(sessionId).emit("update_members", room.members);
  }

  function QuitTurnOrder(room: Room, sessionId: string): void {
    room.turnOrder.splice(room.currentTurnIndex, 1);

    if (room.turnOrder.length === 1) {
      if (room.members.find((m) => m.name === room.turnOrder[0])?.checked) {
        WinnerOfTheRound(room, sessionId);
      } else {
        const hasAllInPlayer = room.members.some((p) => p.allIn);
        if (!hasAllInPlayer) WinnerOfTheRound(room, sessionId);
      }
    }

    if (room.turnOrder.length === 0) WinnerOfTheRound(room, sessionId);

    if (room.currentTurnIndex >= room.turnOrder.length) {
      room.currentTurnIndex = 0;
    }
  }

  function GoAllin(room: Room, sessionId: string, player: Player): void {
    player.allIn = true;
    QuitTurnOrder(room, sessionId);
    io.to(sessionId).emit("update_members", room.members);
  }

  function WinnerOfTheRound(room: Room, sessionId: string): void {
    let winnerName: string;

    const allInPlayers = room.members.filter((p) => p.allIn);
    allInPlayers.forEach((p) => {
      if (!room.turnOrder.includes(p.name)) {
        room.turnOrder.push(p.name);
      }
    });

    const playerHandTypes: Record<string, string> = {};
    const hasAllCards = room.cards.length === 5;

    if (room.turnOrder.length === 1) {
      winnerName = room.turnOrder[0]!;
    } else {
      let highestScore = -1;
      winnerName = room.turnOrder[0]!;
      room.turnOrder.forEach((playerName) => {
        const player = room.members.find((p) => p.name === playerName);
        if (player) {
          const result = evaluateHighestCard(room.cards, player.cards);
          player.score = result.score;
          if (hasAllCards && result.handType) {
            playerHandTypes[playerName] = result.handType as string;
          }
          if (result.score > highestScore) {
            highestScore = result.score;
            winnerName = player.name;
          }
        }
      });
    }

    const totalPot = room.members.reduce((sum, p) => sum + p.settedChips, 0);
    const winner = room.members.find((p) => p.name === winnerName);
    if (winner) winner.chips += totalPot;

    const playerHands = room.members.map((p) => ({
      name: p.name,
      cards: p.cards,
      handType: playerHandTypes[p.name] ?? null,
      chips: p.chips,
    }));

    io.to(sessionId).emit("update_members", room.members);
    io.to(sessionId).emit("round_ends", { winnerName, totalPot, playerHands });
  }

  function NextPhase(room: Room, sessionId: string): void {
    room.phase += 1;
    KillCheckedStatus(room, sessionId);

    switch (room.phase) {
      case 1:
        const player1 = room.members.find((m) => m.name === room.turnOrder[room.currentTurnIndex]);
        if (player1) ChipsTransfer(room, sessionId, player1, 10);
        NextTurn(room, sessionId, 1);

        const player2 = room.members.find((m) => m.name === room.turnOrder[room.currentTurnIndex]);
        if (player2) {
          ChipsTransfer(room, sessionId, player2, 20);
          CheckThePlayers(room, sessionId, player2);
        }
        NextTurn(room, sessionId, 1);
        break;

      case 2:
        room.cards[0] = room.deck.drawOneCard() ?? [];
        room.cards[1] = room.deck.drawOneCard() ?? [];
        room.cards[2] = room.deck.drawOneCard() ?? [];
        break;

      case 3:
        room.cards[3] = room.deck.drawOneCard() ?? [];
        break;

      case 4:
        room.cards[4] = room.deck.drawOneCard() ?? [];
        break;

      case 5:
        if (sessionId) WinnerOfTheRound(room, sessionId);
        break;

      default:
        console.log("⚠️ Unbekannte Phase:", room.phase);
    }

    io.to(sessionId).emit("update_members", room.members);
  }
});

const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));
app.get("/", (_, res) => res.sendFile(path.join(clientPath, "index.html")));

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server läuft auf Port ${PORT}`));

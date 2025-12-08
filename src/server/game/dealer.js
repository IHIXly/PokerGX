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
        phase: 0,
        turnOrder: [],
        currentTurnIndex: 0,
      };
    }

    // @ts-ignore
    const room = rooms[sessionId];
    room.members = players.map((p) => ({
      name: p.name,
      chips: p.chips ?? 1000,
      settedChips: 0,
     }));
    room.locked = true;
    room.members.forEach((p) => (p.settedChips = 0));
    room.turnOrder = room.members.map((p) => p.name);

    io.to(sessionId).emit("update_members", room.members);
    io.to(sessionId).emit("session_started");
    io.to(sessionId).emit("update_turn", {
      turnOrder: room.turnOrder,
      currentPlayer: room.turnOrder[room.currentTurnIndex],
    });
    StartNewRound(room);
  });

  socket.on("check_call", ({ sessionId, playerName, amount }) => {
    console.log("📥 check_call received:", { sessionId, playerName });
    // @ts-ignore
    const room = rooms[sessionId];
    const member = room.members.find((m) => m.name === playerName);
    
    // Determine the maximum settedChips on the table
    const maxSettedChips = Math.max(...room.members.map((m) => m.settedChips));
    console.log(`💰 Max settedChips on table: ${maxSettedChips}`);
    
    // Calculate how much the player needs to call
    const currentPlayerBet = member ? member.settedChips : 0;
    const amountToCall = maxSettedChips - currentPlayerBet;
    
    console.log(`📊 ${playerName} has ${currentPlayerBet}, needs to call ${amountToCall} to match ${maxSettedChips}`);

    if (member && amountToCall > 0) {
      ChipsTransfer(room, sessionId, member, amountToCall);
    }
      
    NextTurn(room, sessionId, 1);
     
  });

  socket.on("fold", ({sessionId, playerName}) => {
    console.log("📥 fold received:", { sessionId, playerName });

    const room = rooms[sessionId];

    room.turnOrder.splice(room.currentTurnIndex, 1);

    if (room.turnOrder.length === 1) {  
      WinnerOfTheRound(room, sessionId);
    }

    if (room.currentTurnIndex >= room.turnOrder.length) {
      room.currentTurnIndex = 0; // Wrap to first player
    }
    io.to(sessionId).emit("update_members", room.members);
    NextTurn(room, sessionId, 0);
  })

  function NextTurn(room, sessionId, turnSteps) {
    console.log("➡️ Nächster Spieler ist dran in Session:", sessionId);

    if (turnSteps) {
      room.currentTurnIndex = (room.currentTurnIndex + turnSteps) % room.turnOrder.length;
    }
    
    io.to(sessionId).emit("update_turn", {
      turnOrder: room.turnOrder,
      currentPlayer: room.turnOrder[room.currentTurnIndex],
    });
  }

  function ChipsTransfer(room, sessionId, player, amount) {
    console.log(`💰 Spieler ${player.name} setzt ${amount} Chips in Session:`, sessionId);
    player.chips -= amount;
    player.settedChips += amount;
    io.to(sessionId).emit("update_members", room.members);
  }

  function StartNewRound(room) {
    room.phase = 0;
    NextPhase(room);
  }

  function WinnerOfTheRound(room, sessionId) {
    let winnerName;
    
    if (room.turnOrder.length === 1) {
      //Der einzige verbleibende Spieler gewinnt
      winnerName = room.turnOrder[0];
      console.log("🏆 Spieler gewinnt:", winnerName);
    }
    else {
      //Gewinner wird ausgewertet
      winnerName = room.turnOrder[0]; // Placeholder - implement your winner logic here
    }
    
    // Calculate total pot
    const totalPot = room.members.reduce((sum, p) => sum + p.settedChips, 0);
    console.log(`💰 Total Pot: ${totalPot} Chips`);
    
    // Give all chips to winner
    const winner = room.members.find((p) => p.name === winnerName);
    if (winner) {
      winner.chips += totalPot;
      console.log(`🎉 ${winnerName} erhält ${totalPot} Chips`);
    }
    
    // Reset all setchips to 0
    room.members.forEach((p) => p.settedChips = 0);
    
    // Reset turn order for next round
    room.turnOrder = room.members.map((p) => p.name);
    
    // Emit update to all clients
    io.to(sessionId).emit("update_members", room.members);

    StartNewRound(room);
  }

  function NextPhase(room, sessionId) {
    console.log("🔄 Neue Runde startet in Session:", sessionId);
    room.phase += 1;


    switch (room.phase) {
    case 1:
      // Zwei Karten für jeden Spieler werden ausgeteilt
      console.log("🌟 Pre-Flop Phase gestartet");

      const player1 = room.members.find(m => m.name === room.turnOrder[room.currentTurnIndex]);
      if (player1) ChipsTransfer(room, sessionId, player1, 10);
      NextTurn(room, sessionId, 1);

      const player2 = room.members.find(m => m.name === room.turnOrder[room.currentTurnIndex]);
      if (player2) ChipsTransfer(room, sessionId, player2, 20);
      NextTurn(room, sessionId, 1);

      break;

    case 2:
      // Drei Karten für alle Spieler werden gezeigt
      console.log("🌟 Flop Phase gestartet");
      break;

    case 3:
      // Die vierte Karte wird gezeigt
      console.log("🌟 Turn Phase gestartet");
      break;

    case 4:
      // Die fünfte Karte wird gezeigt
      console.log("🌟 River Phase gestartet");
      break;

    case 5:
      // Gewinner wird ausgewertet
      console.log("🌟 Gewinner wird ausgewertet");
      WinnerOfTheRound(room, sessionId);
      break;

    default:
      // Optional: falls der Wert keiner bekannten Phase entspricht
      console.log("Unbekannte Phase");
    
    }
  }
});



const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));
app.get("/", (_, res) => res.sendFile(path.join(clientPath, "index.html")));

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server läuft auf Port ${PORT}`));
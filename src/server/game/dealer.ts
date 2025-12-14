import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
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

// Type definitions
interface Player {
  name: string;
  chips: number;
  settedChips: number;
  checked: boolean;
  allIn: boolean;
}

interface Room {
  members: Player[];
  locked: boolean;
  phase: number;
  turnOrder: string[];
  currentTurnIndex: number;
  blindsIndex: number;
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

// Räume
const rooms: Record<string, Room> = {};

io.on("connection", (socket: Socket) => {
  console.log("🔌 Neuer Client:", socket.id);

  // Client explicitly joins the session room
  socket.on("join_session", (sessionId: string) => {
    socket.join(sessionId);
    console.log("👋 Client ist Raum beigetreten:", sessionId, socket.id);
    const room = rooms[sessionId];
    if (room && room.turnOrder && room.turnOrder.length > 0) {
      socket.emit("update_turn", {
        turnOrder: room.turnOrder,
        currentPlayer: room.turnOrder[room.currentTurnIndex],
        phase: room.phase,
      });
      socket.emit("update_members", room.members);
    }
  });

  socket.on("start_session", ({ sessionId, players }: StartSessionData) => {
    console.log("📝 Session wird gestartet:", sessionId, players);

    // Ensure the starter is in the room
    socket.join(sessionId);

    if (!rooms[sessionId]) {
      rooms[sessionId] = {
        members: [],
        locked: false,
        phase: 0,
        turnOrder: [],
        currentTurnIndex: 0,
        blindsIndex: 0,
      };
    }

    const room = rooms[sessionId]!;
    room.members = players.map((p) => ({
      name: p.name,
      chips: p.chips ?? 1000,
      settedChips: 0,
      checked: false,
      allIn: false,
     }));
    room.locked = true;
    
   
    
    StartNewRound(room, sessionId);
  });

  socket.on("check_call", ({ sessionId, playerName, amount }: CheckCallData) => {
    console.log("📥 check_call received:", { sessionId, playerName });
    const room = rooms[sessionId];
    if (!room) return;
    
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
    if (member) {
      CheckThePlayers(room, sessionId, member);
    }

    NextTurn(room, sessionId, 1);
     
  });

  socket.on("fold", ({sessionId, playerName}: FoldData) => {
    console.log("📥 fold received:", { sessionId, playerName });

    const room = rooms[sessionId];
    if (!room) return;

    QuitTurnOrder(room, sessionId);
    io.to(sessionId).emit("update_members", room.members);
    NextTurn(room, sessionId, 0);
  })

  socket.on("raise", ({ sessionId, playerName, amount }: CheckCallData) => {
    console.log("📥 raise received:", { sessionId, playerName, amount });
    const room = rooms[sessionId];
    if (!room) return;
    const member = room.members.find((m) => m.name === playerName);

    if (member) {
        ChipsTransfer(room, sessionId, member, amount ?? 0);
        KillCheckedStatus(room, sessionId);
        CheckThePlayers(room, sessionId, member);
        NextTurn(room, sessionId, 1);
    }
    });


  function NextTurn(room: Room, sessionId: string, turnSteps: number): void {
    console.log("➡️ Nächster Spieler ist dran in Session:", sessionId);

    if (turnSteps) {
      room.currentTurnIndex = (room.currentTurnIndex + turnSteps) % room.turnOrder.length;
    }

    // Check if all players in turnOrder have checked
    if (room.turnOrder.every((playerName) => {
      const player = room.members.find((p) => p.name === playerName);
      return player?.checked ?? false;
    })) {
        NextPhase(room, sessionId);
    } 
    
    io.to(sessionId).emit("update_turn", {
      turnOrder: room.turnOrder,
      currentPlayer: room.turnOrder[room.currentTurnIndex],
      phase: room.phase,
    });
  }

  function ChipsTransfer(room: Room, sessionId: string, player: Player, amount: number): void {
    console.log(`💰 Spieler ${player.name} setzt ${amount} Chips in Session:`, sessionId);
    if (amount < player.chips) {
        player.chips -= amount;
        player.settedChips += amount;
    }
    else {
        // Player goes all-in
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

    // Reset all setchips and allIn status
    room.members.forEach((p) => {
      p.settedChips = 0;
      p.checked = false;
      p.allIn = false;
    });
    
    // Reset turn order for next round - only players with chips > 0
    room.turnOrder = room.members.filter((p) => p.chips > 0).map((p) => p.name);

    // Set currentTurnIndex AFTER turnOrder is set
    room.currentTurnIndex = (room.blindsIndex) % room.turnOrder.length;
    room.blindsIndex += 1;

    io.to(sessionId).emit("update_members", room.members);
    io.to(sessionId).emit("session_started");
    io.to(sessionId).emit("update_turn", {
      turnOrder: room.turnOrder,
      currentPlayer: room.turnOrder[room.currentTurnIndex],
      phase: room.phase,
    });

    NextPhase(room, sessionId);
  }

  function KillCheckedStatus(room: Room, sessionId: string): void {
    room.members.forEach((p) => (p.checked = false));
    io.to(sessionId).emit("update_members", room.members);
  }

  function QuitTurnOrder(room: Room, sessionId: string): void {
    room.turnOrder.splice(room.currentTurnIndex, 1);

    // Check if only one player remains
    if (room.turnOrder.length === 1) {
        // Check if the remaining player has checked
        if (room.members.find(m => m.name === room.turnOrder[0])?.checked) {  
            WinnerOfTheRound(room, sessionId);
        }
        else {
            const hasAllInPlayer = room.members.some((p) => p.allIn);
            if (!hasAllInPlayer) {
                WinnerOfTheRound(room, sessionId);
            }
            
        }

    }
    if (room.turnOrder.length === 0) {
        WinnerOfTheRound(room, sessionId);
    }

    if (room.currentTurnIndex >= room.turnOrder.length) {
      room.currentTurnIndex = 0; // Wrap to first player
    }
  }

  function GoAllin(room: Room, sessionId: string, player: Player): void {
    console.log(`💥 Spieler ${player.name} geht All-In in Session:`, sessionId);
    player.allIn = true;
    QuitTurnOrder(room, sessionId);
    io.to(sessionId).emit("update_members", room.members);
  }

  function WinnerOfTheRound(room: Room, sessionId: string): void {
    let winnerName: string;
    
    // Add all-in players back to turnOrder
    const allInPlayers = room.members.filter((p) => p.allIn);
    allInPlayers.forEach((p) => {
      if (!room.turnOrder.includes(p.name)) {
        room.turnOrder.push(p.name);
        console.log(`➕ All-in player ${p.name} added back to turnOrder`);
      }
    });

    if (room.turnOrder.length === 1) {
      //Der einzige verbleibende Spieler gewinnt
      winnerName = room.turnOrder[0]!;
      console.log("🏆 Spieler gewinnt:", winnerName);
    }
    else {
      //Gewinner wird ausgewertet
      winnerName = room.turnOrder[0]!; // Placeholder - implement your winner logic here
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
    
    io.to(sessionId).emit("round_ends", winnerName);

    //Sobald ein Button implementiert ist, um die nächste Runde zu starten, kann dieser Aufruf entfernt werden
    StartNewRound(room, sessionId);
  }

  function NextPhase(room: Room, sessionId: string): void {
    console.log("🔄 Neue Runde startet in Session:", sessionId);
    room.phase += 1;
    
    KillCheckedStatus(room, sessionId);

    switch (room.phase) {
    case 1:
      // Zwei Karten für jeden Spieler werden ausgeteilt
      console.log("🌟 Pre-Flop Phase gestartet");

      const player1 = room.members.find(m => m.name === room.turnOrder[room.currentTurnIndex]);
      if (player1) ChipsTransfer(room, sessionId, player1, 10);
      NextTurn(room, sessionId, 1);

      const player2 = room.members.find(m => m.name === room.turnOrder[room.currentTurnIndex]);
      if (player2) {
        ChipsTransfer(room, sessionId, player2, 20);
        CheckThePlayers(room, sessionId, player2);
      }
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
      if (sessionId) {
        WinnerOfTheRound(room, sessionId);
      }
      break;

    default:
      // Optional: falls der Wert keiner bekannten Phase entspricht
      console.log("Unbekannte Phase");
    
    }
    // Emit update to all clients
    io.to(sessionId).emit("update_members", room.members);
  }
});



const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));
app.get("/", (_, res) => res.sendFile(path.join(clientPath, "index.html")));

const PORT = 3001;
server.listen(PORT, "0.0.0.0", () => console.log(`✅ Server läuft auf Port ${PORT}`));

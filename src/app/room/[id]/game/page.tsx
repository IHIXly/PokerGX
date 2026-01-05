"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

export default function PokerGamePage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { data: authSession } = useSession();
  const { data: session, isLoading } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );
  const [turnOrder, setTurnOrder] = useState<string[]>([]);
  const [phase, setPhase] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [members, setMembers] = useState<Array<{ name: string; chips: number; settedChips: number; checked: boolean; allIn: boolean, cards: number[][]}>>([]);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [tableCards, setTableCards] = useState<number[][]>([]);
  const [roundWinner, setRoundWinner] = useState("");
  const [roundPot, setRoundPot] = useState(0);
  const [gamePaused, setGamePaused] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  const userName = authSession?.user?.name ?? "Unbekannt";
  

  useEffect(() => {
    const socket = io("http://localhost:3001", {
      transports: ["websocket", "polling"],  // ← Try WS first, fallback to polling
      path: "/socket.io",
      withCredentials: false,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3,
      timeout: 10000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🟢 Game socket connected:", socket.id);
      socket.emit("join_session", sessionId);  // ← Also join the room here
    });

    socket.on("connect_error", (err) =>
      console.error("🚫 Game connect_error:", err.message, err)
    );

    socket.on("update_members", (members) => {
      console.log("🔄 Members update:", members);
      setMembers(members);
    });

    socket.on("update_turn", ({ turnOrder, currentPlayer, phase, tableCards }) => {
      console.log("🎲 Turn update:", { turnOrder, currentPlayer, phase, tableCards });
      setTurnOrder(turnOrder);
      setCurrentPlayer(currentPlayer);
      setPhase(phase);
      setTableCards(tableCards);
    });

    socket.on("round_ends", (data: { winnerName: string; totalPot: number }) => {
      console.log("🏆 Runde endet. Gewinner:", data.winnerName, "Pot:", data.totalPot);
      setRoundWinner(data.winnerName);
      setRoundPot(data.totalPot);
      setGamePaused(true);
    });

    socket.on("round_continues", () => {
      console.log("➡️ Runde geht weiter");
      setRoundWinner("");
      setGamePaused(false);
    });

    socket.on("game_ended", (data: { message: string; remainingPlayers: string[] }) => {
      console.log("🎮 Spiel beendet:", data.message);
      alert(`Spiel beendet: ${data.message}`);
      
    });

    socket.on("game_finished", () => {
      console.log("🏁 Spiel wurde vom Gewinner beendet");
      alert("Das Spiel wurde beendet!");
      // Optionally redirect to room page
      window.location.href = `/room/${sessionId}`;
    });
    

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
}, [sessionId]);

  const checkCall = () => {
    if (socketRef.current && userName === currentPlayer) {
      console.log("📤 Emitting check_call for:", userName);
      socketRef.current.emit("check_call", { sessionId, playerName: userName });
    }
  };

  const raise = () => {
    if (socketRef.current && userName === currentPlayer && raiseAmount > 0) {
      console.log("📤 Emitting check_call (raise) for:", userName, "amount:", raiseAmount);
      socketRef.current.emit("raise", { sessionId, playerName: userName, amount: raiseAmount });
    }
  };

  const fold = () => {
    if (socketRef.current && userName === currentPlayer) {
      console.log("📤 Emitting fold for:", userName);
      socketRef.current.emit("fold", { sessionId, playerName: userName });
    }
  };

  const nextRound = () => {
    if (socketRef.current && userName === roundWinner) {
      console.log("📤 Emitting continue for:", userName);
      socketRef.current.emit("continue", sessionId);
    }
  };

  const finish = () => {
    if (socketRef.current && userName === roundWinner) {
      console.log("📤 Emitting finish for:", userName);
      socketRef.current.emit("finish", sessionId);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-300">
        <Loader2 className="animate-spin mr-2" /> Lädt Spiel...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="h-screen flex items-center justify-center text-red-400">
        ⚠️ Session nicht gefunden
      </div>
    );
  }

  const isMyTurn = userName === currentPlayer;
  const isWinner = userName === roundWinner;
  const hasFolded = !turnOrder.includes(userName);

  // Calculate minimum raise amount
  const myMember = members.find((m) => m.name === userName);
  const maxSettedChips = Math.max(...members.map((m) => m.settedChips), 0);
  const mySettedChips = myMember?.settedChips ?? 0;
  const minRaise = maxSettedChips - mySettedChips + 1;

  // Update raiseAmount when minimum changes
  useEffect(() => {
    if (raiseAmount < minRaise) {
      setRaiseAmount(minRaise);
    }
  }, [minRaise]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Spiel: {session.name}</h1>
      
      {/* Game Paused Modal */}
      {gamePaused && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full border-2 border-yellow-500">
            <h2 className="text-2xl font-bold mb-4 text-center text-yellow-400">🏆 Spiel Beendet!</h2>
            <p className="text-lg mb-4 text-center">
              Gewinner: <span className="text-green-400 font-semibold">{roundWinner}</span>
            </p>
            {userName === roundWinner ? (
              <div className="flex gap-4">
                <button
                  className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded font-semibold transition"
                  onClick={nextRound}
                >
                  Weiter
                </button>
                <button
                  className="flex-1 bg-red-600 hover:bg-red-700 px-6 py-3 rounded font-semibold transition"
                  onClick={finish}
                >
                  Aufhören
                </button>
              </div>
            ) : (
              <p className="text-center text-gray-300">Warte auf den Gewinner</p>
            )}
          </div>
        </div>
      )}
      
      <div className="mb-6 text-gray-400">
        Du bist: <span className="text-indigo-400 font-semibold">{userName}</span>
      </div>

      <h2 className="text-xl text-gray-300 mb-4">Spieler am Tisch</h2>
      <ul className="space-y-2 mb-8">
        {session.users.map((u) => {
          const playerName = u.user.name ?? "Unbekannt";
          const isActive = turnOrder.includes(playerName);
          const isCurrent = playerName === currentPlayer;
          const member = members.find((m) => m.name === playerName);
          const chips = member?.chips ?? u.chips;
          const settedChips = member?.settedChips ?? 0;
          const Playercards = member?.cards ?? [];
          const card1 = Playercards[0] ?? [];
          const card2 = Playercards[1] ?? [];
          const isOwner = playerName === userName;
          const checked = member?.checked ?? false;
          const allIn = member?.allIn ?? false;
          const hasChipps = chips > 0;
          
          return (
            <li
              key={u.id}
              className={`flex justify-between px-4 py-2 rounded ${
                isCurrent
                  ? "bg-green-800"
                  : isActive
                  ? "bg-gray-800"
                  : "bg-gray-900 opacity-50"
              }`}
            >
              <span className="font-medium">
                {playerName}
                {" "}- {" "}
                {isOwner ? 
                  ( <> {card1[0]}-{card1[1]} , {card2[0]}-{card2[1]} </> ) :  
                  ( <> ? , ? </> )
                }
                {!isActive && !allIn && hasChipps && <span className="ml-2 text-red-400 text-sm">(Gefoldet)</span>}
                {checked && isActive && <span className="ml-2 text-green-400 text-sm">(Gecheckt)</span>}
                {allIn && <span className="ml-2 text-yellow-400 text-sm">(All-In)</span>}
              </span>
              <span className="text-sm text-indigo-400">{chips} Chips</span>
              <span className="text-sm text-indigo-400">{settedChips} Gesetzt</span>
            </li>
          );
        })}
      </ul>

      <div className="mb-4">
        <p className="text-lg">
          Phase: <b className="text-green-400">{phase || "Warten..."}</b>
        </p>

        <p className="text-lg">
          Tischkarten: <b className="text-green-400">{tableCards.map(card => `${card[0]}-${card[1]}`).join(", ") || ""}</b>
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          className={`px-6 py-3 rounded font-semibold transition ${
            isMyTurn
              ? "bg-green-600 hover:bg-green-700 cursor-pointer"
              : "bg-gray-600 cursor-not-allowed opacity-50"
          }`}
          onClick={checkCall}
          disabled={!isMyTurn}
        >
          Check / Call
        </button>

        <div className="flex items-center gap-2">
          <button
            className={`px-4 py-3 rounded font-semibold transition ${
              isMyTurn
                ? "bg-yellow-600 hover:bg-yellow-700 cursor-pointer"
                : "bg-gray-600 cursor-not-allowed opacity-50"
            }`}
            onClick={() => setRaiseAmount(Math.max(minRaise, raiseAmount - 1))}
            disabled={!isMyTurn}
          >
            -
          </button>
          <div className="px-4 py-3 bg-gray-800 rounded min-w-[80px] text-center">
            {raiseAmount}
          </div>
          <button
            className={`px-4 py-3 rounded font-semibold transition ${
              isMyTurn
                ? "bg-yellow-600 hover:bg-yellow-700 cursor-pointer"
                : "bg-gray-600 cursor-not-allowed opacity-50"
            }`}
            onClick={() => setRaiseAmount(raiseAmount + 1)}
            disabled={!isMyTurn}
          >
            +
          </button>
          <button
            className={`px-6 py-3 rounded font-semibold transition ${
              isMyTurn
                ? "bg-yellow-600 hover:bg-yellow-700 cursor-pointer"
                : "bg-gray-600 cursor-not-allowed opacity-50"
            }`}
            onClick={raise}
            disabled={!isMyTurn}
          >
            Raise
          </button>
        </div>

        <button
          className={`px-6 py-3 rounded font-semibold transition ${
            isMyTurn
              ? "bg-red-600 hover:bg-red-700 cursor-pointer"
              : "bg-gray-600 cursor-not-allowed opacity-50"
          }`}
          onClick={fold}
          disabled={!isMyTurn}
        >
          Fold
        </button>
      </div>
    </main>
  );
}



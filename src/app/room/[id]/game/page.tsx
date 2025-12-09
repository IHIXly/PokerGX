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
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [members, setMembers] = useState<Array<{ name: string; chips: number; settedChips: number }>>([]);

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

    socket.on("update_turn", ({ turnOrder, currentPlayer }) => {
      console.log("🎲 Turn update:", { turnOrder, currentPlayer });
      setTurnOrder(turnOrder);
      setCurrentPlayer(currentPlayer);
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

  const fold = () => {
    if (socketRef.current && userName === currentPlayer) {
      console.log("📤 Emitting fold for:", userName);
      socketRef.current.emit("fold", { sessionId, playerName: userName });
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
  const hasFolded = !turnOrder.includes(userName);

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Spiel: {session.name}</h1>
      
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
                {!isActive && <span className="ml-2 text-red-400 text-sm">(Gefoldet)</span>}
              </span>
              <span className="text-sm text-indigo-400">{chips} Chips</span>
              <span className="text-sm text-indigo-400">{settedChips} Gesetzt</span>
            </li>
          );
        })}
      </ul>

      <div className="mb-4">
        <p className="text-lg">
          Am Zug: <b className="text-green-400">{currentPlayer || "Warten..."}</b>
        </p>
      </div>

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
    </main>
  );
}
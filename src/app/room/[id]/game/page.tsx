"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

export default function PokerGamePage() {
  const params = useParams();
  const sessionId = params.id as string;
  const { data: session, isLoading } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
  const s = io("http://localhost:3001", {
    transports: ["websocket", "polling"],  // ← Try WS first, fallback to polling
    path: "/socket.io",
    withCredentials: false,
    reconnectionDelay: 1000,
    reconnectionAttempts: 3,
    timeout: 10000,
  });

  socketRef.current = s;

  s.on("connect", () => {
    console.log("🟢 Game socket connected:", s.id);
    s.emit("join_session", sessionId);  // ← Also join the room here
  });

  s.on("connect_error", (err) =>
    console.error("🚫 Game connect_error:", err.message, err)
  );

  s.on("update_members", (members) => {
    console.log("🔄 Members update:", members);
  });

  // Future game events here

  return () => {
    s.disconnect();
    socketRef.current = null;
  };
}, [sessionId]);

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

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-8">
      <h1 className="text-3xl font-bold mb-6">Spiel: {session.name}</h1>
      <h2 className="text-xl text-gray-300 mb-4">Spieler am Tisch</h2>
      <ul className="space-y-2 mb-8">
        {session.users.map((u) => (
          <li
            key={u.id}
            className="flex justify-between bg-gray-800 px-4 py-2 rounded"
          >
            <span className="font-medium">{u.user.name ?? "Unbekannt"}</span>
            <span className="text-sm text-indigo-400">{u.chips} Chips</span>
          </li>
        ))}
      </ul>

      <div className="text-gray-400 text-sm">
        Spieloberfläche folgt hier: Karten, Aktionen, Pot, Turn-Handling.
      </div>
    </main>
  );
}
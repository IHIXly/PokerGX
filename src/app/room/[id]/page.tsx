//Provisorisch!!
"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { getServers } from "dns/promises";
import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { Socket } from "socket.io-client";


export default function PokerRoomPage() {

  

  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();
  const utils = api.useUtils();
  const { data: authSession } = useSession();

  const leaveSession = api.poker.joinSession.useMutation({
    onSuccess: (data) => {
    utils.poker.getSessions.invalidate();
    router.push(`/`);
  },
  });

  const startSession = api.poker.startSession.useMutation({
    onSuccess: () => {
      utils.poker.getSessions.invalidate();
      utils.poker.getSessionById.invalidate({ sessionId });
    },
  });

  // neue Mutation, die setChips anpasst
  const SetChips = api.poker.SetChips.useMutation({
    onSuccess: () => {
      utils.poker.getSessionById.invalidate({ sessionId });
      utils.poker.getSessions.invalidate();
    },
  });

  // Daten der PokerSession laden
  const { data: session, isLoading } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const socketRef = useRef<Socket | null>(null);

useEffect(() => {
  const s = io("http://localhost:3001", {
    transports: ["polling"],  // ← Simple, stable for short sessions
    path: "/socket.io",
    withCredentials: false,
  });

  socketRef.current = s;

  s.on("connect", () => {
    console.log("✅ Socket connected:", s.id);
    s.emit("join_session", sessionId);
  });

  s.on("connect_error", (err) =>
    console.error("🚫 connect_error:", err.message, err)
  );
  s.on("error", (err) => console.error("🚫 socket error:", err));

  s.on("session_started", () => {
    console.log("🎉 session_started");
    router.push(`/room/${sessionId}/game`);
  });
  s.on("update_members", (members) => {
    console.log("👥 update_members:", members);
  });

  return () => {
    s.disconnect();
    socketRef.current = null;
  };
}, [sessionId, router]);

const handleStartSession = () => {
  if (!session || !socketRef.current) return;

  socketRef.current.emit("start_session", {
    sessionId,
    players: session.users.map((u) => ({
      name: u.user.name ?? "Unbekannt",
      chips: u.chips,
    })),
  });
};

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center text-gray-300">
        <Loader2 className="animate-spin mr-2" /> Lädt Pokersession...
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
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-10">
      <h1 className="text-4xl font-bold mb-8">{session.name}</h1>

      <p className="text-gray-400 mb-6">Status: {session.status}</p>

      <div className="bg-gray-800 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Spieler im Raum</h2>
        <ul className="space-y-2">
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
        </ul>
      </div>

      {session.status !== "gestartet" && (
        <div className="fixed bottom-6 right-6 flex flex-col items-end space-y-2">
          {/* Spiel starten */}
          <button
            onClick={handleStartSession}
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
    </main>
  );
}

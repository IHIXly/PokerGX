//Homepage
"use client";

import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import SessionSettings from "./components/SessionSettings";
import SessionCode from "./components/SessionCode";
import ThreeScene from "./components/ThreeScene"

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const utils = api.useUtils();

  const [showSettings, setShowSettings] = useState(false);
  const [sessionCode, setSessionCode] = useState(false);

  const joinSession = api.poker.joinSession.useMutation({
    onSuccess: (data) => {
      utils.poker.getSessions.invalidate();
      router.push(`/room/${data.sessionId}`);
    },
  });

  const endSession = api.poker.endSession.useMutation({
    onSuccess: () => utils.poker.getSessions.invalidate(),
  });

  const clearSession = api.poker.clearSession.useMutation({
    onSuccess: () => utils.poker.getSessions.invalidate(),
  });

  const { data: sessions, isLoading } = api.poker.getSessions.useQuery(undefined, {
    enabled: !!session,
  });

  if (status === "loading") {
    return (
      <div className="h-screen flex items-center justify-center text-gray-300">
        <Loader2 className="animate-spin mr-2" /> Wird geladen ...
      </div>
    );
  }

  if (!session) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-4xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8">
          Willkommen, <span className="text-indigo-400">{session.user.name}</span> 👋
        </h1>

        {/* Kopfbereich */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold">Deine Poker-Sessions</h2>

          {/* RECHTS → Buttons gruppieren */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSessionCode(true)}
              className="flex items-center gap-2 bg-gray-600 hover:bg-indigo-700 px-4 py-2 rounded-lg"
            >
              Join
            </button>

            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg"
            >
              <Plus size={18} />
              Neue Session
            </button>
          </div>
        </div>

        {/* Sessions-List */}
        {isLoading ? (
          <p>Lade Sessions...</p>
        ) : sessions?.length ? (
          <ul className="space-y-4">
            {sessions.map((s) => {
              const isHost = s.users[0]?.user.id === session.user.id;

              return (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="bg-gray-800 p-4 rounded-lg flex justify-between items-center"
                >
                  <div>
                    <strong>{s.name}</strong> — 
                    <em
                      className={`${
                        s.status === "beendet" ? "text-red-400" : "text-gray-400"
                      }`}
                    >
                      {s.status}
                    </em>
                    <div className="text-sm text-gray-400 mt-1">
                      Spieler: {s.users.map((u) => u.user.name ?? "Unbekannt").join(", ")}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {s.status !== "beendet" && (
                      <button
                        className="text-indigo-400 hover:underline"
                        onClick={() => joinSession.mutate({ sessionId: s.id })}
                      >
                        Beitreten
                      </button>
                    )}

                    {isHost && s.status !== "beendet" && (
                      <button
                        onClick={() => endSession.mutate({ sessionId: s.id })}
                        className="text-red-400 hover:underline"
                      >
                        Beenden
                      </button>
                    )}

                    {isHost && s.status == "beendet" && (
                      <button
                        onClick={() => clearSession.mutate({ sessionId: s.id })}
                        className="text-indigo-400 hover:underline"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </ul>
        ) : (
          <p className="text-gray-500">Keine Sessions gefunden.</p>
        )}
      </motion.div>

      {showSettings && (
        <SessionSettings
          user={session.user as { name: string; image?: string; chips: number; id: string }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {sessionCode && (
        <SessionCode onClose={() => setSessionCode(false)} />
      )}
    </main>
  );
}
"use client";

import { useSession } from "next-auth/react";
import { api } from "@/trpc/react";
import { Loader2, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function HomePage() {
  const { data: session, status } = useSession();

  const utils = api.useUtils();

  const createSession = api.poker.createSession.useMutation({
    onSuccess: () => utils.poker.getSessions.invalidate(),
  });

  const joinSession = api.poker.joinSession.useMutation({
    onSuccess: () => utils.poker.getSessions.invalidate(),
  });

  const endSession = api.poker.endSession.useMutation({
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

  if (!session) return null; // Wird von der Middleware abgefangen, falls nicht eingeloggt

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
          <button
            onClick={() => {
              const name = prompt("Wie soll deine Session heißen?");
              if (name) createSession.mutate({ name });
            }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg"
          >
            <Plus size={18} />
            Neue Session
          </button>
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
        <strong>{s.name}</strong>{" "}
        —{" "}
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
            onClick={() => joinSession.mutate({ sessionId: s.id })}
            className="text-indigo-400 hover:underline"
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
      </div>
    </motion.li>
  );
})}
          </ul>
        ) : (
          <p className="text-gray-500">Keine Sessions gefunden.</p>
        )}
      </motion.div>
    </main>
  );
}

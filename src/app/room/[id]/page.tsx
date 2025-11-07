//Provisorisch!!
"use client";

import { useParams } from "next/navigation";
import { api } from "@/trpc/react";
import { Loader2 } from "lucide-react";
import { getServers } from "dns/promises";
import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function PokerRoomPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const router = useRouter();
  const utils = api.useUtils();

  const leveSession = api.poker.joinSession.useMutation({
    onSuccess: (data) => {
    utils.poker.getSessions.invalidate();
    router.push(`/`);
  },
  });

  // Daten der PokerSession laden
  const { data: session, isLoading } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

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
              <span>{u.user.name ?? "Unbekannt"}</span>
              <span className="text-indigo-400">{u.chips} Chips</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        //onClick={() => signIn("discord", { callbackUrl: "/" })}
        className="text-indigo-400 fixed bottom-6 right-6 mt-6 hover:underline"
        onClick={() => leveSession.mutate({ sessionId })}
      >
        Verlassen
      </button>
    </main>
  );
}

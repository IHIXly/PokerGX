"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { useSession } from "next-auth/react";
import { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import toast, { Toaster } from "react-hot-toast";
import {
  Copy, Check, Play, LogOut, UserX,
  Loader2, ChevronRight, Lock,
} from "lucide-react";

// Inline chip SVG — no public/ dependency
function ChipIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9"   fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5.5" fill="#450a0a" stroke="#ef4444" strokeWidth="1"   />
      <path
        d="M10 1v3M10 16v3M1 10h3M16 10h3M3.22 3.22l2.12 2.12M14.66 14.66l2.12 2.12M3.22 16.78l2.12-2.12M14.66 5.34l2.12-2.12"
        stroke="#fca5a5" strokeWidth="1.2" strokeLinecap="round"
      />
    </svg>
  );
}

type SessionUser = {
  id: string;
  chips: number;
  user: { id: string; name?: string | null };
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { data: authSession } = useSession();

  const { data: session, isLoading, refetch } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const updateChipsMutation = api.poker.updateSessionChips.useMutation();
  const kickPlayerMutation = api.poker.kickPlayer.useMutation();

  const [codeCopied, setCodeCopied] = useState(false);
  const [chipsInput, setChipsInput] = useState("1000");

  // Optimistic chip display: null means "use server data"
  const [optimisticChips, setOptimisticChips] = useState<number | null>(null);

  // Kick confirmation: stores userId currently being confirmed
  const [kickConfirm, setKickConfirm] = useState<string | null>(null);

  // Track which player IDs are "new" for entrance animation
  const [newPlayerIds, setNewPlayerIds] = useState<Set<string>>(new Set());
  const prevPlayerIds = useRef<Set<string>>(new Set());

  const socketRef = useRef<Socket | null>(null);

  const userId = authSession?.user?.id ?? "";

  // Sync chips input with server on first load
  useEffect(() => {
    if (session?.users?.[0]?.chips !== undefined && optimisticChips === null) {
      setChipsInput(String(session.users[0].chips));
    }
  }, [session]);

  // Detect newly joined players for animation
  useEffect(() => {
    if (!session?.users) return;
    const currentIds = new Set(session.users.map((u: SessionUser) => u.user.id));
    const incoming = new Set<string>();
    currentIds.forEach((id) => {
      if (!prevPlayerIds.current.has(id)) incoming.add(id);
    });
    if (incoming.size > 0) {
      setNewPlayerIds(incoming);
      setTimeout(() => setNewPlayerIds(new Set()), 600);
    }
    prevPlayerIds.current = currentIds;
  }, [session?.users]);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001", {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      withCredentials: false,
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join_session", sessionId));
    socket.on("player_joined", () => {
      void refetch();
      toast("Ein Spieler ist beigetreten 👋", { icon: "🃏", id: "player-join" });
    });
    socket.on("chips_updated", () => void refetch());
    socket.on("player_kicked", ({ kickedUserId }: { kickedUserId: string }) => {
      if (kickedUserId === userId) {
        toast.error("Du wurdest vom Host entfernt.");
        router.push("/");
      } else {
        void refetch();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, userId]);

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="mr-2 animate-spin" /> Lädt Raum…
      </div>
    );

  if (!session)
    return (
      <div className="flex h-screen items-center justify-center text-red-400">
        ⚠️ Session nicht gefunden
      </div>
    );

  const isHost = session.createdBy === userId;

  const copyCode = () => {
    void navigator.clipboard.writeText(String(session.sessionCode ?? ""));
    setCodeCopied(true);
    toast.success("Code kopiert!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const applyChips = () => {
    const val = Number(chipsInput);
    if (isNaN(val) || val < 1) return;

    // Optimistic update
    setOptimisticChips(val);

    updateChipsMutation.mutate(
      { sessionId, chips: val },
      {
        onSuccess: () => {
          socketRef.current?.emit("chips_updated", sessionId);
          toast.success("Chips aktualisiert!");
          void refetch().then(() => setOptimisticChips(null));
        },
        onError: () => {
          setOptimisticChips(null);
          toast.error("Chips konnten nicht gesetzt werden.");
        },
      }
    );
  };

  const confirmKick = (kickUserId: string) => {
    setKickConfirm(kickUserId);
  };

  const doKick = (kickUserId: string, playerName: string) => {
    kickPlayerMutation.mutate(
      { sessionId, userId: kickUserId },
      {
        onSuccess: () => {
          socketRef.current?.emit("kick_player", { sessionId, kickedUserId: kickUserId });
          toast.success(`${playerName} wurde entfernt.`);
          setKickConfirm(null);
        },
        onError: () => {
          toast.error("Kick fehlgeschlagen.");
          setKickConfirm(null);
        },
      }
    );
  };

  // Resolve displayed chips: optimistic > server
  const getDisplayedChips = (serverChips: number) =>
    optimisticChips !== null ? optimisticChips : serverChips;

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid #334155",
            fontSize: "13px",
          },
        }}
      />

      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 p-6 shadow-2xl backdrop-blur">

          {/* Room name + private badge + session code */}
          <div className="mb-6 flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-100">{session.name}</h1>
              {session.private && (
                <span
                  title="Private Session"
                  className="flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-400 border border-slate-700"
                >
                  <Lock size={10} className="text-slate-500" /> Privat
                </span>
              )}
            </div>
            {session.sessionCode && (
              <button
                onClick={copyCode}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-5 py-2.5 font-mono text-xl font-bold tracking-widest text-emerald-300 shadow-inner transition hover:bg-slate-700/80"
              >
                {String(session.sessionCode)}
                {codeCopied
                  ? <Check size={16} className="text-emerald-400" />
                  : <Copy size={16} className="text-slate-500" />}
              </button>
            )}
            <p className="text-xs text-slate-600">Code teilen zum Beitreten</p>
          </div>

          {/* Starting chips editor — host only */}
          {isHost && (
            <div className="mb-5 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
                Startchips — alle Spieler
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={chipsInput}
                  min={1}
                  onChange={(e) => setChipsInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyChips()}
                  className="w-32 rounded-lg bg-slate-700 px-3 py-2 text-center font-mono text-sm text-slate-100 outline-none focus:ring-1 focus:ring-emerald-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button
                  onClick={applyChips}
                  disabled={updateChipsMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-600 disabled:opacity-50"
                >
                  {updateChipsMutation.isPending && <Loader2 size={11} className="animate-spin" />}
                  Übernehmen
                </button>
              </div>
            </div>
          )}

          {/* Player list */}
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Spieler ({session.users.length})
            </p>
            <ul className="space-y-2">
              {session.users.map((u: SessionUser) => {
                const pName = u.user.name ?? "Unbekannt";
                const isPlayerHost = session.createdBy === u.user.id;
                const isMe = u.user.id === userId;
                const isNew = newPlayerIds.has(u.user.id);
                const isConfirming = kickConfirm === u.user.id;

                return (
                  <li
                    key={u.id}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 transition-all
                      ${isNew ? "animate-[fadeSlideIn_0.4s_ease_forwards]" : ""}
                      ${isMe
                        ? "border-emerald-800/60 bg-emerald-950/30"
                        : "border-slate-700/60 bg-slate-800/30"
                      }`}
                    style={
                      isNew
                        ? { animation: "fadeSlideIn 0.4s ease forwards" }
                        : undefined
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold
                          ${isMe ? "bg-emerald-700 text-emerald-100" : "bg-slate-700 text-slate-300"}`}
                      >
                        {pName.charAt(0).toUpperCase()}
                      </div>
                      <span className={`text-sm font-medium ${isMe ? "text-emerald-300" : "text-slate-200"}`}>
                        {pName}
                        {isMe && <span className="ml-1 text-[10px] text-emerald-600">(Du)</span>}
                      </span>
                      {isPlayerHost && (
                        <span className="rounded-full bg-yellow-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                          Host
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <ChipIcon className="h-3.5 w-3.5 text-slate-400" />
                        {getDisplayedChips(u.chips)}
                      </span>

                      {/* Kick button / confirm flow — host only, not self */}
                      {isHost && !isPlayerHost && (
                        isConfirming ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => doKick(u.user.id, pName)}
                              disabled={kickPlayerMutation.isPending}
                              className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-red-400 border border-red-800/50 hover:bg-red-900/30 transition disabled:opacity-40"
                            >
                              Ja
                            </button>
                            <button
                              onClick={() => setKickConfirm(null)}
                              className="rounded-md px-2 py-0.5 text-[11px] text-slate-500 border border-slate-700 hover:bg-slate-700/40 transition"
                            >
                              Nein
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => confirmKick(u.user.id)}
                            title={`${pName} entfernen`}
                            className="rounded-md p-1 text-slate-600 transition hover:bg-red-900/30 hover:text-red-400"
                          >
                            <UserX size={14} />
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* CTA */}
          {isHost ? (
            <button
              onClick={() => router.push(`/room/${sessionId}/game`)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-emerald-50 shadow transition hover:bg-emerald-500"
            >
              <Play size={15} /> Zum Spiel
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 text-sm text-slate-400">
                <span className="flex gap-0.5">
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:0ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:150ms]" />
                  <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500 [animation-delay:300ms]" />
                </span>
                Warte auf den Host
              </div>
              <button
                onClick={() => router.push(`/room/${sessionId}/game`)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
              >
                Zum Spiel beitreten <ChevronRight size={14} />
              </button>
            </div>
          )}

          <button
            onClick={() => router.push("/")}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-800 py-2 text-xs text-slate-600 transition hover:bg-slate-800/50 hover:text-slate-400"
          >
            <LogOut size={12} /> Raum verlassen
          </button>
        </div>
      </div>

      {/* Fade+slide keyframe for new player animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

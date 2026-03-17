"use client";

import { useSession } from "next-auth/react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { api } from "@/trpc/react";
import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import toast, { Toaster } from "react-hot-toast";
import {
  Loader2, Plus, LogIn, Trash2, Crown,
  Users, Zap, Lock, Search, X, ChevronRight,
} from "lucide-react";

// ─── Inline ChipIcon ──────────────────────────────────────────────────────────

function ChipIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`inline-block shrink-0 ${className}`} aria-hidden="true">
      <circle cx="10" cy="10" r="9"   fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5.5" fill="#450a0a" stroke="#ef4444" strokeWidth="1"   />
      <path
        d="M10 1v3M10 16v3M1 10h3M16 10h3M3.22 3.22l2.12 2.12M14.66 14.66l2.12 2.12M3.22 16.78l2.12-2.12M14.66 5.34l2.12-2.12"
        stroke="#fca5a5" strokeWidth="1.2" strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { label: string; dot: string; text: string }> = {
  waiting:   { label: "Wartet",  dot: "bg-yellow-400",  text: "text-yellow-300"  },
  laufend:   { label: "Wartet",  dot: "bg-yellow-400",  text: "text-yellow-300"  },
  active:    { label: "Aktiv",   dot: "bg-emerald-400", text: "text-emerald-300" },
  gestartet: { label: "Aktiv",   dot: "bg-emerald-400", text: "text-emerald-300" },
  finished:  { label: "Beendet", dot: "bg-slate-500",   text: "text-slate-400"   },
  beendet:   { label: "Beendet", dot: "bg-slate-500",   text: "text-slate-400"   },
};

type StatusFilter = "alle" | "laufend" | "gestartet" | "beendet";
const VALID_FILTERS: StatusFilter[] = ["alle", "laufend", "gestartet", "beendet"];
const FILTER_STORAGE_KEY = "poker_session_filter";

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionUser = {
  id: string;
  chips: number;
  user: { id: string; name?: string | null; developer?: boolean };
};

type PokerSession = {
  id: string;
  name: string;
  status: string;
  private: boolean;
  createdBy: string;
  sessionCode?: number | null;
  createdAt: Date;
  updatedAt: Date;
  users: SessionUser[];
};

// ─── Avatar row ───────────────────────────────────────────────────────────────

function AvatarRow({ users, max = 5 }: { users: SessionUser[]; max?: number }) {
  const visible = users.slice(0, max);
  const rest = users.length - max;
  return (
    <div className="flex items-center">
      {visible.map((u, i) => (
        <div
          key={u.id}
          title={u.user.name ?? "?"}
          style={{ zIndex: visible.length - i, marginLeft: i === 0 ? 0 : "-6px" }}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-slate-700 text-[10px] font-bold text-slate-300 ring-1 ring-slate-800"
        >
          {(u.user.name ?? "?").charAt(0).toUpperCase()}
        </div>
      ))}
      {rest > 0 && (
        <div
          style={{ marginLeft: "-6px", zIndex: 0 }}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-900 bg-slate-600 text-[9px] font-bold text-slate-400 ring-1 ring-slate-800"
        >
          +{rest}
        </div>
      )}
    </div>
  );
}

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-slate-800" />
        <div className="h-5 w-16 rounded-full bg-slate-800" />
      </div>
      <div className="mb-3 flex gap-3">
        <div className="h-3 w-20 rounded bg-slate-800" />
        <div className="h-3 w-16 rounded bg-slate-800" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => <div key={i} className="h-6 w-6 rounded-full bg-slate-800" />)}
        </div>
        <div className="h-7 w-24 rounded-lg bg-slate-800" />
      </div>
    </div>
  );
}

// ─── Delete confirmation button ───────────────────────────────────────────────

function DeleteButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-cancel confirmation after 3 seconds
  const startConfirm = () => {
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 3000);
  };

  const cancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
  };

  const confirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onConfirm();
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-slate-500">Sicher?</span>
        <button
          onClick={confirm}
          disabled={disabled}
          className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-red-400 border border-red-800/50 hover:bg-red-900/30 transition disabled:opacity-40"
        >
          Ja
        </button>
        <button
          onClick={cancel}
          className="rounded-md px-2 py-0.5 text-[11px] text-slate-500 border border-slate-700 hover:bg-slate-700/40 transition"
        >
          Nein
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); startConfirm(); }}
      disabled={disabled}
      title="Session löschen"
      className="rounded-lg border border-slate-700 p-1.5 text-slate-500 transition hover:border-red-700 hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50"
    >
      <Trash2 size={13} />
    </button>
  );
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function SessionSelectInner() {
  const { data: authSession, status: authStatus } = useSession();
  const router    = useRouter();
  const pathname  = usePathname();
  const searchParams = useSearchParams();

  // ── Filter state: URL param → localStorage → default ──────────────────────
  const getInitialFilter = useCallback((): StatusFilter => {
    const fromUrl = searchParams.get("filter") as StatusFilter | null;
    if (fromUrl && VALID_FILTERS.includes(fromUrl)) return fromUrl;
    try {
      const stored = localStorage.getItem(FILTER_STORAGE_KEY) as StatusFilter | null;
      if (stored && VALID_FILTERS.includes(stored)) return stored;
    } catch {}
    return "alle";
  }, [searchParams]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(getInitialFilter);
  const [search, setSearch]             = useState("");
  const [showCreate, setShowCreate]     = useState(false);
  const [newName, setNewName]           = useState("");
  const [newPrivate, setNewPrivate]     = useState(false);
  const [showJoinByCode, setShowJoinByCode] = useState(false);
  const [sessionCode, setSessionCode]   = useState("");
  const [codeError, setCodeError]       = useState("");

  const [animatedIds, setAnimatedIds]   = useState<Set<string>>(new Set());
  const prevIds = useRef<Set<string>>(new Set());

  // ── Sync filter to URL + localStorage ─────────────────────────────────────
  const applyFilter = (f: StatusFilter) => {
    setStatusFilter(f);
    try { localStorage.setItem(FILTER_STORAGE_KEY, f); } catch {}
    const params = new URLSearchParams(searchParams.toString());
    if (f === "alle") params.delete("filter");
    else params.set("filter", f);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // ── Data ───────────────────────────────────────────────────────────────────
  const { data: sessions, isLoading, refetch } = api.poker.getSessions.useQuery(undefined, {
    enabled: authStatus === "authenticated",
    refetchInterval: 12000,
  });

  const createSession = api.poker.createSession.useMutation({
    onSuccess: (data) => {
      void refetch();
      setShowCreate(false);
      setNewName("");
      setNewPrivate(false);
      toast.success("Session erstellt!");
      router.push(`/room/${data.sessionID}`);
    },
    onError: (err) => toast.error(err.message ?? "Session konnte nicht erstellt werden."),
  });

  const joinSession = api.poker.joinSession.useMutation({
    onSuccess: (data) => {
      void refetch();
      router.push(`/room/${data.sessionId}`);
    },
    onError: (err) => toast.error(err.message ?? "Beitreten fehlgeschlagen."),
  });

  const joinSessionByCode = api.poker.joinSessionByCode.useMutation({
    onSuccess: (data) => {
      void refetch();
      setShowJoinByCode(false);
      setSessionCode("");
      toast.success("Beigetreten!");
      router.push(`/room/${data.sessionId}`);
    },
    onError: (err) => setCodeError(err.message),
  });

  const clearSession = api.poker.clearSession.useMutation({
    onSuccess: () => { void refetch(); toast.success("Session gelöscht."); },
    onError: (err) => toast.error(err.message ?? "Löschen fehlgeschlagen."),
  });

  const developerClearSession = api.poker.developerClearSession.useMutation({
    onSuccess: () => { void refetch(); toast.success("[Dev] Session gelöscht."); },
    onError: (err) => toast.error(err.message ?? "Löschen fehlgeschlagen."),
  });

  // ── Entrance animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessions) return;
    const currentIds = new Set(sessions.map((s: PokerSession) => s.id));
    const incoming = new Set<string>();
    currentIds.forEach((id) => { if (!prevIds.current.has(id)) incoming.add(id); });
    if (incoming.size > 0) {
      setAnimatedIds(incoming);
      setTimeout(() => setAnimatedIds(new Set()), 500);
    }
    prevIds.current = currentIds;
  }, [sessions]);

  const isDeveloper = authSession?.user?.developer === true;
  const userId      = authSession?.user?.id ?? "";

  // ── Auto-format join code ──────────────────────────────────────────────────
  const handleCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    const formatted = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
    setSessionCode(formatted);
    setCodeError("");
    if (digits.length === 6) {
      setTimeout(() => joinSessionByCode.mutate({ sessionCode: digits }), 80);
    }
  };

  // ── Filtered list ──────────────────────────────────────────────────────────
  const filtered = (sessions ?? []).filter((s: PokerSession) => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "alle" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "alle",      label: "Alle"    },
    { key: "laufend",   label: "Wartet"  },
    { key: "gestartet", label: "Aktiv"   },
    { key: "beendet",   label: "Beendet" },
  ];

  if (authStatus === "loading")
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Lädt…
      </div>
    );

  if (authStatus === "unauthenticated") {
    router.push("/api/auth/signin");
    return null;
  }

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

      <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">

        {/* Hero */}
        <div className="border-b border-slate-800 bg-slate-950/80 px-6 py-10 text-center">
          <div className="mb-3 flex justify-center">
            <ChipIcon className="h-12 w-12 drop-shadow-lg" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100">
            Willkommen, <span className="text-emerald-400">{authSession?.user?.name}</span> 👋
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Erstelle eine neue Session oder tritt einer bestehenden bei.
          </p>
          {isDeveloper && (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-600 bg-sky-900/30 px-3 py-1 text-xs font-semibold text-sky-300">
              <Zap size={11} /> Developer
            </span>
          )}
        </div>

        <div className="mx-auto max-w-3xl px-4 py-8">

          {/* Header row */}
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200">Deine Poker-Sessions</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setShowJoinByCode(true); setCodeError(""); }}
                className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800 active:scale-95"
              >
                <LogIn size={15} /> Per Code beitreten
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-50 shadow transition hover:bg-emerald-500 active:scale-95"
              >
                <Plus size={15} /> Neue Session
              </button>
            </div>
          </div>

          {/* Search + status filter */}
          <div className="mb-5 space-y-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Session suchen…"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pl-8 pr-9 text-sm text-slate-100 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            <div className="flex gap-1.5">
              {statusTabs.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => applyFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    statusFilter === key
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Create session modal */}
          {showCreate && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowCreate(false);
                  setNewName("");
                  setNewPrivate(false);
                }
              }}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                style={{ animation: "fadeSlideIn 0.25s ease forwards" }}
              >
                <h3 className="mb-4 text-lg font-bold text-slate-100">Session erstellen</h3>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-400">Name</label>
                    <input
                      autoFocus
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        newName.trim().length >= 3 &&
                        createSession.mutate({ name: newName.trim(), privateSession: newPrivate, createdBy: userId })
                      }
                      placeholder="z. B. Freitagsrunde"
                      maxLength={50}
                      className="w-full rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-600"
                    />
                    <p className="mt-1 text-right text-[10px] text-slate-600">{newName.length}/50</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewPrivate((v) => !v)}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
                      newPrivate
                        ? "border-slate-600 bg-slate-800/60 text-slate-200"
                        : "border-slate-700/50 bg-slate-800/30 text-slate-500"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Lock size={13} /> Private Session
                    </span>
                    <div className={`h-4 w-7 rounded-full transition-colors ${newPrivate ? "bg-emerald-600" : "bg-slate-700"}`}>
                      <div className={`mt-0.5 ml-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${newPrivate ? "translate-x-3" : "translate-x-0"}`} />
                    </div>
                  </button>
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => { setShowCreate(false); setNewName(""); setNewPrivate(false); }}
                    className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Abbrechen
                  </button>
                  <button
                    disabled={newName.trim().length < 3 || createSession.isPending}
                    onClick={() => createSession.mutate({ name: newName.trim(), privateSession: newPrivate, createdBy: userId })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {createSession.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    Erstellen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join by code modal */}
          {showJoinByCode && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setShowJoinByCode(false);
                  setSessionCode("");
                  setCodeError("");
                }
              }}
            >
              <div
                className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
                style={{ animation: "fadeSlideIn 0.25s ease forwards" }}
              >
                <h3 className="mb-1 text-lg font-bold text-slate-100">Per Code beitreten</h3>
                <p className="mb-4 text-xs text-slate-500">Gib den 6-stelligen Session-Code ein.</p>
                <input
                  autoFocus
                  type="text"
                  inputMode="numeric"
                  value={sessionCode}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  placeholder="123 456"
                  className={`w-full rounded-lg bg-slate-800 px-3 py-2.5 text-center font-mono text-xl font-bold tracking-[0.3em] text-slate-100 outline-none placeholder:text-slate-700 ${
                    codeError ? "ring-1 ring-red-500" : "focus:ring-2 focus:ring-sky-600"
                  }`}
                />
                {codeError && <p className="mt-2 text-xs text-red-400">{codeError}</p>}
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => { setShowJoinByCode(false); setSessionCode(""); setCodeError(""); }}
                    className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  >
                    Abbrechen
                  </button>
                  <button
                    disabled={sessionCode.replace(/\s/g, "").length < 6 || joinSessionByCode.isPending}
                    onClick={() => joinSessionByCode.mutate({ sessionCode: sessionCode.replace(/\s/g, "") })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 text-sm font-semibold text-sky-50 hover:bg-sky-500 disabled:opacity-50"
                  >
                    {joinSessionByCode.isPending ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                    Beitreten
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Session list */}
          {isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : filtered.length ? (
            <ul className="space-y-3">
              {filtered.map((s: PokerSession) => {
                const isHost      = s.createdBy === userId;
                const isInSession = s.users.some((u) => u.user.id === userId);
                const isEnded     = s.status === "beendet" || s.status === "finished";
                const statusStyle = STATUS_STYLES[s.status] ?? STATUS_STYLES["laufend"]!;
                const isNew       = animatedIds.has(s.id);
                const hasChips    = s.users.length > 0 && s.users[0]?.chips !== undefined;

                return (
                  <li
                    key={s.id}
                    style={isNew ? { animation: "fadeSlideIn 0.35s ease forwards" } : undefined}
                    className={`group flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                      // Dim ended sessions the user was part of
                      isEnded && isInSession
                        ? "border-slate-800/40 bg-slate-900/30 opacity-60"
                        : isInSession
                        ? "border-emerald-800/50 bg-emerald-950/20"
                        : "border-slate-800 bg-slate-900/70 hover:border-slate-600"
                    }`}
                  >
                    {/* Left — session info */}
                    <div className="flex flex-col gap-1.5">

                      {/* Name + badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-100">{s.name}</span>
                        {isHost && (
                          <span className="flex items-center gap-1 rounded-full bg-yellow-900/40 px-2 py-0.5 text-[10px] font-semibold text-yellow-300">
                            <Crown size={9} /> Host
                          </span>
                        )}
                        {s.private && (
                          <span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">
                            <Lock size={9} /> Privat
                          </span>
                        )}
                        {isInSession && !isEnded && (
                          <span className="rounded-full bg-emerald-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-500 border border-emerald-900/50">
                            Beigetreten
                          </span>
                        )}
                        <span className={`flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold ${statusStyle.text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
                          {statusStyle.label}
                        </span>
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users size={11} /> {s.users.length} Spieler
                        </span>
                        {hasChips && (
                          <span className="flex items-center gap-1">
                            <ChipIcon className="h-3 w-3" />
                            {s.users[0]!.chips} Chips
                          </span>
                        )}
                        {s.createdAt && (
                          <span>
                            {formatDistanceToNow(s.createdAt, { addSuffix: true, locale: de })}
                          </span>
                        )}
                      </div>

                      {/* Avatars */}
                      <AvatarRow users={s.users} />
                    </div>

                    {/* Right — actions */}
                    <div className="flex shrink-0 items-center gap-2">

                      {/* Already in session */}
                      {isInSession && (
                        <button
                          onClick={() => router.push(`/room/${s.id}`)}
                          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            isEnded
                              ? "border border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700"
                              : "bg-emerald-700 text-emerald-50 hover:bg-emerald-600"
                          }`}
                        >
                          {s.status === "gestartet"
                            ? "Weiterspielen"
                            : isEnded
                            ? "Ergebnisse"
                            : "Lobby"}
                          <ChevronRight size={11} />
                        </button>
                      )}

                      {/* Not in session — show appropriate action or reason */}
                      {!isInSession && (
                        s.status === "laufend" ? (
                          <button
                            onClick={() => joinSession.mutate({ sessionId: s.id })}
                            disabled={joinSession.isPending}
                            className="flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 text-xs font-semibold text-sky-50 hover:bg-sky-600 disabled:opacity-50"
                          >
                            {joinSession.isPending
                              ? <Loader2 size={12} className="animate-spin" />
                              : <LogIn size={12} />
                            }
                            Beitreten
                          </button>
                        ) : (
                          <span className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-1.5 text-[11px] text-slate-600">
                            {isEnded ? "Beendet" : "Bereits gestartet"}
                          </span>
                        )
                      )}

                      {/* Delete — host or developer */}
                      {(isHost || isDeveloper) && (
                        <DeleteButton
                          disabled={clearSession.isPending || developerClearSession.isPending}
                          onConfirm={() =>
                            isDeveloper
                              ? developerClearSession.mutate({ sessionId: s.id })
                              : clearSession.mutate({ sessionId: s.id })
                          }
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-800 py-16 text-center">
              <svg viewBox="0 0 80 60" className="h-16 w-20 text-slate-700" fill="none" aria-hidden="true">
                <ellipse cx="40" cy="30" rx="36" ry="22" fill="currentColor" opacity="0.4" />
                <ellipse cx="40" cy="30" rx="26" ry="14" fill="#0f172a" />
                <circle cx="18" cy="20" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="40" cy="14" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="62" cy="20" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="62" cy="40" r="4" fill="currentColor" opacity="0.5" />
                <circle cx="18" cy="40" r="4" fill="currentColor" opacity="0.5" />
              </svg>
              <div>
                <p className="font-semibold text-slate-400">
                  {search || statusFilter !== "alle" ? "Keine Sessions gefunden" : "Noch keine Sessions"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {search || statusFilter !== "alle"
                    ? "Versuche andere Filter"
                    : "Erstelle eine neue Session und lade Freunde ein"}
                </p>
              </div>
              {!search && statusFilter === "alle" && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500"
                >
                  <Plus size={14} /> Erste Session erstellen
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ─── Export wrapped in Suspense (required for useSearchParams) ────────────────

export default function SessionSelectPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
        <Loader2 className="animate-spin mr-2" /> Lädt…
      </div>
    }>
      <SessionSelectInner />
    </Suspense>
  );
}

"use client";

import { useParams, useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Loader2, Trophy, Play, Send, CheckCircle, Circle, MessageSquare, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useSession } from "next-auth/react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Member = {
  name: string;
  chips: number;
  settedChips: number;
  checked: boolean;
  allIn: boolean;
  cards: number[][];
};

type PlayerHand = {
  name: string;
  cards: number[][];
  handType: string | null;
  chips: number;
};

type ChatMessage = {
  playerName: string;
  message: string;
  timestamp: number;
};

type BetAction = {
  playerName: string;
  action: "call" | "raise" | "fold";
  amount?: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const VALUE_MAP: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };
const SUIT_MAP: Record<number, { symbol: string; red: boolean }> = {
  1: { symbol: "♦", red: true },
  2: { symbol: "♥", red: true },
  3: { symbol: "♠", red: false },
  4: { symbol: "♣", red: false },
};

const PHASE_NAMES: Record<number, string> = {
  0: "Warten…", 1: "Pre-Flop", 2: "Flop", 3: "Turn", 4: "River", 5: "Showdown",
};

const HAND_COLORS: Record<string, string> = {
  "Royal Flush": "text-yellow-300",
  "Straight Flush": "text-orange-300",
  "Four of a Kind": "text-pink-300",
  "Full House": "text-purple-300",
  "Flush": "text-blue-300",
  "Straight": "text-cyan-300",
  "Three of a Kind": "text-emerald-300",
  "Two Pair": "text-lime-300",
  "One Pair": "text-slate-300",
  "High Card": "text-slate-400",
};

const SEAT_LAYOUTS: Record<number, { x: number; y: number }[]> = {
  2: [{ x: 50, y: 88 }, { x: 50, y: 10 }],
  3: [{ x: 50, y: 88 }, { x: 15, y: 25 }, { x: 85, y: 25 }],
  4: [{ x: 50, y: 88 }, { x: 8, y: 50 }, { x: 50, y: 10 }, { x: 92, y: 50 }],
  5: [{ x: 50, y: 88 }, { x: 8, y: 60 }, { x: 20, y: 12 }, { x: 80, y: 12 }, { x: 92, y: 60 }],
  6: [{ x: 50, y: 88 }, { x: 8, y: 62 }, { x: 12, y: 22 }, { x: 50, y: 8 }, { x: 88, y: 22 }, { x: 92, y: 62 }],
  7: [{ x: 50, y: 88 }, { x: 8, y: 65 }, { x: 8, y: 32 }, { x: 28, y: 8 }, { x: 72, y: 8 }, { x: 92, y: 32 }, { x: 92, y: 65 }],
  8: [{ x: 50, y: 88 }, { x: 8, y: 65 }, { x: 8, y: 32 }, { x: 22, y: 8 }, { x: 50, y: 5 }, { x: 78, y: 8 }, { x: 92, y: 32 }, { x: 92, y: 65 }],
  9: [{ x: 50, y: 88 }, { x: 8, y: 68 }, { x: 5, y: 42 }, { x: 12, y: 18 }, { x: 34, y: 5 }, { x: 66, y: 5 }, { x: 88, y: 18 }, { x: 95, y: 42 }, { x: 92, y: 68 }],
  10: [{ x: 50, y: 88 }, { x: 18, y: 82 }, { x: 5, y: 58 }, { x: 5, y: 32 }, { x: 18, y: 10 }, { x: 50, y: 5 }, { x: 82, y: 10 }, { x: 95, y: 32 }, { x: 95, y: 58 }, { x: 82, y: 82 }],
};

// ─── Sound Engine ─────────────────────────────────────────────────────────────

function createAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try { return new (window.AudioContext ?? (window as any).webkitAudioContext)(); }
  catch { return null; }
}

function playTone(ctx: AudioContext, freq: number, type: OscillatorType, duration: number, vol = 0.18) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

function soundChip(ctx: AudioContext) {
  playTone(ctx, 1200, "sine", 0.06, 0.22);
  playTone(ctx, 900, "triangle", 0.1, 0.12);
}

function soundCardFlip(ctx: AudioContext) {
  playTone(ctx, 3000, "sawtooth", 0.04, 0.08);
  playTone(ctx, 2000, "sawtooth", 0.06, 0.07);
}

function soundRaise(ctx: AudioContext) {
  [600, 800, 1000].forEach((f, i) => {
    setTimeout(() => playTone(ctx, f, "sine", 0.12, 0.2), i * 60);
  });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

async function fireConfetti() {
  try {
    const mod = await import("canvas-confetti" as any);
    const confetti = mod.default ?? mod;
    void confetti({ particleCount: 200, spread: 90, origin: { y: 0.55 }, colors: ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#a855f7"] });
    setTimeout(() => void confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0 } }), 300);
    setTimeout(() => void confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1 } }), 500);
  } catch { /* canvas-confetti not installed */ }
}

// ─── ChipIcon ─────────────────────────────────────────────────────────────────

function ChipIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={`inline-block shrink-0 ${className}`} aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="#7f1d1d" stroke="#ef4444" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="5.5" fill="#450a0a" stroke="#ef4444" strokeWidth="1" />
      <path d="M10 1v3M10 16v3M1 10h3M16 10h3M3.22 3.22l2.12 2.12M14.66 14.66l2.12 2.12M3.22 16.78l2.12-2.12M14.66 5.34l2.12-2.12"
        stroke="#fca5a5" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Card components ──────────────────────────────────────────────────────────

function cardLabel(card: number[]): string {
  const suit = card[0] ?? 0;
  const val = card[1] ?? 0;
  return `${VALUE_MAP[val] ?? val}${SUIT_MAP[suit]?.symbol ?? "?"}`;
}

function CardFace({ card, small = false, delay = 0 }: { card: number[]; small?: boolean; delay?: number }) {
  const red = SUIT_MAP[card[0] ?? 0]?.red ?? false;
  return (
    <div
      className={`card-deal flex items-center justify-center rounded-md border border-slate-300 bg-white font-bold shadow
        ${small ? "h-12 w-8 text-xs" : "h-16 w-11 text-sm"}
        ${red ? "text-red-500" : "text-slate-900"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {cardLabel(card)}
    </div>
  );
}

function CardBack({ small = false, delay = 0 }: { small?: boolean; delay?: number }) {
  return (
    <div
      className={`card-deal flex items-center justify-center rounded-md border border-slate-600 bg-gradient-to-br from-blue-900 to-blue-700 font-bold text-slate-300 shadow
        ${small ? "h-12 w-8 text-xs" : "h-16 w-11 text-sm"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      ?
    </div>
  );
}

// ─── Player Seat ──────────────────────────────────────────────────────────────

function PlayerSeat({ u, member, isCurrentUser, isCurrent, isActive, isSmallBlind, isBigBlind }: {
  u: any; member: Member | undefined; isCurrentUser: boolean;
  isCurrent: boolean; isActive: boolean;
  isSmallBlind: boolean; isBigBlind: boolean;
}) {
  const pName = u.user.name ?? "Unbekannt";
  const chips = member?.chips ?? u.chips;
  const settedChips = member?.settedChips ?? 0;
  const checked = member?.checked ?? false;
  const allIn = member?.allIn ?? false;
  const card1 = member?.cards?.[0];
  const card2 = member?.cards?.[1];
  const hasFolded = !isActive && !allIn && chips > 0;
  const initial = pName.charAt(0).toUpperCase();

  return (
    <div className={`relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-2.5 backdrop-blur transition-all select-none
    ${isCurrent ? "border-emerald-400 bg-emerald-900/60 ring-2 ring-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.45)]" : "border-slate-700/80 bg-slate-900/80"}
    ${hasFolded ? "opacity-40" : ""}
    ${isCurrentUser && isCurrent ? "your-turn-pulse" : ""}`}
    >
      {/* Avatar */}
      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold
      ${isCurrentUser ? "bg-emerald-700 text-emerald-100" : "bg-slate-700 text-slate-200"}`}>
        {initial}
      </div>

      {/* Cards */}
      <div className="flex gap-1">
        {isCurrentUser ? (
          <>
            {card1 ? <CardFace card={card1} small delay={0} /> : <CardBack small />}
            {card2 ? <CardFace card={card2} small delay={120} /> : <CardBack small />}
          </>
        ) : (
          isActive || allIn
            ? <><CardBack small delay={0} /><CardBack small delay={120} /></>
            : <>
              <div className="h-12 w-8 rounded-md border border-slate-800 bg-slate-900/30" />
              <div className="h-12 w-8 rounded-md border border-slate-800 bg-slate-900/30" />
            </>
        )}
      </div>

      {/* Name */}
      <span className={`text-xs font-semibold leading-none ${isCurrentUser ? "text-emerald-300" : "text-slate-100"}`}>
        {pName.length > 10 ? pName.slice(0, 9) + "…" : pName}
        {isCurrentUser && <span className="ml-0.5 text-[10px] text-emerald-500">(Du)</span>}
      </span>

      {/* Badges */}
      <div className="flex flex-wrap justify-center gap-0.5">
        {isSmallBlind && <span className="rounded-full bg-blue-900/70 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">SB</span>}
        {isBigBlind && <span className="rounded-full bg-purple-900/70 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">BB</span>}
        {hasFolded && <span className="rounded-full bg-red-900/60 px-1.5 py-0.5 text-[10px] text-red-300">Fold</span>}
        {checked && isActive && <span className="rounded-full bg-emerald-900/60 px-1.5 py-0.5 text-[10px] text-emerald-300">✓</span>}
        {allIn && <span className="rounded-full bg-yellow-900/60 px-1.5 py-0.5 text-[10px] text-yellow-300">All-In 🔥</span>}
      </div>

      {/* Chips */}
      <div className="flex items-center gap-1.5 text-xs text-slate-300">
        <ChipIcon className="h-4 w-4" />
        <span className="font-semibold">{chips}</span>
        {settedChips > 0 && (
          <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-300">+{settedChips}</span>
        )}
      </div>
    </div>
  );

}

// ─── Oval Table ───────────────────────────────────────────────────────────────

function OvalTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex-1 min-h-0 w-full">
      <div className="absolute inset-0 rounded-[50%] shadow-2xl"
        style={{ background: "radial-gradient(ellipse at 30% 30%, #92400e, #451a03 70%)", boxShadow: "0 0 0 8px #78350f, 0 8px 48px rgba(0,0,0,0.8)" }} />
      <div className="absolute inset-[14px] rounded-[50%] overflow-hidden"
        style={{ background: "radial-gradient(ellipse at 40% 35%, #166534, #14532d 55%, #052e16 100%)", boxShadow: "inset 0 4px 32px rgba(0,0,0,0.5)" }}>
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg, #fff 0px, transparent 1px, transparent 8px)", backgroundSize: "8px 8px" }} />
      </div>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PokerGamePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const { data: authSession } = useSession();
  const { data: session, isLoading } = api.poker.getSessionById.useQuery(
    { sessionId },
    { enabled: !!sessionId }
  );

  const [turnOrder, setTurnOrder] = useState<string[]>([]);
  const [phase, setPhase] = useState(0);
  const [currentPlayer, setCurrentPlayer] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [raiseInputValue, setRaiseInputValue] = useState("0");
  const [tableCards, setTableCards] = useState<number[][]>([]);
  const [roundWinner, setRoundWinner] = useState("");
  const [roundPot, setRoundPot] = useState(0);
  const [gamePaused, setGamePaused] = useState(false);
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [readyPlayers, setReadyPlayers] = useState<string[]>([]);
  const [betHistory, setBetHistory] = useState<BetAction[]>([]);
  const [showFoldConfirm, setShowFoldConfirm] = useState(false);
  const [smallBlind, setSmallBlind] = useState("");
  const [bigBlind, setBigBlind] = useState("");
  const [roundNumber, setRoundNumber] = useState(0);
  const [bustNotification, setBustNotification] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [unreadChat, setUnreadChat] = useState(0);

  const isChatAtBottom = useRef(true);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const betHistoryBottomRef = useRef<HTMLDivElement>(null);
  const prevMembersRef = useRef<Member[]>([]);
  const socketRef = useRef<Socket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const prevTableCardsLen = useRef(0);
  const isMyTurnRef = useRef(false);
  const checkCallRef = useRef<(() => void) | null>(null);
  const raiseRef = useRef<(() => void) | null>(null);

  const userName = authSession?.user?.name ?? "Unbekannt";

  const getAudio = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = createAudioContext();
    return audioCtxRef.current;
  }, []);

  // Tab title
  useEffect(() => {
    document.title = userName === currentPlayer ? "🃏 Dein Zug!" : (session?.name ?? "Poker");
    return () => { document.title = "Poker"; };
  }, [currentPlayer, userName, session?.name]);

  // Confetti
  useEffect(() => {
    if (gamePaused && roundWinner === userName) void fireConfetti();
  }, [gamePaused, roundWinner, userName]);

  // Card flip sound
  useEffect(() => {
    if (tableCards.length > prevTableCardsLen.current) {
      const ctx = getAudio();
      if (ctx) soundCardFlip(ctx);
    }
    prevTableCardsLen.current = tableCards.length;
  }, [tableCards]);

  // Socket
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001", {
      transports: ["websocket", "polling"],
      path: "/socket.io",
      withCredentials: false,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => socket.emit("join_session", sessionId));
    socket.on("connect_error", (err) => console.error("🚫", err.message));

    socket.on("update_members", (m: Member[]) => {
      const prev = prevMembersRef.current;
      const busted = m.find(
        (newM) => newM.chips === 0 && (prev.find((p) => p.name === newM.name)?.chips ?? 1) > 0
      );
      if (busted) {
        setBustNotification(busted.name);
        setTimeout(() => setBustNotification(null), 4000);
      }
      prevMembersRef.current = m;
      setMembers(m);
    });

    socket.on("update_ready", (ready: string[]) => setReadyPlayers(ready));

    socket.on("update_turn", ({ turnOrder, currentPlayer, phase, tableCards, smallBlind, bigBlind, roundNumber }) => {
      setTurnOrder(turnOrder);
      setCurrentPlayer(currentPlayer);
      setPhase(phase);
      setTableCards(tableCards);
      setSmallBlind(smallBlind ?? "");
      setBigBlind(bigBlind ?? "");
      setRoundNumber(roundNumber ?? 0);
    });

    socket.on("player_action", (action: BetAction) => {
      setBetHistory((prev) => [...prev.slice(-49), action]);
      const ctx = getAudio();
      if (ctx) {
        if (action.action === "raise") soundRaise(ctx);
        else if (action.action === "call") soundChip(ctx);
      }
    });

    socket.on("round_ends", ({ winnerName, totalPot, playerHands }: {
      winnerName: string; totalPot: number; playerHands: PlayerHand[];
    }) => {
      setRoundWinner(winnerName);
      setRoundPot(totalPot);
      setPlayerHands(playerHands ?? []);
      setGamePaused(true);
    });

    socket.on("round_continues", () => {
      setRoundWinner("");
      setGamePaused(false);
      setPlayerHands([]);
      setBetHistory([]);
    });

    socket.on("game_finished", () => router.push(`/room/${sessionId}`));

    socket.on("chat_message", (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
      if (!isChatAtBottom.current) setUnreadChat((n) => n + 1);
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [sessionId]);

  // Chat auto-scroll
  useEffect(() => {
    if (isChatAtBottom.current) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setUnreadChat(0);
    }
  }, [chatMessages]);

  useEffect(() => {
    betHistoryBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [betHistory]);

  useEffect(() => {
    setRaiseInputValue(String(raiseAmount));
  }, [raiseAmount]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!isMyTurnRef.current) return;
      if (e.key === "c" || e.key === "C") checkCallRef.current?.();
      if (e.key === "r" || e.key === "R") raiseRef.current?.();
      if (e.key === "f" || e.key === "F") setShowFoldConfirm((v) => !v);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (isLoading)
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="mr-2 animate-spin" /> Lädt Spiel…
      </div>
    );

  if (!session)
    return (
      <div className="flex h-screen items-center justify-center text-red-400">
        ⚠️ Session nicht gefunden
      </div>
    );

  const isHost = session.createdBy === authSession?.user?.id;
  const isMyTurn = userName === currentPlayer;
  const gameStarted = !!currentPlayer;
  const myMember = members.find((m) => m.name === userName);
  const maxSettedChips = Math.max(...members.map((m) => m.settedChips), 0);
  const mySettedChips = myMember?.settedChips ?? 0;
  const minRaise = maxSettedChips - mySettedChips + 1;
  const callAmount = Math.min(myMember?.chips ?? 0, maxSettedChips - mySettedChips);
  const totalPot = members.reduce((sum, m) => sum + m.settedChips, 0);
  const myChips = myMember?.chips ?? 0;

  isMyTurnRef.current = isMyTurn;

  const allPlayers = session.users.map((u: any) => u.user.name ?? "Unbekannt");
  const nonHostPlayers = allPlayers.filter((n: string) => {
    const u = session.users.find((u: any) => (u.user.name ?? "Unbekannt") === n);
    return u?.user.id !== session.createdBy;
  });
  const allReady = nonHostPlayers.every((name: string) => readyPlayers.includes(name));
  const iAmReady = readyPlayers.includes(userName);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (raiseAmount < minRaise) setRaiseAmount(minRaise);
  }, [minRaise]);

  const handleStartGame = () => {
    socketRef.current?.emit("start_session", {
      sessionId,
      players: session.users.map((u: any) => ({ name: u.user.name ?? "Unbekannt", chips: u.chips })),
    });
  };

  const toggleReady = () => socketRef.current?.emit("player_ready", { sessionId, playerName: userName });

  const checkCall = () => {
    if (!socketRef.current || !isMyTurn) return;
    const ctx = getAudio();
    if (ctx) soundChip(ctx);
    socketRef.current.emit("check_call", { sessionId, playerName: userName });
  };
  checkCallRef.current = checkCall;

  const raise = () => {
    if (!socketRef.current || !isMyTurn || raiseAmount <= 0) return;
    const ctx = getAudio();
    if (ctx) soundRaise(ctx);
    socketRef.current.emit("raise", { sessionId, playerName: userName, amount: raiseAmount });
  };
  raiseRef.current = raise;

  const fold = () => {
    if (!socketRef.current || !isMyTurn) return;
    socketRef.current.emit("fold", { sessionId, playerName: userName });
    setShowFoldConfirm(false);
  };

  const nextRound = () => { if (socketRef.current && isHost) socketRef.current.emit("continue", sessionId); };
  const finish = () => { if (socketRef.current && isHost) socketRef.current.emit("finish", sessionId); };

  const sendChat = () => {
    const msg = chatInput.trim();
    if (!msg || !socketRef.current) return;
    socketRef.current.emit("chat_message", { sessionId, playerName: userName, message: msg });
    setChatInput("");
  };

  const copyCode = () => {
    void navigator.clipboard.writeText(String(session.sessionCode));
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const potRaisePresets = [
    { label: "½ Pot", value: Math.max(minRaise, Math.floor(totalPot / 2)) },
    { label: "Pot", value: Math.max(minRaise, totalPot) },
    { label: "2× Pot", value: Math.max(minRaise, totalPot * 2) },
  ];

  const count = Math.min(allPlayers.length, 10);
  const layout = SEAT_LAYOUTS[count] ?? SEAT_LAYOUTS[6]!;
  const myIdx = allPlayers.indexOf(userName);

  const sliderPct = myChips > minRaise
    ? Math.round(((raiseAmount - minRaise) / (myChips - minRaise)) * 100)
    : 0;

  const actionLabel = (a: BetAction) => {
    if (a.action === "fold") return <><span className="mr-1">🔴</span><span className="text-red-400">Fold</span></>;
    if (a.action === "raise") return <><span className="mr-1">🔵</span><span className="text-sky-400">Raise <span className="font-semibold">+{a.amount}</span></span></>;
    if (a.action === "call") return <><span className="mr-1">🟢</span><span className="text-emerald-400">Call{a.amount ? <span className="font-semibold"> +{a.amount}</span> : ""}</span></>;
    return null;
  };

  return (
    <>
      <style>{`
        @keyframes dealCard {
          0%   { opacity: 0; transform: translateY(-28px) scale(0.82) rotate(-8deg); }
          55%  { transform: translateY(5px) scale(1.04) rotate(1.5deg); }
          100% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
        }
        .card-deal { animation: dealCard 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both; }

        @keyframes yourTurnPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(52,211,153,0.6); }
          50%       { box-shadow: 0 0 0 8px rgba(52,211,153,0); }
        }
        .your-turn-pulse { animation: yourTurnPulse 1.2s ease-in-out infinite; }

        @keyframes winSlideUp {
          from { opacity: 0; transform: translateY(40px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .win-modal { animation: winSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>

      <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-100">

        {/* Bust notification */}
        {bustNotification && (
          <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-red-700 bg-red-950/90 px-5 py-3 text-sm font-semibold text-red-300 shadow-xl backdrop-blur">
            💀 {bustNotification} ist ausgeschieden
          </div>
        )}

        {/* Pre-game overlay */}
        {!gameStarted && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
              <p className="mb-1 text-center text-xl font-bold text-slate-100">{session.name}</p>
              <p className="mb-5 text-center text-sm text-slate-400">{session.users.length} Spieler verbunden</p>
              <ul className="mb-5 space-y-2">
                {session.users.map((u: any) => {
                  const pName = u.user.name ?? "Unbekannt";
                  const isPlayerHost = session.createdBy === u.user.id;
                  const isReady = isPlayerHost || readyPlayers.includes(pName);
                  return (
                    <li key={u.id} className="flex items-center justify-between rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
                      <span className={pName === userName ? "font-medium text-emerald-300" : "text-slate-200"}>
                        {pName}{isPlayerHost && <span className="ml-1.5 text-[10px] text-yellow-400">Host</span>}
                      </span>
                      {isPlayerHost
                        ? <span className="text-[10px] italic text-slate-500">wartet</span>
                        : isReady ? <CheckCircle size={15} className="text-emerald-400" /> : <Circle size={15} className="text-slate-600" />}
                    </li>
                  );
                })}
              </ul>
              {isHost ? (
                <>
                  <button onClick={handleStartGame} disabled={session.users.length < 2 || !allReady}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                    <Play size={15} /> Spiel starten
                  </button>
                  {!allReady && <p className="mt-2 text-center text-xs text-slate-500">Warte bis alle Spieler bereit sind…</p>}
                  {session.users.length < 2 && <p className="mt-1 text-center text-xs text-slate-500">Mindestens 2 Spieler benötigt</p>}
                  <button onClick={() => router.push(`/room/${sessionId}`)}
                    className="mt-3 w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">
                    ← Verlassen
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <button onClick={toggleReady}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition
                      ${iAmReady ? "bg-emerald-700 text-emerald-50 hover:bg-emerald-600" : "border border-slate-600 text-slate-300 hover:bg-slate-800"}`}>
                    {iAmReady ? <><CheckCircle size={15} /> Bereit</> : <><Circle size={15} /> Bereit melden</>}
                  </button>
                  <button onClick={() => router.push(`/room/${sessionId}`)}
                    className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-400 transition hover:bg-slate-800 hover:text-slate-200">
                    ← Verlassen
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Winner modal */}
        {gamePaused && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-4 pb-8 sm:items-center">
            <div className="win-modal w-full max-w-lg rounded-2xl border-2 border-yellow-500 bg-slate-900 p-6 shadow-2xl">
              <div className="mb-3 flex items-center justify-center gap-2 text-2xl font-bold text-yellow-400">
                <Trophy size={24} /> Runde beendet!
              </div>
              <div className="mb-4 text-center">
                <p className="text-xs uppercase tracking-widest text-slate-400">Gewinner</p>
                <p className="text-2xl font-bold text-emerald-400">{roundWinner}</p>
                {roundWinner === userName && <p className="mt-1 text-sm font-bold text-yellow-300">🎉 Du hast gewonnen!</p>}
                <div className="mt-1 flex items-center justify-center gap-1.5 text-sm text-yellow-300">
                  <ChipIcon /> <span className="font-semibold">{roundPot}</span> Chips gewonnen
                </div>
              </div>
              {tableCards.length > 0 && (
                <div className="mb-4 flex flex-col items-center gap-2">
                  <p className="text-xs uppercase tracking-widest text-slate-400">Tischkarten</p>
                  <div className="flex items-center gap-2">
                    {tableCards.map((card, i) => <CardFace key={`tc-${card[0]}-${card[1]}`} card={card} delay={i * 80} />)}
                  </div>
                </div>
              )}
              {playerHands.length > 0 && (
                <div className="mb-5 space-y-2">
                  <p className="mb-2 text-center text-xs uppercase tracking-widest text-slate-400">Hände aller Spieler</p>
                  {playerHands.map((ph) => (
                    <div key={ph.name}
                      className={`flex items-center justify-between rounded-xl border px-3 py-2
                        ${ph.name === roundWinner ? "border-yellow-600 bg-yellow-900/20" : "border-slate-700 bg-slate-800/50"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${ph.name === userName ? "text-emerald-300" : "text-slate-100"}`}>
                          {ph.name}{ph.name === roundWinner && <span className="ml-1">👑</span>}
                        </span>
                        {ph.handType && <span className={`text-xs font-semibold ${HAND_COLORS[ph.handType] ?? "text-slate-400"}`}>{ph.handType}</span>}
                      </div>
                      <div className="flex items-center gap-1">
                        {ph.cards.map((card, i) => <CardFace key={`ph-${ph.name}-${i}`} card={card} small delay={i * 80} />)}
                        <div className="ml-2 flex items-center gap-1 text-xs text-slate-300">
                          <ChipIcon /> {ph.chips}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {isHost ? (
                <div className="flex gap-3">
                  <button onClick={nextRound} className="flex-1 rounded-lg bg-emerald-600 py-3 font-semibold hover:bg-emerald-500">Nächste Runde</button>
                  <button onClick={finish} className="flex-1 rounded-lg bg-red-700    py-3 font-semibold hover:bg-red-600">Spiel beenden</button>
                </div>
              ) : (
                <p className="text-center text-sm italic text-slate-400">Warte auf den Host…</p>
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <header className="shrink-0 flex items-center justify-between border-b border-slate-800 px-4 py-3 text-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push(`/room/${sessionId}`)}
              className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">
              ← Zurück
            </button>
            <span className="font-semibold">{session.name}</span>
            {session.sessionCode && (
              <button onClick={copyCode}
                className="flex items-center gap-1.5 rounded-md border border-slate-700 px-2 py-1 font-mono text-xs text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                title="Code kopieren">
                {codeCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {String(session.sessionCode)}
              </button>
            )}
            {roundNumber > 0 && (
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Runde {roundNumber}</span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Du: <span className="font-medium text-emerald-400">{userName}</span>
            {isMyTurn && <span className="ml-2 animate-pulse font-semibold text-emerald-300">● Dein Zug!</span>}
          </span>
        </header>

        <main className="flex flex-1 min-h-0 overflow-hidden flex-col gap-3 p-3 md:flex-row">

          {/* Table + controls */}
          <section className="flex flex-1 min-h-0 flex-col gap-3">

            {/* Oval table fills remaining height */}
            <div className="flex flex-1 min-h-0 p-4">
              <OvalTable>
                {allPlayers.map((name: string, i: number) => {
                  const rel = (i - myIdx + count) % count;
                  const pos = layout[rel] ?? { x: 50, y: 50 };
                  const u = session.users.find((u: any) => (u.user.name ?? "Unbekannt") === name);
                  if (!u) return null;
                  return (
                    <div key={name} className="absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
                      <PlayerSeat
                        u={u}
                        member={members.find((m) => m.name === name)}
                        isCurrentUser={name === userName}
                        isCurrent={name === currentPlayer}
                        isActive={turnOrder.includes(name)}
                        isSmallBlind={name === smallBlind}
                        isBigBlind={name === bigBlind}
                      />
                    </div>
                  );
                })}

                {/* Center felt info */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 pointer-events-none">
                  <div className="flex items-center gap-2">
                    {tableCards.length === 0
                      ? <span className="text-sm uppercase tracking-widest text-slate-400">Warte auf Karten…</span>
                      : tableCards.map((card, i) => <CardFace key={`${card[0]}-${card[1]}`} card={card} delay={i * 120} />)
                    }
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-4 py-1.5 text-sm text-yellow-300 shadow backdrop-blur">
                    Pot: <ChipIcon className="h-4 w-4 mx-1" /> <span className="font-bold text-base">{totalPot}</span>
                  </div>
                  <span className="rounded-full bg-black/40 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-slate-300 backdrop-blur">
                    {PHASE_NAMES[phase] ?? `Phase ${phase}`}
                  </span>
                  {currentPlayer && (
                    <span className="text-sm text-slate-300 backdrop-blur">
                      {currentPlayer === userName
                        ? <span className="font-bold text-emerald-400">Du bist am Zug</span>
                        : <><span className="font-semibold text-slate-100">{currentPlayer}</span> ist am Zug</>}
                    </span>
                  )}
                </div>
              </OvalTable>
            </div>

            {/* Action controls — always rendered to keep table size constant */}
            <div className={`shrink-0 rounded-2xl border border-slate-700 bg-slate-900/80 p-4 transition-opacity duration-200
    ${isMyTurn ? "ring-2 ring-emerald-500/50 shadow-[0_0_24px_rgba(16,185,129,0.15)] opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>

              {/* Pot % presets + fixed amounts + All-In */}
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
                {potRaisePresets.map(({ label, value }) => (
                  <button key={label}
                    onClick={() => setRaiseAmount(Math.min(myChips, value))}
                    disabled={value > myChips}
                    className="rounded-md border border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:border-sky-500 hover:text-sky-300 disabled:opacity-30">
                    {label}
                  </button>
                ))}
                {[20, 50, 100].map((amount) => (
                  <button key={amount}
                    onClick={() => setRaiseAmount((prev) => Math.min(myChips, prev + amount))}
                    disabled={raiseAmount + amount > myChips}
                    className="rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-30">
                    +{amount}
                  </button>
                ))}
                <button onClick={() => setRaiseAmount(myChips)} disabled={myChips === 0}
                  className="rounded-md border border-yellow-700 px-2.5 py-1 text-xs font-semibold text-yellow-300 hover:bg-yellow-900/30 disabled:opacity-30">
                  All-In
                </button>
              </div>

              {/* Raise input row */}
              <div className="mb-3 flex items-center justify-center gap-2">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-slate-400">Raise:</span>
                  <span className="text-[10px] text-slate-600">min {minRaise}</span>
                </div>
                <button onClick={() => setRaiseAmount(Math.max(minRaise, raiseAmount - 1))}
                  className="rounded-md bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600">−</button>
                <input type="number" value={raiseInputValue} min={minRaise} max={myChips}
                  onChange={(e) => setRaiseInputValue(e.target.value)}
                  onBlur={() => {
                    const val = Number(raiseInputValue);
                    const clamped = isNaN(val) ? minRaise : Math.min(myChips, Math.max(minRaise, val));
                    setRaiseAmount(clamped);
                    setRaiseInputValue(String(clamped));
                  }}
                  className="w-16 rounded-md bg-slate-800 px-3 py-1 text-center text-sm font-mono text-slate-100 outline-none focus:ring-1 focus:ring-sky-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <button onClick={() => setRaiseAmount(Math.min(myChips, raiseAmount + 1))}
                  className="rounded-md bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600">+</button>
                <div className="relative flex items-center w-28">
                  <div className="absolute left-0 h-1.5 rounded-full bg-sky-500 pointer-events-none" style={{ width: `${sliderPct}%` }} />
                  <input type="range" min={minRaise} max={myChips} value={raiseAmount}
                    onChange={(e) => setRaiseAmount(Number(e.target.value))}
                    className="relative w-full accent-sky-500" />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-center gap-3">
                <div className="relative">
                  {showFoldConfirm && (
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-40 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl text-center z-10">
                      <p className="text-xs text-slate-300 mb-2">Wirklich folden?</p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowFoldConfirm(false)}
                          className="flex-1 rounded-md border border-slate-700 py-1 text-xs text-slate-400 hover:bg-slate-800">Nein</button>
                        <button onClick={fold}
                          className="flex-1 rounded-md bg-red-700 py-1 text-xs text-red-50 hover:bg-red-600">Ja</button>
                      </div>
                    </div>
                  )}
                  <button onClick={() => setShowFoldConfirm((v) => !v)}
                    className="flex items-center gap-1.5 rounded-md bg-red-700 px-5 py-2 text-sm font-semibold text-red-50 hover:bg-red-600">
                    Fold <kbd className="rounded bg-red-900/60 px-1 text-[9px] text-red-300">F</kbd>
                  </button>
                </div>
                <button onClick={checkCall}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-5 py-2 text-sm font-semibold text-emerald-50 hover:bg-emerald-500">
                  {callAmount > 0 ? `Call (${callAmount})` : "Check"} <kbd className="rounded bg-emerald-900/60 px-1 text-[9px] text-emerald-300">C</kbd>
                </button>
                <button onClick={raise} disabled={raiseAmount < minRaise}
                  className="flex items-center gap-1.5 rounded-md bg-sky-600 px-5 py-2 text-sm font-semibold text-sky-50 hover:bg-sky-500 disabled:opacity-40">
                  Raise ({raiseAmount}) <kbd className="rounded bg-sky-900/60 px-1 text-[9px] text-sky-300">R</kbd>
                </button>
              </div>
            </div>

          </section>


          {/* Sidebar */}
          <aside className="flex w-full min-h-0 flex-col gap-2 overflow-hidden md:w-64">

            {/* Players */}
            <div className="shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Spieler</p>
              <ul className="space-y-1">
                {session.users.map((u: any) => {
                  const pName = u.user.name ?? "Unbekannt";
                  const member = members.find((m) => m.name === pName);
                  const chips = member?.chips ?? u.chips;
                  return (
                    <li key={u.id} className={`flex items-center justify-between rounded-md px-2 py-1.5
                      ${pName === currentPlayer ? "bg-emerald-900/40" : ""}
                      ${!turnOrder.includes(pName) && gameStarted ? "opacity-40" : ""}`}>
                      <div className="flex items-center gap-1.5">
                        <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold
                          ${pName === userName ? "bg-emerald-700 text-emerald-100" : "bg-slate-700 text-slate-300"}`}>
                          {pName.charAt(0).toUpperCase()}
                        </div>
                        <span className={pName === userName ? "font-medium text-emerald-300" : ""}>{pName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ChipIcon />
                        <span className="text-emerald-300">{chips}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Bet history — collapsible */}
            <div className="shrink-0 rounded-2xl border border-slate-800 bg-slate-950/80 text-xs overflow-hidden">
              <button onClick={() => setActionsOpen((v) => !v)}
                className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:bg-slate-800/40 transition">
                Aktionen
                {actionsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
              {actionsOpen && (
                <div className="max-h-32 overflow-y-auto p-2 space-y-1 border-t border-slate-800">
                  {betHistory.length === 0 ? (
                    <p className="py-1 text-center text-[11px] italic text-slate-600">Noch keine Aktionen…</p>
                  ) : (
                    betHistory.map((a, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-slate-900/60 px-2 py-1">
                        <span className={a.playerName === userName ? "text-emerald-300" : "text-slate-300"}>{a.playerName}</span>
                        <span className="text-[11px]">{actionLabel(a)}</span>
                      </div>
                    ))
                  )}
                  <div ref={betHistoryBottomRef} />
                </div>
              )}
            </div>

            {/* Chat — collapsible + unread badge */}
            <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-800 bg-slate-950/80 text-xs overflow-hidden">
              <button
                onClick={() => { setChatOpen((v) => !v); if (!chatOpen) setUnreadChat(0); }}
                className="flex w-full shrink-0 items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 hover:bg-slate-800/40 transition">
                <span className="flex items-center gap-2">
                  Chat
                  {unreadChat > 0 && (
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold text-white">{unreadChat}</span>
                  )}
                </span>
                {chatOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {chatOpen && (
                <>
                  <div
                    ref={chatScrollRef}
                    className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 border-t border-slate-800"
                    onScroll={() => {
                      const el = chatScrollRef.current;
                      if (!el) return;
                      isChatAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
                      if (isChatAtBottom.current) setUnreadChat(0);
                    }}
                  >
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                        <MessageSquare size={22} className="text-slate-700" />
                        <p className="text-[11px] font-medium text-slate-500">Noch nichts hier</p>
                        <p className="text-[10px] text-slate-600">Schreib etwas — vielleicht ein Bluff? 😏</p>
                      </div>
                    ) : (
                      chatMessages.map((msg, i) => {
                        const isMe = msg.playerName === userName;
                        return (
                          <div key={i} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                            <span className={`text-[10px] mb-0.5 ${isMe ? "text-emerald-400" : "text-slate-400"}`}>
                              {isMe ? "Du" : msg.playerName}
                            </span>
                            <span className={`inline-block max-w-[90%] rounded-xl px-2.5 py-1.5 text-[11px] leading-snug
                              ${isMe ? "bg-emerald-700/60 text-emerald-50" : "bg-slate-800 text-slate-200"}`}>
                              {msg.message}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {unreadChat > 0 && (
                    <button
                      onClick={() => {
                        chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
                        setUnreadChat(0);
                        isChatAtBottom.current = true;
                      }}
                      className="mx-3 mb-1 flex items-center justify-center gap-1 rounded-lg bg-emerald-800/60 py-1 text-[11px] text-emerald-300 hover:bg-emerald-700/60 transition">
                      ↓ {unreadChat} neue Nachricht{unreadChat > 1 ? "en" : ""}
                    </button>
                  )}

                  <div className="shrink-0 flex gap-1.5 border-t border-slate-800 p-2">
                    <input type="text" value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendChat()}
                      placeholder="Nachricht…"
                      className="flex-1 rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:ring-1 focus:ring-emerald-600"
                    />
                    <button onClick={sendChat} disabled={!chatInput.trim()}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-emerald-50 transition hover:bg-emerald-500 disabled:opacity-40">
                      <Send size={12} />
                    </button>
                  </div>
                </>
              )}
            </div>
          </aside>
        </main>
      </div>
    </>
  );
}

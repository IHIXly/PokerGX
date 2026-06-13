"use client";

import { DeveloperControlPanel } from "@/app/components/developer/DeveloperControlPanel";
import { ChipIcon } from "@/app/components/session/ChipIcon";
import { CreateSessionModal } from "@/app/components/session/CreateSessionModal";
import { JoinByCodeModal } from "@/app/components/session/JoinByCodeModal";
import { SessionCard } from "@/app/components/session/SessionCard";
import {
	FILTER_STORAGE_KEY,
	STATUS_TABS,
	VALID_FILTERS,
} from "@/app/components/session/session-config";
import type { PokerSession, StatusFilter } from "@/app/types/poker-session";
import { api } from "@/trpc/react";
import { Loader2, LogIn, Plus, Search, X, Zap } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

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
					{[0, 1, 2].map((i) => (
						<div key={i} className="h-6 w-6 rounded-full bg-slate-800" />
					))}
				</div>
				<div className="h-7 w-24 rounded-lg bg-slate-800" />
			</div>
		</div>
	);
}

// ─── Inner page (needs useSearchParams) ──────────────────────────────────────

function SessionSelectInner() {
	const { data: authSession, status: authStatus } = useSession();
	const { data: me, refetch: refetchMe } = api.poker.getMe.useQuery(undefined, {
		enabled: authStatus === "authenticated",
	});
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	// ── Filter state: URL param → localStorage → default ──────────────────────
	const getInitialFilter = useCallback((): StatusFilter => {
		const fromUrl = searchParams.get("filter") as StatusFilter | null;
		if (fromUrl && VALID_FILTERS.includes(fromUrl)) return fromUrl;
		try {
			const stored = localStorage.getItem(
				FILTER_STORAGE_KEY,
			) as StatusFilter | null;
			if (stored && VALID_FILTERS.includes(stored)) return stored;
		} catch {}
		return "alle";
	}, [searchParams]);

	const [statusFilter, setStatusFilter] =
		useState<StatusFilter>(getInitialFilter);
	const [search, setSearch] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newBuyIn, setNewBuyIn] = useState("1000");
	const [newPrivate, setNewPrivate] = useState(false);
	const [showJoinByCode, setShowJoinByCode] = useState(false);
	const [sessionCode, setSessionCode] = useState("");
	const [codeError, setCodeError] = useState("");

	const [animatedIds, setAnimatedIds] = useState<Set<string>>(new Set());
	const prevIds = useRef<Set<string>>(new Set());

	// ── Sync filter to URL + localStorage ─────────────────────────────────────
	const applyFilter = (f: StatusFilter) => {
		setStatusFilter(f);
		try {
			localStorage.setItem(FILTER_STORAGE_KEY, f);
		} catch {}
		const params = new URLSearchParams(searchParams.toString());
		if (f === "alle") params.delete("filter");
		else params.set("filter", f);
		const qs = params.toString();
		router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
	};

	// ── Data ───────────────────────────────────────────────────────────────────
	const {
		data: sessions,
		isLoading,
		refetch,
	} = api.poker.getSessions.useQuery(undefined, {
		enabled: authStatus === "authenticated",
		refetchInterval: 12000,
	});

	const createSession = api.poker.createSession.useMutation({
		onSuccess: (data) => {
			void refetch();
			void refetchMe();
			setShowCreate(false);
			setNewName("");
			setNewBuyIn("1000");
			setNewPrivate(false);
			toast.success("Session erstellt!");
			router.push(`/room/${data.sessionID}`);
		},
		onError: (err) =>
			toast.error(err.message ?? "Session konnte nicht erstellt werden."),
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
		onSuccess: () => {
			void refetch();
			toast.success("Session gelöscht.");
		},
		onError: (err) => toast.error(err.message ?? "Löschen fehlgeschlagen."),
	});

	const developerClearSession = api.poker.developerClearSession.useMutation({
		onSuccess: () => {
			void refetch();
			toast.success("[Dev] Session gelöscht.");
		},
		onError: (err) => toast.error(err.message ?? "Löschen fehlgeschlagen."),
	});

	// ── Entrance animation ─────────────────────────────────────────────────────
	useEffect(() => {
		if (!sessions) return;
		const currentIds = new Set(sessions.map((s: PokerSession) => s.id));
		const incoming = new Set<string>();
		for (const id of currentIds) {
			if (!prevIds.current.has(id)) incoming.add(id);
		}
		if (incoming.size > 0) {
			setAnimatedIds(incoming);
			setTimeout(() => setAnimatedIds(new Set()), 500);
		}
		prevIds.current = currentIds;
	}, [sessions]);

	const isDeveloper =
		authSession?.user?.developer === true || me?.developer === true;
	const userId = authSession?.user?.id ?? "";

	// ── Auto-format join code ──────────────────────────────────────────────────
	const handleCodeChange = (raw: string) => {
		const digits = raw.replace(/\D/g, "").slice(0, 6);
		const formatted =
			digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
		setSessionCode(formatted);
		setCodeError("");
		if (digits.length === 6) {
			setTimeout(() => joinSessionByCode.mutate({ sessionCode: digits }), 80);
		}
	};

	const handleCreateSession = (input: {
		name: string;
		buyIn: number;
		privateSession: boolean;
	}) => {
		createSession.mutate(input);
	};

	// ── Filtered list ──────────────────────────────────────────────────────────
	const filtered = (sessions ?? []).filter((s: PokerSession) => {
		const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
		const matchStatus = statusFilter === "alle" || s.status === statusFilter;
		return matchSearch && matchStatus;
	});

	if (authStatus === "loading")
		return (
			<div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
				<Loader2 className="mr-2 animate-spin" /> Lädt…
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
				<div className="border-slate-800 border-b bg-slate-950/80 px-6 py-10 text-center">
					<div className="mb-3 flex justify-center">
						<ChipIcon className="h-12 w-12 drop-shadow-lg" />
					</div>
					<h1 className="font-extrabold text-3xl text-slate-100 tracking-tight">
						Willkommen,{" "}
						<span className="text-emerald-400">{authSession?.user?.name}</span>{" "}
						👋
					</h1>
					<p className="mt-1.5 text-slate-400 text-sm">
						Erstelle eine neue Session oder tritt einer bestehenden bei.
					</p>
					{isDeveloper && (
						<span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sky-600 bg-sky-900/30 px-3 py-1 font-semibold text-sky-300 text-xs">
							<Zap size={11} /> Developer
						</span>
					)}
				</div>

				<div className="mx-auto max-w-3xl px-4 py-8">
					{/* Header row */}
					<div className="mb-5 flex items-center justify-between">
						<h2 className="font-bold text-lg text-slate-200">
							Deine Poker-Sessions
						</h2>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => {
									setShowJoinByCode(true);
									setCodeError("");
								}}
								className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 font-semibold text-slate-300 text-sm transition hover:bg-slate-800 active:scale-95"
							>
								<LogIn size={15} /> Per Code beitreten
							</button>
							<button
								type="button"
								onClick={() => setShowCreate(true)}
								className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-semibold text-emerald-50 text-sm shadow transition hover:bg-emerald-500 active:scale-95"
							>
								<Plus size={15} /> Neue Session
							</button>
						</div>
					</div>

					{/* Search + status filter */}
					<div className="mb-5 space-y-3">
						<div className="relative">
							<Search
								size={14}
								className="-translate-y-1/2 absolute top-1/2 left-3 text-slate-600"
							/>
							<input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Session suchen…"
								className="w-full rounded-xl border border-slate-700 bg-slate-800/60 py-2.5 pr-9 pl-8 text-slate-100 text-sm outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-500"
							/>
							{search && (
								<button
									type="button"
									onClick={() => setSearch("")}
									className="-translate-y-1/2 absolute top-1/2 right-3 text-slate-600 hover:text-slate-400"
								>
									<X size={13} />
								</button>
							)}
						</div>
						<div className="flex gap-1.5">
							{STATUS_TABS.map(({ key, label }) => (
								<button
									type="button"
									key={key}
									onClick={() => applyFilter(key)}
									className={`rounded-lg px-3 py-1.5 font-semibold text-xs transition ${
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
						<CreateSessionModal
							name={newName}
							buyIn={newBuyIn}
							privateSession={newPrivate}
							isPending={createSession.isPending}
							onNameChange={setNewName}
							onBuyInChange={setNewBuyIn}
							onPrivateChange={setNewPrivate}
							onCreate={handleCreateSession}
							onClose={() => {
								setShowCreate(false);
								setNewName("");
								setNewBuyIn("1000");
								setNewPrivate(false);
							}}
						/>
					)}

					{/* Join by code modal */}
					{showJoinByCode && (
						<JoinByCodeModal
							sessionCode={sessionCode}
							codeError={codeError}
							isPending={joinSessionByCode.isPending}
							onCodeChange={handleCodeChange}
							onJoin={(code) => joinSessionByCode.mutate({ sessionCode: code })}
							onClose={() => {
								setShowJoinByCode(false);
								setSessionCode("");
								setCodeError("");
							}}
						/>
					)}

					{/* Session list */}
					{isLoading ? (
						<div className="space-y-3">
							{[0, 1, 2].map((i) => (
								<SkeletonCard key={i} />
							))}
						</div>
					) : filtered.length ? (
						<ul className="space-y-3">
							{filtered.map((s: PokerSession) => (
								<SessionCard
									key={s.id}
									session={s}
									userId={userId}
									isDeveloper={isDeveloper}
									isAnimated={animatedIds.has(s.id)}
									isJoining={joinSession.isPending}
									isDeleting={
										clearSession.isPending || developerClearSession.isPending
									}
									onOpen={(sessionId) => router.push(`/room/${sessionId}`)}
									onJoin={(sessionId) => joinSession.mutate({ sessionId })}
									onClear={(sessionId) => clearSession.mutate({ sessionId })}
									onDeveloperClear={(sessionId) =>
										developerClearSession.mutate({ sessionId })
									}
								/>
							))}
						</ul>
					) : (
						<div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-800 border-dashed py-16 text-center">
							<svg
								viewBox="0 0 80 60"
								className="h-16 w-20 text-slate-700"
								fill="none"
								aria-hidden="true"
							>
								<ellipse
									cx="40"
									cy="30"
									rx="36"
									ry="22"
									fill="currentColor"
									opacity="0.4"
								/>
								<ellipse cx="40" cy="30" rx="26" ry="14" fill="#0f172a" />
								<circle
									cx="18"
									cy="20"
									r="4"
									fill="currentColor"
									opacity="0.5"
								/>
								<circle
									cx="40"
									cy="14"
									r="4"
									fill="currentColor"
									opacity="0.5"
								/>
								<circle
									cx="62"
									cy="20"
									r="4"
									fill="currentColor"
									opacity="0.5"
								/>
								<circle
									cx="62"
									cy="40"
									r="4"
									fill="currentColor"
									opacity="0.5"
								/>
								<circle
									cx="18"
									cy="40"
									r="4"
									fill="currentColor"
									opacity="0.5"
								/>
							</svg>
							<div>
								<p className="font-semibold text-slate-400">
									{search || statusFilter !== "alle"
										? "Keine Sessions gefunden"
										: "Noch keine Sessions"}
								</p>
								<p className="mt-1 text-slate-600 text-sm">
									{search || statusFilter !== "alle"
										? "Versuche andere Filter"
										: "Erstelle eine neue Session und lade Freunde ein"}
								</p>
							</div>
							{!search && statusFilter === "alle" && (
								<button
									type="button"
									onClick={() => setShowCreate(true)}
									className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-emerald-50 text-sm hover:bg-emerald-500"
								>
									<Plus size={14} /> Erste Session erstellen
								</button>
							)}
						</div>
					)}

					<DeveloperControlPanel
						isDeveloper={isDeveloper}
						onSessionsCleared={() => {
							void refetch();
							void refetchMe();
						}}
						onWalletUpdated={() => {
							void refetchMe();
						}}
					/>
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
		<Suspense
			fallback={
				<div className="flex h-screen items-center justify-center bg-slate-950 text-slate-400">
					<Loader2 className="mr-2 animate-spin" /> Lädt…
				</div>
			}
		>
			<SessionSelectInner />
		</Suspense>
	);
}

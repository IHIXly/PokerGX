import type { PokerSession } from "@/app/types/poker-session";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";
import { ChevronRight, Crown, Loader2, Lock, LogIn, Users } from "lucide-react";
import { AvatarRow } from "./AvatarRow";
import { ChipIcon } from "./ChipIcon";
import { DeleteButton } from "./DeleteButton";
import { DEFAULT_STATUS_STYLE, STATUS_STYLES } from "./session-config";

export interface SessionCardProps {
	session: PokerSession;
	userId: string;
	isDeveloper: boolean;
	isAnimated: boolean;
	isJoining: boolean;
	isDeleting: boolean;
	onOpen: (sessionId: string) => void;
	onJoin: (sessionId: string) => void;
	onClear: (sessionId: string) => void;
	onDeveloperClear: (sessionId: string) => void;
}

export function SessionCard({
	session,
	userId,
	isDeveloper,
	isAnimated,
	isJoining,
	isDeleting,
	onOpen,
	onJoin,
	onClear,
	onDeveloperClear,
}: SessionCardProps) {
	const isHost = session.createdBy === userId;
	const isInSession = session.users.some((u) => u.user.id === userId);
	const isEnded = session.status === "beendet" || session.status === "finished";
	const statusStyle = STATUS_STYLES[session.status] ?? DEFAULT_STATUS_STYLE;
	const firstUserChips = session.users[0]?.chips;
	const hasChips = session.users.length > 0 && firstUserChips !== undefined;

	return (
		<li
			style={
				isAnimated
					? { animation: "fadeSlideIn 0.35s ease forwards" }
					: undefined
			}
			className={`group flex flex-col gap-3 rounded-2xl border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
				isEnded && isInSession
					? "border-slate-800/40 bg-slate-900/30 opacity-60"
					: isInSession
						? "border-emerald-800/50 bg-emerald-950/20"
						: "border-slate-800 bg-slate-900/70 hover:border-slate-600"
			}`}
		>
			<div className="flex flex-col gap-1.5">
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-bold text-slate-100">{session.name}</span>
					{isHost && (
						<span className="flex items-center gap-1 rounded-full bg-yellow-900/40 px-2 py-0.5 font-semibold text-[10px] text-yellow-300">
							<Crown size={9} /> Host
						</span>
					)}
					{session.private && (
						<span className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 font-semibold text-[10px] text-slate-400">
							<Lock size={9} /> Privat
						</span>
					)}
					{isInSession && !isEnded && (
						<span className="rounded-full border border-emerald-900/50 bg-emerald-900/40 px-1.5 py-0.5 font-semibold text-[10px] text-emerald-500">
							Beigetreten
						</span>
					)}
					<span
						className={`flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 font-semibold text-[10px] ${statusStyle.text}`}
					>
						<span className={`h-1.5 w-1.5 rounded-full ${statusStyle.dot}`} />
						{statusStyle.label}
					</span>
				</div>

				<div className="flex flex-wrap items-center gap-3 text-slate-500 text-xs">
					<span className="flex items-center gap-1">
						<Users size={11} /> {session.users.length} Spieler
					</span>
					{hasChips && (
						<span className="flex items-center gap-1">
							<ChipIcon className="h-3 w-3" />
							{firstUserChips} Chips
						</span>
					)}
					{session.createdAt && (
						<span>
							{formatDistanceToNow(session.createdAt, {
								addSuffix: true,
								locale: de,
							})}
						</span>
					)}
				</div>

				<AvatarRow users={session.users} />
			</div>

			<div className="flex shrink-0 items-center gap-2">
				{isInSession && (
					<button
						type="button"
						onClick={() => onOpen(session.id)}
						className={`flex items-center gap-1 rounded-lg px-3 py-1.5 font-semibold text-xs transition ${
							isEnded
								? "border border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-700"
								: "bg-emerald-700 text-emerald-50 hover:bg-emerald-600"
						}`}
					>
						{session.status === "gestartet"
							? "Weiterspielen"
							: isEnded
								? "Ergebnisse"
								: "Lobby"}
						<ChevronRight size={11} />
					</button>
				)}

				{!isInSession &&
					(session.status === "laufend" ? (
						<button
							type="button"
							onClick={() => onJoin(session.id)}
							disabled={isJoining}
							className="flex items-center gap-1.5 rounded-lg bg-sky-700 px-3 py-1.5 font-semibold text-sky-50 text-xs hover:bg-sky-600 disabled:opacity-50"
						>
							{isJoining ? (
								<Loader2 size={12} className="animate-spin" />
							) : (
								<LogIn size={12} />
							)}
							Beitreten
						</button>
					) : (
						<span className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-1.5 text-[11px] text-slate-600">
							{isEnded ? "Beendet" : "Bereits gestartet"}
						</span>
					))}

				{(isHost || isDeveloper) && (
					<DeleteButton
						disabled={isDeleting}
						onConfirm={() =>
							isDeveloper ? onDeveloperClear(session.id) : onClear(session.id)
						}
					/>
				)}
			</div>
		</li>
	);
}

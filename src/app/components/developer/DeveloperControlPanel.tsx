"use client";

import { api } from "@/trpc/react";
import { AlertTriangle, Loader2, Shield, Trash2, Wallet } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export interface DeveloperControlPanelProps {
	isDeveloper: boolean;
	onSessionsCleared?: () => void;
	onWalletUpdated?: () => void;
}

export function DeveloperControlPanel({
	isDeveloper,
	onSessionsCleared,
	onWalletUpdated,
}: DeveloperControlPanelProps) {
	const [confirmClearAll, setConfirmClearAll] = useState(false);
	const [userIdOrEmail, setUserIdOrEmail] = useState("");
	const [walletValue, setWalletValue] = useState("");

	const clearAllSessions = api.poker.developerClearAllSessions.useMutation({
		onSuccess: (result) => {
			setConfirmClearAll(false);
			onSessionsCleared?.();
			toast.success(
				`${result.deletedSessions} Sessions gelöscht, ${result.cashedOut} Chips ausgezahlt.`,
			);
		},
		onError: (err) =>
			toast.error(err.message ?? "Sessions konnten nicht gelöscht werden."),
	});

	const setUserWallet = api.poker.developerSetUserWallet.useMutation({
		onSuccess: (user) => {
			setWalletValue("");
			onWalletUpdated?.();
			toast.success(
				`Wallet gesetzt: ${user.name ?? user.email ?? user.id} -> ${user.wallet}`,
			);
		},
		onError: (err) =>
			toast.error(err.message ?? "Wallet konnte nicht gesetzt werden."),
	});

	if (!isDeveloper) return null;

	const parsedWallet = Number(walletValue);
	const canSetWallet =
		userIdOrEmail.trim().length > 0 &&
		Number.isInteger(parsedWallet) &&
		parsedWallet >= 0;

	return (
		<section className="mt-8 rounded-2xl border border-sky-800/50 bg-slate-900/80 p-5 shadow-2xl shadow-sky-950/20">
			<div className="mb-5 flex items-center justify-between gap-3">
				<div>
					<h2 className="flex items-center gap-2 font-bold text-slate-100 text-sm">
						<Shield size={15} className="text-sky-300" />
						Developer Controls
					</h2>
					<p className="mt-1 text-slate-500 text-xs">
						Administrative Werkzeuge für Sessions und Wallets.
					</p>
				</div>
				<span className="rounded-full border border-sky-700 bg-sky-950/40 px-2 py-1 font-semibold text-[10px] text-sky-300">
					DEV
				</span>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				<div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
					<div className="mb-3 flex items-start gap-2">
						<Trash2 size={15} className="mt-0.5 text-red-400" />
						<div>
							<h3 className="font-semibold text-slate-200 text-sm">
								Alle Sessions löschen
							</h3>
							<p className="mt-1 text-slate-500 text-xs">
								Zahlt alle Session-Chips aus und entfernt danach alle Sessions.
							</p>
						</div>
					</div>

					{confirmClearAll ? (
						<div className="space-y-3">
							<div className="flex items-center gap-2 rounded-lg border border-red-900/60 bg-red-950/20 px-3 py-2 text-red-300 text-xs">
								<AlertTriangle size={13} />
								Wirklich alle Sessions löschen?
							</div>
							<div className="flex gap-2">
								<button
									type="button"
									onClick={() => clearAllSessions.mutate()}
									disabled={clearAllSessions.isPending}
									className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 py-2 font-semibold text-red-50 text-xs hover:bg-red-600 disabled:opacity-50"
								>
									{clearAllSessions.isPending && (
										<Loader2 size={12} className="animate-spin" />
									)}
									Ja, löschen
								</button>
								<button
									type="button"
									onClick={() => setConfirmClearAll(false)}
									disabled={clearAllSessions.isPending}
									className="flex-1 rounded-lg border border-slate-700 py-2 text-slate-400 text-xs hover:bg-slate-800 disabled:opacity-50"
								>
									Abbrechen
								</button>
							</div>
						</div>
					) : (
						<button
							type="button"
							onClick={() => setConfirmClearAll(true)}
							className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-900/70 bg-red-950/20 py-2 font-semibold text-red-300 text-xs transition hover:bg-red-900/30"
						>
							<Trash2 size={13} />
							Alle Sessions löschen
						</button>
					)}
				</div>

				<div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
					<div className="mb-3 flex items-start gap-2">
						<Wallet size={15} className="mt-0.5 text-emerald-300" />
						<div>
							<h3 className="font-semibold text-slate-200 text-sm">
								Wallet überschreiben
							</h3>
							<p className="mt-1 text-slate-500 text-xs">
								User per ID oder E-Mail finden und Wallet-Wert setzen.
							</p>
						</div>
					</div>

					<div className="space-y-3">
						<input
							value={userIdOrEmail}
							onChange={(e) => setUserIdOrEmail(e.target.value)}
							placeholder="User-ID oder E-Mail"
							className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-100 text-sm outline-none placeholder:text-slate-600 focus:ring-1 focus:ring-sky-600"
						/>
						<input
							value={walletValue}
							onChange={(e) => setWalletValue(e.target.value)}
							type="number"
							inputMode="numeric"
							min={0}
							placeholder="Neuer Wallet-Wert"
							className="w-full rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2 text-slate-100 text-sm outline-none [appearance:textfield] placeholder:text-slate-600 focus:ring-1 focus:ring-emerald-600 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						/>
						<button
							type="button"
							onClick={() =>
								setUserWallet.mutate({
									userIdOrEmail: userIdOrEmail.trim(),
									wallet: parsedWallet,
								})
							}
							disabled={!canSetWallet || setUserWallet.isPending}
							className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 py-2 font-semibold text-emerald-50 text-xs hover:bg-emerald-600 disabled:opacity-50"
						>
							{setUserWallet.isPending ? (
								<Loader2 size={12} className="animate-spin" />
							) : (
								<Wallet size={13} />
							)}
							Wallet setzen
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}

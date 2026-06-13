"use client";

import { Loader2, Lock, Plus } from "lucide-react";
import type { MouseEvent } from "react";

export interface CreateSessionModalProps {
	name: string;
	privateSession: boolean;
	isPending: boolean;
	onNameChange: (name: string) => void;
	onPrivateChange: (privateSession: boolean) => void;
	onCreate: (input: {
		name: string;
		privateSession: boolean;
	}) => void;
	onClose: () => void;
}

export function CreateSessionModal({
	name,
	privateSession,
	isPending,
	onNameChange,
	onPrivateChange,
	onCreate,
	onClose,
}: CreateSessionModalProps) {
	const trimmedName = name.trim();
	const canCreate = trimmedName.length >= 3;

	const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget) onClose();
	};

	const create = () => onCreate({ name: trimmedName, privateSession });

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Preserve the existing backdrop-click close behavior.
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
			onClick={handleBackdropClick}
		>
			<div
				className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
				style={{ animation: "fadeSlideIn 0.25s ease forwards" }}
			>
				<h3 className="mb-4 font-bold text-lg text-slate-100">
					Session erstellen
				</h3>
				<div className="space-y-4">
					<div>
						<label
							htmlFor="create-session-name"
							className="mb-1.5 block font-semibold text-slate-400 text-xs"
						>
							Name
						</label>
						<input
							// biome-ignore lint/a11y/noAutofocus: Preserve the existing modal focus behavior.
							autoFocus
							id="create-session-name"
							type="text"
							value={name}
							onChange={(e) => onNameChange(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && canCreate && create()}
							placeholder="z. B. Freitagsrunde"
							maxLength={50}
							className="w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 text-sm outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-600"
						/>
						<p className="mt-1 text-right text-[10px] text-slate-600">
							{name.length}/50
						</p>
					</div>
					<button
						type="button"
						onClick={() => onPrivateChange(!privateSession)}
						className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition ${
							privateSession
								? "border-slate-600 bg-slate-800/60 text-slate-200"
								: "border-slate-700/50 bg-slate-800/30 text-slate-500"
						}`}
					>
						<span className="flex items-center gap-2">
							<Lock size={13} /> Private Session
						</span>
						<div
							className={`h-4 w-7 rounded-full transition-colors ${privateSession ? "bg-emerald-600" : "bg-slate-700"}`}
						>
							<div
								className={`mt-0.5 ml-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform ${privateSession ? "translate-x-3" : "translate-x-0"}`}
							/>
						</div>
					</button>
				</div>
				<div className="mt-5 flex gap-3">
					<button
						type="button"
						onClick={onClose}
						className="flex-1 rounded-lg border border-slate-700 py-2 text-slate-300 text-sm hover:bg-slate-800"
					>
						Abbrechen
					</button>
					<button
						type="button"
						disabled={!canCreate || isPending}
						onClick={create}
						className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 font-semibold text-emerald-50 text-sm hover:bg-emerald-500 disabled:opacity-50"
					>
						{isPending ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							<Plus size={14} />
						)}
						Erstellen
					</button>
				</div>
			</div>
		</div>
	);
}

"use client";

import { Loader2, LogIn } from "lucide-react";
import type { MouseEvent } from "react";

export interface JoinByCodeModalProps {
	sessionCode: string;
	codeError: string;
	isPending: boolean;
	onCodeChange: (code: string) => void;
	onJoin: (sessionCode: string) => void;
	onClose: () => void;
}

export function JoinByCodeModal({
	sessionCode,
	codeError,
	isPending,
	onCodeChange,
	onJoin,
	onClose,
}: JoinByCodeModalProps) {
	const normalizedCode = sessionCode.replace(/\s/g, "");

	const handleBackdropClick = (e: MouseEvent<HTMLDivElement>) => {
		if (e.target === e.currentTarget) onClose();
	};

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
				<h3 className="mb-1 font-bold text-lg text-slate-100">
					Per Code beitreten
				</h3>
				<p className="mb-4 text-slate-500 text-xs">
					Gib den 6-stelligen Session-Code ein.
				</p>
				<input
					// biome-ignore lint/a11y/noAutofocus: Preserve the existing modal focus behavior.
					autoFocus
					type="text"
					inputMode="numeric"
					value={sessionCode}
					onChange={(e) => onCodeChange(e.target.value)}
					placeholder="123 456"
					className={`w-full rounded-lg bg-slate-800 px-3 py-2.5 text-center font-bold font-mono text-slate-100 text-xl tracking-[0.3em] outline-none placeholder:text-slate-700 ${
						codeError
							? "ring-1 ring-red-500"
							: "focus:ring-2 focus:ring-sky-600"
					}`}
				/>
				{codeError && <p className="mt-2 text-red-400 text-xs">{codeError}</p>}
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
						disabled={normalizedCode.length < 6 || isPending}
						onClick={() => onJoin(normalizedCode)}
						className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-sky-600 py-2 font-semibold text-sky-50 text-sm hover:bg-sky-500 disabled:opacity-50"
					>
						{isPending ? (
							<Loader2 size={14} className="animate-spin" />
						) : (
							<LogIn size={14} />
						)}
						Beitreten
					</button>
				</div>
			</div>
		</div>
	);
}

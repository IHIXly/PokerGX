"use client";

import { Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useEffect, useRef, useState } from "react";

export interface DeleteButtonProps {
	onConfirm: () => void;
	disabled: boolean;
}

export function DeleteButton({ onConfirm, disabled }: DeleteButtonProps) {
	const [confirming, setConfirming] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const startConfirm = () => {
		setConfirming(true);
		timerRef.current = setTimeout(() => setConfirming(false), 3000);
	};

	const cancel = (e: MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		if (timerRef.current) clearTimeout(timerRef.current);
		setConfirming(false);
	};

	const confirm = (e: MouseEvent<HTMLButtonElement>) => {
		e.stopPropagation();
		if (timerRef.current) clearTimeout(timerRef.current);
		setConfirming(false);
		onConfirm();
	};

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	if (confirming) {
		return (
			<div className="flex items-center gap-1">
				<span className="text-[10px] text-slate-500">Sicher?</span>
				<button
					type="button"
					onClick={confirm}
					disabled={disabled}
					className="rounded-md border border-red-800/50 px-2 py-0.5 font-semibold text-[11px] text-red-400 transition hover:bg-red-900/30 disabled:opacity-40"
				>
					Ja
				</button>
				<button
					type="button"
					onClick={cancel}
					className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-500 transition hover:bg-slate-700/40"
				>
					Nein
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={(e) => {
				e.stopPropagation();
				startConfirm();
			}}
			disabled={disabled}
			title="Session löschen"
			className="rounded-lg border border-slate-700 p-1.5 text-slate-500 transition hover:border-red-700 hover:bg-red-900/30 hover:text-red-400 disabled:opacity-50"
		>
			<Trash2 size={13} />
		</button>
	);
}

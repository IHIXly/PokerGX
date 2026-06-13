"use client";

import { api } from "@/trpc/react"; // <-- wichtig
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SessionSettings({
	user,
	onClose,
}: {
	user: { name: string; image?: string; chips: number; id: string };
	onClose: () => void;
}) {
	const utils = api.useUtils();
	const router = useRouter();
	const [buyIn, setBuyIn] = useState(1000);
	const [name, setName] = useState("");
	const [privatelobby, setChecked] = useState(false);

	const incrementBuyIn = () =>
		setBuyIn((prev) => Math.min(prev + 100, 1_000_000));
	const decrementBuyIn = () => setBuyIn((prev) => Math.max(prev - 100, 1));

	const createSession = api.poker.createSession.useMutation({
		onSuccess: (data) => {
			utils.poker.getSessions.invalidate();
			router.push(`/room/${data.sessionID}`); // <-- direkt in den Raum!
		},
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="relative flex h-[450px] w-[700px] overflow-hidden rounded-xl bg-gray-900 text-white shadow-lg"
			>
				{/* Close */}
				<button
					type="button"
					onClick={onClose}
					className="absolute top-4 right-4 z-50 text-gray-400 hover:text-white"
				>
					✕
				</button>

				{/* LEFT SIDEBAR */}
				<div className="flex w-48 flex-col gap-4 border-gray-700 border-r bg-gray-800 p-4">
					<h3 className="font-semibold text-lg">Settings</h3>

					<label className="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							checked={privatelobby}
							onChange={(e) => setChecked(e.target.checked)}
							className="accent-indigo-500"
						/>
						Private Lobby
					</label>
				</div>

				{/* RIGHT MAIN CONTENT */}
				<div className="flex flex-1 flex-col items-center justify-center gap-6">
					<h2 className="font-semibold text-2xl">Neue Runde</h2>

					<input
						id="name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Raumname eingeben"
						className="w-64 rounded-md border border-indigo-600 bg-gray-800 p-2 text-center"
					/>

					<div className="flex items-center justify-center gap-6">
						<button
							type="button"
							onClick={decrementBuyIn}
							className="rounded bg-gray-700 px-4 py-2 text-lg hover:bg-gray-600"
						>
							−
						</button>
						<span className="font-bold text-2xl">{buyIn}</span>
						<button
							type="button"
							onClick={incrementBuyIn}
							className="rounded bg-gray-700 px-4 py-2 text-lg hover:bg-gray-600"
						>
							+
						</button>
					</div>

					<button
						type="button"
						onClick={() => {
							if (name)
								createSession.mutate({
									name,
									privateSession: privatelobby,
									buyIn,
								});
						}}
						className="mt-4 rounded-lg bg-indigo-600 px-6 py-2 font-semibold hover:bg-indigo-700"
					>
						Speichern
					</button>
				</div>
			</motion.div>
		</div>
	);
}

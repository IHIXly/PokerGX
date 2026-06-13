"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export default function ProfileOverlay({
	user,
	onClose,
}: {
	user: { name: string; image?: string; wallet: number };
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				transition={{ duration: 0.2 }}
				className="relative w-[400px] rounded-xl bg-gray-900 p-8 text-white shadow-lg"
			>
				<button
					type="button"
					onClick={onClose}
					className="absolute top-4 right-4 text-gray-400 hover:text-white"
				>
					✕
				</button>

				<div className="flex flex-col items-center text-center">
					<img
						src={user.image ?? "/default-avatar.png"}
						alt="Profile"
						className="mb-4 h-20 w-20 rounded-full border-2 border-indigo-500"
					/>
					<h2 className="font-semibold text-2xl">{user.name}</h2>
					<p className="mt-1 text-indigo-400">{user.wallet} Chips</p>

					<div className="mt-6 w-full space-y-2" />
				</div>
			</motion.div>
		</div>
	);
}

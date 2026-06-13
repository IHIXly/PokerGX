"use client";

import { api } from "@/trpc/react";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import ProfileOverlay from "./ProfileOverlay";

export function UserBar() {
	const { data: session } = useSession();
	const { data: me } = api.poker.getMe.useQuery(undefined, {
		enabled: !!session,
		refetchInterval: 5000,
	});

	const [showProfile, setShowProfile] = useState(false);

	if (!session) return null;

	const profileUser = {
		name: me?.name ?? session.user.name ?? "Unbekannt",
		image: me?.image ?? session.user.image ?? "",
		wallet: me?.wallet ?? session.user.wallet ?? 0,
	};

	return (
		<div className="fixed top-4 right-4 flex items-center gap-3 rounded-xl bg-gray-800 px-4 py-2 text-white shadow-lg">
			<button
				type="button"
				onClick={() => setShowProfile(true)}
				className="rounded-full"
			>
				<img
					src={profileUser.image}
					alt="avatar"
					className="h-8 w-8 cursor-pointer rounded-full border border-gray-700 transition hover:scale-105"
				/>
			</button>

			{showProfile && (
				<ProfileOverlay
					user={profileUser}
					onClose={() => setShowProfile(false)}
				/>
			)}

			<span>{profileUser.name}</span>

			<button
				type="button"
				onClick={() => signOut({ callbackUrl: "/login" })}
				className="rounded-md bg-red-500 px-3 py-1 hover:bg-red-600"
			>
				Logout
			</button>
		</div>
	);
}

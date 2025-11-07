"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import ProfileOverlay from "./ProfileOverlay";

export function UserBar() {
  const { data: session } = useSession();
  const [showProfile, setShowProfile] = useState(false);

  if (!session) return null;

  return (
    <div className="fixed top-4 right-4 flex items-center gap-3 bg-gray-800 text-white px-4 py-2 rounded-xl shadow-lg">
      <img
        src={session.user.image ?? ""}
        alt="avatar"
        onClick={() => setShowProfile(true)}
        className="w-8 h-8 rounded-full border border-gray-700 cursor-pointer hover:scale-105 transition"
      />

      {showProfile && (
        <ProfileOverlay
          user={{
            name: session.user.name ?? "Unbekannt",
            image: session.user.image ?? "",
            chips: session.user.chips ?? 0,
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      <span>{session.user.name ?? "Unbekannt"}</span>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="bg-red-500 px-3 py-1 rounded-md hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
}

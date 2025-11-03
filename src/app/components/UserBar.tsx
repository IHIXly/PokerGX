"use client";

import { useSession, signOut } from "next-auth/react";

export function UserBar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <div className="fixed top-4 right-4 flex items-center gap-3 bg-gray-800 text-white px-4 py-2 rounded-xl shadow-lg">
      <img
        src={session.user.image ?? ""}
        alt="avatar"
        className="w-8 h-8 rounded-full border border-gray-700"
      />
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

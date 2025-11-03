"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Willkommen bei PokerGX</h1>

      <button
        onClick={() => signIn("discord", { callbackUrl: "/" })}
        className="bg-indigo-600 px-6 py-3 rounded-xl hover:bg-indigo-700 transition"
      >
        Mit Discord einloggen
      </button>

      <button
        onClick={() => signIn("github", { callbackUrl: "/" })}
        className="bg-gray-800 px-6 py-3 rounded-xl hover:bg-gray-900 transition"
      >
        Mit GitHub einloggen
      </button>
    </main>
  );
}

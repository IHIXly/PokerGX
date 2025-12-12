"use client";
import ThreeScene from "@/app/components/ThreeScene"
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <main className="flex flex-col items-center justify-center h-screen gap-4 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-6">Willkommen bei PokerGX</h1>
       <div className="h-screen w-screen">
          <ThreeScene />
        </div>
      <button
        onClick={() => signIn("github", { callbackUrl: "/" })}
        className="bg-indigo-600 px-6 py-3 rounded-xl hover:bg-indigo-700 transition"
      >
        Mit GitHub einloggen
      </button>

      <button
          onClick={() => signIn("credentials", { redirect: true, callbackUrl: "/", credentials: {} })}

          className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-semibold"
        >
          Als Gast fortfahren
        </button>

    </main>
  );
}

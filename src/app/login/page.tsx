"use client"

import ThreePokerchipScene from "@/app/components/ThreePokerChip"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-gray-900 text-white">
      {/* Background */}
      <div className="absolute inset-0">
        <ThreePokerchipScene />
      </div>

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/40" />

      {/* UI */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-3xl font-bold">Willkommen bei PokerGX</h1>

        <div className="mt-2 flex flex-col gap-3 w-full max-w-sm">
          <button
            onClick={() => signIn("github", { callbackUrl: "/" })}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold hover:bg-indigo-700 transition"
          >
            Mit GitHub einloggen
          </button>

          <button
            onClick={() => signIn("credentials", { redirect: true, callbackUrl: "/", credentials: {} })}
            className="rounded-xl bg-gray-600 px-6 py-3 font-semibold hover:bg-gray-700 transition"
          >
            Als Gast fortfahren
          </button>
        </div>
      </div>
    </main>
  )
}

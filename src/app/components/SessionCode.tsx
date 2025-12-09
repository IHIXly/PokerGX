"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/trpc/react"; // <-- wichtig
import { join } from "path";
import { useRouter } from "next/navigation";

export default function SessionCode({
  onClose,
}: {
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const router = useRouter();
  const [code, setCode] = useState("");

  const joinSessionByCode = api.poker.joinSessionByCode.useMutation({
  onSuccess: (data) => {
    utils.poker.getSessions.invalidate();
    router.push(`/room/${data.sessionId}`);
  },
});


  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 rounded-xl shadow-lg w-[450] h-[300] text-white relative overflow-hidden flex"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-50"
        >
          ✕
        </button>

        {/* Eingabe */}
        <div className="flex-1 flex flex-col items-center justify-start gap-6 p-8">

          <h2 className="text-2xl font-semibold">Code Eingeben</h2>
            <input
                type="text"
                placeholder="Gib einen Session-Code ein"
                className="w-3/4 p-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
                value={code}
                onChange={(e) => setCode(e.target.value)}
            />
            <button
                onClick={() => {
                  // Hier kannst du die Logik zum Beitreten der Session mit dem Code hinzufügen
                  console.log("Beitreten mit Code:", code);
                  onClose();
                  if (code) joinSessionByCode.mutate({ sessionCode: code });
                }}
                className="mt-4 bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-lg"
            >
                Beitreten
            </button>
        </div>
      </motion.div>
    </div>
  );
}
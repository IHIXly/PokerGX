"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/trpc/react"; // <-- wichtig
import { join } from "path";
import { useRouter } from "next/navigation";

export default function SessionSettings({
    user,
  onClose,
}: {
  user: { name: string; image?: string; chips: number, id: string };
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const router = useRouter();
  const [chips, setChips] = useState(user.chips);
  const [name, setName] = useState("");
  const [privatelobby, setChecked] = useState(false);

  // tRPC Mutation für Chips-Update
  const updateChips = api.poker.updateChips.useMutation({
    onSuccess: () => {
      onClose(); // schließt das Fenster nach dem Speichern
    },
  });

  const incrementChips = () => setChips((prev) => prev + 100);
  const decrementChips = () => setChips((prev) => Math.max(prev - 100, 0));

  const handleSave = async () => { // wartet, bis Chips gespeichert sind
    await updateChips.mutateAsync({ chips });
  };


  const createSession = api.poker.createSession.useMutation({
    onSuccess: (data) => {
      utils.poker.getSessions.invalidate();
      router.push(`/room/${data.sessionID}`); // <-- direkt in den Raum!
  },
});

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 rounded-xl shadow-lg w-[700px] h-[450px] text-white relative overflow-hidden flex"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white z-50"
        >
          ✕
        </button>

        {/* LEFT SIDEBAR */}
        <div className="w-48 bg-gray-800 border-r border-gray-700 p-4 flex flex-col gap-4">
          <h3 className="text-lg font-semibold">Settings</h3>

          <label className="flex items-center gap-2 cursor-pointer">
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
        <div className="flex-1 flex flex-col items-center justify-center gap-6">

          <h2 className="text-2xl font-semibold">Neue Runde</h2>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Raumname eingeben"
            className="p-2 rounded-md bg-gray-800 border border-indigo-600 w-64 text-center"
          />

          <div className="flex items-center justify-center gap-6">
            <button
              onClick={decrementChips}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-lg"
            >
              −
            </button>
            <span className="text-2xl font-bold">{chips}</span>
            <button
              onClick={incrementChips}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-lg"
            >
              +
            </button>
          </div>

          <button
            onClick={async () => {
              await handleSave();
              if (name) createSession.mutate({ name, privateSession: privatelobby, createdBy: user.id });
            }}
            className="bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-semibold mt-4"
          >
            Speichern
          </button>
        </div>
      </motion.div>
    </div>
);

}

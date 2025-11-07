"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/trpc/react"; // <-- wichtig

export default function SessionSettings({
    user,
  onClose,
}: {
  user: { name: string; image?: string; chips: number };
  onClose: () => void;
}) {
  const utils = api.useUtils();
  const [chips, setChips] = useState(user.chips);
  const [name, setName] = useState("");

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
    onSuccess: () => utils.poker.getSessions.invalidate(),
  });

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 rounded-xl p-8 shadow-lg w-[400px] text-white relative"
      >
        {/* Schließen */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          ✕
        </button>

        {/* Titel */}
        <div className="flex flex-col items-center text-center">
          <h2 className="text-2xl font-semibold mb-2">Neue Runde</h2>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)} // <- bei jedem Tippen speichern
            placeholder="Raumname eingeben"
            className="p-2 rounded-md bg-grey-800 text-rose border border-indigo-600 focus:outline-none focus:border-indigo-500"
          />
    

          <p className="text-indigo-400 text-lg mb-4">
            Aktuelle Chips: {chips}
          </p>

          {/* Buttons + Anzeige */}
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

          {/* Speichern */}
          <button
            onClick={async () => {
              await handleSave(); // wartet, bis Chips gespeichert sind
              if (name) createSession.mutate({ name });
            }}
            className="mt-6 bg-indigo-600 hover:bg-indigo-700 px-6 py-2 rounded-lg font-semibold"
          >
            Speichern
          </button>
        </div>
      </motion.div>
    </div>
  );
}

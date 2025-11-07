"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function ProfileOverlay({ user, onClose }: {
  user: { name: string; image?: string; chips: number };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 z-50">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="bg-gray-900 rounded-xl p-8 shadow-lg w-[400px] text-white relative"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-gray-400 hover:text-white">
          ✕
        </button>

        <div className="flex flex-col items-center text-center">
          <img
            src={user.image ?? "/default-avatar.png"}
            alt="Profile"
            className="w-20 h-20 rounded-full border-2 border-indigo-500 mb-4"
          />
          <h2 className="text-2xl font-semibold">{user.name}</h2>
          <p className="text-indigo-400 mt-1">{user.chips} Chips</p>

          <div className="mt-6 space-y-2 w-full">
          </div>
        </div>
      </motion.div>
    </div>
  );
}

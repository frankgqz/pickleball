"use client";

import React, { useState } from "react";
import { Player } from "./Types";

interface Props {
  eventPool: Player[];
  onToggleSitting?: (id: string) => void;
  onRemoveFromPool?: (id: string) => void;
}

export default function EventPool({ eventPool, onToggleSitting, onRemoveFromPool }: Props) {
  const [sortBy, setSortBy] = useState<"dupr" | "recent">("dupr");

  const activeCount = eventPool.filter(p => !p.isSitting).length;

  // Sort the pool
  const sorted = [...eventPool].sort((a, b) => {
    if (sortBy === "dupr") {
      const aScore = a.duprScore ?? 0;
      const bScore = b.duprScore ?? 0;
      if (bScore !== aScore) return bScore - aScore; // highest first
      return a.name.localeCompare(b.name);
    } else {
      // Recent first - keep insertion order (newest at top via unshift)
      return 0;
    }
  });

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">🎯 Event Pool</h2>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="dupr">DUPR Rating</option>
            <option value="recent">Recent First</option>
          </select>
          <span className="text-sm text-gray-500">{activeCount} / {eventPool.length}</span>
        </div>
      </div>

      {eventPool.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Add players from the database to start your event!</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {sorted.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            const containerClass = player.isSitting
              ? "flex items-center gap-3 p-3 rounded-lg border bg-orange-50 border-orange-200"
              : hasDupr
                ? "flex items-center gap-3 p-3 rounded-lg border bg-green-50 border-green-200"
                : "flex items-center gap-3 p-3 rounded-lg border bg-yellow-50 border-yellow-200";

            const avatarClass = player.isSitting
              ? "w-8 h-8 rounded-full flex items-center justify-center font-bold bg-orange-200 text-orange-700"
              : hasDupr
                ? "w-8 h-8 rounded-full flex items-center justify-center font-bold bg-green-600 text-white"
                : "w-8 h-8 rounded-full flex items-center justify-center font-bold bg-yellow-200 text-yellow-800";

            return (
              <div key={player.id} className={containerClass}>
                <div className={avatarClass}>
                  {player.isSitting ? "💤" : (hasDupr ? "🎾" : "⚠️")}
                </div>

                <div className={`flex-1 ${player.isSitting ? "text-gray-400" : "text-gray-800"}`}>
                  <div className="font-medium">
                    {player.name}
                    {player.duprScore !== null && player.duprScore !== undefined && (
                      <span className="ml-2 text-xs font-semibold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                        {player.duprScore}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {player.duprId ? `DUPR: ${player.duprId}` : player.duprNumericId ? `#${player.duprNumericId}` : "No DUPR"}
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!player.isSitting}
                      onChange={() => onToggleSitting && onToggleSitting(player.id)}
                      className="w-4 h-4"
                    />
                    <span className={player.isSitting ? "text-orange-500" : "text-gray-500"}>sit out</span>
                  </label>

                  <button
                    onClick={() => onRemoveFromPool && onRemoveFromPool(player.id)}
                    className="text-red-500 hover:text-red-700 px-2"
                    title="Remove from pool"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
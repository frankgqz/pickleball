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
    <section className="bg-white rounded-2xl shadow-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-gray-800">🎯 Event Pool</h2>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="dupr">DUPR</option>
            <option value="recent">Recent</option>
          </select>
          <span className="text-xs text-gray-500">{activeCount}/{eventPool.length}</span>
        </div>
      </div>

      {eventPool.length === 0 ? (
        <p className="text-gray-400 text-center py-4 text-sm">Add players from database</p>
      ) : (
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {sorted.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            const containerClass = player.isSitting
              ? "flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-orange-50 border-orange-200"
              : hasDupr
              ? "flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-green-50 border-green-200"
              : "flex items-center gap-2 px-2 py-1.5 rounded-lg border bg-yellow-50 border-yellow-200";

            return (
              <div key={player.id} className={containerClass} title={player.duprId ? `DUPR: ${player.duprId}` : player.duprNumericId ? `#${player.duprNumericId}` : "No DUPR"}>
                {/* DUPR Avatar if available, otherwise CSS initials */}
                {player.imageUrl ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className={`w-6 h-6 rounded-full object-cover ${player.isSitting ? "opacity-50" : ""}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${player.isSitting ? "bg-orange-200 text-orange-700" : hasDupr ? "bg-green-600 text-white" : "bg-yellow-500 text-yellow-900"} ${player.imageUrl ? "hidden" : ""}`}
                  style={{ textTransform: 'uppercase' }}
                >
                  {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                <div className={`flex-1 min-w-0 ${player.isSitting ? "text-gray-400" : "text-gray-800"}`}>
                  <div className="font-medium text-sm truncate">
                    {player.name}
                    {player.duprScore !== null && player.duprScore !== undefined && (
                      <span className="ml-1.5 text-[10px] font-semibold bg-green-100 text-green-700 px-1 py-0.5 rounded">
                        {player.duprScore}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 items-center shrink-0">
                  <label className="flex items-center gap-0.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!player.isSitting}
                      onChange={() => onToggleSitting && onToggleSitting(player.id)}
                      className="w-3 h-3"
                    />
                    <span className={`${player.isSitting ? "text-orange-500" : "text-gray-400"} hidden sm:inline`}>sit</span>
                  </label>

                  <button
                    onClick={() => onRemoveFromPool && onRemoveFromPool(player.id)}
                    className="text-red-400 hover:text-red-600 px-1 text-xs"
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
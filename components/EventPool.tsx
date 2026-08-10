"use client";

import React, { useState } from "react";
import { Player } from "./Types";

interface Props {
  eventPool: Player[];
  onToggleSitting?: (id: string) => void;
  onRemoveFromPool?: (id: string) => void;
  onClearAll?: () => void;
}

export default function EventPool({ eventPool, onToggleSitting, onRemoveFromPool, onClearAll }: Props) {
  const [sortBy, setSortBy] = useState<"dupr" | "recent">("dupr");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const activeCount = eventPool.filter(p => !p.isSitting).length;

  // Sort the pool by DUPR (highest first) or recent
  const sorted = [...eventPool].sort((a, b) => {
    if (sortBy === "dupr") {
      const aScore = a.duprScore ?? 0;
      const bScore = b.duprScore ?? 0;
      if (bScore !== aScore) return bScore - aScore; // highest first
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const handleClearAll = () => {
    if (showClearConfirm) {
      onClearAll?.();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      setTimeout(() => setShowClearConfirm(false), 3000);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow p-3">
      {/* Header */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800">🎯 Event Pool</h2>
          <span className="text-xs text-gray-500">{activeCount}/{eventPool.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-2 py-0.5 border border-gray-300 rounded text-xs"
          >
            <option value="dupr">By DUPR</option>
            <option value="recent">Added</option>
          </select>
          {eventPool.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`text-xs px-2 py-0.5 rounded transition-all ${
                showClearConfirm 
                  ? "bg-red-600 text-white" 
                  : "bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600"
              }`}
            >
              {showClearConfirm ? "⚠ Confirm?" : "Clear All"}
            </button>
          )}
        </div>
      </div>

      {/* Player list - more height */}
      {eventPool.length === 0 ? (
        <div className="text-gray-400 text-center py-4 text-sm">Add players from database</div>
      ) : (
        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1">
          {sorted.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            const containerClass = player.isSitting
              ? "flex items-center gap-2 px-2 py-1 rounded-lg border border-orange-200 bg-orange-50"
              : hasDupr
              ? "flex items-center gap-2 px-2 py-1 rounded-lg border border-gray-300 bg-white"
              : "flex items-center gap-2 px-2 py-1 rounded-lg border border-yellow-300 bg-yellow-50";

            return (
              <div key={player.id} className={containerClass} title={player.duprId || player.duprNumericId || "No DUPR"}>
                {/* Avatar */}
                {player.imageUrl ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className={`w-8 h-8 rounded-full object-cover border border-gray-300 ${player.isSitting ? "opacity-50" : ""}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                      if (next) next.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-gray-300 ${player.isSitting ? "bg-orange-200 text-orange-700" : hasDupr ? "bg-white text-gray-800" : "bg-yellow-200 text-yellow-800"} ${player.imageUrl ? "hidden" : ""}`}
                  style={{ textTransform: 'uppercase' }}
                >
                  {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                {/* Info */}
                <div className={`flex-1 min-w-0 ${player.isSitting ? "text-gray-400" : "text-gray-800"}`}>
                  <div className="font-medium text-sm truncate">{player.name}</div>
                  {player.duprScore !== null && player.duprScore !== undefined && (
                    <div className="text-xs text-gray-500">{player.duprScore}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!player.isSitting}
                      onChange={() => onToggleSitting && onToggleSitting(player.id)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className={`text-xs ${player.isSitting ? "text-orange-500" : "text-gray-400"}`}>sit</span>
                  </label>
                  <button
                    onClick={() => onRemoveFromPool && onRemoveFromPool(player.id)}
                    className="px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-100 rounded transition-colors"
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
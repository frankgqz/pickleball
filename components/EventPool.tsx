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

  const sorted = [...eventPool].sort((a, b) => {
    if (sortBy === "dupr") {
      const aScore = a.duprScore ?? 0;
      const bScore = b.duprScore ?? 0;
      if (bScore !== aScore) return bScore - aScore;
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
    <section className="bg-white rounded-2xl shadow p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800">🎯 Event Pool</h2>
          <span className="text-xs text-gray-500">{activeCount}/{eventPool.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="py-1.5 px-2 border border-gray-300 rounded text-xs"
          >
            <option value="dupr">By DUPR</option>
            <option value="recent">Added</option>
          </select>
          {eventPool.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`py-1.5 px-3 rounded text-xs transition-all border ${
                showClearConfirm 
                  ? "bg-red-600 text-white border-red-700" 
                  : "bg-red-100 text-red-600 border-red-300 hover:bg-red-200 hover:border-red-400"
              }`}
            >
              {showClearConfirm ? "⚠ Confirm?" : "Clear All"}
            </button>
          )}
        </div>
      </div>

      {/* Player list */}
      {eventPool.length === 0 ? (
        <div className="text-gray-400 text-center py-6 text-sm">Add players from database</div>
      ) : (
        <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1">
          {sorted.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            
            // Consistent row height, background based on state
            const containerClass = player.isSitting
              ? "flex items-center gap-2 px-2 rounded-lg border border-orange-200 bg-orange-50 h-10"
              : hasDupr
              ? "flex items-center gap-2 px-2 rounded-lg border border-green-300 bg-green-50 h-10"
              : "flex items-center gap-2 px-2 rounded-lg border border-yellow-300 bg-yellow-50 h-10";

            return (
              <div key={player.id} className={containerClass} title={player.duprId || player.duprNumericId || "No DUPR - may affect export"}>
                {/* Avatar */}
                <div className="flex-none w-8 h-8">
                  {player.imageUrl ? (
                    <img
                      src={player.imageUrl}
                      alt={player.name}
                      className={`w-full h-full rounded-full object-cover border border-gray-300 ${player.isSitting ? "opacity-50" : ""}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (next) next.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div
                      className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs border border-gray-300 ${
                        player.isSitting 
                          ? "bg-orange-200 text-orange-700" 
                          : hasDupr 
                            ? "bg-green-200 text-green-800" 
                            : "bg-yellow-200 text-yellow-800"
                      }`}
                      style={{ textTransform: 'uppercase' }}
                    >
                      {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                </div>

                {/* Name + DUPR in one line */}
                <div className={`flex-1 min-w-0 flex items-center gap-2 ${player.isSitting ? "text-gray-400" : "text-gray-800"}`}>
                  <span className="text-xs font-medium truncate">{player.name}</span>
                  {player.duprScore != null ? (
                    <span className="flex-none px-1.5 py-0.5 rounded bg-green-600 text-white text-[10px] font-bold">
                      {player.duprScore.toFixed(3)}
                    </span>
                  ) : player.manualDuprScore != null ? (
                    <span className="flex-none px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-900 text-[10px] font-bold">
                      {player.manualDuprScore.toFixed(1)}
                    </span>
                  ) : null}
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
                    className="w-6 h-6 text-[10px] text-red-400 hover:bg-red-100 rounded transition-colors flex items-center justify-center"
                    title="Remove"
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
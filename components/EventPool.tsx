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

  // Sort by DUPR (highest first)
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
    <section className="bg-white rounded-2xl shadow px-3 py-2">
      {/* Header - aligned with PlayerDatabase */}
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-800">🎯 Event Pool</h2>
          <span className="text-xs text-gray-500">{activeCount}/{eventPool.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-1.5 py-0.5 border border-gray-300 rounded text-xs h-6"
          >
            <option value="dupr">By DUPR</option>
            <option value="recent">Added</option>
          </select>
          {eventPool.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`text-xs px-1.5 py-0.5 rounded transition-all h-6 ${
                showClearConfirm 
                  ? "bg-red-600 text-white" 
                  : "bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-600"
              }`}
            >
              {showClearConfirm ? "⚠" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {/* Player list - capped height matching PlayerDatabase */}
      {eventPool.length === 0 ? (
        <div className="text-gray-400 text-center py-3 text-sm">Add players from database</div>
      ) : (
        <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-0.5">
          {sorted.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            
            // Default light green background, orange if sitting
            const containerClass = player.isSitting
              ? "flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-orange-200 bg-orange-50"
              : "flex items-center gap-1.5 px-1.5 py-0.5 rounded border border-gray-300 bg-green-50";

            return (
              <div key={player.id} className={containerClass} title={player.duprId || player.duprNumericId || "No DUPR"}>
                {/* Avatar */}
                {player.imageUrl ? (
                  <img
                    src={player.imageUrl}
                    alt={player.name}
                    className={`w-6 h-6 rounded-full object-cover border border-gray-300 ${player.isSitting ? "opacity-50" : ""}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                      if (next) next.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] border border-gray-300 ${player.isSitting ? "bg-orange-200 text-orange-700" : hasDupr ? "bg-green-100 text-green-800" : "bg-yellow-200 text-yellow-800"} ${player.imageUrl ? "hidden" : ""}`}
                  style={{ textTransform: 'uppercase' }}
                >
                  {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                </div>

                {/* Info */}
                <div className={`flex-1 min-w-0 ${player.isSitting ? "text-gray-400" : "text-gray-800"}`}>
                  <div className="font-medium text-xs truncate">{player.name}</div>
                  {player.duprScore !== null && player.duprScore !== undefined && (
                    <div className="text-[10px] text-gray-500">{player.duprScore}</div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!player.isSitting}
                      onChange={() => onToggleSitting && onToggleSitting(player.id)}
                      className="w-3 h-3 rounded"
                    />
                    <span className={`text-[10px] ml-0.5 ${player.isSitting ? "text-orange-500" : "text-gray-400"}`}>sit</span>
                  </label>
                  <button
                    onClick={() => onRemoveFromPool && onRemoveFromPool(player.id)}
                    className="w-5 h-5 text-[10px] text-red-400 hover:bg-red-100 rounded transition-colors flex items-center justify-center"
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
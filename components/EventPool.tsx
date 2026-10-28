"use client";

import React, { useState } from "react";
import { Player } from "./Types";

interface Props {
  eventPool: Player[];
  onToggleSitting?: (id: string) => void;
  onRemoveFromPool?: (id: string) => void;
  onClearAll?: () => void;
  teamsMode?: boolean;
  pairMap?: Record<string, string>;
  onPair?: (a: string, b: string | null) => void; // b=null = decouple
}

export default function EventPool({ eventPool, onToggleSitting, onRemoveFromPool, onClearAll, teamsMode, pairMap, onPair }: Props) {
  const [sortBy, setSortBy] = useState<"dupr" | "recent">("dupr");
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [pairingFor, setPairingFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // mutual pairs only — a one-way map entry is a misclick, not a pair
  const partnerOf = (id: string): Player | undefined => {
    const pid = pairMap?.[id];
    return pid && pairMap?.[pid] === id ? eventPool.find(p => p.id === pid) : undefined;
  };
  const showNotice = (msg: string | null) => {
    setNotice(msg);
    if (msg) window.setTimeout(() => setNotice(cur => (cur === msg ? null : cur)), 3500);
  };
  const handlePairClick = (p: Player) => {
    if (pairingFor) {
      if (pairingFor === p.id) { setPairingFor(null); showNotice(null); return; }
      const target = partnerOf(p.id);
      if (target) { showNotice(`${p.name} is paired with ${target.name} — decouple first`); return; }
      const a = eventPool.find(x => x.id === pairingFor);
      onPair?.(pairingFor, p.id);
      showNotice(`${a?.name ?? "player"} & ${p.name} paired — next round's generation`);
      setPairingFor(null);
      return;
    }
    const partner = partnerOf(p.id);
    if (partner) {
      onPair?.(p.id, null);
      showNotice(`pair dissolved — ${p.name} & ${partner.name} (next round's generation)`);
      return;
    }
    setPairingFor(p.id);
    showNotice(`select the partner for ${p.name} — click their name`);
  };

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
    <section className="bg-panel rounded-2xl shadow p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-3 pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-text">🎯 Event Pool</h2>
          <span className="text-xs text-subtext">{activeCount}/{eventPool.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="py-1 px-1.5 bg-muted-bg border border-line rounded-lg text-sm text-text"
          >
            <option value="dupr">Dupr</option>
            <option value="recent">Added</option>
          </select>
          {eventPool.length > 0 && (
            <button
              onClick={handleClearAll}
              className={`py-1 px-2.5 rounded-lg text-sm transition-all border ${
                showClearConfirm 
                  ? "bg-red-600 text-white border-red-700" 
                  : "bg-red-100 text-red-600 border-red-300 hover:bg-red-200 hover:border-red-400"
              }`}
            >
              {showClearConfirm ? "⚠ Confirm?" : "Clear"}
            </button>
          )}
        </div>
      </div>

      {/* Player list */}
      {eventPool.length === 0 ? (
        <div className="text-subtext text-center py-6 text-sm">Add players from database</div>
      ) : (
        <div style={{ maxHeight: '30vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1">
          {sorted.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            
            // Consistent row height, background based on state
            const containerClass = player.isSitting
              ? "flex items-center gap-2 px-2 rounded-lg border edge-warn bg-muted-bg h-10"
              : hasDupr
              ? "flex items-center gap-2 px-2 rounded-lg border edge-accent bg-muted-bg h-10"
              : "flex items-center gap-2 px-2 rounded-lg border edge-warn bg-muted-bg h-10";

            return (
              <div key={player.id} className={containerClass} title={player.duprId || player.duprNumericId || "No DUPR - may affect export"}>
                {/* Avatar */}
                <div className="flex-none w-8 h-8">
                  {player.imageUrl ? (
                    <img
                      src={player.imageUrl}
                      alt={player.name}
                      className={`w-full h-full rounded-full object-cover border border-line ${player.isSitting ? "opacity-50" : ""}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const next = (e.target as HTMLImageElement).nextElementSibling as HTMLElement;
                        if (next) next.classList.remove('hidden');
                      }}
                    />
                  ) : (
                    <div
                      className={`w-full h-full rounded-full flex items-center justify-center font-bold text-xs border border-line ${
                        player.isSitting 
                          ? "bg-red-100 text-red-600 " 
                          : hasDupr 
                            ? "bg-accent text-text" 
                            : "bg-red-100 text-red-600"
                      }`}
                      style={{ textTransform: 'uppercase' }}
                    >
                      {player.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                  )}
                </div>

                {/* Name + DUPR in one line */}
                <div
                  onClick={pairingFor && pairingFor !== player.id ? () => handlePairClick(player) : undefined}
                  className={`flex-1 min-w-0 flex items-center gap-2 ${player.isSitting ? "text-subtext" : "text-text"} ${pairingFor && pairingFor !== player.id ? "cursor-pointer tint-bg rounded-md -mx-1 px-1" : ""}`}
                >
                  <span className="text-xs font-medium truncate">{player.name}</span>
                  {player.duprScore != null ? (
                    <span className="flex-none px-1.5 py-0.5 rounded-md role-quiet  text-[10px] font-bold">
                      {player.duprScore.toFixed(3)}
                    </span>
                  ) : player.manualDuprScore != null ? (
                    <span className="flex-none px-1.5 py-0.5 rounded-md role-tint  text-[10px] font-bold">
                      {player.manualDuprScore.toFixed(1)}
                    </span>
                  ) : null}
                  {teamsMode && partnerOf(player.id) && (
                    <span className="flex-none px-1.5 py-0.5 rounded-md role-tint  text-[10px] font-bold max-w-[7rem] truncate" title={`Paired with ${partnerOf(player.id)!.name}`}>
                      ⚭ {partnerOf(player.id)!.name}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {teamsMode && (
                    <button
                      onClick={() => handlePairClick(player)}
                      title={partnerOf(player.id) ? `Paired with ${partnerOf(player.id)!.name} — click to decouple` : "Pair with a partner"}
                      className={`w-6 h-6 text-[11px] rounded-md transition-colors flex items-center justify-center ${
                        partnerOf(player.id)
                          ? "role-tint  "
                          : pairingFor === player.id
                            ? " role-tint"
                            : "text-subtext hover:bg-hover-bg border border-line"
                      }`}
                    >⚭</button>
                  )}
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!player.isSitting}
                      onChange={() => onToggleSitting && onToggleSitting(player.id)}
                      className="w-3.5 h-3.5 rounded-md"
                    />
                    <span className={`text-xs ${player.isSitting ? "text-subtext" : "text-subtext"}`}>sit</span>
                  </label>
                  <button
                    onClick={() => {
                      if (partnerOf(player.id)) showNotice(`${player.name} removed — pair dissolved`);
                      onRemoveFromPool && onRemoveFromPool(player.id);
                    }}
                    className="w-6 h-6 text-[10px] text-red-400 hover:bg-red-100 rounded-md transition-colors flex items-center justify-center"
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
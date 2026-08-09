"use client";

import React, { useMemo, useState } from "react";
import { Player } from "./Types";

interface Props {
  players: Player[];
  eventPool?: Player[];
  // Handlers supplied by page (or parent)
  onAddPlayer?: (p: { name: string; duprId?: string; duprNumericId?: string; duprScore?: number }) => Promise<void> | void;
  onUpdatePlayer?: (id: string, p: Partial<Player>) => Promise<void> | void;
  onDeletePlayer?: (id: string) => Promise<void> | void;
  onFetchDupr?: (id: string) => Promise<void> | void;
  onAddToPool?: (player: Player) => void;
  onRemoveFromPool?: (id: string) => void;
  onToggleSitting?: (id: string) => void;
  formatOptions?: Array<{ label: string; value: string; onClick: () => void }>;
}

export default function PlayerDatabase({
  players,
  eventPool = [],
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
  onFetchDupr,
  onAddToPool,
  onRemoveFromPool,
  onToggleSitting,
  formatOptions = [],
}: Props) {
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerSortBy, setPlayerSortBy] = useState<"date" | "alpha">("date");

  // Add player form state
  const [name, setName] = useState("");
  const [duprId, setDuprId] = useState("");
  const [duprNumericId, setDuprNumericId] = useState("");
  const [duprScore, setDuprScore] = useState<string>("");

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const payload = {
      name: trimmed,
      duprId: duprId.trim() || undefined,
      duprNumericId: duprNumericId.trim() || undefined,
      duprScore: duprScore ? parseFloat(duprScore) : undefined,
    };
    if (onAddPlayer) await onAddPlayer(payload);
    setName("");
    setDuprId("");
    setDuprNumericId("");
    setDuprScore("");
  };

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.trim().toLowerCase();
    let list = players.slice();

    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.duprId || "").toLowerCase().includes(q) ||
        (p.duprNumericId || "").toLowerCase().includes(q)
      );
    }

    if (playerSortBy === "alpha") {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      // Recent first — reversed since newest is at start of array
      list = list.slice().reverse();
    }

    return list;
  }, [players, playerSearch, playerSortBy]);

  const isInPool = (id: string) => eventPool.some(p => p.id === id);

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📋 Player Database</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search..."
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-40"
          />
          <select
            value={playerSortBy}
            onChange={(e) => setPlayerSortBy(e.target.value as "date" | "alpha")}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="date">Recent First</option>
            <option value="alpha">A - Z</option>
          </select>
        </div>
      </div>

      {/* Add player — inline with smaller fields */}
      <div className="mb-6 flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[140px]">
          <label className="block text-xs text-gray-600 mb-1">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Player name"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-600 mb-1">DUPR ID</label>
          <input
            value={duprId}
            onChange={(e) => setDuprId(e.target.value)}
            className="w-full px-2 py-2 border rounded-lg text-sm"
            placeholder="ID"
          />
        </div>
        <div className="w-28">
          <label className="block text-xs text-gray-600 mb-1">Num ID</label>
          <input
            value={duprNumericId}
            onChange={(e) => setDuprNumericId(e.target.value)}
            className="w-full px-2 py-2 border rounded-lg text-sm"
            placeholder="#"
          />
        </div>
        <div className="w-20">
          <label className="block text-xs text-gray-600 mb-1">Rating</label>
          <input
            value={duprScore}
            onChange={(e) => setDuprScore(e.target.value)}
            className="w-full px-2 py-2 border rounded-lg text-sm"
            placeholder="0.0"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="bg-green-600 text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:bg-gray-400 whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      {/* Format quick-start buttons */}
      {formatOptions.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 pt-2">Quick Start:</span>
          {formatOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={opt.onClick}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Player list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPlayers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No players match your search</p>
        ) : (
          filteredPlayers.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            const inPool = isInPool(player.id);
            const bgClass = player.isSitting
              ? "bg-orange-50 border-orange-200"
              : hasDupr
              ? "bg-white border-gray-100"
              : "bg-yellow-50 border-yellow-200";
            const avatarClass = player.isSitting
              ? "bg-orange-200 text-orange-700"
              : hasDupr
              ? "bg-green-600 text-white"
              : "bg-yellow-200 text-yellow-800";
            return (
              <div
                key={player.id}
                className={`p-3 rounded-lg border ${bgClass} flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${avatarClass}`}
                  >
                    {player.isSitting ? "💤" : hasDupr ? "🎾" : "⚠️"}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{player.name}</div>
                    <div className="text-xs text-gray-500">
                      {player.duprId
                        ? `DUPR: ${player.duprId}`
                        : player.duprNumericId
                        ? `#${player.duprNumericId}`
                        : "No DUPR"}
                      {player.duprScore !== null && player.duprScore !== undefined && (
                        <span className="ml-2 font-semibold">{player.duprScore}</span>
                      )}
                    </div>
                  </div>
                  {inPool && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      In Pool
                    </span>
                  )}
                </div>

                <div className="flex gap-1 items-center">
                  <button
                    onClick={() => onFetchDupr && onFetchDupr(player.id)}
                    className="text-blue-600 hover:text-blue-800 px-2 py-1 text-sm"
                    title="Fetch DUPR"
                  >
                    🔍
                  </button>
                  {onAddToPool && !inPool && (
                    <button
                      onClick={() => onAddToPool(player)}
                      className="text-green-600 hover:text-green-800 px-2 py-1 text-sm"
                      title="Add to event pool"
                    >
                      ➕
                    </button>
                  )}
                  {onRemoveFromPool && inPool && (
                    <button
                      onClick={() => onRemoveFromPool(player.id)}
                      className="text-orange-600 hover:text-orange-800 px-2 py-1 text-sm"
                      title="Remove from pool"
                    >
                      ➖
                    </button>
                  )}
                  {onToggleSitting && (
                    <button
                      onClick={() => onToggleSitting(player.id)}
                      className="text-yellow-600 hover:text-yellow-800 px-2 py-1 text-sm"
                      title={player.isSitting ? "Un-sit" : "Sit out"}
                    >
                      {player.isSitting ? "↩️" : "💤"}
                    </button>
                  )}
                  <button
                    onClick={() => onUpdatePlayer && onUpdatePlayer(player.id, { isSitting: !player.isSitting } as Partial<Player>)}
                    className="text-gray-500 hover:text-gray-700 px-2 py-1 text-sm"
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeletePlayer && onDeletePlayer(player.id)}
                    className="text-red-400 hover:text-red-600 px-2 py-1 text-sm"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
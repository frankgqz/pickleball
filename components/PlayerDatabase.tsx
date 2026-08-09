"use client";

import React, { useMemo, useState } from "react";
import { Player } from "./Types";

interface Props {
  players: Player[];
  eventPool?: Player[];
  onAddPlayer?: (p: { name: string; duprId?: string; duprNumericId?: string; duprScore?: number }) => Promise<void> | void;
  onUpdatePlayer?: (id: string, p: Partial<Player>) => Promise<void> | void;
  onDeletePlayer?: (id: string) => Promise<void> | void;
  onFetchDupr?: (id: string) => Promise<void> | void;
  onAddToPool?: (player: Player) => void;
  onRemoveFromPool?: (id: string) => void;
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
    }
    // else: keep original order (newest first since we unshift into array)

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

      {/* Add player — single line */}
      <div className="mb-4 flex gap-1 items-end">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 px-2 py-1.5 border rounded text-sm"
          placeholder="Name *"
        />
        <input
          value={duprId}
          onChange={(e) => setDuprId(e.target.value)}
          className="w-20 px-2 py-1.5 border rounded text-sm"
          placeholder="DUPR ID"
        />
        <input
          value={duprNumericId}
          onChange={(e) => setDuprNumericId(e.target.value)}
          className="w-16 px-2 py-1.5 border rounded text-sm"
          placeholder="#"
        />
        <input
          value={duprScore}
          onChange={(e) => setDuprScore(e.target.value)}
          className="w-16 px-2 py-1.5 border rounded text-sm"
          placeholder="Rating"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-green-700 disabled:bg-gray-400 whitespace-nowrap"
        >
          + Add
        </button>
      </div>

      {/* Player list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPlayers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No players match your search</p>
        ) : (
          filteredPlayers.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            const inPool = isInPool(player.id);
            const bgClass = hasDupr ? "bg-white border-gray-100" : "bg-yellow-50 border-yellow-200";

            return (
              <div
                key={player.id}
                className={`p-3 rounded-lg border ${bgClass} flex items-center justify-between`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      hasDupr ? "bg-green-600 text-white" : "bg-yellow-200 text-yellow-800"
                    }`}
                  >
                    {hasDupr ? "🎾" : "⚠️"}
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

                {/* Icon buttons in order: Add/Minus → Edit → DUPR → Delete */}
                <div className="flex gap-1 items-center">
                  {/* Add to Pool / Remove from Pool - colored background */}
                  {onAddToPool && !inPool && (
                    <button
                      onClick={() => onAddToPool(player)}
                      className="w-7 h-7 rounded bg-green-500 hover:bg-green-600 text-white flex items-center justify-center text-sm font-bold shadow-sm"
                      title="Add to event pool"
                    >
                      +
                    </button>
                  )}
                  {onRemoveFromPool && inPool && (
                    <button
                      onClick={() => onRemoveFromPool(player.id)}
                      className="w-7 h-7 rounded bg-gray-500 hover:bg-red-500 text-white flex items-center justify-center text-sm font-bold shadow-sm transition-colors"
                      title="Remove from pool"
                    >
                      −
                    </button>
                  )}

                  {/* Edit - white background */}
                  <button
                    onClick={() => onUpdatePlayer && onUpdatePlayer(player.id, { isSitting: !player.isSitting } as Partial<Player>)}
                    className="w-7 h-7 rounded bg-white border border-blue-300 hover:bg-blue-50 text-blue-600 flex items-center justify-center text-xs shadow-sm"
                    title="Edit"
                  >
                    ✏️
                  </button>

                  {/* Fetch DUPR - white background */}
                  <button
                    onClick={() => onFetchDupr && onFetchDupr(player.id)}
                    className="w-7 h-7 rounded bg-white border border-purple-300 hover:bg-purple-50 text-purple-600 flex items-center justify-center text-xs shadow-sm"
                    title="Fetch DUPR"
                  >
                    🔍
                  </button>

                  {/* Delete - white background */}
                  <button
                    onClick={() => onDeletePlayer && onDeletePlayer(player.id)}
                    className="w-7 h-7 rounded bg-white border border-red-300 hover:bg-red-50 text-red-500 flex items-center justify-center text-xs shadow-sm"
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
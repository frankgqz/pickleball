"use client";

import React, { useMemo, useState } from "react";
import { Player } from "./Types";

interface Props {
  players: Player[];
  // Handlers supplied by page (or parent)
  onAddPlayer?: (p: { name: string; duprId?: string; duprNumericId?: string; duprScore?: number }) => Promise<void> | void;
  onUpdatePlayer?: (id: string, p: Partial<Player>) => Promise<void> | void;
  onDeletePlayer?: (id: string) => Promise<void> | void;
  onFetchDupr?: (id: string) => Promise<void> | void;
}

export default function PlayerDatabase({ players, onAddPlayer, onUpdatePlayer, onDeletePlayer, onFetchDupr }: Props) {
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
      // Recent first (assuming players array newest added at the start)
      list = list.slice().reverse(); // show newest on top if original is oldest-first
    }

    return list;
  }, [players, playerSearch, playerSortBy]);

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📋 Player Database</h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search by name or DUPR..."
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <select
            value={playerSortBy}
            onChange={(e) => setPlayerSortBy(e.target.value as "date" | "alpha")}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          >
            <option value="date">Recent First</option>
            <option value="alpha">A - Z</option>
          </select>
        </div>
      </div>

      {/* Add player */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-gray-700 mb-1">Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">DUPR ID</label>
          <input value={duprId} onChange={(e) => setDuprId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Numeric ID</label>
          <input value={duprNumericId} onChange={(e) => setDuprNumericId(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Rating</label>
          <input value={duprScore} onChange={(e) => setDuprScore(e.target.value)} className="w-full px-3 py-2 border rounded-lg" />
        </div>
      </div>
      <div className="mb-6">
        <button
          onClick={handleAdd}
          disabled={!name.trim()}
          className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
        >
          Add Player
        </button>
      </div>

      {/* Player list */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPlayers.length === 0 ? (
          <p className="text-gray-400 text-center py-8">No players match your search</p>
        ) : (
          filteredPlayers.map((player) => {
            const hasDupr = !!player.duprId || !!player.duprNumericId;
            const bgClass = player.isSitting ? "bg-orange-50 border-orange-200" : (hasDupr ? "bg-white border-gray-100" : "bg-yellow-50 border-yellow-200");
            const avatarClass = player.isSitting ? "bg-orange-200 text-orange-700" : (hasDupr ? "bg-green-600 text-white" : "bg-yellow-200 text-yellow-800");
            return (
              <div key={player.id} className={`p-3 rounded-lg border ${bgClass} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${avatarClass}`}>
                    {player.isSitting ? "💤" : hasDupr ? "🎾" : "⚠️"}
                  </div>
                  <div>
                    <div className="font-medium">{player.name}</div>
                    <div className="text-xs text-gray-500">
                      {player.duprId ? `DUPR: ${player.duprId}` : player.duprNumericId ? `#${player.duprNumericId}` : "No DUPR"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 items-center">
                  <button
                    onClick={() => onFetchDupr && onFetchDupr(player.id)}
                    className="text-blue-600 hover:text-blue-800 px-2"
                    title="Fetch DUPR rating"
                  >
                    🔍
                  </button>
                  <button
                    onClick={() => onUpdatePlayer && onUpdatePlayer(player.id, { isSitting: !player.isSitting })}
                    className="text-yellow-600 hover:text-yellow-800 px-2"
                    title={player.isSitting ? "Un-sit player" : "Sit out player"}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => onDeletePlayer && onDeletePlayer(player.id)}
                    className="text-red-500 hover:text-red-700 px-2"
                    title="Delete player"
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

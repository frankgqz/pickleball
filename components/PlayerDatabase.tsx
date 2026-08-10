"use client";

import React, { useMemo, useState } from "react";
import { Player } from "@/components/Types";

interface Props {
  players: Player[];
  eventPool?: Player[];
  onAddPlayer?: (p: { name: string; duprId?: string; duprNumericId?: string; duprScore?: number }) => Promise<any> | void;
  onUpdatePlayer?: (id: string, p: Partial<Player>) => Promise<any> | void;
  onDeletePlayer?: (id: string) => Promise<any> | void;
  onFetchDupr?: (id: string) => Promise<any> | void;
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
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "alpha">("recent");

  // Add form
  const [name, setName] = useState("");
  const [duprId, setDuprId] = useState("");
  const [duprNumericId, setDuprNumericId] = useState("");
  const [duprScore, setDuprScore] = useState("");
  const [validationError, setValidationError] = useState("");

  // Edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuprId, setEditDuprId] = useState("");
  const [editDuprNumericId, setEditDuprNumericId] = useState("");
  const [editDuprScore, setEditDuprScore] = useState("");

  // Fetch DUPR feedback
  const [fetchFeedback, setFetchFeedback] = useState<{ playerId: string; message: string; success: boolean } | null>(null);

  const inPoolIds = useMemo(() => new Set(eventPool.map((p) => p.id)), [eventPool]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = players.slice();
    if (q) list = list.filter(p => 
      (p.name || "").toLowerCase().includes(q) || 
      (p.duprId || "").toLowerCase().includes(q) || 
      (p.duprNumericId || "").toLowerCase().includes(q)
    );
    if (sortBy === "alpha") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [players, search, sortBy]);

  const handleAdd = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const hasDuprId = duprId.trim();
    const hasNum = duprNumericId.trim();
    const hasScore = duprScore.trim();
    if (!hasDuprId && !hasNum && !hasScore) {
      setValidationError("Provide at least DUPR ID, webNumericID, or rating");
      return;
    }
    setValidationError("");
    const payload = { 
      name: trimmed, 
      duprId: hasDuprId ? duprId.trim() : undefined, 
      duprNumericId: hasNum ? duprNumericId.trim() : undefined, 
      duprScore: hasScore ? parseFloat(duprScore) : undefined 
    };
    try {
      await onAddPlayer?.(payload);
    } catch (e) {
      console.error(e);
      setValidationError("Failed to add player");
    }
    setName(""); setDuprId(""); setDuprNumericId(""); setDuprScore("");
  };

  const startEditing = (p: Player) => {
    setEditingId(p.id);
    setEditName(p.name || "");
    setEditDuprId(p.duprId || "");
    setEditDuprNumericId(p.duprNumericId || "");
    setEditDuprScore(p.duprScore != null ? String(p.duprScore) : "");
  };
  const cancelEdit = () => { setEditingId(null); setEditName(""); setEditDuprId(""); setEditDuprNumericId(""); setEditDuprScore(""); };
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await onUpdatePlayer?.(editingId, { 
        name: editName.trim(), 
        duprId: editDuprId.trim() || null, 
        duprNumericId: editDuprNumericId.trim() || null, 
        duprScore: editDuprScore ? parseFloat(editDuprScore) : null 
      });
      cancelEdit();
    } catch (e) { console.error(e); }
  };

  const fetchDuprFor = async (id: string) => {
    setFetchFeedback({ playerId: id, message: "Fetching...", success: true });
    try {
      await onFetchDupr?.(id);
      const updated = players.find(p => p.id === id);
      if (updated?.imageUrl) setFetchFeedback({ playerId: id, message: "✓ Avatar", success: true });
      else if (updated?.duprScore) setFetchFeedback({ playerId: id, message: `✓ ${updated.duprScore}`, success: true });
      else setFetchFeedback({ playerId: id, message: "No rating", success: false });
    } catch (e) {
      console.error(e);
      setFetchFeedback({ playerId: id, message: "Error", success: false });
    }
    setTimeout(() => setFetchFeedback(null), 3000);
  };

  return (
    <section className="bg-white rounded-2xl shadow p-4">
      {/* Header - more top padding */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3 pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">🎾 Player Database</h2>
          <div className="text-xs text-gray-500">({players.length})</div>
        </div>

        <div className="flex items-center gap-2">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search name or ID" 
            className="px-2 py-1.5 border border-gray-300 rounded text-sm w-40 md:w-48" 
          />
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)} 
            className="py-1.5 px-2 border border-gray-300 rounded text-xs"
          >
            <option value="recent">Recent First</option>
            <option value="alpha">A - Z</option>
          </select>
        </div>
      </div>

      {/* Add form - single row */}
      <div className="flex flex-wrap gap-2 mb-2 items-end">
        <input 
          className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-[140px]" 
          placeholder="Name *" 
          value={name} 
          onChange={e => setName(e.target.value)} 
        />
        <input 
          className="px-2 py-1.5 border border-gray-300 rounded text-xs w-20" 
          placeholder="DUPR ID" 
          value={duprId} 
          onChange={e => setDuprId(e.target.value)} 
        />
        <input 
          className="px-2 py-1.5 border border-gray-300 rounded text-xs w-20" 
          placeholder="webNumericID" 
          value={duprNumericId} 
          onChange={e => setDuprNumericId(e.target.value)} 
        />
        <input 
          className="px-2 py-1.5 border border-gray-300 rounded text-xs w-16" 
          placeholder="Rating" 
          value={duprScore} 
          onChange={e => setDuprScore(e.target.value)} 
        />
        <button 
          className="px-4 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700 font-medium" 
          onClick={handleAdd}
        >
          + Add
        </button>
      </div>
      {validationError && <div className="text-red-500 text-xs mb-2">{validationError}</div>}

      {/* Player list */}
      <div style={{ maxHeight: '25vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-4 text-sm">No players</div>
        ) : filtered.map(player => {
          const hasDuprId = !!player.duprId;
          const hasNumericId = !!player.duprNumericId;
          const hasId = hasDuprId || hasNumericId;
          const inPool = inPoolIds.has(player.id);
          const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={player.id} className={`px-2 py-1.5 rounded-lg border border-gray-300 flex items-center gap-3 ${hasId ? 'bg-white' : 'bg-yellow-50'}`}>
              {/* Avatar */}
              <div className="flex-none">
                {player.imageUrl ? (
                  <img 
                    src={player.imageUrl} 
                    alt={player.name} 
                    className="w-8 h-8 rounded-full object-cover border border-gray-300" 
                  />
                ) : (
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border border-gray-300 ${hasId ? 'bg-white text-gray-800' : 'bg-yellow-200 text-yellow-800'}`} 
                    style={{ textTransform: 'uppercase' }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{player.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {player.duprId || player.duprNumericId || ''}
                      {player.duprScore != null && <span className="ml-1.5 font-semibold">{player.duprScore}</span>}
                    </div>
                    {fetchFeedback?.playerId === player.id && (
                      <div className={`text-xs ${fetchFeedback.success ? 'text-green-600' : 'text-red-500'}`}>
                        {fetchFeedback.message}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex-none flex items-center gap-1">
                    {inPool ? (
                      <button 
                        aria-label="Remove from pool" 
                        onClick={() => onRemoveFromPool?.(player.id)} 
                        className="w-7 h-7 rounded bg-gray-200 text-gray-600 border border-gray-300 hover:bg-red-100 hover:text-red-600 transition-colors text-sm font-medium"
                      >
                        −
                      </button>
                    ) : (
                      <button 
                        aria-label="Add to pool" 
                        onClick={() => onAddToPool?.(player)} 
                        className="w-7 h-7 rounded bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        +
                      </button>
                    )}

                    <button 
                      onClick={() => startEditing(player)} 
                      className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs text-blue-600 hover:bg-blue-100 transition-colors" 
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => fetchDuprFor(player.id)} 
                      className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs text-purple-600 hover:bg-purple-100 transition-colors" 
                    >
                      🔍
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Delete ${player.name}?`)) {
                          onDeletePlayer?.(player.id);
                        }
                      }} 
                      className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs text-red-500 hover:bg-red-100 transition-colors" 
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
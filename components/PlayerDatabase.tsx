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
    <section className="bg-white rounded-2xl shadow p-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">🎾 Player Database</h2>
          <div className="text-xs text-gray-500">({players.length})</div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search..." 
            className="flex-1 md:flex-none px-2 py-1 border border-gray-300 rounded text-xs" 
          />
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)} 
            className="px-2 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="recent">Recent</option>
            <option value="alpha">A-Z</option>
          </select>
        </div>
      </div>

      {/* Add form - 2 rows */}
      <div className="mb-2 space-y-1.5">
        {/* Row 1: Name */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-1.5">
          <input 
            className="px-2 py-1.5 border border-gray-300 rounded text-sm col-span-1 md:col-span-1" 
            placeholder="Name *" 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
          <input 
            className="px-2 py-1.5 border border-gray-300 rounded text-xs" 
            placeholder="DUPR ID" 
            value={duprId} 
            onChange={e => setDuprId(e.target.value)} 
          />
          <input 
            className="px-2 py-1.5 border border-gray-300 rounded text-xs" 
            placeholder="webNumericID" 
            value={duprNumericId} 
            onChange={e => setDuprNumericId(e.target.value)} 
          />
          <input 
            className="px-2 py-1.5 border border-gray-300 rounded text-xs" 
            placeholder="Rating" 
            value={duprScore} 
            onChange={e => setDuprScore(e.target.value)} 
          />
        </div>
        {/* Row 2: Add button + validation */}
        <div className="flex items-center gap-2">
          <button 
            className="px-4 py-1.5 text-sm bg-green-500 hover:bg-green-600 text-white rounded font-medium transition-colors" 
            onClick={handleAdd}
          >
            + Add Player
          </button>
          {validationError && (
            <span className="text-xs text-red-500">{validationError}</span>
          )}
        </div>
      </div>

      {/* Player list */}
      <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm">No players found</div>
        ) : filtered.map(player => {
          const hasDuprId = !!player.duprId;
          const hasNumericId = !!player.duprNumericId;
          const hasId = hasDuprId || hasNumericId;
          const inPool = inPoolIds.has(player.id);
          const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          // Background color based on state
          let bgClass = "bg-gray-50";
          if (inPool) {
            bgClass = "bg-green-50";
          } else if (!hasId) {
            bgClass = "bg-yellow-50";
          }

          return (
            <div key={player.id} className={`p-2 rounded-lg border ${bgClass}`}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="flex-none">
                  {player.imageUrl ? (
                    <img src={player.imageUrl} alt={player.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm bg-gray-200 text-gray-600" style={{ textTransform: 'uppercase' }}>
                      {initials}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-800 truncate">{player.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {player.duprId || player.duprNumericId || ''}
                        {player.duprScore != null && <span className="ml-1.5 font-semibold text-gray-700">{player.duprScore}</span>}
                      </div>
                      {fetchFeedback?.playerId === player.id && (
                        <div className={`text-xs ${fetchFeedback.success ? 'text-green-600' : 'text-red-500'}`}>
                          {fetchFeedback.message}
                        </div>
                      )}
                    </div>

                    {/* Action buttons - always visible, not cramped */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {inPool ? (
                        <button 
                          aria-label="Remove from pool" 
                          onClick={() => onRemoveFromPool?.(player.id)}
                          className="px-2.5 py-1 text-xs bg-gray-200 hover:bg-red-500 hover:text-white text-gray-600 rounded transition-colors"
                        >
                          − Pool
                        </button>
                      ) : (
                        <button 
                          aria-label="Add to pool" 
                          onClick={() => onAddToPool?.(player)}
                          className="px-2.5 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded transition-colors"
                        >
                          + Pool
                        </button>
                      )}

                      <button 
                        onClick={() => startEditing(player)} 
                        aria-label="Edit" 
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded border border-gray-200 transition-colors"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => fetchDuprFor(player.id)} 
                        aria-label="Fetch DUPR" 
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded border border-gray-200 transition-colors"
                      >
                        🔍
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm(`Delete ${player.name}?`)) {
                            onDeletePlayer?.(player.id);
                          }
                        }} 
                        aria-label="Delete" 
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded border border-gray-200 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inline edit form */}
              {editingId === player.id && (
                <div className="mt-2 bg-slate-100 p-2 rounded">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    <input 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      className="px-2 py-1 border border-gray-300 rounded text-sm" 
                      placeholder="Name" 
                    />
                    <input 
                      value={editDuprId} 
                      onChange={e => setEditDuprId(e.target.value)} 
                      placeholder="DUPR ID" 
                      className="px-2 py-1 border border-gray-300 rounded text-xs" 
                    />
                    <input 
                      value={editDuprNumericId} 
                      onChange={e => setEditDuprNumericId(e.target.value)} 
                      placeholder="webID" 
                      className="px-2 py-1 border border-gray-300 rounded text-xs" 
                    />
                    <input 
                      value={editDuprScore} 
                      onChange={e => setEditDuprScore(e.target.value)} 
                      placeholder="Rating" 
                      className="px-2 py-1 border border-gray-300 rounded text-xs" 
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">Save</button>
                    <button onClick={cancelEdit} className="px-3 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
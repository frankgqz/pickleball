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
    if (q) list = list.filter(p => (p.name || "").toLowerCase().includes(q) || (p.duprId || "").toLowerCase().includes(q) || (p.duprNumericId || "").toLowerCase().includes(q));
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
    const payload = { name: trimmed, duprId: hasDuprId ? duprId.trim() : undefined, duprNumericId: hasNum ? duprNumericId.trim() : undefined, duprScore: hasScore ? parseFloat(duprScore) : undefined };
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
      await onUpdatePlayer?.(editingId, { name: editName.trim(), duprId: editDuprId.trim() || null, duprNumericId: editDuprNumericId.trim() || null, duprScore: editDuprScore ? parseFloat(editDuprScore) : null });
      cancelEdit();
    } catch (e) { console.error(e); }
  };

  const fetchDuprFor = async (id: string) => {
    setFetchFeedback({ playerId: id, message: "Fetching...", success: true });
    try {
      await onFetchDupr?.(id);
      const updated = players.find(p => p.id === id);
      if (updated?.imageUrl) setFetchFeedback({ playerId: id, message: "✓ Avatar fetched", success: true });
      else if (updated?.duprScore) setFetchFeedback({ playerId: id, message: `✓ ${updated.duprScore}`, success: true });
      else setFetchFeedback({ playerId: id, message: "No rating", success: false });
    } catch (e) {
      console.error(e);
      setFetchFeedback({ playerId: id, message: "Error", success: false });
    }
    setTimeout(() => setFetchFeedback(null), 3000);
  };

  return (
    <section className="bg-white rounded-2xl shadow p-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Player Database</h2>
          <div className="text-xs text-gray-500">({players.length})</div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID" className="w-44 md:w-56 px-2 h-8 border border-gray-300 rounded text-sm" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="h-8 px-2 border border-gray-300 rounded text-sm">
            <option value="recent">Recent First</option>
            <option value="alpha">A - Z</option>
          </select>
        </div>
      </div>

      {/* Add form - all inputs on same row */}
      <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
        <input 
          className="h-8 px-2 border border-gray-300 rounded min-w-[120px]" 
          placeholder="Name *" 
          value={name} 
          onChange={e => setName(e.target.value)} 
        />
        <input 
          className="h-8 px-2 border border-gray-300 rounded w-20 text-xs" 
          placeholder="DUPR ID" 
          value={duprId} 
          onChange={e => setDuprId(e.target.value)} 
        />
        <input 
          className="h-8 px-2 border border-gray-300 rounded w-20 text-xs" 
          placeholder="webNumID" 
          value={duprNumericId} 
          onChange={e => setDuprNumericId(e.target.value)} 
        />
        <input 
          className="h-8 px-2 border border-gray-300 rounded w-16 text-xs" 
          placeholder="Rating" 
          value={duprScore} 
          onChange={e => setDuprScore(e.target.value)} 
        />
        <button className="h-8 px-4 text-sm text-white bg-green-600 rounded hover:bg-green-700" onClick={handleAdd}>+ Add</button>
      </div>
      {validationError && <div className="text-red-500 text-xs mb-2">{validationError}</div>}

      <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: 6 }} className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-6 text-sm">No players</div>
        ) : filtered.map(player => {
          const hasDupr = !!player.duprId || !!player.duprNumericId;
          const inPool = inPoolIds.has(player.id);
          const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={player.id} className={`p-2 rounded-lg border border-gray-300 flex items-center gap-3 ${hasDupr ? 'bg-white' : 'bg-yellow-50'}`}>
              <div className="flex-none">
                {player.imageUrl ? (
                  <img src={player.imageUrl} alt={player.name} className={`w-9 h-9 rounded-full object-cover border border-gray-300 ${player.isSitting ? 'opacity-50' : ''}`} />
                ) : (
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border border-gray-300 ${hasDupr ? 'bg-white text-gray-800' : 'bg-yellow-200 text-yellow-800'}`} style={{ textTransform: 'uppercase' }}>{initials}</div>
                )}
              </div>

              {/* single-line compact info */}
              <div className="flex-1 min-w-0 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate">
                    <div className="font-medium truncate">{player.name}</div>
                    <div className="text-xs text-gray-500 truncate">{player.duprId || player.duprNumericId || ''}{player.duprScore != null && <span className="ml-2 font-semibold">{player.duprScore}</span>}</div>
                    {fetchFeedback?.playerId === player.id && (<div className={`text-xs ${fetchFeedback.success ? 'text-green-600' : 'text-red-500'}`}>{fetchFeedback.message}</div>)}
                  </div>

                  {/* compact actions */}
                  <div className="flex-none flex items-center gap-1">
                    {inPool ? (
                      <button aria-label="Remove from pool" onClick={() => onRemoveFromPool?.(player.id)} className="w-8 h-8 rounded bg-gray-200 text-gray-500 border border-gray-300 hover:bg-red-100 hover:text-red-600 hover:border-red-300 transition-colors">−</button>
                    ) : (
                      <button aria-label="Add to pool" onClick={() => onAddToPool?.(player)} className="w-8 h-8 rounded bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-colors">+</button>
                    )}

                    <button onClick={() => startEditing(player)} aria-label="Edit" className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors" title="Edit">✏️</button>
                    <button onClick={() => fetchDuprFor(player.id)} aria-label="Fetch DUPR" className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs text-purple-600 hover:bg-purple-100 hover:border-purple-300 transition-colors" title="Fetch DUPR">🔍</button>
                    <button onClick={() => onDeletePlayer?.(player.id)} aria-label="Delete" className="px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs text-red-500 hover:bg-red-100 hover:border-red-300 transition-colors" title="Delete">🗑️</button>
                  </div>
                </div>

                {/* compact inline edit appears below */}
                {editingId === player.id && (
                  <div className="mt-2 bg-slate-50 p-2 rounded">
                    <div className="flex gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
                      <input value={editDuprId} onChange={e => setEditDuprId(e.target.value)} placeholder="DUPR ID" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                      <input value={editDuprNumericId} onChange={e => setEditDuprNumericId(e.target.value)} placeholder="webNumericID" className="w-24 px-2 py-1 border border-gray-300 rounded text-sm" />
                      <input value={editDuprScore} onChange={e => setEditDuprScore(e.target.value)} placeholder="Rating" className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button onClick={saveEdit} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Save</button>
                      <button onClick={cancelEdit} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
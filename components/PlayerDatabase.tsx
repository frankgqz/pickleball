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
    <section className="bg-white rounded-2xl shadow p-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">🎾 Player Database</h2>
          <div className="text-xs text-gray-500">({players.length})</div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or ID" className="flex-1 md:flex-none px-2 py-1 border border-gray-300 rounded text-xs" />
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="px-2 py-1 border border-gray-300 rounded text-xs">
            <option value="recent">Recent First</option>
            <option value="alpha">A - Z</option>
          </select>
        </div>
      </div>

      {/* Add form compact */}
      <div className="mb-2 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-1.5 items-end text-xs">
        <input className="px-2 py-1 border border-gray-300 rounded" placeholder="Name *" value={name} onChange={e => setName(e.target.value)} />
        <input className="px-2 py-1 border border-gray-300 rounded w-full md:w-20" placeholder="DUPR ID" value={duprId} onChange={e => setDuprId(e.target.value)} />
        <input className="px-2 py-1 border border-gray-300 rounded w-full md:w-20" placeholder="webNumericID" value={duprNumericId} onChange={e => setDuprNumericId(e.target.value)} />
        <input className="px-2 py-1 border border-gray-300 rounded w-full md:w-16" placeholder="Rating" value={duprScore} onChange={e => setDuprScore(e.target.value)} />
        <button className="text-xs text-white bg-green-600 px-3 py-1 rounded" onClick={handleAdd}>+ Add</button>
      </div>
      {validationError && <div className="text-red-500 text-xs mb-2">{validationError}</div>}

      <div style={{ maxHeight: '36vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1.5">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-4 text-xs">No players</div>
        ) : filtered.map(player => {
          const hasDupr = !!player.duprId || !!player.duprNumericId;
          const inPool = inPoolIds.has(player.id);
          const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={player.id} className={`p-1.5 rounded-lg border ${inPool ? 'bg-green-50' : 'bg-white'}`}>
              <div className="flex items-center gap-2">
                <div className="flex-none">
                  {player.imageUrl ? (
                    <img src={player.imageUrl} alt={player.name} className={`w-7 h-7 rounded-full object-cover ${player.isSitting ? 'opacity-50' : ''}`} />
                  ) : (
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] ${hasDupr ? 'bg-gradient-to-br from-green-500 to-green-700 text-white' : 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900'}`} style={{ textTransform: 'uppercase' }}>{initials}</div>
                  )}
                </div>

                {/* single-line compact info */}
                <div className="flex-1 min-w-0 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate">
                      <div className="font-medium truncate">{player.name}</div>
                      <div className="text-[10px] text-gray-500 truncate">{player.duprId || player.duprNumericId || ''}{player.duprScore != null && <span className="ml-1 font-semibold">{player.duprScore}</span>}</div>
                      {fetchFeedback?.playerId === player.id && (<div className={`text-[10px] ${fetchFeedback.success ? 'text-green-600' : 'text-red-500'}`}>{fetchFeedback.message}</div>)}
                    </div>

                    {/* compact actions: + first, then edit/fetch/delete */}
                    <div className="flex-none flex items-center gap-0.5">
                      {inPool ? (
                        <button aria-label="Remove from pool" onClick={() => onRemoveFromPool?.(player.id)} className="w-6 h-6 rounded text-orange-600 bg-white border text-xs">−</button>
                      ) : (
                        <button aria-label="Add to pool" onClick={() => onAddToPool?.(player)} className="w-6 h-6 rounded bg-transparent border border-green-600 text-green-600 text-xs">+</button>
                      )}

                      <button onClick={() => startEditing(player)} aria-label="Edit" className="px-1 py-0.5 bg-white border rounded text-[10px] text-blue-600 hover:bg-blue-50">✏️</button>
                      <button onClick={() => fetchDuprFor(player.id)} aria-label="Fetch DUPR" className="px-1 py-0.5 bg-white border rounded text-[10px] text-purple-600 hover:bg-purple-50">🔍</button>
                      <button onClick={() => onDeletePlayer?.(player.id)} aria-label="Delete" className="px-1 py-0.5 bg-white border rounded text-[10px] text-red-500 hover:bg-red-50">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* compact inline edit appears below (rare) */}
              {editingId === player.id && (
                <div className="mt-1.5 bg-slate-50 p-1.5 rounded">
                  <div className="flex gap-1 flex-wrap">
                    <input value={editName} onChange={e => setEditName(e.target.value)} className="flex-1 px-2 py-0.5 border border-gray-300 rounded text-xs min-w-[80px]" placeholder="Name" />
                    <input value={editDuprId} onChange={e => setEditDuprId(e.target.value)} placeholder="DUPR ID" className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs" />
                    <input value={editDuprNumericId} onChange={e => setEditDuprNumericId(e.target.value)} placeholder="webID" className="w-16 px-1 py-0.5 border border-gray-300 rounded text-xs" />
                    <input value={editDuprScore} onChange={e => setEditDuprScore(e.target.value)} placeholder="Rating" className="w-14 px-1 py-0.5 border border-gray-300 rounded text-xs" />
                  </div>
                  <div className="mt-1 flex gap-1">
                    <button onClick={saveEdit} className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">Save</button>
                    <button onClick={cancelEdit} className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">Cancel</button>
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
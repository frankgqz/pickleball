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
    <section className="bg-white rounded-2xl shadow px-3 pt-1.5 pb-2">
      {/* Header - aligned with EventPool */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-1.5 mb-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">🎾 Player Database</h2>
          <div className="text-xs text-gray-500">({players.length})</div>
        </div>

        <div className="flex items-center gap-1.5">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search..." 
            className="w-36 md:w-44 px-2 h-6 border border-gray-300 rounded text-xs" 
          />
          <select 
            value={sortBy} 
            onChange={e => setSortBy(e.target.value as any)} 
            className="h-6 px-1 border border-gray-300 rounded text-xs"
          >
            <option value="recent">Recent</option>
            <option value="alpha">A-Z</option>
          </select>
        </div>
      </div>

      {/* Add form - single row */}
      <div className="flex flex-wrap gap-1 mb-1 items-end">
        <input 
          className="px-1.5 h-6 border border-gray-300 rounded text-xs flex-1 min-w-[100px]" 
          placeholder="Name *" 
          value={name} 
          onChange={e => setName(e.target.value)} 
        />
        <input 
          className="px-1.5 h-6 border border-gray-300 rounded text-xs w-16" 
          placeholder="DUPR ID" 
          value={duprId} 
          onChange={e => setDuprId(e.target.value)} 
        />
        <input 
          className="px-1.5 h-6 border border-gray-300 rounded text-xs w-16" 
          placeholder="webNumericID" 
          value={duprNumericId} 
          onChange={e => setDuprNumericId(e.target.value)} 
        />
        <input 
          className="px-1.5 h-6 border border-gray-300 rounded text-xs w-12" 
          placeholder="Rating" 
          value={duprScore} 
          onChange={e => setDuprScore(e.target.value)} 
        />
        <button 
          className="h-6 px-2 text-xs text-white bg-green-600 rounded hover:bg-green-700 flex-1 max-w-[60px]" 
          onClick={handleAdd}
        >
          + Add
        </button>
      </div>
      {validationError && <div className="text-red-500 text-[10px] mb-0.5">{validationError}</div>}

      {/* Player list - smaller height to match EventPool */}
      <div style={{ maxHeight: '25vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-0.5">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-3 text-xs">No players</div>
        ) : filtered.map(player => {
          const hasDuprId = !!player.duprId;
          const hasNumericId = !!player.duprNumericId;
          const hasId = hasDuprId || hasNumericId;
          const inPool = inPoolIds.has(player.id);
          const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

          return (
            <div key={player.id} className={`px-1.5 py-0.5 rounded border border-gray-300 flex items-center gap-1.5 ${hasId ? 'bg-white' : 'bg-yellow-50'}`}>
              {/* Avatar */}
              <div className="flex-none">
                {player.imageUrl ? (
                  <img 
                    src={player.imageUrl} 
                    alt={player.name} 
                    className="w-6 h-6 rounded-full object-cover border border-gray-300" 
                  />
                ) : (
                  <div 
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[9px] border border-gray-300 ${hasId ? 'bg-white text-gray-800' : 'bg-yellow-200 text-yellow-800'}`} 
                    style={{ textTransform: 'uppercase' }}
                  >
                    {initials}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-xs truncate">{player.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">
                      {player.duprId || player.duprNumericId || ''}
                      {player.duprScore != null && <span className="ml-1 font-semibold">{player.duprScore}</span>}
                    </div>
                    {fetchFeedback?.playerId === player.id && (
                      <div className={`text-[10px] ${fetchFeedback.success ? 'text-green-600' : 'text-red-500'}`}>
                        {fetchFeedback.message}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex-none flex items-center gap-0.5">
                    {inPool ? (
                      <button 
                        aria-label="Remove from pool" 
                        onClick={() => onRemoveFromPool?.(player.id)} 
                        className="w-5 h-5 rounded bg-gray-200 text-gray-500 border border-gray-300 hover:bg-red-100 hover:text-red-600 transition-colors text-[10px]"
                      >
                        −
                      </button>
                    ) : (
                      <button 
                        aria-label="Add to pool" 
                        onClick={() => onAddToPool?.(player)} 
                        className="w-5 h-5 rounded bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-colors text-[10px]"
                      >
                        +
                      </button>
                    )}

                    <button 
                      onClick={() => startEditing(player)} 
                      className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] text-blue-600 hover:bg-blue-100 transition-colors" 
                    >
                      ✏️
                    </button>
                    <button 
                      onClick={() => fetchDuprFor(player.id)} 
                      className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] text-purple-600 hover:bg-purple-100 transition-colors" 
                    >
                      🔍
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Delete ${player.name}?`)) {
                          onDeletePlayer?.(player.id);
                        }
                      }} 
                      className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[9px] text-red-500 hover:bg-red-100 transition-colors" 
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
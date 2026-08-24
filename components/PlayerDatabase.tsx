"use client";

import React, { useMemo, useState } from "react";
import { Player } from "@/components/Types";

interface Props {
  players: Player[];
  eventPool?: Player[];
  onAddPlayer?: (formData: FormData) => Promise<any> | void;
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
    const formData = new FormData();
    formData.append("name", trimmed);
    if (hasDuprId) formData.append("duprId", duprId.trim());
    if (hasNum) formData.append("duprNumericId", duprNumericId.trim());
    if (hasScore) formData.append("manualDuprScore", duprScore);
    try {
      const result = await onAddPlayer?.(formData);
      // Also add to pool automatically
      if (result?.player) {
        onAddToPool?.(result.player);
      }
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
    // Show manualDuprScore if available, otherwise duprScore (API fetched)
    const scoreToShow = p.manualDuprScore ?? p.duprScore;
    setEditDuprScore(scoreToShow != null ? String(scoreToShow) : "");
  };

  const cancelEdit = () => { 
    setEditingId(null); 
    setEditName(""); 
    setEditDuprId(""); 
    setEditDuprNumericId(""); 
    setEditDuprScore(""); 
  };

  const saveEdit = async () => {
    if (!editingId) return;
    console.log("saveEdit called:", {
      id: editingId,
      name: editName.trim(),
      duprId: editDuprId.trim() || null,
      duprNumericId: editDuprNumericId.trim() || null,
      manualDuprScore: editDuprScore ? parseFloat(editDuprScore) : null
    });
    try {
      const result = await onUpdatePlayer?.(editingId, { 
        name: editName.trim(), 
        duprId: editDuprId.trim() || null, 
        duprNumericId: editDuprNumericId.trim() || null, 
        manualDuprScore: editDuprScore ? parseFloat(editDuprScore) : null
      });
      console.log("saveEdit result:", result);
      cancelEdit();
    } catch (e) { 
      console.error(e); 
    }
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2 pt-1">
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
      <div className="flex flex-wrap gap-2 mb-1.5 items-end">
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
          className="px-4 py-1.5 text-sm text-white bg-green-600 rounded hover:bg-green-700 font-bold ml-[-10px]" 
          onClick={handleAdd}
        >
          + Add
        </button>
      </div>
      {validationError && <div className="text-red-500 text-xs mb-1.5">{validationError}</div>}

      {/* Player list */}
      <div style={{ maxHeight: '25vh', overflowY: 'auto', paddingRight: 4 }} className="space-y-1 mt-2">
        {filtered.length === 0 ? (
          <div className="text-center text-gray-400 py-4 text-sm">No players</div>
        ) : filtered.map(player => {
          const hasDuprId = !!player.duprId;
          const hasNumericId = !!player.duprNumericId;
          const hasId = hasDuprId || hasNumericId;
          const inPool = inPoolIds.has(player.id);
          const initials = player.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const isEditing = editingId === player.id;

          return (
            <div key={player.id} className={`px-2 py-1 rounded-lg border border-gray-300 ${hasId ? 'bg-white' : 'bg-yellow-50'}`}>
              {isEditing ? (
                /* Inline edit form */
                <div className="space-y-1.5 py-1">
                  <div className="flex flex-wrap gap-1.5 items-end">
                    <input 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)} 
                      className="px-2 py-1 border border-gray-300 rounded text-xs flex-1 min-w-[100px]" 
                      placeholder="Name" 
                    />
                    <input 
                      value={editDuprId} 
                      onChange={e => setEditDuprId(e.target.value)} 
                      placeholder="DUPR ID" 
                      className="px-2 py-1 border border-gray-300 rounded text-xs w-18" 
                    />
                    <input 
                      value={editDuprNumericId} 
                      onChange={e => setEditDuprNumericId(e.target.value)} 
                      placeholder="webID" 
                      className="px-2 py-1 border border-gray-300 rounded text-xs w-18" 
                    />
                    <input 
                      value={editDuprScore} 
                      onChange={e => setEditDuprScore(e.target.value)} 
                      placeholder="Rating" 
                      className="px-2 py-1 border border-gray-300 rounded text-xs w-14" 
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={saveEdit} 
                      className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 font-medium"
                    >
                      Save
                    </button>
                    <button 
                      onClick={cancelEdit} 
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal display */
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div className="flex-none">
                    {player.imageUrl ? (
                      <img 
                        src={player.imageUrl} 
                        alt={player.name} 
                        className="w-7 h-7 rounded-full object-cover border border-gray-300" 
                      />
                    ) : (
                      <div 
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] border border-gray-300 ${hasId ? 'bg-white text-gray-800' : 'bg-yellow-200 text-yellow-800'}`} 
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
                        <div className="font-medium text-xs truncate">{player.name}</div>
                        <div className="text-[10px] text-gray-500 truncate" title={player.lastRefreshed ? `Last refreshed: ${new Date(player.lastRefreshed).toLocaleDateString()}` : undefined}>
                          {player.duprId || player.duprNumericId || ''}
                          {(player.duprScore != null || player.manualDuprScore != null) && (
                            <span className="ml-1 font-semibold">
                              {player.duprScore != null 
                                ? player.duprScore.toFixed(3)        // API fetched = 3 decimals
                                : player.manualDuprScore!.toFixed(1)  // Manual = 1 decimal
                              }
                            </span>
                          )}
                        </div>
                        {fetchFeedback?.playerId === player.id && (
                          <div className={`text-[10px] ${fetchFeedback.success ? 'text-green-600' : 'text-red-500'}`}>
                            {fetchFeedback.message}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5">
                        {inPool ? (
                          <button 
                            aria-label="Remove from pool" 
                            onClick={() => onRemoveFromPool?.(player.id)} 
                            className="w-7 h-7 rounded bg-white text-orange-500 border border-orange-300 hover:bg-orange-100 transition-colors text-sm font-bold"
                          >
                            −
                          </button>
                        ) : (
                          <button 
                            aria-label="Add to pool" 
                            onClick={() => onAddToPool?.(player)} 
                            className="w-7 h-7 rounded bg-green-600 text-white border border-green-600 hover:bg-green-700 transition-colors text-base font-bold ml-2"
                          >
                            +
                          </button>
                        )}

                        <button 
                          onClick={() => startEditing(player)} 
                          className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[9px] text-blue-600 hover:bg-blue-100 hover:border-blue-300 transition-colors" 
                        >
                          ✏️
                        </button>
                        {/* Search button - highlighted if has numericID but no duprId (needs lookup) */}
                        <button 
                          onClick={() => fetchDuprFor(player.id)} 
                          title={player.lastRefreshed ? `DUPR last fetched: ${new Date(player.lastRefreshed).toLocaleDateString()}` : "Fetch DUPR rating"}
                          className={`px-1.5 py-0.5 rounded text-[9px] transition-colors ${
                            hasNumericId && player.duprScore == null
                              ? "bg-purple-200 border border-purple-400 text-purple-700 hover:bg-purple-300 hover:border-purple-500" 
                              : "bg-white border border-gray-300 text-purple-600 hover:bg-purple-100 hover:border-purple-300"
                          }`}
                        >
                          🔍
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm(`Delete ${player.name}?`)) {
                              onDeletePlayer?.(player.id);
                            }
                          }} 
                          className="px-1.5 py-0.5 bg-white border border-gray-300 rounded text-[9px] text-red-500 hover:bg-red-100 hover:border-red-300 transition-colors" 
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
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
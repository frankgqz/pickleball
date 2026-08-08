"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "./actions";

// ==========================================
// === TYPES ===
// ==========================================

interface Player {
  id: string;
  name: string;
  duprId: string | null;
  duprNumericId: string | null;
  duprScore: number | null;
  isSitting?: boolean;
}

interface StandingsEntry {
  id: string;
  name: string;
  duprId: string | null;
  duprScore: number | null;
  baseOrder: number;       // Order# based on DUPR ranking (highest DUPR = 1)
  adjustedOrder: number;   // baseOrder adjusted by wins/losses (ranking for pairings)
  byeValue: number;
  byeCount: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

interface TournamentConfig {
  format: "STANDARD" | "FIXED_PARTNER" | "POOL_PLAY";
  orderGap: number;
  padding: number;
  winLossMagnitude: number;
  courtBonus: number;
  byeTopProtection: number;
  byeBonusTop: number;
  byeIncrement: number;
  sitProtection: number;
  lateJoinBonus: number;
  courts: number;
  teamsPerPool: number;
  finalsFormat: "top2" | "top4" | "all";
}

// ==========================================
// === LOGIC ===
// ==========================================

export default function Home() {
  // --- State Variables ---
  const [players, setPlayers] = useState<Player[]>([]);
  const [eventPool, setEventPool] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [sortColumn, setSortColumn] = useState<keyof StandingsEntry>("orderNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Add player form state
  const [name, setName] = useState("");
  const [duprId, setDuprId] = useState("");
  const [duprNumericId, setDuprNumericId] = useState("");
  const [duprScore, setDuprScore] = useState("");

  // Edit player state
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuprId, setEditDuprId] = useState("");
  const [editDuprNumericId, setEditDuprNumericId] = useState("");
  const [editDuprScore, setEditDuprScore] = useState("");

  // Config state
  const [config, setConfig] = useState<TournamentConfig>({
    format: "STANDARD",
    orderGap: 0.25,
    padding: 1,
    winLossMagnitude: 1,
    courtBonus: 0.5,
    byeTopProtection: 8,
    byeBonusTop: 0.5,
    byeIncrement: 1,
    sitProtection: 0.5,
    lateJoinBonus: 0.75,
    courts: 2,
    teamsPerPool: 4,
    finalsFormat: "top2",
  });

  const [submitting, setSubmitting] = useState(false);

  // --- Config Helper ---
  const updateConfig = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  // --- Player Functions ---
  useEffect(() => { loadPlayers(); }, []);

  async function loadPlayers() {
    try {
      const result = await getPlayers();
      if (result.success) {
        setPlayers(result.players || []);
      } else {
        setError(result.error || "Unknown error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    }
    setLoading(false);
  }

  const handleAddPlayer = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    const formData = new FormData();
    formData.append("name", name);
    formData.append("duprId", duprId);
    formData.append("duprNumericId", duprNumericId);
    formData.append("duprScore", duprScore);
    const result = await addPlayer(formData);
    if (result.success && result.player) {
      setPlayers([result.player, ...players]);
      setName(""); setDuprId(""); setDuprNumericId(""); setDuprScore("");
    }
    setSubmitting(false);
  };

  const handleFetchDupr = async (playerId: string) => {
    const result = await fetchDuprRating(playerId);
    if (result.success && result.player) {
      setPlayers(players.map(p => p.id === playerId ? result.player! : p));
      alert(result.message || "Rating updated!");
    } else {
      alert(result.error || "Failed to fetch rating");
    }
  };

  const handleDeletePlayer = async (id: string) => {
    const result = await deletePlayer(id);
    if (result.success) {
      setPlayers(players.filter(p => p.id !== id));
      setEventPool(eventPool.filter(p => p.id !== id));
    }
  };

  const handleUpdatePlayer = async () => {
    if (!editingPlayerId || !editName.trim()) return;
    const formData = new FormData();
    formData.append("name", editName);
    formData.append("duprId", editDuprId);
    formData.append("duprNumericId", editDuprNumericId);
    formData.append("duprScore", editDuprScore);
    const result = await updatePlayer(editingPlayerId, formData);
    if (result.success && result.player) {
      setPlayers(players.map(p => p.id === editingPlayerId ? result.player! : p));
      setEditingPlayerId(null);
    }
  };

  // --- Event Pool Functions ---
  const addToPool = (player: Player) => {
    if (eventPool.find(p => p.id === player.id)) return;
    setEventPool([...eventPool, player]);
    initializeStandings(player);
    // Recalculate baseOrder for all after pool change
    setTimeout(() => recalculateBaseOrders(), 0);
  };

  const initializeStandings = (player: Player) => {
    const existingEntry = standings.find(s => s.id === player.id);
    if (existingEntry) return;

    // Calculate baseOrder based on DUPR rank among current standings
    const playersWithDupr = [...standings, {
      id: player.id, duprScore: player.duprScore,
    } as StandingsEntry].filter(p => p.duprScore !== null);
    
    const sortedByDupr = playersWithDupr.sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0));
    const rank = sortedByDupr.findIndex(p => p.id === player.id);
    const initialOrder = 1 + (rank >= 0 ? rank * config.orderGap : 0);

    const byeValue = generateByeValue(player.duprScore);

    setStandings([...standings, {
      id: player.id, name: player.name, duprId: player.duprId,
      duprScore: player.duprScore, baseOrder: initialOrder,
      adjustedOrder: initialOrder,
      byeValue, byeCount: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
    }]);
  };

  const removeFromPool = (playerId: string) => {
    setEventPool(eventPool.filter(p => p.id !== playerId));
    // Also remove from standings and recalculate
    setStandings(prev => {
      const updated = prev.filter(s => s.id !== playerId);
      // Recalculate baseOrder for remaining players
      const sorted = [...updated].sort((a, b) => {
        if (a.duprScore == null && b.duprScore == null) return 0;
        if (a.duprScore == null) return 1;
        if (b.duprScore == null) return -1;
        return b.duprScore - a.duprScore;
      });
      return sorted.map((entry, index) => ({
        ...entry,
        baseOrder: 1 + (index * config.orderGap),
        adjustedOrder: 1 + (index * config.orderGap),
      }));
    });
  };

  const handleSort = (column: keyof StandingsEntry) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const handleToggleSitting = (playerId: string) => {
    setEventPool(eventPool.map(p =>
      p.id === playerId ? { ...p, isSitting: !p.isSitting } : p
    ));
  };

  const startEditPlayer = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditName(player.name);
    setEditDuprId(player.duprId || "");
    setEditDuprNumericId(player.duprNumericId || "");
    setEditDuprScore(player.duprScore?.toString() || "");
  };

  const cancelEditPlayer = () => {
    setEditingPlayerId(null);
    setEditName(""); setEditDuprId(""); setEditDuprNumericId(""); setEditDuprScore("");
  };

  // --- Recalculation Functions ---
  
  // Recalculate baseOrder for all players based on DUPR (highest = 1)
  const recalculateBaseOrders = () => {
    setStandings(prev => {
      // Sort by DUPR score (highest first), null scores go last
      const sorted = [...prev].sort((a, b) => {
        if (a.duprScore == null && b.duprScore == null) return 0;
        if (a.duprScore == null) return 1;
        if (b.duprScore == null) return -1;
        return b.duprScore - a.duprScore;
      });

      // Assign baseOrder based on position in sorted list
      return sorted.map((entry, index) => ({
        ...entry,
        baseOrder: 1 + (index * config.orderGap),
        adjustedOrder: 1 + (index * config.orderGap), // Reset adjusted too
      }));
    });
  };

  // Regenerate bye values for all players
  const regenerateByes = () => {
    setStandings(prev => prev.map(entry => ({
      ...entry,
      byeValue: generateByeValue(entry.duprScore),
      byeCount: 0,
    })));
  };

  // Helper to generate bye value based on DUPR rank
  const generateByeValue = (duprScore: number | null): number => {
    const rank = standings.filter(s => s.duprScore != null && s.duprScore > (duprScore || 0)).length + 1;
    
    if (rank <= config.byeTopProtection / 2) {
      return (Math.random() * 2 - 1) * config.byeBonusTop;
    } else if (rank <= config.byeTopProtection) {
      return (Math.random() * 2 - 1) * (config.byeBonusTop + 0.25);
    } else {
      return -Math.random();
    }
  };

  // --- Derived Values (Logic) ---
  const sortedStandings = standings.slice().sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    // Handle null/undefined
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;

    // Both are strings
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // Both are numbers
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    // Fallback: convert to string for comparison
    return sortDirection === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  // ==========================================
  // === UI ===
  // ==========================================

  if (error) return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl text-center max-w-md">
        <p className="text-red-600 font-bold mb-2">Database Error</p>
        <p className="text-gray-700 text-sm">{error}</p>
      </div>
    </div>
  );

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
      <p className="text-white text-xl">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 p-4 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🏓 Pickleball Event Manager</h1>
        <p className="text-green-100">Tournament Management & Round Robin Scheduling</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">

        {/* --- Tournament Format --- */}
        <section className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Tournament Format</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(["STANDARD", "FIXED_PARTNER", "POOL_PLAY"] as const).map(fmt => (
              <button key={fmt} onClick={() => updateConfig("format", fmt)}
                className={`p-4 rounded-xl border-2 transition-all ${config.format === fmt ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}>
                <div className="text-2xl mb-2">{fmt === "STANDARD" ? "👑" : fmt === "FIXED_PARTNER" ? "🤝" : "🏊"}</div>
                <div className="font-semibold">{fmt.replace("_", " ")}</div>
              </button>
            ))}
          </div>

          {/* Standard / Fixed Options */}
          {(config.format === "STANDARD" || config.format === "FIXED_PARTNER") && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-700">Order & Match Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Order Gap</label>
                  <input type="number" step="0.25" min="0.25" value={config.orderGap}
                    onChange={(e) => updateConfig("orderGap", parseFloat(e.target.value) || 0.25)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">W/L Mag</label>
                  <input type="number" step="0.25" min="0.25" value={config.winLossMagnitude}
                    onChange={(e) => updateConfig("winLossMagnitude", parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  <p className="text-xs text-gray-400 mt-1">Win/Loss impact</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">± Top/Bottom Court</label>
                  <input type="number" step="0.25" min="0" max="2" value={config.courtBonus}
                    onChange={(e) => updateConfig("courtBonus", parseFloat(e.target.value) || 0.5)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                  <p className="text-xs text-gray-400 mt-1">Top win/Bottom loss reduction</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Order Padding</label>
                  <input type="number" step="0.25" min="0" value={config.padding}
                    onChange={(e) => updateConfig("padding", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Late Join Bonus</label>
                  <input type="number" step="0.25" min="0.25" value={config.lateJoinBonus}
                    onChange={(e) => updateConfig("lateJoinBonus", parseFloat(e.target.value) || 0.75)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>

              <h3 className="font-medium text-gray-700 mt-4">Bye Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
                  <input type="number" min="1" max="16" value={config.courts}
                    onChange={(e) => updateConfig("courts", parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Bye Top Protection</label>
                  <input type="number" min="0" max="20" value={config.byeTopProtection}
                    onChange={(e) => updateConfig("byeTopProtection", parseInt(e.target.value) || 8)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Bye Bonus</label>
                  <input type="number" step="0.25" min="0" max="2" value={config.byeBonusTop}
                    onChange={(e) => updateConfig("byeBonusTop", parseFloat(e.target.value) || 0.5)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Bye Increment</label>
                  <input type="number" step="0.25" min="0.5" value={config.byeIncrement}
                    onChange={(e) => updateConfig("byeIncrement", parseFloat(e.target.value) || 1)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Sit Protection</label>
                  <input type="number" step="0.25" min="0" value={config.sitProtection}
                    onChange={(e) => updateConfig("sitProtection", parseFloat(e.target.value) || 0.5)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}

          {/* Pool Play Options */}
          {config.format === "POOL_PLAY" && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-700">Pool & Finals Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Per Pool</label>
                  <input type="number" min="3" max="8" value={config.teamsPerPool}
                    onChange={(e) => updateConfig("teamsPerPool", parseInt(e.target.value) || 4)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Finals</label>
                  <select value={config.finalsFormat}
                    onChange={(e) => updateConfig("finalsFormat", e.target.value as "top2" | "top4" | "all")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="top2">Top 2 → Semis</option>
                    <option value="top4">Top 4 → Quarters</option>
                    <option value="all">Everyone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
                  <input type="number" min="1" max="10" value={config.courts}
                    onChange={(e) => updateConfig("courts", parseInt(e.target.value) || 2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Order Gap</label>
                  <input type="number" step="0.25" min="0.25" value={config.orderGap}
                    onChange={(e) => updateConfig("orderGap", parseFloat(e.target.value) || 0.25)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* --- Add Player Form --- */}
        <section className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">➕ Add New Player</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="John Smith" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DUPR ID</label>
              <input type="text" value={duprId} onChange={(e) => setDuprId(e.target.value)}
                placeholder="5E64ZL" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numeric ID</label>
              <input type="text" value={duprNumericId} onChange={(e) => setDuprNumericId(e.target.value)}
                placeholder="7438750465" className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <input type="number" step="0.1" min="1" max="6" value={duprScore}
                onChange={(e) => setDuprScore(e.target.value)} placeholder="3.5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleAddPlayer} disabled={submitting || !name.trim()}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400">
              {submitting ? "Adding..." : "Add Player"}
            </button>
          </div>
        </section>

        {/* --- Player Database & Event Pool --- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">📋 Player Database</h2>
              <span className="text-sm text-gray-500">{players.length} players</span>
            </div>
            {players.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No players yet. Add some above!</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {players.map((player) => (
                  <div key={player.id} className="p-3 bg-gray-50 rounded-lg">
                    {editingPlayerId === player.id ? (
                      <div className="space-y-2">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg" />
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" value={editDuprId} onChange={(e) => setEditDuprId(e.target.value)}
                            placeholder="DUPR ID" className="px-3 py-2 border rounded-lg text-sm" />
                          <input type="text" value={editDuprNumericId} onChange={(e) => setEditDuprNumericId(e.target.value)}
                            placeholder="Numeric ID" className="px-3 py-2 border rounded-lg text-sm" />
                          <input type="number" step="0.1" value={editDuprScore} onChange={(e) => setEditDuprScore(e.target.value)}
                            placeholder="Rating" className="px-3 py-2 border rounded-lg text-sm" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleUpdatePlayer}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm">Save</button>
                          <button onClick={cancelEditPlayer}
                            className="flex-1 bg-gray-300 py-2 rounded-lg text-sm">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium">{player.name}</span>
                          {player.duprId && <span className="ml-2 text-sm text-gray-500">DUPR: {player.duprId}</span>}
                          {player.duprNumericId && <span className="ml-2 text-xs text-gray-400">#{player.duprNumericId}</span>}
                          {player.duprScore && <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-sm">{player.duprScore.toFixed(1)}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => addToPool(player)} disabled={eventPool.some(p => p.id === player.id)}
                            className={`w-8 h-8 rounded-full font-bold text-sm ${eventPool.some(p => p.id === player.id) ? "bg-gray-200 text-gray-400" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                            {eventPool.some(p => p.id === player.id) ? "✓" : "+"}
                          </button>
                          <button onClick={() => startEditPlayer(player)} className="text-yellow-600 hover:text-yellow-800 px-2">✏️</button>
                          {player.duprNumericId && <button onClick={() => handleFetchDupr(player.id)} className="text-blue-600 hover:text-blue-800 px-2">🔍</button>}
                          <button onClick={() => handleDeletePlayer(player.id)} className="text-red-500 hover:text-red-700 px-2">🗑️</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🎯 Event Pool</h2>
              <span className="text-sm text-gray-500">{eventPool.length} players</span>
            </div>
            {eventPool.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Add players from the database to start your event!</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {eventPool.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">{index + 1}</span>
                    <span className={`font-medium ${player.isSitting ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{player.name}</span>
                    {player.duprScore && <span className={`px-2 py-0.5 rounded text-sm ${player.isSitting ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'}`}>{player.duprScore.toFixed(1)}</span>}
                    <label className="flex items-center gap-1 ml-auto text-sm cursor-pointer">
                      <input type="checkbox" checked={player.isSitting} onChange={() => handleToggleSitting(player.id)} className="w-4 h-4" />
                      <span className="text-gray-500">sit out</span>
                    </label>
                    <button onClick={() => removeFromPool(player.id)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* --- Standings Table --- */}
        <section className="bg-white rounded-2xl shadow-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-800">📊 Standings</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">{standings.length} players</span>
              <button onClick={regenerateByes}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                🎲 Regenerate Byes
              </button>
            </div>
          </div>
          {standings.length === 0 ? (
            <p className="text-gray-400 text-center py-8">Add players to the event pool to see standings</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    {(["name", "baseOrder", "adjustedOrder", "byeValue", "wins", "losses", "pointsFor", "pointsAgainst", "pointsFor", "byeCount"] as const).map((col, i) => (
                      <th key={col} className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort(col)}>
                        {["Name", "Base", "Adj#", "Bye#", "W", "L", "PF", "PA", "+/-", "Byes"][i]}
                        {sortColumn === col && (sortDirection === "asc" ? " ↑" : " ↓")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStandings.map((entry) => {
                    const winPct = entry.wins + entry.losses > 0 ? ((entry.wins / (entry.wins + entry.losses)) * 100).toFixed(1) : "0.0";
                    const pointDiff = entry.pointsFor - entry.pointsAgainst;
                    return (
                      <tr key={entry.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{entry.name}</div>
                          {entry.duprId && <div className="text-xs text-gray-500">DUPR: {entry.duprId}</div>}
                        </td>
                        <td className="p-2 text-center font-mono">{entry.baseOrder.toFixed(2)}</td>
                        <td className="p-2 text-center font-mono text-blue-600">{entry.adjustedOrder.toFixed(2)}</td>
                        <td className="p-2 text-center font-mono">{entry.byeValue.toFixed(2)}</td>
                        <td className="p-2 text-center">{entry.wins}</td>
                        <td className="p-2 text-center">{entry.losses}</td>
                        <td className="p-2 text-center">{entry.pointsFor}</td>
                        <td className="p-2 text-center">{entry.pointsAgainst}</td>
                        <td className={`p-2 text-center font-mono ${pointDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pointDiff >= 0 ? "+" : ""}{pointDiff}
                        </td>
                        <td className="p-2 text-center">{entry.byeCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* --- Start Round Button --- */}
        {eventPool.filter(p => !p.isSitting).length >= 4 && (
          <section className="text-center">
            <button className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-12 py-4 rounded-xl text-xl shadow-lg hover:scale-105">
              🎾 Start Round ({eventPool.filter(p => !p.isSitting).length} active)
            </button>
          </section>
        )}
        {eventPool.length > 0 && eventPool.filter(p => !p.isSitting).length < 4 && (
          <p className="text-center text-white text-lg">Need at least 4 active players to start a round.</p>
        )}

      </div>
    </div>
  );
}
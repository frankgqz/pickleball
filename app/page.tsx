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
  
  // Bye calculation
  byeBase: number;         // Base bye value from DUPR rank (set at event start, regeneratable)
  byeMod: number;          // Fractional: late join bonus; Whole: byes earned - sit outs
  byeCount: number;        // Pure count of byes earned in rounds (for display)
  
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

// Match types
type MatchFormat = "PICK_PARTNER" | "FIXED_14V23";

interface Match {
  id: string;
  court: number;
  team1: string[]; // Player IDs
  team2: string[];
  team1Score?: number;
  team2Score?: number;
  bye: boolean;
  byePlayerId?: string; // Who gets the bye
}

interface RoundState {
  active: boolean;
  format: MatchFormat;
  matches: Match[];
  submitted: boolean;
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
  const [sortColumn, setSortColumn] = useState<keyof StandingsEntry>("baseOrder");
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

  // Player database search/sort
  const [playerSearch, setPlayerSearch] = useState("");
  const [playerSortBy, setPlayerSortBy] = useState<"date" | "alpha">("date");

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
    courts: 4, // Default to 4 courts
    teamsPerPool: 4,
    finalsFormat: "top2",
  });

  // Track if first round has been completed (for late join bonus)
  const [hasCompletedFirstRound, setHasCompletedFirstRound] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // --- Round State ---
  const [roundState, setRoundState] = useState<RoundState>({
    active: false,
    format: "PICK_PARTNER",
    matches: [],
    submitted: false,
  });

  // --- Match Generation ---
  
  // Generate matches for the current round
  const generateMatches = (format: MatchFormat) => {
    const activePlayers = eventPool.filter(p => !p.isSitting);
    
    // Sort standings by adjustedOrder
    const sortedStandings = [...standings].sort((a, b) => a.adjustedOrder - b.adjustedOrder);
    const activeIds = sortedStandings.filter(s => activePlayers.some(p => p.id === s.id)).map(s => s.id);
    
    // Calculate byes needed: active_players - (num_courts * 4)
    const playersPerCourt = 4;
    const maxPlayersForCourts = config.courts * playersPerCourt;
    const byeCount = Math.max(0, activeIds.length - maxPlayersForCourts);
    
    // Find who gets byes: lowest total bye scores get the byes
    let byePlayerIds: string[] = [];
    if (byeCount > 0) {
      // Sort by total bye (byeBase + byeMod) - lowest first
      const activeStandings = sortedStandings.filter(s => activeIds.includes(s.id));
      const sortedByBye = activeStandings.sort((a, b) => (a.byeBase + a.byeMod) - (b.byeBase + b.byeMod));
      byePlayerIds = sortedByBye.slice(0, byeCount).map(s => s.id);
    }
    
    // Create matches
    const matches: Match[] = [];
    let courtNum = 1;
    
    for (let i = 0; i < activeIds.length; i += playersPerCourt) {
      // Get next group of 4 players for this court
      const courtPlayers = activeIds.slice(i, i + playersPerCourt).filter(id => !byePlayerIds.includes(id));
      
      if (courtPlayers.length === playersPerCourt) {
        // Full court of 4
        if (format === "PICK_PARTNER") {
          matches.push({
            id: `match-${courtNum}`,
            court: courtNum,
            team1: [courtPlayers[0]], // Picker
            team2: courtPlayers.slice(1), // Remaining 3
            bye: false,
          });
        } else {
          // FIXED_14V23
          matches.push({
            id: `match-${courtNum}`,
            court: courtNum,
            team1: [courtPlayers[0], courtPlayers[3]], // 1v4
            team2: [courtPlayers[1], courtPlayers[2]], // 2v3
            bye: false,
          });
        }
        courtNum++;
      } else if (courtPlayers.length > 0) {
        // Partial court - assign remaining to next available or create bye
        if (courtPlayers.length >= 2) {
          // Can still play with reduced numbers
          if (format === "PICK_PARTNER") {
            matches.push({
              id: `match-${courtNum}`,
              court: courtNum,
              team1: [courtPlayers[0]],
              team2: courtPlayers.slice(1),
              bye: false,
            });
          } else {
            matches.push({
              id: `match-${courtNum}`,
              court: courtNum,
              team1: [courtPlayers[0]],
              team2: courtPlayers.slice(1),
              bye: false,
            });
          }
          courtNum++;
        }
      }
    }
    
    // Add bye matches
    byePlayerIds.forEach((pid, idx) => {
      matches.push({
        id: `bye-${idx + 1}`,
        court: 0, // Bye doesn't have a court
        team1: [pid],
        team2: [],
        bye: true,
        byePlayerId: pid,
      });
    });

    setRoundState({
      active: true,
      format,
      matches,
      submitted: false,
    });
  };

  // Update match score (for which team)
  const updateMatchScore = (matchId: string, score: number, team: 'team1' | 'team2') => {
    setRoundState(prev => ({
      ...prev,
      matches: prev.matches.map(m =>
        m.id === matchId ? { ...m, [team + 'Score']: score } : m
      ),
    }));
  };

  // Update pick partner selection (player 1 picks partner)
  const updatePickPartner = (matchId: string, partnerId: string) => {
    setRoundState(prev => ({
      ...prev,
      matches: prev.matches.map(m => {
        if (m.id !== matchId) return m;
        
        // Find the player who was previously selected as partner (if any)
        const previousPartnerId = m.team1.length > 1 ? m.team1[1] : null;
        
        // If selecting the same partner, do nothing
        if (previousPartnerId === partnerId) return m;
        
        // Build new teams
        const allPlayers = [...m.team1, ...m.team2];
        const pickerId = m.team1[0];
        
        // New team1: picker + new partner
        const newTeam1 = [pickerId, partnerId];
        // New team2: everyone else
        const newTeam2 = allPlayers.filter(id => id !== pickerId && id !== partnerId);
        
        return { ...m, team1: newTeam1, team2: newTeam2 };
      }),
    }));
  };

  // Swap player between teams
  const swapPlayerTeam = (matchId: string, playerId: string) => {
    setRoundState(prev => ({
      ...prev,
      matches: prev.matches.map(m => {
        if (m.id !== matchId) return m;
        
        const isOnTeam1 = m.team1.includes(playerId);
        
        if (isOnTeam1 && m.team1.length <= 2) return m; // Can't remove if only 1-2 players
        
        const newTeam1 = isOnTeam1 
          ? m.team1.filter(id => id !== playerId)
          : [...m.team1, playerId];
        const newTeam2 = isOnTeam1 
          ? [...m.team2, playerId]
          : m.team2.filter(id => id !== playerId);
        
        return { ...m, team1: newTeam1, team2: newTeam2 };
      }),
    }));
  };

  // Submit round results
  const submitRoundResults = () => {
    // Update standings with results
    setStandings(prev => prev.map(entry => {
      const match = roundState.matches.find(m => m.team1.includes(entry.id) || m.team2.includes(entry.id));
      
      if (!match) return entry;
      
      if (match.bye && match.byePlayerId === entry.id) {
        // Player got a bye - increment byeMod and byeCount
        return { 
          ...entry, 
          byeMod: entry.byeMod + 1, // Increment bye score by 1
          byeCount: entry.byeCount + 1 
        };
      }

      // Player played a match
      const isOnTeam1 = match.team1.includes(entry.id);
      const myScore = isOnTeam1 ? (match.team1Score || 0) : (match.team2Score || 0);
      const opponentScore = isOnTeam1 ? (match.team2Score || 0) : (match.team1Score || 0);
      const won = myScore > opponentScore && myScore > 0;
      const playedMatch = myScore > 0 || opponentScore > 0;

      return {
        ...entry,
        wins: entry.wins + (won ? 1 : 0),
        losses: entry.losses + (playedMatch && !won ? 1 : 0),
        pointsFor: entry.pointsFor + myScore,
        pointsAgainst: entry.pointsAgainst + opponentScore,
      };
    }));

    // Recalculate adjusted order based on new standings
    recalculateAdjustedOrder();

    // Mark first round as completed (for late join bonus)
    setHasCompletedFirstRound(true);

    setRoundState(prev => ({ ...prev, submitted: true }));
  };

  // Recalculate adjusted order based on performance
  const recalculateAdjustedOrder = () => {
    setStandings(prev => {
      return prev.map(entry => {
        // Simple: baseOrder adjusted by win percentage
        const gamesPlayed = entry.wins + entry.losses;
        const winPct = gamesPlayed > 0 ? entry.wins / gamesPlayed : 0.5;
        // Lower adjustedOrder is better, so subtract win bonus
        const adjustment = winPct * config.winLossMagnitude;
        return {
          ...entry,
          adjustedOrder: entry.baseOrder - adjustment,
        };
      });
    });
  };

  // End round
  const endRound = () => {
    setRoundState({
      active: false,
      format: roundState.format,
      matches: [],
      submitted: false,
    });
  };

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

    const byeBase = generateByeBase(player.duprScore);
    // Late joiners only get bonus if first round has been completed
    const byeMod = hasCompletedFirstRound ? config.lateJoinBonus : 0;

    setStandings([...standings, {
      id: player.id, name: player.name, duprId: player.duprId,
      duprScore: player.duprScore, baseOrder: initialOrder,
      adjustedOrder: initialOrder,
      byeBase, byeMod, byeCount: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
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

      // Assign baseOrder and byeBase based on position in sorted list
      return sorted.map((entry, index) => ({
        ...entry,
        baseOrder: 1 + (index * config.orderGap),
        adjustedOrder: 1 + (index * config.orderGap),
        byeBase: generateByeBase(entry.duprScore),
        byeCount: 0, // Reset bye count on pool change
      }));
    });
  };

  // Regenerate bye base for all players (does NOT reset byeMod which has late join bonus)
  const regenerateByes = () => {
    setStandings(prev => {
      const sorted = [...prev].sort((a, b) => {
        if (a.duprScore == null && b.duprScore == null) return 0;
        if (a.duprScore == null) return 1;
        if (b.duprScore == null) return -1;
        return b.duprScore - a.duprScore;
      });

      return sorted.map(entry => ({
        ...entry,
        byeBase: generateByeBase(entry.duprScore),
        byeCount: 0, // Reset bye count
      }));
    });
  };

  // Helper to generate bye base based on DUPR rank
  const generateByeBase = (duprScore: number | null): number => {
    // Rank among players with DUPR scores (1 = highest)
    const allWithDupr = standings.filter(s => s.duprScore != null).sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0));
    const rank = allWithDupr.findIndex(s => s.duprScore === duprScore && duprScore != null) + 1;
    
    const topHalf = Math.floor(config.byeTopProtection / 2);
    
    // Everyone gets a base roll from -1 to 0
    const baseRoll = -Math.random();
    
    if (rank > 0 && rank <= topHalf) {
      // Top players: (-1 to 0) + byeBonusTop
      return baseRoll + config.byeBonusTop;
    } else if (rank > topHalf && rank <= config.byeTopProtection) {
      // Middle players: (-1 to 0) + byeBonusTop/2
      return baseRoll + (config.byeBonusTop / 2);
    } else {
      // Everyone else: just the -1 to 0 roll
      return baseRoll;
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

  // Filtered and sorted player list
  const filteredPlayers = players
    .filter(p => 
      p.name.toLowerCase().includes(playerSearch.toLowerCase()) ||
      (p.duprId && p.duprId.toLowerCase().includes(playerSearch.toLowerCase()))
    )
    .sort((a, b) => {
      if (playerSortBy === "alpha") {
        return a.name.localeCompare(b.name);
      }
      // Default: by date added (most recent first) - since we add to front, reverse the array
      return 0; // Keep original order (newest first)
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
              <span className="text-sm text-gray-500">{filteredPlayers.length} / {players.length}</span>
            </div>
            
            {/* Search and Sort Controls */}
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Search by name or DUPR..."
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <select
                value={playerSortBy}
                onChange={(e) => setPlayerSortBy(e.target.value as "date" | "alpha")}
                className="px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="date">Recent First</option>
                <option value="alpha">A-Z</option>
              </select>
            </div>

            {filteredPlayers.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                {playerSearch ? "No players match your search" : "No players yet. Add some above!"}
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredPlayers.map((player) => (
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
              <span className="text-sm text-gray-500">{eventPool.filter(p => !p.isSitting).length} active / {eventPool.length} total</span>
            </div>
            {eventPool.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Add players from the database to start your event!</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {[...eventPool].reverse().map((player) => (
                  <div key={player.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    player.isSitting 
                      ? 'bg-orange-50 border-orange-200' 
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                      player.isSitting ? 'bg-orange-200 text-orange-700' : 'bg-green-600 text-white'
                    }`}>
                      {player.isSitting ? '💤' : '🎾'}
                    </span>
                    <span className={`font-medium ${player.isSitting ? 'text-gray-400' : 'text-gray-800'}`}>{player.name}</span>
                    {player.duprScore && (
                      <span className={`px-2 py-0.5 rounded text-sm ${
                        player.isSitting ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'
                      }`}>
                        {player.duprScore.toFixed(1)}
                      </span>
                    )}
                    <label className="flex items-center gap-1 ml-auto text-sm cursor-pointer">
                      <input type="checkbox" checked={player.isSitting} onChange={() => handleToggleSitting(player.id)} className="w-4 h-4" />
                      <span className={player.isSitting ? "text-orange-500" : "text-gray-500"}>sit out</span>
                    </label>
                    <button onClick={() => removeFromPool(player.id)} className="text-red-500 hover:text-red-700">✕</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* --- Round / Courts UI (above standings) --- */}
        {roundState.active ? (
          <section className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-800">🎾 Active Round</h2>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-sm ${roundState.format === "PICK_PARTNER" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                  {roundState.format === "PICK_PARTNER" ? "Pick Partner" : "1v4 vs 2v3"}
                </span>
                {!roundState.submitted && (
                  <button onClick={endRound} className="text-red-600 hover:text-red-800 px-3 py-1">
                    Cancel Round
                  </button>
                )}
              </div>
            </div>

            {/* Match Format Selection (if not yet started) */}
            {!roundState.submitted && roundState.matches.length > 0 && roundState.matches.every(m => m.team1Score === undefined && m.team2Score === undefined) && (
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => {
                    setRoundState(prev => ({ ...prev, format: "PICK_PARTNER" }));
                    generateMatches("PICK_PARTNER");
                  }}
                  className={`px-4 py-2 rounded-lg border-2 ${roundState.format === "PICK_PARTNER" ? "border-purple-500 bg-purple-50" : "border-gray-300"}`}
                >
                  🤝 Pick Partner (You choose teammates)
                </button>
                <button
                  onClick={() => {
                    setRoundState(prev => ({ ...prev, format: "FIXED_14V23" }));
                    generateMatches("FIXED_14V23");
                  }}
                  className={`px-4 py-2 rounded-lg border-2 ${roundState.format === "FIXED_14V23" ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
                >
                  ⚔️ 1v4 vs 2v3 (Auto-pair by order)
                </button>
                <button disabled className="px-4 py-2 rounded-lg border-2 border-gray-200 text-gray-400 opacity-50">
                  🔀 Shuffle (Less repeat partners)
                </button>
              </div>
            )}

            {/* Court Layout - only show non-bye matches */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {roundState.matches.filter(m => !m.bye).map((match) => {
                const team1Players = match.team1.map(id => eventPool.find(p => p.id === id)).filter(Boolean);
                const team2Players = match.team2.map(id => eventPool.find(p => p.id === id)).filter(Boolean);

                return (
                  <div key={match.id} className="rounded-xl border-2 p-4 border-green-200 bg-green-50">
                    {/* Court Header */}
                    <div className="flex justify-between items-center mb-4">
                      <span className="font-bold text-lg">Court {match.court}</span>
                      <input
                        type="number"
                        placeholder="Score"
                        className="w-16 px-2 py-1 border rounded text-center"
                        value={match.team1Score ?? ""}
                        onChange={(e) => updateMatchScore(match.id, parseInt(e.target.value) || 0, 'team1')}
                      />
                    </div>

                    {roundState.format === "PICK_PARTNER" ? (
                      /* Pick Partner Format - Player 1 picks partner, remaining 2 auto-team */
                      <div className="space-y-3">
                        {/* All 4 players in the group */}
                        <div className="grid grid-cols-2 gap-2">
                          {[...team1Players, ...team2Players].map((p) => {
                            const isOnTeam1 = team1Players.some(tp => tp?.id === p!.id);
                            return (
                              <div 
                                key={p!.id} 
                                className={`rounded-lg p-2 border-2 cursor-pointer transition-all ${
                                  isOnTeam1 
                                    ? 'bg-purple-100 border-purple-400' 
                                    : 'bg-green-100 border-green-400'
                                }`}
                                onClick={() => swapPlayerTeam(match.id, p!.id)}
                              >
                                <p className="font-medium text-sm">{p!.name}</p>
                                {p!.duprScore && (
                                  <p className="text-xs text-gray-500">{p!.duprScore.toFixed(1)}</p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Team colored score boxes at bottom */}
                        <div className="flex items-center justify-center gap-4 pt-3">
                          <div className="text-center">
                            <p className="text-xs text-purple-600 mb-1">T1 Score</p>
                            <input
                              type="number"
                              placeholder="11"
                              className="w-16 px-3 py-2 border-2 border-purple-400 rounded-lg text-center text-lg bg-purple-50"
                              value={match.team1Score ?? ""}
                              onChange={(e) => updateMatchScore(match.id, parseInt(e.target.value) || 0, 'team1')}
                            />
                          </div>
                          <span className="text-2xl font-bold text-gray-400">vs</span>
                          <div className="text-center">
                            <p className="text-xs text-green-600 mb-1">T2 Score</p>
                            <input
                              type="number"
                              placeholder="11"
                              className="w-16 px-3 py-2 border-2 border-green-400 rounded-lg text-center text-lg bg-green-50"
                              value={match.team2Score ?? ""}
                              onChange={(e) => updateMatchScore(match.id, parseInt(e.target.value) || 0, 'team2')}
                            />
                          </div>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-2">Tap players to swap teams</p>
                      </div>
                    ) : (
                      /* 1v4 vs 2v3 Format */
                      <div className="flex items-center justify-between">
                        {/* Team 1: 1v4 */}
                        <div className="flex-1 space-y-2">
                          {match.team1.map((id) => {
                            const p = eventPool.find(ep => ep.id === id);
                            return (
                              <div key={id} className="bg-white rounded-lg p-2 border border-blue-200">
                                <p className="font-medium text-sm">{p?.name}</p>
                                {p?.duprScore && (
                                  <p className="text-xs text-gray-500">{p.duprScore.toFixed(1)}</p>
                                )}
                              </div>
                            );
                          })}
                          <div className="text-center py-2 bg-blue-100 rounded-lg">
                            <p className="text-sm font-bold text-blue-700">1v4</p>
                          </div>
                        </div>

{/* Single score input */}
                        <div className="flex flex-col items-center px-4">
                          <span className="text-gray-400 text-sm mb-2">Score</span>
                          <input
                            type="number"
                            placeholder="11"
                            className="w-16 px-3 py-2 border-2 border-gray-300 rounded-lg text-center text-lg"
                            value={match.team1Score ?? ""}
                            onChange={(e) => updateMatchScore(match.id, parseInt(e.target.value) || 0, 'team1')}
                          />
                        </div>

                        {/* Team 2: 2v3 */}
                        <div className="flex-1 space-y-2">
                          {match.team2.map((id) => {
                            const p = eventPool.find(ep => ep.id === id);
                            return (
                              <div key={id} className="bg-white rounded-lg p-2 border border-green-200">
                                <p className="font-medium text-sm">{p?.name}</p>
                                {p?.duprScore && (
                                  <p className="text-xs text-gray-500">{p.duprScore.toFixed(1)}</p>
                                )}
                              </div>
                            );
                          })}
                          <div className="text-center py-2 bg-green-100 rounded-lg">
                            <p className="text-sm font-bold text-green-700">2v3</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Submit Results Button */}
            {!roundState.submitted && roundState.matches.some(m => m.team1Score !== undefined || m.team2Score !== undefined) && (
              <div className="mt-6 text-center">
                <button
                  onClick={submitRoundResults}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl text-lg"
                >
                  ✓ Submit Round Results
                </button>
              </div>
            )}

            {/* Bye List - who has byes based on total bye score */}
            {roundState.matches.some(m => m.bye) && (
              <div className="mt-6 bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
                <h3 className="font-bold text-orange-700 mb-3">😴 Byes This Round (Lowest Bye Scores)</h3>
                <div className="flex flex-wrap gap-3">
                  {roundState.matches.filter(m => m.bye && m.byePlayerId).map(match => {
                    const player = eventPool.find(p => p.id === match.byePlayerId);
                    const standingsEntry = standings.find(s => s.id === match.byePlayerId);
                    if (!standingsEntry) return null;
                    const totalBye = standingsEntry.byeBase + standingsEntry.byeMod;
                    const sitOuts = Math.max(0, standingsEntry.byeMod - standingsEntry.byeCount - config.lateJoinBonus);
                    return (
                      <div key={match.id} className="bg-white rounded-lg px-4 py-2 border border-orange-300 flex items-center gap-2">
                        <span className="text-xl">😴</span>
                        <div>
                          <p className="font-medium">{player?.name}</p>
                          <p className="text-xs text-gray-500" title={`Base: ${standingsEntry.byeBase.toFixed(2)} | Byes: +${standingsEntry.byeCount} | Sit Outs: +${sitOuts.toFixed(2)} | Late Join: +${config.lateJoinBonus.toFixed(2)}`}>
                            Total: {totalBye.toFixed(2)} ({standingsEntry.byeBase >= 0 ? '+' : ''}{standingsEntry.byeBase.toFixed(2)} base)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {roundState.submitted && (
              <div className="mt-6 text-center">
                <p className="text-green-600 font-bold mb-4">✅ Round completed!</p>
                <button onClick={endRound} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl">
                  Start New Round
                </button>
              </div>
            )}
          </section>
        ) : eventPool.filter(p => !p.isSitting).length >= 4 ? (
          <section className="text-center">
            <h3 className="text-white text-lg mb-4">Ready to start a round?</h3>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => generateMatches("PICK_PARTNER")}
                className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-lg hover:scale-105"
              >
                🤝 Pick Partner Format
              </button>
              <button
                onClick={() => generateMatches("FIXED_14V23")}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-lg hover:scale-105"
              >
                ⚔️ 1v4 vs 2v3 Format
              </button>
            </div>
            <p className="text-green-200 text-sm mt-3">{eventPool.filter(p => !p.isSitting).length} active players ready</p>
          </section>
        ) : eventPool.length > 0 ? (
          <p className="text-center text-white text-lg">Need at least 4 active players to start a round.</p>
        ) : null}

        {/* --- Standings Table (below courts) --- */}
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
                    <th className="p-2 text-left">Name</th>
                    <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("adjustedOrder")}>
                      Order# {sortColumn === "adjustedOrder" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("wins")}>
                      W {sortColumn === "wins" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("losses")}>
                      L {sortColumn === "losses" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("pointsFor")}>
                      PF {sortColumn === "pointsFor" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("pointsAgainst")}>
                      PA {sortColumn === "pointsAgainst" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="p-2 text-center">+/-</th>
                    <th className="p-2 text-center">Pts%</th>
                    <th className="p-2 text-center">Bye</th>
                    <th className="p-2 text-center">Byes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStandings.map((entry) => {
                    const pointDiff = entry.pointsFor - entry.pointsAgainst;
                    const totalBye = entry.byeBase + entry.byeMod;
                    const ptsPct = entry.pointsFor + entry.pointsAgainst > 0
                      ? ((entry.pointsFor / (entry.pointsFor + entry.pointsAgainst)) * 100).toFixed(0)
                      : "0";
                    return (
                      <tr key={entry.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">
                          <div className="font-medium">{entry.name}</div>
                          {entry.duprScore && <div className="text-xs text-green-600">{entry.duprScore.toFixed(1)}</div>}
                        </td>
                        <td className="p-2 text-center font-mono text-blue-600">{entry.adjustedOrder.toFixed(2)}</td>
                        <td className="p-2 text-center font-bold text-green-600">{entry.wins}</td>
                        <td className="p-2 text-center font-bold text-red-500">{entry.losses}</td>
                        <td className="p-2 text-center">{entry.pointsFor}</td>
                        <td className="p-2 text-center">{entry.pointsAgainst}</td>
                        <td className={`p-2 text-center font-mono ${pointDiff >= 0 ? "text-green-600" : "text-red-600"}`}>
                          {pointDiff >= 0 ? "+" : ""}{pointDiff}
                        </td>
                        <td className="p-2 text-center">
                          <span className={parseInt(ptsPct) >= 50 ? "text-green-600 font-bold" : "text-gray-600"}>
                            {ptsPct}%
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span 
                            className={`font-mono ${totalBye >= 0 ? "text-blue-600" : "text-orange-600"} cursor-help`}
                            title={`Base: ${entry.byeBase.toFixed(2)} | Byes Earned: +${entry.byeCount} | Sit Outs: +${(entry.byeMod - entry.byeCount - config.lateJoinBonus).toFixed(2)} | Late Join: +${config.lateJoinBonus.toFixed(2)}`}
                          >
                            {totalBye >= 0 ? "+" : ""}{totalBye.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          <span className="text-purple-600 font-bold">{entry.byeCount}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
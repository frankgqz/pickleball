"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "./actions";



{/* === INTERFACE: Player === */}
{/* Defines the structure of a player in our app */}
/* Note: 'isSitting' is UI-only state, not stored in database yet */
interface Player {
  id: string;
  name: string;
  duprId: string | null;         // Letter DUPR ID (e.g., "5E64ZL") for DUPR export
  duprNumericId: string | null;  // Numeric DUPR ID (e.g., "7438750465") for API lookups
  duprScore: number | null;       // Player's DUPR rating (doubles)
  isSitting?: boolean;           // Whether player is sitting out this round (UI state)
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [eventPool, setEventPool] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [duprId, setDuprId] = useState("");
  const [duprNumericId, setDuprNumericId] = useState("");
  const [duprScore, setDuprScore] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDuprId, setEditDuprId] = useState("");
  const [editDuprNumericId, setEditDuprNumericId] = useState("");
  const [editDuprScore, setEditDuprScore] = useState("");

  
  /* These control the tournament format configuration */

  /* Format type: 'STANDARD' = King of Court, 'FIXED_PARTNER' = Fixed pairs, 'POOL_PLAY' = Group stage + finals */
  /* Default is 'STANDARD' for round robin play */
  const [format, setFormat] = useState<string>("STANDARD");
  /* Number of courts available - determines how many matches per round */
  /* Affects bye calculation (e.g., 10 players on 2 courts = 1 bye) */
  const [courtCount, setCourtCount] = useState<number>(2);
  /* Order adjustment per win - winning players get this subtracted from their order# */
  /* e.g., -1 means winning moves up 1 position in rankings */
  const [winAdjustment, setWinAdjustment] = useState<number>(-1);
  /* Order adjustment per loss - losing players get this added to their order# */
  /* e.g., +1 means losing moves down 1 position in rankings */
  const [lossAdjustment, setLossAdjustment] = useState<number>(1);
  /* Court position bonus multiplier - top/bottom courts get extra adjustment */
  /* e.g., 0.5 means top court winners get extra 0.5 boost (total -1.5) */
  /* Default is 0.5 (50% extra on top of base adjustment) */
  const [courtBonusMultiplier, setCourtBonusMultiplier] = useState<number>(0.5);
  /* Starting gap between players - determines spacing in initial order# */
  /* e.g., 0.25 means player 1 is at 1.0, player 2 at 1.25, player 3 at 1.5 */
  const [orderStartGap, setOrderStartGap] = useState<number>(0.25);
  /* Minimum order# - players can't go lower than this (prevents infinite climbing) */
  const [orderMin, setOrderMin] = useState<number>(0);
  /* Maximum order# - players can't go higher than this (prevents infinite falling) */
  const [orderMax, setOrderMax] = useState<number>(10);

  /* ===== POOL PLAY OPTIONS (shown only when format === 'POOL_PLAY') ===== */
  /* Number of teams per pool for group stage */
  /* e.g., 4 teams per pool means 16 players = 4 pools */
  const [teamsPerPool, setTeamsPerPool] = useState<number>(4);
  /* Finals format: how many teams advance from each pool */
  /* Options: 'top2' (top 2 → semis), 'top4' (top 4 → quarters), 'all' (everyone) */
  const [finalsFormat, setFinalsFormat] = useState<string>("top2");

  // Bye-related state variables
  const [byeTopProtection, setByeTopProtection] = useState<number>(8);  // How many top players get better bye values
  const [byeIncrement, setByeIncrement] = useState<number>(1);          // Value added to bye count after a bye
  const [sitPenalty, setSitPenalty] = useState<number>(0.5);            // Value added after sitting out
  const [lateJoinRange, setLateJoinRange] = useState<number>(0.25);     // Bye value range for late joiners


  // Load players from database on mount
  useEffect(() => {
    loadPlayers();
  }, []);

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

  
  /* Configure the tournament format: Standard, Fixed Partner, or Pool Play */
  /* Contains format type selector + format-specific options */

  <section className="bg-white rounded-2xl shadow-xl p-6">
    <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Tournament Format</h2>
    
    {/* Format Type Selector */}
    {/* Three main formats: Standard (King of Court), Fixed Partner, Pool Play */}
    <div className="grid grid-cols-3 gap-4 mb-6">
      
      {/* Standard Format - Win/lose to move up/down courts */}
      <button
        onClick={() => setFormat("STANDARD")}
        className={`p-4 rounded-xl border-2 transition-all ${
          format === "STANDARD"
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-gray-200 hover:border-gray-300 text-gray-600"
        }`}
      >
        <div className="text-2xl mb-2">👑</div>
        <div className="font-semibold">Standard</div>
        <div className="text-xs mt-1">King of Court</div>
      </button>
      
      {/* Fixed Partner Format - Partners stay together */}
      <button
        onClick={() => setFormat("FIXED_PARTNER")}
        className={`p-4 rounded-xl border-2 transition-all ${
          format === "FIXED_PARTNER"
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-gray-200 hover:border-gray-300 text-gray-600"
        }`}
      >
        <div className="text-2xl mb-2">🤝</div>
        <div className="font-semibold">Fixed Partner</div>
        <div className="text-xs mt-1">Stay with partner</div>
      </button>
      
      {/* Pool Play Format - Group stage then finals */}
      <button
        onClick={() => setFormat("POOL_PLAY")}
        className={`p-4 rounded-xl border-2 transition-all ${
          format === "POOL_PLAY"
            ? "border-green-500 bg-green-50 text-green-700"
            : "border-gray-200 hover:border-gray-300 text-gray-600"
        }`}
      >
        <div className="text-2xl mb-2">🏊</div>
        <div className="font-semibold">Pool Play</div>
        <div className="text-xs mt-1">Groups + Finals</div>
      </button>
    </div>
    
    {/* ===== FORMAT-SPECIFIC OPTIONS ===== */}
    {/* Show different options based on selected format */}
    
    {/* Standard/Fixed Partner Options */}
    {(format === "STANDARD" || format === "FIXED_PARTNER") && (
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-medium text-gray-700">Order & Match Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* Number of Courts */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
            <input type="number" min="1" max="10" value={courtCount} onChange={(e) => setCourtCount(parseInt(e.target.value) || 2)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          {/* W/L Magnitude - single option, applies to both win (negative) and loss (positive) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">W/L Mag</label>
            <input type="number" step="0.25" min="0.25" value={Math.abs(winAdjustment)} onChange={(e) => { const v = parseFloat(e.target.value) || 1; setWinAdjustment(-v); setLossAdjustment(v); }} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">Win/Loss impact</p>
          </div>
          {/* Court Bonus Multiplier */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Court ±</label>
            <input type="number" step="0.25" min="0" max="2" value={courtBonusMultiplier} onChange={(e) => setCourtBonusMultiplier(parseFloat(e.target.value) || 0.5)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">Top/Bottom bonus</p>
          </div>
          {/* Order Gap - spacing between players */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Order Gap</label>
            <input type="number" step="0.25" min="0.25" value={orderStartGap} onChange={(e) => setOrderStartGap(parseFloat(e.target.value) || 0.25)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">Player spacing</p>
          </div>
          {/* Order Buffer - determines min/max range */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Order Buffer</label>
            <input type="number" step="0.25" min="0" value={orderMin} onChange={(e) => setOrderMin(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">Low end buffer</p>
          </div>
        </div>
        
        {/* Bye Settings Section */}
        <h3 className="font-medium text-gray-700 mt-4">Bye Settings</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Top Bye Protection - how many top players get better bye values */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Top Bye Prot.</label>
            <input type="number" min="0" max="20" value={byeTopProtection} onChange={(e) => setByeTopProtection(parseInt(e.target.value) || 8)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">Protected players</p>
          </div>
          {/* Bye Increment - value added to bye count after a bye */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Bye Incr.</label>
            <input type="number" step="0.25" min="0.5" value={byeIncrement} onChange={(e) => setByeIncrement(parseFloat(e.target.value) || 1)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">+value per bye</p>
          </div>
          {/* Sit-out Penalty - value added after sitting out */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Sit Penalty</label>
            <input type="number" step="0.25" min="0" value={sitPenalty} onChange={(e) => setSitPenalty(parseFloat(e.target.value) || 0.5)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">+value per sit-out</p>
          </div>
          {/* Late Join Range - bye value range for late joiners */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Late Join ±</label>
            <input type="number" step="0.25" min="0.25" value={lateJoinRange} onChange={(e) => setLateJoinRange(parseFloat(e.target.value) || 0.25)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            <p className="text-xs text-gray-400 mt-1">Late joiner range</p>
          </div>
        </div>
      </div>
    )}
    
    {/* Pool Play Options */}
    {format === "POOL_PLAY" && (
      <div className="space-y-4 border-t pt-4">
        <h3 className="font-medium text-gray-700">Pool & Finals Settings</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Teams per Pool */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Per Pool</label>
            <input
              type="number"
              min="3"
              max="8"
              value={teamsPerPool}
              onChange={(e) => setTeamsPerPool(parseInt(e.target.value) || 4)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-400 mt-1">Teams in each pool</p>
          </div>
          
          {/* Finals Format */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Finals</label>
            <select
              value={finalsFormat}
              onChange={(e) => setFinalsFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="top2">Top 2 → Semis</option>
              <option value="top4">Top 4 → Quarters</option>
              <option value="all">Everyone advances</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">How many advance</p>
          </div>
          
          {/* Courst (same as standard) */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
            <input
              type="number"
              min="1"
              max="10"
              value={courtCount}
              onChange={(e) => setCourtCount(parseInt(e.target.value) || 2)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-400 mt-1">Available courts</p>
          </div>
          
          {/* Points per game */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Points</label>
            <input
              type="number"
              min="7"
              max="21"
              value={11}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              disabled
            />
            <p className="text-xs text-gray-400 mt-1">Win by 2 (default 11)</p>
          </div>
        </div>
      </div>
    )}
  </section>

  
  // Add player to database
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
      setName("");
      setDuprId("");
      setDuprNumericId("");
      setDuprScore("");
    }
    setSubmitting(false);
  };


    // Fetch player rating from DUPR
  const handleFetchDupr = async (playerId: string) => {
    const result = await fetchDuprRating(playerId);
    
    if (result.success && result.player) {
      // Update the players list with the new data
      setPlayers(players.map(p => 
        p.id === playerId ? result.player! : p
      ));
      alert(result.message || "Rating updated!");
    } else {
      alert(result.error || "Failed to fetch rating");
    }
  };

  // Delete player from database
  const handleDeletePlayer = async (id: string) => {
    const result = await deletePlayer(id);
    if (result.success) {
      setPlayers(players.filter(p => p.id !== id));
      setEventPool(eventPool.filter(p => p.id !== id));
    }
  };

  // Start editing a player
const startEditPlayer = (player: Player) => {
  setEditingPlayerId(player.id);
  setEditName(player.name);
  setEditDuprId(player.duprId || "");
  setEditDuprNumericId(player.duprNumericId || "");
  setEditDuprScore(player.duprScore?.toString() || "");
};

// Cancel editing
const cancelEditPlayer = () => {
  setEditingPlayerId(null);
  setEditName("");
  setEditDuprId("");
  setEditDuprNumericId("");
  setEditDuprScore("");
};

// Save the edited player
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
    cancelEditPlayer();
  } else {
    alert(result.error || "Failed to update player");
  }
};

  // Add player to event pool
  const addToPool = (player: Player) => {
    if (eventPool.find(p => p.id === player.id)) return;
    setEventPool([...eventPool, player]);
  };

    {/* === PART 1C: TOGGLE SITTING OUT === */}
  /* Toggles a player's 'isSitting' status in the event pool */
  /* Players who are sitting out won't be included in round generation */
  /* Note: This only affects the UI state - database update can be added later */
  const handleToggleSitting = (playerId: string) => {
    setEventPool(eventPool.map(p => 
      p.id === playerId ? { ...p, isSitting: !p.isSitting } : p
    ));
  };

  // Remove player from event pool
  const removeFromPool = (playerId: string) => {
    setEventPool(eventPool.filter(p => p.id !== playerId));
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl text-center max-w-md">
          <p className="text-red-600 font-bold mb-2">⚠️ Database Error</p>
          <p className="text-gray-700 text-sm">{error}</p>
          <p className="text-gray-500 text-xs mt-4">Check Vercel environment variables</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 p-4 md:p-8">
      {/* Header */}
      <header className="text-center mb-8">
                {/* Main title and subtitle for the app */}
        <h1 className="text-4xl font-bold text-white mb-2">🏓 Pickleball Event Manager</h1>
        <p className="text-green-100">Tournament Management & Round Robin Scheduling</p>
      </header>
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ========== TOURNAMENT FORMAT SECTION ========== */}
        <section className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">⚙️ Tournament Format</h2>
          
          {/* Format Type Selector */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => setFormat("STANDARD")}
              className={`p-4 rounded-xl border-2 transition-all ${
                format === "STANDARD" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              <div className="text-2xl mb-2">👑</div>
              <div className="font-semibold">Standard</div>
              <div className="text-xs mt-1">King of Court</div>
            </button>
            <button
              onClick={() => setFormat("FIXED_PARTNER")}
              className={`p-4 rounded-xl border-2 transition-all ${
                format === "FIXED_PARTNER" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              <div className="text-2xl mb-2">🤝</div>
              <div className="font-semibold">Fixed Partner</div>
              <div className="text-xs mt-1">Stay with partner</div>
            </button>
            <button
              onClick={() => setFormat("POOL_PLAY")}
              className={`p-4 rounded-xl border-2 transition-all ${
                format === "POOL_PLAY" ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-gray-300 text-gray-600"
              }`}
            >
              <div className="text-2xl mb-2">🏊</div>
              <div className="font-semibold">Pool Play</div>
              <div className="text-xs mt-1">Groups + Finals</div>
            </button>
          </div>
          
          {/* Standard/Fixed Partner Options */}
          {(format === "STANDARD" || format === "FIXED_PARTNER") && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-700">Court & Order Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
                  <input type="number" min="1" max="10" value={courtCount} onChange={(e) => setCourtCount(parseInt(e.target.value) || 2)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Win Δ</label>
                  <input type="number" step="0.25" value={winAdjustment} onChange={(e) => setWinAdjustment(parseFloat(e.target.value) || -1)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Loss Δ</label>
                  <input type="number" step="0.25" value={lossAdjustment} onChange={(e) => setLossAdjustment(parseFloat(e.target.value) || 1)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Court Bonus</label>
                  <input type="number" step="0.25" min="0" max="2" value={courtBonusMultiplier} onChange={(e) => setCourtBonusMultiplier(parseFloat(e.target.value) || 0.5)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Start Gap</label>
                  <input type="number" step="0.25" min="0.25" value={orderStartGap} onChange={(e) => setOrderStartGap(parseFloat(e.target.value) || 0.25)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Order Min</label>
                  <input type="number" step="0.5" value={orderMin} onChange={(e) => setOrderMin(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Order Max</label>
                  <input type="number" step="0.5" value={orderMax} onChange={(e) => setOrderMax(parseFloat(e.target.value) || 10)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}
          
          {/* Pool Play Options */}
          {format === "POOL_PLAY" && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-medium text-gray-700">Pool & Finals Settings</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Per Pool</label>
                  <input type="number" min="3" max="8" value={teamsPerPool} onChange={(e) => setTeamsPerPool(parseInt(e.target.value) || 4)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Finals</label>
                  <select value={finalsFormat} onChange={(e) => setFinalsFormat(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                    <option value="top2">Top 2 → Semis</option>
                    <option value="top4">Top 4 → Quarters</option>
                    <option value="all">Everyone</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Courts</label>
                  <input type="number" min="1" max="10" value={courtCount} onChange={(e) => setCourtCount(parseInt(e.target.value) || 2)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}
        </section>
        
        {/* ========== ADD PLAYER FORM ========== */}
        <section className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">➕ Add New Player</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Smith" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            </div>
            {/* DUPR ID (Letters) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DUPR ID</label>
              <input type="text" value={duprId} onChange={(e) => setDuprId(e.target.value)} placeholder="5E64ZL" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            </div>
            {/* DUPR Numeric ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numeric ID</label>
              <input type="text" value={duprNumericId} onChange={(e) => setDuprNumericId(e.target.value)} placeholder="7438750465" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            </div>
            {/* Manual DUPR Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
              <input type="number" step="0.1" min="1" max="6" value={duprScore} onChange={(e) => setDuprScore(e.target.value)} placeholder="3.5" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500" />
            </div>
          </div>
          <div className="mt-4">
            <button onClick={handleAddPlayer} disabled={submitting || !name.trim()} className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed">
              {submitting ? "Adding..." : "Add Player"}
            </button>
          </div>
        </section>


        {/* ========== PLAYER DATABASE & EVENT POOL ========== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Player Database */}
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
                      // EDIT MODE
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Name"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={editDuprId}
                            onChange={(e) => setEditDuprId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="DUPR ID (5E64ZL)"
                          />
                          <input
                            type="text"
                            value={editDuprNumericId}
                            onChange={(e) => setEditDuprNumericId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Numeric ID"
                          />
                          <input
                            type="number"
                            step="0.1"
                            value={editDuprScore}
                            onChange={(e) => setEditDuprScore(e.target.value)}
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                            placeholder="Rating"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleUpdatePlayer}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEditPlayer}
                            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-400"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // VIEW MODE
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-medium text-gray-800">{player.name}</span>
                          {player.duprId && (
                            <span className="ml-2 text-sm text-gray-500">DUPR: {player.duprId}</span>
                          )}
                          {player.duprNumericId && (
                            <span className="ml-2 text-xs text-gray-400">(#{player.duprNumericId})</span>
                          )}
                          {player.duprScore && (
                            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-sm font-medium">
                              {player.duprScore.toFixed(1)}
                            </span>
                          )}
                        </div>
                        {/* ===== PART 1B: PLAYER ACTION BUTTONS ===== */}
                        {/* These buttons allow adding players to event, editing, fetching DUPR data, or deleting */}
                        <div className="flex gap-2">
                          
                          {/* Button: Add player to current event pool */}
                          {/* State: Shows "In Pool" if already added, or "Add to Event" if not */}
                          {/* === PART 1E: ADD TO EVENT BUTTON === */}
                          {/* Simple + button to add player to current event pool */}
                          <button
                            onClick={() => addToPool(player)}
                            disabled={eventPool.some(p => p.id === player.id)}
                            className={`w-8 h-8 rounded-full font-bold text-sm transition-colors ${
                              eventPool.some(p => p.id === player.id)
                                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            }`}
                            title={eventPool.some(p => p.id === player.id) ? "In event pool" : "Add to event pool"}
                          >
                            {eventPool.some(p => p.id === player.id) ? "✓" : "+"}
                          </button>
                          
                          {/* Button: Edit player details (name, DUPR IDs, rating) */}
                          <button
                            onClick={() => startEditPlayer(player)}
                            className="text-yellow-600 hover:text-yellow-800 font-medium text-sm px-2"
                            title="Edit player details"
                          >
                            ✏️
                          </button>
                          
                          {/* Button: Fetch player data from DUPR API using their numeric ID */}
                          {/* Only shows if player has a numeric DUPR ID (for API lookup) */}
                          {player.duprNumericId && (
                            <button
                              onClick={() => handleFetchDupr(player.id)}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm px-2"
                              title="Fetch latest data from DUPR"
                            >
                              🔍
                            </button>
                          )}
                          
                          {/* Button: Delete player from database */}
                          {/* Warning: This removes the player from both database and event pool */}
                          <button
                            onClick={() => handleDeletePlayer(player.id)}
                            className="text-red-500 hover:text-red-700 font-medium text-sm px-2"
                            title="Delete player from database"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Event Pool */}
          <section className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800">🎯 Current Event Pool</h2>
              <span className="text-sm text-gray-500">{eventPool.length} players</span>
            </div>
            
            {eventPool.length === 0 ? (
              <p className="text-gray-400 text-center py-8">Add players from the database to start your event!</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {eventPool.map((player, index) => (
                  <div key={player.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                    {/* === PART 1B: EVENT POOL PLAYER ROW === */}
                    {/* Shows player with number, name, rating, and sitting out checkbox */}
                    <div className="flex items-center gap-3">
                      
                      {/* Player position number (1, 2, 3...) */}
                      <span className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      
                      {/* Player name */}
                      <span className={`font-medium ${player.isSitting ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {player.name}
                      </span>
                      
                      {/* Player DUPR rating (shows gray if sitting out) */}
                      {player.duprScore && (
                        <span className={`px-2 py-0.5 rounded text-sm font-medium ${
                          player.isSitting ? 'bg-gray-100 text-gray-400' : 'bg-green-100 text-green-700'
                        }`}>
                          {player.duprScore.toFixed(1)}
                        </span>
                      )}
                      
                      {/* Sitting out checkbox - toggle with handleToggleSitting function */}
                      <label className="flex items-center gap-1 ml-auto text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={player.isSitting}
                          onChange={() => handleToggleSitting(player.id)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-500">sit out</span>
                      </label>
                      
                      {/* Remove button */}
                      <button
                        onClick={() => removeFromPool(player.id)}
                        className="text-red-500 hover:text-red-700 font-medium text-sm"
                      >
                        ✕
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromPool(player.id)}
                      className="text-red-500 hover:text-red-700 font-medium text-sm"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* ========== START TOURNAMENT BUTTON ========== */}
        {eventPool.length >= 4 && (
          <section className="text-center">
            {/* === PART 1D: START ROUND BUTTON === */}
            {/* Button to start generating matches for the current round */}
            {/* Only enabled if we have at least 4 active players (not sitting out) */}
            <button
              className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-12 py-4 rounded-xl text-xl shadow-lg transition-all hover:scale-105"
            >
              🎾 Start Round ({eventPool.filter(p => !p.isSitting).length} active players)
            </button>
          </section>
        )}
        
        {eventPool.length > 0 && eventPool.length < 4 && (
          <p className="text-center text-white text-lg">
            Need at least 4 active players to start a round. You have {eventPool.filter(p => !p.isSitting).length}.
          </p>
        )}
        
      </div>
    </div>
  );
}

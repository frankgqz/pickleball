"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "./actions";



interface Player {
  id: string;
  name: string;
  duprId: string | null;
  duprNumericId: string | null;  // Add this line
  duprScore: number | null;
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
        {/* === PART 1A: PAGE HEADER === */}
        {/* Main title and subtitle for the app */}
        <h1 className="text-4xl font-bold text-white mb-2">🏓 Pickleball Event Manager</h1>
        <p className="text-green-100">Tournament Management & Round Robin Scheduling</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* ========== ADD PLAYER FORM ========== */}
        <section className="bg-white rounded-2xl shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">➕ Add New Player</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Smith"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            {/* DUPR ID (Letters) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DUPR ID (Letters)</label>
              <input
                type="text"
                value={duprId}
                onChange={(e) => setDuprId(e.target.value)}
                placeholder="5E64ZL"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            {/* DUPR Numeric ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DUPR Numeric ID</label>
              <input
                type="text"
                value={duprNumericId}
                onChange={(e) => setDuprNumericId(e.target.value)}
                placeholder="7438750465"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            {/* Manual DUPR Score */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DUPR Score</label>
              <input
                type="number"
                step="0.1"
                min="1"
                max="6"
                value={duprScore}
                onChange={(e) => setDuprScore(e.target.value)}
                placeholder="3.5"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>
            
            {/* Add Button */}
            <div className="flex items-end">
              <button
                onClick={handleAddPlayer}
                disabled={submitting || !name.trim()}
                className="w-full bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "Adding..." : "Add Player"}
              </button>
            </div>
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
            Need at least 4 players to start a tournament. You have {eventPool.length}.
          </p>
        )}
        
      </div>
    </div>
  );
}

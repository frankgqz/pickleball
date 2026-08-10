"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SettingsPanel from "@/components/SettingsPanel";
import PlayerDatabase from "@/components/PlayerDatabase";
import EventPool from "@/components/EventPool";
import CourtsPanel from "@/components/CourtsPanel";
import StandingsTable from "@/components/StandingsTable";
import RoundHistoryPanel from "@/components/RoundHistoryPanel";
import { Player, StandingsEntry, TournamentConfig, Match, CompletedRound, RoundState, GameSession, MatchFormat } from "@/components/Types";
import { generateMatches } from "@/components/MatchEngine";
import { 
  sortStandings, 
  computeStandingsEntries,
  createStandingsEntry,
  recalculateStandingsFromHistory,
  processMatchResult,
} from "@/components/standingsUtils";

// Server actions for Neon PostgreSQL database
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "./actions";

// ============================================================
// CONSTANTS
// ============================================================

const STORAGE_KEY_ROUNDS = "pickleball_rounds_v1";
const STORAGE_KEY_PLAYERS = "pickleball_players_v1";
const STORAGE_KEY_EVENT_POOL = "pickleball_event_pool_v1";
const STORAGE_KEY_SESSION = "pickleball_session_v1";
const STORAGE_KEY_STANDINGS = "pickleball_standings_v1";

const isBrowser = typeof window !== "undefined";

const initialConfig: TournamentConfig = {
  format: "STANDARD",
  orderGap: 0.25,
  band: 1,
  winLossMagnitude: 1,
  courtBonus: 1,
  byeTopProtection: 8,
  byeBonusTop: 0.5,
  sitProtection: 0.5,
  lateJoinBonus: 1,
  courts: 5,
  teamsPerPool: 4,
  finalsFormat: "top2",
};

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================

const storage = {
  saveRounds: (rounds: CompletedRound[]) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_ROUNDS, JSON.stringify(rounds));
  },
  
  loadRounds: (): CompletedRound[] => {
    if (!isBrowser) return [];
    const s = localStorage.getItem(STORAGE_KEY_ROUNDS);
    if (!s) return [];
    try {
      return JSON.parse(s) as CompletedRound[];
    } catch {
      return [];
    }
  },
  
  savePlayers: (players: Player[]) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
  },
  
  loadPlayers: (): Player[] => {
    if (!isBrowser) return [];
    const s = localStorage.getItem(STORAGE_KEY_PLAYERS);
    if (!s) return [];
    try {
      return JSON.parse(s) as Player[];
    } catch {
      return [];
    }
  },
  
  saveEventPool: (pool: Player[]) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_EVENT_POOL, JSON.stringify(pool));
  },
  
  loadEventPool: (): Player[] => {
    if (!isBrowser) return [];
    const s = localStorage.getItem(STORAGE_KEY_EVENT_POOL);
    if (!s) return [];
    try {
      return JSON.parse(s) as Player[];
    } catch {
      return [];
    }
  },
  
  saveSession: (session: GameSession) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
  },
  
  loadSession: (): GameSession | null => {
    if (!isBrowser) return null;
    const s = localStorage.getItem(STORAGE_KEY_SESSION);
    if (!s) return null;
    try {
      return JSON.parse(s) as GameSession;
    } catch {
      return null;
    }
  },
  
  saveStandings: (standings: StandingsEntry[], sessionId: string) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEY_STANDINGS, JSON.stringify({
      sessionId,
      entries: standings,
    }));
  },
  
  loadStandings: (sessionId: string): StandingsEntry[] => {
    if (!isBrowser) return [];
    const s = localStorage.getItem(STORAGE_KEY_STANDINGS);
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (parsed.sessionId === sessionId) {
        return parsed.entries || [];
      }
    } catch {
      // ignore
    }
    return [];
  },
  
  clearAll: () => {
    if (!isBrowser) return;
    localStorage.removeItem(STORAGE_KEY_ROUNDS);
    localStorage.removeItem(STORAGE_KEY_SESSION);
    localStorage.removeItem(STORAGE_KEY_STANDINGS);
    localStorage.removeItem(STORAGE_KEY_EVENT_POOL);
  },
};

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function Page() {
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Players & pool
  const [players, setPlayers] = useState<Player[]>(() => storage.loadPlayers());
  const [eventPool, setEventPool] = useState<Player[]>(() => storage.loadEventPool());

  // Standings entries
  const [standings, setStandings] = useState<StandingsEntry[]>([]);

  // Config
  const [config, setConfig] = useState<TournamentConfig>(() => initialConfig);

  // Round state
  const [roundState, setRoundState] = useState<RoundState>({ 
    active: false, 
    format: "PICK_PARTNER", 
    matches: [], 
    submitted: false 
  });

  // Session and history
  const [currentSession, setCurrentSession] = useState<GameSession>(() => ({
    sessionId: Date.now().toString(),
    startDate: new Date().toISOString(),
  }));
  const [roundHistory, setRoundHistory] = useState<CompletedRound[]>(() => storage.loadRounds());

  // UI helpers
  const [standingsSortColumn, setStandingsSortColumn] = useState("seedTotal");
  const [standingsSortDirection, setStandingsSortDirection] = useState<"asc" | "desc">("asc");

  // derived: rounds in current session
  const currentSessionRounds = useMemo(
    () => roundHistory.filter(r => r.sessionId === currentSession.sessionId)
                      .sort((a, b) => a.roundNumber - b.roundNumber),
    [roundHistory, currentSession]
  );
  const currentRoundNumber = currentSessionRounds.length + 1;

  // ============================================================
  // STANDINGS SORTING HANDLER
  // ============================================================

  const handleStandingsSort = useCallback((column: string) => {
    if (column === standingsSortColumn) {
      setStandingsSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setStandingsSortColumn(column);
      setStandingsSortDirection("asc");
    }
  }, [standingsSortColumn]);

  // ============================================================
  // PLAYER HANDLERS
  // ============================================================

  useEffect(() => {
    loadPlayersFromDb();
  }, []);

  async function loadPlayersFromDb() {
    try {
      setLoading(true);
      const result = await getPlayers();

      if (result.success) {
        setPlayers(result.players || []);

        // Load persisted data
        const savedRounds = storage.loadRounds();
        if (savedRounds.length > 0) {
          setRoundHistory(savedRounds);
        }

        const savedSession = storage.loadSession();
        if (savedSession) {
          setCurrentSession(savedSession);
          const savedStandings = storage.loadStandings(savedSession.sessionId);
          if (savedStandings.length > 0) {
            setStandings(savedStandings);
          }
        }
      } else {
        setError(result.error || "Failed to load players");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  }

  const handleAddPlayer = async (p: { name: string; duprId?: string; duprNumericId?: string; duprScore?: number }) => {
    const formData = new FormData();
    formData.append("name", p.name);
    formData.append("duprId", p.duprId || "");
    formData.append("duprNumericId", p.duprNumericId || "");
    formData.append("duprScore", p.duprScore ? String(p.duprScore) : "");

    const result = await addPlayer(formData);
    if (result.success && result.player) {
      setPlayers(prev => [result.player, ...prev]);
      addToPool(result.player);
    }
  };

  const handleDeletePlayer = async (id: string) => {
    const result = await deletePlayer(id);
    if (result.success) {
      setPlayers(prev => prev.filter(p => p.id !== id));
      setEventPool(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleUpdatePlayer = async (id: string, updates: Partial<Player>) => {
    const formData = new FormData();
    if (updates.name) formData.append("name", updates.name);
    if (updates.duprId !== undefined && updates.duprId !== null) formData.append("duprId", updates.duprId);
    if (updates.duprNumericId !== undefined && updates.duprNumericId !== null) formData.append("duprNumericId", updates.duprNumericId);
    if (updates.duprScore !== undefined && updates.duprScore !== null) formData.append("duprScore", String(updates.duprScore));

    const result = await updatePlayer(id, formData);
    if (result.success && result.player) {
      setPlayers(prev => prev.map(p => p.id === id ? result.player! : p));
    }
  };

  const handleFetchDupr = async (playerId: string) => {
    const result = await fetchDuprRating(playerId);
    if (result.success && result.player) {
      setPlayers(prev => prev.map(p => p.id === playerId ? result.player! : p));
    }
  };

  // ============================================================
  // EVENT POOL HANDLERS
  // ============================================================

  const addToPool = (player: Player) => {
    if (eventPool.find(p => p.id === player.id)) return;
    
    setEventPool(prev => [player, ...prev]);
    setStandings(prev => {
      if (prev.find(s => s.id === player.id)) return prev;
      
      const newEntry = createStandingsEntry(
        player,
        prev.length,
        config.orderGap,
        currentRoundNumber > 1 ? config.lateJoinBonus : 0
      );
      
      return [...prev, newEntry];
    });
    recalculateSeeds();
  };

  const removeFromPool = (playerId: string) => {
    setEventPool(prev => prev.filter(p => p.id !== playerId));
    setStandings(prev => prev.filter(s => s.id !== playerId));
    recalculateSeeds();
  };

  const toggleSitting = (playerId: string) => {
    setEventPool(prev => prev.map(p => 
      p.id === playerId ? { ...p, isSitting: !p.isSitting } : p
    ));
  };

  // ============================================================
  // SEED & BYE RECALCULATION
  // ============================================================

  const recalculateSeeds = useCallback(() => {
    setStandings(prev => {
      const sorted = [...prev].sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      return sorted.map((entry, i) => ({ ...entry, seed: 1 + i * config.orderGap }));
    });
  }, [config.orderGap]);

  const regenerateByes = useCallback(() => {
    setStandings(prev => {
      const sorted = [...prev].sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      const topHalf = Math.floor(config.byeTopProtection / 2);

      return sorted.map((entry, idx) => {
        const baseRoll = -Math.random();
        let byeBase = baseRoll;
        
        if (idx < topHalf) {
          byeBase = baseRoll + config.byeBonusTop;
        } else if (idx < config.byeTopProtection) {
          byeBase = baseRoll + (config.byeBonusTop / 2);
        }
        
        return { ...entry, byeBase };
      });
    });
  }, [config.byeTopProtection, config.byeBonusTop]);

  const handleVetoBye = (playerId: string) => {
    setStandings(prev => prev.map(entry => {
      if (entry.id === playerId) {
        return { ...entry, byeMod: (entry.byeMod || 0) + 0.25 };
      }
      return entry;
    }));
    
    const roundFmt = config.roundFormat || "FIXED_14V23";
    doGenerateMatches(roundFmt as MatchFormat);
  };

  // ============================================================
  // PERSISTENCE
  // ============================================================

  useEffect(() => {
    storage.savePlayers(players);
  }, [players]);

  useEffect(() => {
    storage.saveRounds(roundHistory);
  }, [roundHistory]);

  useEffect(() => {
    if (standings.length > 0) {
      storage.saveStandings(standings, currentSession?.sessionId);
    }
  }, [standings, currentSession]);

  useEffect(() => {
    storage.saveSession(currentSession);
  }, [currentSession]);

  useEffect(() => {
    if (!isBrowser) return;
    if (eventPool.length > 0 || localStorage.getItem(STORAGE_KEY_EVENT_POOL)) {
      storage.saveEventPool(eventPool);
    }
  }, [eventPool]);

  // ============================================================
  // MATCH GENERATION
  // ============================================================

  const doGenerateMatches = useCallback((format: MatchFormat) => {
    const result = generateMatches(format, eventPool, standings, config, currentRoundNumber, null, setStandings);
    setRoundState({ 
      active: true, 
      format, 
      matches: result.matches, 
      submitted: false 
    });
  }, [eventPool, standings, config, currentRoundNumber]);

  const doGeneratePoolMatches = useCallback(() => {
    const activePlayers = eventPool.filter(p => !p.isSitting);
    const poolsCount = config.poolFinals?.poolsCount || 2;
    const pools: Player[][] = Array.from({ length: poolsCount }, () => []);

    activePlayers.forEach((player, idx) => {
      pools[idx % poolsCount].push(player);
    });

    const generatedMatches: Match[] = [];
    let courtNum = 1;

    pools.forEach((pool, poolIdx) => {
      for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
          generatedMatches.push({
            id: `pool-${poolIdx + 1}-m${courtNum}`,
            court: courtNum,
            team1: [pool[i].id],
            team2: [pool[j].id],
            team1Score: undefined,
            team2Score: undefined,
            bye: false,
          });
          courtNum++;
        }
      }
    });

    setRoundState({ 
      active: true, 
      format: "POOL_PLAY", 
      matches: generatedMatches, 
      submitted: false, 
      stage: "pool" 
    });
  }, [eventPool, config]);

  // ============================================================
  // MATCH HELPERS
  // ============================================================

  const updateMatchScore = (matchId: string, score: number, team: "team1" | "team2") => {
    setRoundState(prev => ({ 
      ...prev, 
      matches: prev.matches.map(m => 
        m.id === matchId ? ({ ...m, [team + "Score"]: score }) : m
      ) 
    }));
  };

  const swapPlayerTeam = (matchId: string, playerId: string) => {
    setRoundState(prev => ({
      ...prev,
      matches: prev.matches.map(m => {
        if (m.id !== matchId) return m;
        
        const picker = m.team1[0];
        const partner = m.team1[1];
        
        if (playerId === picker) return m;
        
        if (m.team2.includes(playerId)) {
          return { 
            ...m, 
            team1: [picker, playerId], 
            team2: [...m.team2.filter(id => id !== playerId), partner] 
          };
        }
        
        return m;
      })
    }));
  };

  // ============================================================
  // SUBMIT ROUND RESULTS
  // ============================================================

  const submitRoundResults = () => {
    // Update standings for each match
    setStandings(prev => {
      const updated = [...prev];
      
      roundState.matches.forEach(m => {
        if (m.bye && m.byePlayerId) {
          // Handle bye
          const idx = updated.findIndex(s => s.id === m.byePlayerId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              byeCount: (updated[idx].byeCount || 0) + 1,
              orderHistory: [
                ...(updated[idx].orderHistory || []),
                { round: currentRoundNumber, change: 0, reason: "bye" }
              ]
            };
          }
        } else {
          // Handle regular match - use centralized function
          [m.team1[0], m.team1[1], m.team2[0], m.team2[1]].forEach(playerId => {
            if (!playerId) return;
            const idx = updated.findIndex(s => s.id === playerId);
            if (idx >= 0) {
              updated[idx] = processMatchResult(updated[idx], {
                match: m,
                eventPool,
                config,
                roundNumber: currentRoundNumber,
              });
            }
          });
        }
      });
      
      return updated;
    });

    // Save round to history
    const completedRound: CompletedRound = {
      roundNumber: currentRoundNumber,
      date: new Date().toISOString(),
      format: roundState.format,
      matches: roundState.matches,
      sittingOut: eventPool.filter(p => p.isSitting).map(p => p.id),
      sessionId: currentSession.sessionId,
    };

    const newHistory = [...roundHistory, completedRound];
    setRoundHistory(newHistory);
    setRoundState(prev => ({ ...prev, submitted: true }));
  };

  // ============================================================
  // SETTINGS CHANGE HANDLER
  // ============================================================

  const updateConfig = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // ============================================================
  // RESTART & CANCEL
  // ============================================================

  const handleRestartEvent = useCallback(() => {
    setRoundHistory([]);
    setStandings([]);
    setEventPool([]);
    storage.clearAll();
    
    setRoundState({ 
      active: false, 
      format: "PICK_PARTNER", 
      matches: [], 
      submitted: false 
    });
    
    const newSession: GameSession = {
      sessionId: Date.now().toString(),
      startDate: new Date().toISOString(),
    };
    setCurrentSession(newSession);
  }, []);

  const handleCancelRound = useCallback(() => {
    setRoundState({ 
      active: false, 
      format: "PICK_PARTNER", 
      matches: [], 
      submitted: false 
    });
  }, []);

  // ============================================================
  // COMPUTED STANDINGS FOR DISPLAY
  // ============================================================

  const computedStandings = useMemo(() => {
    return sortStandings(
      computeStandingsEntries(standings),
      standingsSortColumn,
      standingsSortDirection
    );
  }, [standings, standingsSortColumn, standingsSortDirection]);

  // ============================================================
  // ROUND HISTORY EDIT HANDLERS (using centralized logic)
  // ============================================================

  const handleEditRound = useCallback((updated: CompletedRound) => {
    const newHistory = roundHistory.map(r =>
      r.roundNumber === updated.roundNumber && r.sessionId === updated.sessionId 
        ? updated 
        : r
    );
    setRoundHistory(newHistory);

    // Use centralized standings recalculation
    const newStandings = recalculateStandingsFromHistory(
      standings,
      newHistory,
      currentSession.sessionId,
      config,
      eventPool
    );
    setStandings(newStandings);
  }, [roundHistory, standings, currentSession.sessionId, config, eventPool]);

  const handleDeleteRound = useCallback((roundNumber: number, sessionId: string) => {
    const newHistory = roundHistory.filter(r => 
      !(r.roundNumber === roundNumber && r.sessionId === sessionId)
    );
    setRoundHistory(newHistory);

    // Only recalculate if deleting from current session
    if (sessionId !== currentSession.sessionId) return;

    // Use centralized standings recalculation
    const newStandings = recalculateStandingsFromHistory(
      standings,
      newHistory,
      sessionId,
      config,
      eventPool
    );
    setStandings(newStandings);
  }, [roundHistory, standings, currentSession.sessionId, config, eventPool]);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl text-center max-w-md">
          <p className="text-red-600 font-bold mb-2">Database Error</p>
          <p className="text-gray-700 text-sm">{error}</p>
          <button 
            onClick={loadPlayersFromDb} 
            className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 p-4 md:p-8">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">🏓 Pickleball Event Manager</h1>
        <p className="text-green-100">Tournament Management & Round Robin Scheduling</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">
        <SettingsPanel
          config={config}
          updateConfig={updateConfig}
          onRestartEvent={handleRestartEvent}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PlayerDatabase
            players={players}
            eventPool={eventPool}
            onAddPlayer={handleAddPlayer}
            onDeletePlayer={handleDeletePlayer}
            onFetchDupr={handleFetchDupr}
            onUpdatePlayer={handleUpdatePlayer}
            onAddToPool={addToPool}
            onRemoveFromPool={removeFromPool}
          />
          <EventPool
            eventPool={eventPool}
            onToggleSitting={toggleSitting}
            onRemoveFromPool={removeFromPool}
          />
        </div>

        <CourtsPanel
          roundState={roundState}
          eventPool={eventPool}
          standings={standings}
          currentRoundNumber={currentRoundNumber}
          defaultRoundFormat={config.roundFormat || "FIXED_14V23"}
          onStartPickPartner={() => { 
            if (currentRoundNumber === 1) regenerateByes(); 
            doGenerateMatches("PICK_PARTNER"); 
          }}
          onStartFixed14v23={() => { 
            if (currentRoundNumber === 1) regenerateByes(); 
            doGenerateMatches("FIXED_14V23"); 
          }}
          onRegenerateByes={regenerateByes}
          onUpdateMatchScore={updateMatchScore}
          onSwapPlayerTeam={swapPlayerTeam}
          onSubmitRound={submitRoundResults}
          onCancelRound={handleCancelRound}
          onVetoBye={handleVetoBye}
          onStartNextRound={() => {
            if (config.format === "POOL_PLAY") {
              doGeneratePoolMatches();
            } else {
              const roundFmt = config.roundFormat || "FIXED_14V23";
              doGenerateMatches(roundFmt as MatchFormat);
            }
          }}
          submitted={roundState.submitted}
        />

        <StandingsTable
          standings={computedStandings}
          onRegenerateByes={regenerateByes}
        />

        <RoundHistoryPanel
          roundHistory={roundHistory}
          currentSessionId={currentSession.sessionId}
          eventPool={eventPool}
          config={config}
          onEditRound={handleEditRound}
          onDeleteRound={handleDeleteRound}
        />
      </div>
    </div>
  );
}
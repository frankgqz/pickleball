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
import { sortStandings, computeStandingsEntries } from "@/components/standingsUtils";

// Server actions for Neon PostgreSQL database
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "./actions";

// --- localStorage helpers (browser-only) ---------------------- //
const STORAGE_KEY_ROUNDS = "pickleball_rounds_v1";
const STORAGE_KEY_PLAYERS = "pickleball_players_v1";
const STORAGE_KEY_EVENT_POOL = "pickleball_event_pool_v1";
const isBrowser = typeof window !== "undefined";

const saveRoundsToStorage = (rounds: CompletedRound[]) => {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEY_ROUNDS, JSON.stringify(rounds));
};
const loadRoundsFromStorage = (): CompletedRound[] => {
  if (!isBrowser) return [];
  const s = localStorage.getItem(STORAGE_KEY_ROUNDS);
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as CompletedRound[];
    return parsed.map(r => ({ ...r }));
  } catch {
    return [];
  }
};
const savePlayersToStorage = (players: Player[]) => {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEY_PLAYERS, JSON.stringify(players));
};
const loadPlayersFromStorage = (): Player[] => {
  if (!isBrowser) return [];
  const s = localStorage.getItem(STORAGE_KEY_PLAYERS);
  if (!s) return [];
  try { return JSON.parse(s) as Player[]; } catch { return []; }
};
const saveEventPoolToStorage = (pool: Player[]) => {
  if (!isBrowser) return;
  localStorage.setItem(STORAGE_KEY_EVENT_POOL, JSON.stringify(pool));
};
const loadEventPoolFromStorage = (): Player[] => {
  if (!isBrowser) return [];
  const s = localStorage.getItem(STORAGE_KEY_EVENT_POOL);
  if (!s) return [];
  try { return JSON.parse(s) as Player[]; } catch { return []; }
};

// --- Initial config defaults ---------------------- //
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

// --- Page (orchestrator) ---------------------- //
export default function Page() {
  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Players & pool
  const [players, setPlayers] = useState<Player[]>(() => loadPlayersFromStorage());
  const [eventPool, setEventPool] = useState<Player[]>(() => loadEventPoolFromStorage());

  // Standings entries
  const [standings, setStandings] = useState<StandingsEntry[]>([]);

  // Config
  const [config, setConfig] = useState<TournamentConfig>(() => initialConfig);

  // Round state
  const [roundState, setRoundState] = useState<RoundState>({ active: false, format: "PICK_PARTNER", matches: [], submitted: false });

  // Session and history
  const [currentSession, setCurrentSession] = useState<GameSession>(() => ({ sessionId: Date.now().toString(), startDate: new Date().toISOString() }));
  const [roundHistory, setRoundHistory] = useState<CompletedRound[]>(() => loadRoundsFromStorage());

  // UI helpers
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [standingsSortColumn, setStandingsSortColumn] = useState("seedTotal");
  const [standingsSortDirection, setStandingsSortDirection] = useState<"asc" | "desc">("asc");

  // derived: rounds in current session
  const currentSessionRounds = useMemo(() => roundHistory.filter(r => r.sessionId === currentSession.sessionId).sort((a,b)=>a.roundNumber - b.roundNumber), [roundHistory, currentSession]);
  const currentRoundNumber = currentSessionRounds.length + 1;

  // --- Standings sorting handler ---------------------- //
  const handleStandingsSort = useCallback((column: string) => {
    if (column === standingsSortColumn) {
      setStandingsSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setStandingsSortColumn(column);
      setStandingsSortDirection("asc");
    }
  }, [standingsSortColumn]);

  // --- Player handlers ---------------------- //
  useEffect(() => {
    loadPlayersFromDb();
  }, []);

  async function loadPlayersFromDb() {
    try {
      setLoading(true);
      const result = await getPlayers();
      if (result.success) {
        setPlayers(result.players || []);

        const savedRounds = loadRoundsFromStorage();
        if (savedRounds.length > 0) setRoundHistory(savedRounds);

        const savedSession = localStorage.getItem("pickleball_session_v1");
        if (savedSession) {
          try { setCurrentSession(JSON.parse(savedSession)); } catch {}
        }

        const savedStandings = localStorage.getItem("pickleball_standings_v1");
        if (savedStandings && currentSession) {
          try {
            const parsed = JSON.parse(savedStandings);
            if (parsed.sessionId === currentSession.sessionId) {
              setStandings(parsed.entries || []);
            }
          } catch {}
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

  // --- Event pool handlers ---------------------- //
  const addToPool = (player: Player) => {
    if (eventPool.find(p => p.id === player.id)) return;
    setEventPool(prev => [player, ...prev]);
    setStandings(prev => {
      if (prev.find(s => s.id === player.id)) return prev;
      const seed = 1 + prev.length * config.orderGap;
      const byeBase = -Math.random();
      return [...prev, {
        id: player.id,
        name: player.name,
        duprId: player.duprId ?? null,
        duprScore: player.duprScore ?? null,
        seed,
        seedAdjustment: 0,
        orderHistory: [],
        byeBase,
        byeMod: config.lateJoinBonus && currentRoundNumber > 1 ? config.lateJoinBonus : 0,
        byeCount: 0,
        sitOutCount: 0,
        wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0,
      }];
    });
    recalculateSeeds();
  };

  const removeFromPool = (playerId: string) => {
    setEventPool(prev => prev.filter(p => p.id !== playerId));
    setStandings(prev => prev.filter(s => s.id !== playerId));
    recalculateSeeds();
  };

  const toggleSitting = (playerId: string) => {
    setEventPool(prev => prev.map(p => p.id === playerId ? { ...p, isSitting: !p.isSitting } : p));
  };

  // --- Seed recalculations ---------------------- //
  const recalculateSeeds = () => {
    setStandings(prev => {
      const sorted = [...prev].sort((a,b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      return sorted.map((entry, i) => ({ ...entry, seed: 1 + i * config.orderGap }));
    });
  };

  const regenerateByes = () => {
    setStandings(prev => {
      const updated = [...prev].sort((a,b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      const topHalf = Math.floor(config.byeTopProtection / 2);
      return updated.map((entry, idx) => {
        const baseRoll = -Math.random();
        let byeBase = baseRoll;
        if (idx < topHalf) byeBase = baseRoll + config.byeBonusTop;
        else if (idx < config.byeTopProtection) byeBase = baseRoll + (config.byeBonusTop / 2);
        return { ...entry, byeBase };
      });
    });
  };

  // Veto a bye for a specific player - add 0.25 to their byeMod and regenerate matches
  const handleVetoBye = (playerId: string) => {
    setStandings(prev => prev.map(entry => {
      if (entry.id === playerId) {
        return { ...entry, byeMod: (entry.byeMod || 0) + 0.25 };
      }
      return entry;
    }));
    // Regenerate matches with the updated bye scores
    const roundFmt = config.roundFormat || "FIXED_14V23";
    doGenerateMatches(roundFmt as MatchFormat);
  };

  // --- Persistence: save players on change ---------------------- //
  useEffect(() => {
    savePlayersToStorage(players);
  }, [players]);

  useEffect(() => {
    saveRoundsToStorage(roundHistory);
  }, [roundHistory]);

  // Auto-save standings to localStorage when they change
  useEffect(() => {
    if (standings.length > 0 && isBrowser) {
      localStorage.setItem("pickleball_standings_v1", JSON.stringify({
        sessionId: currentSession?.sessionId,
        entries: standings,
      }));
    }
  }, [standings, currentSession]);

  // Auto-save session to localStorage when it changes
  useEffect(() => {
    if (currentSession && isBrowser) {
      localStorage.setItem("pickleball_session_v1", JSON.stringify(currentSession));
    }
  }, [currentSession]);

  // Auto-save eventPool to localStorage when it changes
  useEffect(() => {
    if (!isBrowser) return;
    // Only save if it's been initialized (not initial empty state)
    if (eventPool.length > 0 || localStorage.getItem(STORAGE_KEY_EVENT_POOL)) {
      saveEventPoolToStorage(eventPool);
    }
  }, [eventPool]);

  // --- Match generation ---------------------- //
  const doGenerateMatches = useCallback((format: MatchFormat) => {
    const result = generateMatches(format, eventPool, standings, config, currentRoundNumber, null, setStandings);
    setRoundState({ active: true, format, matches: result.matches, submitted: false });
  }, [eventPool, standings, config, currentRoundNumber]);

  const doGeneratePoolMatches = useCallback(() => {
    // Generate simple pool matches (round-robin within each pool)
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

    setRoundState({ active: true, format: "POOL_PLAY", matches: generatedMatches, submitted: false, stage: "pool" });
  }, [eventPool, config]);

  // --- Match helpers ---------------------- //
  const updateMatchScore = (matchId: string, score: number, team: "team1" | "team2") => {
    setRoundState(prev => ({ ...prev, matches: prev.matches.map(m => m.id === matchId ? ({ ...m, [team+"Score"]: score }) : m) }));
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
          return { ...m, team1: [picker, playerId], team2: [...m.team2.filter(id => id !== playerId), partner] };
        }
        return m;
      })
    }));
  };

  // --- Submit round ---------------------- //
  const submitRoundResults = () => {
    const byePlayerIds = roundState.matches.filter(m => m.bye).map(m => m.byePlayerId).filter(Boolean) as string[];

    setStandings(prev => {
      const map = new Map<string, StandingsEntry>(prev.map(s => [s.id, { ...s }]));

      roundState.matches.forEach(m => {
        if (m.bye && m.byePlayerId) {
          const s = map.get(m.byePlayerId);
          if (s) {
            s.byeCount = (s.byeCount || 0) + 1;
            s.orderHistory = [...(s.orderHistory || []), { round: currentRoundNumber, change: 0, reason: "bye" }];
            map.set(s.id, s);
          }
        } else {
          const team1Ids = m.team1, team2Ids = m.team2;
          const t1score = m.team1Score || 0, t2score = m.team2Score || 0;

          [...team1Ids, ...team2Ids].forEach(pid => {
            const s = map.get(pid);
            if (!s) return;
            const isOnTeam1 = team1Ids.includes(pid);
            const myScore = isOnTeam1 ? t1score : t2score;
            const oppScore = isOnTeam1 ? t2score : t1score;
            const won = myScore > oppScore;

            if (won) s.wins = (s.wins || 0) + 1;
            else if (myScore > 0 || oppScore > 0) s.losses = (s.losses || 0) + 1;
            s.pointsFor = (s.pointsFor || 0) + myScore;
            s.pointsAgainst = (s.pointsAgainst || 0) + oppScore;

            // Compute order change based on court position
            const filledCourts = Math.ceil((eventPool.filter(p => !p.isSitting).length - byePlayerIds.length) / 4) || 1;
            const isTop = m.court === 1;
            const isBottom = m.court === filledCourts;
            let orderChange = won ? -config.winLossMagnitude : config.winLossMagnitude;
            if (isTop) orderChange = won ? -config.courtBonus : config.winLossMagnitude;
            else if (isBottom) orderChange = won ? -config.winLossMagnitude : config.courtBonus;

            const rawAdj = (s.seedAdjustment || 0) + orderChange;
            const minSeedTotal = 1 - config.band;
            const maxSeedTotal = 1 + config.band + ((prev.length - 1) * config.orderGap);
            const clampedAdj = Math.max(minSeedTotal - s.seed, Math.min(maxSeedTotal - s.seed, rawAdj));

            s.orderHistory = [...(s.orderHistory || []), { round: currentRoundNumber, change: clampedAdj - (s.seedAdjustment || 0), reason: (isTop ? "top" : isBottom ? "bottom" : `court ${m.court}`) + (won ? " win" : " loss") }];
            s.seedAdjustment = clampedAdj;
            map.set(s.id, s);
          });
        }
      });
      return Array.from(map.values());
    });

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
    saveRoundsToStorage(newHistory);
    setRoundState(prev => ({ ...prev, submitted: true }));
  };

  // --- Settings change handler ---------------------- //
  const updateConfig = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // --- Restart event handler ---------------------- //
  const handleRestartEvent = useCallback(() => {
    setRoundHistory([]);
    saveRoundsToStorage([]);
    setStandings([]);
    setEventPool([]); // Clear event pool too
    if (isBrowser) localStorage.removeItem("pickleball_standings_v1");
    setRoundState({ active: false, format: "PICK_PARTNER", matches: [], submitted: false });
    const newSession: GameSession = {
      sessionId: Date.now().toString(),
      startDate: new Date().toISOString(),
    };
    setCurrentSession(newSession);
    if (isBrowser) localStorage.setItem("pickleball_session_v1", JSON.stringify(newSession));
  }, []);

  const handleCancelRound = useCallback(() => {
    setRoundState({ active: false, format: "PICK_PARTNER", matches: [], submitted: false });
  }, []);

  // --- Computed standings for display ---------------------- //
  const computedStandings = useMemo(() => {
    return sortStandings(computeStandingsEntries(standings), standingsSortColumn, standingsSortDirection);
  }, [standings, standingsSortColumn, standingsSortDirection]);

  // --- Loading state ---------------------- //
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
          <button onClick={loadPlayersFromDb} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg">Retry</button>
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
          onStartPickPartner={() => { if (currentRoundNumber === 1) regenerateByes(); doGenerateMatches("PICK_PARTNER"); }}
          onStartFixed14v23={() => { if (currentRoundNumber === 1) regenerateByes(); doGenerateMatches("FIXED_14V23"); }}
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
          onSortChange={handleStandingsSort}
        />

        <RoundHistoryPanel
          roundHistory={roundHistory}
          currentSessionId={currentSession.sessionId}
          eventPool={eventPool}
          config={config}
          onEditRound={(updated: CompletedRound) => {
            const newHistory = roundHistory.map(r => 
              r.roundNumber === updated.roundNumber && r.sessionId === updated.sessionId ? updated : r
            );
            setRoundHistory(newHistory);
            saveRoundsToStorage(newHistory);
            
            // Recalculate standings from all rounds - BATCHED into single setStandings call
            const sessionRounds = newHistory
              .filter(r => r.sessionId === currentSession.sessionId)
              .sort((a, b) => a.roundNumber - b.roundNumber);
            
            // Build all changes first
            const changesMap = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number; byeCount: number; orderHistory: { round: number; change: number; reason: string }[] }>();
            
            standings.forEach(s => {
              changesMap.set(s.id, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, byeCount: 0, orderHistory: [] });
            });
            
            sessionRounds.forEach(r => {
              r.matches.forEach(m => {
                if (m.bye && m.byePlayerId) {
                  const changes = changesMap.get(m.byePlayerId)!;
                  changes.byeCount++;
                  changes.orderHistory.push({ round: r.roundNumber, change: 0, reason: 'bye' });
                } else {
                  const t1score = m.team1Score || 0, t2score = m.team2Score || 0;
                  [...m.team1, ...m.team2].forEach(pid => {
                    const changes = changesMap.get(pid)!;
                    const isOnTeam1 = m.team1.includes(pid);
                    const myScore = isOnTeam1 ? t1score : t2score;
                    const oppScore = isOnTeam1 ? t2score : t1score;
                    if (myScore > oppScore) changes.wins++;
                    else if (oppScore > myScore) changes.losses++;
                    changes.pointsFor += myScore;
                    changes.pointsAgainst += oppScore;
                  });
                }
              });
            });
            
            // Apply all changes in ONE setStandings call
            setStandings(prev => prev.map(s => {
              const changes = changesMap.get(s.id)!;
              return {
                ...s,
                seedAdjustment: 0,
                byeCount: changes.byeCount,
                sitOutCount: 0,
                wins: changes.wins,
                losses: changes.losses,
                ties: 0,
                pointsFor: changes.pointsFor,
                pointsAgainst: changes.pointsAgainst,
                orderHistory: changes.orderHistory,
              };
            }));
          }}
          onDeleteRound={(roundNumber, sessionId) => {
            const newHistory = roundHistory.filter(r => !(r.roundNumber === roundNumber && r.sessionId === sessionId));
            setRoundHistory(newHistory);
            saveRoundsToStorage(newHistory);
            
            if (sessionId !== currentSession.sessionId) return;
            
            // Recalculate standings from remaining rounds - BATCHED into single setStandings call
            const sessionRounds = newHistory
              .filter(r => r.sessionId === sessionId)
              .sort((a, b) => a.roundNumber - b.roundNumber);
            
            // Build all changes first
            const changesMap = new Map<string, { wins: number; losses: number; pointsFor: number; pointsAgainst: number; byeCount: number; orderHistory: { round: number; change: number; reason: string }[] }>();
            
            standings.forEach(s => {
              changesMap.set(s.id, { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, byeCount: 0, orderHistory: [] });
            });
            
            sessionRounds.forEach(r => {
              r.matches.forEach(m => {
                if (m.bye && m.byePlayerId) {
                  const changes = changesMap.get(m.byePlayerId)!;
                  changes.byeCount++;
                  changes.orderHistory.push({ round: r.roundNumber, change: 0, reason: 'bye' });
                } else {
                  const t1score = m.team1Score || 0, t2score = m.team2Score || 0;
                  [...m.team1, ...m.team2].forEach(pid => {
                    const changes = changesMap.get(pid)!;
                    const isOnTeam1 = m.team1.includes(pid);
                    const myScore = isOnTeam1 ? t1score : t2score;
                    const oppScore = isOnTeam1 ? t2score : t1score;
                    if (myScore > oppScore) changes.wins++;
                    else if (oppScore > myScore) changes.losses++;
                    changes.pointsFor += myScore;
                    changes.pointsAgainst += oppScore;
                  });
                }
              });
            });
            
            // Apply all changes in ONE setStandings call
            setStandings(prev => prev.map(s => {
              const changes = changesMap.get(s.id)!;
              return {
                ...s,
                seedAdjustment: 0,
                byeCount: changes.byeCount,
                sitOutCount: 0,
                wins: changes.wins,
                losses: changes.losses,
                ties: 0,
                pointsFor: changes.pointsFor,
                pointsAgainst: changes.pointsAgainst,
                orderHistory: changes.orderHistory,
              };
            }));
          }}
        />
      </div>
    </div>
  );
}
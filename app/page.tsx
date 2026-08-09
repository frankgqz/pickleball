"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import SettingsPanel from "../components/SettingsPanel";
import PlayerDatabase from "../components/PlayerDatabase";
import EventPool from "../components/EventPool";
import CourtsPanel from "../components/CourtsPanel";
import StandingsTable from "../components/StandingsTable";
import RoundHistoryPanel from "../components/RoundHistoryPanel";
import {
  Player,
  StandingsEntry,
  TournamentConfig,
  Match,
  CompletedRound,
  RoundState,
  GameSession,
} from "../components/Types";

// Server actions for Neon PostgreSQL database
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "./actions";

// Define MatchFormat locally since it's used but not exported from Types
type MatchFormat = "PICK_PARTNER" | "FIXED_14V23";

// --- localStorage helpers (browser-only) ---------------------- //
const STORAGE_KEY_ROUNDS = "pickleball_rounds_v1";
const STORAGE_KEY_PLAYERS = "pickleball_players_v1";
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

// --- Initial config defaults ---------------------- //
const initialConfig: TournamentConfig = {
  format: "STANDARD",
  orderGap: 0.25,
  band: 1,
  winLossMagnitude: 1,
  courtBonus: 1, // Wtop/Lbottom default 1
  byeTopProtection: 8,
  byeBonusTop: 0.5,
  sitProtection: 0.5,
  lateJoinBonus: 1, // default late join bonus = 1
  courts: 5, // default 5 courts
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
  const [eventPool, setEventPool] = useState<Player[]>([]);

  // Standings entries
  const [standings, setStandings] = useState<StandingsEntry[]>([]);

  // Config
  const [config, setConfig] = useState<TournamentConfig>(() => {
    return initialConfig;
  });

  // Round state
  const [roundState, setRoundState] = useState<RoundState>({ active: false, format: "PICK_PARTNER", matches: [], submitted: false });

  // Session and history
  const [currentSession, setCurrentSession] = useState<GameSession>(() => ({ sessionId: Date.now().toString(), startDate: new Date().toISOString() }));
  const [roundHistory, setRoundHistory] = useState<CompletedRound[]>(() => loadRoundsFromStorage());

  // UI helpers
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [standingsSortColumn, setStandingsSortColumn] = useState("seedTotal");
  const [standingsSortDirection, setStandingsSortDirection] = useState<"asc" | "desc">("asc");

  // Standings sorting handler
  const handleStandingsSort = useCallback((column: string) => {
    if (column === standingsSortColumn) {
      setStandingsSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setStandingsSortColumn(column);
      setStandingsSortDirection("asc");
    }
  }, [standingsSortColumn]);

  // derived: rounds in current session
  const currentSessionRounds = useMemo(() => roundHistory.filter(r => r.sessionId === currentSession.sessionId).sort((a,b)=>a.roundNumber - b.roundNumber), [roundHistory, currentSession]);
  const currentRoundNumber = currentSessionRounds.length + 1;

  // --- Helpers: computed values ---------------------- //
  const getSeedTotal = (e: StandingsEntry) => (e.seed || 0) + (e.seedAdjustment || 0);
  const getByeTotal = (e: StandingsEntry) => (e.byeBase || 0) + (e.byeCount || 0) + ((e.sitOutCount || 0) * (config.sitProtection || 0)) + (e.byeMod || 0);
  const getPointDiff = (e: StandingsEntry) => (e.pointsFor || 0) - (e.pointsAgainst || 0);
  const getPtsPct = (e: StandingsEntry) => {
    const pf = e.pointsFor || 0; const pa = e.pointsAgainst || 0;
    if (pf + pa === 0) return 0;
    return (pf / (pf + pa)) * 100;
  };

  // --- Seed / bye recalculations ---------------------- //
  const recalculateSeeds = () => {
    // Sort standings by duprScore descending, assign seed = 1 + index*orderGap
    setStandings(prev => {
      const sorted = [...prev].sort((a,b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      return sorted.map((entry, i) => ({ ...entry, seed: 1 + i * config.orderGap }));
    });
  };

  const regenerateByes = () => {
    // Regenerate byeBase (random roll + top bonuses), keep byeCount and byeMod
    setStandings(prev => {
      const updated = [...prev].sort((a,b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      const topHalf = Math.floor(config.byeTopProtection / 2);
      return updated.map((entry, idx) => {
        const baseRoll = -Math.random(); // -1..0
        let byeBase = baseRoll;
        if (idx < topHalf) byeBase = baseRoll + config.byeBonusTop;
        else if (idx < config.byeTopProtection) byeBase = baseRoll + (config.byeBonusTop / 2);
        return { ...entry, byeBase };
      });
    });
  };

  // --- Persistence: save players on change ---------------------- //
  useEffect(() => {
    savePlayersToStorage(players);
  }, [players]);

  useEffect(() => {
    // persist round history
    saveRoundsToStorage(roundHistory);
  }, [roundHistory]);

  // --- Player handlers ---------------------- //
  // Load players from Neon PostgreSQL on mount
  useEffect(() => {
    loadPlayersFromDb();
  }, []);

  async function loadPlayersFromDb() {
    try {
      setLoading(true);
      const result = await getPlayers();
      if (result.success) {
        setPlayers(result.players || []);

        // Also load rounds from localStorage
        const savedRounds = loadRoundsFromStorage();
        if (savedRounds.length > 0) {
          setRoundHistory(savedRounds);
        }

        // Also load current session from localStorage
        const savedSession = localStorage.getItem("pickleball_session_v1");
        if (savedSession) {
          try {
            setCurrentSession(JSON.parse(savedSession));
          } catch {
            // Invalid session, keep default
          }
        }

        // Also load standings from localStorage (only if same session)
        const savedStandings = localStorage.getItem("pickleball_standings_v1");
        if (savedStandings && currentSession) {
          try {
            const parsed = JSON.parse(savedStandings);
            // Only load if standings belong to current session
            if (parsed.sessionId === currentSession.sessionId) {
              setStandings(parsed.entries || []);
            } else {
              // Different session - clear standings
              setStandings([]);
              localStorage.removeItem("pickleball_standings_v1");
            }
          } catch {
            // Invalid standings, clear and continue
            setStandings([]);
            localStorage.removeItem("pickleball_standings_v1");
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
      // Add to top of list (newest first)
      setPlayers(prev => [result.player, ...prev]);
      // Automatically add to event pool and standings
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
    setEventPool(prev => [player, ...prev]); // newest at top
    // initialize standings entry if missing
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
        wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0,
      }];
    });
    // recalc seeds after addition
    setTimeout(() => recalculateSeeds(), 0);
  };

  const removeFromPool = (playerId: string) => {
    setEventPool(prev => prev.filter(p => p.id !== playerId));
    // remove from standings or keep but not shown? We'll keep standings but remove entry
    setStandings(prev => prev.filter(s => s.id !== playerId));
    setTimeout(() => recalculateSeeds(), 0);
  };

  const toggleSitting = (playerId: string) => {
    setEventPool(prev => prev.map(p => p.id === playerId ? { ...p, isSitting: !p.isSitting } : p));
    // mark sittingout in temp list used at submit; we track sitOutCount only on submitRoundResults
  };

  // --- Match generation ---------------------- //
  const generateMatches = (format: MatchFormat) => {
    const activePlayers = eventPool.filter(p => !p.isSitting);
    const playersPerCourt = 4;
    const maxPlayersForCourts = config.courts * playersPerCourt;

    let byeCount = 0;
    if (activePlayers.length > maxPlayersForCourts) {
      byeCount = activePlayers.length - maxPlayersForCourts;
    } else {
      byeCount = activePlayers.length % playersPerCourt;
    }

    // STEP 0 (ROUND 1 ONLY): Regenerate byeBase FIRST, before determining byes
    // This ensures top players get their bye bonus before byes are assigned
    if (currentRoundNumber === 1) {
      const topHalf = Math.floor(config.byeTopProtection / 2);
      const tempByeMap = new Map<string, number>();
      
      // Calculate new byeBase values for all standings entries (sorted by DUPR)
      const sortedStandings = [...standings].sort((a,b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      sortedStandings.forEach((entry, idx) => {
        const baseRoll = -Math.random();
        let byeBase = baseRoll;
        if (idx < topHalf) byeBase = baseRoll + config.byeBonusTop;
        else if (idx < config.byeTopProtection) byeBase = baseRoll + (config.byeBonusTop / 2);
        tempByeMap.set(entry.id, byeBase);
      });

      // Update standings with new byeBase values
      setStandings(prev => prev.map(entry => ({
        ...entry,
        byeBase: tempByeMap.get(entry.id) ?? entry.byeBase,
      })));

      // Use the NEW byeBase values for bye determination immediately
      const activeStandings = standings.filter(s => activePlayers.some(p => p.id === s.id));
      const sortedByBye = [...activeStandings].sort((a, b) => {
        const aBye = tempByeMap.get(a.id) ?? a.byeBase ?? 0;
        const bBye = tempByeMap.get(b.id) ?? b.byeBase ?? 0;
        return aBye - bBye;
      });
      const byePlayerIds = sortedByBye.slice(0, byeCount).map(s => s.id);

      // ... rest of match generation using byePlayerIds
      const remainingPlayers = activePlayers.filter(p => !byePlayerIds.includes(p.id));
      const remainingOrdered = remainingPlayers.sort((a,b) => {
        const aEntry = standings.find(s => s.id === a.id)!, bEntry = standings.find(s => s.id === b.id)!;
        return getSeedTotal(aEntry) - getSeedTotal(bEntry);
      }).map(p => p.id);

      const matches: Match[] = [];
      let courtNum = 1;
      for (let i=0;i < remainingOrdered.length; i += playersPerCourt) {
        const group = remainingOrdered.slice(i, i + playersPerCourt);
        if (group.length === playersPerCourt) {
          matches.push({ id: `m-${courtNum}`, court: courtNum, team1: [group[0], group[3]], team2: [group[1], group[2]], team1Score: undefined, team2Score: undefined, bye: false });
          courtNum++;
        } else {
          group.forEach(pid => byePlayerIds.push(pid));
        }
      }

      byePlayerIds.forEach((pid, idx) => {
        matches.push({ id: `bye-${idx+1}`, court: 0, team1: [pid], team2: [], bye: true, byePlayerId: pid });
      });

      setRoundState({ active: true, format, matches, submitted: false });
      return;
    }

    // STEP 1 (ROUND 2+): Determine forced byes using byeTotal
    const activeStandings = standings.filter(s => activePlayers.some(p => p.id === s.id));
    const sortedByBye = [...activeStandings].sort((a,b) => getByeTotal(a) - getByeTotal(b));
    const byePlayerIds = sortedByBye.slice(0, byeCount).map(s => s.id);

    // STEP 2: remaining players ordered by seedTotal
    const remainingPlayers = activePlayers.filter(p => !byePlayerIds.includes(p.id));
    const remainingOrdered = remainingPlayers.sort((a,b) => {
      const aEntry = standings.find(s => s.id === a.id)!, bEntry = standings.find(s => s.id === b.id)!;
      return getSeedTotal(aEntry) - getSeedTotal(bEntry);
    }).map(p => p.id);

    // STEP 3: make full courts only
    const matches: Match[] = [];
    let courtNum = 1;
    for (let i=0;i < remainingOrdered.length; i += playersPerCourt) {
      const group = remainingOrdered.slice(i, i + playersPerCourt);
      if (group.length === playersPerCourt) {
        if (format === "PICK_PARTNER") {
          matches.push({ id: `m-${courtNum}`, court: courtNum, team1: [group[0], group[3]], team2: [group[1], group[2]], team1Score: undefined, team2Score: undefined, bye: false });
        } else {
          matches.push({ id: `m-${courtNum}`, court: courtNum, team1: [group[0], group[3]], team2: [group[1], group[2]], team1Score: undefined, team2Score: undefined, bye: false });
        }
        courtNum++;
      } else {
        // remaining < 4 -> they'll be treated as byes (force them)
        group.forEach(pid => {
          byePlayerIds.push(pid);
        });
      }
    }

    // add bye matches
    byePlayerIds.forEach((pid, idx) => {
      matches.push({ id: `bye-${idx+1}`, court: 0, team1: [pid], team2: [], bye: true, byePlayerId: pid });
    });

    setRoundState({ active: true, format, matches, submitted: false });
  };

  // --- Pool/Finals match generation ---------------------- //
  const generatePoolMatches = () => {
    const poolConfig = config.poolFinals || {
      poolsCount: 2,
      finalistsPerPool: 2,
      finalsFormat: "top2_to_semis",
      advancementCriteria: "wins",
      groupStageWinsFor: 1,
      finalsWinsFor: 1,
    };

    // Get active players sorted by DUPR (highest first)
    const activePlayers = eventPool
      .filter(p => !p.isSitting)
      .sort((a, b) => {
        const aScore = a.duprScore ?? 0;
        const bScore = b.duprScore ?? 0;
        return bScore - aScore;
      });

    const poolsCount = poolConfig.poolsCount;
    const playersPerPool = Math.ceil(activePlayers.length / poolsCount);

    // Distribute players into pools (seeding based on DUPR)
    const pools: Player[][] = Array.from({ length: poolsCount }, () => []);
    activePlayers.forEach((player, idx) => {
      const poolIdx = idx % poolsCount;
      pools[poolIdx].push(player);
    });

    // Generate round-robin matches within each pool
    const allMatches: Match[] = [];
    let globalCourtNum = 1;

    pools.forEach((pool, poolIdx) => {
      const poolId = `pool-${poolIdx + 1}`;
      const poolMatches = generateRoundRobin(pool, poolId, globalCourtNum);
      allMatches.push(...poolMatches);
      globalCourtNum += poolMatches.filter(m => !m.bye).length;
    });

    setRoundState({ 
      active: true, 
      format: "POOL_PLAY", 
      matches: allMatches, 
      submitted: false,
      poolId: undefined,
      stage: "pool"
    });
  };

  // Generate round-robin matches for a pool of players
  const generateRoundRobin = (players: Player[], poolId: string, startCourt: number): Match[] => {
    const matches: Match[] = [];
    const n = players.length;
    let courtNum = startCourt;

    // Simple round-robin: each player plays every other player once
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        matches.push({
          id: `pool-${poolId}-m${courtNum}`,
          court: courtNum,
          team1: [players[i].id],
          team2: [players[j].id],
          team1Score: undefined,
          team2Score: undefined,
          bye: false,
        });
        courtNum++;
      }
    }

    return matches;
  };

  // --- match helpers ---------------------- //
  const updateMatchScore = (matchId: string, score: number, team: "team1" | "team2") => {
    setRoundState(prev => ({ ...prev, matches: prev.matches.map(m => m.id === matchId ? ({ ...m, [team+"Score"]: score }) : m) }));
  };

  const swapPlayerTeam = (matchId: string, playerId: string) => {
    setRoundState(prev => ({ ...prev, matches: prev.matches.map(m => {
      if (m.id !== matchId) return m;
      const picker = m.team1[0];
      const partner = m.team1[1];
      // Only allow partner swap with someone from team2
      if (playerId === picker) return m;
      if (m.team2.includes(playerId)) {
        return { ...m, team1: [picker, playerId], team2: [...m.team2.filter(id => id !== playerId), partner] };
      }
      return m;
    }) }));
  };

  // --- submit round ---------------------- //
  const submitRoundResults = () => {
    const activePlayers = eventPool.filter(p => !p.isSitting);
    const byePlayerIds = roundState.matches.filter(m => m.bye).map(m => m.byePlayerId).filter(Boolean) as string[];

    // apply results to standings
    setStandings(prev => {
      // make a map for quick lookup
      const map = new Map<string, StandingsEntry>(prev.map(s => [s.id, { ...s }]));
      // apply each match
      roundState.matches.forEach(m => {
        if (m.bye && m.byePlayerId) {
          const s = map.get(m.byePlayerId);
          if (s) { s.byeCount = (s.byeCount||0) + 1; s.orderHistory = [...s.orderHistory, { round: currentRoundNumber, change: 0, reason: "bye" }]; map.set(s.id, s); }
        } else {
          // normal match
          const team1Ids = m.team1, team2Ids = m.team2;
          const t1score = m.team1Score || 0, t2score = m.team2Score || 0;
          const t1won = t1score > t2score;
          const t2won = t2score > t1score;
          // apply to each player on both teams
          [...team1Ids, ...team2Ids].forEach(pid => {
            const s = map.get(pid);
            if (!s) return;
            const isOnTeam1 = team1Ids.includes(pid);
            const myScore = isOnTeam1 ? t1score : t2score;
            const oppScore = isOnTeam1 ? t2score : t1score;
            const won = myScore > oppScore;
            const played = myScore > 0 || oppScore > 0;
            if (won) s.wins = (s.wins||0) + 1;
            else if (played) s.losses = (s.losses||0) + 1;
            s.pointsFor = (s.pointsFor||0) + myScore;
            s.pointsAgainst = (s.pointsAgainst||0) + oppScore;

            // compute orderChange following rules:
            // top court = match.court===1 ; bottom court = last filled (calc earlier when starting)
            const activeCount = activePlayers.length;
            const filledCourts = Math.ceil((activeCount - byePlayerIds.length) / 4) || 1;
            const isTop = m.court === 1;
            const isBottom = m.court === filledCourts;
            let orderChange = 0;
            if (isTop) orderChange = won ? -config.courtBonus : config.winLossMagnitude;
            else if (isBottom) orderChange = won ? -config.winLossMagnitude : config.courtBonus;
            else orderChange = won ? -config.winLossMagnitude : config.winLossMagnitude;

            // apply with band clamping
            const rawAdj = (s.seedAdjustment||0) + orderChange;
            const minSeedTotal = 1 - config.band;
            const maxSeedTotal = 1 + config.band + ((prev.length - 1) * config.orderGap);
            const clampedAdj = Math.max(minSeedTotal - s.seed, Math.min(maxSeedTotal - s.seed, rawAdj));
            s.orderHistory = [...(s.orderHistory||[]), { round: currentRoundNumber, change: clampedAdj - (s.seedAdjustment||0), reason: (isTop ? "top" : isBottom ? "bottom" : `court ${m.court}`) + (won ? " win" : " loss") }];
            s.seedAdjustment = clampedAdj;
            map.set(s.id, s);
          });
        }
      });
      return Array.from(map.values());
    });

    // persist round in history
    const completedRound: CompletedRound = {
      roundNumber: currentRoundNumber,
      date: new Date().toISOString(),
      format: roundState.format,
      matches: roundState.matches,
      sittingOut: eventPool.filter(p => p.isSitting).map(p=>p.id),
      sessionId: currentSession.sessionId,
    };
    const newHistory = [...roundHistory, completedRound];
    setRoundHistory(newHistory);
    saveRoundsToStorage(newHistory);

    // mark round submitted
    setRoundState(prev => ({ ...prev, submitted: true }));
  };

  // --- Settings change handler ---------------------- //
  const updateConfig = <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    // When key affects seeds or byes, recalc seed and byeBase (no reset of byeCount/seedAdjustment)
    const keysThatAffect = ["band","orderGap","byeTopProtection","byeBonusTop","sitProtection","lateJoinBonus","courtBonus","winLossMagnitude","courts"] as (keyof TournamentConfig)[];
    if (keysThatAffect.includes(key)) {
      setTimeout(() => {
        recalculateSeeds();
        // refresh byeBase only (preserve byeCount)
        setStandings(prev => prev.map(s => ({ ...s, byeBase: (function(){ const base = -Math.random(); return base; })() })));
      }, 0);
    }
  };

  // --- Simple UI wiring for components ---------------------- //

  // Auto-save standings to localStorage when they change (include sessionId)
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

  // --- Restart event handler ---------------------- //
  const handleRestartEvent = useCallback(() => {
    setRoundHistory([]);
    saveRoundsToStorage([]);
    // Clear standings completely for new session (don't keep old data)
    setStandings([]);
    if (isBrowser) {
      localStorage.removeItem("pickleball_standings_v1");
    }
    setRoundState({ active: false, format: "PICK_PARTNER", matches: [], submitted: false });
    // Start fresh session and save to localStorage
    const newSession: GameSession = {
      sessionId: Date.now().toString(),
      startDate: new Date().toISOString(),
    };
    setCurrentSession(newSession);
    if (isBrowser) {
      localStorage.setItem("pickleball_session_v1", JSON.stringify(newSession));
    }
  }, []);

  const handleCancelRound = useCallback(() => {
    setRoundState({ active: false, format: "PICK_PARTNER", matches: [], submitted: false });
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  // Error state
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
            onToggleSitting={(id)=>{ setEventPool(prev => prev.map(p=> p.id===id? {...p, isSitting: !p.isSitting} : p)) }}
            onRemoveFromPool={(id)=> removeFromPool(id)}
          />
        </div>

        <RoundHistoryPanel
          roundHistory={roundHistory}
          currentSessionId={currentSession.sessionId}
          eventPool={eventPool}
          onEditRound={(updated: CompletedRound) => {
            // Replace the round in history
            const newHistory = roundHistory.map(r => 
              r.roundNumber === updated.roundNumber && r.sessionId === updated.sessionId ? updated : r
            );
            setRoundHistory(newHistory);
            saveRoundsToStorage(newHistory);
            
            // Recalculate standings from all rounds (including edited one)
            const sessionRounds = newHistory
              .filter(r => r.sessionId === currentSession.sessionId)
              .sort((a, b) => a.roundNumber - b.roundNumber);
            
            // Reset standings
            setStandings(prev => prev.map(s => ({
              ...s,
              seedAdjustment: 0,
              byeCount: 0,
              sitOutCount: 0,
              wins: 0,
              losses: 0,
              ties: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              orderHistory: [],
            })));
            
            // Replay all rounds
            sessionRounds.forEach(r => {
              r.matches.forEach(m => {
                if (m.bye && m.byePlayerId) {
                  setStandings(prev => prev.map(s => {
                    if (s.id === m.byePlayerId) {
                      return {
                        ...s,
                        byeCount: (s.byeCount || 0) + 1,
                        orderHistory: [...(s.orderHistory || []), { round: r.roundNumber, change: 0, reason: 'bye' }],
                      };
                    }
                    return s;
                  }));
                } else {
                  const t1score = m.team1Score || 0;
                  const t2score = m.team2Score || 0;
                  [...m.team1, ...m.team2].forEach(pid => {
                    setStandings(prev => prev.map(s => {
                      if (s.id !== pid) return s;
                      const isOnTeam1 = m.team1.includes(pid);
                      const myScore = isOnTeam1 ? t1score : t2score;
                      const oppScore = isOnTeam1 ? t2score : t1score;
                      let wins = s.wins || 0;
                      let losses = s.losses || 0;
                      if (myScore > oppScore) wins++;
                      else if (oppScore > myScore) losses++;
                      return {
                        ...s,
                        wins,
                        losses,
                        pointsFor: (s.pointsFor || 0) + myScore,
                        pointsAgainst: (s.pointsAgainst || 0) + oppScore,
                      };
                    }));
                  });
                }
              });
            });
          }}
          onDeleteRound={(roundNumber, sessionId)=> {
            const newHistory = roundHistory.filter(r => !(r.roundNumber===roundNumber && r.sessionId===sessionId));
            setRoundHistory(newHistory);
            saveRoundsToStorage(newHistory);
            if (sessionId === currentSession.sessionId) {
              setStandings((prev: StandingsEntry[]) => {
                const baseMap = new Map<string, StandingsEntry>();
                prev.forEach(s => {
                  baseMap.set(s.id, { ...s, seedAdjustment: 0, byeCount: 0, sitOutCount: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, orderHistory: [] });
                });
                const sessionRoundsSorted = newHistory.filter(r => r.sessionId===sessionId).sort((a,b)=>a.roundNumber-b.roundNumber);
                sessionRoundsSorted.forEach(r => {
                  r.matches.forEach(m => {
                    if (m.bye && m.byePlayerId) {
                      const s = baseMap.get(m.byePlayerId);
                      if (s) { s.byeCount = (s.byeCount||0)+1; s.orderHistory.push({ round: r.roundNumber, change: 0, reason: 'bye' }); }
                    } else {
                      const team1Ids = m.team1, team2Ids = m.team2;
                      const t1score = m.team1Score || 0, t2score = m.team2Score || 0;
                      [...team1Ids, ...team2Ids].forEach(pid => {
                        const s = baseMap.get(pid);
                        if (s) {
                          const isOnTeam1 = team1Ids.includes(pid);
                          const myScore = isOnTeam1 ? t1score : t2score;
                          const oppScore = isOnTeam1 ? t2score : t1score;
                          if (myScore > oppScore) s.wins = (s.wins||0) + 1;
                          else if (myScore > 0 || oppScore > 0) s.losses = (s.losses||0) + 1;
                          s.pointsFor = (s.pointsFor||0) + myScore;
                          s.pointsAgainst = (s.pointsAgainst||0) + oppScore;
                        }
                      });
                    }
                  });
                });
                return Array.from(baseMap.values());
              });
            }
          }}
        />

        <CourtsPanel
          roundState={roundState}
          eventPool={eventPool}
          standings={standings}
          currentRoundNumber={currentRoundNumber}
          defaultRoundFormat={config.roundFormat || "FIXED_14V23"}
          onStartPickPartner={() => { if (currentRoundNumber === 1) regenerateByes(); generateMatches("PICK_PARTNER"); }}
          onStartFixed14v23={() => { if (currentRoundNumber === 1) regenerateByes(); generateMatches("FIXED_14V23"); }}
          onRegenerateByes={regenerateByes}
          onUpdateMatchScore={updateMatchScore}
          onSwapPlayerTeam={swapPlayerTeam}
          onSubmitRound={submitRoundResults}
          onCancelRound={handleCancelRound}
          onStartNextRound={() => {
            // Generate next round matchups based on current format and round format
            if (config.format === "POOL_PLAY") {
              generatePoolMatches();
            } else {
              const roundFmt = config.roundFormat || "FIXED_14V23";
              generateMatches(roundFmt as MatchFormat);
            }
          }}
          submitted={roundState.submitted}
        />

        <StandingsTable
          standings={standings}
          onRegenerateByes={regenerateByes}
          sortColumn={standingsSortColumn}
          sortDirection={standingsSortDirection}
          onSortChange={handleStandingsSort}
        />
      </div>
    </div>
  );
}
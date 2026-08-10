"use client";

// useStandingsState.ts - Standings state, sorting, and calculations
// Handles: standings entries, sorting, percentage calculations, persistence

import { useState, useCallback, useMemo } from "react";
import { StandingsEntry, CompletedRound, TournamentConfig, Player, Match } from "@/components/Types";
import { localStorageDb } from "./useLocalStorage";
import { 
  sortStandings, 
  computeStandingsEntries,
  recalculateStandingsFromHistory,
  processMatchResult,
  createStandingsEntry,
} from "../standingsUtils";

export interface StandingsState {
  // Raw standings entries
  standings: StandingsEntry[];
  // Current sort settings
  sortColumn: string;
  sortDirection: "asc" | "desc";
  // Computed standings (with win% and pts% calculated, sorted for display)
  computedStandings: StandingsEntry[];
  // Setter for standings (exposed for direct manipulation)
  setStandings: React.Dispatch<React.SetStateAction<StandingsEntry[]>>;
}

export interface StandingsActions {
  toggleSortColumn: (column: string) => void;
  recalculateStandingsFromHistory: (
    history: CompletedRound[], 
    sessionId: string, 
    config: TournamentConfig, 
    pool: Player[]
  ) => void;
  removePlayerStandingsEntry: (playerId: string) => void;
  addPlayerStandingsEntry: (
    player: Player, 
    orderGap: number, 
    roundNumber: number, 
    lateJoinBonus: number
  ) => void;
  processMatchResults: (
    matches: Match[], 
    roundNumber: number, 
    config: TournamentConfig, 
    pool: Player[]
  ) => void;
  regenerateByes: (byeTopProtection: number, byeBonusTop: number) => void;
}

export function useStandingsState(): [StandingsState, StandingsActions] {
  // Load saved standings from localStorage on init
  const [standings, setStandings] = useState<StandingsEntry[]>(() => {
    const session = localStorageDb.loadSession();
    if (session) {
      return localStorageDb.loadStandings(session.sessionId);
    }
    return [];
  });

  const [sortColumn, setSortColumn] = useState("seedTotal");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Computed standings for display (with winPct, ptsPct calculated and sorted)
  const computedStandings = useMemo(() => {
    return sortStandings(
      computeStandingsEntries(standings),
      sortColumn,
      sortDirection
    );
  }, [standings, sortColumn, sortDirection]);

  // Persist standings to localStorage
  const persistStandings = useCallback((entries: StandingsEntry[]) => {
    const session = localStorageDb.loadSession();
    if (session) {
      localStorageDb.saveStandings(entries, session.sessionId);
    }
  }, []);

  // Wrapper that also persists
  const setStandingsAndPersist = useCallback((updater: React.SetStateAction<StandingsEntry[]>) => {
    setStandings(prev => {
      const updated = typeof updater === 'function' ? (updater as (prev: StandingsEntry[]) => StandingsEntry[])(prev) : updater;
      persistStandings(updated);
      return updated;
    });
  }, [persistStandings]);

  // Actions
  const toggleSortColumn = useCallback((column: string) => {
    if (column === sortColumn) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  }, [sortColumn]);

  const doRecalculateFromHistory = useCallback((
    history: CompletedRound[],
    sessionId: string,
    config: TournamentConfig,
    pool: Player[]
  ) => {
    const newStandings = recalculateStandingsFromHistory(
      standings,
      history,
      sessionId,
      config,
      pool
    );
    setStandings(newStandings);
    persistStandings(newStandings);
  }, [standings, persistStandings]);

  const removePlayerStandingsEntry = useCallback((playerId: string) => {
    setStandingsAndPersist(prev => prev.filter(s => s.id !== playerId));
  }, [setStandingsAndPersist]);

  const addPlayerStandingsEntry = useCallback((
    player: Player, 
    orderGap: number, 
    roundNumber: number, 
    lateJoinBonus: number
  ) => {
    setStandingsAndPersist(prev => {
      if (prev.find(s => s.id === player.id)) return prev;
      const newEntry = createStandingsEntry(
        player, 
        prev.length, 
        orderGap, 
        roundNumber > 1 ? lateJoinBonus : 0
      );
      return [...prev, newEntry];
    });
  }, [setStandingsAndPersist]);

  const processMatchResults = useCallback((
    matches: Match[],
    roundNumber: number,
    config: TournamentConfig,
    pool: Player[]
  ) => {
    setStandingsAndPersist(prev => {
      const updated = [...prev];
      
      matches.forEach(m => {
        if (m.bye && m.byePlayerId) {
          const idx = updated.findIndex(s => s.id === m.byePlayerId);
          if (idx >= 0) {
            updated[idx] = {
              ...updated[idx],
              byeCount: (updated[idx].byeCount || 0) + 1,
              orderHistory: [
                ...(updated[idx].orderHistory || []),
                { round: roundNumber, change: 0, reason: "bye" }
              ]
            };
          }
        } else {
          const allPlayerIds = [...m.team1, ...m.team2].filter((id): id is string => Boolean(id));
          allPlayerIds.forEach(playerId => {
            const idx = updated.findIndex(s => s.id === playerId);
            if (idx >= 0) {
              updated[idx] = processMatchResult(updated[idx], {
                match: m,
                eventPool: pool,
                config,
                roundNumber,
              });
            }
          });
        }
      });
      
      return updated;
    });
  }, [setStandingsAndPersist]);

  const regenerateByes = useCallback((byeTopProtection: number, byeBonusTop: number) => {
    setStandingsAndPersist(prev => {
      const sorted = [...prev].sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
      const topHalf = Math.floor(byeTopProtection / 2);

      return sorted.map((entry, idx) => {
        const baseRoll = -Math.random();
        let byeBase = baseRoll;
        
        if (idx < topHalf) {
          byeBase = baseRoll + byeBonusTop;
        } else if (idx < byeTopProtection) {
          byeBase = baseRoll + (byeBonusTop / 2);
        }
        
        return { ...entry, byeBase };
      });
    });
  }, [setStandingsAndPersist]);

  // State
  const state: StandingsState = {
    standings,
    sortColumn,
    sortDirection,
    computedStandings,
    setStandings,
  };

  // Actions
  const actions: StandingsActions = {
    toggleSortColumn,
    recalculateStandingsFromHistory: doRecalculateFromHistory,
    removePlayerStandingsEntry,
    addPlayerStandingsEntry,
    processMatchResults,
    regenerateByes,
  };

  return [state, actions];
}
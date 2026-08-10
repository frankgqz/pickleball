// useMatchGeneration.ts - Match generation and management
// Handles: creating matches for rounds, updating scores, swapping players
// Renamed from useMatchEngine for clarity

import { useCallback } from "react";
import { Player, StandingsEntry, TournamentConfig, Match, MatchFormat, RoundState } from "@/components/Types";
import { generateMatches } from "../MatchEngine";

export interface MatchGenerationState {
  // Current round state
  roundState: RoundState;
  // Is a round currently active?
  isRoundActive: boolean;
  // Has the current round been submitted?
  isRoundSubmitted: boolean;
}

export interface MatchGenerationActions {
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>;
  generateStandardMatches: (format: MatchFormat) => { matches: Match[]; byes: { playerId: string; seedValue: number }[] };
  generatePoolPlayMatches: (poolsCount: number) => Match[];
  updateMatchScore: (matchId: string, score: number, team: "team1" | "team2") => void;
  swapPlayerTeam: (matchId: string, playerId: string) => void;
  cancelRound: () => void;
}

export function useMatchGeneration(
  eventPool: Player[],
  standings: StandingsEntry[],
  config: TournamentConfig,
  currentRoundNumber: number,
  roundState: RoundState,
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>,
  regenerateByesFn: () => void
): [MatchGenerationState, MatchGenerationActions] {

  // Generate matches for PICK_PARTNER or FIXED_14V23 formats
  const generateStandardMatches = useCallback((format: MatchFormat) => {
    const result = generateMatches(format, eventPool, standings, config, currentRoundNumber, null, null);
    setRoundState({ 
      active: true, 
      format, 
      matches: result.matches, 
      submitted: false 
    });
    return result;
  }, [eventPool, standings, config, currentRoundNumber, setRoundState]);

  // Generate pool play matches (round-robin within each pool)
  const generatePoolPlayMatches = useCallback((poolsCount: number) => {
    const activePlayers = eventPool.filter(p => !p.isSitting);
    const pools: Player[][] = Array.from({ length: poolsCount || 2 }, () => []);

    // Distribute players into pools
    activePlayers.forEach((player, idx) => {
      pools[idx % (poolsCount || 2)].push(player);
    });

    const generatedMatches: Match[] = [];
    let courtNum = 1;

    // Generate round-robin within each pool
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
      format: { type: "POOL_PLAY", poolsCount }, 
      matches: generatedMatches, 
      submitted: false, 
      stage: "pool" 
    });

    return generatedMatches;
  }, [eventPool, setRoundState]);

  // Update score for a specific match
  const updateMatchScore = useCallback((matchId: string, score: number, team: "team1" | "team2") => {
    setRoundState(prev => ({ 
      ...prev, 
      matches: prev.matches.map(m => 
        m.id === matchId ? ({ ...m, [team + "Score"]: score }) : m
      ) 
    }));
  }, [setRoundState]);

  // Swap a player from team2 to team1 (partner swap)
  const swapPlayerTeam = useCallback((matchId: string, playerId: string) => {
    setRoundState(prev => ({
      ...prev,
      matches: prev.matches.map(m => {
        if (m.id !== matchId) return m;
        
        const picker = m.team1[0];
        const partner = m.team1[1];
        
        // Can't swap the picker
        if (playerId === picker) return m;
        
        // If player is on team2, swap them with the partner
        if (Array.isArray(m.team2) ? m.team2.includes(playerId) : false) {
          const team2Array = m.team2 as unknown as string[];
          return { 
            ...m, 
            team1: [picker, playerId], 
            team2: [...team2Array.filter(id => id !== playerId), partner] 
          };
        }
        
        return m;
      })
    }));
  }, [setRoundState]);

  // Cancel the current round
  const cancelRound = useCallback(() => {
    setRoundState({ 
      active: false, 
      format: { type: "PICK_PARTNER", allowPartnerRepeat: false }, 
      matches: [], 
      submitted: false 
    });
  }, [setRoundState]);

  // State
  const state: MatchGenerationState = {
    roundState,
    isRoundActive: roundState.active,
    isRoundSubmitted: roundState.submitted,
  };

  // Actions
  const actions: MatchGenerationActions = {
    setRoundState,
    generateStandardMatches,
    generatePoolPlayMatches,
    updateMatchScore,
    swapPlayerTeam,
    cancelRound,
  };

  return [state, actions];
}
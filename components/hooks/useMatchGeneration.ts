"use client";

// useMatchGeneration.ts - Match generation and management
// Handles: creating matches for rounds, updating scores, swapping players

import { useCallback } from "react";
import { Player, StandingsEntry, TournamentConfig, Match, MatchFormat, RoundState } from "@/components/Types";
import { generateMatches } from "../MatchEngine";

export interface MatchGenerationState {
  roundState: RoundState;
  isRoundActive: boolean;
  isRoundSubmitted: boolean;
}

export interface MatchGenerationActions {
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>;
  generateStandardMatches: (format: MatchFormat) => Match[];
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
  const generateStandardMatches = useCallback((format: MatchFormat): Match[] => {
    // generateMatches signature: (format, pool, standings, config, roundNumber, byeMap, setStandings)
    const result = generateMatches(
      format,
      eventPool,
      standings,
      config,
      currentRoundNumber,
      null,  // byePlayerIdsMap - let it calculate internally
      undefined  // setStandings - we handle byeBase regeneration separately
    );
    
    setRoundState({ 
      active: true, 
      format, 
      matches: result.matches, 
      submitted: false 
    });
    return result.matches;
  }, [eventPool, standings, config, currentRoundNumber, setRoundState]);

  // Generate pool play matches (round-robin within each pool)
  const generatePoolPlayMatches = useCallback((poolsCount: number): Match[] => {
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

    const poolFormat: MatchFormat = { type: "POOL_PLAY", poolsCount };
    
    setRoundState({ 
      active: true, 
      format: poolFormat, 
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
        const team2Arr = Array.isArray(m.team2) ? m.team2 : [m.team2].filter(Boolean);
        if (team2Arr.includes(playerId)) {
          return { 
            ...m, 
            team1: [picker, playerId] as [string, string], 
            team2: [...team2Arr.filter(id => id !== playerId), partner] as [string, string] 
          };
        }
        
        return m;
      })
    }));
  }, [setRoundState]);

  // Cancel the current round
  const cancelRound = useCallback(() => {
    const defaultFormat: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };
    setRoundState({ 
      active: false, 
      format: defaultFormat, 
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
"use client";

// useMatchGeneration.ts - Match generation and management
// Handles: creating matches for rounds, updating scores, swapping players

import { useCallback } from "react";
import { Player, StandingsEntry, TournamentConfig, Match, MatchFormat, RoundState } from "@/components/Types";
import { generateMatches, getByeTotal } from "../MatchEngine";

// Format constants with proper literal types (avoids type inference issues)
const PICK_PARTNER_FORMAT: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };

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
    // SOCIAL: random partners and opponents — no seeds, no standings. Only
    // the BYE is fair: it goes to whoever has byed the least (lowest bye
    // total, ties broken randomly); the rest is pure shuffle.
    if (format.type === "SOCIAL") {
      const active = eventPool.filter(p => !p.isSitting);
      const rank = [...eventPool].sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0)).map(p => p.id);
      const entryOf = (p: Player) =>
        standings.find(s => s.id === p.id) ??
        ({ id: p.id, name: p.name, seed: rank.indexOf(p.id) + 1, seedAdjustment: 0 } as any);
      const leftovers = active.length % 4;
      let rest = [...active].sort(() => Math.random() - 0.5);
      const byePlayers: Player[] = [];
      if (leftovers > 0) {
        const byBye = [...rest].sort((a, b) => {
          const d = getByeTotal(entryOf(a)) - getByeTotal(entryOf(b));
          return d !== 0 ? d : Math.random() - 0.5;
        });
        byePlayers.push(...byBye.slice(0, leftovers));
        const byeIds = new Set(byePlayers.map(p => p.id));
        rest = rest.filter(p => !byeIds.has(p.id));
      }
      const matches: Match[] = [];
      let court = 1;
      while (rest.length >= 4) {
        const team1 = [rest[0].id, rest[1].id];
        const team2 = [rest[2].id, rest[3].id];
        rest.splice(0, 4);
        matches.push({ id: `m-social-${Date.now()}-${court}`, court: court++, team1, team2 });
      }
      for (const p of byePlayers) {
        matches.push({ id: `m-social-bye-${Date.now()}-${p.id}`, court: 0, team1: [], team2: [], bye: true, byePlayerId: p.id });
      }
      setRoundState({ active: true, format, matches, submitted: false });
      return matches;
    }
    // TEAMS: pairMap units (2) + individuals (1) pack into courts of 4.
    // Packing rule: PAIRS FIRST (seed order within each class) — the
    // first-fit-decreasing move that gives pairs their pair-vs-pair matches
    // whenever the roster allows; mixed 2+1+1 courts appear only when counts
    // force it. Within a court: a pair = a team; 4 individuals keep the
    // 14v23 spirit ([0]+[3] vs [1]+[2] by seed). Anyone unplaced takes a
    // bye — BOTH members of an unplaced pair (that is the rule).
    if (format.type === "TEAMS") {
      const pairMap: Record<string, string> = config.pairMap || {};
      const tRank = [...eventPool].sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0)).map(p => p.id);
      const seedOf = (p: Player) => {
        const s = standings.find(x => x.id === p.id);
        return (s?.seed ?? tRank.indexOf(p.id) + 1) + (s?.seedAdjustment ?? 0);
      };
      const used = new Set<string>();
      const units: { members: Player[]; order: number }[] = [];
      for (const p of eventPool) {
        if (p.isSitting || used.has(p.id)) continue;
        const partnerId = pairMap[p.id];
        const partner = partnerId ? eventPool.find(q => q.id === partnerId && !q.isSitting) : undefined;
        if (partner && pairMap[partner.id] === p.id && !used.has(partner.id)) {
          used.add(p.id); used.add(partner.id);
          units.push({ members: [p, partner], order: (seedOf(p) + seedOf(partner)) / 2 });
        } else {
          used.add(p.id);
          units.push({ members: [p], order: seedOf(p) });
        }
      }
      // pairs first, seed order within each class
      units.sort((a, b) => (b.members.length - a.members.length) || (a.order - b.order));
      const pool = [...units];
      const matches: Match[] = [];
      let court = 1;
      while (pool.length) {
        const courtUnits: typeof units = [];
        let slots = 4;
        while (slots > 0) {
          const idx = pool.findIndex(u => u.members.length <= slots);
          if (idx === -1) break;
          const u = pool.splice(idx, 1)[0];
          courtUnits.push(u);
          slots -= u.members.length;
        }
        const placed = courtUnits.flatMap(u => u.members);
        if (slots > 0) {
          // this court can't complete — these AND everyone remaining bye
          for (const p of [...placed, ...pool.flatMap(u => u.members)]) {
            matches.push({ id: `m-teams-bye-${Date.now()}-${p.id}`, court: 0, team1: [], team2: [], bye: true, byePlayerId: p.id });
          }
          break;
        }
        // team split: a pair = a team; 4 individuals = 14v23 within the court
        const byOrder = [...placed].sort((a, b) => seedOf(a) - seedOf(b));
        let team1: string[], team2: string[];
        const pairUnits = courtUnits.filter(u => u.members.length === 2);
        if (pairUnits.length === 2) {
          team1 = pairUnits[0].members.map(p => p.id);
          team2 = pairUnits[1].members.map(p => p.id);
        } else if (pairUnits.length === 1) {
          team1 = pairUnits[0].members.map(p => p.id);
          team2 = courtUnits.filter(u => u.members.length === 1).map(u => u.members[0].id);
        } else {
          team1 = [byOrder[0].id, byOrder[3].id];
          team2 = [byOrder[1].id, byOrder[2].id];
        }
        matches.push({ id: `m-teams-${Date.now()}-${court}`, court: court++, team1, team2 });
      }
      setRoundState({ active: true, format, matches, submitted: false });
      return matches;
    }

    // generateMatches signature: (format, pool, standings, config, roundNumber, byeMap, setStandings)
    // Round 1 runs in the same tick as regenerateByes — its setState hasn't
    // flushed yet, so build entries for anyone missing (seeded by DUPR order).
    const rank = [...eventPool].sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0)).map(p => p.id);
    const effStandings = eventPool.map(p =>
      standings.find(s => s.id === p.id) ??
      ({ id: p.id, name: p.name, seed: rank.indexOf(p.id) + 1, seedAdjustment: 0 } as any)
    );
    const result = generateMatches(
      format,
      eventPool,
      effStandings,
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
        const team2Arr = Array.isArray(m.team2) ? m.team2 : [m.team2].filter(Boolean);

        // The picker (t1/p1) is fixed; every click trades into the partner slot (t1/p2)
        if (playerId === picker || playerId === partner) return m;

        // t2 player -> partner slot; partner lands in the clicked player's position
        if (team2Arr.includes(playerId)) {
          const idx = team2Arr.indexOf(playerId);
          const newTeam2 = [...team2Arr];
          newTeam2[idx] = partner;
          return {
            ...m,
            team1: [picker, playerId] as [string, string],
            team2: newTeam2 as [string, string]
          };
        }

        // Available (unselected) player -> takes the partner slot
        return {
          ...m,
          team1: [picker, playerId] as [string, string],
        };
      })
    }));
  }, [setRoundState]);

  // Cancel the current round
  const cancelRound = useCallback(() => {
    setRoundState({ 
      active: false, 
      format: PICK_PARTNER_FORMAT, 
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
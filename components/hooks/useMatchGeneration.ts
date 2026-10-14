"use client";

// useMatchGeneration.ts - Match generation and management
// Handles: creating matches for rounds, updating scores, swapping players

import { useCallback } from "react";
import { Player, StandingsEntry, TournamentConfig, Match, MatchFormat, RoundState, CompletedRound } from "@/components/Types";
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
  roundHistory: CompletedRound[],
  roundState: RoundState,
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>,
  regenerateByesFn: () => void
): [MatchGenerationState, MatchGenerationActions] {

  // Generate matches for PICK_PARTNER or FIXED_14V23 formats
  const generateStandardMatches = useCallback((format: MatchFormat): Match[] => {
    // SOCIAL = "Random-ish pairings" (locked spec 2026-10-15):
    // w = 1 / (1 + 3·t²), t = effective times-together decaying with
    // half-life 15 rounds (derived from this event's match history — no
    // stored state). Draw = most-repeats-first ordering + sequential
    // weighted pick; then a SWAP PASS trades partners between team pairs
    // while total familiarity strictly drops. Byes stay fair: lowest bye
    // total sits (ties random).
    if (format.type === "SOCIAL") {
      const active = eventPool.filter(p => !p.isSitting);
      const rank = [...eventPool].sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0)).map(p => p.id);
      const entryOf = (p: Player) =>
        standings.find(s => s.id === p.id) ??
        ({ id: p.id, name: p.name, seed: rank.indexOf(p.id) + 1, seedAdjustment: 0 } as any);
      const leftovers = active.length % 4;
      const byeOrder = [...active].sort((a, b) => {
        const d = getByeTotal(entryOf(a)) - getByeTotal(entryOf(b));
        return d !== 0 ? d : Math.random() - 0.5;
      });
      const byePlayers = leftovers > 0 ? byeOrder.slice(0, leftovers) : [];
      const byeIds = new Set(byePlayers.map(p => p.id));
      const rest = active.filter(p => !byeIds.has(p.id));

      // effective times-together: every past partnership fades by half
      // every 15 rounds (2^(-ago/15))
      const pkey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
      const teff = new Map<string, number>();
      for (const r of roundHistory) {
        const decay = Math.pow(2, -Math.max(0, currentRoundNumber - r.roundNumber) / 15);
        for (const m of r.matches) {
          if (m.bye) continue;
          for (const team of [m.team1, m.team2]) {
            if (team && team.length === 2) {
              const k = pkey(team[0], team[1]);
              teff.set(k, (teff.get(k) || 0) + decay);
            }
          }
        }
      }
      const fam = (a: Player, b: Player) => teff.get(pkey(a.id, b.id)) || 0;
      const weight = (a: Player, b: Player) => 1 / (1 + 3 * fam(a, b) * fam(a, b));

      // most-repeats-first ordering (tiny jitter breaks ties)
      const pressure = (p: Player) => rest.reduce((s, q) => s + (q.id === p.id ? 0 : fam(p, q)), 0);
      const pickOrder = [...rest].sort((a, b) => (pressure(b) - pressure(a)) || (Math.random() - 0.5));

      // sequential weighted pick
      const used = new Set<string>();
      const teams: Player[][] = [];
      for (const i of pickOrder) {
        if (used.has(i.id)) continue;
        const cands = pickOrder.filter(j => j.id !== i.id && !used.has(j.id));
        const w = cands.map(j => weight(i, j));
        const total = w.reduce((a, b) => a + b, 0);
        let x = Math.random() * total;
        let pick = cands[cands.length - 1];
        for (let ci = 0; ci < cands.length; ci++) {
          x -= w[ci];
          if (x <= 0) { pick = cands[ci]; break; }
        }
        used.add(i.id);
        used.add(pick.id);
        teams.push([i, pick]);
      }

      // swap pass: trade partners between team pairs while the total
      // familiarity of the round strictly drops
      let improved = true;
      while (improved) {
        improved = false;
        outer:
        for (let a = 0; a < teams.length; a++) {
          for (let b = a + 1; b < teams.length; b++) {
            const [p1, p2] = teams[a];
            const [p3, p4] = teams[b];
            const before = fam(p1, p2) + fam(p3, p4);
            const alt1 = fam(p1, p3) + fam(p2, p4);
            const alt2 = fam(p1, p4) + fam(p2, p3);
            if (alt1 < before && alt1 <= alt2) {
              teams[a] = [p1, p3];
              teams[b] = [p2, p4];
              improved = true;
            } else if (alt2 < before) {
              teams[a] = [p1, p4];
              teams[b] = [p2, p3];
              improved = true;
            }
            if (improved) break outer;
          }
        }
      }

      // teams pair into matches (random team-vs-team)
      const courtTeams = [...teams].sort(() => Math.random() - 0.5);
      const matches: Match[] = [];
      let court = 1;
      while (courtTeams.length >= 2) {
        const t1 = courtTeams.shift()!;
        const t2 = courtTeams.shift()!;
        matches.push({ id: `m-social-${Date.now()}-${court}`, court: court++, team1: t1.map(p => p.id), team2: t2.map(p => p.id) });
      }
      for (const p of byePlayers) {
        matches.push({ id: `m-social-bye-${Date.now()}-${p.id}`, court: 0, team1: [], team2: [], bye: true, byePlayerId: p.id });
      }
      setRoundState({ active: true, format, matches, submitted: false });
      return matches;
    }
    // TEAMS: units (mutual pairs + singles). Formation = the top-5 window
    // rule (Frank 2026-10-14): look at the top 5 players by seed. A pair
    // forms a team iff BOTH members sit inside the window ("not only 5th" —
    // a pair whose first member lands at the 5th spot has its partner outside
    // -> it rolls to the next window). Two complete pairs -> both teams of
    // the court; one complete pair -> its team + the top singles fill the
    // other ("rest fill automatically"); none -> 4 singles (14v23 in-court).
    // Leftover window players keep their place in line. Byes: the rotation
    // goes FIRST — lowest bye score sits (a pair competes on its MEAN and
    // byes as BOTH), then whoever can't fill a court byes too.
    if (format.type === "TEAMS") {
      const pairMap: Record<string, string> = config.pairMap || {};
      const tRank = [...eventPool].sort((a, b) => (b.duprScore || 0) - (a.duprScore || 0)).map(p => p.id);
      const seedOf = (p: Player) => {
        const s = standings.find(x => x.id === p.id);
        return (s?.seed ?? tRank.indexOf(p.id) + 1) + (s?.seedAdjustment ?? 0);
      };
      const entryOf = (p: Player) =>
        standings.find(s => s.id === p.id) ??
        ({ id: p.id, name: p.name, seed: tRank.indexOf(p.id) + 1, seedAdjustment: 0 } as any);
      const active = eventPool.filter(p => !p.isSitting);
      const partnerOf = (p: Player): Player | undefined => {
        const pid = pairMap[p.id];
        return pid && pairMap[pid] === p.id ? active.find(q => q.id === pid) : undefined;
      };
      // units: a mutual pair or a single; a pair's scores are the MEAN
      const units: { members: Player[]; score: number; order: number }[] = [];
      const claimed = new Set<string>();
      for (const p of active) {
        if (claimed.has(p.id)) continue;
        const q = partnerOf(p);
        const members = q ? [p, q] : [p];
        members.forEach(m => claimed.add(m.id));
        units.push({
          members,
          score: members.reduce((a, m) => a + getByeTotal(entryOf(m)), 0) / members.length,
          order: members.reduce((a, m) => a + seedOf(m), 0) / members.length,
        });
      }
      // bye rotation first: lowest score sits (ties random); a pair = both
      const maxPlayers = config.courts * 4;
      const needed = active.length > maxPlayers ? active.length - maxPlayers : active.length % 4;
      const byScore = [...units].sort((a, b) => (a.score - b.score) || (Math.random() - 0.5));
      const sitters: Player[] = [];
      let sat = 0;
      while (sat < needed && byScore.length) {
        const u = byScore.shift()!;
        sitters.push(...u.members);
        sat += u.members.length;
      }
      const sitterIds = new Set(sitters.map(p => p.id));
      // formation: the top-5 window rule. The QUEUE ranks UNITS by their
      // COMBINED MEAN (Frank 2026-10-15) — pair members sit together at the
      // pair's mean position. Ranking members individually split (hiro 1.0,
      // Anshi 3.5) across windows: hiro read as a straddler every round and
      // the pair fell to the last court.
      const ranked = [...units].sort((a, b) =>
        (a.order - b.order) ||
        (Math.min(...a.members.map(seedOf)) - Math.min(...b.members.map(seedOf))));
      const pool = ranked
        .map(u => [...u.members].sort((x, y) => seedOf(x) - seedOf(y)))
        .flat()
        .filter(p => !sitterIds.has(p.id));
      const matches: Match[] = [];
      let court = 1;
      while (pool.length >= 4 && court <= config.courts) {
        const win = pool.slice(0, 5);
        const winIds = new Set(win.map(p => p.id));
        const complete: [Player, Player][] = [];
        const used = new Set<string>();
        for (const p of win) {
          if (used.has(p.id)) continue;
          const q = partnerOf(p);
          if (q && winIds.has(q.id)) {
            complete.push([p, q]);
            used.add(p.id); used.add(q.id);
          }
        }
        const unpaired = win.filter(p => !used.has(p.id) && !partnerOf(p));
        let team1: string[] = [];
        let team2: string[] = [];
        const courtIds: string[] = [];
        if (complete.length >= 2) {
          team1 = complete[0].map(p => p.id);
          team2 = complete[1].map(p => p.id);
          complete[0].concat(complete[1]).forEach(p => courtIds.push(p.id));
        } else if (complete.length === 1) {
          const fills = unpaired.slice(0, 2);
          if (fills.length < 2) break;
          team1 = complete[0].map(p => p.id);
          team2 = fills.map(p => p.id);
          complete[0].concat(fills).forEach(p => courtIds.push(p.id));
        } else {
          const fills = unpaired.slice(0, 4);
          if (fills.length < 4) break;
          const byOrder = [...fills].sort((a, b) => seedOf(a) - seedOf(b));
          team1 = [byOrder[0].id, byOrder[3].id];
          team2 = [byOrder[1].id, byOrder[2].id];
          fills.forEach(p => courtIds.push(p.id));
        }
        matches.push({ id: `m-teams-${Date.now()}-${court}`, court: court++, team1, team2 });
        for (const id of courtIds) {
          const i = pool.findIndex(x => x.id === id);
          if (i >= 0) pool.splice(i, 1);
        }
      }
      // byes: the rotation sitters + everyone who couldn't fill a court
      for (const p of [...sitters, ...pool]) {
        matches.push({ id: `m-teams-bye-${Date.now()}-${p.id}`, court: 0, team1: [], team2: [], bye: true, byePlayerId: p.id });
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
  }, [eventPool, standings, config, currentRoundNumber, roundHistory, setRoundState]);

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
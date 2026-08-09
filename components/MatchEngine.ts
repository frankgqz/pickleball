// Match generation and bye calculation logic
import { Match, MatchFormat, TournamentConfig, Player, StandingsEntry } from "./Types";

export interface MatchGeneratorResult {
  matches: Match[];
  byePlayerIds: string[];
  updatedStandings?: StandingsEntry[];
}

export function regenerateByesSync(
  standings: StandingsEntry[],
  config: TournamentConfig
): Map<string, number> {
  // Calculate new byeBase values for all standings entries (sorted by DUPR)
  const tempByeMap = new Map<string, number>();
  const sortedStandings = [...standings].sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
  const topHalf = Math.floor(config.byeTopProtection / 2);

  sortedStandings.forEach((entry, idx) => {
    const baseRoll = -Math.random();
    let byeBase = baseRoll;
    if (idx < topHalf) byeBase = baseRoll + config.byeBonusTop;
    else if (idx < config.byeTopProtection) byeBase = baseRoll + (config.byeBonusTop / 2);
    tempByeMap.set(entry.id, byeBase);
  });

  return tempByeMap;
}

export function getByeTotal(entry: StandingsEntry): number {
  const byeBase = entry.byeBase ?? 0;
  const byeCount = entry.byeCount ?? 0;
  const sitOutCount = entry.sitOutCount ?? 0;
  const byeMod = entry.byeMod ?? 0;
  return byeBase + byeCount + (sitOutCount * 0.5) + byeMod;
}

export function getSeedTotal(entry: StandingsEntry): number {
  return (entry.seed || 0) + (entry.seedAdjustment || 0);
}

export function generateMatches(
  format: MatchFormat,
  eventPool: Player[],
  standings: StandingsEntry[],
  config: TournamentConfig,
  roundNumber: number,
  byePlayerIdsMap: Map<string, number> | null, // pre-calculated byeBase values
  setStandings?: (fn: (prev: StandingsEntry[]) => StandingsEntry[]) => void
): MatchGeneratorResult {
  const activePlayers = eventPool.filter(p => !p.isSitting);
  const playersPerCourt = 4;
  const maxPlayersForCourts = config.courts * playersPerCourt;

  let byeCount = 0;
  if (activePlayers.length > maxPlayersForCourts) {
    byeCount = activePlayers.length - maxPlayersForCourts;
  } else {
    byeCount = activePlayers.length % playersPerCourt;
  }

  let byePlayerIds: string[] = [];
  let tempByeMap = byePlayerIdsMap;

  // STEP 0 (ROUND 1): Regenerate byeBase FIRST, before determining byes
  if (roundNumber === 1 && !tempByeMap) {
    tempByeMap = regenerateByesSync(standings, config);

    // Update standings with new byeBase values if setter provided
    if (setStandings) {
      setStandings(prev => prev.map(entry => ({
        ...entry,
        byeBase: tempByeMap!.get(entry.id) ?? entry.byeBase,
      })));
    }
  }

  // Determine bye players
  const activeStandings = standings.filter(s => activePlayers.some(p => p.id === s.id));
  const sortedByBye = [...activeStandings].sort((a, b) => {
    const aBye = tempByeMap?.get(a.id) ?? a.byeBase ?? 0;
    const bBye = tempByeMap?.get(b.id) ?? b.byeBase ?? 0;
    return aBye - bBye;
  });
  byePlayerIds = sortedByBye.slice(0, byeCount).map(s => s.id);

  // Remaining players for matches
  const remainingPlayers = activePlayers.filter(p => !byePlayerIds.includes(p.id));
  const remainingOrdered = remainingPlayers.sort((a, b) => {
    const aEntry = standings.find(s => s.id === a.id)!;
    const bEntry = standings.find(s => s.id === b.id)!;
    return getSeedTotal(aEntry) - getSeedTotal(bEntry);
  }).map(p => p.id);

  // Generate matches
  const matches: Match[] = [];
  let courtNum = 1;

  for (let i = 0; i < remainingOrdered.length; i += playersPerCourt) {
    const group = remainingOrdered.slice(i, i + playersPerCourt);
    if (group.length === playersPerCourt) {
      matches.push({
        id: `m-${courtNum}`,
        court: courtNum,
        team1: [group[0], group[3]], // 1v4
        team2: [group[1], group[2]], // 2v3
        team1Score: undefined,
        team2Score: undefined,
        bye: false,
      });
      courtNum++;
    } else {
      // Not enough players for a full court, give byes
      group.forEach(pid => byePlayerIds.push(pid));
    }
  }

  // Add bye matches
  byePlayerIds.forEach((pid, idx) => {
    matches.push({
      id: `bye-${idx + 1}`,
      court: 0,
      team1: [pid],
      team2: [],
      bye: true,
      byePlayerId: pid,
    });
  });

  return { matches, byePlayerIds };
}

export function generatePoolMatches(
  eventPool: Player[],
  config: TournamentConfig
): Match[] {
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
    .sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));

  const poolsCount = poolConfig.poolsCount;
  const pools: Player[][] = Array.from({ length: poolsCount }, () => []);

  // Distribute players into pools (seeding based on DUPR)
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

  return allMatches;
}

export function generateRoundRobin(players: Player[], poolId: string, startCourt: number): Match[] {
  const matches: Match[] = [];
  const n = players.length;
  let courtNum = startCourt;

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
}
// standingsUtils.ts - Standings calculation and utilities
import { StandingsEntry, CompletedRound, TournamentConfig, Match, Player } from "./Types";

// ============================================================
// SORTING
// ============================================================

export function sortStandings(
  entries: StandingsEntry[],
  column: string,
  direction: "asc" | "desc" = "asc"
): StandingsEntry[] {
  return [...entries].sort((a, b) => {
    let aVal: number | string | null;
    let bVal: number | string | null;

    switch (column) {
      case "seedTotal":
        aVal = getSeedTotal(a);
        bVal = getSeedTotal(b);
        break;
      case "wins":
        aVal = a.wins;
        bVal = b.wins;
        break;
      case "losses":
        aVal = a.losses;
        bVal = b.losses;
        break;
      case "pointsFor":
        aVal = a.pointsFor;
        bVal = b.pointsFor;
        break;
      case "pointsAgainst":
        aVal = a.pointsAgainst;
        bVal = b.pointsAgainst;
        break;
      case "pointDiff":
        aVal = a.pointsFor - a.pointsAgainst;
        bVal = b.pointsFor - b.pointsAgainst;
        break;
      case "winPct":
        aVal = getWinPercentage(a);
        bVal = getWinPercentage(b);
        break;
      case "ptsPct":
        aVal = getPointsPercentage(a);
        bVal = getPointsPercentage(b);
        break;
      case "byeCount":
        aVal = a.byeCount;
        bVal = b.byeCount;
        break;
      case "sitOutCount":
        aVal = a.sitOutCount;
        bVal = b.sitOutCount;
        break;
      case "name":
        aVal = a.name;
        bVal = b.name;
        break;
      case "duprScore":
        aVal = a.duprScore ?? 0;
        bVal = b.duprScore ?? 0;
        break;
      default:
        aVal = getSeedTotal(a);
        bVal = getSeedTotal(b);
    }

    // Handle null values
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return direction === "asc" ? 1 : -1;
    if (bVal === null) return direction === "asc" ? -1 : 1;

    // Compare
    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    
    return direction === "asc" 
      ? (aVal as number) - (bVal as number) 
      : (bVal as number) - (aVal as number);
  });
}

// ============================================================
// COMPUTATION
// ============================================================

export function computeStandingsEntries(entries: StandingsEntry[]): StandingsEntry[] {
  return entries.map(entry => ({
    ...entry,
    winPct: entry.wins + entry.losses > 0 
      ? entry.wins / (entry.wins + entry.losses) 
      : null,
    ptsPct: entry.pointsFor + entry.pointsAgainst > 0 
      ? entry.pointsFor / (entry.pointsFor + entry.pointsAgainst) 
      : null,
  }));
}

export function getSeedTotal(entry: StandingsEntry): number {
  return (entry.seed || 0) + (entry.seedAdjustment || 0);
}

export function getWinPercentage(entry: StandingsEntry): number {
  const total = entry.wins + entry.losses;
  return total > 0 ? entry.wins / total : 0;
}

export function getPointsPercentage(entry: StandingsEntry): number {
  const total = entry.pointsFor + entry.pointsAgainst;
  return total > 0 ? entry.pointsFor / total : 0;
}

export function buildEntriesFromPlayers(players: Player[]): StandingsEntry[] {
  return players.map(p => ({
    id: p.id,
    name: p.name,
    duprId: p.duprId ?? null,
    duprScore: p.duprScore ?? (p as any).manualDuprScore ?? null,
    seed: 0,
    seedAdjustment: 0,
    orderHistory: [],
    byeBase: -Math.random(),
    byeMod: 0,
    byeCount: 0,
    sitOutCount: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
  }));
}

export function formatByeBreakdown(entry: StandingsEntry): string {
  const parts: string[] = [];
  
  if (entry.byeCount > 0) {
    parts.push(`${entry.byeCount}x BYE`);
  }
  
  const orderHistory = entry.orderHistory || [];
  const wins = orderHistory.filter(h => h.reason.includes("win")).length;
  const losses = orderHistory.filter(h => h.reason.includes("loss")).length;
  
  if (wins > 0 || losses > 0) {
    parts.push(`${wins}W-${losses}L`);
  }
  
  return parts.length > 0 ? parts.join(", ") : "-";
}

// ============================================================
// CENTRALIZED STANDINGS CALCULATION FROM ROUNDS
// ============================================================

export interface StandingsChanges {
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  byeCount: number;
  orderHistory: { round: number; change: number; reason: string }[];
}

/**
 * Calculate standings changes from a set of rounds
 * Centralized logic to eliminate duplication across page.tsx handlers
 */
export function calculateStandingsFromRounds(
  currentStandings: StandingsEntry[],
  rounds: CompletedRound[],
  eventPool: Player[],
  config: TournamentConfig
): StandingsEntry[] {
  // FULL replay: zero the stats and re-run the LIVE per-match processor
  // (processMatchResult) in round order — the exact code path a submit
  // uses. The old partial copy rebuilt W/L but hardcoded seedAdjustment: 0
  // and never re-recorded the orderHistory deltas, so generating a new
  // round wiped the seed changes.
  let state: StandingsEntry[] = currentStandings.map(s => ({
    ...s,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    byeCount: 0,
    sitOutCount: 0,
    seedAdjustment: 0,
    orderHistory: [],
  }));

  for (const r of rounds) {
    for (const m of r.matches) {
      if (m.bye && m.byePlayerId) {
        state = state.map(s => (s.id === m.byePlayerId
          ? {
              ...s,
              byeCount: (s.byeCount || 0) + 1,
              orderHistory: [...(s.orderHistory || []), { round: r.roundNumber, change: 0, reason: "bye" }],
            }
          : s));
      } else {
        for (const pid of [...m.team1, ...m.team2]) {
          if (!pid) continue;
          state = state.map(s => (s.id === pid
            ? processMatchResult(s, { match: m, eventPool, config, roundNumber: r.roundNumber })
            : s));
        }
      }
    }
  }

  return state;
}

/**
 * Recalculate standings after editing or deleting a round
 */
export function recalculateStandingsFromHistory(
  currentStandings: StandingsEntry[],
  history: CompletedRound[],
  sessionId: string,
  config: TournamentConfig,
  eventPool: Player[]
): StandingsEntry[] {
  // Filter and sort rounds for the session
  const sessionRounds = history
    .filter(r => r.sessionId === sessionId)
    .sort((a, b) => a.roundNumber - b.roundNumber);

  return calculateStandingsFromRounds(currentStandings, sessionRounds, eventPool, config);
}

// ============================================================
// SEED & BYE UTILITIES
// ============================================================

export function initializeSeeds(standings: StandingsEntry[], orderGap: number): StandingsEntry[] {
  return [...standings]
    .sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0))
    .map((entry, i) => ({
      ...entry,
      seed: 1 + i * orderGap
    }));
}

export function regenerateByes(
  standings: StandingsEntry[],
  byeTopProtection: number,
  byeBonusTop: number
): StandingsEntry[] {
  const sorted = [...standings].sort((a, b) => (b.duprScore ?? 0) - (a.duprScore ?? 0));
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
}

export function createStandingsEntry(
  player: Player,
  index: number,
  orderGap: number,
  lateJoinBonus: number = 0
): StandingsEntry {
  return {
    id: player.id,
    name: player.name,
    duprId: player.duprId ?? null,
    duprScore: player.duprScore ?? null,
    seed: 1 + index * orderGap,
    seedAdjustment: 0,
    orderHistory: [],
    byeBase: -Math.random(),
    byeMod: lateJoinBonus,
    byeCount: 0,
    sitOutCount: 0,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    winPct: null,
    ptsPct: null,
  };
}

// ============================================================
// MATCH RESULT PROCESSING
// ============================================================

export interface MatchResultParams {
  match: Match;
  eventPool: Player[];
  config: TournamentConfig;
  roundNumber: number;
}

/**
 * Calculate order change for a player based on match result and court position
 */
export function calculateOrderChange(
  playerId: string,
  params: MatchResultParams
): number {
  const { match, eventPool, config, roundNumber } = params;
  
  const team1Ids = match.team1;
  const team2Ids = match.team2;
  const t1score = match.team1Score || 0;
  const t2score = match.team2Score || 0;

  const isOnTeam1 = team1Ids.includes(playerId);
  const myScore = isOnTeam1 ? t1score : t2score;
  const oppScore = isOnTeam1 ? t2score : t1score;
  const won = myScore > oppScore;

  // Calculate filled courts
  const activePlayers = eventPool.filter(p => !p.isSitting).length;
  const filledCourts = Math.ceil(activePlayers / 4) || 1;

  // Determine court position
  const isTop = match.court === 1;
  const isBottom = match.court === filledCourts;

  // Calculate order change
  let orderChange = won ? -config.winLossMagnitude : config.winLossMagnitude;
  
  if (isTop) {
    orderChange = won ? -config.courtBonus : config.winLossMagnitude;
  } else if (isBottom) {
    orderChange = won ? -config.winLossMagnitude : config.courtBonus;
  }

  return orderChange;
}

/**
 * Process a completed match and update a standings entry
 */
export function processMatchResult(
  entry: StandingsEntry,
  params: MatchResultParams
): StandingsEntry {
  const { match, config, roundNumber } = params;
  
  const team1Ids = match.team1;
  const team2Ids = match.team2;
  const t1score = match.team1Score || 0;
  const t2score = match.team2Score || 0;

  const isOnTeam1 = team1Ids.includes(entry.id);
  if (!isOnTeam1 && !team2Ids.includes(entry.id)) {
    return entry; // Not part of this match
  }

  const myScore = isOnTeam1 ? t1score : t2score;
  const oppScore = isOnTeam1 ? t2score : t1score;
  const won = myScore > oppScore;

  // Update stats
  const newEntry = { ...entry };
  
  if (won) {
    newEntry.wins = (newEntry.wins || 0) + 1;
  } else {
    newEntry.losses = (newEntry.losses || 0) + 1;
  }
  
  newEntry.pointsFor = (newEntry.pointsFor || 0) + myScore;
  newEntry.pointsAgainst = (newEntry.pointsAgainst || 0) + oppScore;

  // Calculate order change
  const orderChange = calculateOrderChange(entry.id, params);
  const rawAdj = (entry.seedAdjustment || 0) + orderChange;

  // Clamp adjustment to valid range
  const minSeedTotal = 1 - config.band;
  const maxSeedTotal = 1 + config.band + 100; // rough estimate
  
  const seedTotal = getSeedTotal(entry);
  const clampedAdj = Math.max(
    minSeedTotal - entry.seed,
    Math.min(maxSeedTotal - entry.seed, rawAdj)
  );

  // Record history
  const activePlayers = params.eventPool.filter(p => !p.isSitting).length;
  const filledCourts = Math.ceil(activePlayers / 4) || 1;
  const isTop = match.court === 1;
  const isBottom = match.court === filledCourts;

  newEntry.orderHistory = [
    ...(entry.orderHistory || []),
    {
      round: roundNumber,
      change: clampedAdj - (entry.seedAdjustment || 0),
      reason: (isTop ? "top" : isBottom ? "bottom" : `court ${match.court}`) + (won ? " win" : " loss")
    }
  ];
  newEntry.seedAdjustment = clampedAdj;

  return newEntry;
}
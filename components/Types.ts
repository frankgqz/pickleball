// Shared types for Pickleball Tournament Manager

export type MatchFormat = "PICK_PARTNER" | "FIXED_14V23" | "POOL_PLAY";

export type PoolFinalsFormat =
  | "top2_to_semis" // top 2 in pool go to semis
  | "2nd_3rd_to_quarters" // top 2 go to semis, 2nd/3rd play quarters
  | "quarters_to_8" // top 3 in pool + others to make 8
  | "semis_only" // semis only (top 4)
  | "finals_only" // finals only (top 2)
  | "serial_play" // everyone plays, 1v2, 3v4, 5v6 to determine rank
  | "single_elimination"; // standard single elimination bracket

export type AdvancementCriteria = "wins" | "sets" | "points" | "points_ratio";

export interface PoolFinalsConfig {
  poolsCount: number;
  finalistsPerPool: number;
  finalsFormat: PoolFinalsFormat;
  advancementCriteria: AdvancementCriteria;
  groupStageWinsFor: number; // best of X games
  finalsWinsFor: number; // best of X games
}

export interface Player {
  id: string;
  name: string;
  duprId?: string | null; // letter ID
  duprNumericId?: string | null; // numeric ID for API lookups
  duprScore?: number | null;
  imageUrl?: string | null; // DUPR profile avatar image URL
  isSitting?: boolean;
}

export interface StandingsEntry {
  id: string;
  name: string;
  duprId?: string | null;
  duprScore?: number | null;

  // Seed fields
  seed: number; // base seed (recalculated when pool changes)
  seedAdjustment: number; // cumulative changes from rounds (wins/losses/byes)

  // Order history per round
  orderHistory: { round: number; change: number; reason: string }[];

  // Bye calculations
  byeBase: number; // base bye value (random roll +/- bonuses)
  byeMod: number; // fractional: late join bonus (kept separate)
  byeCount: number; // forced byes earned (integer)
  sitOutCount: number; // number of times sitting out (affects bye total)

  // Results
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;

  // Computed display fields
  winPct?: number | null;
  ptsPct?: number | null;

  // Pool play specific
  poolId?: string;
  poolRank?: number;
}

// Computed standings entry (for display with calculated percentages)
export interface ComputedStandingsEntry extends StandingsEntry {
  winPct: number | null;
  ptsPct: number | null;
  seedTotal: number; // seed + seedAdjustment
}

export interface TournamentConfig {
  format: "STANDARD" | "FIXED_PARTNER" | "POOL_PLAY";
  roundFormat?: "FIXED_14V23" | "PICK_PARTNER"; // user's preferred round format
  eventName?: string; // name of the event for CSV export
  orderGap: number;
  band: number; // rubberband buffer for seedTotal bounds
  winLossMagnitude: number; // magnitude applied for wins/losses
  courtBonus: number; // top/bottom magnitude modifier (Wtop Lbottom mag)
  byeTopProtection: number; // top players protected for bye bonus
  byeBonusTop: number; // top bye bonus magnitude
  sitProtection: number; // sit bonus (added to byeTotal)
  lateJoinBonus: number; // late join bonus (fractional added to byeMod)
  courts: number;
  teamsPerPool: number;
  finalsFormat: "top2" | "top4" | "all";

  // Pool/Finals specific settings
  poolFinals?: PoolFinalsConfig;
}

export interface Match {
  id: string;
  court: number;
  team1: string[]; // player IDs
  team2: string[]; // player IDs
  team1Score?: number;
  team2Score?: number;
  bye?: boolean;
  byePlayerId?: string;
}

export interface PoolMatch extends Match {
  poolId: string;
  round: number; // round within the pool stage
}

export interface CompletedRound {
  roundNumber: number;
  date: string; // ISO string for serialization
  format: MatchFormat;
  matches: Match[];
  sittingOut: string[]; // player IDs
  sessionId: string;
}

export interface GameSession {
  sessionId: string;
  startDate: string; // ISO
  endDate?: string; // optional
}

export interface RoundState {
  active: boolean;
  format: MatchFormat;
  matches: Match[];
  submitted: boolean;
  poolId?: string;
  stage?: "pool" | "quarters" | "semis" | "finals";
}

export interface CompletedRoundStored extends CompletedRound {
  // same as CompletedRound but kept for clarity
}
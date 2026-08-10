// Shared types for Pickleball Tournament Manager

// ============================================================
// MATCH FORMATS (Discriminated Unions)
// ============================================================

export type MatchFormat = 
  | { type: "PICK_PARTNER"; allowPartnerRepeat?: boolean }
  | { type: "FIXED_14V23"; partnerLock?: boolean }
  | { type: "POOL_PLAY"; poolsCount: number };

// Convenience constants for format creation
export const PICK_PARTNER_FORMAT: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };
export const FIXED_14V23_FORMAT: MatchFormat = { type: "FIXED_14V23", partnerLock: true };
export const POOL_PLAY_FORMAT = (poolsCount: number): MatchFormat => ({ type: "POOL_PLAY", poolsCount });

// Helper to check format type
export function isPickPartnerFormat(fmt: MatchFormat): boolean {
  return fmt.type === "PICK_PARTNER";
}

export function isFixed14v23Format(fmt: MatchFormat): boolean {
  return fmt.type === "FIXED_14V23";
}

export function isPoolPlayFormat(fmt: MatchFormat): boolean {
  return fmt.type === "POOL_PLAY";
}

// ============================================================
// PLAYER
// ============================================================

export interface Player {
  id: string;
  name: string;
  duprId?: string | null;
  duprNumericId?: string | null;
  duprScore?: number | null; // Only from DUPR API (3 decimals)
  manualDuprScore?: number | null; // Manually entered (1 decimal)
  imageUrl?: string | null;
  isSitting?: boolean;
  lastRefreshed?: string | null; // ISO date string when DUPR was last fetched
}

// ============================================================
// STANDINGS
// ============================================================

export interface StandingsEntry {
  id: string;
  name: string;
  duprId?: string | null;
  duprScore?: number | null; // From DUPR API (3 decimals)
  manualDuprScore?: number | null; // Manually entered (1 decimal)

  // Seed fields
  seed: number;
  seedAdjustment: number;

  // Order history per round
  orderHistory: { round: number; change: number; reason: string }[];

  // Bye calculations
  byeBase: number;
  byeMod: number;
  byeCount: number;
  sitOutCount: number;

  // Results
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  
  // Computed fields (optional)
  winPct?: number | null;
  ptsPct?: number | null;
}

// ============================================================
// TOURNAMENT CONFIG
// ============================================================

export interface TournamentConfig {
  format: "STANDARD" | "FIXED_PARTNER" | "POOL_PLAY";
  roundFormat?: "FIXED_14V23" | "PICK_PARTNER";
  eventName?: string;
  orderGap: number;
  band: number;
  winLossMagnitude: number;
  courtBonus: number;
  byeTopProtection: number;
  byeBonusTop: number;
  sitProtection: number;
  lateJoinBonus: number;
  defaultDupr: number; // Default DUPR for players without a rating (default 2.5)
  courts: number;
  teamsPerPool: number;
  finalsFormat: "top2" | "top4" | "all";
  poolFinals?: {
    poolsCount: number;
    finalistsPerPool: number;
    groupStageWinsFor: number;
    finalsWinsFor: number;
  };
}

// ============================================================
// MATCH
// ============================================================

export interface Match {
  id: string;
  court: number;
  team1: string[];
  team2: string[];
  team1Score?: number;
  team2Score?: number;
  bye?: boolean;
  byePlayerId?: string;
}

// ============================================================
// COMPLETED ROUND
// ============================================================

export interface CompletedRound {
  roundNumber: number;
  date: string;
  format: MatchFormat;
  matches: Match[];
  sittingOut: string[];
  sessionId: string;
}

// ============================================================
// GAME SESSION
// ============================================================

export interface GameSession {
  sessionId: string;
  startDate: string;
  endDate?: string;
}

// ============================================================
// ROUND STATE
// ============================================================

export interface RoundState {
  active: boolean;
  format: MatchFormat;
  matches: Match[];
  submitted: boolean;
  stage?: "pool" | "quarters" | "semis" | "finals";
  poolId?: string;
}
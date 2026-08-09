// Shared types for Pickleball Tournament Manager

export type MatchFormat = "PICK_PARTNER" | "FIXED_14V23" | "POOL_PLAY";

export interface Player {
  id: string;
  name: string;
  duprId?: string | null;         // letter ID
  duprNumericId?: string | null;  // numeric ID for API lookups
  duprScore?: number | null;
  isSitting?: boolean;
}

export interface StandingsEntry {
  id: string;
  name: string;
  duprId?: string | null;
  duprScore?: number | null;

  // Seed fields
  seed: number;            // base seed (recalculated when pool changes)
  seedAdjustment: number;  // cumulative changes from rounds (wins/losses/byes)

  // Order history per round
  orderHistory: { round: number; change: number; reason: string }[];

  // Bye calculations
  byeBase: number;      // base bye value (random roll +/- bonuses)
  byeMod: number;       // fractional: late join bonus (kept separate)
  byeCount: number;     // forced byes earned (integer)
  sitOutCount: number;  // number of times sitting out (affects bye total)

  // Results
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface TournamentConfig {
  format: "STANDARD" | "FIXED_PARTNER" | "POOL_PLAY";
  orderGap: number;
  band: number;                // rubberband buffer for seedTotal bounds
  winLossMagnitude: number;    // magnitude applied for wins/losses
  courtBonus: number;          // top/bottom magnitude modifier (Wtop Lbottom mag)
  byeTopProtection: number;    // top players protected for bye bonus
  byeBonusTop: number;         // top bye bonus magnitude
  sitProtection: number;       // sit bonus (added to byeTotal)
  lateJoinBonus: number;       // late join bonus (fractional added to byeMod)
  courts: number;
  teamsPerPool: number;
  finalsFormat: "top2" | "top4" | "all";
}

export interface Match {
  id: string;
  court: number;
  team1: string[];   // player IDs
  team2: string[];   // player IDs
  team1Score?: number;
  team2Score?: number;
  bye?: boolean;
  byePlayerId?: string;
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
  endDate?: string;   // optional
}

export interface RoundState {
  active: boolean;
  format: MatchFormat;
  matches: Match[];
  submitted: boolean;
}

export interface CompletedRoundStored extends CompletedRound {
  // same as CompletedRound but kept for clarity
}

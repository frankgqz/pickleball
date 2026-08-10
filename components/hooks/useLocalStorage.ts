// useLocalStorage.ts - LocalStorage helpers
// Handles persisting app state to localStorage

import { Player, StandingsEntry, TournamentConfig, CompletedRound, GameSession } from "@/components/Types";

const STORAGE_KEYS = {
  ROUNDS: "pickleball_rounds_v1",
  PLAYERS: "pickleball_players_v1",
  EVENT_POOL: "pickleball_event_pool_v1",
  SESSION: "pickleball_session_v1",
  STANDINGS: "pickleball_standings_v1",
  CONFIG: "pickleball_config_v1",
} as const;

const isBrowser = typeof window !== "undefined";

// Safe JSON parse with fallback
function safeJsonParse<T>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const s = localStorage.getItem(key);
    return s ? JSON.parse(s) : fallback;
  } catch {
    return fallback;
  }
}

// Safe JSON stringify
function safeJsonStringify(key: string, data: unknown): void {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn(`Failed to save ${key}:`, e);
  }
}

export const localStorageDb = {
  // Rounds
  saveRounds: (rounds: CompletedRound[]) => safeJsonStringify(STORAGE_KEYS.ROUNDS, rounds),
  loadRounds: (): CompletedRound[] => safeJsonParse(STORAGE_KEYS.ROUNDS, []),

  // Players
  savePlayers: (players: Player[]) => safeJsonStringify(STORAGE_KEYS.PLAYERS, players),
  loadPlayers: (): Player[] => safeJsonParse(STORAGE_KEYS.PLAYERS, []),

  // Event Pool
  saveEventPool: (pool: Player[]) => safeJsonStringify(STORAGE_KEYS.EVENT_POOL, pool),
  loadEventPool: (): Player[] => safeJsonParse(STORAGE_KEYS.EVENT_POOL, []),

  // Session
  saveSession: (session: GameSession) => safeJsonStringify(STORAGE_KEYS.SESSION, session),
  loadSession: (): GameSession | null => {
    if (!isBrowser) return null;
    const s = localStorage.getItem(STORAGE_KEYS.SESSION);
    return s ? JSON.parse(s) : null;
  },

  // Standings (session-scoped)
  saveStandings: (standings: StandingsEntry[], sessionId: string) => {
    if (!isBrowser) return;
    localStorage.setItem(STORAGE_KEYS.STANDINGS, JSON.stringify({ sessionId, entries: standings }));
  },
  loadStandings: (sessionId: string): StandingsEntry[] => {
    if (!isBrowser) return [];
    const s = localStorage.getItem(STORAGE_KEYS.STANDINGS);
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return parsed.sessionId === sessionId ? parsed.entries || [] : [];
    } catch {
      return [];
    }
  },

  // Config
  saveConfig: (config: TournamentConfig) => safeJsonStringify(STORAGE_KEYS.CONFIG, config),
  loadConfig: (): TournamentConfig | null => {
    if (!isBrowser) return null;
    const s = localStorage.getItem(STORAGE_KEYS.CONFIG);
    return s ? JSON.parse(s) : null;
  },

  // Selective clear - keeps players, eventPool, config
  clearEventData: () => {
    if (!isBrowser) return;
    localStorage.removeItem(STORAGE_KEYS.ROUNDS);
    localStorage.removeItem(STORAGE_KEYS.SESSION);
    localStorage.removeItem(STORAGE_KEYS.STANDINGS);
  },

  // Full clear
  clearAll: () => {
    if (!isBrowser) return;
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  },
};

// Custom hook for automatic persistence with debounce
import { useEffect, useRef } from "react";

export function useStorageSync<T>(
  key: string,
  data: T,
  isReady: boolean,
  delay: number = 100
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isReady) return;

    // Debounce saves to avoid rapid writes
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      safeJsonStringify(key, data);
    }, delay);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [key, data, isReady, delay]);
}
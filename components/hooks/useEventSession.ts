// useEventSession.ts - Event config, session, and history management
// Manages the overall event state: config settings, session ID, round history
import { useState, useCallback, useMemo } from "react";
import { TournamentConfig, CompletedRound, GameSession, MatchFormat, RoundState } from "@/components/Types";
import { localStorageDb } from "./useLocalStorage";
import { createSession, saveRound, updateRound } from "@/app/actions";

export const DEFAULT_CONFIG: TournamentConfig = {
  format: "STANDARD",
  roundFormat: "FIXED_14V23",
  eventName: "",
  matchType: "D",           // ← ADD
  scoreType: "SIDEOUT",     // ← ADD
  bestOf: 1,                // ← ADD
  orderGap: 0.25,
  band: 1,
  winLossMagnitude: 1,
  courtBonus: 1,
  byeTopProtection: 8,
  byeBonusTop: 0.5,
  sitProtection: 0.5,
  lateJoinBonus: 1,
  courts: 5,
  teamsPerPool: 4,
  finalsFormat: "top2",
};

// Format constants with proper literal types
const PICK_PARTNER_FORMAT: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };

export interface EventSessionState {
  config: TournamentConfig;
  currentSession: GameSession;
  roundHistory: CompletedRound[];
  roundState: RoundState;
  currentRoundNumber: number;
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>;
  dbSessionId?: string;     // actual DB session ID — undefined until Start Round 1
}

export interface EventSessionActions {
  updateConfig: <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => void;
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>;
  addRoundToHistory: (round: CompletedRound) => void;
  updateRoundInHistory: (roundNumber: number, updatedMatches: CompletedRound["matches"]) => void;
  deleteRoundFromHistory: (roundNumber: number, sessionId: string) => void;
  restartEvent: () => void;
  createNewSession: () => GameSession;
  cancelCurrentRound: () => void;
  startNewSession: (userId: string, playerIds: string[]) => Promise<string>; // returns dbSessionId
}

export function useEventSession(initialConfig?: TournamentConfig): [EventSessionState, EventSessionActions] {
  // Load saved config or use default
  const savedConfig = localStorageDb.loadConfig();

  // Load saved session or create new
  const savedSession = localStorageDb.loadSession();
  const initialSession: GameSession = savedSession || {
    sessionId: Date.now().toString(),
    startDate: new Date().toISOString(),
  };

  // Load saved rounds
  const savedRounds = localStorageDb.loadRounds();

  // State
  const [config, setConfig] = useState<TournamentConfig>(() => savedConfig || initialConfig || DEFAULT_CONFIG);
  const [currentSession, setCurrentSession] = useState<GameSession>(initialSession);
  const [roundHistory, setRoundHistory] = useState<CompletedRound[]>(savedRounds);
  const [roundState, setRoundState] = useState<RoundState>(() => ({
    active: false,
    format: PICK_PARTNER_FORMAT,
    matches: [],
    submitted: false
  }));
  const [dbSessionId, setDbSessionId] = useState<string | undefined>(undefined);

  // Derived: rounds in current session
  const currentSessionRounds = useMemo(
    () => roundHistory.filter(r => r.sessionId === currentSession.sessionId)
      .sort((a, b) => a.roundNumber - b.roundNumber),
    [roundHistory, currentSession]
  );
  const currentRoundNumber = currentSessionRounds.length + 1;

  // ============ ACTIONS ============

  const updateConfig = useCallback(<K extends keyof TournamentConfig>(
    key: K,
    value: TournamentConfig[K]
  ) => {
    setConfig(prev => {
      const updated = { ...prev, [key]: value };
      localStorageDb.saveConfig(updated);
      return updated;
    });

    // Auto-set order gap based on format
    if (key === "format") {
      const fmt = value as TournamentConfig["format"];
      if (fmt === "STANDARD") {
        setConfig(prev => ({ ...prev, orderGap: 0.25 }));
      } else if (fmt === "FIXED_PARTNER") {
        setConfig(prev => ({ ...prev, orderGap: 0.5 }));
      }
    }
  }, []);

  // --- START NEW SESSION (creates DB session) ---
  const startNewSession = useCallback(async (userId: string, playerIds: string[]): Promise<string> => {
    const now = new Date();
    const dateStr = [now.getFullYear(), now.toLocaleString("default", { month: "short" }), now.getDate()].join("/");
    const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    const ts = `${dateStr} ${timeStr}`;
    const name = config.eventName?.trim()
      ? `${config.eventName.trim()} (${ts})`
      : `${playerIds.length} players (${ts})`;
    const result = await createSession(userId, name, config as object, playerIds);
    if (!result.success || !result.session) throw new Error("Failed to create session");

    const newDbId = result.session.id;
    setDbSessionId(newDbId);

    const newSession: GameSession = {
      sessionId: newDbId,
      startDate: new Date().toISOString(),
    };
    setCurrentSession(newSession);
    localStorageDb.saveSession(newSession);

    return newDbId;
  }, [config]);

  const createNewSession = useCallback((): GameSession => {
    const session: GameSession = {
      sessionId: Date.now().toString(),
      startDate: new Date().toISOString(),
    };
    setCurrentSession(session);
    localStorageDb.saveSession(session);
    return session;
  }, []);

  const restartEvent = useCallback(() => {
    createNewSession();
    setRoundHistory([]);
    setDbSessionId(undefined);     // no DB session active after restart
    setRoundState({
      active: false,
      format: PICK_PARTNER_FORMAT,
      matches: [],
      submitted: false
    });
    localStorageDb.clearEventData();
  }, [createNewSession]);

  const cancelCurrentRound = useCallback(() => {
    setRoundState({
      active: false,
      format: PICK_PARTNER_FORMAT,
      matches: [],
      submitted: false
    });
  }, []);

  // --- ADD ROUND TO HISTORY --- (also persists to DB)
  const addRoundToHistory = useCallback((round: CompletedRound) => {
    // 1. Save to localStorage (existing behaviour)
    setRoundHistory(prev => {
      const updated = [...prev, round];
      localStorageDb.saveRounds(updated);
      return updated;
    });
    setRoundState(prev => ({ ...prev, submitted: true }));

    // 2. Persist new round to DB
    if (dbSessionId) {
      saveRound(dbSessionId, {
        roundNumber: round.roundNumber,
        date: round.date,
        format: round.format,
        matches: round.matches,
        sittingOut: round.sittingOut,
      }).catch(err => console.error("Failed to save round to DB:", err));
    }
  }, [dbSessionId]);

  const updateRoundInHistory = useCallback((roundNumber: number, updatedMatches: CompletedRound["matches"]) => {
    setRoundHistory(prev => {
      const updated = prev.map(r =>
        r.roundNumber === roundNumber && r.sessionId === currentSession.sessionId
          ? { ...r, matches: updatedMatches }
          : r
      );
      localStorageDb.saveRounds(updated);
      return updated;
    });

    // Also update in DB
    if (dbSessionId) {
      updateRound(dbSessionId, roundNumber, { matches: updatedMatches })
        .catch(err => console.error("Failed to update round in DB:", err));
    }
  }, [currentSession.sessionId, dbSessionId]);

  const deleteRoundFromHistory = useCallback((roundNumber: number, sessionId: string) => {
    setRoundHistory(prev => {
      const updated = prev.filter(r =>
        !(r.roundNumber === roundNumber && r.sessionId === sessionId)
      );
      localStorageDb.saveRounds(updated);
      return updated;
    });
    // TODO: also delete round row from DB
  }, []);

  // ============ COMBINE STATE & ACTIONS ============

  const state: EventSessionState = {
    config,
    currentSession,
    roundHistory,
    roundState,
    currentRoundNumber,
    setRoundState,
    dbSessionId,
  };

  const actions: EventSessionActions = {
    updateConfig,
    setRoundState,
    addRoundToHistory,
    updateRoundInHistory,
    deleteRoundFromHistory,
    restartEvent,
    createNewSession,
    cancelCurrentRound,
    startNewSession,
  };

  return [state, actions];
}
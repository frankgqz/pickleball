// useEventSession.ts - Event config, session, and history management
// Manages the overall event state: config settings, session ID, round history
// Renamed from useTournament for clarity

import { useState, useCallback, useMemo } from "react";
import { TournamentConfig, CompletedRound, GameSession, MatchFormat, RoundState } from "@/components/Types";
import { localStorageDb } from "./useLocalStorage";

export const DEFAULT_CONFIG: TournamentConfig = {
  format: "STANDARD",
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

export interface EventSessionState {
  config: TournamentConfig;
  currentSession: GameSession;
  roundHistory: CompletedRound[];
  roundState: RoundState;
  currentRoundNumber: number;
}

export interface EventSessionActions {
  updateConfig: <K extends keyof TournamentConfig>(key: K, value: TournamentConfig[K]) => void;
  setRoundState: React.Dispatch<React.SetStateAction<RoundState>>;
  addRoundToHistory: (round: CompletedRound) => void;
  updateRoundInHistory: (round: CompletedRound) => void;
  deleteRoundFromHistory: (roundNumber: number, sessionId: string) => void;
  restartEvent: () => void;
  createNewSession: () => GameSession;
  cancelCurrentRound: () => void;
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
  const [roundState, setRoundState] = useState<RoundState>({ 
    active: false, 
    format: { type: "PICK_PARTNER", allowPartnerRepeat: false }, 
    matches: [], 
    submitted: false 
  });

  // Derived: rounds in current session
  const currentSessionRounds = useMemo(
    () => roundHistory.filter(r => r.sessionId === currentSession.sessionId)
                      .sort((a, b) => a.roundNumber - b.roundNumber),
    [roundHistory, currentSession]
  );

  const currentRoundNumber = currentSessionRounds.length + 1;

  // Actions
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
    setRoundState({ 
      active: false, 
      format: { type: "PICK_PARTNER", allowPartnerRepeat: false }, 
      matches: [], 
      submitted: false 
    });
    localStorageDb.clearEventData();
  }, [createNewSession]);

  const cancelCurrentRound = useCallback(() => {
    setRoundState({ 
      active: false, 
      format: { type: "PICK_PARTNER", allowPartnerRepeat: false }, 
      matches: [], 
      submitted: false 
    });
  }, []);

  const addRoundToHistory = useCallback((round: CompletedRound) => {
    setRoundHistory(prev => {
      const updated = [...prev, round];
      localStorageDb.saveRounds(updated);
      return updated;
    });
    setRoundState(prev => ({ ...prev, submitted: true }));
  }, []);

  const updateRoundInHistory = useCallback((round: CompletedRound) => {
    setRoundHistory(prev => {
      const updated = prev.map(r =>
        r.roundNumber === round.roundNumber && r.sessionId === round.sessionId 
          ? round 
          : r
      );
      localStorageDb.saveRounds(updated);
      return updated;
    });
  }, []);

  const deleteRoundFromHistory = useCallback((roundNumber: number, sessionId: string) => {
    setRoundHistory(prev => {
      const updated = prev.filter(r => 
        !(r.roundNumber === roundNumber && r.sessionId === sessionId)
      );
      localStorageDb.saveRounds(updated);
      return updated;
    });
  }, []);

  const state: EventSessionState = {
    config,
    currentSession,
    roundHistory,
    roundState,
    currentRoundNumber,
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
  };

  return [state, actions];
}
import { useState, useCallback, useEffect } from "react";
import { Player, StandingsEntry, GameSession } from "@/components/Types";
import { localStorageDb } from "./useLocalStorage";
import { addPlayer, getClubPlayers, deletePlayer, fetchDuprRating, updatePlayer, addClubPlayer } from "@/app/actions";
import { createStandingsEntry } from "@/components/standingsUtils";

// Flag to track initial load from DB
export interface PlayerDatabaseState {
  allPlayers: Player[];
  eventPool: Player[];
  eventPoolIds: Set<string>;
}

export interface PlayerDatabaseActions {
  // Database operations
  loadPlayersFromDatabase: (userId?: string) => Promise<void>;
  addNewPlayer: (formData: FormData, userId?: string) => Promise<void>;
  updateExistingPlayer: (id: string, updates: Partial<Player>) => Promise<void>;
  deleteExistingPlayer: (id: string) => Promise<void>;
  fetchDuprForPlayer: (playerId: string) => Promise<void>;
  resetPlayers: () => void;
  setAllPlayers: (players: Player[]) => void;    // ← ADD — replaces roster on session load
  // Event pool operations
  addPlayerToEventPool: (player: Player, currentRoundNumber: number, lateJoinBonus: number) => StandingsEntry[];
  removePlayerFromEventPool: (playerId: string) => void;
  clearEventPool: (newSession: GameSession) => void;
  setEventPool: (players: Player[]) => void;      // ← ADD — replaces pool on session load
  togglePlayerSitting: (playerId: string) => void;
  // Get standings entries for all players in pool
  getPoolStandingsEntries: (orderGap: number) => StandingsEntry[];
}

export function usePlayerDatabase(
  isAppLoading: boolean,
  setIsAppLoading: (loading: boolean) => void,
  currentRoundNumber: number,
  lateJoinBonus: number = 0
): [PlayerDatabaseState, PlayerDatabaseActions] {
  // State
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => localStorageDb.loadPlayers());
  const [eventPool, setEventPool] = useState<Player[]>(() => localStorageDb.loadEventPool());

  // Quick lookup for pool membership
  const eventPoolIds = new Set(eventPool.map(p => p.id));

  // Persistence effects - save whenever state changes (after initial load)
  useEffect(() => {
    if (!isAppLoading) {
      localStorageDb.savePlayers(allPlayers);
    }
  }, [allPlayers, isAppLoading]);

  useEffect(() => {
    if (!isAppLoading) {
      localStorageDb.saveEventPool(eventPool);
    }
  }, [eventPool, isAppLoading]);

  // ============ DATABASE OPERATIONS ============

  const loadPlayersFromDatabase = useCallback(async (userId?: string) => {
    // Always reset at login — clears stale isSitting from previous sessions
    setAllPlayers([]);
    setEventPool([]);
    try {
      if (userId) {
        const result = await getClubPlayers(userId);
        if (result.success && result.clubPlayers && result.clubPlayers.length > 0) {
          const players = result.clubPlayers.map(cp => cp.player);
          setAllPlayers(players);
        }
      }
    } catch (err) {
      console.warn("Database load failed, using local data:", err);
    } finally {
      setIsAppLoading(false);
    }
  }, [setIsAppLoading]);

  const addNewPlayer = useCallback(async (formData: FormData, userId?: string) => {
    const result = await addPlayer(formData, userId);
    console.log("addPlayer result:", result);
    if (result.success && result.player) {
      setAllPlayers(prev => {
        const updated = [result.player!, ...prev];
        console.log("Updated allPlayers:", updated);
        return updated;
      });
      // Also add to pool if it's not already there
      setEventPool(prev => {
        if (prev.find(p => p.id === result.player!.id)) return prev;
        const updated = [result.player!, ...prev];
        console.log("Updated eventPool:", updated);
        return updated;
      });
      // Auto-add to user's roster if logged in
      if (userId) {
        await addClubPlayer(userId, result.player.id);
      }
    } else {
      console.error("Failed to add player:", result.error);
    }
  }, []);

  const updateExistingPlayer = useCallback(async (id: string, updates: Partial<Player>) => {
    const formData = new FormData();
    if (updates.name) formData.append("name", updates.name);
    if (updates.duprId !== undefined && updates.duprId !== null) formData.append("duprId", updates.duprId);
    if (updates.duprNumericId !== undefined && updates.duprNumericId !== null) formData.append("duprNumericId", updates.duprNumericId);
    if (updates.manualDuprScore !== undefined && updates.manualDuprScore !== null) formData.append("manualDuprScore", String(updates.manualDuprScore));

    const result = await updatePlayer(id, formData);
    if (result.success && result.player) {
      setAllPlayers(prev => prev.map(p => p.id === id ? result.player! : p));
      setEventPool(prev => prev.map(p => p.id === id ? result.player! : p));
    } else {
      console.error("Failed to update player:", result.error);
    }
  }, []);

  const deleteExistingPlayer = useCallback(async (id: string) => {
    const result = await deletePlayer(id);
    if (result.success) {
      setAllPlayers(prev => prev.filter(p => p.id !== id));
      setEventPool(prev => prev.filter(p => p.id !== id));
    } else {
      console.error("Failed to delete player:", result.error);
    }
  }, []);

  const fetchDuprForPlayer = useCallback(async (playerId: string) => {
    // Refetch the player to get their DUPR data
    const result = await fetchDuprRating(playerId);
    console.log("fetchDuprForPlayer result:", result);
    if (result.success && result.player) {
      setAllPlayers(prev => prev.map(p => p.id === playerId ? result.player! : p));
      setEventPool(prev => prev.map(p => p.id === playerId ? result.player! : p));
    }
  }, []);

  const resetPlayers = useCallback(() => {
    setAllPlayers([]);
    setEventPool([]);
  }, []);

  // ============ POOL OPERATIONS ============

  const addPlayerToEventPool = useCallback(
    (player: Player, currentRoundNumber: number, lateJoinBonus: number) => {
      setEventPool(prev => {
        const existing = prev.find(p => p.id === player.id);
        if (existing) return prev;
        return [...prev, player];
      });
      // Return updated standings entries for this pool
      return getPoolStandingsEntries(1);
    },
    []
  );

  const removePlayerFromEventPool = useCallback((playerId: string) => {
    setEventPool(prev => prev.filter(p => p.id !== playerId));
  }, []);

  const clearEventPool = useCallback((newSession: GameSession) => {
    setEventPool([]);
    localStorageDb.clearEventData();
  }, []);

  const togglePlayerSitting = useCallback((playerId: string) => {
    setEventPool(prev => prev.map(p => 
      p.id === playerId ? { ...p, isSitting: !p.isSitting } : p
    ));
  }, []);

  const getPoolStandingsEntries = useCallback(
      (orderGap: number) => {
        return eventPool
          .filter(p => !p.isSitting)
          .map((player, i) => createStandingsEntry(player, i, orderGap, 0));
      },
      [eventPool]
    );

  const state: PlayerDatabaseState = {
    allPlayers,
    eventPool,
    eventPoolIds,
  };

  const actions: PlayerDatabaseActions = {
    // Database
    loadPlayersFromDatabase,
    addNewPlayer,
    updateExistingPlayer,
    deleteExistingPlayer,
    fetchDuprForPlayer,
    resetPlayers,
    setAllPlayers,    // ← ADD
    // Pool
    addPlayerToEventPool,
    removePlayerFromEventPool,
    clearEventPool,
    setEventPool,      // ← ADD
    togglePlayerSitting,
    getPoolStandingsEntries,
  };

  return [state, actions];
}
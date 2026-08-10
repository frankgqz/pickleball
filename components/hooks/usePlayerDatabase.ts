"use client";

// usePlayerDatabase.ts - Player database and event pool management
// Handles: loading players from DB, adding/removing from event pool, DUPR fetching

import { useState, useCallback, useEffect } from "react";
import { Player, StandingsEntry, GameSession } from "@/components/Types";
import { localStorageDb } from "./useLocalStorage";
import { addPlayer, getPlayers, deletePlayer, fetchDuprRating, updatePlayer } from "@/app/actions";
import { createStandingsEntry } from "../standingsUtils";

export interface PlayerDatabaseState {
  // All players in the database
  allPlayers: Player[];
  // Players currently in the event pool
  eventPool: Player[];
  // IDs of players in pool for quick lookup
  eventPoolIds: Set<string>;
}

export interface PlayerDatabaseActions {
  // Database operations
  loadPlayersFromDatabase: () => Promise<void>;
  addNewPlayer: (p: { name: string; duprId?: string; duprNumericId?: string; duprScore?: number }) => Promise<void>;
  updateExistingPlayer: (id: string, updates: Partial<Player>) => Promise<void>;
  deleteExistingPlayer: (id: string) => Promise<void>;
  fetchDuprForPlayer: (playerId: string) => Promise<void>;
  
  // Event pool operations
  addPlayerToEventPool: (player: Player) => void;
  removePlayerFromEventPool: (playerId: string) => void;
  clearEventPool: (newSession: GameSession) => void;
  togglePlayerSitting: (playerId: string) => void;
  
  // Get standings entries for all players in pool
  getPoolStandingsEntries: (orderGap: number, currentRoundNumber: number, lateJoinBonus: number) => StandingsEntry[];
}

export function usePlayerDatabase(
  isAppLoading: boolean, 
  setIsAppLoading: (v: boolean) => void
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

  const loadPlayersFromDatabase = useCallback(async () => {
    try {
      const result = await getPlayers();
      if (result.success && result.players && result.players.length > 0) {
        setAllPlayers(result.players);
      }
    } catch (err) {
      console.warn("Database load failed, using local data:", err);
    } finally {
      setIsAppLoading(false);
    }
  }, [setIsAppLoading]);

  const addNewPlayer = useCallback(async (formData: FormData) => {
    const result = await addPlayer(formData);
    if (result.success && result.player) {
      setAllPlayers(prev => [result.player!, ...prev]);
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
    }
  }, []);

  const deleteExistingPlayer = useCallback(async (id: string) => {
    const result = await deletePlayer(id);
    if (result.success) {
      setAllPlayers(prev => prev.filter(p => p.id !== id));
      setEventPool(prev => prev.filter(p => p.id !== id));
    }
  }, []);

  const fetchDuprForPlayer = useCallback(async (playerId: string) => {
    const result = await fetchDuprRating(playerId);
    if (result.success && result.player) {
      setAllPlayers(prev => prev.map(p => p.id === playerId ? result.player! : p));
    }
  }, []);

  // ============ EVENT POOL OPERATIONS ============

  const addPlayerToEventPool = useCallback((player: Player) => {
    setEventPool(prev => {
      if (prev.find(p => p.id === player.id)) return prev;
      return [player, ...prev];
    });
  }, []);

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

  const getPoolStandingsEntries = useCallback((
    orderGap: number, 
    currentRoundNumber: number, 
    lateJoinBonus: number
  ): StandingsEntry[] => {
    return eventPool.map((player, i) => 
      createStandingsEntry(
        player,
        i,
        orderGap,
        currentRoundNumber > 1 ? lateJoinBonus : 0
      )
    );
  }, [eventPool]);

  // ============ COMBINE STATE & ACTIONS ============

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
    // Pool
    addPlayerToEventPool,
    removePlayerFromEventPool,
    clearEventPool,
    togglePlayerSitting,
    getPoolStandingsEntries,
  };

  return [state, actions];
}
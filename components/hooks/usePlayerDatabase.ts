"use client";
// usePlayerDatabase.ts - Player database and event pool management
// Handles: loading players from DB, adding/removing from event pool, DUPR fetching
import { useState, useCallback, useEffect } from "react";
import { Player, StandingsEntry, GameSession } from "@/components/Types";
import { localStorageDb } from "./useLocalStorage";
import { addPlayer, getClubPlayers, deletePlayer, fetchDuprRating, updatePlayer, addClubPlayer } from "@/app/actions";
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
  loadPlayersFromDatabase: (userId?: string) => Promise<void>;
  addNewPlayer: (formData: FormData) => Promise<void>;
  updateExistingPlayer: (id: string, updates: Partial<Player>) => Promise<void>;
  deleteExistingPlayer: (id: string) => Promise<void>;
  fetchDuprForPlayer: (playerId: string) => Promise<void>;

  // Event pool operations
  addPlayerToEventPool: (player: Player, userId?: string) => void;
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

  const loadPlayersFromDatabase = useCallback(async (userId?: string) => {
    try {
      // Only query club-specific players if user is logged in
      if (userId) {
        const result = await getClubPlayers(userId);
        if (result.success && result.clubPlayers && result.clubPlayers.length > 0) {
          // Extract the player from each ClubPlayer wrapper
          const players = result.clubPlayers.map(cp => cp.player);
          setAllPlayers(players);
          return; // Successfully loaded from DB, done
        }
      }
      // If not logged in OR DB query returned empty, keep using localStorage
      // (allPlayers is already initialized from localStorage in useState)
    } catch (err) {
      console.warn("Database load failed, using local data:", err);
    } finally {
      setIsAppLoading(false);
    }
  }, [setIsAppLoading]);

  const addNewPlayer = useCallback(async (formData: FormData) => {
    const result = await addPlayer(formData);
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
    } else {
      console.error("Failed to add player:", result.error);
    }
  }, []);

  const updateExistingPlayer = useCallback(async (id: string, updates: Partial<Player>) => {
    console.log("updateExistingPlayer called:", { id, updates });
    const formData = new FormData();
    if (updates.name) formData.append("name", updates.name);
    if (updates.duprId !== undefined && updates.duprId !== null) formData.append("duprId", updates.duprId);
    if (updates.duprNumericId !== undefined && updates.duprNumericId !== null) formData.append("duprNumericId", updates.duprNumericId);
    if (updates.manualDuprScore !== undefined && updates.manualDuprScore !== null) formData.append("manualDuprScore", String(updates.manualDuprScore));

    const result = await updatePlayer(id, formData);
    console.log("updateExistingPlayer result:", result);
    if (result.success && result.player) {
      setAllPlayers(prev => {
        const updated = prev.map(p => p.id === id ? result.player! : p);
        console.log("Updated players list:", updated);
        return updated;
      });
    } else {
      console.error("Failed to update player:", result.error);
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

  const addPlayerToEventPool = useCallback(async (player: Player, userId?: string) => {
    setEventPool(prev => {
      if (prev.find(p => p.id === player.id)) return prev;
      return [player, ...prev];
    });
    // If userId provided, also create ClubPlayer record in database
    if (userId) {
      await addClubPlayer(userId, player.id);
    }
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
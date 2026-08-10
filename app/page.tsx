"use client";

import React, { useState, useEffect, useCallback } from "react";
import SettingsPanel from "@/components/SettingsPanel";
import PlayerDatabase from "@/components/PlayerDatabase";
import EventPool from "@/components/EventPool";
import CourtsPanel from "@/components/CourtsPanel";
import StandingsTable from "@/components/StandingsTable";
import RoundHistoryPanel from "@/components/RoundHistoryPanel";
import { CompletedRound, MatchFormat, Player, StandingsEntry } from "@/components/Types";

// Hooks - extracted logic for cleaner page.tsx
import { useEventSession } from "@/components/hooks/useEventSession";
import { usePlayerDatabase } from "@/components/hooks/usePlayerDatabase";
import { useStandingsState } from "@/components/hooks/useStandingsState";
import { useMatchGeneration } from "@/components/hooks/useMatchGeneration";

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export default function Page() {
  // App loading state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ====== EVENT SESSION HOOK ======
  // Manages: config, session ID, round history, restart
  const [eventSessionState, eventSessionActions] = useEventSession();
  const { 
    config, 
    currentSession, 
    roundHistory, 
    roundState, 
    currentRoundNumber,
    setRoundState,  // Now on state object
  } = eventSessionState;
  const { 
    updateConfig, 
    addRoundToHistory, 
    updateRoundInHistory, 
    deleteRoundFromHistory, 
    restartEvent,
  } = eventSessionActions;

  // ====== PLAYER DATABASE HOOK ======
  // Manages: all players, event pool, DUPR fetching
  const [playerDbState, playerDbActions] = usePlayerDatabase(loading, setLoading);
  const { 
    allPlayers, 
    eventPool 
  } = playerDbState;
  const { 
    loadPlayersFromDatabase, 
    addNewPlayer, 
    updateExistingPlayer, 
    deleteExistingPlayer, 
    fetchDuprForPlayer, 
    addPlayerToEventPool, 
    removePlayerFromEventPool, 
    clearEventPool, 
    togglePlayerSitting 
  } = playerDbActions;

  // ====== STANDINGS STATE HOOK ======
  // Manages: standings entries, sorting, percentage calculations
  const [standingsState, standingsActions] = useStandingsState();
  const { 
    standings, 
    computedStandings, 
    setStandings 
  } = standingsState;
  const { 
    toggleSortColumn, 
    recalculateStandingsFromHistory, 
    removePlayerStandingsEntry, 
    addPlayerStandingsEntry, 
    processMatchResults,
    regenerateByes 
  } = standingsActions;

  // ====== MATCH GENERATION HOOK ======
  // Manages: creating matches, updating scores, swapping teams
  const [, matchGenActions] = useMatchGeneration(
    eventPool, 
    standings, 
    config, 
    currentRoundNumber, 
    roundState, 
    setRoundState, 
    () => regenerateByes(config.byeTopProtection, config.byeBonusTop)
  );

  // ============================================================
  // HELPER FUNCTIONS
  // ============================================================

  // Create format objects with explicit type assertions
  const pickPartnerFormat: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };
  const fixed14v23Format: MatchFormat = { type: "FIXED_14V23", partnerLock: true };

  // Start a round with PICK_PARTNER or FIXED_14V23 format
  const startStandardRound = useCallback((format: MatchFormat) => {
    if (currentRoundNumber === 1) {
      regenerateByes(config.byeTopProtection, config.byeBonusTop);
    }
    matchGenActions.generateStandardMatches(format);
  }, [currentRoundNumber, config, regenerateByes, matchGenActions]);

  // Start the next round (pool play or standard based on config)
  const startNextRound = useCallback(() => {
    if (config.format === "POOL_PLAY") {
      matchGenActions.generatePoolPlayMatches(config.poolFinals?.poolsCount || 2);
    } else {
      const roundFmt = config.roundFormat || "FIXED_14V23";
      const format: MatchFormat = roundFmt === "PICK_PARTNER" ? pickPartnerFormat : fixed14v23Format;
      startStandardRound(format);
    }
  }, [config, matchGenActions, startStandardRound]);

  // Submit the current round results
  const submitRoundResults = useCallback(() => {
    // Update standings based on match results
    processMatchResults(roundState.matches, currentRoundNumber, config, eventPool);
    
    // Save round to history
    const completedRound: CompletedRound = {
      roundNumber: currentRoundNumber,
      date: new Date().toISOString(),
      format: roundState.format,
      matches: roundState.matches,
      sittingOut: eventPool.filter(p => p.isSitting).map(p => p.id),
      sessionId: currentSession.sessionId,
    };
    
    addRoundToHistory(completedRound);
  }, [roundState, currentRoundNumber, config, eventPool, currentSession, processMatchResults, addRoundToHistory]);

  // Veto a bye for a player (add penalty to bye calculation)
  const vetoPlayerBye = useCallback((playerId: string) => {
    setStandings((prev: StandingsEntry[]) => prev.map((entry: StandingsEntry) => {
      if (entry.id === playerId) return { ...entry, byeMod: (entry.byeMod || 0) + 0.25 };
      return entry;
    }));
    // Regenerate matches with updated bye values
    const roundFmt = config.roundFormat || "FIXED_14V23";
    const format: MatchFormat = roundFmt === "PICK_PARTNER" ? pickPartnerFormat : fixed14v23Format;
    matchGenActions.generateStandardMatches(format);
  }, [config.roundFormat, matchGenActions, setStandings]);

  // Add player to event pool AND create their standings entry
  const addToPoolWithStandings = useCallback((player: Player) => {
    addPlayerToEventPool(player);
    addPlayerStandingsEntry(player, config.orderGap, currentRoundNumber, config.lateJoinBonus);
  }, [addPlayerToEventPool, addPlayerStandingsEntry, config, currentRoundNumber]);

  // Remove player from event pool AND remove their standings entry
  const removeFromPoolWithStandings = useCallback((playerId: string) => {
    removePlayerFromEventPool(playerId);
    removePlayerStandingsEntry(playerId);
  }, [removePlayerFromEventPool, removePlayerStandingsEntry]);

  // Restart event - clears rounds but keeps players in pool
  const handleRestartEvent = useCallback(() => {
    restartEvent();
    setStandings([]);
  }, [restartEvent, setStandings]);

  // Clear all from event pool - full reset
  const handleClearPool = useCallback(() => {
    clearEventPool(currentSession);
    setStandings([]);
  }, [clearEventPool, currentSession, setStandings]);

  // Edit a past round - recalculate standings
  const handleEditRound = useCallback((updated: CompletedRound) => {
    updateRoundInHistory(updated);
    recalculateStandingsFromHistory(roundHistory, currentSession.sessionId, config, eventPool);
  }, [updateRoundInHistory, roundHistory, currentSession, config, eventPool, recalculateStandingsFromHistory]);

  // Delete a past round - recalculate standings
  const handleDeleteRound = useCallback((roundNumber: number, sessionId: string) => {
    deleteRoundFromHistory(roundNumber, sessionId);
    if (sessionId === currentSession.sessionId) {
      const newHistory = roundHistory.filter(r => !(r.roundNumber === roundNumber && r.sessionId === sessionId));
      recalculateStandingsFromHistory(newHistory, sessionId, config, eventPool);
    }
  }, [deleteRoundFromHistory, roundHistory, currentSession, config, eventPool, recalculateStandingsFromHistory]);

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    loadPlayersFromDatabase();
  }, []);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl text-center max-w-md">
          <p className="text-red-600 font-bold mb-2">Database Error</p>
          <p className="text-gray-700 text-sm">{error}</p>
          <button onClick={loadPlayersFromDatabase} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 p-4 md:p-8">
      <header className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">🏓 Pickleball Event Manager</h1>
        <p className="text-green-100 text-sm">Tournament Management & Round Robin Scheduling</p>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        <SettingsPanel
          config={config}
          updateConfig={updateConfig}
          onRestartEvent={handleRestartEvent}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlayerDatabase
            players={allPlayers}
            eventPool={eventPool}
            onAddPlayer={addNewPlayer}
            onDeletePlayer={deleteExistingPlayer}
            onFetchDupr={fetchDuprForPlayer}
            onUpdatePlayer={updateExistingPlayer}
            onAddToPool={addToPoolWithStandings}
            onRemoveFromPool={removeFromPoolWithStandings}
          />
          <EventPool
            eventPool={eventPool}
            onToggleSitting={togglePlayerSitting}
            onRemoveFromPool={removeFromPoolWithStandings}
            onClearAll={handleClearPool}
          />
        </div>

        <CourtsPanel
          roundState={roundState}
          eventPool={eventPool}
          standings={standings}
          currentRoundNumber={currentRoundNumber}
          defaultRoundFormat={config.roundFormat || "FIXED_14V23"}
          onStartPickPartner={() => startStandardRound(pickPartnerFormat)}
          onStartFixed14v23={() => startStandardRound(fixed14v23Format)}
          onRegenerateByes={() => regenerateByes(config.byeTopProtection, config.byeBonusTop)}
          onUpdateMatchScore={matchGenActions.updateMatchScore}
          onSwapPlayerTeam={matchGenActions.swapPlayerTeam}
          onSubmitRound={submitRoundResults}
          onCancelRound={matchGenActions.cancelRound}
          onVetoBye={vetoPlayerBye}
          onStartNextRound={startNextRound}
          submitted={roundState.submitted}
        />

        <StandingsTable
          standings={computedStandings}
          onRegenerateByes={() => regenerateByes(config.byeTopProtection, config.byeBonusTop)}
        />

        <RoundHistoryPanel
          roundHistory={roundHistory}
          currentSessionId={currentSession.sessionId}
          eventPool={eventPool}
          config={config}
          onEditRound={handleEditRound}
          onDeleteRound={handleDeleteRound}
        />
      </div>
    </div>
  );
}
"use client";

import React, { useState, useEffect, useCallback } from "react";
import SettingsPanel from "@/components/SettingsPanel";
import PlayerDatabase from "@/components/PlayerDatabase";
import EventPool from "@/components/EventPool";
import CourtsPanel from "@/components/CourtsPanel";
import StandingsTable from "@/components/StandingsTable";
import RoundHistoryPanel from "@/components/RoundHistoryPanel";
import { CompletedRound, MatchFormat, Player, StandingsEntry } from "@/components/Types";

// Hooks
import { useEventSession } from "@/components/hooks/useEventSession";
import { usePlayerDatabase } from "@/components/hooks/usePlayerDatabase";
import { useStandingsState } from "@/components/hooks/useStandingsState";
import { useMatchGeneration } from "@/components/hooks/useMatchGeneration";
import { createStandingsEntry } from "@/components/standingsUtils";

// Format constants
const PICK_PARTNER_FORMAT: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };
const FIXED_14V23_FORMAT: MatchFormat = { type: "FIXED_14V23", partnerLock: true };

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ====== EVENT SESSION HOOK ======
  const [eventSessionState, eventSessionActions] = useEventSession();
  const { 
    config, 
    currentSession, 
    roundHistory, 
    roundState, 
    currentRoundNumber,
    setRoundState,
  } = eventSessionState;
  const { 
    updateConfig, 
    addRoundToHistory, 
    updateRoundInHistory, 
    deleteRoundFromHistory, 
    restartEvent,
  } = eventSessionActions;

  // ====== PLAYER DATABASE HOOK ======
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
  const [standingsState, standingsActions] = useStandingsState();
  const { 
    standings, 
    computedStandings, 
    setStandings,
    sortColumn,
    sortDirection,
  } = standingsState;
  const { 
    toggleSortColumn, 
    recalculateStandingsFromHistory, 
    removePlayerStandingsEntry, 
    processMatchResults,
    regenerateByes 
  } = standingsActions;

  // ====== MATCH GENERATION HOOK ======
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
  // RECALCULATE SEEDS - based on DUPR position
  // ============================================================
  const recalculateSeedsByDupr = useCallback(() => {
    setStandings(prev => {
      // Sort by DUPR score (highest first)
      const sorted = [...prev].sort((a, b) => {
        const aScore = a.duprScore ?? 0;
        const bScore = b.duprScore ?? 0;
        return bScore - aScore;
      });

      // Recalculate seeds based on position
      return sorted.map((entry, index) => ({
        ...entry,
        seed: 1 + index * config.orderGap,
        // Reset seed adjustment when pool changes
        seedAdjustment: 0,
        orderHistory: entry.orderHistory.length > 0 
          ? entry.orderHistory 
          : [],
      }));
    });
  }, [config.orderGap, setStandings]);

  // ============================================================
  // ADD PLAYER TO POOL
  // ============================================================
  const addToPoolWithStandings = useCallback((player: Player) => {
    // Don't add duplicates
    if (standings.find(s => s.id === player.id)) return;

    // Add player to pool
    addPlayerToEventPool(player);

    // Create new standings entry
    // Late joiners (after round 1) get the lateJoinBonus in their byeMod
    const lateJoinBonus = currentRoundNumber > 1 ? config.lateJoinBonus : 0;
    
    // Use manualDuprScore if available, otherwise duprScore (API fetched), 
    // otherwise use config.defaultDupr (default 2.5)
    const scoreToUse = player.manualDuprScore ?? player.duprScore ?? config.defaultDupr;
    
    const newEntry: StandingsEntry = {
      id: player.id,
      name: player.name,
      duprId: player.duprId ?? null,
      duprScore: scoreToUse,
      seed: 0,
      seedAdjustment: 0,
      orderHistory: [],
      byeBase: -Math.random(),
      byeMod: lateJoinBonus,
      byeCount: 0,
      sitOutCount: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
    };

    // Add to standings and recalculate all seeds by DUPR position
    setStandings(prev => {
      const updated = [...prev, newEntry];
      
      // Sort by DUPR score (highest first) - use duplexScore if available, otherwise manualDuprScore
      const sorted = updated.sort((a, b) => {
        const aScore = a.duprScore ?? 0;
        const bScore = b.duprScore ?? 0;
        return bScore - aScore;
      });

      // Recalculate seeds based on sorted position
      return sorted.map((entry, index) => ({
        ...entry,
        seed: 1 + index * config.orderGap,
      }));
    });
  }, [addPlayerToEventPool, standings, config.orderGap, setStandings]);

  // ============================================================
  // REMOVE PLAYER FROM POOL
  // ============================================================
  const removeFromPoolWithStandings = useCallback((playerId: string) => {
    removePlayerFromEventPool(playerId);
    removePlayerStandingsEntry(playerId);
  }, [removePlayerFromEventPool, removePlayerStandingsEntry]);

  // ============================================================
  // OTHER HANDLERS
  // ============================================================
  const startStandardRound = useCallback((format: MatchFormat) => {
    if (currentRoundNumber === 1) {
      regenerateByes(config.byeTopProtection, config.byeBonusTop);
    }
    matchGenActions.generateStandardMatches(format);
  }, [currentRoundNumber, config, regenerateByes, matchGenActions]);

  const startNextRound = useCallback(() => {
    if (config.format === "POOL_PLAY") {
      matchGenActions.generatePoolPlayMatches(config.poolFinals?.poolsCount || 2);
    } else {
      const roundFmt = config.roundFormat || "FIXED_14V23";
      const format: MatchFormat = roundFmt === "PICK_PARTNER" ? PICK_PARTNER_FORMAT : FIXED_14V23_FORMAT;
      startStandardRound(format);
    }
  }, [config, matchGenActions, startStandardRound]);

  const submitRoundResults = useCallback(() => {
    processMatchResults(roundState.matches, currentRoundNumber, config, eventPool);
    
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

  const vetoPlayerBye = useCallback((playerId: string) => {
    setStandings((prev: StandingsEntry[]) => prev.map((entry: StandingsEntry) => {
      if (entry.id === playerId) return { ...entry, byeMod: (entry.byeMod || 0) + 0.25 };
      return entry;
    }));
    const roundFmt = config.roundFormat || "FIXED_14V23";
    const format: MatchFormat = roundFmt === "PICK_PARTNER" ? PICK_PARTNER_FORMAT : FIXED_14V23_FORMAT;
    matchGenActions.generateStandardMatches(format);
  }, [config.roundFormat, matchGenActions, setStandings]);

  const handleRestartEvent = useCallback(() => {
    restartEvent();
    setStandings([]);
  }, [restartEvent, setStandings]);

  const handleClearPool = useCallback(() => {
    clearEventPool(currentSession);
    setStandings([]);
  }, [clearEventPool, currentSession, setStandings]);

  const handleEditRound = useCallback((updated: CompletedRound) => {
    updateRoundInHistory(updated);
    recalculateStandingsFromHistory(roundHistory, currentSession.sessionId, config, eventPool);
  }, [updateRoundInHistory, roundHistory, currentSession, config, eventPool, recalculateStandingsFromHistory]);

  const handleDeleteRound = useCallback((roundNumber: number, sessionId: string) => {
    deleteRoundFromHistory(roundNumber, sessionId);
    if (sessionId === currentSession.sessionId) {
      const newHistory = roundHistory.filter(r => !(r.roundNumber === roundNumber && r.sessionId === sessionId));
      recalculateStandingsFromHistory(newHistory, sessionId, config, eventPool);
    }
  }, [deleteRoundFromHistory, roundHistory, currentSession, config, eventPool, recalculateStandingsFromHistory]);

  // Initial load
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
          <button onClick={loadPlayersFromDatabase} className="mt-4 bg-green-600 text-white px-4 py-2 rounded-lg">Retry</button>
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
        <SettingsPanel config={config} updateConfig={updateConfig} onRestartEvent={handleRestartEvent} />

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
          onStartPickPartner={() => startStandardRound(PICK_PARTNER_FORMAT)}
          onStartFixed14v23={() => startStandardRound(FIXED_14V23_FORMAT)}
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
          defaultDupr={config.defaultDupr}
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          handleSort={toggleSortColumn}
          onRegenerateByes={() => regenerateByes(config.byeTopProtection, config.byeBonusTop)}
          getSeedTotal={(e) => e.seed + e.seedAdjustment}
          getByeTotal={(e) => (e.byeBase ?? 0) + e.byeCount + (e.sitOutCount ?? 0) * 0.5 + (e.byeMod ?? 0)}
          getPointDiff={(e) => e.pointsFor - e.pointsAgainst}
          getPtsPct={(e) => e.pointsFor + e.pointsAgainst > 0 ? (e.pointsFor / (e.pointsFor + e.pointsAgainst)) * 100 : 0}
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
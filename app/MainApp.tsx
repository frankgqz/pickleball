"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import SettingsPanel from "@/components/SettingsPanel";
import PlayerDatabase from "@/components/PlayerDatabase";
import EventPool from "@/components/EventPool";
import CourtsPanel from "@/components/CourtsPanel";
import StandingsTable from "@/components/StandingsTable";
import RoundHistoryPanel from "@/components/RoundHistoryPanel";
import { CompletedRound, MatchFormat, Player, StandingsEntry } from "@/components/Types";
import { signIn, signOut } from "next-auth/react";
import { AuthHeader } from "@/components/AuthHeader";
import { loadSession, removeClubPlayer, getSessionList, endSession, deleteSession, getPlayersByIds } from "@/app/actions";


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
  const { data: session } = useSession();
  // @ts-ignore
  const userId = session?.user?.id;

  // ====== EVENT SESSION HOOK ======
  const [eventSessionState, eventSessionActions] = useEventSession();  // ← THIS LINE IS MISSING

  const { 
      updateConfig, 
      addRoundToHistory, 
      updateRoundInHistory, 
      deleteRoundFromHistory, 
      restartEvent,
      startNewSession,
    } = eventSessionActions;

  // NEW — add dbSessionId and startNewSession:
  const { 
      config, 
      currentSession, 
      roundHistory, 
      roundState, 
      currentRoundNumber,
      setRoundState,
      setRoundHistory,       // ← ADD
      setCurrentSession,    // ← ADD
      dbSessionId, 
      setDbSessionId,       // ← ADD
  } = eventSessionState;


  // ====== PLAYER DATABASE HOOK ======
  const [playerDbState, playerDbActions] = usePlayerDatabase(loading, setLoading, currentRoundNumber, config.lateJoinBonus);
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
    togglePlayerSitting,
    resetPlayers,
    setAllPlayers,
    setEventPool,
  } = playerDbActions;

  // ====== STANDINGS STATE HOOK ======
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
  const addToPoolWithStandings = useCallback((player: Player, userId?: string) => {
    // Don't add duplicates
    if (standings.find(s => s.id === player.id)) return;

    // Add player to pool
    // Late joiners (after round 1) get the lateJoinBonus in their byeMod
    const lateJoinBonus = currentRoundNumber > 1 ? config.lateJoinBonus : 0;
    addPlayerToEventPool(player, currentRoundNumber, lateJoinBonus);

    // Use manualDuprScore if available, otherwise duprScore (API fetched)
    const scoreToUse = player.manualDuprScore ?? player.duprScore ?? null;
    
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

  
  const startStandardRound = useCallback(async (format: MatchFormat) => {
      if (currentRoundNumber === 1) {
        regenerateByes(config.byeTopProtection, config.byeBonusTop);
        if (!dbSessionId && userId) {
          await startNewSession(userId, eventPool.map(p => p.id));
        }
      }
      matchGenActions.generateStandardMatches(format);
  }, [currentRoundNumber, config, regenerateByes, matchGenActions, dbSessionId, userId, eventPool, startNewSession]);

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

  const handleEditRound = useCallback((roundNumber: number, updatedMatches: CompletedRound["matches"]) => {
    updateRoundInHistory(roundNumber, updatedMatches);
    // After updateRoundInHistory, we need to use the updated history
    // Create the new history array locally for recalculation
    const newHistory = roundHistory.map(r =>
      r.roundNumber === roundNumber && r.sessionId === currentSession.sessionId
        ? { ...r, matches: updatedMatches }
        : r
    );
    recalculateStandingsFromHistory(newHistory, currentSession.sessionId, config, eventPool);
  }, [updateRoundInHistory, roundHistory, currentSession, config, eventPool, recalculateStandingsFromHistory]);

  const handleDeleteRound = useCallback((roundNumber: number, sessionId: string) => {
    deleteRoundFromHistory(roundNumber, sessionId);
    if (sessionId === currentSession.sessionId) {
      const newHistory = roundHistory.filter(r => !(r.roundNumber === roundNumber && r.sessionId === sessionId));
      recalculateStandingsFromHistory(newHistory, sessionId, config, eventPool);
    }
  }, [deleteRoundFromHistory, roundHistory, currentSession, config, eventPool, recalculateStandingsFromHistory]);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    console.log("[handleLoadSession] firing for:", sessionId);
    const result = await loadSession(sessionId);
    if (result.success && result.session) {
      const { session } = result;
      setCurrentSession({
        sessionId: session.id,
        startDate: new Date(session.createdAt).toISOString(),
      });
      setDbSessionId(sessionId);
      setRoundHistory([]);
      setRoundState({ active: false, format: PICK_PARTNER_FORMAT, matches: [], submitted: false });

      if (session.config) {
        const savedName = (session.config as any).eventName ?? "";
        updateConfig("eventName", String(savedName));
      }

      const rawPlayerIds = session.playerIds as unknown as string[];
      const playerIdArray = Array.isArray(rawPlayerIds) ? rawPlayerIds : rawPlayerIds ? JSON.parse(rawPlayerIds as string) : [];

      if (playerIdArray.length > 0) {
        const playersResult = await getPlayersByIds(playerIdArray);
        if (playersResult.success && playersResult.players) {
          const loadedPlayers = playersResult.players;
          setAllPlayers(loadedPlayers);
          setEventPool(loadedPlayers);

          if (session.rounds) {
            const loadedRounds = session.rounds as unknown as CompletedRound[];
            loadedRounds.forEach(round => addRoundToHistory(round));
            recalculateStandingsFromHistory(loadedRounds, sessionId, config, loadedPlayers);
          }
        }
      } else if (session.rounds) {
        const loadedRounds = session.rounds as unknown as CompletedRound[];
        loadedRounds.forEach(round => addRoundToHistory(round));
        recalculateStandingsFromHistory(loadedRounds, sessionId, config, []);
      }
    }
  }, [config, updateConfig, addRoundToHistory, recalculateStandingsFromHistory, setAllPlayers, setEventPool, setCurrentSession, setDbSessionId, setRoundHistory, setRoundState]);

  // Initial load
    useEffect(() => {
    loadPlayersFromDatabase(session?.user?.id);
    }, [session?.user?.id, loadPlayersFromDatabase]);


    useEffect(() => {
    if (!session) {
        resetPlayers();
    }
    }, [session, resetPlayers]);

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


  return (
    <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 p-4 md:p-8">
      <header className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-1">🏓 Pickleball Event Manager</h1>
        <p className="text-green-100 text-sm">Tournament Management & Round Robin Scheduling</p>
      </header>

      <AuthHeader session={session} />

      <div className="max-w-6xl mx-auto space-y-6">
        <SettingsPanel config={config} updateConfig={updateConfig} onRestartEvent={handleRestartEvent} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PlayerDatabase
            players={allPlayers}
            userId={session?.user?.id}  // ← Add this
            eventPool={eventPool}
            onAddPlayer={(formData) => addNewPlayer(formData, session?.user?.id)}
            onDeletePlayer={deleteExistingPlayer}
            onRemoveFromClubRoster={(playerId) => removeClubPlayer(session!.user.id, playerId)}  // <-- Add this
            onFetchDupr={fetchDuprForPlayer}
            onUpdatePlayer={updateExistingPlayer}
            onAddToPool={(player) => addToPoolWithStandings(player, userId)}
            onRemoveFromPool={removeFromPoolWithStandings}
            onRefreshPlayers={() => loadPlayersFromDatabase(session?.user?.id)}  // ← Add this
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
          onRegenerateByes={() => regenerateByes(config.byeTopProtection, config.byeBonusTop)}
        />

        <RoundHistoryPanel
          roundHistory={roundHistory}
          currentSessionId={currentSession.sessionId}
          eventPool={eventPool}
          config={config}
          onEditRound={handleEditRound}
          onDeleteRound={handleDeleteRound}
          userId={session?.user?.id}           // ← ADD
          currentDbSessionId={dbSessionId}    // ← ADD
          onLoadSession={handleLoadSession}
          onEndSession={async (id) => {
            await endSession(id);
            setCurrentSession({ sessionId: Date.now().toString(), startDate: new Date().toISOString() });
            setDbSessionId(undefined);
            setRoundHistory([]);
            setRoundState({ active: false, format: PICK_PARTNER_FORMAT, matches: [], submitted: false });
            setEventPool([]);
            setStandings([]);
          }}
          onDeleteSession={async (id) => {
            await deleteSession(id);
            setCurrentSession({ sessionId: Date.now().toString(), startDate: new Date().toISOString() });
            setDbSessionId(undefined);
            setRoundHistory([]);
            setRoundState({ active: false, format: PICK_PARTNER_FORMAT, matches: [], submitted: false });
            setEventPool([]);
            setStandings([]);
          }}
          />
      </div>
    </div>
  );
}



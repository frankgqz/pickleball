"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import { ThemeToggle } from './ThemeToggle'
import { loadSession, removeClubPlayer, getSessionList, endSession, deleteSession, getPlayersByIds, updateSession } from "@/app/actions";
 
// Hooks
import { useEventSession } from "@/components/hooks/useEventSession";
import { usePlayerDatabase } from "@/components/hooks/usePlayerDatabase";
import { useStandingsState } from "@/components/hooks/useStandingsState";
import { useMatchGeneration } from "@/components/hooks/useMatchGeneration";
import { createStandingsEntry, buildEntriesFromPlayers, calculateStandingsFromRounds, initializeSeeds } from "@/components/standingsUtils";

// Format constants
const PICK_PARTNER_FORMAT: MatchFormat = { type: "PICK_PARTNER", allowPartnerRepeat: false };
const FIXED_14V23_FORMAT: MatchFormat = { type: "FIXED_14V23", partnerLock: true };

export default function Page() {
  const [loading, setLoading] = useState(true);
  const wasAuthed = useRef(false);
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);
  const [sessionEnded, setSessionEnded] = useState(false);
  const { data: session, status: authStatus } = useSession();
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
    // Guard on POOL state (what the + button shows) — a standings-only
    // match must not dead-end the click (2026-10-07); stale entries heal below
    if (eventPool.find(p => p.id === player.id)) return;

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
      const updated = [...prev.filter(s => s.id !== player.id), newEntry];
      
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
  }, [addPlayerToEventPool, eventPool, config.orderGap, setStandings]);

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
          setSessionEnded(false);
        }
      }
      matchGenActions.generateStandardMatches(format);
      // Keep standings in step at round start too (not just round submit/load)
      standingsActions.recalculateStandingsFromHistory(roundHistory, currentSession.sessionId, config, eventPool);
  }, [currentRoundNumber, config, regenerateByes, matchGenActions, dbSessionId, userId, eventPool, startNewSession, standingsActions, roundHistory, currentSession]);

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
    setSessionRefreshKey((k: number) => k + 1);
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
    // The pool is kept on restart — rehydrate standings from it instead of
    // leaving the table empty (Frank 2026-10-08: "the standings disappear")
    setStandings(initializeSeeds(buildEntriesFromPlayers(eventPool), config.orderGap));
    setSessionEnded(false);
  }, [restartEvent, setStandings, eventPool, config.orderGap]);

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

  const handleRenameSession = async (newName: string) => {
    if (!dbSessionId) return { success: false };
    const r = await updateSession(dbSessionId, { name: newName });
    if (r.success) {
      setCurrentSession((prev: any) => ({ ...prev, name: newName }));
      setSessionRefreshKey((k: number) => k + 1);
    }
    return r;
  };

  const handleContinueSession = useCallback(async (id: string) => {
    const r = await updateSession(id, { isEnded: false });
    if (r.success) {
      setSessionEnded(false);
      setSessionRefreshKey((k: number) => k + 1);
    }
  }, []);

  const handleLoadSession = useCallback(async (sessionId: string) => {
    console.log("[handleLoadSession] firing for:", sessionId);
    const result = await loadSession(sessionId);
    if (result.success && result.session) {
      const { session } = result;
      setCurrentSession({
        sessionId: session.id,
        startDate: new Date(session.createdAt).toISOString(),
        name: session.name || undefined,
      });
      setDbSessionId(sessionId);
      setSessionEnded(!!(session as any).isEnded);
      setRoundHistory([]);
      setRoundState({ active: false, format: PICK_PARTNER_FORMAT, matches: [], submitted: false });
      if (session.config) {
        const savedName = (session.config as any).eventName ?? "";
        updateConfig("eventName", String(savedName));
      }
      // Reset first: stale pool/standings from a previously loaded session
      // must not survive into this one (empty-session bug 2026-10-07)
      setEventPool([]);
      setStandings([]);
      const rawPlayerIds = session.playerIds as unknown as string[];
      const playerIdArray = Array.isArray(rawPlayerIds) ? rawPlayerIds : rawPlayerIds ? JSON.parse(rawPlayerIds as string) : [];
      if (playerIdArray.length > 0) {
        const playersResult = await getPlayersByIds(playerIdArray);
        if (playersResult.success && playersResult.players) {
          const loadedPlayers = playersResult.players;
          setEventPool(loadedPlayers);
          const freshEntries = buildEntriesFromPlayers(loadedPlayers);
          setStandings(initializeSeeds(freshEntries, config.orderGap));
          if (session.rounds) {
            const loadedRounds = session.rounds as unknown as CompletedRound[];
            const computed = initializeSeeds(calculateStandingsFromRounds(freshEntries, loadedRounds), config.orderGap);
            setStandings(computed);
            loadedRounds.forEach(round => addRoundToHistory(round));
          }
        }
      } else if (session.rounds) {
        // Rounds-only session: derive pool + standings from ONE source so
        // they cannot diverge (the + button keys off pool state)
        const loadedRounds = session.rounds as unknown as CompletedRound[];
        loadedRounds.forEach(round => addRoundToHistory(round));
        const computed = initializeSeeds(calculateStandingsFromRounds([], loadedRounds), config.orderGap);
        setStandings(computed);
        setEventPool(computed.map(e => ({ id: e.id, name: e.name, duprId: e.duprId, duprScore: e.duprScore })) as unknown as Player[]);
      }
    }
  }, [config, updateConfig, addRoundToHistory, setStandings, setEventPool, setCurrentSession, setDbSessionId, setRoundHistory, setRoundState]);

  // Initial load
    useEffect(() => {
    loadPlayersFromDatabase(session?.user?.id);
    }, [session?.user?.id, loadPlayersFromDatabase]);


    useEffect(() => {
    // Wipe ONLY on a real logout transition — not on mount (session is
    // briefly undefined while auth loads; that used to clear the hydrated
    // pool on every refresh)
    if (authStatus === "authenticated") {
        wasAuthed.current = true;
        return;
    }
    if (authStatus === "unauthenticated" && wasAuthed.current) {
        wasAuthed.current = false;
        resetPlayers();
    }
    }, [authStatus, resetPlayers]);

  // ============================================================
  // RENDER
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-text text-xl">Loading...</p>
      </div>
    );
  }

  
// <p className="text-sm">Tournament Management & Round Robin Scheduling</p>

  return (
    <div className="min-h-screen p-4 md:p-8">
      <header className="mb-6 px-2 max-w-6xl mx-auto">
        <div className="flex items-center justify-center gap-4 mb-4">
          <h1 className="text-2xl md:text-3xl font-bold">🏓 Pickleball</h1>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between gap-4">
          <a
            href="https://gqz.app"
            onClick={(e) => { if (!confirm("Are you sure you want to leave this page?")) e.preventDefault(); }}
            className="text-lg px-2 py-1 rounded-md hover:opacity-80 transition-opacity"
            aria-label="Home"
          >
            🏠
          </a>
          <AuthHeader session={session} />
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-6">
        <SettingsPanel config={config} updateConfig={updateConfig} onRestartEvent={handleRestartEvent} sessionId={dbSessionId} sessionName={currentSession.name} onRenameSession={handleRenameSession} />

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
          sessionEnded={sessionEnded}
          onContinueSession={() => dbSessionId && handleContinueSession(dbSessionId)}
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
          sessionRefreshKey={sessionRefreshKey}
          currentDbSessionId={dbSessionId}    // ← ADD
          onLoadSession={handleLoadSession}
          onEndSession={async (id) => {
            // End = DB flag only; keep the session loaded so standings/rounds stay viewable
            await endSession(id);
            setSessionEnded(true);
          }}
          onContinueSession={handleContinueSession}
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



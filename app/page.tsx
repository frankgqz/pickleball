"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import MatchList from '@/components/MatchList';
import MatchCard from '@/components/MatchCard';
import StandingsTable from '@/components/StandingsTable';
import PairingControls from '@/components/PairingControls';
import SeedingControls from '@/components/SeedingControls';
import SeedingPanel from '@/components/SeedingPanel';
import HistoryPanel from '@/components/HistoryPanel';
import RoundHistoryPanel from '@/components/RoundHistoryPanel';
import SettingsPanel from '@/components/SettingsPanel';
import HelpModal from '@/components/HelpModal';
import MatchFormatSelector from '@/components/MatchFormatSelector';
import { generateMatches, MatchFormat } from '@/components/PairingEngine';
import { StandingsEntry, RoundHistory, Session, Match, TiebreakerConfig, MatchResult, GroupName, BracketType, MatchFormatType } from '@/components/Types';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { calculateStandings } from '@/components/StandingsCalculator';
import { getStandingsKey, saveStandingsToStorage, loadStandingsFromStorage, saveRoundsToStorage, loadRoundsFromStorage, saveSessionToStorage, loadSessionFromStorage } from '@/components/StorageService';

interface Participant {
  id: string;
  name: string;
  seed?: number;
}

export default function Home() {
  const router = useRouter();

  // Core state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [roundHistory, setRoundHistory] = useLocalStorage<RoundHistory[]>('roundHistory', []);
  const [standings, setStandings] = useLocalStorage<StandingsEntry[]>('standings', []);
  const [currentRound, setCurrentRound] = useState(1);
  const [isStarted, setIsStarted] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Match controls state
  const [matchFormat, setMatchFormat] = useState<MatchFormat>('PICK_PARTNER');
  const [autoPair, setAutoPair] = useState(true);
  const [sortBy, setSortBy] = useState<'points' | 'seed'>('points');
  const [allowBye, setAllowBye] = useState(false);
  const [byesCompleted, setByesCompleted] = useState<string[]>([]);

  // Standings display settings
  const [tiebreakerConfig, setTiebreakerConfig] = useState<TiebreakerConfig>({
    primary: 'buchholz',
    secondary: 'solidarity',
    tertiary: 'modifiedMedian',
  });

  // Seeding & groups state
  const [customSeedMap, setCustomSeedMap] = useState<Record<string, number>>({});
  const [groupName, setGroupName] = useState<GroupName>('A');
  const [bracketType, setBracketType] = useState<BracketType>('single');
  const [showSeedingPanel, setShowSeedingPanel] = useState(false);
  const [showSeedingControls, setShowSeedingControls] = useState(true);

  // Pairing mode state
  const [pairingMode, setPairingMode] = useState<'swiss' | 'group' | 'bracket'>('swiss');

  // History/Undo state
  const [undoStack, setUndoStack] = useState<StandingsEntry[][]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState(-1);

  // Timer state
  const [timeLimit, setTimeLimit] = useState(45);
  const [timeWarnings, setTimeWarnings] = useState<Record<string, number>>({});

  // Advanced controls state
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandUnmatched, setExpandUnmatched] = useState(true);

  // Auto-save
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = useRef<string>('');

  const { startTimer, pauseTimer, resetTimer, getElapsedTime } = useMatchTimer();

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const [loadedStandings, loadedRounds, loadedSession] = await Promise.all([
          loadStandingsFromStorage(),
          loadRoundsFromStorage(),
          loadSessionFromStorage(),
        ]);

        if (loadedStandings && loadedStandings.length > 0) {
          setStandings(loadedStandings);
          const names = loadedStandings.map(s => ({ id: s.id, name: s.name, seed: s.seed }));
          setParticipants(names);
          setIsStarted(true);
          if (loadedRounds.length > 0) {
            setCurrentRound(loadedRounds[loadedRounds.length - 1].roundNumber + 1);
            setRoundHistory(loadedRounds);
          }
        }

        if (loadedSession) {
          setCurrentSession(loadedSession);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-save when standings change
  useEffect(() => {
    const currentData = JSON.stringify(standings);
    if (currentData !== lastSavedRef.current && standings.length > 0) {
      lastSavedRef.current = currentData;
      if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
      autoSaveRef.current = setTimeout(() => {
        saveStandingsToStorage(standings);
        if (currentSession) saveSessionToStorage(currentSession);
      }, 1000);
    }
  }, [standings, currentSession]);

  // Session management
  const startNewSession = useCallback((group: GroupName = 'A') => {
    const session: Session = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      group,
      startTime: new Date().toISOString(),
      endTime: null,
    };
    setCurrentSession(session);
    setCurrentRound(1);
    setRoundHistory([]);
    setStandings([]);
    setUndoStack([]);
    setCurrentHistoryIndex(-1);
    setByesCompleted([]);
    saveSessionToStorage(session);
    return session;
  }, [setCurrentSession, setCurrentRound, setRoundHistory, setStandings, setUndoStack, setCurrentHistoryIndex, setByesCompleted]);

  const endSession = useCallback(() => {
    if (currentSession) {
      const ended: Session = { ...currentSession, endTime: new Date().toISOString() };
      setCurrentSession(ended);
      saveSessionToStorage(ended);
    }
  }, [currentSession]);

  // Standings helpers
  const getStandings = useCallback((entries: StandingsEntry[], sortByRef: 'points' | 'seed' = sortBy) => {
    const sorted = [...entries].sort((a, b) => {
      if (sortByRef === 'seed') return (a.seed ?? 999) - (b.seed ?? 999);
      if (b.points !== a.points) return b.points - a.points;
      const tbKeys = Object.keys(tiebreakerConfig) as (keyof TiebreakerConfig)[];
      for (const key of tbKeys) {
        const val = tiebreakerConfig[key];
        if (val && a.tiebreakers[val] !== undefined && b.tiebreakers[val] !== undefined) {
          if (b.tiebreakers[val] - a.tiebreakers[val] !== 0) return b.tiebreakers[val] - a.tiebreakers[val];
        }
      }
      return (a.seed ?? 999) - (b.seed ?? 999);
    });
    return sorted;
  }, [tiebreakerConfig, sortBy]);

  // Initialize participants & standings
  const initializeTournament = useCallback((names: string[]) => {
    const session = startNewSession(groupName);
    const initial = names.map((n, i) => ({
      id: `p-${Date.now()}-${i}`,
      name: n,
      seed: i + 1,
      points: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      byes: 0,
      seedAdjustment: 0,
      byeCount: 0,
      sitOutCount: 0,
      matches: [],
      opponents: [],
      matchPoints: [],
      tiebreakers: { buchholz: 0, solid: 0, modMedian: 0 },
      orderHistory: [],
      group,
    } as StandingsEntry));
    setParticipants(names.map((name, i) => ({ id: initial[i].id, name, seed: i + 1 })));
    setStandings(initial);
    saveStandingsToStorage(initial);
    setIsStarted(true);
    setCurrentRound(1);
    return { session, initial };
  }, [groupName, startNewSession, setParticipants, setStandings, setIsStarted, setCurrentRound]);

  // Generate & apply matches
  const applyMatches = useCallback((entries: StandingsEntry[], format: MatchFormat, forceGroup?: GroupName) => {
    const sorted = getStandings(entries, sortBy);
    const matchFormat: MatchFormat = format as MatchFormat;
    const matches = generateMatches(sorted, matchFormat, forceGroup ?? groupName, customSeedMap, allowBye && byesCompleted.length === 0);
    const entriesMap = new Map(entries.map(e => [e.id, { ...e }]));
    const validMatches: typeof matches = [];

    for (const m of matches) {
      if (m.bye) {
        if (m.byePlayerId) {
          const e = entriesMap.get(m.byePlayerId);
          if (e) { e.byes++; e.points += 1; e.pointsFor += 3; e.pointsAgainst += 0; e.byeCount++; e.orderHistory.push({ round: currentRound, change: 1, reason: 'bye' }); }
        }
      } else {
        if (m.player1 && m.player2) {
          validMatches.push(m);
        }
      }
    }

    const nextStandings = Array.from(entriesMap.values());
    return { matches: validMatches, standings: nextStandings };
  }, [getStandings, sortBy, groupName, customSeedMap, allowBye, byesCompleted, currentRound]);

  const handleStartTournament = useCallback((names: string[]) => {
    const { session } = initializeTournament(names);
    setShowSeedingPanel(true);
  }, [initializeTournament]);

  const handleGenerateRound = useCallback(() => {
    if (standings.length === 0) return;
    const { matches, standings: updated } = applyMatches(standings, matchFormat, groupName);
    if (matches.length === 0 && (allowBye && byesCompleted.length > 0)) return;

    const entryMap = new Map(updated.map(e => [e.id, { ...e }]));
    matches.forEach(m => {
      if (m.player1Id) {
        const e1 = entryMap.get(m.player1Id);
        if (e1) { e1.matches.push(m.id); e1.opponents.push(m.player2Id!); }
      }
      if (m.player2Id) {
        const e2 = entryMap.get(m.player2Id);
        if (e2) { e2.matches.push(m.id); e2.opponents.push(m.player1Id!); }
      }
    });

    const roundMatches = matches.map(m => {
      const p1Name = updated.find(e => e.id === m.player1Id)?.name ?? 'Unknown';
      const p2Name = m.player2Id ? (updated.find(e => e.id === m.player2Id)?.name ?? 'Unknown') : 'BYE';
      return { ...m, player1Name: p1Name, player2Name: p2Name, round: currentRound };
    });

    const newHistory: RoundHistory = { roundNumber: currentRound, sessionId: currentSession?.sessionId ?? '', timestamp: new Date().toISOString(), matches: roundMatches };
    setRoundHistory(prev => {
      const updated = [...prev, newHistory];
      saveRoundsToStorage(updated);
      return updated;
    });

    setUndoStack(prev => [...prev.slice(0, currentHistoryIndex + 1), JSON.parse(JSON.stringify(updated))]);
    setCurrentHistoryIndex(prev => prev + 1);

    if (matches.some(m => m.bye)) {
      setByesCompleted(prev => [...prev, ...matches.filter(m => m.bye && m.byePlayerId).map(m => m.byePlayerId!)]);
    }

    setStandings(Array.from(entryMap.values()));
    setCurrentRound(prev => prev + 1);
    startTimer();
  }, [standings, matchFormat, groupName, allowBye, byesCompleted, currentSession, applyMatches, setRoundHistory, setUndoStack, setCurrentHistoryIndex, setStandings, setCurrentRound, startTimer]);

  const handleRecordResult = useCallback((matchId: string, result: MatchResult, byePlayerId?: string) => {
    const updated = [...standings];
    const entryMap = new Map(updated.map(e => ({ ...e })));

    if (byePlayerId) {
      const e = entryMap.get(byePlayerId);
      if (e) { e.wins++; e.points += 1; e.pointsFor += 3; e.pointsAgainst += 0; e.orderHistory.push({ round: currentRound, change: 1, reason: 'BYE-round-win' }); }
    }

    if (result.winnerId) {
      const winner = entryMap.get(result.winnerId);
      const loser = result.loserId ? entryMap.get(result.loserId) : null;
      if (winner) {
        const loserPts = result.loserPoints ?? 0;
        const winnerPts = result.winnerPoints ?? 3;
        winner.wins++; winner.points += 1; winner.pointsFor += winnerPts; winner.pointsAgainst += loserPts; winner.matchPoints.push(winnerPts);
        if (loserPts === 0) winner.orderHistory.push({ round: currentRound, change: 0, reason: 'sweep' });
        else if (winnerPts === 2) winner.orderHistory.push({ round: currentRound, change: 1, reason: 'close-win' });
      }
      if (loser) {
        loser.losses++; loser.pointsFor += loserPts; loser.pointsAgainst += winnerPts; loser.matchPoints.push(loserPts);
      }
    } else if (result.tie) {
      const p1 = entryMap.get(result.player1Id);
      const p2 = entryMap.get(result.player2Id);
      if (p1) { p1.ties++; p1.points += 0.5; p1.pointsFor += 1; p1.pointsAgainst += 1; p1.matchPoints.push(1); }
      if (p2) { p2.ties++; p2.points += 0.5; p2.pointsFor += 1; p2.pointsAgainst += 1; p2.matchPoints.push(1); }
    }

    const recalculated = calculateStandings(Array.from(entryMap.values()), tiebreakerConfig);
    setStandings(recalculated);
    setUndoStack(prev => [...prev.slice(0, currentHistoryIndex + 1), JSON.parse(JSON.stringify(recalculated))]);
    setCurrentHistoryIndex(prev => prev + 1);
    saveStandingsToStorage(recalculated);

    setRoundHistory(prev => {
      const updated = prev.map(r => {
        if (r.matches.some(m => m.id === matchId)) {
          return { ...r, matches: r.matches.map(m => m.id === matchId ? { ...m, result } : m) };
        }
        return r;
      });
      saveRoundsToStorage(updated);
      return updated;
    });
  }, [standings, currentRound, tiebreakerConfig, setStandings, setUndoStack, setCurrentHistoryIndex, setRoundHistory]);

  const handleUndo = useCallback(() => {
    if (currentHistoryIndex > 0) {
      const prev = undoStack[currentHistoryIndex - 1];
      setStandings(prev);
      setCurrentHistoryIndex(prev => prev - 1);
      setCurrentRound(prev => Math.max(1, prev - 1));
    }
  }, [currentHistoryIndex, undoStack, setStandings, setCurrentHistoryIndex, setCurrentRound]);

  const handleRedo = useCallback(() => {
    if (currentHistoryIndex < undoStack.length - 1) {
      const next = undoStack[currentHistoryIndex + 1];
      setStandings(next);
      setCurrentHistoryIndex(prev => prev + 1);
      setCurrentRound(prev => prev + 1);
    }
  }, [currentHistoryIndex, undoStack, setStandings, setCurrentHistoryIndex, setCurrentRound]);

  const handleDeleteRound = useCallback((roundNumber: number, sessionId: string) => {
    const newHistory = roundHistory.filter(r => !(r.roundNumber === roundNumber && r.sessionId === sessionId));
    setRoundHistory(newHistory);
    saveRoundsToStorage(newHistory);

    if (sessionId === currentSession?.sessionId) {
      setStandings(prev => {
        const baseMap = new Map<Record<string, StandingsEntry>>();
        prev.forEach(s => {
          baseMap.set(s.id, { ...s, seedAdjustment: 0, byeCount: 0, sitOutCount: 0, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0, points: 0, orderHistory: [] });
        });

        const sessionRoundsSorted = newHistory.filter(r => r.sessionId === sessionId).sort((a, b) => a.roundNumber - b.roundNumber);
        sessionRoundsSorted.forEach(r => {
          r.matches.forEach(m => {
            if (m.bye && m.byePlayerId) {
              const s = baseMap.get(m.byePlayerId);
              if (s) { s.byeCount = (s.byeCount || 0) + 1; s.points += 1; s.pointsFor += 3; s.wins += 1; s.orderHistory.push({ round: r.roundNumber, change: 1, reason: 'bye' }); }
            } else {
              const p1 = m.player1Id ? baseMap.get(m.player1Id) : undefined;
              const p2 = m.player2Id ? baseMap.get(m.player2Id) : undefined;
              if (m.result) {
                if (m.result.tie) {
                  if (p1) { p1.ties++; p1.points += 0.5; p1.pointsFor += 1; p1.pointsAgainst += 1; }
                  if (p2) { p2.ties++; p2.points += 0.5; p2.pointsFor += 1; p2.pointsAgainst += 1; }
                } else if (m.result.winnerId) {
                  const w = baseMap.get(m.result.winnerId);
                  const l = m.result.loserId ? baseMap.get(m.result.loserId) : undefined;
                  if (w) { w.wins++; w.points += 1; w.pointsFor += (m.result.winnerPoints ?? 3); w.pointsAgainst += (m.result.loserPoints ?? 0); }
                  if (l) { l.losses++; l.pointsFor += (m.result.loserPoints ?? 0); l.pointsAgainst += (m.result.winnerPoints ?? 3); }
                }
              }
            }
          });
        });

        return Array.from(baseMap.values());
      });
    }
  }, [roundHistory, currentSession, setRoundHistory, setStandings]);

  const handleReset = useCallback(() => {
    if (confirm('Reset tournament? This will clear all standings, rounds, and history.')) {
      setParticipants([]);
      setStandings([]);
      setRoundHistory([]);
      setUndoStack([]);
      setCurrentHistoryIndex(-1);
      setCurrentRound(1);
      setIsStarted(false);
      setByesCompleted([]);
      localStorage.removeItem('standings');
      localStorage.removeItem('roundHistory');
      localStorage.removeItem('currentSession');
    }
  }, [setParticipants, setStandings, setRoundHistory, setUndoStack, setCurrentHistoryIndex, setCurrentRound, setIsStarted, setByesCompleted]);

  // Seeding helpers
  const getDisplaySeed = useCallback((entry: StandingsEntry) => {
    const adj = customSeedMap[entry.id];
    const effective = adj !== undefined ? adj : entry.seed ?? 999;
    return effective;
  }, [customSeedMap]);

  const handleAssignSeeding = useCallback((updates: Record<string, number>) => {
    setCustomSeedMap(prev => ({ ...prev, ...updates }));
    const updated = standings.map(s => ({ ...s, seed: updates[s.id] ?? s.seed }));
    setStandings(updated);
  }, [standings, setStandings, setCustomSeedMap]);

  // Current matches for display
  const getCurrentMatches = useCallback(() => {
    const lastRound = roundHistory.filter(r => r.sessionId === currentSession?.sessionId).sort((a, b) => b.roundNumber - a.roundNumber)[0];
    return lastRound?.matches ?? [];
  }, [roundHistory, currentSession]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading tournament data...</div>
      </div>
    );
  }

  // Not started - show welcome / init
  if (!isStarted) {
    return (
      <>
        <Header onOpenHelp={() => setShowHelp(true)} showHelp={showHelp} onCloseHelp={() => setShowHelp(false)} />
        <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-8">
            <h2 className="text-2xl font-bold text-white mb-2">New Tournament</h2>
            <p className="text-slate-400 mb-6">Enter player names (one per line)</p>
            <textarea
              id="participantInput"
              className="w-full bg-slate-900/50 border border-slate-600 rounded-lg p-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none min-h-[200px] mb-4"
              placeholder="Alice&#10;Bob&#10;Charlie&#10;Diana"
              onKeyDown={e => {
                if (e.key === 'Enter' && e.ctrlKey) {
                  const textarea = e.currentTarget as HTMLTextAreaElement;
                  const names = textarea.value.split('\n').map(n => n.trim()).filter(Boolean);
                  if (names.length >= 2) handleStartTournament(names);
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const textarea = document.getElementById('participantInput') as HTMLTextAreaElement;
                  const names = textarea.value.split('\n').map(n => n.trim()).filter(Boolean);
                  if (names.length >= 2) handleStartTournament(names);
                  else alert('Enter at least 2 participants');
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all"
              >
                Start Tournament
              </button>
              <button
                onClick={() => router.push('/history')}
                className="bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-3 px-6 rounded-xl transition-all"
              >
                View History
              </button>
            </div>
            <p className="text-slate-500 text-sm mt-3 text-center">or press Ctrl+Enter</p>
          </div>
        </main>
      </>
    );
  }

  // Active tournament view
  const currentMatches = getCurrentMatches();

  return (
    <>
      <Header onOpenHelp={() => setShowHelp(true)} showHelp={showHelp} onCloseHelp={() => setShowHelp(false)} />
      <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Seeding Panel */}
      {showSeedingPanel && (
        <SeedingPanel
          participants={participants}
          onAssign={handleAssignSeeding}
          onClose={() => setShowSeedingPanel(false)}
          customSeedMap={customSeedMap}
        />
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-4 space-y-4">
        {/* Top Controls Row */}
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSeedingControls(!showSeedingControls)} className="text-slate-400 hover:text-white transition-colors text-sm">
              {showSeedingControls ? 'Hide' : 'Show'} Seeding
            </button>
            {currentSession && (
              <span className="text-slate-500 text-sm">Session: {currentSession.group}</span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleUndo} disabled={currentHistoryIndex <= 0} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm py-2 px-4 rounded-lg transition-all">
              ↶ Undo
            </button>
            <button onClick={handleRedo} disabled={currentHistoryIndex >= undoStack.length - 1} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white text-sm py-2 px-4 rounded-lg transition-all">
              Redo ↷
            </button>
            <button onClick={() => setShowHistory(!showHistory)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-all">
              {showHistory ? 'Hide' : 'Show'} History
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm py-2 px-4 rounded-lg transition-all">
              ⚙
            </button>
            <button onClick={handleReset} className="bg-red-900/50 hover:bg-red-800 text-red-300 text-sm py-2 px-4 rounded-lg transition-all">
              Reset
            </button>
          </div>
        </div>

        {/* Seeding Controls */}
        {showSeedingControls && (
          <SeedingControls
            participants={participants}
            customSeedMap={customSeedMap}
            onAssign={handleAssignSeeding}
          />
        )}

        {/* Settings Panel */}
        {showSettings && (
          <SettingsPanel
            sortBy={sortBy}
            onSortByChange={setSortBy}
            tiebreakerConfig={tiebreakerConfig}
            onTiebreakerChange={setTiebreakerConfig}
            allowBye={allowBye}
            onAllowByeChange={setAllowBye}
            timeLimit={timeLimit}
            onTimeLimitChange={setTimeLimit}
          />
        )}

        {/* History Panel */}
        {showHistory && (
          <HistoryPanel
            roundHistory={roundHistory}
            currentSessionId={currentSession?.sessionId ?? ''}
            onDeleteRound={handleDeleteRound}
            onRecordResult={handleRecordResult}
          />
        )}

        {/* Match Controls */}
        <PairingControls
          matchFormat={matchFormat}
          onMatchFormatChange={setMatchFormat}
          autoPair={autoPair}
          onAutoPairChange={setAutoPair}
          onGenerateRound={handleGenerateRound}
          expandUnmatched={expandUnmatched}
          onExpandUnmatchedChange={setExpandUnmatched}
        />

        {/* Current Round Matches */}
        {currentMatches.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Round {currentRound - 1} Matches</h2>
              <button onClick={pauseTimer} className="text-slate-400 hover:text-white text-sm">
                ⏸ Pause Timer
              </button>
            </div>
            <MatchList matches={currentMatches} onRecordResult={handleRecordResult} getDisplaySeed={getDisplaySeed} />
          </div>
        )}

        {/* Standings Table */}
        <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4">
          <h2 className="text-xl font-bold text-white mb-4">Standings</h2>
          <StandingsTable
            entries={getStandings(standings)}
            tiebreakerConfig={tiebreakerConfig}
            getDisplaySeed={getDisplaySeed}
          />
        </div>

        {/* Round History Panel */}
        <RoundHistoryPanel
          roundHistory={roundHistory}
          currentSessionId={currentSession?.sessionId ?? ''}
          onDeleteRound={handleDeleteRound}
        />
      </main>
    </>
  );
}
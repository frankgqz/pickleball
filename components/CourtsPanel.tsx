"use client";

import React, { useMemo, useState } from "react";
import { Match, Player, StandingsEntry, RoundState } from "./Types";

interface Props {
  roundState: RoundState;
  eventPool: Player[];
  standings: StandingsEntry[];
  currentRoundNumber: number;
  defaultRoundFormat?: "FIXED_14V23" | "PICK_PARTNER";
  onStartPickPartner: () => void;
  onStartFixed14v23: () => void;
  onRegenerateByes: () => void;
  onUpdateMatchScore: (matchId: string, score: number, team: "team1" | "team2") => void;
  onSwapPlayerTeam: (matchId: string, playerId: string) => void;
  onSubmitRound: () => void;
  sessionEnded?: boolean;
  onContinueSession?: () => void;
  onCancelRound?: () => void;
  onStartNextRound?: () => void;
  onVetoBye?: (playerId: string) => void;
  submitted?: boolean;
}

export default function CourtsPanel({
  roundState,
  eventPool,
  standings,
  currentRoundNumber,
  defaultRoundFormat = "FIXED_14V23",
  onStartPickPartner,
  onStartFixed14v23,
  onRegenerateByes,
  onUpdateMatchScore,
  onSwapPlayerTeam,
  onSubmitRound,
  sessionEnded,
  onContinueSession,
  onCancelRound,
  onStartNextRound,
  onVetoBye,
  submitted = false,
}: Props) {
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [confirmOverride, setConfirmOverride] = useState<{ matchId: string; team: "team1" | "team2"; value: number } | null>(null);

  const findPlayer = (id?: string) => eventPool.find(p => p.id === id) || null;

  // Get all selected player IDs across all matches
  const selectedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    roundState.matches.forEach(m => {
      m.team1.forEach(id => ids.add(id));
      m.team2.forEach(id => ids.add(id));
      if (m.byePlayerId) ids.add(m.byePlayerId);
    });
    return ids;
  }, [roundState.matches]);

  // Get unselected players (available to pick)
  const unselectedPlayers = useMemo(() => {
    return eventPool.filter(p => !p.isSitting && !selectedPlayerIds.has(p.id));
  }, [eventPool, selectedPlayerIds]);

  // Get sitting out players
  const sittingOutPlayers = useMemo(() => {
    return eventPool.filter(p => p.isSitting);
  }, [eventPool]);

  const getPlayerByeBase = (playerId: string) => {
    const entry = standings.find(s => s.id === playerId);
    return entry?.byeBase ?? 0;
  };

  const getPlayerByeTotal = (playerId: string) => {
    const entry = standings.find(s => s.id === playerId);
    if (!entry) return 0;
    const byeBase = entry.byeBase ?? 0;
    const byeCount = entry.byeCount ?? 0;
    const sitOutCount = entry.sitOutCount ?? 0;
    const byeMod = entry.byeMod ?? 0;
    return byeBase + byeCount + (sitOutCount * 0.5) + byeMod;
  };

  const formatByeBreakdown = (playerId: string) => {
    const entry = standings.find(s => s.id === playerId);
    if (!entry) return "";
    const parts = [];
    const byeBase = entry.byeBase ?? 0;
    const byeCount = entry.byeCount ?? 0;
    const sitOutCount = entry.sitOutCount ?? 0;
    const byeMod = entry.byeMod ?? 0;
    const sitBonus = sitOutCount * 0.5; // sitProtection is 0.5
    if (byeBase !== 0) parts.push(`base: ${byeBase >= 0 ? "+" : ""}${byeBase.toFixed(2)}`);
    if (byeCount > 0) parts.push(`+${byeCount} byes`);
    if (sitBonus > 0) parts.push(`+${sitBonus.toFixed(2)} sitBonus`);
    if (byeMod > 0) parts.push(`+${byeMod.toFixed(2)} LateJoin`);
    return parts.join(" + ") || "base: 0";
  };

  const handleSubmitRound = () => {
    // Validate scores: check for scores > 99 or < 0
    const invalidMatch = roundState.matches.find(m => {
      if (m.bye) return false; // Skip bye matches
      const s1 = m.team1Score;
      const s2 = m.team2Score;
      // Only check if score is a valid number (not null/undefined)
      return (
        (s1 != null && (s1 > 99 || s1 < 0)) ||
        (s2 != null && (s2 > 99 || s2 < 0))
      );
    });

    if (invalidMatch) {
      // Find which specific score is invalid
      let invalidTeam: "team1" | "team2" = "team1";
      let invalidValue = 0;
      
      const s1 = invalidMatch.team1Score;
      const s2 = invalidMatch.team2Score;
      
      if (s2 != null && (s2 > 99 || s2 < 0)) {
        invalidTeam = "team2";
        invalidValue = s2;
      } else if (s1 != null && (s1 > 99 || s1 < 0)) {
        invalidTeam = "team1";
        invalidValue = s1;
      }
      
      setConfirmOverride({ matchId: invalidMatch.id, team: invalidTeam, value: invalidValue });
      return;
    }

    // Clear any previous state
    setScoreError(null);
    setConfirmOverride(null);
    // Proceed with submission
    onSubmitRound();
  };

  const handleConfirmOverride = () => {
    setConfirmOverride(null);
    setScoreError(null);
    onSubmitRound();
  };

  const handleCancelOverride = () => {
    setConfirmOverride(null);
  };

  const renderMatchCard = (match: Match) => {
    const team1Players = match.team1.map(id => findPlayer(id)).filter(Boolean) as Player[];
    const team2Players = match.team2.map(id => findPlayer(id)).filter(Boolean) as Player[];

    return (
      <div
        key={match.id}
        className={`rounded-lg border-2 px-3 py-2 ${match.bye ? "border-orange-400/70 bg-muted-bg" : "border-line bg-muted-bg"}`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-subtext font-medium">{match.bye ? "BYE" : `Court ${match.court}`}</span>
          {!match.bye && <span className="text-xs text-subtext">Round {currentRoundNumber}</span>}
        </div>

        {match.bye ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text truncate">😴 {findPlayer(match.byePlayerId || "")?.name}</span>
            <span className="text-xs text-subtext shrink-0 ml-auto" title={formatByeBreakdown(match.byePlayerId || "")}>
              bye: {getPlayerByeTotal(match.byePlayerId || "").toFixed(2)}
            </span>
          </div>
        ) : (
          <>
            {/* Team 1 row — picker fixed */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {team1Players.map((p, i) => (
                  <button
                    key={p.id}
                    onClick={i === 0 ? undefined : () => onSwapPlayerTeam(match.id, p.id)}
                    title={i === 0 ? "Picker (fixed)" : "Click to swap"}
                    className={`flex-1 min-w-0 truncate text-left rounded-lg px-2 py-1 bg-muted-bg border-2 border-purple-400/70 text-text text-sm font-medium ${i === 0 ? "cursor-default" : "hover:bg-hover-bg"}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="w-14 shrink-0 h-8 px-2 border-2 border-purple-400/70 rounded-lg text-center bg-muted-bg text-text text-sm font-medium"
                value={match.team1Score ?? ""}
                onChange={(e) => { const v = e.target.value; onUpdateMatchScore(match.id, (v === "" ? undefined : parseInt(v) || 0) as any, "team1"); }}
                placeholder="0"
              />
            </div>

            {/* Team 2 row */}
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {team2Players.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onSwapPlayerTeam(match.id, p.id)}
                    title="Click to swap into Team 1"
                    className="flex-1 min-w-0 truncate text-left rounded-lg px-2 py-1 bg-muted-bg border-2 border-green-400/70 text-text text-sm font-medium hover:bg-hover-bg"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="w-14 shrink-0 h-8 px-2 border-2 border-green-400/70 rounded-lg text-center bg-muted-bg text-text text-sm font-medium"
                value={match.team2Score ?? ""}
                onChange={(e) => { const v = e.target.value; onUpdateMatchScore(match.id, (v === "" ? undefined : parseInt(v) || 0) as any, "team2"); }}
                placeholder="0"
              />
            </div>

            {/* Unselected players available to pick */}
            {unselectedPlayers.length > 0 && (
              <div className="mt-2 pt-2 border-t border-line">
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-xs text-subtext">Available:</span>
                  {unselectedPlayers.slice(0, 6).map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSwapPlayerTeam(match.id, p.id)}
                      title="Click to take the partner slot"
                      className="px-2 py-0.5 bg-muted-bg text-subtext rounded-md text-xs hover:bg-hover-bg transition-colors border-2 border-line"
                    >
                      {p.name}
                    </button>
                  ))}
                  {unselectedPlayers.length > 6 && (
                    <span className="text-xs text-subtext px-1">
                      +{unselectedPlayers.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

    );
  };

  const byeMatches = roundState.matches.filter(m => m.bye && m.byePlayerId);

  return (
    <section className="bg-panel rounded-2xl shadow-xl p-4">
      {!roundState.active ? (
        <div className="text-center py-3">
          <div className={`rounded-xl p-4 ${submitted ? "bg-muted-bg border-2 border-purple-500/40" : "bg-muted-bg border-2 border-green-500/40"}`}>
            <h3 className="text-base font-semibold mb-1 text-text whitespace-nowrap flex items-center justify-center gap-2">
              <span className={submitted ? "text-purple-500" : "text-green-500"}>{submitted ? "✓" : "🎾"}</span>
              {submitted ? `Round ${currentRoundNumber - 1} Complete!` : `Ready to start Round ${currentRoundNumber}?`}
            </h3>
            <p className="text-subtext text-xs mb-2">{eventPool.filter(p => !p.isSitting).length} active players</p>

            {sessionEnded ? (
              <button
                onClick={() => onContinueSession?.()}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-lg text-base whitespace-nowrap shadow-sm hover:shadow transition-all"
              >
                {"\u25b6"} Continue Session
              </button>
            ) : (
              <button
                onClick={() => {
                  if (currentRoundNumber === 1) onRegenerateByes();
                  // Use defaultRoundFormat from settings
                  if (defaultRoundFormat === "PICK_PARTNER") {
                    onStartPickPartner();
                  } else {
                    onStartFixed14v23();
                  }
                }}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2.5 rounded-lg text-base whitespace-nowrap shadow-sm hover:shadow transition-all"
              >
                🚀 Start Round {currentRoundNumber}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-base font-semibold text-text">Round {currentRoundNumber} Matches</h3>
            {onCancelRound && (
              <button
                onClick={onCancelRound}
                className="px-2.5 py-1 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 border border-red-300 transition-colors"
              >
                ✕ Cancel Round
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roundState.matches.filter(m => !m.bye).map(renderMatchCard)}
          </div>

          {byeMatches.length > 0 && (
            <div className="mt-4 bg-muted-bg rounded-xl p-4 border-2 border-orange-400/70">
              <h4 className="font-semibold text-orange-600 mb-3 text-sm">😴 Players Having a Bye</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {byeMatches.map(m => {
                  const player = findPlayer(m.byePlayerId);
                  return (
                    <div key={m.id} className="flex items-center gap-1.5 bg-muted-bg rounded-lg px-2 py-1 border-2 border-orange-400/70 h-8">
                      <span className="font-medium text-sm text-text truncate flex-1 min-w-0">{player?.name}</span>
                      {onVetoBye && m.byePlayerId && (
                        <button
                          onClick={() => onVetoBye(m.byePlayerId!)}
                          className="text-orange-500 hover:text-orange-700 text-sm shrink-0"
                          title="No bye this round - add 0.25 to bye score"
                        >
                          ⏳
                        </button>
                      )}
                      <span className="text-xs text-subtext shrink-0" title={formatByeBreakdown(m.byePlayerId || "")}>
                        {getPlayerByeTotal(m.byePlayerId || "").toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sittingOutPlayers.length > 0 && (
            <div className="mt-4 bg-muted-bg rounded-xl p-4 border border-line">
              <h4 className="font-semibold text-subtext mb-3 text-sm">💤 Sitting Out</h4>
              <div className="flex flex-wrap gap-2">
                {sittingOutPlayers.map(p => (
                  <span key={p.id} className="px-3 py-1 bg-muted-bg text-subtext rounded-lg text-sm">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Confirmation dialog for invalid scores */}
          {confirmOverride && (
            <div className="mt-4 p-4 bg-muted-bg border-2 border-yellow-400 rounded-xl text-center">
              <p className="text-red-600 font-medium mb-4">
                ⚠️ On Court {roundState.matches.find(m => m.id === confirmOverride.matchId)?.court}: score "{confirmOverride.value}" is {confirmOverride.value > 99 ? "over 99" : "less than 0"}. Are you sure?
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={handleConfirmOverride}
                  className="px-6 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={handleCancelOverride}
                  className="px-6 py-2 bg-muted-bg hover:bg-hover-bg text-text font-bold rounded-lg transition-colors"
                >
                  No
                </button>
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-center gap-5">
            <button
              onClick={handleSubmitRound}
              disabled={roundState.submitted || !!sessionEnded}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-7 py-2.5 rounded-lg text-sm whitespace-nowrap disabled:bg-muted-bg disabled:text-subtext disabled:cursor-not-allowed transition-colors"
              title={sessionEnded ? "Session ended \u2014 Continue Session first" : undefined}
            >
              ✓ Submit
            </button>
            <button
              onClick={onStartNextRound}
              disabled={!roundState.submitted || !!sessionEnded}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-7 py-2.5 rounded-lg text-sm whitespace-nowrap disabled:bg-muted-bg disabled:text-subtext disabled:cursor-not-allowed transition-colors"
            >
              🚀 Next Round
            </button>
          </div>
          {roundState.submitted && (
            <p className="text-center text-green-600 text-sm mt-2">Round Submitted! Click "Next Round"</p>
          )}
        </>
      )}
    </section>
  );
}
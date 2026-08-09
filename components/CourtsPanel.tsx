"use client";

import React, { useMemo } from "react";
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
  onCancelRound?: () => void;
  onStartNextRound?: () => void;
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
  onCancelRound,
  onStartNextRound,
  submitted = false,
}: Props) {
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

  const formatByeReason = (playerId: string) => {
    const entry = standings.find(s => s.id === playerId);
    if (!entry) return "";
    const parts = [];
    if (entry.byeBase > 0) parts.push(`base: ${entry.byeBase.toFixed(2)}`);
    if (entry.byeCount > 0) parts.push(`${entry.byeCount} bye(s)`);
    if (entry.sitOutCount > 0) parts.push(`${entry.sitOutCount} sit-out(s)`);
    if (entry.byeMod > 0) parts.push(`late join: ${entry.byeMod.toFixed(2)}`);
    return parts.length > 0 ? parts.join(" + ") : `base: ${entry.byeBase.toFixed(2)}`;
  };

  const renderMatchCard = (match: Match) => {
    const team1Players = match.team1.map(id => findPlayer(id)).filter(Boolean) as Player[];
    const team2Players = match.team2.map(id => findPlayer(id)).filter(Boolean) as Player[];

    return (
      <div
        key={match.id}
        className={`rounded-xl border p-4 ${match.bye ? "border-orange-200 bg-orange-50/50" : "border-green-200 bg-green-50/50"}`}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-base text-gray-700">{match.bye ? "BYE" : `Court ${match.court}`}</span>
          {!match.bye && (
            <div className="text-xs text-gray-500">Round {currentRoundNumber}</div>
          )}
        </div>

        {match.bye ? (
          <div className="text-center py-4">
            <div className="text-2xl mb-2">😴</div>
            <div className="font-semibold text-gray-800">{findPlayer(match.byePlayerId || "")?.name}</div>
            <div className="text-xs text-gray-500 mt-1">
              bye score: {getPlayerByeBase(match.byePlayerId || "").toFixed(2)}
            </div>
          </div>
        ) : (
          <>
            {/* Teams */}
            <div className="grid grid-cols-2 gap-3">
              {/* Team 1 */}
              <div>
                <div className="text-xs text-purple-600 mb-2 font-medium">Team 1</div>
                <div className="space-y-1">
                  {team1Players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSwapPlayerTeam(match.id, p.id)}
                      className="w-full text-left rounded-lg px-3 py-2 bg-purple-100 border border-purple-200 hover:bg-purple-200 text-gray-700 transition-colors"
                    >
                      <div className="font-medium text-sm">{p.name}</div>
                      {p.duprScore != null && (
                        <div className="text-xs text-gray-500">{p.duprScore.toFixed(1)}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Team 2 */}
              <div>
                <div className="text-xs text-green-600 mb-2 font-medium">Team 2</div>
                <div className="space-y-1">
                  {team2Players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSwapPlayerTeam(match.id, p.id)}
                      className="w-full text-left rounded-lg px-3 py-2 bg-green-100 border border-green-200 hover:bg-green-200 text-gray-700 transition-colors"
                    >
                      <div className="font-medium text-sm">{p.name}</div>
                      {p.duprScore != null && (
                        <div className="text-xs text-gray-500">{p.duprScore.toFixed(1)}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Unselected players available to pick */}
            {unselectedPlayers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-400 mb-2">Available:</div>
                <div className="flex flex-wrap gap-1">
                  {unselectedPlayers.slice(0, 6).map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSwapPlayerTeam(match.id, p.id)}
                      className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs hover:bg-gray-200 transition-colors border border-gray-200"
                    >
                      {p.name} {p.duprScore != null ? `(${p.duprScore.toFixed(1)})` : ""}
                    </button>
                  ))}
                  {unselectedPlayers.length > 6 && (
                    <span className="text-xs text-gray-400 px-2 py-1">
                      +{unselectedPlayers.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Score inputs */}
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="text-center">
                <div className="text-xs text-purple-500 mb-1">Team 1</div>
                <input
                  type="number"
                  className="w-16 px-2 py-1.5 border border-purple-300 rounded-lg text-center bg-white"
                  value={match.team1Score ?? ""}
                  onChange={(e) => onUpdateMatchScore(match.id, parseInt(e.target.value) || 0, "team1")}
                />
              </div>
              <div className="text-gray-400">vs</div>
              <div className="text-center">
                <div className="text-xs text-green-500 mb-1">Team 2</div>
                <input
                  type="number"
                  className="w-16 px-2 py-1.5 border border-green-300 rounded-lg text-center bg-white"
                  value={match.team2Score ?? ""}
                  onChange={(e) => onUpdateMatchScore(match.id, parseInt(e.target.value) || 0, "team2")}
                />
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const byeMatches = roundState.matches.filter(m => m.bye && m.byePlayerId);

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      {!roundState.active ? (
        <div className="text-center py-8">
          <div className={`rounded-xl p-8 ${submitted ? "bg-purple-50 border-2 border-purple-300" : "bg-green-50 border-2 border-green-300"}`}>
            <div className={`text-4xl mb-4 ${submitted ? "text-purple-500" : "text-green-500"}`}>
              {submitted ? "✓" : "🎾"}
            </div>
            <h3 className="text-xl font-bold mb-2 text-gray-800">
              {submitted ? `Round ${currentRoundNumber - 1} Complete!` : `Ready to start Round ${currentRoundNumber}?`}
            </h3>
            <p className="text-gray-600 text-sm mb-6">{eventPool.filter(p => !p.isSitting).length} active players</p>

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
              className="bg-green-500 hover:bg-green-600 text-white font-bold px-10 py-4 rounded-xl text-xl shadow-md hover:shadow-lg transition-all"
            >
              🚀 Start Round {currentRoundNumber}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-700">Round {currentRoundNumber} Matches</h3>
            {onCancelRound && (
              <button
                onClick={onCancelRound}
                className="px-3 py-1.5 bg-red-100 text-red-600 rounded-lg text-sm hover:bg-red-200 border border-red-300 transition-colors"
              >
                ✕ Cancel Round
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roundState.matches.filter(m => !m.bye).map(renderMatchCard)}
          </div>

          {byeMatches.length > 0 && (
            <div className="mt-4 bg-orange-50/50 rounded-xl p-4 border border-orange-200">
              <h4 className="font-semibold text-orange-700 mb-3 text-sm">😴 Players Having a Bye</h4>
              <div className="flex flex-wrap gap-3">
                {byeMatches.map(m => {
                  const player = findPlayer(m.byePlayerId);
                  return (
                    <div key={m.id} className="bg-white rounded-lg px-4 py-2 border border-orange-200 flex flex-col">
                      <span className="font-medium text-gray-800">{player?.name}</span>
                      <span className="text-xs text-gray-500">{formatByeReason(m.byePlayerId || "")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {sittingOutPlayers.length > 0 && (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-gray-200">
              <h4 className="font-semibold text-gray-500 mb-3 text-sm">💤 Sitting Out</h4>
              <div className="flex flex-wrap gap-2">
                {sittingOutPlayers.map(p => (
                  <span key={p.id} className="px-3 py-1 bg-gray-200 text-gray-500 rounded-full text-sm">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={onSubmitRound}
              disabled={roundState.submitted}
              className="bg-green-500 hover:bg-green-600 text-white font-bold px-8 py-3 rounded-xl text-base disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              ✓ Submit Scores
            </button>
            <button
              onClick={onStartNextRound}
              disabled={!roundState.submitted}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-8 py-3 rounded-xl text-base disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              🚀 Start Next Round
            </button>
          </div>
          {roundState.submitted && (
            <p className="text-center text-green-600 text-sm mt-2">Round submitted! Click "Start Next Round" to continue.</p>
          )}
        </>
      )}
    </section>
  );
}
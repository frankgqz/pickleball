"use client";

import React, { useMemo } from "react";
import { Match, Player, StandingsEntry, RoundState } from "./Types";

interface Props {
  roundState: RoundState;
  eventPool: Player[];
  standings: StandingsEntry[];
  currentRoundNumber: number;
  onStartPickPartner: () => void;
  onStartFixed14v23: () => void;
  onRegenerateByes: () => void;
  onUpdateMatchScore: (matchId: string, score: number, team: "team1" | "team2") => void;
  onSwapPlayerTeam: (matchId: string, playerId: string) => void;
  onSubmitRound: () => void;
}

export default function CourtsPanel({
  roundState,
  eventPool,
  standings,
  currentRoundNumber,
  onStartPickPartner,
  onStartFixed14v23,
  onRegenerateByes,
  onUpdateMatchScore,
  onSwapPlayerTeam,
  onSubmitRound,
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

  const renderMatchCard = (match: Match) => {
    const team1Players = match.team1.map(id => findPlayer(id)).filter(Boolean) as Player[];
    const team2Players = match.team2.map(id => findPlayer(id)).filter(Boolean) as Player[];

    return (
      <div
        key={match.id}
        className={`rounded-xl border-2 p-4 ${match.bye ? "border-orange-300 bg-orange-50" : "border-green-200 bg-green-50"}`}
      >
        <div className="flex justify-between items-center mb-4">
          <span className="font-bold text-lg">{match.bye ? "BYE" : `Court ${match.court}`}</span>
          {!match.bye && (
            <div className="text-sm text-gray-600">Round {currentRoundNumber}</div>
          )}
        </div>

        {match.bye ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-orange-200 rounded-full flex items-center justify-center mx-auto mb-2">😴</div>
            <div className="font-semibold text-orange-700">{findPlayer(match.byePlayerId || "")?.name}</div>
          </div>
        ) : (
          <>
            {/* Teams */}
            <div className="grid grid-cols-2 gap-3">
              {/* Team 1 - Purple styling */}
              <div>
                <div className="text-xs text-purple-600 mb-2 font-semibold">Team 1</div>
                <div className="space-y-2">
                  {team1Players.map((p, idx) => {
                    const isPlayer1 = idx === 0; // First player is the "picker"
                    return (
                      <button
                        key={p.id}
                        onClick={() => onSwapPlayerTeam(match.id, p.id)}
                        className={`w-full text-left rounded-lg p-2 border transition-colors ${
                          isPlayer1
                            ? "bg-purple-600 text-white border-purple-700 hover:bg-purple-700"
                            : "bg-white border-gray-300 hover:bg-purple-50"
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {isPlayer1 && <span className="mr-1">👑</span>}
                          {p.name}
                        </div>
                        {p.duprScore != null && (
                          <div className={`text-xs ${isPlayer1 ? "text-purple-200" : "text-gray-400"}`}>
                            {p.duprScore.toFixed(1)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Team 2 - Green styling */}
              <div>
                <div className="text-xs text-green-600 mb-2 font-semibold">Team 2</div>
                <div className="space-y-2">
                  {team2Players.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => onSwapPlayerTeam(match.id, p.id)}
                      className="w-full text-left bg-white rounded-lg p-2 border border-gray-300 hover:bg-green-50 transition-colors"
                    >
                      <div className="font-medium text-sm">{p.name}</div>
                      {p.duprScore != null && (
                        <div className="text-xs text-gray-400">{p.duprScore.toFixed(1)}</div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Unselected players available to pick */}
            {unselectedPlayers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <div className="text-xs text-gray-500 mb-2">Available to pick:</div>
                <div className="flex flex-wrap gap-1">
                  {unselectedPlayers.slice(0, 6).map(p => (
                    <button
                      key={p.id}
                      onClick={() => onSwapPlayerTeam(match.id, p.id)}
                      className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
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
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="text-center">
                <div className="text-xs text-purple-600 mb-1">Team 1</div>
                <input
                  type="number"
                  className="w-20 px-3 py-2 border-2 border-purple-400 rounded-lg text-center bg-purple-50"
                  value={match.team1Score ?? ""}
                  onChange={(e) => onUpdateMatchScore(match.id, parseInt(e.target.value) || 0, "team1")}
                />
              </div>
              <div className="text-xl font-bold text-gray-400">vs</div>
              <div className="text-center">
                <div className="text-xs text-green-600 mb-1">Team 2</div>
                <input
                  type="number"
                  className="w-20 px-3 py-2 border-2 border-green-400 rounded-lg text-center bg-green-50"
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
  const byeNodes = byeMatches.map(m => {
    const player = findPlayer(m.byePlayerId);
    return (
      <div key={m.id} className="bg-orange-100 rounded-lg px-4 py-2 border border-orange-300 flex items-center gap-2">
        <span className="text-xl">😴</span>
        <div>
          <p className="font-medium text-orange-800">{player?.name}</p>
        </div>
      </div>
    );
  });

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      {!roundState.active ? (
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-4">Ready to start Round {currentRoundNumber}?</h3>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => { if (currentRoundNumber === 1) onRegenerateByes(); onStartPickPartner(); }}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-lg hover:scale-105 transition-transform"
            >
              🤝 Pick Partner Format
            </button>
            <button
              onClick={() => { if (currentRoundNumber === 1) onRegenerateByes(); onStartFixed14v23(); }}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-8 py-4 rounded-xl text-lg shadow-lg hover:scale-105 transition-transform"
            >
              ⚔️ 1v4 vs 2v3 Format
            </button>
          </div>
          <p className="text-gray-500 text-sm mt-3">{eventPool.filter(p => !p.isSitting).length} active players ready</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {roundState.matches.filter(m => !m.bye).map(renderMatchCard)}
          </div>

          {byeNodes.length > 0 && (
            <div className="mt-6 bg-orange-50 rounded-xl p-4 border-2 border-orange-200">
              <h3 className="font-bold text-orange-700 mb-3">😴 Players Having a Bye This Round</h3>
              <div className="flex flex-wrap gap-3">
                {byeNodes}
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={onSubmitRound}
              disabled={roundState.submitted}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-8 py-3 rounded-xl text-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              ✓ Submit Round Results
            </button>
            {roundState.submitted && (
              <p className="text-green-600 text-sm mt-2">Round submitted!</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
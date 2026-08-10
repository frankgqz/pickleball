"use client";

import React, { useMemo, useState } from "react";
import { CompletedRound, Player, TournamentConfig } from "./Types";

interface Props {
  roundHistory: CompletedRound[];
  currentSessionId: string;
  eventPool?: Player[];
  config?: TournamentConfig;
  onEditRound?: (roundNumber: number, updatedMatches: CompletedRound["matches"]) => void;
  onDeleteRound?: (roundNumber: number, sessionId: string) => void;
}

export default function RoundHistoryPanel({
  roundHistory,
  currentSessionId,
  eventPool = [],
  config,
  onEditRound,
  onDeleteRound,
}: Props) {
  const sessionRounds = useMemo(
    () => roundHistory
      .filter(r => r.sessionId === currentSessionId)
      .sort((a, b) => a.roundNumber - b.roundNumber),
    [roundHistory, currentSessionId]
  );

  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | "">(
    sessionRounds.length > 0 ? sessionRounds[sessionRounds.length - 1].roundNumber : ""
  );

  const selectedRound = useMemo(
    () => sessionRounds.find(r => r.roundNumber === selectedRoundNumber) || null,
    [sessionRounds, selectedRoundNumber]
  );

  const deleteRound = () => {
    if (selectedRoundNumber === "" || typeof selectedRoundNumber !== "number") return;
    if (onDeleteRound && confirm(`Delete Round ${selectedRoundNumber}? This will recompute session standings.`)) {
      onDeleteRound(selectedRoundNumber, currentSessionId);
      setSelectedRoundNumber("");
    }
  };

  const [editMode, setEditMode] = useState(false);
  const [editMatches, setEditMatches] = useState<CompletedRound["matches"]>([]);

  // --- CSV Export ---------------------- //
  const exportToCSV = () => {
    if (sessionRounds.length === 0) {
      alert("No rounds to export");
      return;
    }

    // CSV Header - your format
    const headers = [
      "matchType",
      "scoreType",
      "event",
      "date",
      "playerA1",
      "playerA1DuprId",
      "playerA2",
      "playerA2DuprId",
      "playerB1",
      "playerB1DuprId",
      "playerB2",
      "playerB2DuprId",
      "teamAGame1",
      "teamBGame1",
      "teamAGame2",
      "teamBGame2",
      "teamAGame3",
      "teamBGame3",
      "teamAGame4",
      "teamBGame4",
      "teamAGame5",
      "teamBGame5"
    ];

    // Helper to get player name and duprId
    const getPlayerInfo = (id: string) => {
      const player = eventPool.find(p => p.id === id);
      return {
        name: player?.name || "",
        duprId: player?.duprId || player?.duprNumericId || ""
      };
    };

    // Build CSV rows
    const rows: string[][] = [];

    const eventName = config?.eventName || "Pickleball Event";

    sessionRounds.forEach(round => {
      round.matches.forEach(match => {
        if (match.bye) {
          return;
        }

        const pA1 = match.team1[0] ? getPlayerInfo(match.team1[0]) : { name: "", duprId: "" };
        const pA2 = match.team1[1] ? getPlayerInfo(match.team1[1]) : { name: "", duprId: "" };
        const pB1 = match.team2[0] ? getPlayerInfo(match.team2[0]) : { name: "", duprId: "" };
        const pB2 = match.team2[1] ? getPlayerInfo(match.team2[1]) : { name: "", duprId: "" };

        // Format date as YYYY-MM-DD
        const dateObj = new Date(round.date);
        const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;

        // Build event name with round
        const eventWithRound = `${eventName} - Round ${round.roundNumber}`;

        // Game scores (only game 1 for now as it's best of 11)
        const game1A = match.team1Score !== undefined ? String(match.team1Score) : "";
        const game1B = match.team2Score !== undefined ? String(match.team2Score) : "";

        rows.push([
          "D",
          "SIDEOUT",
          eventWithRound,
          dateStr,
          pA1.name,
          pA1.duprId,
          pA2.name,
          pA2.duprId,
          pB1.name,
          pB1.duprId,
          pB2.name,
          pB2.duprId,
          game1A,
          game1B,
          "",
          "",
          "",
          "",
          "",
          "",
          "",
          ""
        ]);
      });
    });

    // Create CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `pickleball_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const startEditing = () => {
    if (selectedRound) {
      setEditMatches(JSON.parse(JSON.stringify(selectedRound.matches)));
      setEditMode(true);
    }
  };

  const cancelEditing = () => {
    setEditMode(false);
    setEditMatches([]);
  };

  const saveEdits = () => {
    if (selectedRound && onEditRound && typeof selectedRoundNumber === "number") {
      onEditRound(selectedRoundNumber, editMatches);
      setEditMode(false);
      setEditMatches([]);
    }
  };

  const updateMatchScore = (matchId: string, team: "team1Score" | "team2Score", value: number) => {
    setEditMatches(prev => prev.map(m => m.id === matchId ? { ...m, [team]: value } : m));
  };

  const swapTeamPlayer = (matchId: string, fromTeam: "team1" | "team2", playerId: string) => {
    setEditMatches(prev => prev.map(m => {
      if (m.id !== matchId || m.bye) return m;
      const fromArr = [...m[fromTeam]];
      const otherTeam = fromTeam === "team1" ? "team2" : "team1";
      const otherArr = [...m[otherTeam]];
      const playerIdx = fromArr.indexOf(playerId);
      if (playerIdx === -1) return m;

      // Move player to other team
      fromArr.splice(playerIdx, 1);
      otherArr.push(playerId);

      return { ...m, [fromTeam]: fromArr, [otherTeam]: otherArr };
    }));
  };

  return (
    <section className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4">
      {/* Header - Mobile-friendly layout */}
      <div className="mb-4">
        {/* Row 1: Title + Export */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white">📜 Past Rounds</h2>
          {sessionRounds.length > 0 && (
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
              title="Export to CSV"
            >
              📥 Export CSV
            </button>
          )}
        </div>

        {/* Row 2: Select dropdown */}
        <select
          value={selectedRoundNumber === "" ? "" : selectedRoundNumber}
          onChange={(e) => setSelectedRoundNumber(e.target.value ? parseInt(e.target.value) : "")}
          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white mb-3"
        >
          <option value="">Select a round...</option>
          {sessionRounds.map(r => (
            <option key={r.roundNumber} value={r.roundNumber}>
              Round {r.roundNumber} — {new Date(r.date).toLocaleString()}
            </option>
          ))}
        </select>

        {/* Row 3: Action buttons - Edit/Delete or Save/Cancel */}
        {selectedRound && (
          <div className="flex flex-wrap gap-2">
            {editMode ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium"
                >
                  ✕ Cancel
                </button>
                <button
                  onClick={saveEdits}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
                >
                  ✓ Save Changes
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={startEditing}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
                >
                  ✏️ Edit Round
                </button>
                <button
                  onClick={deleteRound}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium"
                >
                  🗑️ Delete Round
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedRound ? (
        <p className="text-slate-400 text-sm">Select a round to view its matches.</p>
      ) : (
        <div className="space-y-4">
          {selectedRound.sittingOut && selectedRound.sittingOut.length > 0 && (
            <div className="text-sm text-orange-400 mb-2">
              Sitting out: {selectedRound.sittingOut.map(id => {
                const player = eventPool.find(p => p.id === id);
                return player?.name || id;
              }).join(", ")}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(editMode ? editMatches : selectedRound.matches).map((m) => {
              const getPlayerName = (id: string) => {
                const p = eventPool.find(e => e.id === id);
                return p?.name || id;
              };

              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 ${m.bye ? "bg-orange-900/30 border-orange-500/50" : "bg-slate-900/50 border-slate-600"}`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-white">
                      {m.bye ? "BYE" : `Court ${m.court ?? "-"}`}
                    </div>
                    {!editMode && m.team1Score !== undefined && m.team2Score !== undefined && (
                      <div className="text-xs text-green-400">
                        {m.team1Score} – {m.team2Score}
                      </div>
                    )}
                  </div>

                  {!m.bye && (
                    <>
                      <div className="text-sm text-slate-300 mb-2">
                        <div className="font-medium flex items-center gap-2">
                          {m.team1.map(id => (
                            <span key={id} className="flex items-center gap-1">
                              {editMode && (
                                <button
                                  onClick={() => swapTeamPlayer(m.id, "team1", id)}
                                  className="text-xs bg-purple-600 hover:bg-purple-500 px-1 rounded"
                                  title="Move to Team 2"
                                >
                                  ←
                                </button>
                              )}
                              {getPlayerName(id)}
                            </span>
                          ))}
                        </div>
                        <div className="text-slate-500 text-center my-1">vs</div>
                        <div className="font-medium flex items-center gap-2">
                          {m.team2.map(id => (
                            <span key={id} className="flex items-center gap-1">
                              {editMode && (
                                <button
                                  onClick={() => swapTeamPlayer(m.id, "team2", id)}
                                  className="text-xs bg-green-600 hover:bg-green-500 px-1 rounded"
                                  title="Move to Team 1"
                                >
                                  →
                                </button>
                              )}
                              {getPlayerName(id)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {editMode ? (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <div className="text-center">
                            <div className="text-xs text-purple-400 mb-1">T1</div>
                            <input
                              type="number"
                              value={m.team1Score ?? ""}
                              onChange={(e) => updateMatchScore(m.id, "team1Score", parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 border-2 border-purple-500 rounded text-center bg-purple-900/50 text-white"
                              placeholder="0"
                            />
                          </div>
                          <span className="text-slate-400 self-end mb-1">vs</span>
                          <div className="text-center">
                            <div className="text-xs text-green-400 mb-1">T2</div>
                            <input
                              type="number"
                              value={m.team2Score ?? ""}
                              onChange={(e) => updateMatchScore(m.id, "team2Score", parseInt(e.target.value) || 0)}
                              className="w-14 px-2 py-1 border-2 border-green-500 rounded text-center bg-green-900/50 text-white"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      ) : m.team1Score !== undefined && m.team2Score !== undefined ? (
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <div className={`px-3 py-1 rounded ${m.team1Score > m.team2Score ? "bg-purple-600 text-white" : "bg-purple-900/50 text-purple-300"}`}>
                            {m.team1Score}
                          </div>
                          <span className="text-slate-400">-</span>
                          <div className={`px-3 py-1 rounded ${m.team2Score > m.team1Score ? "bg-green-600 text-white" : "bg-green-900/50 text-green-300"}`}>
                            {m.team2Score}
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}

                  {m.bye && (
                    <div className="text-sm text-orange-300">
                      {m.byePlayerId ? getPlayerName(m.byePlayerId) : "Unknown"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
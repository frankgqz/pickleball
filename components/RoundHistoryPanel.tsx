"use client";

import React, { useMemo, useState } from "react";
import { RoundHistory, StandingsEntry } from "./Types";

interface Props {
  roundHistory: RoundHistory[];
  currentSessionId: string;
  onDeleteRound?: (roundNumber: number, sessionId: string) => void;
}

export default function RoundHistoryPanel({
  roundHistory,
  currentSessionId,
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

  return (
    <section className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">📜 Past Rounds</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedRoundNumber === "" ? "" : selectedRoundNumber}
            onChange={(e) => setSelectedRoundNumber(e.target.value ? parseInt(e.target.value) : "")}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
          >
            <option value="">Select a round...</option>
            {sessionRounds.map(r => (
              <option key={r.roundNumber} value={r.roundNumber}>
                Round {r.roundNumber} — {new Date(r.timestamp).toLocaleString()}
              </option>
            ))}
          </select>

          {selectedRound && (
            <button
              onClick={deleteRound}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm"
            >
              Delete Round
            </button>
          )}
        </div>
      </div>

      {!selectedRound ? (
        <p className="text-slate-400 text-sm">Select a round to view its matches.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedRound.matches.map((m) => {
              const p1Name = m.player1Name || m.player1Id || "Unknown";
              const p2Name = m.player2Name || m.player2Id || "BYE";
              
              return (
                <div
                  key={m.id}
                  className={`rounded-lg border p-3 ${
                    m.bye ? "bg-orange-900/30 border-orange-500/50" : "bg-slate-900/50 border-slate-600"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold text-white">
                      {m.bye ? "BYE" : `Court ${m.court ?? "-"}`}
                    </div>
                    {m.result && (
                      <div className="text-xs text-green-400">✓ Recorded</div>
                    )}
                  </div>

                  <div className="text-sm text-slate-300 mb-2">
                    <div className="font-medium">{p1Name}</div>
                    <div className="text-slate-500 text-center my-1">vs</div>
                    <div className="font-medium">{p2Name}</div>
                  </div>

                  {m.result && !m.bye && (
                    <div className="text-xs text-slate-400 mt-2">
                      {m.result.winnerId ? (
                        <span>Winner: {m.result.winnerId}</span>
                      ) : m.result.tie ? (
                        <span>Tie recorded</span>
                      ) : null}
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
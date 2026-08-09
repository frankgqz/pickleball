"use client";

import React, { useMemo, useState } from "react";
import { CompletedRound, Match, Player } from "./Types";

interface Props {
  roundHistory: CompletedRound[];            // all rounds (include sessionId)
  currentSessionId: string;                  // session being viewed
  eventPool: Player[];                       // to resolve player names
  onEditRound?: (updatedRound: CompletedRound) => void;
  onDeleteRound?: (roundNumber: number, sessionId: string) => void;
  onLoadRoundIntoActive?: (round: CompletedRound) => void; // optional: load past round into active UI
}

export default function RoundHistoryPanel({
  roundHistory,
  currentSessionId,
  eventPool,
  onEditRound,
  onDeleteRound,
  onLoadRoundIntoActive,
}: Props) {
  const sessionRounds = useMemo(
    () => roundHistory.filter(r => r.sessionId === currentSessionId).sort((a,b) => a.roundNumber - b.roundNumber),
    [roundHistory, currentSessionId]
  );

  const [selectedRoundNumber, setSelectedRoundNumber] = useState<number | "">(
    sessionRounds.length > 0 ? sessionRounds[sessionRounds.length - 1].roundNumber : ""
  );
  const [editing, setEditing] = useState(false);
  const [workingRound, setWorkingRound] = useState<CompletedRound | null>(null);

  // When selection changes, load round
  React.useEffect(() => {
    if (selectedRoundNumber === "" ) { setWorkingRound(null); setEditing(false); return; }
    const r = sessionRounds.find(s => s.roundNumber === selectedRoundNumber) || null;
    // create a deep-ish copy for editing
    setWorkingRound(r ? { ...r, matches: r.matches.map(m => ({ ...m })) } : null);
    setEditing(false);
  }, [selectedRoundNumber, sessionRounds]);

  const findPlayer = (id?: string) => eventPool.find(p => p.id === id) || null;

  const updateMatchScore = (matchId: string, team: "team1Score" | "team2Score", value: number) => {
    if (!workingRound) return;
    const next = { ...workingRound, matches: workingRound.matches.map(m => m.id === matchId ? { ...m, [team]: value } : m) };
    setWorkingRound(next);
  };

  const toggleByeForMatch = (matchId: string) => {
    if (!workingRound) return;
    const next = { 
      ...workingRound, 
      matches: workingRound.matches.map(m => {
        if (m.id !== matchId) return m;
        if (m.bye) {
          return { ...m, bye: false, byePlayerId: undefined };
        } else {
          // if making a bye, choose first player of team1 as byePlayer by default
          return { ...m, bye: true, byePlayerId: m.team1[0] ?? m.team2[0] };
        }
      })
    };
    setWorkingRound(next);
  };

  const saveEdits = () => {
    if (!workingRound || !onEditRound) { setEditing(false); return; }
    onEditRound(workingRound);
    setEditing(false);
  };

  const deleteRound = () => {
    if (!selectedRoundNumber || selectedRoundNumber === "") return;
    if (onDeleteRound && confirm(`Delete Round ${selectedRoundNumber}? This will recompute session standings.`)) {
      onDeleteRound(selectedRoundNumber as number, currentSessionId);
      setSelectedRoundNumber("");
      setWorkingRound(null);
      setEditing(false);
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">📜 Past Rounds (Session)</h2>
        <div className="flex items-center gap-3">
          <select
            value={selectedRoundNumber === "" ? "" : selectedRoundNumber}
            onChange={(e) => setSelectedRoundNumber(e.target.value ? parseInt(e.target.value) : "")}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">Select a round...</option>
            {sessionRounds.map(r => (
              <option key={r.roundNumber} value={r.roundNumber}>
                Round {r.roundNumber} — {new Date(r.date).toLocaleString()}
              </option>
            ))}
          </select>

          {workingRound && (
            <>
              <button onClick={() => { setEditing(!editing); setWorkingRound(workingRound ? { ...workingRound, matches: workingRound.matches.map(m => ({ ...m })) } : null); }}
                className="px-3 py-2 rounded-lg bg-yellow-200 hover:bg-yellow-300">
                {editing ? "Cancel Edit" : "Edit Scores"}
              </button>

              <button onClick={deleteRound} className="px-3 py-2 rounded-lg bg-red-200 hover:bg-red-300">Delete Round</button>

              <button onClick={() => onLoadRoundIntoActive && workingRound && onLoadRoundIntoActive(workingRound)} className="px-3 py-2 rounded-lg bg-blue-200 hover:bg-blue-300">
                Load into Active
              </button>
            </>
          )}
        </div>
      </div>

      {!workingRound ? (
        <p className="text-gray-500">Select a round to view its matches and byes.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workingRound.matches.map((m) => {
              const t1 = m.team1.map(id => findPlayer(id)?.name || id).join(", ");
              const t2 = m.team2.map(id => findPlayer(id)?.name || id).join(", ");
              return (
                <div key={m.id} className={`rounded-lg border p-3 ${m.bye ? "bg-orange-50 border-orange-200" : "bg-white"}`}>
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-semibold">{m.bye ? "BYE" : `Court ${m.court}`}</div>
                    <div className="text-xs text-gray-500">{workingRound.format}</div>
                  </div>

                  <div className="text-sm text-gray-700 mb-2">
                    <div className="font-medium">{t1}</div>
                    <div className="font-medium mt-2">{t2}</div>
                  </div>

                  {m.bye ? (
                    <div>
                      <div className="text-xs text-gray-500">Bye player:</div>
                      <div className="font-medium">{findPlayer(m.byePlayerId || "")?.name || "—"}</div>
                      {editing && (
                        <div className="mt-2">
                          <label className="block text-xs mb-1">Change bye player</label>
                          <select
                            value={m.byePlayerId || ""}
                            onChange={(e) => {
                              const pid = e.target.value || undefined;
                              setWorkingRound(prev => prev ? { ...prev, matches: prev.matches.map(mm => mm.id === m.id ? { ...mm, byePlayerId: pid } : mm) } : prev);
                            }}
                            className="px-2 py-1 border rounded"
                          >
                            <option value="">-- none --</option>
                            {eventPool.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-4 mt-2">
                        <div className="text-center">
                          <div className="text-xs text-purple-600">Team 1</div>
                          {editing ? (
                            <input type="number" value={m.team1Score ?? ""} onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setWorkingRound(prev => prev ? { ...prev, matches: prev.matches.map(mm => mm.id === m.id ? ({ ...mm, team1Score: val }) : mm) } : prev);
                            }} className="w-20 px-2 py-1 border rounded" />
                          ) : <div className="text-xl font-bold">{m.team1Score ?? "-"}</div>}
                        </div>

                        <div className="text-xl font-bold text-gray-400">vs</div>

                        <div className="text-center">
                          <div className="text-xs text-green-600">Team 2</div>
                          {editing ? (
                            <input type="number" value={m.team2Score ?? ""} onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setWorkingRound(prev => prev ? { ...prev, matches: prev.matches.map(mm => mm.id === m.id ? ({ ...mm, team2Score: val }) : mm) } : prev);
                            }} className="w-20 px-2 py-1 border rounded" />
                          ) : <div className="text-xl font-bold">{m.team2Score ?? "-"}</div>}
                        </div>
                      </div>

                      {editing && (
                        <div className="mt-2">
                          <button onClick={() => {
                            // toggle bye for this match
                            setWorkingRound(prev => prev ? { ...prev, matches: prev.matches.map(mm => mm.id === m.id ? ({ ...mm, bye: !mm.bye, byePlayerId: !mm.bye ? mm.team1[0] : undefined }) : mm) } : prev);
                          }} className="px-3 py-1 text-sm bg-yellow-100 rounded">Toggle Bye</button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {editing && (
            <div className="flex gap-3">
              <button onClick={saveEdits} className="bg-green-600 text-white px-4 py-2 rounded">Save Changes</button>
              <button onClick={() => { setEditing(false); setSelectedRoundNumber(""); setWorkingRound(null); }} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

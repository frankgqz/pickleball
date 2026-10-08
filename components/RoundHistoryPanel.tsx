"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";  // ← ADD useEffect
import { CompletedRound, Player, TournamentConfig } from "./Types";
import { getSessionList, loadSession, endSession, deleteSession } from "@/app/actions";

interface Props {
  roundHistory: CompletedRound[];
  currentSessionId: string;
  eventPool?: Player[];
  config?: TournamentConfig;
  onEditRound?: (roundNumber: number, updatedMatches: CompletedRound["matches"]) => void;
  onDeleteRound?: (roundNumber: number, sessionId: string) => void;
  currentDbSessionId?: string;         // ← ADD — to know which session is "active"
  onLoadSession?: (sessionId: string) => void;  // ← ADD
  onEndSession?: (sessionId: string) => void;    // ← ADD
  onContinueSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void; // ← ADD
  userId?: string;       // ← ADD — needed for getSessionList
  sessionRefreshKey?: number;
}

const formatSessionDate = (date: string | Date) => {
  const d = new Date(date);
  const yy = String(d.getFullYear()).slice(2);
  const mon = d.toLocaleString("default", { month: "short" });
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mon}-${d.getDate()} ${hh}:${mm}`;
};

export default function RoundHistoryPanel({
  roundHistory,
  currentSessionId,
  eventPool = [],
  config,
  onEditRound,
  onDeleteRound,
  currentDbSessionId,     // ← ADD
  onLoadSession,          // ← ADD
  onEndSession,          // ← ADD
  onContinueSession,
  onDeleteSession,       // ← ADD
  userId,       // ← ADD
  sessionRefreshKey = 0,
}: Props) {
  const sessionRounds = useMemo(
    () => roundHistory
      .filter(r => r.sessionId === currentSessionId)
      .sort((a, b) => a.roundNumber - b.roundNumber),
    [roundHistory, currentSessionId]
  );

  const [pendingBye, setPendingBye] = useState<{ matchId: string; playerId: string } | null>(null);
  const playerLabel = (id: string) => eventPool.find(e => e.id === id)?.name || id;
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

  const [pastSessions, setPastSessions] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editMatches, setEditMatches] = useState<CompletedRound["matches"]>([]);
  const [pastSessionsOpen, setPastSessionsOpen] = useState(false);  // ← ADD for collapsible
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pastSessionsLoading, setPastSessionsLoading] = useState(false);
  const [loginHint, setLoginHint] = useState(false);
  const [selectedSessionLabel, setSelectedSessionLabel] = useState<string | null>(null);
  const pickerListRef = useRef<HTMLDivElement>(null);

  const sessionPlayerCount = (s: any): number => {
    const ids = s.playerIds;
    if (Array.isArray(ids)) return ids.length;
    try { const p = JSON.parse(ids); return Array.isArray(p) ? p.length : 0; } catch { return 0; }
  };

  // Newest sits at the bottom (the panel lives at the bottom of the page)
  useEffect(() => {
    if (pickerOpen && pickerListRef.current) {
      pickerListRef.current.scrollTop = pickerListRef.current.scrollHeight;
    }
  }, [pickerOpen]);


    // --- FETCH PAST SESSIONS ---
  // This populates the session list panel
  const loadPastSessions = async () => {
    if (!userId) { setLoginHint(true); return; }
    setPastSessionsLoading(true);
    try {
      const result = await getSessionList(userId);
      if (result.success) {
        setPastSessions(result.sessions || []);
      }
    } finally {
      setPastSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (pastSessionsOpen && userId) {
      loadPastSessions();
    }
  }, [pastSessionsOpen, userId, sessionRefreshKey]);

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
        duprId: player?.duprId || ""
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
          config?.matchType || "D",
          config?.scoreType || "SIDEOUT",
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

  // Same semantics as the courts panel: the picker (t1[0]) is fixed and every
  // click trades the player into the partner slot (t1[1]) — position-preserving
  const swapTeamPlayer = (matchId: string, fromTeam: "team1" | "team2", playerId: string) => {
    setEditMatches(prev => prev.map(m => {
      if (m.id !== matchId || m.bye) return m;
      const picker = m.team1[0];
      const partner = m.team1[1];
      if (playerId === picker || playerId === partner) return m;
      const team2Arr = [...m.team2];
      const idx = team2Arr.indexOf(playerId);
      if (idx === -1) return m;
      team2Arr[idx] = partner;
      return { ...m, team1: [picker, playerId] as [string, string], team2: team2Arr as [string, string] };
    }));
  };

  // Armed bye chip + a court player click = trade places (bye joins the court,
  // the court player joins the bye box)
  const handleNameClick = (m: any, team: "team1" | "team2", playerId: string) => {
    if (pendingBye) {
      setEditMatches(prev => prev.map(x => {
        if (x.id === m.id) {
          const arr = [...x[team]];
          arr[arr.indexOf(playerId)] = pendingBye!.playerId;
          return { ...x, [team]: arr };
        }
        if (x.id === pendingBye!.matchId) return { ...x, byePlayerId: playerId };
        return x;
      }));
      setPendingBye(null);
      return;
    }
    swapTeamPlayer(m.id, team, playerId);
  };

  return (
    <section className="bg-panel rounded-2xl border border-line px-4 py-3">
      {/* Header - Mobile-friendly layout */}
      <div className="mb-3">
        {/* Row 1: Title + Export */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-text">📋 Session</h2>
          <div className="flex items-center gap-2">
            {pastSessionsLoading && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-line border-t-transparent rounded-full animate-spin" aria-label="Loading" />
            )}
            <button
              onClick={() => { if (!userId) { setLoginHint(true); return; } setPastSessionsOpen(o => !o); }}
              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium"
            >
              {pastSessionsOpen ? "▲ Hide" : "📂 Load"}
            </button>
            <button
              onClick={exportToCSV}
              className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
              title="Export to CSV"
            >
              📥 CSV
            </button>
          </div>
        </div>

        {loginHint && !userId && (
          <p className="text-xs text-subtext mt-1">Please log in to use this feature</p>
        )}

        {pastSessionsOpen && pastSessions.length > 0 && (
          <div className="mb-3 relative">
            <button
              type="button"
              onClick={() => setPickerOpen(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-muted-bg border border-line rounded-md text-sm text-left text-text hover:bg-hover-bg transition-colors"
            >
              <span className="truncate">{selectedSessionLabel ?? "— Select a session to load —"}</span>
              <span className={`text-subtext text-xs transition-transform ${pickerOpen ? "rotate-180" : ""}`}>{"▾"}</span>
            </button>
            {pickerOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                <div ref={pickerListRef} className="absolute z-20 bottom-full mb-1 w-full bg-panel border border-line rounded-lg shadow-xl max-h-64 overflow-y-auto">
                  {pastSessions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setPickerOpen(false);
                        if (onLoadSession && confirm("Load this session?")) {
                          onLoadSession(s.id);
                          setSelectedSessionLabel(`${s.isEnded ? "🏁" : "🎾"} ${s.name}`);
                        }
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-hover-bg transition-colors border-b border-line last:border-b-0 ${s.id === currentSessionId ? "bg-accent-soft border-l-4 border-l-accent pl-2.5" : ""}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 text-sm font-medium text-text">
                            <span>{s.isEnded ? "🏁" : "🎾"}</span>
                            <span className="truncate">{s.name}</span>
                          </div>
                          <div className="text-xs text-subtext mt-0.5">
                            {formatSessionDate(s.createdAt)} - {s._count?.rounds ?? 0}R {sessionPlayerCount(s)}P
                          </div>
                        </div>
                        {(s.isEnded || (s._count?.rounds ?? 0) === 0) && onDeleteSession && (
                          <button
                            aria-label="Delete session"
                            title="Delete this session"
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm("Delete this session and all its rounds? This cannot be undone.")) {
                                await onDeleteSession(s.id);
                                loadPastSessions();
                              }
                            }}
                            className="shrink-0 self-center px-1.5 py-0.5 rounded-md border border-line bg-muted-bg text-red-500 hover:bg-hover-bg transition-colors text-xs"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Row 2: Select dropdown */}
        {sessionRounds.length > 0 ? (
        <select
          value={selectedRoundNumber === "" ? "" : selectedRoundNumber}
          onChange={(e) => setSelectedRoundNumber(e.target.value ? parseInt(e.target.value) : "")}
          className="w-full px-3 py-2 bg-muted-bg border border-line rounded-md text-sm text-text mb-3"
        >
          <option value="">Select a round...</option>
          {sessionRounds.map(r => (
            <option key={r.roundNumber} value={r.roundNumber}>
              Round {r.roundNumber} — {new Date(r.date).toLocaleString()}
            </option>
          ))}
        </select>
        ) : (
          <p className="text-subtext text-sm text-center mb-3">No rounds yet</p>
        )}

        {/* Row 3: Action buttons - Edit/Delete or Save/Cancel */}
        {currentDbSessionId && currentDbSessionId === currentSessionId && (
          <div className="mb-2">
            {pastSessions.find(s => s.id === currentDbSessionId)?.isEnded ? (
              <button
                onClick={() => currentDbSessionId && onContinueSession?.(currentDbSessionId)}
                className="w-full px-3 py-2 rounded-lg bg-muted-bg border border-line hover:bg-hover-bg text-text text-sm font-medium"
              >
                {"\u25b6"} Continue Session
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!onEndSession || !currentDbSessionId) return;
                  if (!confirm("End this session? You can still view and edit its rounds.")) return;
                  await onEndSession(currentDbSessionId);
                  loadPastSessions();
                  setSelectedSessionLabel(l => (l ? l.replace("🎾 ", "🏁 ") : l));
                }}
                className="w-full px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium"
              >
                ⏹ End Session
              </button>
            )}
          </div>
        )}
        {selectedRound && (
          <div className="flex flex-wrap gap-2">
            {editMode ? (
              <>
                <button
                  onClick={cancelEditing}
                  className="flex-1 min-w-[100px] px-3 py-2 rounded-lg bg-muted-bg hover:bg-hover-bg text-text text-sm font-medium"
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
      {selectedRound && (
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
            {(editMode ? editMatches : selectedRound.matches).filter(m => !m.bye).map((m) => {
              const getPlayerName = (id: string) => {
                const p = eventPool.find(e => e.id === id);
                return p?.name || id;
              };

              return (
                <div
                  key={m.id}
                  className={`rounded-lg border-2 px-3 py-2 ${m.bye ? "border-orange-400/70 bg-muted-bg" : "border-line bg-muted-bg"}`}
                >
                  <div className="text-xs text-subtext font-medium mb-1">{m.bye ? "BYE" : `Court ${m.court ?? "\u2014"}`}</div>

                  {/* Team 1 row */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {m.bye ? (
                        <span className="text-sm font-medium text-text truncate">{m.byePlayerId ? getPlayerName(m.byePlayerId) : "Unknown"}</span>
                      ) : m.team1.map(id => (
                        <span
                          key={id}
                          onClick={editMode ? () => handleNameClick(m, "team1", id) : undefined}
                          title={editMode ? "Click to move to Team 2" : undefined}
                          className={`text-sm font-medium text-text truncate flex-1 min-w-0 h-8 flex items-center px-2 rounded-lg border-2 border-purple-400/70 bg-muted-bg ${editMode ? "cursor-pointer hover:bg-hover-bg" : ""}`}
                        >
                          {getPlayerName(id)}
                        </span>
                      ))}
                    </div>
                    {!m.bye && (
                      editMode ? (
                        <input
                          type="number"
                          value={m.team1Score ?? ""}
                          onChange={(e) => { const v = e.target.value; updateMatchScore(m.id, "team1Score", (v === "" ? undefined : parseInt(v) || 0) as any); }}
                          className="w-14 h-8 shrink-0 px-1.5 border-2 border-purple-400/70 rounded-lg text-center bg-muted-bg text-text text-sm"
                          placeholder="0"
                        />
                      ) : m.team1Score !== undefined && m.team2Score !== undefined ? (
                        <span className={`shrink-0 w-14 h-8 flex items-center justify-center text-sm rounded-lg border-2 ${"border-purple-400/70 text-text"}`}>{m.team1Score}</span>
                      ) : (
                        <span className="w-14 shrink-0" />
                      )
                    )}
                  </div>

                  {/* Team 2 row */}
                  {!m.bye && (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {m.team2.map(id => (
                          <span
                            key={id}
                            onClick={editMode ? () => handleNameClick(m, "team2", id) : undefined}
                            title={editMode ? "Click to move to Team 1" : undefined}
                            className={`text-sm font-medium text-text truncate flex-1 min-w-0 h-8 flex items-center px-2 rounded-lg border-2 border-green-400/70 bg-muted-bg ${editMode ? "cursor-pointer hover:bg-hover-bg" : ""}`}
                          >
                            {getPlayerName(id)}
                          </span>
                        ))}
                      </div>
                      {editMode ? (
                        <input
                          type="number"
                          value={m.team2Score ?? ""}
                          onChange={(e) => { const v = e.target.value; updateMatchScore(m.id, "team2Score", (v === "" ? undefined : parseInt(v) || 0) as any); }}
                          className="w-14 h-8 shrink-0 px-1.5 border-2 border-green-400/70 rounded-lg text-center bg-muted-bg text-text text-sm"
                          placeholder="0"
                        />
                      ) : m.team1Score !== undefined && m.team2Score !== undefined ? (
                        <span className={`shrink-0 w-14 h-8 flex items-center justify-center text-sm rounded-lg border-2 ${"border-green-400/70 text-text"}`}>{m.team2Score}</span>
                      ) : (
                        <span className="w-14 shrink-0" />
                      )}
                    </div>
                  )}
                </div>

              );
            })}
          </div>

          {(editMode ? editMatches : selectedRound.matches).some(m => m.bye) && (
            <div className={`mt-4 rounded-lg border-2 p-3 bg-muted-bg ${pendingBye ? "border-accent" : "border-orange-400/70"}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-subtext font-medium">BYE</span>
                {pendingBye && <span className="text-xs text-accent">click a court player to swap</span>}
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
                {(editMode ? editMatches : selectedRound.matches).filter(m => m.bye).map(m => {
                  const id = m.byePlayerId || "";
                  const armed = pendingBye?.matchId === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!editMode}
                      onClick={() => setPendingBye(armed ? null : { matchId: m.id, playerId: id })}
                      title={editMode ? "Click, then click a court player to swap" : undefined}
                      className={`flex items-center gap-1.5 rounded-lg px-2 py-1 border-2 h-8 ${armed ? "border-accent bg-hover-bg" : "border-orange-400/70 bg-muted-bg"} ${editMode ? "cursor-pointer hover:bg-hover-bg" : "cursor-default"}`}
                    >
                      <span className="text-sm shrink-0">⏳</span>
                      <span className="text-sm font-medium text-text truncate flex-1 text-left">{playerLabel(id)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
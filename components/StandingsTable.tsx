"use client";

import React from "react";
import { StandingsEntry } from "./Types";

interface Props {
  standings: StandingsEntry[];
  getSeedTotal: (e: StandingsEntry) => number;
  getByeTotal: (e: StandingsEntry) => number;
  getPointDiff: (e: StandingsEntry) => number;
  getPtsPct: (e: StandingsEntry) => number;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  handleSort: (key: string) => void;
}

// Format DUPR to always show 2 decimals (or — if null)
function formatDupr(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(2);
}

// Get effective DUPR for sorting (treat null as config default 2.5)
function getEffectiveDupr(score: number | null | undefined, defaultDupr: number): number {
  return score ?? defaultDupr;
}

export default function StandingsTable({
  standings,
  defaultDupr = 2.5,
  getSeedTotal,
  getByeTotal,
  getPointDiff,
  getPtsPct,
  sortColumn,
  sortDirection,
  handleSort,
}: Props) {
  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📊 Standings</h2>
        <span className="text-sm text-gray-500">{standings.length} players</span>
      </div>

      {standings.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Add players to the event pool to see standings</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("byeBase")}>
                  Bye {sortColumn === "byeBase" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("byeCount")}>
                  Byes {sortColumn === "byeCount" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("duprScore")}>
                  DUPR {sortColumn === "duprScore" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("seedAdjustment")}>
                  Order# {sortColumn === "seedAdjustment" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("wins")}>
                  W {sortColumn === "wins" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("losses")}>
                  L {sortColumn === "losses" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("pointsFor")}>
                  PF {sortColumn === "pointsFor" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("pointsAgainst")}>
                  PA {sortColumn === "pointsAgainst" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("pointDiff")}>
                  +/- {sortColumn === "pointDiff" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => handleSort("ptsPct")}>
                  Pts% {sortColumn === "ptsPct" && (sortDirection === "asc" ? "↑" : "↓")}
                </th>
              </tr>
            </thead>

            <tbody>
              {standings.map((entry) => {
                const seedTotal = getSeedTotal(entry);
                const byeTotal = getByeTotal(entry);
                const pointDiff = getPointDiff(entry);
                const ptsPctVal = getPtsPct(entry);
                // Check if player has a manually set DUPR (not the default)
                const effectiveDupr = getEffectiveDupr(entry.duprScore, defaultDupr);
                const hasManualDupr = entry.manualDuprScore !== null && entry.manualDuprScore !== undefined;
                const hasApiDupr = entry.duprScore !== null && entry.duprScore !== undefined && !hasManualDupr;

                return (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <div className={`font-medium ${effectiveDupr !== defaultDupr ? "" : "text-gray-400"}`}>
                        {entry.name}
                      </div>
                      {entry.duprId && <div className="text-xs text-gray-500">{entry.duprId}</div>}
                    </td>

                    <td className="p-2 text-center">
                      <span
                        className={`font-mono ${byeTotal >= 0 ? "text-blue-600" : "text-orange-600"} cursor-help`}
                        title={`${entry.byeBase.toFixed(2)} base + ${entry.byeCount} byes + ${(entry.sitOutCount * 1).toFixed(2)} sit outs${entry.byeMod > 0 ? ` + ${entry.byeMod.toFixed(2)} late join` : ""}`}
                      >
                        {byeTotal >= 0 ? "+" : ""}
                        {byeTotal.toFixed(2)}
                      </span>
                    </td>

                    <td className="p-2 text-center">
                      <span className="text-purple-600 font-bold cursor-pointer hover:bg-gray-100">
                        {entry.byeCount}
                      </span>
                    </td>

                    {/* DUPR Column - sortable */}
                    <td
                      className={`p-2 text-center font-mono cursor-pointer hover:bg-gray-100 ${
                        hasManualDupr || hasApiDupr 
                          ? "text-green-600 font-semibold" 
                          : "text-gray-400"
                      }`}
                      onClick={() => handleSort("duprScore")}
                      title={hasManualDupr ? "Manually set DUPR" : hasApiDupr ? "DUPR API rating" : `No DUPR set (using default ${defaultDupr})`}
                    >
                      {effectiveDupr !== defaultDupr 
                        ? formatDupr(effectiveDupr) 
                        : "—"
                      }
                    </td>

                    <td
                      className="p-2 text-center font-mono text-blue-600 cursor-help"
                      title={`seed: ${entry.seed.toFixed(2)}\nadjustment: ${entry.seedAdjustment >= 0 ? "+" : ""}${entry.seedAdjustment.toFixed(2)}\n${entry.orderHistory.map((h) => `R${h.round}: ${h.change >= 0 ? "+" : ""}${h.change.toFixed(2)} (${h.reason})`).join("\n")}`}
                    >
                      {seedTotal.toFixed(2)}
                    </td>

                    <td className="p-2 text-center font-bold text-green-600">{entry.wins}</td>
                    <td className="p-2 text-center font-bold text-red-500">{entry.losses}</td>
                    <td className="p-2 text-center">{entry.pointsFor}</td>
                    <td className="p-2 text-center">{entry.pointsAgainst}</td>

                    <td
                      className={`p-2 text-center font-mono cursor-pointer hover:bg-gray-100 ${
                        pointDiff >= 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      {pointDiff >= 0 ? "+" : ""}
                      {pointDiff}
                    </td>

                    <td className="p-2 text-center">
                      <span className={ptsPctVal >= 50 ? "text-green-600 font-bold" : "text-gray-600"}>
                        {ptsPctVal.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
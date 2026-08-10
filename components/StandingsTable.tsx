"use client";

import React, { useMemo, useState } from "react";
import { StandingsEntry } from "@/components/Types";

interface Props {
  standings: StandingsEntry[];
  defaultDupr?: number; // default value when player has no rating
  onRegenerateByes?: () => void;

  // External sorting control (optional)
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (column: string) => void;

  // Helper getters (parent may supply these for consistency)
  getSeedTotal?: (e: StandingsEntry) => number;
  getByeTotal?: (e: StandingsEntry) => number;
  getPointDiff?: (e: StandingsEntry) => number;
  getPtsPct?: (e: StandingsEntry) => number;
}

// Format DUPR to always show 2 decimals
function formatDupr(score: number | null | undefined): string {
  if (score === null || score === undefined) return "—";
  return score.toFixed(2);
}

function getEffectiveDupr(entry: StandingsEntry, defaultDupr: number): number {
  // Use API duprScore if present, otherwise manualDuprScore, otherwise default
  return entry.duprScore ?? entry.manualDuprScore ?? defaultDupr;
}

export default function StandingsTable({
  standings,
  defaultDupr = 2.5,
  onRegenerateByes,
  sortColumn: externalSortColumn,
  sortDirection: externalSortDirection,
  onSortChange,
  getSeedTotal,
  getByeTotal,
  getPointDiff,
  getPtsPct,
}: Props) {
  const [internalSortColumn, setInternalSortColumn] = useState<string>("seedTotal");
  const [internalSortDirection, setInternalSortDirection] = useState<"asc" | "desc">("asc");

  const sortColumn = externalSortColumn ?? internalSortColumn;
  const sortDirection = externalSortDirection ?? internalSortDirection;

  const headerClick = (col: string) => {
    if (onSortChange) return onSortChange(col);
    if (col === internalSortColumn) {
      setInternalSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setInternalSortColumn(col);
      setInternalSortDirection("asc");
    }
  };

  const getSortIcon = (col: string) => (sortColumn === col ? (sortDirection === "asc" ? " ↑" : " ↓") : "");

  const computed = useMemo(() => {
    return standings.map((s) => {
      const seedTotal = (s.seed || 0) + (s.seedAdjustment || 0);
      const byeTotal = (s.byeBase || 0) + (s.byeCount || 0) + ((s.sitOutCount || 0) * 0.5) + (s.byeMod || 0);
      const pointsFor = s.pointsFor || 0;
      const pointsAgainst = s.pointsAgainst || 0;
      const pointDiff = pointsFor - pointsAgainst;
      const ptsPct = pointsFor + pointsAgainst > 0 ? (pointsFor / (pointsFor + pointsAgainst)) * 100 : 0;
      const matchesPlayed = (s.wins || 0) + (s.losses || 0);
      const winPct = matchesPlayed > 0 ? ((s.wins || 0) / matchesPlayed) * 100 : 0;
      const effectiveDupr = getEffectiveDupr(s, defaultDupr);
      const hasManual = s.manualDuprScore !== null && s.manualDuprScore !== undefined;
      const hasApi = s.duprScore !== null && s.duprScore !== undefined && !hasManual;
      return { ...s, seedTotal, byeTotal, pointDiff, ptsPct, winPct, effectiveDupr, hasManual, hasApi };
    });
  }, [standings, defaultDupr]);

  const sorted = useMemo(() => {
    const list = [...computed];
    list.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortColumn) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "seedTotal":
          aVal = a.seedTotal;
          bVal = b.seedTotal;
          break;
        case "wins":
          aVal = a.wins || 0;
          bVal = b.wins || 0;
          break;
        case "losses":
          aVal = a.losses || 0;
          bVal = b.losses || 0;
          break;
        case "winPct":
          aVal = a.winPct || 0;
          bVal = b.winPct || 0;
          break;
        case "pointsFor":
          aVal = a.pointsFor || 0;
          bVal = b.pointsFor || 0;
          break;
        case "pointsAgainst":
          aVal = a.pointsAgainst || 0;
          bVal = b.pointsAgainst || 0;
          break;
        case "pointDiff":
          aVal = a.pointDiff;
          bVal = b.pointDiff;
          break;
        case "ptsPct":
          aVal = a.ptsPct;
          bVal = b.ptsPct;
          break;
        case "byeTotal":
          aVal = a.byeTotal;
          bVal = b.byeTotal;
          break;
        case "byeCount":
          aVal = a.byeCount || 0;
          bVal = b.byeCount || 0;
          break;
        case "duprScore":
          aVal = a.effectiveDupr;
          bVal = b.effectiveDupr;
          break;
        default:
          aVal = a.seedTotal;
          bVal = b.seedTotal;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? (aVal as string).localeCompare(bVal as string) : (bVal as string).localeCompare(aVal as string);
      }
      return sortDirection === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
    return list;
  }, [computed, sortColumn, sortDirection]);

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📊 Standings</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onRegenerateByes}
            className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm hover:bg-orange-200 border border-orange-300"
            title="Regenerate bye base scores"
          >
            🎲 Regenerate Bye Base
          </button>
          <span className="text-sm text-gray-500">{sorted.length} players</span>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Add players to the event pool to see standings</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left w-1/4 cursor-pointer" onClick={() => headerClick("name")}>Name{getSortIcon("name")}</th>
                <th className="p-2 text-center w-16 cursor-pointer" onClick={() => headerClick("byeTotal")}>Bye{getSortIcon("byeTotal")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("byeCount")}>Byes{getSortIcon("byeCount")}</th>
                {/* NEW DUPR COLUMN */}
                <th className="p-2 text-center w-20 cursor-pointer" onClick={() => headerClick("duprScore")}>DUPR{getSortIcon("duprScore")}</th>
                <th className="p-2 text-center w-20 cursor-pointer" onClick={() => headerClick("seedTotal")}>Order#{getSortIcon("seedTotal")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("wins")}>W{getSortIcon("wins")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("losses")}>L{getSortIcon("losses")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("pointsFor")}>PF{getSortIcon("pointsFor")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("pointsAgainst")}>PA{getSortIcon("pointsAgainst")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("pointDiff")}>+/-{getSortIcon("pointDiff")}</th>
                <th className="p-2 text-center w-12 cursor-pointer" onClick={() => headerClick("ptsPct")}>Pts%{getSortIcon("ptsPct")}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id} className="border-t hover:bg-gray-50">
                  <td className={`p-2 ${e.effectiveDupr === defaultDupr ? "text-gray-400" : "text-gray-800"}`}>
                    <div className="font-medium">{e.name}</div>
                    {e.duprId && <div className="text-xs text-gray-500">{e.duprId}</div>}
                  </td>

                  <td className="p-2 text-center font-mono" title={`bye breakdown`}>
                    {e.byeTotal >= 0 ? "+" : ""}{e.byeTotal.toFixed(2)}
                  </td>

                  <td className="p-2 text-center font-semibold text-purple-600">{e.byeCount}</td>

                  {/* DUPR column: show — if effectiveDupr equals defaultDupr, otherwise show 2 decimals */}
                  <td className="p-2 text-center font-mono">
                    {e.effectiveDupr !== defaultDupr ? formatDupr(e.effectiveDupr) : "—"}
                  </td>

                  <td className="p-2 text-center font-mono text-blue-600">{e.seedTotal.toFixed(2)}</td>

                  <td className="p-2 text-center text-green-600 font-bold">{e.wins}</td>
                  <td className="p-2 text-center text-red-600 font-bold">{e.losses}</td>
                  <td className="p-2 text-center">{e.pointsFor}</td>
                  <td className="p-2 text-center">{e.pointsAgainst}</td>
                  <td className={`p-2 text-center ${e.pointDiff >= 0 ? "text-green-600" : "text-red-600"}`}>{e.pointDiff >= 0 ? "+" : ""}{e.pointDiff}</td>
                  <td className="p-2 text-center">{e.ptsPct.toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
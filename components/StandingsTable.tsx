"use client";

import React, { useMemo, useState } from "react";
import { StandingsEntry } from "@/components/Types";

interface Props {
  standings: StandingsEntry[];
  onRegenerateByes?: () => void;

  // Optional external control (parent can pass these to control sorting)
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (column: string) => void;
}

export default function StandingsTable({
  standings,
  onRegenerateByes,
  sortColumn: externalSortColumn,
  sortDirection: externalSortDirection,
  onSortChange,
}: Props) {
  // Internal fallback sort state when not externally controlled
  const [internalSortColumn, setInternalSortColumn] = useState<string>("seedTotal");
  const [internalSortDirection, setInternalSortDirection] = useState<"asc" | "desc">("asc");

  const sortColumn = externalSortColumn ?? internalSortColumn;
  const sortDirection = externalSortDirection ?? internalSortDirection;

  const headerClick = (col: string) => {
    // If parent provided onSortChange, call it and let parent handle toggling
    if (onSortChange) {
      onSortChange(col);
      return;
    }

    // Uncontrolled/toggle behavior
    if (col === internalSortColumn) {
      setInternalSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setInternalSortColumn(col);
      setInternalSortDirection("asc");
    }
  };

  const getSortIcon = (col: string) => (sortColumn === col ? (sortDirection === "asc" ? " ↑" : " ↓") : "");

  // compute derived fields (seedTotal, byeTotal, pointDiff, ptsPct, winPct)
  const computed = useMemo(() => {
    return standings.map((entry) => {
      const seedTotal = (entry.seed || 0) + (entry.seedAdjustment || 0);
      const byeBase = entry.byeBase || 0;
      const byeCount = entry.byeCount || 0;
      const sitOutCount = entry.sitOutCount || 0;
      const byeMod = entry.byeMod || 0;
      const byeTotal = byeBase + byeCount + sitOutCount * 0.5 + byeMod;
      const pointsFor = entry.pointsFor || 0;
      const pointsAgainst = entry.pointsAgainst || 0;
      const pointDiff = pointsFor - pointsAgainst;
      const ptsPct = pointsFor + pointsAgainst > 0 ? (pointsFor / (pointsFor + pointsAgainst)) * 100 : 50;
      const matchesPlayed = (entry.wins || 0) + (entry.losses || 0);
      const winPct = matchesPlayed > 0 ? ((entry.wins || 0) / matchesPlayed) * 100 : 0;

      return { ...entry, seedTotal, byeTotal, pointDiff, ptsPct, winPct };
    });
  }, [standings]);

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
    <section className="bg-white rounded-2xl shadow-xl p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-bold text-gray-800">📊 Standings</h2>
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
                <th
                  className="p-2 text-left cursor-pointer hover:bg-gray-200 w-1/3"
                  onClick={() => headerClick("name")}
                >
                  Name{getSortIcon("name")}
                </th>

                <th
                  className="p-2 text-center cursor-pointer hover:bg-gray-200 w-12"
                  onClick={() => headerClick("wins")}
                >
                  W{getSortIcon("wins")}
                </th>

                <th
                  className="p-2 text-center cursor-pointer hover:bg-gray-200 w-12"
                  onClick={() => headerClick("losses")}
                >
                  L{getSortIcon("losses")}
                </th>

                <th className="p-2 text-center text-xs text-gray-500 hidden sm:table-cell" onClick={() => headerClick("winPct")}>
                  Win%{getSortIcon("winPct")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200 hidden sm:table-cell" onClick={() => headerClick("pointsFor")}>
                  PF{getSortIcon("pointsFor")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200 hidden sm:table-cell" onClick={() => headerClick("pointsAgainst")}>
                  PA{getSortIcon("pointsAgainst")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200 hidden md:table-cell" onClick={() => headerClick("pointDiff")}>
                  +/-{getSortIcon("pointDiff")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => headerClick("ptsPct")}>
                  Pts%{getSortIcon("ptsPct")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200" onClick={() => headerClick("byeCount")}>
                  Byes{getSortIcon("byeCount")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200 hidden md:table-cell" onClick={() => headerClick("byeTotal")} title="Total bye score">
                  Bye{getSortIcon("byeTotal")}
                </th>

                <th className="p-2 text-center cursor-pointer hover:bg-gray-200 hidden lg:table-cell" onClick={() => headerClick("seedTotal")} title="Total seed (seed + adjustment)">
                  Order#{getSortIcon("seedTotal")}
                </th>
              </tr>
            </thead>

            <tbody>
              {sorted.map((entry) => {
                const seedTotal = entry.seedTotal;
                const byeTotal = entry.byeTotal;
                const pointDiff = entry.pointDiff;
                const ptsPctVal = entry.ptsPct;
                const winPct = (entry as any).winPct ?? 0;
                return (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="p-2"><div className="font-medium">{entry.name}</div></td>

                    <td className="p-2 text-center font-bold text-green-600">{entry.wins || 0}</td>
                    <td className="p-2 text-center font-bold text-red-500">{entry.losses || 0}</td>
                    <td className="p-2 text-center text-xs text-gray-700 hidden sm:table-cell">{String(Math.round(winPct))}%</td>

                    <td className="p-2 text-center hidden sm:table-cell">{entry.pointsFor || 0}</td>
                    <td className="p-2 text-center hidden sm:table-cell">{entry.pointsAgainst || 0}</td>

                    <td className={`p-2 text-center font-mono ${pointDiff >= 0 ? "text-green-600" : "text-red-600"} hidden md:table-cell`}>{pointDiff >= 0 ? "+" : ""}{pointDiff}</td>

                    <td className="p-2 text-center"><span className={ptsPctVal >= 50 ? "text-green-600 font-bold" : "text-gray-600"}>{ptsPctVal.toFixed(0)}%</span></td>

                    <td className="p-2 text-center"><span className="text-purple-600 font-bold">{entry.byeCount || 0}</span></td>

                    <td className={`p-2 text-center font-mono ${byeTotal >= 0 ? "text-blue-600" : "text-orange-600"} hidden md:table-cell`} title={`bye breakdown:\nbase: ${(entry.byeBase || 0).toFixed(2)}\n+ ${entry.byeCount || 0} byes\n+ ${((entry.sitOutCount || 0) * 0.5).toFixed(2)} sitBonus\n+ ${(entry.byeMod || 0).toFixed(2)} Other`}>{byeTotal >= 0 ? "+" : ""}{byeTotal.toFixed(2)}</td>

                    <td className="p-2 text-center font-mono text-blue-600 cursor-help hidden lg:table-cell" title={`Order # History:\nseed: ${(entry.seed || 0).toFixed(2)}\n${entry.orderHistory.length > 0 ? "Changes:" : "No changes yet"}\n${entry.orderHistory.map((h) => `R${h.round}: ${h.change >= 0 ? "+" : ""}${h.change.toFixed(2)} (${h.reason})`).join("\n")}\ncurrent adjustment: ${(entry.seedAdjustment || 0) >= 0 ? "+" : ""}${(entry.seedAdjustment || 0).toFixed(2)}`}>{seedTotal.toFixed(2)}</td>
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

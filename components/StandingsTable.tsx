"use client";

import React from "react";
import { StandingsEntry } from "./Types";

interface Props {
  standings: StandingsEntry[];
  onRegenerateByes?: () => void;
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (column: string) => void;
}

export default function StandingsTable({
  standings,
  onRegenerateByes,
  sortColumn = "seedAdjustment",
  sortDirection = "asc",
  onSortChange,
}: Props) {
  // Compute derived values for each entry
  const computeEntries = standings.map(entry => {
    const seedTotal = (entry.seed || 0) + (entry.seedAdjustment || 0);
    const byeBase = entry.byeBase || 0;
    const byeCount = entry.byeCount || 0;
    const sitOutCount = entry.sitOutCount || 0;
    const byeMod = entry.byeMod || 0;
    const byeTotal = byeBase + byeCount + (sitOutCount * 0.5) + byeMod;
    const pointsFor = entry.pointsFor || 0;
    const pointsAgainst = entry.pointsAgainst || 0;
    const pointDiff = pointsFor - pointsAgainst;
    const ptsPct = (pointsFor + pointsAgainst) > 0 
      ? (pointsFor / (pointsFor + pointsAgainst)) * 100 
      : 50;
    
    return {
      ...entry,
      seedTotal,
      byeTotal,
      pointDiff,
      ptsPct,
    };
  });

  // Sort entries based on current sort column and direction
  const sortedEntries = [...computeEntries].sort((a, b) => {
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
      case "byeBase":
        aVal = a.byeBase || 0;
        bVal = b.byeBase || 0;
        break;
      default:
        aVal = a.seedTotal;
        bVal = b.seedTotal;
    }

    // Sort direction
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    return sortDirection === "asc" 
      ? (aVal as number) - (bVal as number) 
      : (bVal as number) - (aVal as number);
  });

  const handleSort = (column: string) => {
    if (onSortChange) {
      onSortChange(column);
    }
  };

  const getSortIcon = (column: string) => {
    if (sortColumn === column) {
      return sortDirection === "asc" ? " ↑" : " ↓";
    }
    return "";
  };

  return (
    <section className="bg-white rounded-2xl shadow-xl p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800">📊 Standings</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={onRegenerateByes}
            className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-lg text-sm hover:bg-orange-200 border border-orange-300 transition-colors"
            title="Regenerate bye base scores"
          >
            🎲 Regenerate Bye Base
          </button>
          <span className="text-sm text-gray-500">{sortedEntries.length} players</span>
        </div>
      </div>

      {sortedEntries.length === 0 ? (
        <p className="text-gray-400 text-center py-8">Add players to the event pool to see standings</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th 
                  className="p-2 text-left cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("name")}
                >
                  Name{getSortIcon("name")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("seedTotal")}
                  title="Total seed (seed + adjustment)"
                >
                  Order#{getSortIcon("seedTotal")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("wins")}
                >
                  W{getSortIcon("wins")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("losses")}
                >
                  L{getSortIcon("losses")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("pointsFor")}
                >
                  PF{getSortIcon("pointsFor")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("pointsAgainst")}
                >
                  PA{getSortIcon("pointsAgainst")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("pointDiff")}
                >
                  +/-{getSortIcon("pointDiff")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("ptsPct")}
                  title="Points percentage"
                >
                  Pts%{getSortIcon("ptsPct")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("byeTotal")}
                  title="Total bye score"
                >
                  Bye{getSortIcon("byeTotal")}
                </th>
                <th 
                  className="p-2 text-center cursor-pointer hover:bg-gray-200"
                  onClick={() => handleSort("byeCount")}
                  title="Number of byes earned"
                >
                  Byes{getSortIcon("byeCount")}
                </th>
              </tr>
            </thead>

            <tbody>
              {sortedEntries.map((entry) => {
                const seedTotal = entry.seedTotal;
                const byeTotal = entry.byeTotal;
                const pointDiff = entry.pointDiff;
                const ptsPctVal = entry.ptsPct;

                return (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <div className="font-medium">{entry.name}</div>
                    </td>

                    <td 
                      className="p-2 text-center font-mono text-blue-600 cursor-help"
                      title={`Order # History:
seed: ${(entry.seed || 0).toFixed(2)}
${entry.orderHistory.length > 0 ? "Changes:" : "No changes yet"}
${entry.orderHistory.map((h, i) => `R${h.round}: ${h.change >= 0 ? "+" : ""}${h.change.toFixed(2)} (${h.reason})`).join("\n")}
current adjustment: ${(entry.seedAdjustment || 0) >= 0 ? "+" : ""}${(entry.seedAdjustment || 0).toFixed(2)}`}
                    >
                      {seedTotal.toFixed(2)}
                    </td>

                    <td className="p-2 text-center font-bold text-green-600">{entry.wins || 0}</td>
                    <td className="p-2 text-center font-bold text-red-500">{entry.losses || 0}</td>
                    <td className="p-2 text-center">{entry.pointsFor || 0}</td>
                    <td className="p-2 text-center">{entry.pointsAgainst || 0}</td>

                    <td 
                      className={`p-2 text-center font-mono ${pointDiff >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {pointDiff >= 0 ? "+" : ""}{pointDiff}
                    </td>

                    <td className="p-2 text-center">
                      <span className={ptsPctVal >= 50 ? "text-green-600 font-bold" : "text-gray-600"}>
                        {ptsPctVal.toFixed(0)}%
                      </span>
                    </td>

                    <td 
                      className={`p-2 text-center font-mono ${byeTotal >= 0 ? "text-blue-600" : "text-orange-600"}`}
                      title={`base: ${(entry.byeBase || 0).toFixed(2)}, count: ${entry.byeCount || 0}, sit: ${(entry.sitOutCount || 0) * 0.5}, mod: ${(entry.byeMod || 0).toFixed(2)}`}
                    >
                      {byeTotal >= 0 ? "+" : ""}{byeTotal.toFixed(2)}
                    </td>

                    <td className="p-2 text-center">
                      <span className="text-purple-600 font-bold">
                        {entry.byeCount || 0}
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
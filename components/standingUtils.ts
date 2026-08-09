// Standings utility functions
import { StandingsEntry } from "./Types";

export function getSeedTotal(entry: StandingsEntry): number {
  return (entry.seed || 0) + (entry.seedAdjustment || 0);
}

export function getByeTotal(entry: StandingsEntry): number {
  const byeBase = entry.byeBase ?? 0;
  const byeCount = entry.byeCount ?? 0;
  const sitOutCount = entry.sitOutCount ?? 0;
  const byeMod = entry.byeMod ?? 0;
  return byeBase + byeCount + (sitOutCount * 0.5) + byeMod;
}

export function getPointDiff(entry: StandingsEntry): number {
  return (entry.pointsFor || 0) - (entry.pointsAgainst || 0);
}

export function getPtsPct(entry: StandingsEntry): number {
  const pf = entry.pointsFor || 0;
  const pa = entry.pointsAgainst || 0;
  if (pf + pa === 0) return 50;
  return (pf / (pf + pa)) * 100;
}

export interface SortedStandingsEntry extends StandingsEntry {
  seedTotal: number;
  byeTotal: number;
  pointDiff: number;
  ptsPct: number;
}

export function computeStandingsEntries(standings: StandingsEntry[]): SortedStandingsEntry[] {
  return standings.map(entry => {
    const seedTotal = getSeedTotal(entry);
    const byeTotal = getByeTotal(entry);
    const pointDiff = getPointDiff(entry);
    const ptsPct = getPtsPct(entry);
    
    return {
      ...entry,
      seedTotal,
      byeTotal,
      pointDiff,
      ptsPct,
    };
  });
}

export function sortStandings(
  entries: SortedStandingsEntry[],
  sortColumn: string,
  sortDirection: "asc" | "desc"
): SortedStandingsEntry[] {
  return [...entries].sort((a, b) => {
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

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc" 
        ? aVal.localeCompare(bVal) 
        : bVal.localeCompare(aVal);
    }
    return sortDirection === "asc" 
      ? (aVal as number) - (bVal as number) 
      : (bVal as number) - (aVal as number);
  });
}

export function formatByeBreakdown(entry: StandingsEntry): string {
  const byeBase = entry.byeBase ?? 0;
  const byeCount = entry.byeCount ?? 0;
  const sitOutCount = entry.sitOutCount ?? 0;
  const byeMod = entry.byeMod ?? 0;
  const sitBonus = sitOutCount * 0.5;

  const parts: string[] = [];
  if (byeBase !== 0) parts.push(`base: ${byeBase >= 0 ? "+" : ""}${byeBase.toFixed(2)}`);
  if (byeCount > 0) parts.push(`+ ${byeCount} byes`);
  if (sitBonus > 0) parts.push(`+ ${sitBonus.toFixed(2)} sitBonus`);
  if (byeMod > 0) parts.push(`+ ${byeMod.toFixed(2)} LateJoin`);

  return parts.join("\n") || "base: 0";
}

export function formatOrderHistoryTooltip(entry: StandingsEntry): string {
  let tooltip = `Order # History:\nseed: ${(entry.seed || 0).toFixed(2)}\n`;
  
  if (entry.orderHistory.length > 0) {
    tooltip += "Changes:\n";
    entry.orderHistory.forEach(h => {
      tooltip += `R${h.round}: ${h.change >= 0 ? "+" : ""}${h.change.toFixed(2)} (${h.reason})\n`;
    });
  } else {
    tooltip += "No changes yet\n";
  }
  
  tooltip += `current adj: ${(entry.seedAdjustment || 0) >= 0 ? "+" : ""}${(entry.seedAdjustment || 0).toFixed(2)}`;
  
  return tooltip;
}
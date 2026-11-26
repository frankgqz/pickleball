"use client";

import { useEffect, useState } from "react";
import type { QueueState } from "@/app/courtQueue";
import { waitingList, nextQuartet } from "@/app/courtQueue";
import type { CourtConfig, ScoreWhy } from "@/app/courtEngine";
import { sitRate } from "@/app/courtEngine";

interface Props {
  queue: QueueState;
  cfg: CourtConfig;
  names: Record<string, string>;
}

// The by-court answer to by-round's byes section (Frank 2026-11-25): every
// waiting player with a LIVE score. The ladder order is the pick's own
// priority - the top score goes on court next, and the quartet is built
// around that person - so the list re-reads every 30s as the waits tick.
// the mouseover mathematics (Frank 2026-11-26: "more mathematics of how
// the score is derived"): every factor × its live rate, display-signed
// (bigger = sooner), summing to the number on the row
function derivation(
  row: { waitMin: number; games: number; minutesPlayed: number; cycles: number; dupr: number; score: number; fit: number | null; fitAvg: number | null },
  anchorDupr: number,
  why: ScoreWhy,
  fitWhy: ScoreWhy | null,
  cfg: CourtConfig,
  cycleRate: number,
  withFit: boolean
): string {
  const f = (v: number) => Math.abs(v).toFixed(2).replace(/\.?0+$/, "");
  const s = (v: number) => (v > 0 ? "+" : "−") + f(v);
  const coef = (v: number) => (v < 0 ? "−" : "+") + f(v);
  const lines: string[] = [];
  lines.push(`current wait (since last game): ${row.waitMin}m × ${coef(cfg.courtWaitMin)} = ${s(why.wait)}`);
  lines.push(`games: ${row.games} × ${coef(cfg.courtGames)} = ${s(why.played - row.minutesPlayed * cfg.courtMinPlayed)}`);
  lines.push(`on court: ${row.minutesPlayed}m × ${coef(cfg.courtMinPlayed)} = ${s(row.minutesPlayed * cfg.courtMinPlayed)}`);
  lines.push(`level: ${row.dupr} × ${coef(cfg.courtDuprScore)} = ${s(why.level)}`);
  lines.push(`sits/missed (each game on a court): ${row.cycles} × ${coef(-cycleRate)} = ${s(why.absence)}`);
  lines.push(`join credit = ${s(why.offset)}`);
  lines.push(`────────────────────────────────`);
  lines.push(`score = ${s(row.score)}`);
  if (withFit && fitWhy) {
    const avg = row.fitAvg ?? anchorDupr;
    const faces = cfg.courtDupLast !== 0 ? Math.round(fitWhy.dupLast / cfg.courtDupLast) : 0;
    lines.push(`fit adds (the DUPR pull):`);
    lines.push(`DUPR gap to the forming court: |${row.dupr} − ${avg.toFixed(2)}| × ${coef(cfg.courtDuprClose)} = ${s(fitWhy.close)}`);
    lines.push(`faces: ${faces} × ${coef(cfg.courtDupLast)} = ${s(fitWhy.dupLast)}`);
    lines.push(`────────────────────────────────`);
    lines.push(`fit = ${s(row.fit ?? 0)}`);
  }
  return lines.join("\n");
}

export default function WaitingPanel({ queue, cfg, names }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const rows = waitingList(queue, cfg, now);
  const quartet = new Set(nextQuartet(queue, cfg, now));
  const cycleRate = sitRate(cfg, Object.keys(queue.onCourt).length, rows.length);
  if (rows.length === 0) return null;

  // the formula with the LIVE Court Settings values (Frank: "the current
  // variables from court settings") - display signs: bigger = sooner
  const term = (label: string, v: number) =>
    `${v < 0 ? "−" : "+"} ${label}×${Math.abs(v).toFixed(2).replace(/\.?0+$/, "")}`;
  const formula =
    `score = ${term("current wait", cfg.courtWaitMin).replace(/^[+−] /, "")} ` +
    `${term("games", cfg.courtGames)} ${term("min", cfg.courtMinPlayed)} ${term("dupr", cfg.courtDuprScore)} ` +
    `${term("sits/missed", -cycleRate)} + join credit · ` +
    `fit = score ${term("DUPR gap", cfg.courtDuprClose)} ${term("faces", cfg.courtDupLast)}`;

  return (
    <section className="mt-6 bg-panel rounded-2xl shadow-xl px-4 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-subtext text-sm">⏱ Waiting</h3>
        <p className="text-xs text-subtext/70">
          {rows[0] ? `score = next on court · fit = the score at each pick's step` : "the live score"}
        </p>
      </div>

      <div className="mt-2 space-y-1">
        {rows.map((row, i) => (
          <div
            key={row.id}
            className={
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border " +
              (i === 0
                ? "bg-accent-soft border-l-4 border-l-accent"
                : quartet.has(row.id)
                  ? "bg-muted-bg border-line"
                  : "border-transparent")
            }
          >
            <span className="text-xs text-subtext w-5 text-right">#{i + 1}</span>
            <span className="flex-1 font-medium text-text truncate">{names[row.id] || row.id}</span>
            {i === 0 && (
              <span className="px-1.5 sm:px-2 py-0.5 role-tint rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                next<span className="hidden sm:inline"> on court</span>
              </span>
            )}
            {i > 0 && quartet.has(row.id) && (
              <span className="px-1.5 sm:px-2 py-0.5 bg-accent-soft text-accent rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                pairs<span className="hidden sm:inline"> in</span>
              </span>
            )}
            <span className="text-xs tabular-nums text-subtext/80 w-7 sm:w-8 text-right shrink-0" title="DUPR rating (the level and parity terms)">
              {row.dupr.toFixed(1)}
            </span>
            <span className="hidden sm:block text-xs tabular-nums text-subtext/60 w-14 text-right">
              {row.games}g · {row.waitMin}m
            </span>
            <span
              className="font-semibold tabular-nums text-text w-11 sm:w-12 text-right cursor-help shrink-0"
              title={derivation(row, rows[0].dupr, row.why, row.fitWhy, cfg, cycleRate, false)}
            >
              {row.score.toFixed(1)}
            </span>
            <span
              className="tabular-nums text-subtext w-11 sm:w-12 text-right cursor-help shrink-0"
              title={row.fit === null ? "the anchor — the reference point" : `${row.fitNote}\n${derivation(row, rows[0].dupr, row.why, row.fitWhy, cfg, cycleRate, true)}`}
            >
              {row.fit === null ? "—" : row.fit.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-subtext/70 leading-relaxed">
        {formula}
      </div>
    </section>
  );
}

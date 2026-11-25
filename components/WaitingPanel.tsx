"use client";

import { useEffect, useState } from "react";
import type { QueueState } from "@/app/courtQueue";
import { waitingList, nextQuartet } from "@/app/courtQueue";
import type { CourtConfig, ScoreWhy } from "@/app/courtEngine";

interface Props {
  queue: QueueState;
  cfg: CourtConfig;
  names: Record<string, string>;
}

// The by-court answer to by-round's byes section (Frank 2026-11-25): every
// waiting player with a LIVE score. The ladder order is the pick's own
// priority - the top score goes on court next, and the quartet is built
// around that person - so the list re-reads every 30s as the waits tick.
// the mouseover arithmetic (Frank 2026-11-25): the engine's own terms,
// display-signed (bigger = sooner), so the number shows its work
function breakdown(why: ScoreWhy, fitWhy: ScoreWhy | null): string {
  const parts: string[] = [];
  const add = (label: string, v: number) => {
    if (Math.abs(v) >= 0.05) parts.push(`${label} ${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`);
  };
  add("wait", -why.wait);
  add("games+min", -why.played);
  add("level", -why.level);
  add("cycles", -why.absence);
  add("join", -why.offset);
  if (fitWhy) {
    add("parity", -fitWhy.close);
    add("faces", -fitWhy.dupLast);
  }
  return parts.join(" · ");
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
  if (rows.length === 0) return null;

  // the formula with the LIVE Court Settings values (Frank: "the current
  // variables from court settings") - display signs: bigger = sooner
  const cycleRate = cfg.courtSitRatio * (Math.max(1, Object.keys(queue.onCourt).length) / Math.max(1, rows.length)) * cfg.courtGames;
  const term = (label: string, v: number) =>
    `${v < 0 ? "−" : "+"} ${label}×${Math.abs(v).toFixed(2).replace(/\.?0+$/, "")}`;
  const formula =
    `score = ${term("wait", -cfg.courtWaitMin).replace(/^[+−] /, "")} ` +
    `${term("games", -cfg.courtGames)} ${term("min", -cfg.courtMinPlayed)} ${term("dupr", -cfg.courtDuprScore)} ` +
    `${term("cycles", -cycleRate)} − join · ` +
    `fit = score ${term("Δdupr", -cfg.courtDuprClose)} ${term("faces", -cfg.courtDupLast)}`;

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
            <span className="text-xs tabular-nums text-subtext/80 w-8 text-right" title="DUPR rating (the level and parity terms)">
              {row.dupr.toFixed(1)}
            </span>
            {i === 0 && (
              <span className="px-2 py-0.5 role-tint rounded-lg text-xs font-semibold">
                next on court
              </span>
            )}
            {i > 0 && quartet.has(row.id) && (
              <span className="px-2 py-0.5 bg-accent-soft text-accent rounded-lg text-xs font-semibold">
                pairs in
              </span>
            )}
            <span className="text-xs tabular-nums text-subtext/60 w-14 text-right">
              {row.games}g · {row.waitMin}m
            </span>
            <span
              className="font-semibold tabular-nums text-text w-12 text-right cursor-help"
              title={`${breakdown(row.why, row.fitWhy)} = ${row.score.toFixed(1)}`}
            >
              {row.score.toFixed(1)}
            </span>
            <span
              className="tabular-nums text-subtext w-12 text-right cursor-help"
              title={row.fit === null ? "the anchor — the reference point" : `${row.fitNote} · ${breakdown(row.fitWhy!, row.fitWhy!)} = ${row.fit.toFixed(1)}`}
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

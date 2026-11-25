"use client";

import { useEffect, useState } from "react";
import type { QueueState } from "@/app/courtQueue";
import { waitingList } from "@/app/courtQueue";
import type { CourtConfig } from "@/app/courtEngine";

interface Props {
  queue: QueueState;
  cfg: CourtConfig;
  names: Record<string, string>;
}

// The by-court answer to by-round's byes section (Frank 2026-11-25): every
// waiting player with a LIVE score. The ladder order is the pick's own
// priority - the top score goes on court next, and the quartet is built
// around that person - so the list re-reads every 30s as the waits tick.
export default function WaitingPanel({ queue, cfg, names }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const rows = waitingList(queue, cfg, Date.now());
  if (rows.length === 0) return null;

  return (
    <section className="mt-6 bg-panel rounded-2xl shadow-xl px-4 py-3">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-subtext text-sm">⏱ Waiting</h3>
        <p className="text-xs text-subtext/70">the live score - the top one plays next</p>
      </div>

      <div className="mt-2 space-y-1">
        {rows.map((row, i) => (
          <div
            key={row.id}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm border " +
              (i === 0
                ? "bg-accent-soft border-l-4 border-l-accent"
                : i < 4
                  ? "bg-muted-bg border-line"
                  : "border-transparent")
            }
          >
            <span className="text-xs text-subtext w-5 text-right">#{i + 1}</span>
            <span className="flex-1 font-medium text-text truncate">{names[row.id] || row.id}</span>
            {i === 0 && (
              <span className="px-2 py-0.5 role-tint rounded-lg text-xs font-semibold">
                next on court
              </span>
            )}
            {i >= 4 && (
              <span className="text-xs text-subtext/60">{row.waitMin}m · {row.games}g</span>
            )}
            <span className="font-semibold tabular-nums text-text">{row.score.toFixed(1)}</span>
          </div>
        ))}
      </div>

      {rows.length > 4 && (
        <p className="mt-2 text-xs text-subtext/70">
          the top four are the next quartet - the pairing inside is balanced around #1
        </p>
      )}
    </section>
  );
}

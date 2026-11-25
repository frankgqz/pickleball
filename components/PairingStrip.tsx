"use client";

// The recent-pairings strip (Frank 2026-11-26): the submit stands and the
// game stays recorded - what gets recovered is the PAIRING. Every quartet
// the engine proposed is remembered for a few steps; a chip sends that
// pairing to the next free court (the "revert" = the pairing comes back,
// the ledger is never touched).
export interface PairingEntry {
  key: string;
  court: number;
  ids: string[];
  why: string;
  anchorId: string;
  at: number;
}

interface Props {
  strip: PairingEntry[];
  names: Record<string, string>;
  busyIds: Set<string>;
  freeCourt: number | null;
  onClaim: (court: number, ids: string[]) => void;
}

export default function PairingStrip({ strip, names, busyIds, freeCourt, onClaim }: Props) {
  if (strip.length === 0) return null;

  const ago = (at: number) => {
    const m = Math.max(0, Math.round((Date.now() - at) / 60000));
    return m < 1 ? "now" : m + "m ago";
  };

  return (
    // grouped INSIDE the Courts panel (Frank 2026-11-26): the strip shares
    // the cards' mechanic - send = we're on, undo = the same undo
    <div className="mt-3 border-t border-line pt-2.5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold text-subtext text-xs">⏱ Recent pairings</h3>
        <p className="text-[11px] text-subtext/70">the ones that flashed by - send any of them</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {strip.map((entry) => {
          const blocked = entry.ids.some((id) => busyIds.has(id));
          const disabled = blocked || freeCourt === null;
          return (
            <button
              key={entry.key}
              onClick={() => {
                if (!disabled && freeCourt !== null) onClaim(freeCourt, entry.ids);
              }}
              disabled={disabled}
              title={`${entry.why} · ${ago(entry.at)}${blocked ? " · someone is busy now" : ""}`}
              className={
                "px-2.5 py-1.5 rounded-lg text-xs border-2 text-left transition-colors " +
                (disabled
                  ? "border-line bg-muted-bg text-subtext/50 cursor-not-allowed"
                  : "border-line bg-muted-bg text-text hover:bg-hover-bg cursor-pointer")
              }
            >
              <span className="font-semibold">{names[entry.anchorId] || entry.anchorId}</span>
              <span className="text-subtext">
                {" + "}
                {entry.ids
                  .filter((id) => id !== entry.anchorId)
                  .map((id) => names[id] || id)
                  .join(", ")}
              </span>
              <span className="text-subtext/60"> · {ago(entry.at)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

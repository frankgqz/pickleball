"use client"
// The by-Court rolling surface (Frank 2026-11-03): courts fill from the queue
// the moment they free up; every pick carries its why; grey = thin pool.
import { useEffect, useState } from "react"
import { CourtConfig, CourtPlayer, ScoreWhy, pickCourt, splitTeams, whyLine } from "@/app/courtEngine"
import { QueueState , isSitting } from "@/app/courtQueue"

export type PairingSeen = {
  court: number
  ids: string[]
  why: string
  anchorId: string
  at: number
}

type Props = {
  queue: QueueState
  names: Record<string, string>
  cfg: CourtConfig
  venueCap: number
  onClaim: (court: number, ids: string[]) => void
  onSubmit: (court: number, team1: string[], team2: string[], s1: number, s2: number, durationMin: number) => void
  onPairingsSeen?: (seen: PairingSeen[]) => void
}

type Suggestion = { four: CourtPlayer[]; steps: ScoreWhy[][]; available: number }

function usePairingCapture(key: string, seen: PairingSeen[], onPairingsSeen?: (seen: PairingSeen[]) => void) {
  useEffect(() => {
    if (key && onPairingsSeen) onPairingsSeen(seen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

export default function CourtRolling({ queue, names, cfg, venueCap, onClaim, onSubmit, onPairingsSeen }: Props) {
  const [scores, setScores] = useState<Record<string, string>>({})
  const now = Date.now()
  const claimed = queue.onCourt

  // the free pool: not sitting, not claimed
  const busy = new Set(Object.values(claimed).flatMap((c) => c.ids))
  const pool = Object.values(queue.players).filter((p) => !isSitting(queue, p.id) && !busy.has(p.id))

  // courts = floor(not-sitting / 4), capped at the venue, never fewer than the claimed
  const notSitting = Object.keys(queue.players).filter((id) => !isSitting(queue, id)).length
  const courtCount = Math.min(venueCap, Math.max(Object.keys(claimed).length, Math.floor(notSitting / 4)))

  // the recent-pairings capture (Frank 2026-11-26): every quartet the cards
  // PROPOSE goes to the strip - the pairing that flashes by when a submit
  // lands stays claimable. Runs as an effect keyed on the quartet sets (the
  // parent owns the dedupe and the window).
  const busyNow = new Set(Object.values(claimed).flatMap((c) => c.ids))
  const freePool = Object.values(queue.players).filter((p) => !isSitting(queue, p.id) && !busyNow.has(p.id))
  const seen: PairingSeen[] = []
  {
    const rem = [...freePool]
    for (let court = 1; court <= courtCount && rem.length >= 4; court++) {
      if (claimed[court]) continue
      const steps = pickCourt(rem, now, cfg, { courts: Math.max(1, courtCount) })
      const four = steps.slice(0, 4).map((s) => rem.find((p) => p.id === s[0].id)!)
      const anchor = four.find((p) => p.id === steps[0][0].id)!
      const [teamA, teamB] = splitTeams(four)
      const waitMin = (now - anchor.waitSince) / 60000
      seen.push({
        court,
        ids: four.map((p) => p.id),
        why: whyLine(waitMin, teamA, teamB),
        anchorId: anchor.id,
        at: now,
      })
      for (const p of four) rem.splice(rem.indexOf(p), 1)
    }
  }
  const seenKey = seen.map((s) => [...s.ids].sort().join(",")).join("|")
  usePairingCapture(seenKey, seen, onPairingsSeen)

  // sequential picks: each free court takes the best of what remains
  const suggestions: Record<number, Suggestion> = {}
  const remaining = [...pool]
  for (let court = 1; court <= courtCount; court++) {
    if (claimed[court] || remaining.length < 4) continue
    const steps = pickCourt(remaining, now, cfg, { courts: Math.max(1, courtCount) })
    const four = steps.slice(0, 4).map((s) => remaining.find((p) => p.id === s[0].id)!)
    suggestions[court] = { four, steps, available: remaining.length }
    for (const p of four) remaining.splice(remaining.indexOf(p), 1)
  }

  const nameOf = (id: string) => names[id] || id.slice(0, 6)

  return (
    <section className="bg-panel rounded-2xl shadow-xl p-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-text">Courts</h2>
        <span className="text-xs text-subtext">{pool.length} choosing</span>
      </div>

      {courtCount === 0 ? (
        <div className="text-xs text-subtext py-6 text-center">
          let people rest — {notSitting} in play, need 4+ choosing for a game
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Array.from({ length: courtCount }, (_, i) => i + 1).map((court) => {
            const claim = claimed[court]
            const sug = suggestions[court]
            const s1 = scores[court + "-1"] ?? ""
            const s2 = scores[court + "-2"] ?? ""

            if (claim) {
              const p = claim.ids.map((id) => queue.players[id])
              const [teamA, teamB] = p.length === 4 ? splitTeams(p) : [p.slice(0, 2), p.slice(2)]
              const elapsed = Math.max(1, Math.round((now - claim.startedAt) / 60000))
              const setScore = (k: string, v: string) => setScores((prev) => ({ ...prev, [k]: v }))
              return (
                // the by-round panel shape (Frank 2026-11-25): court# in the
                // gutter, the two team rows, one bottom row for the action
                <div key={court} className="border-2 border-line rounded-lg p-2.5 grid grid-cols-[0.9rem_minmax(0,1fr)] gap-x-0.5">
                  <span className="self-start pt-2.5 text-[11px] text-subtext leading-none">{court}</span>
                  <div className="flex items-center gap-1 min-w-0">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {teamA.map((x) => (
                        <span key={x.id} className="flex-1 min-w-0 h-8 truncate flex items-center rounded-lg px-2 border-2 team-1 bg-muted-bg text-text text-sm font-medium">{nameOf(x.id)}</span>
                      ))}
                    </div>
                    <input type="number" value={s1} onChange={(e) => setScore(court + "-1", e.target.value)} placeholder="0"
                      className="w-11 shrink-0 h-8 px-1 text-center text-sm rounded-lg border-2 team-1 bg-muted-bg text-text no-spin" />
                  </div>
                  <span className="self-center mt-1 -ml-1 text-[11px] text-subtext leading-none">vs</span>
                  <div className="flex items-center gap-1 mt-1 min-w-0">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {teamB.map((x) => (
                        <span key={x.id} className="flex-1 min-w-0 h-8 truncate flex items-center rounded-lg px-2 border-2 team-2 bg-muted-bg text-text text-sm font-medium">{nameOf(x.id)}</span>
                      ))}
                    </div>
                    <input type="number" value={s2} onChange={(e) => setScore(court + "-2", e.target.value)} placeholder="0"
                      className="w-11 shrink-0 h-8 px-1 text-center text-sm rounded-lg border-2 team-2 bg-muted-bg text-text no-spin" />
                  </div>
                  <span />
                  <div className="col-start-2 flex items-center gap-2 mt-1.5">
                    <span className="text-xs text-subtext flex-1 truncate">{whyLine(elapsed, teamA, teamB)}</span>
                    <button
                      onClick={() => onSubmit(court, teamA.map((x) => x.id), teamB.map((x) => x.id), parseInt(s1) || 0, parseInt(s2) || 0, elapsed)}
                      disabled={s1 === "" || s2 === ""}
                      className="role-primary px-4 h-7 text-xs font-semibold shrink-0 disabled:opacity-45"
                    >submit</button>
                  </div>
                </div>
              )
            }

            if (!sug) {
              return (
                <div key={court} className="border-2 border-dashed border-line rounded-lg p-2.5 text-center">
                  <span className="text-xs font-semibold text-text">Court {court}</span>
                  <div className="text-xs text-subtext mt-1">free — fun games welcome</div>
                </div>
              )
            }

            const [teamA, teamB] = splitTeams(sug.four)
            const locked = sug.four.find((p) => p.id === sug.steps[0][0].id)!
            const waitMin = (now - locked.waitSince) / 60000
            const forced = sug.available === 4
            const thin = sug.available < 6
            return (
              // the by-round panel shape (Frank 2026-11-25): court# in the
              // gutter, the two team rows, one bottom row = whyLine + we're on
              <div key={court}
                className={"rounded-lg p-2.5 border-2 grid grid-cols-[0.9rem_minmax(0,1fr)] gap-x-0.5 " + (forced ? "border-line bg-panel opacity-70" : "border-line bg-muted-bg")}>
                <span className="self-start pt-2.5 text-[11px] text-subtext leading-none">{court}</span>
                <div className="flex items-center gap-1 min-w-0">
                  {teamA.map((x) => (
                    <span key={x.id} className="flex-1 min-w-0 h-8 truncate flex items-center rounded-lg px-2 border-2 team-1 bg-muted-bg text-text text-sm font-medium">{nameOf(x.id)}</span>
                  ))}
                </div>
                <span className="self-center mt-1 -ml-1 text-[11px] text-subtext leading-none">vs</span>
                <div className="flex items-center gap-1 mt-1 min-w-0">
                  {teamB.map((x) => (
                    <span key={x.id} className="flex-1 min-w-0 h-8 truncate flex items-center rounded-lg px-2 border-2 team-2 bg-muted-bg text-text text-sm font-medium">{nameOf(x.id)}</span>
                  ))}
                </div>
                <span />
                <div className="col-start-2 flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-subtext flex-1 truncate">
                    {whyLine(waitMin, teamA, teamB)} · built on {nameOf(locked.id)}
                    {forced ? " · only 1 pairing — send it" : thin ? ` · thin pool — ${sug.available} choosing` : ""}
                  </span>
                  <button onClick={() => {
                    // a fresh claim starts with empty score cells (Frank:
                    // the previous game's scores lingered in them)
                    setScores((prev) => {
                      const next = { ...prev };
                      delete next[court + "-1"];
                      delete next[court + "-2"];
                      return next;
                    });
                    onClaim(court, sug.four.map((x) => x.id));
                  }} className="role-primary px-4 h-7 text-xs font-semibold shrink-0">we're on</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

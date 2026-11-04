"use client"
// The by-Court rolling surface (Frank 2026-11-03): courts fill from the queue
// the moment they free up; every pick carries its why; grey = thin pool.
import { useState } from "react"
import { CourtConfig, CourtPlayer, ScoreWhy, pickCourt, splitTeams, whyLine } from "@/app/courtEngine"
import { QueueState } from "@/app/courtQueue"

type Props = {
  queue: QueueState
  names: Record<string, string>
  cfg: CourtConfig
  venueCap: number
  onClaim: (court: number, ids: string[]) => void
  onSubmit: (court: number, team1: string[], team2: string[], s1: number, s2: number, durationMin: number) => void
}

type Suggestion = { four: CourtPlayer[]; steps: ScoreWhy[][]; available: number }

export default function CourtRolling({ queue, names, cfg, venueCap, onClaim, onSubmit }: Props) {
  const [scores, setScores] = useState<Record<string, string>>({})
  const now = Date.now()
  const claimed = queue.onCourt

  // the free pool: not sitting, not claimed
  const busy = new Set(Object.values(claimed).flatMap((c) => c.ids))
  const pool = Object.values(queue.players).filter((p) => !queue.sitting[p.id] && !busy.has(p.id))

  // courts = floor(not-sitting / 4), capped at the venue, never fewer than the claimed
  const notSitting = Object.keys(queue.players).filter((id) => !queue.sitting[id]).length
  const courtCount = Math.min(venueCap, Math.max(Object.keys(claimed).length, Math.floor(notSitting / 4)))

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
    <section className="bg-muted-bg border border-line rounded-xl p-3">
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
                <div key={court} className="border-2 border-line rounded-lg p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-text">Court {court}</span>
                    <span className="text-xs text-subtext">{elapsed}m</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    {teamA.map((x) => (
                      <span key={x.id} className="flex-1 min-w-0 truncate text-xs px-1.5 h-7 flex items-center rounded-lg border-2 team-1">{nameOf(x.id)}</span>
                    ))}
                    <input type="number" value={s1} onChange={(e) => setScore(court + "-1", e.target.value)} placeholder="0"
                      className="w-11 h-7 px-1 text-center text-xs rounded-lg border-2 team-1 bg-muted-bg text-text no-spin" />
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {teamB.map((x) => (
                      <span key={x.id} className="flex-1 min-w-0 truncate text-xs px-1.5 h-7 flex items-center rounded-lg border-2 team-2">{nameOf(x.id)}</span>
                    ))}
                    <input type="number" value={s2} onChange={(e) => setScore(court + "-2", e.target.value)} placeholder="0"
                      className="w-11 h-7 px-1 text-center text-xs rounded-lg border-2 team-2 bg-muted-bg text-text no-spin" />
                  </div>
                  <button
                    onClick={() => onSubmit(court, teamA.map((x) => x.id), teamB.map((x) => x.id), parseInt(s1) || 0, parseInt(s2) || 0, elapsed)}
                    disabled={s1 === "" || s2 === ""}
                    className="w-full mt-2 role-primary disabled:opacity-45"
                  >submit</button>
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
              <div key={court}
                className={"rounded-lg p-2.5 border-2 " + (forced ? "border-line bg-panel opacity-70" : "border-line bg-muted-bg")}>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-text">Court {court}</span>
                  <span className="text-xs text-subtext">{whyLine(waitMin, teamA, teamB)}</span>
                </div>
                <div className="flex items-center gap-1 mt-1.5">
                  {teamA.map((x) => (
                    <span key={x.id} className="flex-1 min-w-0 truncate text-xs px-1.5 h-7 flex items-center rounded-lg border-2 team-1">{nameOf(x.id)}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  {teamB.map((x) => (
                    <span key={x.id} className="flex-1 min-w-0 truncate text-xs px-1.5 h-7 flex items-center rounded-lg border-2 team-2">{nameOf(x.id)}</span>
                  ))}
                </div>
                <button onClick={() => onClaim(court, sug.four.map((x) => x.id))} className="w-full mt-2 role-primary">we're on</button>
                {forced && <div className="text-xs text-subtext mt-1.5">only 1 pairing — send it</div>}
                {!forced && thin && <div className="text-xs text-subtext mt-1.5">thin pool — {sug.available} choosing</div>}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

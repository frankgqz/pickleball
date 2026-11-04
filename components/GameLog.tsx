"use client"
// The by-Court game log (Frank 2026-11-03): a flat log of submitted games —
// the round rows exist in storage but the UI never says "round".
import { CompletedRound } from "@/components/Types"

type Props = {
  roundHistory: CompletedRound[]
  names: Record<string, string>
  sessionEnded?: boolean
  onEndSession?: () => void
}

export default function GameLog({ roundHistory, names, sessionEnded, onEndSession }: Props) {
  const nameOf = (id: string) => names[id] || id.slice(0, 6)
  const rows = [...roundHistory].sort((a, b) => b.roundNumber - a.roundNumber)
  return (
    <section className="bg-muted-bg border border-line rounded-xl p-3">
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-text">Games</h2>
        <button onClick={onEndSession} disabled={sessionEnded || !onEndSession} className="role-quiet px-2 py-0.5 text-xs disabled:opacity-45">
          {sessionEnded ? "ended" : "end session"}
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="text-xs text-subtext py-4 text-center">no games yet</div>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => {
            const m = r.matches[0]
            if (!m || m.bye) return null
            const t = new Date(r.date)
            return (
              <div key={r.roundNumber} className="flex items-center gap-2 text-xs border border-line rounded-lg px-2 py-1">
                <span className="text-subtext w-6 text-right">{r.roundNumber}</span>
                <span className="text-subtext w-10">C{m.court ?? "-"}</span>
                <span className="flex-1 min-w-0 truncate text-text">
                  {m.team1.map(nameOf).join("/")} v {m.team2.map(nameOf).join("/")}
                </span>
                <span className="text-text w-12 text-right">{m.team1Score}-{m.team2Score}</span>
                <span className="text-subtext w-10 text-right">{t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// The by-Court queue: pure state transitions (Frank's rules, 2026-11-03).
// The UI drives these; persistence = submitted games via saveRound rows.
import {
  CourtConfig,
  CourtPlayer,
  ScoreWhy,
  joinOffset,
  pickCourt,
  standingScore,
} from "./courtEngine"

export type QueueState = {
  players: Record<string, CourtPlayer>
  sitting: Record<string, number> // id -> frozen wait ms (clock paused)
  onCourt: Record<number, { ids: string[]; startedAt: number }> // court -> claim
}

export function emptyQueue(): QueueState {
  return { players: {}, sitting: {}, onCourt: {} }
}

const activePlayers = (s: QueueState) =>
  Object.keys(s.players).filter((id) => !s.sitting[id] && !Object.values(s.onCourt).some((c) => c.ids.includes(id)))

/** a joiner enters at the pool's history mean (Frank: ratio 1.0); their
 *  wait clock starts at join. */
export function joinQueue(s: QueueState, id: string, dupr: number, now: number, cfg: CourtConfig, courts: number): QueueState {
  const pool = activePlayers(s).map((pid) => s.players[pid])
  const offset = joinOffset(pool, now, cfg, { courts })
  return {
    ...s,
    players: {
      ...s.players,
      [id]: { id, dupr, gamesPlayed: 0, minutesPlayed: 0, waitSince: now, creditedCycles: 0, scoreOffset: offset, lastGameFaces: [] },
    },
  }
}

/** sit = the clock freezes at its current value; back = it resumes where it
 *  stopped (the pre-sit wait is banked, not lost). */
export function toggleSit(s: QueueState, id: string, now: number): QueueState {
  const p = s.players[id]
  if (!p) return s
  if (s.sitting[id] !== undefined) {
    const frozen = s.sitting[id]
    const sitting = { ...s.sitting }
    delete sitting[id]
    return { ...s, sitting, players: { ...s.players, [id]: { ...p, waitSince: now - frozen } } }
  }
  return { ...s, sitting: { ...s.sitting, [id]: now - p.waitSince }, players: { ...s.players, [id]: { ...p, waitSince: now } } }
}

/** the engine's pick for one court + the full why-steps (the 3rd/4th picks
 *  carry the dup-last math as the court fills). */
export function suggest(s: QueueState, now: number, cfg: CourtConfig, courts: number) {
  const pool = activePlayers(s).map((pid) => s.players[pid])
  return pickCourt(pool, now, cfg, { courts })
}

/** the claim: the picked players leave the queue and the court freezes. */
export function claimCourt(s: QueueState, court: number, ids: string[], now: number): QueueState {
  return { ...s, onCourt: { ...s.onCourt, [court]: { ids, startedAt: now } } }
}

/** a submitted game: the four re-enter wanting to play, histories update,
 *  and everyone sitting earns one credited cycle (they sat through it). */
export function submitGame(
  s: QueueState,
  court: number,
  durationMin: number,
  now: number
): QueueState {
  const claim = s.onCourt[court]
  if (!claim) return s
  const players = { ...s.players }
  for (const id of claim.ids) {
    const p = players[id]
    players[id] = {
      ...p,
      gamesPlayed: p.gamesPlayed + 1,
      minutesPlayed: p.minutesPlayed + durationMin,
      waitSince: now,
      lastGameFaces: claim.ids.filter((x) => x !== id),
    }
  }
  const sitting = { ...s.sitting }
  for (const id of Object.keys(sitting)) {
    players[id] = { ...players[id], creditedCycles: players[id].creditedCycles + 1 }
    sitting[id] = sitting[id] // frozen wait unchanged
  }
  const onCourt = { ...s.onCourt }
  delete onCourt[court]
  return { players, sitting, onCourt }
}

export { standingScore }

// By-Court mode: rolling court-optimized matching (Frank 2026-11-03).
// Pure functions only — the UI feeds state in, gets a pick + its reason out.

export type CourtUnit = {
  id: string
  players: string[] // 1 = singles, 2 = doubles
  rating: number // combined DUPR (or seed-derived stand-in)
  waitingSince: number // epoch ms — entered the queue
  lastPlayedAt: number | null // epoch ms — came off a court
}

export type PickWhy = {
  waitedMin: number // how long the locked unit waited
  opponentWaitedMin: number
  ratingDelta: number // |combined ratings|
  freshOff: boolean // opponent came off recently
  rematch: boolean // same pairing as the locked unit's last game
  score: number
}

export type NextGame = {
  units: [CourtUnit, CourtUnit]
  why: PickWhy
}

const MIN = 60_000
const JUST_OFF_MIN = 8 // a just-off unit behaves like it has 8 extra wait-min
const FAIR_K = 0.6 // per rating point of mismatch
const REMATCH_PENALTY_MIN = 6

/** virtual wait = real wait + (fresh-off units are pushed back) */
function virtualWaitMin(u: CourtUnit, now: number): number {
  const real = (now - u.waitingSince) / MIN
  if (u.lastPlayedAt == null) return real
  const sinceOff = (now - u.lastPlayedAt) / MIN
  // just came off? shave the wait by the penalty, decaying over ~JUST_OFF_MIN
  const freshness = Math.max(0, 1 - sinceOff / JUST_OFF_MIN)
  return real - freshness * JUST_OFF_MIN
}

export function opponentScore(
  locked: CourtUnit,
  cand: CourtUnit,
  now: number,
  lastOpponentIds: Record<string, string> = {}
): PickWhy {
  const waitedMin = Math.max(0, Math.round((now - locked.waitingSince) / MIN))
  const opponentWaitedMin = Math.max(0, Math.round((now - cand.waitingSince) / MIN))
  const ratingDelta = Math.abs(locked.rating - cand.rating)
  const sinceOff = cand.lastPlayedAt == null ? Infinity : (now - cand.lastPlayedAt) / MIN
  const freshOff = sinceOff < JUST_OFF_MIN
  const rematch = lastOpponentIds[locked.id] === cand.id
  // higher = better pairing; wait of the candidate counts a little too
  const score =
    Math.min(virtualWaitMin(locked, now), virtualWaitMin(cand, now)) * 1.0 -
    ratingDelta * FAIR_K -
    (rematch ? REMATCH_PENALTY_MIN : 0)
  return { waitedMin, opponentWaitedMin, ratingDelta, freshOff, rematch, score }
}

/**
 * The pick: lock the longest-waiting unit in, choose its best opponent.
 * Returns null when fewer than 2 units are waiting.
 */
export function pickNextGame(
  queue: CourtUnit[],
  now: number,
  lastOpponentIds: Record<string, string> = {}
): NextGame | null {
  if (queue.length < 2) return null
  const sorted = [...queue].sort((a, b) => virtualWaitMin(b, now) - virtualWaitMin(a, now))
  const locked = sorted[0]
  let best: { cand: CourtUnit; why: PickWhy } | null = null
  for (const cand of sorted.slice(1)) {
    const why = opponentScore(locked, cand, now, lastOpponentIds)
    if (!best || why.score > best.why.score) best = { cand, why }
  }
  if (!best) return null
  return { units: [locked, best.cand], why: best.why }
}
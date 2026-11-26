// By-Court mode: the pick engine — Frank's scoring formula (2026-11-03).
// Higher score = goes on court next. THE SCORE IS THE PANEL'S NUMBER (Frank
// 2026-11-26: one convention throughout): waits and level add, games,
// minutes, sits and the pairwise terms subtract.

export type CourtConfig = {
  courtGames: number // per game played (−7.5)
  courtWaitMin: number // per minute waited since last game (1)
  courtDuprClose: number // per DUPR point from the forming average (−10)
  courtMinPlayed: number // per minute played (−0.25)
  courtDuprScore: number // per DUPR point of level (1)
  courtDupLast: number // per shared face with a locked player (−2)
  courtSitRatio: number // sits/missed multiplier (1 — the slight catch-up)
  courtJoinBonus: number // the late-join catch-up (5 ≈ half a game) —
  //  added flat ON TOP of the pool average, which is always granted full
  //  (Frank 2026-11-26: "not a ratio, an additive bonus"; the ratio idea
  //  is retired)
}

export type CourtPlayer = {
  id: string
  dupr: number // DUPR or seed-derived (neutral 3.0 fallback)
  gamesPlayed: number
  minutesPlayed: number
  waitSince: number // epoch ms — wanting-to-play state (paused while sitting)
  creditedCycles: number // sits + cycles missed before joining
  scoreOffset: number // late-join credit = the pool average at join (Frank: ratio 1.0)
  lastGameFaces: string[] // the other players in their previous game
}

export const COURT_DEFAULTS: CourtConfig = {
  courtGames: -7.5,
  courtWaitMin: 1,
  courtDuprClose: -10,
  courtMinPlayed: -0.25,
  courtDuprScore: 1,
  courtDupLast: -2,
  courtSitRatio: 1,
  courtJoinBonus: 5,
}

export type ScoreWhy = {
  id: string
  score: number
  played: number
  wait: number
  absence: number
  level: number
  close: number
  dupLast: number
  offset: number
}

/** the cost curve Frank specified: 5m -> 8.75, 10m -> 10, 20m -> 12.5 */
export function gameCost(cfg: CourtConfig, minutes: number): number {
  // the positive COST curve (5m -> 8.75, 20m -> 12.5) — the knobs are
  // display-signed, so the curve is their negation
  return -(cfg.courtGames + cfg.courtMinPlayed * minutes)
}

const MIN = 60_000

/** The sits/missed rate (Frank 2026-11-26): one count per game on a court.
 *  Charge = the fair-share games per cycle (4 per court / players) × the
 *  game-cost equivalent gameBase × multiplier - the multiplier (1.25)
 *  accounts for the minutes part a base cost lacks, so a sit lands just
 *  under a real game (~9.4 vs ~12 average with minutes): "sitsPayLess"
 *  but in line with how many games are played - a sitter can't vault to
 *  1st just by having played nothing. */
export function sitRate(cfg: CourtConfig, courts: number, players: number): number {
  return cfg.courtSitRatio * ((courts * 4) / Math.max(1, players)) * cfg.courtGames
}

export function scoreOf(
  p: CourtPlayer,
  now: number,
  cfg: CourtConfig,
  ctx: { courts: number; activePlayers: number; formingDuprAvg: number | null },
  locked: CourtPlayer[] = []
): ScoreWhy {
  const played = p.gamesPlayed * cfg.courtGames + p.minutesPlayed * cfg.courtMinPlayed
  const wait = ((now - p.waitSince) / MIN) * cfg.courtWaitMin
  const perCycle = sitRate(cfg, ctx.courts, ctx.activePlayers)
  const absence = -(p.creditedCycles * perCycle)
  const level = p.dupr * cfg.courtDuprScore
  const close = ctx.formingDuprAvg === null ? 0 : Math.abs(p.dupr - ctx.formingDuprAvg) * cfg.courtDuprClose
  let dupLast = 0
  for (const l of locked) {
    if (l.lastGameFaces.includes(p.id) || p.lastGameFaces.includes(l.id)) dupLast += cfg.courtDupLast
  }
  return {
    id: p.id,
    score: (p.scoreOffset ?? 0) + played + wait + absence + level + close + dupLast,
    played, wait, absence, level, close, dupLast, offset: p.scoreOffset,
  }
}

/**
 * The lock-sequence pick: highest score locks in, the rest re-score against
 * the forming average + accumulate dup-last. Pick 1 has no forming court,
 * so game 1 of the night sorts by level alone = the standard seeding look.
 */

/**
 * Late join: the joiner starts at the POOL'S CURRENT AVERAGE SCORE (Frank:
 * ratio 1.0 of the pool's increment). Without it the joiner strands behind
 * the evening's wait-drift (scores slide negative as waiting outpaces costs).
 * Their wait clock starts at join (waitSince = joinedAt).
 */
export function joinOffset(
  pool: CourtPlayer[],
  now: number,
  cfg: CourtConfig,
  ctx: { courts: number }
): number {
  if (!pool.length) return 0
  // the HISTORY terms only (played + wait + absence) — the joiner keeps their
  // own level term; inheriting ratings would double-count (the sim caught it)
  const history = pool.map((p) => {
    const w = scoreOf(p, now, cfg, { ...ctx, activePlayers: pool.length, formingDuprAvg: null })
    return w.played + w.wait + w.absence
  })
  return history.reduce((s, v) => s + v, 0) / history.length + (cfg.courtJoinBonus ?? 0)
}


/** the standings column for by-Court mode: the STABLE ledger — event-driven
 *  only (games, sits, joins, level). No live wait term (Frank: it is an
 *  ongoing thing; the queue position already shows the wait) and no pairwise
 *  terms (close/dupLast need specific court-mates to exist). */
export function standingScore(
  p: CourtPlayer,
  now: number,
  cfg: CourtConfig,
  ctx: { courts: number; activePlayers: number }
): number {
  const w = scoreOf(p, now, cfg, { ...ctx, formingDuprAvg: null })
  return (p.scoreOffset ?? 0) + w.played + w.absence + w.level
}

/** the default team split of a picked four: sorted 1-4 by rating,
 *  1+4 vs 2+3 (Frank) — players swap freely after. */
export function splitTeams(four: CourtPlayer[]): [CourtPlayer[], CourtPlayer[]] {
  const s = [...four].sort((a, b) => b.dupr - a.dupr)
  return [[s[0], s[3]], [s[1], s[2]]]
}

/** the compact why-line: `14m · 3.8≈3.9 · Δ0.2` (wait · the two team
 *  averages · parity gap) — no labels, no emoji. */
export function whyLine(lockedWaitMin: number, teamA: CourtPlayer[], teamB: CourtPlayer[]): string {
  const avg = (t: CourtPlayer[]) => t.reduce((s, p) => s + p.dupr, 0) / t.length
  const a = avg(teamA), b = avg(teamB)
  const f = (v: number) => (Math.round(v * 10) / 10).toFixed(1)
  return `${Math.round(lockedWaitMin)}m · ${f(a)}\u2248${f(b)} · \u0394${f(Math.abs(a - b))}`
}

export function pickCourt(
  players: CourtPlayer[],
  now: number,
  cfg: CourtConfig,
  ctx: { courts: number }
): ScoreWhy[][] {
  const remaining = [...players]
  const picked: CourtPlayer[] = []
  const steps: ScoreWhy[][] = []
  for (let i = 0; i < 4 && remaining.length; i++) {
    const formingDuprAvg = picked.length ? picked.reduce((s, p) => s + p.dupr, 0) / picked.length : null
    const scored = remaining
      .map((c) => scoreOf(c, now, cfg, { ...ctx, activePlayers: players.length, formingDuprAvg }, picked))
      .sort((a, b) => b.score - a.score)
    steps.push(scored)
    const winner = remaining.find((r) => r.id === scored[0].id)!
    picked.push(winner)
    remaining.splice(remaining.indexOf(winner), 1)
  }
  return steps
}

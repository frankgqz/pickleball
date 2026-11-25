// The by-Court queue: pure state transitions (Frank's rules, 2026-11-03).
// The UI drives these; persistence = submitted games via saveRound rows.
import {
  CourtConfig,
  CourtPlayer,
  ScoreWhy,
  joinOffset,
  pickCourt,
  standingScore,
  scoreOf,
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
  Object.keys(s.players).filter((id) => !isSitting(s, id) && !Object.values(s.onCourt).some((c) => c.ids.includes(id)))

/** a joiner enters at the pool's history mean (Frank: ratio 1.0); their
 *  wait clock starts at join. */
/** sitting = the KEY is present in the map; the value is the frozen bank
 *  of wait-milliseconds and 0 is a legal value - so NEVER test truthiness,
 *  test PRESENCE. (A sitter with no banked wait - right after a join or a
 *  game - stores 0 and sailed through every `!sitting[id]` check.) */
export function isSitting(s: QueueState, id: string): boolean {
  return s.sitting[id] !== undefined
}

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
// The waiting ladder (Frank 2026-11-25): every free player's live queue
// score, next-on-court first. It is the pick's own sort key shown negated,
// so bigger = sooner at a glance, and it ticks with the clock (the waited
// minutes carry the strongest per-minute weight). The pick builds the
// quartet around whoever tops this ladder.
export function waitingList(state: QueueState, cfg: CourtConfig, now: number) {
  const busy = new Set(Object.values(state.onCourt).flatMap((c) => c.ids));
  const pool = Object.values(state.players).filter(
    (p) => !isSitting(state, p.id) && !busy.has(p.id)
  );
  const ctx = {
    courts: Object.keys(state.onCourt).length,
    activePlayers: pool.length,
    formingDuprAvg: null,
  };
  type WaitRow = {
    id: string
    score: number
    waitMin: number
    games: number
    dupr: number
    fit: number | null
    why: ScoreWhy
    fitWhy: ScoreWhy | null
    fitNote: string
  }
  const rows: WaitRow[] = pool
    .map((p) => {
      const why = scoreOf(p, now, cfg, ctx);
      return {
        id: p.id,
        // the pick's own slot-1 score, negated: bigger = sooner on court
        score: -why.score,
        waitMin: Math.max(0, Math.floor((now - p.waitSince) / 60000)),
        games: p.gamesPlayed,
        dupr: p.dupr,
        fit: null,
        why,
        fitWhy: null,
        fitNote: "",
      };
    })
    .sort((a, b) => b.score - a.score);

  // FIT (Frank 2026-11-25): the score AT THE STEP THAT DECIDED them - the
  // pick is a lock-sequence (slot 2 vs the anchor alone, slot 3 vs the
  // two-player average, slot 4 vs three), so the anchor-only view could
  // disagree with the pick. Each row shows the number from its own decisive
  // step: the picked three their entry score, the rest the final step.
  const steps = suggest(state, now, cfg, Object.keys(state.onCourt).length);
  const byId = new Map(rows.map((r) => [r.id, r]));
  const place = ["anchor", "2nd", "3rd", "4th"];
  steps.forEach((step, i) => {
    const winner = step[0];
    const row = byId.get(winner.id);
    if (row && i > 0) {
      row.fitWhy = winner;
      row.fit = -winner.score;
      row.fitNote = `picked ${place[i]}`;
    }
  });
  const last = steps[steps.length - 1] ?? [];
  for (const cand of last) {
    const row = byId.get(cand.id);
    if (row && row.fitWhy === null) {
      row.fitWhy = cand;
      row.fit = -cand.score;
      row.fitNote = "the last step";
    }
  }
  return rows;
}

/** the quartet the engine will actually send to the next free court: slot 1
 *  is the queue head, slots 2-4 are the fit picks around them. */
export function nextQuartet(state: QueueState, cfg: CourtConfig, now: number): string[] {
  const busy = new Set(Object.values(state.onCourt).flatMap((c) => c.ids));
  const pool = Object.values(state.players).filter(
    (p) => !isSitting(state, p.id) && !busy.has(p.id)
  );
  const steps = suggest(state, now, cfg, Object.keys(state.onCourt).length);
  return steps.map((s) => s[0].id);
}

export function toggleSit(s: QueueState, id: string, now: number): QueueState {
  const p = s.players[id]
  if (!p) return s
  if (isSitting(s, id)) {
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

/** the undo of a claim (Frank 2026-11-26): exactly invertible - a claim
 *  touches no ledger, the four's scores and waits are untouched, so
 *  releasing puts them back with their waits still counting. */
export function unclaimCourt(s: QueueState, court: number): QueueState {
  const onCourt = { ...s.onCourt }
  delete onCourt[court]
  return { ...s, onCourt }
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

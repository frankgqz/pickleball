# By-Court mode (rolling) — the build spec (2026-11-03)

Not round-based: when a match finishes, the next game fills the freed court
immediately from the waiting pool. The mode optimizes court throughput and
fair play over round structure.

## The unit model
- A UNIT = 1 player (singles) or 2 players (doubles). One model, both games.
- A GAME = 2 units on a court.
- Queue = waiting units + units that just came off.

## The pick (Frank's weighting, 2026-10-28 chat)
1. LOCK: the longest-waiting unit plays in the next game ("up next at least
   1 person — that's confirmed").
2. OPPONENT: the lowest-weight candidate =
   most similar combined rating (fair teams)
   − fresh-off penalty (just came off → low priority)
   − rematch penalty (same opponent as last game).
3. WHY: every pick carries its reason breakdown (waited N min · similar
   level · fresh off avoided) — "UI reveals why".

## Defaults (Hermes's calls, Frank veto welcome)
- Everyone cycles off after a game (no winners-stay-on).
- [SUPERSEDED 2026-11-03 by v2's stack: ledger > queue > minutes. The old
 "wait time outranks fairness" line contradicted the ledger-first stack —
 v2 wins.]
- Odd unit out = byes with highest priority next pick (longest wait wins).

## Surface (day 2)
- CourtsPanel: freed court shows a "next up" ghost card (the pairing + why).
- Settings: "by Court (coming soon)" -> live.
- Scores feed the same standings (DUPR badges ride).

## Brainstorm v2 (2026-11-03, Frank's answers)

### The sorting stack — the ledger and the queue
- THE LEDGER (the evening): total games played tonight = the primary
 fairness weight — fewer games goes on next ("the overall impression for
 the event if they would come back").
- THE QUEUE (the rotation): time sat out = the secondary weight.
- Minutes played = minimal weight (stomp vs battle nuance).
- Pairing fit = rating proximity (DUPR or seed fallback).

### Court formation = two stages (Frank's parity-fork resolution)
1. COURT SET: pick the 4 by HOMOGENEITY (similar level together) + the
 ledger/queue weights. First generation of the night = standard-teams-like,
 seeded by DUPR/seed.
2. TEAM SPLIT: the fairish split of the 4 (sorted 1-4): 13v24 / 12v34 /
 14v23 -> max parity. Players swap freely within the court after (the
 existing swap UI stays).

### Choice = filtered pairings, shown as grey
- Grey counts pairings that SURVIVE the weights, not headcount. 6 players =
 15 groups of 4 (x3 splits = 45 arrangements); 7 players = 105 = healthy.
 Dark grey = 1 pairing (forced).
- If grey: SAY WHY ("only 1 pairing — send it").

### The claim-lock (Frank: "confirmation element is necessary")
- Grey = suggestion (recomputes as pools move; changes shown, not hidden).
- Claimed = frozen (tap "we're on"). The engine proposes, humans confirm.

### OFF vs RESULT (Frank: someone scores for the whole court, often the host)
- OFF tap (court-level, by whoever) = all units enter the queue at once.
- RESULT (whenever) = standings only.
- CONSEQUENCE: every game-end feeds 2 units together = batch matching is the
 COMMON case. Free courts fill as ONE batch (max total fairness), never
 greedy per court.

### The candidate shelf (Frank: "a few recommended options")
- Each upcoming court shows top-3 candidate pairings (A/B/C) with their whys
 + the gap to the runner-up = the trust device.

### Custom override (Frank wants it; design = Hermes's)
- Any court, any time: "pick my own" -> choose players -> instant claim,
 card marked "custom". Ledger still counts the games (physical truth); the
 engine balances everyone else around it. Never blocks a wanted game —
  the engine recommends, the room disposes.

## Brainstorm v3 (2026-11-03, late)

### The generation timeline (Frank: undo/redo/->live)
- Every submission = a pool event = a new RECOMMENDATION SNAPSHOT (per free
 court: its A/B/C list). Keep the last ~3-5 snapshots.
- The strip: "live · 1 back · 2 back". Viewing an old snapshot shows that
 generation + a banner "viewing: 1 submission back".
- THE TIMELINE IS READ-ONLY; THE CLAIM IS THE ONLY WRITE. From any snapshot:
 "fix this court" = claim those units (they leave the pool going forward =
 the pin poisons the pool forward; later generations re-solve without them).
- ->live = jump back to now. Staleness is always visible.
- Conflict rule: a claim beats any snapshot. If snapshot players are already
 claimed elsewhere, the card says so; physical truth wins.

### The compact why (Frank: how it chose, without too much info)
- One positional meta string per recommendation card:
 `14m · 3.8≈3.9 · Δ0.2` (wait · the two ratings · parity gap) — no labels,
 no emoji. Full breakdown lives only in the A/B/C shelf expansion.

### The free court = the fun court (custom games CUT, Frank)
- No custom-game feature. The 1 free court absorbs it: people just go on and
 mess around. Free play = off-ledger, off-queue by default (its games count
 only if submitted).
- The free court's duties merge: the preview stage when empty, the choice
 budget for the engine, the fun court when humans claim it.

## Decision debt & assumptions (audit 2026-11-03, pre-build)
Behavior calls made by Hermes (Frank's jurisdiction — veto any):
1. everyone cycles off (his words ~confirmed; the "different locations run it
 differently" option = dropped silently)
2. odd unit out = waits with top priority next pick
3. free play on the fun court = OFF-ledger unless the game is submitted
4. claim = any player can tap "we're on" (not host-only)
5. by-court reuses Session/SessionRound (each game = a 1-match round, game
 counter = roundNumber) — no migration (verified against schema)
Tuning constants (mine; adjust after first real session):
6. just-off penalty = 8 virtual minutes
7. fairness weight = 0.6 per rating point of team mismatch
8. rematch penalty = 6 virtual minutes
9. shelf = top-3 candidate pairings
10. generation timeline keeps ~3-5 snapshots
11. grey ladder: dark at 1 surviving pairing, healthy ~4+
Contradiction FIXED: v1 "wait outranks fairness" vs v2 ledger-first stack.
Gaps (undecided, not yet debt):
A. session lifecycle UX (start = players-in-pool; end = host ends session ->
 final standings; isEnded flag exists) — Hermes's call unless Frank cares
B. unrated players (no DUPR, no seed): fallback = standings seed -> neutral
 3.0? or host-assigns?
C. venue court cap vs players/4 formula (23 players? venue max?)
D. break/sit-out semantics in rolling mode (sitters leave the queue — until
 when?)


## Rulings + Frank's scoring formula (2026-11-03, post-audit)
Rulings: free play = off-ledger (Frank). Session end = like by-round (host
ends -> final standings). Courts = FLOOR(players-not-sitting / 4): 23 -> 5,
24 -> 6. Grey stays until 6-7 players are in the selection pool. Sits =
the standard bye precedent: +0.5 games-equivalent on the ledger + wait clock
paused while sitting.

THE SCORE (Frank's formula, replaces Hermes's just-off/fair constants):
  score = gamesPlayed * 10
        + minutesWaitedSinceLastGame * -1
        + (|playerDUPR - courtFormingAverage| / 0.1) * 1   [= 10 per full DUPR point]
        + totalMinutesPlayed * 0.25
  LOWER = goes on court next. Interpretation: the homogeneity tax measures
  distance from the average of the players being selected (stage 1 = court
  set); 1 game played = 10 min of waiting to overcome (the trade rate);
  minutes-played = the light term (0.25). Self-correcting: a rating outlier
  pays the tax -> plays fewer games -> the ledger term pulls them back.
Survivor: rematch penalty (-6, exact same pairing as last game) = a
tiebreaker only. dead: the just-off 8-min penalty (the ledger term subsumes
it). Rating source: DUPR when linked, else the pool's current seed/order.
v1 claiming = HOST-driven (the host taps for the court; he is the scorer).
v2 (player accounts): players log in, link duprNumID, browse open events,
see up next + why on their phones.
History view in by-court = a flat game log (game #, court, teams, score,
time) — NOT round cards; storage stays 1 game = 1 match row.


## Brainstorm v4 — queue semantics (2026-11-03, "the queue is the count")
The queue of the score = gamesPlayed - sitsCredit. Sit credit = k * c/p
(sitsPayLess: e.g. k=0.9 with c/p = courts/active players). Waiting accrues
ONLY while wanting to play: the clock pauses when sitting/resting/free court.
Rematch = a QUEUE-HOUSEKEEPER at the moment of the pick (only matching
candidates vs the locked unit's last opponents) + a standing rule: a pairing
is not recommended while >=7 players are waiting (>=7 = also the green
threshold — one number, two duties). DEFAULT CARD = the engine's top pick +
its margin over the runner-up ("A vs B — by 2.3"), always visible.
DELIBERATE BROWSE = expand on tap -> the choice board (every court, all
filter-surviving lineups, sort = pick score / wait / rating / replay, count
badge "17 lineups"). = the shelf LIVES as the mode of deliberate choice.
Dead: the fixed top-N shelf. Grey rule restated: 6-7 = wait; 5-6 = one card
+ suggest-a-face; <=4 = "let people rest" + tell the host how many are
coming off. First game of the night = the pool-sorted card (dupr-in-score
variant) with the reveal legend.


## Brainstorm v5 — the walk + the cuts (2026-11-03)
- Level term = w:1 (Frank: "highest dupr 4.5 starts at -4.5"). Verified by
 walking game 1: lock #1 (-4.5) -> #2 wins (tax 1, level -4.4 = -3.4) ->
 trio avg 4.4 -> #4 wins -> court 1 = players 1-2-3-4 = the standard look.
 After game 1 the x10 queue constant takes over = the fairness engine.
- Rematch = GRADED (the binary flag floods in mid pools, Frank's catch):
 -6 if the candidate is the SAME PAIR as the locked unit's last opponent
 unit (rare, strong) + -2 per repeated face from the last 2 games (mild,
 spreads the court around). Count, not flag = flood-proof.
- CHOICE BOARD CUT (Frank): simultaneous frees = every free court gets its
 lineup instantly (the lock-sequence runs per court: A gets the pick for
 the longest-waiter, B for the next). One card + why + claim per court.
 The shelf dies (again) = simplification.
- Greedy sequential = accepted ("the 1st 4 tailored to the guy waiting
 longest" = the lock rule). No global batch optimizer.
- STORAGE (Frank's concern): row-per-game = SessionRound-as-game (game
 counter in roundNumber). "load session then rounds" = "load session then
 its games"; 50 rows = trivial; the by-court UI never says "round"; game
 log = the view. Serves the v2 player-queries ("my games tonight" = a
 query, not a blob parse). Escape hatch: rename/`kind` migration later if
 the semantics itch. Rejected: one massive games Json on Session (edit =
 rewrite-the-blob, no player queries).


## Brainstorm v6 — formula clarities (2026-11-03)
- The cost curve = the two knobs already: gameCost = 7.5 + 0.25 * minutes
 (5m -> 8.75, 10m -> 10, 20m -> 12.5, Frank's numbers). No damping term.
- courtDuprClose = 10 (per DUPR point from the forming average).
- Dup last = +2 PER PAIR, counted as the court fills: a candidate scores +2
 for each already-locked player who shared the candidate's own previous
 game ("previous game" = each player's last game). At the 4th pick a
 candidate can carry up to +6. (Frank: "on adding the 3rd/4th player or?"
 = yes, it accrues per locked face.)
- Pairs form after the pick (Frank, confirmed): court = 4 individuals,
 default split 1+4 vs 2+3 (sorted), swaps free. Dup-last therefore scores
 FACE pairs, and the recorded teams only matter for history/standings.
- Sit credit units = sitRatio * (courts / activePlayers) * gameBase
 (same point-scale as everything else; e.g. 24p/6c: 0.9 * 0.25 * 7.5 =
 1.7 pts vs a game's 7.5-12.5).

## v7 — late joiners (Frank 2026-11-03)
A joiner's pre-join time = sit time: they enter with CREDITED CYCLES
(cycles missed before joining), paid at the same sit rate
0.9 * (courts/players) * gameBase per cycle. CreditedCycles = sits +
missed-cycles = ONE variable in the score. After ~5 cycles they arrive ~1
game behind the pool = play once, then level.

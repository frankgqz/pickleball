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
- Wait time outranks fairness when the two conflict.
- Odd unit out = byes with highest priority next pick (longest wait wins).

## Surface (day 2)
- CourtsPanel: freed court shows a "next up" ghost card (the pairing + why).
- Settings: "by Court (coming soon)" -> live.
- Scores feed the same standings (DUPR badges ride).
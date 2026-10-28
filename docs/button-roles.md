# Button colors — the role pass (opinion · 2026-10-28 · no code yet)

**Verdict: buttons take their color from the theme's accents through THREE roles
(Primary / Quiet / Tint) plus one theme-independent red Danger — warnings all
red, no third accent needed. The status colors (purple team-1, green win, orange
byes, yellow missing-DUPR) stay exactly as they are. Try it with the current
accents first, as Frank said — tune accents only if it feels off after.**

## The law that settles it: actions are chrome, status is fact

The theme law from the Tier-3 work already splits the world in two:

- **Chrome** (panels, borders, text, radii — and now *action buttons*) follows
  theme variables. Buttons are things you PRESS = personality territory.
- **Semantic status** (green = win/submit-mark, red = loss/delete-mark,
  purple = team-1, orange = byes, yellow = missing-DUPR) is theme-independent —
  a win is a fact, not a vibe. It must read the same in every theme.

Today's "purple/red/green everywhere" is exactly the leak between the layers:
the pair button borrows team-1's purple, Submit borrows win-green. Pulling
buttons onto theme accents doesn't fight the law — it *restores* it. This is
also why the theme repo's accent colors probably DON'T need changing.

## The role set — 3 roles + danger

| Role | Source | Treatment | Buttons |
|---|---|---|---|
| **Primary** | accent (c5→c6, the skeu pill) | filled gradient + glow | Start · Submit · Save |
| **Quiet** | panel / border / text | ghost — no fill, just border+text | CSV · Hide · Rename · Edit |
| **Tint** | accent-2 (c6) | soft fill or soft outline | + add · ⚭ pair · DUPR sync |
| **Danger** | `--theme-error` red (semantic) | **solid = hard**, **outline = soft** | Restart/Reset (solid) · Cancel · Regen · End (outline) |

Frank's "2 neutral meanings (purple / green)" lands as **Quiet vs Tint** —
two neutral personalities (bare vs theme-tinted), zero new hues.

## The two questions, answered

**Maybe a 3rd accent in the theme (2 neutral + 1 warning)?** — **No.** A color
that needs a legend is too clever (Frank's own naming law). c5 + c6 already
carry the two neutral personalities and c7 the sparkle; a third accent would
become the orphan "what's that one for?" The nuance lives in *treatment*
(filled / tinted / ghost / outlined), which the states ladder already proves
can carry meaning. The 7-primitive palette stays 7.

**Warnings — all red?** — **Yes.** One red family, weight carries the
severity: solid fill = "this destroys state" (Restart/Reset), outline =
"this discards work" (Cancel/Regen/End). A separate amber warning would add a
5th role to a club-night tool — busy for busy's sake. The red is semantic
(theme-independent) so it keeps its warning meaning in every theme.

## What changes where (when we build it)

- **Theme repo:** possibly nothing for v1. The one candidate change is
  *treatment*, not color: graduate the gqz skeu button into the theme as the
  Primary role so every app shares the pill (it's chrome = theme territory).
- **Pickleball:** a role layer mapping the button inventory onto the four
  roles. The courts-panel compact buttons (h-7/xs) inherit the same roles at
  dense scale.
- **Status marks, team boxes, bye rows:** zero changes.

## Fork (one)

Roles as pickleball-local tokens first (same pattern as skeu: one app proves
it, then graduate to the theme) vs theme-first. **Pick: pickleball-local
first.** The theme stays stable while the roles get judged on a real screen.

---

# Part 2 — status colors & the full sourcing law (2026-10-28, discussion)

**Verdict: team-1/team-2 become the theme's accent pair (purple/green die);
Quiet buttons become themed ghosts (no gray); byes go quiet; missing-DUPR joins
the red-warning family; win/loss keep green/red as the one pinned fact-pair
(fork below). The accents stop playing minor roles — they become the team
identity. No third color; the palette stays 7.**

## The correction this part fixes

"Purple/green vibe" = the TEAM BOXES on the court cards (team-1 purple,
team-2 green), not the buttons — team-2 green also colliding with
win-green and submit-green is exactly the leak.

## Slot sourcing (the full table)

| Slot | Today | v2 source |
|---|---|---|
| team-1 box | purple | **accent (c5)** |
| team-2 box | green | **accent-2 (c6)** |
| buttons (Primary/Quiet/Tint) | mixed | theme roles (Part 1; Quiet = themed ghost, not gray) |
| win mark | green | green (pinned — the fork) |
| loss mark | red | red (pinned) |
| danger buttons | red | red (pinned) |
| bye row | orange | quiet (the ⏳ icon carries it) |
| missing-DUPR nameplate | yellow | red-warning tint (it IS a warning) |

Per-theme team pairs: wood tan/amber · night orange/neon-blue · bubble
pink/sky · onsen clay/moss. Treatment separates roles that share a hue:
team boxes = soft tint, primary button = solid skeu pill.

## The one pin and the one fork

**Pin: red.** Danger + loss + missing-warning = the only semantic hue left.
Red's alarm is pre-verbal; every other hue earns its place from the theme.

**Fork — win marks:** (a) keep green/red as the fact-pair [pick] or (b) theme
the win as the sparkle hue with red pinned alone. Pick (a) until the themed
version is seen on screen; (b) is a one-line change if the green nags.

---

# Part 3 — settled spec, pre-build (2026-10-28)

**Verdict: one voice, three volumes — Quiet is Primary's family with the knob
at 2 (accent 14% flat wash, 32% border, no shadow). Fork resolved (Frank):
win/loss/delete on the standings stay green/red. Pinned set is final: red
(danger/loss/delete/missing-warning) + the green/red win-loss pair; everything
else themed. This is buildable as-is.**

## Quiet = "primary, volume 2" (the exact recipe)

| Token | Value |
|---|---|
| fill | `color-mix(in srgb, var(--c5) 14%, var(--theme-panel))` — flat, no gradient |
| border | 1px `color-mix(in srgb, var(--c5) 32%, transparent)` |
| hover | border deepens to 55% mix; fill to 20%; ladder lift, no glow |
| press | the ladder dip (free from Tier-3) |
| text | `var(--theme-text)` at full legibility |

Gradient + glow stay Primary-only: they are the "physical object" cue the
skeu reel taught; Quiet keeps the pill shape (family) and drops the
physicality (volume).

## Final weight ladder

Quiet (accent 14% wash) < Tint (accent-2 22% wash) < Primary (skeu pill) —
three volumes of one family; Danger (red) sits outside it.

## Pinned vs themed — final

- Pinned: green/red win-loss + delete marks (standings) · red danger family
  (incl. missing-DUPR warning tint).
- Themed: team-1 (accent) / team-2 (accent-2) boxes · Primary/Quiet/Tint
  buttons · byes go quiet (⏳ carries it).

## Build order (when Frank says go)

1. team-box recolor (the vibe fix) — judge on the court cards first
2. Quiet/Tint button washes (settings + courts panel compact scale)
3. byes quiet + missing-DUPR red-warning tint
4. docs committed alongside the implementation

## Pickle Sessions

### Matching settings
Options to sort matches by seed, by partner repeat avoidance
Venn-Pool, Top pool, shared pool, bottom pool. 
Fixed partner, Singles, Pool play bracket system options
Handle game Scores (best of 3) - UI ready, logic not wired

### Login System
Session panel, UI - better layout, End session button. Delete session. Continue Session. 

### Player Persepctive
User has duprNumID entry field
Feature to look up player and see their past games

### Database

### Design
Mobile responsive design
Mobile standings table visibility
View of matches in viewport able to be cast onto bigscreen. fit nicely
Some fields are not using theme improts, so light grey on white happening.

### Misc 
For user, it should say duprURL# by default in the box instead of duprNumericID
Feature to sort player in user’s playerdatabase, to the more frequent joiners
Searching dupr, should update their dupr in event pool also

# Check

### Clean up / Refactor
MatcheEngine logic, The bye logic (getByeTotal, getSeedTotal, generateMatches) is dense and has duplicated computations. The byeBase/byeTotal distinction is hard to follow, especially "sitBonus" "sitOutCount." consistent variable names.
 ainApp.tsx, RoundHistoryPanel bulky
Actions.ts bulky

### Current - immmediate
gqz rename ritual (dark/sky -> night/bubble at its npm update)

### Done (2026-10)
- ✓ Session rename UI in settings panel + app renamed to Pickle Sessions +
  all form fields themed (light-grey-on-white fix) — 2026-10-07
- ✓ SessionRound DB: deleting a round now deletes the DB row, gap-safe
  numbering (was: stale rows + save collisions) — 2026-10-07
- ✓ Theme button, 4 themes from the gqz.app cookie (wood/night/bubble/matcha,
  legacy values mapped) — 2026-10-06
- ✓ Shadows, curved edges, pastel theme (per-theme radius + shadows via the
  tiered theme system) — 2026-10-06
- ✓ Implement themes / move files to theme repo (7 primitives -> derived
  semantics, see theme/AGENTS.md) — 2026-10-06

  
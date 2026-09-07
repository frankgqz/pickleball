## Pickleball Event Organiser

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
sessionround db, is 1 less round than loading the round in UI.  when deleting round the round still exists in SessionRound db.

### Design
Mobile responsive design
Mobile standings table visibility
Shadows, curved edge, pastel theme
Theme button, 4 themes originating from gqz.app cookie
View of matches in viewport able to be cast onto bigscreen. fit nicely 

### Misc 
For user, it should say duprURL# by default in the box instead of duprNumericID
Feature to sort player in user’s playerdatabase, to the more frequent joiners
Searching dupr, should update their dupr in event pool also

# Check
deleting  round deletes round from DB?

### Clean up / Refactor
MatcheEngine logic, The bye logic (getByeTotal, getSeedTotal, generateMatches) is dense and has duplicated computations. The byeBase/byeTotal distinction is hard to follow, especially "sitBonus" "sitOutCount." consistent variable names.
 ainApp.tsx, RoundHistoryPanel bulky
Actions.ts bulky

### Current - immmediate
Implement themes
 
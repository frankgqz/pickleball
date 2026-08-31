## Pickleball Event Organiser

### Matching settings
Options to sort matches by seed, by partner repeat avoidance
Venn-Pool, Top pool, shared pool, bottom pool. 
Fixed partner, Singles, Pool play bracket system options
Handle game Scores (best of 3) - UI ready, logic not wired


### Login System
Add duprNumID to user - to allow player perspective

Join a Session
[Store, View and Edit past sessions
]{.mark}View on Standings Table
Continue a Session?
Database restructure
    Event
        config json - CSV impacting
                    - Non CSV impacting
        playerIDs json
    Rounds
        id, sessionID , round, date
        format json
        matches IDs & scores
        sitting out json array

End event.

### Player Persepctive
Feature to look up player and see their past games
Log in add dupr account, find all games involved in
User's duprNumID

### Player Database
Feature to sort player in user’s playerdatabase, to the more frequent joiners

### Design
Mobile responsive design
Mobile standings table visibility
Shadows, curved edge, pastel theme
Theme button, 4 themes originating from gqz.app cookie

### Misc 
for user, it should say duprURL# by default in the box instead of duprNumericID
 
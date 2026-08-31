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
View of matches in viewport able to be shared on a screen. fit nicely 


### Misc 
for user, it should say duprURL# by default in the box instead of duprNumericID
searching dupr, should update their dupr in event pool

### Current - immmediate
when I log into google, it pulls the matches, doesn't populate players into eventpool, I can't add from playerdatabase, 
when I shift between past rounds, names are all squiggly (like their ID instead of name), I think because eventpool is empty?
it's missing a load session dropdown
missing end session button - I want this in the pastrounds section. I'm also cognizant this file is getting big. 
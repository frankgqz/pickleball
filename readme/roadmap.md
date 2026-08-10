# Pickleball Event Manager

### Matching settings
Options to sort matches by seed, by partner repeat avoidance
Fixed partner and Pool play bracket system options

## Planned Features
Partner variety scoring, rally or sideout
Handle game scores (best of 3)
Mobile responsive design
Scorevalidation upon round submit (warning if over 99, or under 0)

## Login System
Login system, to differentiate player pool, access past sessions, save sessions
Database retains global player pool to autofill players with same duprID or numericID. So despite differnt login still autofills.

For now (quick development):
Use localStorage for round history (survives page refresh) Keep player pool in state (quick to work with) 
Later (when login is added):
Migrate to database tables, users table for login, some kind of key, and store session data somehow.

## Known Issues

 
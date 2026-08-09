# Pickleball Tournament Manager - Roadmap

### CSV Import/Export
Parse into DUPR format
DUPR CSV format requires: playerA1DuprId, playerB1DuprId, teamAGame1, teamBGame1, etc.

### Matching settings
Gauntlet style 
Options to sort by partner repeat avoidance, by even dupr, even dupr by band, top vs low seed, deselect anytime
fixed partner and settings changes
Pool play bracket system

## Planned Features
Partner variety scoring, rally or sideout
Handle game scores (best of 3)
Mobile responsive design

## Login System
Login system, to differentiate player pool, access records
maybe retain global player pool to duprID, numericID autofill

For now (quick development):
Use localStorage for round history (survives page refresh) Keep player pool in state (quick to work with) 
Later (when login is added):
Migrate to database tables, users table for login, players table with userId foreign key, rounds table with userId and player relationships

## Known Issues
- [ ] Pts% sort edge case (player with sit outs)
- [ ] Tooltip showing incorrect court label




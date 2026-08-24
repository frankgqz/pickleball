260808

	Built and managed with Node.js, Neon, Prisma and Vercel
    Initialized the Pickleball Event Manager and moved toward a componentized UI: SettingsPanel, PlayerDatabase, EventPool, CourtsPanel, StandingsTable, and RoundHistoryPanel.
	Centralized types in a shared Types.ts and split heavy logic into MatchEngine.ts and standingsUtils.ts to keep page.tsx small and focused.
    Implemented seed/bye derived values (seedTotal and byeTotal) and added first‑round bye regeneration so byeBase is calculated before Round‑1 match generation.
    Built round generation for Standard matches
    Added editable past rounds: you can view, edit matchups and scores, save edits, and the app will replay rounds to recompute standings.

260809

    Fixed a major performance issue by batching standings replay updates into a single setStandings call (avoids dozens of re-renders when editing/deleting rounds).
    Added CSV export of rounds (doubles, SIDEOUT format) with event/round naming and YYYY‑MM‑DD dates; export is session-aware.
    Restored the compact PlayerDatabase visual design, kept a mobile-first stacked layout, and implemented CSS-initials avatars with DUPR avatar fallback.
    Integrated DUPR API lookup (login → token) and saved duprScore and imageUrl to the DB when available; fetch feedback was added to the UI.
    Persisted players, eventPool, standings, rounds, and session metadata in localStorage; added sessionId so standings/rounds are isolated per session.
    Improved UX: responsive tables, sortable columns (including Win%), color-coded match and bye displays, and compact desktop rows with scrollable lists.
    Concentrated the PlayerDatabase markup to one desktop row per player; moved the +Add button inline and trimmed vertical padding for a tighter UI.
    Fixed first‑round bye timing: byeBase is regenerated before match generation so bye bonuses apply correctly and double‑byes were avoided.
    Added the hourglass “no-bye” control in the bye list that increments byeMod by 0.25 and re-generates matchups immediately.
    Ensured round edits now replay entirely but apply updates in one batched setStandings call to eliminate re-render storms.
    Persisted eventPool to localStorage and reduced player list height (scrollable on desktop) for a compact dashboard experience.
    Kept the code split: MatchEngine and standingsUtils hold core logic, while page.tsx and compact components handle UI and state orchestration.

260810

    Refactored app/page.tsx by extracting state and logic into focused hooks (useEventSession, usePlayerDatabase, useStandingsState, useMatchGeneration, useLocalStorage) to shorten the page and improve maintainability.
    Centralized standings and match logic into utilities (standingsUtils) and restored a full-featured StandingsTable with sortable columns and touch-friendly scrolling.
    Added separate fields for manual vs API DUPR: manualDuprScore (manual entry) and duprScore (API), plus lastRefreshed to track when a DUPR fetch occurred.
    Implemented a per-event setting defaultDupr (default 2.5) and used it as the effective DUPR for sorting/seed calculations when no rating exists.
    Restored and reordered standings columns to the requested layout (W, L, Win%, PF, PA, +/-, Pts%, Byes, Bye, DUPR, Order#) and made every column sortable.
    Display rules: show API DUPR (3 decimals) when present, manual DUPR (1 decimal) when manually entered, otherwise show “—” while treating value as defaultDupr for sorting.
    Change score-entry behavior: inputs accept any numeric typing (including negatives) and no longer block typing; validation (score < 0 or > 99) now runs at submit time and visually flags invalid matches rather than interrupting input.
    Submission logic changed so only matches with both numeric scores are processed (prevents accidental 0–0 double-loss), and invalid matches are highlighted and reported at submit.
    UI improvements: PlayerDatabase and EventPool aligned and compacted (white backgrounds, light borders, consistent row heights), EventPool capped height, Clear All button styled, and RoundHistory select width constrained to avoid blocking horizontal scrolling on mobile.
    Fixed add/edit player flows and server actions: addPlayer/updatePlayer now use FormData, add auto-adds new players to the pool, DUPR fetch updates duprScore and lastRefreshed (without overwriting manualDuprScore), and Prisma schema was updated to include the new fields (manualDuprScore, lastRefreshed).

260825

    Restructured DB schema: Players → ClubPlayers — Players are now global (no userId), associations stored in a separate ClubPlayer join table so players can be shared across users.
    Replaced global player queries with club-scoped queries — getPlayers(userId) replaced with getClubPlayers(userId) to fetch only the current user's roster.
    Split player deletion into two modes — Global deletePlayer (hard delete) vs. removeClubPlayer (soft remove from roster only), passed to PlayerDatabase via onRemoveFromClubRoster.
    Added player list refresh after roster removal — onRefreshPlayers callback wired through PlayerDatabase so the list reflects DB changes immediately after removing a player from the club roster.
    Removed dead imports in MainApp.tsx — Cleaned up 6 unused server actions (addPlayer, getClubPlayers, deletePlayer, fetchDuprRating, updatePlayer, addClubPlayer) that were replaced by hook-based logic.
    Added CSV export settings to TournamentConfig — New fields matchType (D/S), scoreType (SIDEOUT/RALLY), bestOf (1/3/5) added to Types for tournament metadata.
    Fixed CSV export showing duprNumericId. And improved CSV settings UI. 
    Planned session persistence architecture — Designed 2-table DB schema (EventSession, SessionRound) for saving/loading complete tournaments with matches, standings, and config (pending implementation).
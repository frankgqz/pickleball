260814


	Built and managed with Node.js, Neon, Prisma and Vercel
    Initialized the Pickleball Event Manager and moved toward a componentized UI: SettingsPanel, PlayerDatabase, EventPool, CourtsPanel, StandingsTable, and RoundHistoryPanel.
	Centralized types in a shared Types.ts and split heavy logic into MatchEngine.ts and standingsUtils.ts to keep page.tsx small and focused.
    Implemented seed/bye derived values (seedTotal and byeTotal) and added first‑round bye regeneration so byeBase is calculated before Round‑1 match generation.
    Built round generation for Standard matches
    Added editable past rounds: you can view, edit matchups and scores, save edits, and the app will replay rounds to recompute standings.

260815

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
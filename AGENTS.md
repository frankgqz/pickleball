# AGENTS.md — pickleball (Pickleball Event Manager)

Frank's tournament manager for the RMIT Thursdays meetup. Repo:
github.com/frankgqz/pickleball · live: pickleball.gqz.app (Vercel auto-deploys
main). Dev copy: C:\Code\craft\pickleball.

## Stack
Next.js 16.3 (Turbopack) + React 19 + Tailwind 4 · Prisma 7 → Neon Postgres ·
next-auth Google OAuth · server actions `app/actions.ts` · state hooks
`components/hooks/` · 6 panels in `components/` · schema `prisma/schema.prisma`
(Player global · ClubPlayer roster · Session · SessionRound).

## ! Load-bearing mechanics
- ! Theme comes from the shared repo `frankgqz/theme`, curl-synced into
  `app/theme*` + ThemeProvider/ThemeToggle/useTheme/storage on every
  `npm install` (postinstall `app/scripts/sync-theme.js`). Never bare
  `npm install` while the theme repo has unpushed changes — it overwrites
  `app/theme*` from GitHub main. Use `--ignore-scripts` meanwhile.
- ! `node_modules` natives (lightningcss, @tailwindcss/oxide) are
  platform-specific: installs from the Linux container prune the Windows
  ones and vice versa (EBADPLATFORM blocks cross-installs). Run `npm install`
  only from Windows.
- ! Push order: `frankgqz/theme` FIRST, then this repo — the Vercel build
  curls theme from GitHub main at install time.
- ! Round deletion keeps number gaps (no renumbering): `unique(sessionId,
  roundNumber)` + DUPR CSV audit trail labels ("Event - Round N").
  `currentRoundNumber` = max+1, not length+1.

## Conventions
- Verify with `npm run build` (runs prisma generate + next build incl. TS).
- Container git shows phantom ` M` on CRLF files — reality check:
  `git diff --ignore-cr-at-eol`.
- DUPR: letter ID = match-upload key, numeric ID = API key (unofficial
  api.dupr.gg); CSV export D / SIDEOUT / YYYY-MM-DD, all 4 players named.
- Yellow nameplate = missing DUPR ID / webNumericID (blocks export matching)
  — deliberate, keep.
- Backlog `docs/roadmap.md` · history `docs/changelog.md`.
- ? `updateSession` / `getSession` actions added 2026-10-07 — UI wiring
  (session rename) still pending.
- -> Next on roadmap: best-of-3 score logic, pool-play formats, mobile
  standings; gqz rename sync (see theme/AGENTS.md).

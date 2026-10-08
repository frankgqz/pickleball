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
- Backlog `roadmap.md` at the repo root (Frank's async task queue — he edits
  it directly from his phone; re-read it at session start, patch never
  rewrite) · history: `git log`.
- ✓ Session rename UI wired in SettingsPanel (updateSession + refreshKey);
  app named "Pickle Sessions"; all form fields themed — 2026-10-07.
- -> Next on roadmap: best-of-3 score logic, pool-play formats, mobile
  standings; gqz rename sync (see theme/AGENTS.md).

## State & persistence (verified 2026-10-07)
- localStorage (device-local, works logged out AND in): config, players,
  event pool, completed rounds, session metadata, standings, AND the
  in-progress roundState (typed scores survive refresh/leave).
- DB (Neon, logged in only): Session + SessionRound rows — written on
  session create + round submit. "Load Sessions" reads the DB (cross-device).
- Session lifecycle: End = sets isEnded (view stays loaded); ended sessions
  gate Start/Submit/Next (CourtsPanel `sessionEnded` prop — MainApp wires it);
  Continue Session reopens. New session + Restart reset the flag.

## DUPR authentication (2026-10-08) — solved, do not re-break
DUPR enforces email/TOTP 2FA on ALL accounts — silent password login is dead.
The working path = TOTP ritual (`tools/dupr-auth.ts`): login -> challenge ->
code generated from `DUPR_TOTP_SECRET` (RFC 6238 SHA1/6/30) -> `POST
https://api.dupr.com/auth/v1.0/2fa/verify` (no trailing slash!) with body
`{challengeToken, code, method: {type: "urn:dupr:second-factor:totp"}}` (method
is an OBJECT) + header `x-dupr-client-capabilities: totp,webauthn`. Response
mints `__Host-dupr_at` (30d) + `__Host-dupr_rt` (90d) cookies — the API wants
them as a Cookie header (Bearer fails with 401). Tokens persist in the
`AuthState` DB table (production reads it — no Vercel env copies) + `.env`.
Cron `DUPR token renewal` (394beb434fbd, daily 4am, no_agent script
`tools/dupr-renew.sh` in HERMES_HOME/scripts) reruns the ritual when the token
has <7 days left; failures -> Telegram. `npm run dupr:auth -- --force` renews
manually. Challenge tokens expire in 5 minutes. Player lookups need modern
"bit 33" duprNumericIds (10-digit); responses carry `fullName`.

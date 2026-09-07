/app

├── page.tsx              ← Main orchestrator

├── actions.ts            ← Server actions (addPlayer, fetchDupr, etc.)

└── layout.tsx



/components

├── CourtsPanel.tsx       ← Match display, score entry

├── EventsPool.tsx        ← Player pool management

├── PlayerDatabase.tsx    ← Player CRUD + DUPR fetch

├── RoundHistoryPanel.tsx ← Past rounds, CSV export

├── StandingsTable.tsx    ← Standings display

├── SettingsPanel.tsx     ← Event config

├── MatchEngine.ts        ← Match generation logic

├── standingsUtils.ts     ← Standings calculations

├── types.ts              ← TypeScript interfaces

├── useAsync.ts           ← Async hooks

└── hooks/

        ├── useEventSession.ts

        ├── useLocalStorage.ts

        ├── usePlayerDatabase.ts

        ├── useMatchGeneration.ts

        └── useStandingsState.ts



/prisma

└── schema.prisma




##  Your Full-Stack

| Layer           | Tech                             | Status                                      |
| --------------- | -------------------------------- | ------------------------------------------- |
| Frontend        | Next.js + React + Tailwind       | ✅ Correct                                   |
| Backend         | Next.js Server Actions (Node.js) | ✅ Correct                                   |
| Database        | PostgreSQL (Neon)                | ✅ Correct — you're using Neon, not Supabase |
| ORM             | Prisma                           | ✅ Correct                                   |
| Hosting         | Vercel                           | ✅ Correct                                   |
| Domain/DNS      | Cloudflare                       | ✅ Correct                                   |
| Version Control | GitHub                           | ✅ Correct                                   |
| Styling         | Tailwind CSS                     | ✅ Correct                                   |


# CLAUDE.md

Context for AI agents (Claude Code and others) working in this repository.

## What this project is

DuoCards — a flashcard web app for learning languages. Users create flashcard
sets (manually or AI-generated), practice with flip cards, share sets via
public codes / a public library, and play live multiplayer sessions.

## Related repositories (same GitHub account: danicek555)

| Repository   | Relationship                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `duocards`   | This repository. Standalone app; no code dependency on the other two.                               |
| `vibecoding` | Umbrella collection of small projects; each project lives in its own subfolder (`web/`, `sk-mop-rekordy/`, `globe-map/`). |
| `globe-map`  | Standalone repo for the 3D travel globe (React + Vite + Three.js, deployed to Netlify). A copy also lives inside `vibecoding/globe-map/`. |

There are no cross-references between `duocards` and the other repos — treat
them as independent projects.

## Stack

- Next.js 15 (App Router) + React 19, TypeScript, Tailwind CSS 4
- Prisma 7 + PostgreSQL (Prisma Accelerate in dev, Google Cloud SQL in prod)
- Ably (realtime live games), Resend (e-mail), OpenAI API (AI generation), Sentry
- Deployed via Vercel (previews per branch) and Google Cloud Run

## Layout

```
docs/       All project documentation (setup, deployment, ROADMAP.md)
prisma/     schema.prisma + migrations
scripts/    Helper scripts (check-users.ts, check_users.sql, start-cloud-sql-proxy.sh)
src/app/    Routes; API endpoints under src/app/api/**/route.ts
src/components/  Reusable client components
src/lib/    Server utilities (auth, prisma client, rate limiting, coins)
```

Key pages: `/dashboard` (main UI — left nav + right content area switched by
`viewMode`: sets / cards / library / liveHistory), `/live-game` (realtime
rooms), `/library` and `/live-game/history` (redirect into dashboard views).

## Commands

```bash
npm run dev              # dev server
npm run build            # prisma generate + next build
npm run lint             # eslint
npx prisma migrate dev   # create + apply migration (dev)
npx prisma migrate deploy# apply migrations (prod/CI)
npm run check-users      # list users in DB
```

## Conventions

- **API auth pattern:** every protected route reads the `auth` cookie and
  verifies it with `verifyAuthToken` from `src/lib/auth.ts`, then usually
  confirms the user exists. Follow the existing routes in
  `src/app/api/flashcard-sets/` as templates.
- **Prisma access:** use the singleton `prisma` from `src/lib/prisma.ts`
  (`prismaDirect` for large image/audio payloads). Existing code casts models
  to `any` (`(prisma as any).model...`) where the generated client types lag —
  keep that style for consistency.
- **Dynamic route params are async:** `{ params }: { params: Promise<{ id: string }> }`
  and `const { id } = await params;`.
- **UI:** Tailwind utility classes with dark-mode variants (`dark:`) on
  everything; follow the visual patterns in `src/app/dashboard/page.tsx`.
- **Migrations:** add a folder under `prisma/migrations/<timestamp>_<name>/`
  with `migration.sql` AND update `prisma/schema.prisma` together.
- **Limits to respect:** max 100 sets per user, max 5 tags per set, coins
  economy lives in `src/lib/coins.ts` / `coin-costs.ts`.

## Documentation

Human-facing guides are in `docs/` (see `docs/ROADMAP.md` for the prioritized
feature roadmap and `docs/DEVELOPMENT_WORKFLOW.md` for the dev loop). Update
`README.md` links when adding new docs.

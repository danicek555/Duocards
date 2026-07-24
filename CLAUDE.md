# CLAUDE.md

Context for AI agents (Claude Code and others) working in this repository.

**Canonical agent rules live in [`docs/AGENTS.md`](docs/AGENTS.md)** (linked
from the root `AGENTS.md`) — read and follow them before changing code. This
file only adds a map of how the repositories relate and where to find things.

## What this project is

DuoCards — a flashcard app for learning languages. Users create flashcard sets
(manually or AI-generated), practice with flip cards, share sets via public
codes / a public library, and play live multiplayer sessions.

## How the repositories are linked

DuoCards is split into three separately deployable parts sharing one
PostgreSQL database and one versioned API contract:

```text
web (Next.js) ----\
                  >---- backend (Fastify /api/v1) ---- PostgreSQL
iOS (SwiftUI) ----/
```

| Repository                  | Role                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `danicek555/duocards`       | This repo: the Next.js web app + a local copy of the Fastify backend (`backend/`) + shared API contract (`contracts/`). |
| `danicek555/duocards-backend` | Production Fastify backend (deployed to Cloud Run).                                     |
| `danicek555/duocards-ios`   | Native iOS app (SwiftUI).                                                                 |

When Cloud Run is on, the web proxies `/shared-api` to the deployed backend;
when it is off or unavailable, the web falls back to its own built-in Next.js
`/api` routes. See `README.md` and
`backend/docs/CLOUD_RUN_AND_LOCAL_BACKEND.md` for the full runtime description.

Unrelated personal projects under the same account (no code relationship to
DuoCards): `danicek555/vibecoding` (umbrella collection of small projects;
contains a copy of `globe-map/` as a subfolder) and `danicek555/globe-map`
(standalone 3D travel globe, React + Vite + Three.js).

## Where to find things

```
backend/    Local Fastify + TypeScript + Prisma backend
contracts/  Versioned API contract shared by web, backend and iOS
docs/       All documentation (AGENTS.md, ARCHITECTURE.md, DEVELOPMENT.md,
            DESIGN_SYSTEM.md, LOCALIZATION.md, setup + deployment guides,
            ROADMAP.md, LIVE_GAME_PRODUCT_PLAN.md, STORY_MODE_PLAN.md)
prisma/     Database schema + migrations for the web/Vercel fallback
scripts/    Maintenance and helper scripts
src/        Next.js web app (app router, components, lib, i18n)
```

## Key documents

- [`docs/AGENTS.md`](docs/AGENTS.md) — binding rules for agents (architecture
  boundaries, i18n requirements, accessibility, safe DB practices)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — architecture and data flows
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) — local development and checks
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — prioritized feature roadmap
- [`README.md`](README.md) — how to run the whole vertical locally

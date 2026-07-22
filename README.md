# DuoCards

Flashcard app for learning languages. Create your own sets (or let AI generate them), practice with flip cards, share sets through public codes, and play live multiplayer sessions with friends.

Built with [Next.js](https://nextjs.org) (App Router), [Prisma](https://www.prisma.io) + PostgreSQL, Tailwind CSS, [Ably](https://ably.com) (live games) and the OpenAI API (AI generation).

## Getting Started

```bash
# install dependencies
npm install

# run database migrations and generate the Prisma client
npx prisma migrate deploy
npx prisma generate

# start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Environment variables are documented in [`docs/ENVIRONMENT_SETUP.md`](docs/ENVIRONMENT_SETUP.md) and [`.env.example`](.env.example).

## Useful Scripts

| Command                   | Purpose                                    |
| ------------------------- | ------------------------------------------ |
| `npm run dev`             | Start the dev server                       |
| `npm run build`           | Production build (with `prisma generate`)  |
| `npm run lint`            | Run ESLint                                 |
| `npm run check-users`     | List users in the database                 |
| `npm run check-ai-health` | Verify AI endpoints are working            |

Helper scripts (SQL snippets, Cloud SQL proxy launcher) live in [`scripts/`](scripts/).

## Project Structure

```
docs/       Project documentation (setup, deployment, roadmap)
prisma/     Database schema and migrations
public/     Static assets
scripts/    Maintenance and helper scripts
src/        Application code (app router, components, lib)
```

## Documentation

All guides live in [`docs/`](docs/):

### Setup

- [Environment setup](docs/ENVIRONMENT_SETUP.md) · [Env files explained](docs/ENV_FILES_EXPLAINED.md)
- [Database options](docs/DATABASE_OPTIONS.md) · [Database setup](docs/DATABASE_SETUP.md)
- [Authentication guide](docs/AUTHENTICATION_GUIDE.md)
- [Email setup (Resend)](docs/EMAIL_SETUP.md) · [Resend domain setup](docs/RESEND_DOMAIN_SETUP.md)
- [Docker](docs/DOCKER.md)

### Deployment

- [Pre-deployment checklist](docs/PRE_DEPLOYMENT_CHECKLIST.md)
- [Cloud SQL setup](docs/CLOUD_SQL_SETUP.md) · [Cloud SQL connection](docs/CLOUD_SQL_CONNECTION.md) · [Production Cloud SQL](docs/PRODUCTION_CLOUD_SQL_SETUP.md)
- [Cloud Run environment variables](docs/CLOUD_RUN_ENV_VARS.md)

### Development

- [Development workflow](docs/DEVELOPMENT_WORKFLOW.md)

### Product

- [Roadmap](docs/ROADMAP.md) · [Improvement ideas](docs/improvements.md)

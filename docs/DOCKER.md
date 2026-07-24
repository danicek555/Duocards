# Docker Setup for DuoCards

> Stav k 2026-07-24 (v1.0.0): platné pro lokální běh a vlastní hosting backendu.

This project includes Docker configuration for easy development and deployment.

## Prerequisites

- Docker and Docker Compose installed on your system

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=duocards
POSTGRES_PORT=5432

# Application
APP_PORT=3000

# Prisma (automatically set by docker-compose, but you can override)
PRISMA_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/duocards?schema=public
DIRECT_DATABASE_URL=postgresql://postgres:postgres@postgres:5432/duocards?schema=public

# Add your other required environment variables:
# OPENAI_API_KEY=your_openai_key
# RESEND_API_KEY=your_resend_key
# SENTRY_DSN=your_sentry_dsn
# NEXTAUTH_SECRET=your_secret
# NEXTAUTH_URL=http://localhost:3000
```

## Usage

### Development

1. Build and start all services with hot reload:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

2. Access the application at `http://localhost:3000`

   - Changes to your code will automatically reload
   - Database migrations run automatically on first start

3. To stop:

```bash
docker-compose -f docker-compose.dev.yml down
```

### Production

1. Build the production image:

```bash
docker-compose -f docker-compose.yml build
```

2. Start services:

```bash
docker-compose up -d
```

### Useful Commands

**Production:**

- View logs: `docker-compose logs -f`
- Stop services: `docker-compose down`
- Stop and remove volumes: `docker-compose down -v`
- Access database: `docker-compose exec postgres psql -U postgres -d duocards`
- Run Prisma Studio: `docker-compose exec app prisma studio`

**Development:**

- View logs: `docker-compose -f docker-compose.dev.yml logs -f`
- Stop services: `docker-compose -f docker-compose.dev.yml down`
- Stop and remove volumes: `docker-compose -f docker-compose.dev.yml down -v`
- Access database: `docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d duocards`
- Run Prisma Studio: `docker-compose -f docker-compose.dev.yml exec app npx prisma studio`

## Notes

- The database data is persisted in a Docker volume named `postgres_data`
- The app container waits for the database to be healthy before starting
- Migrations run automatically on container start

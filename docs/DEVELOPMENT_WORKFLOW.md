# Development Workflow Guide 🚀

> Stav k 2026-07-23 (v1.0.0): platné; rychlý přehled kontrol viz DEVELOPMENT.md.

## Quick Answer: npm run dev vs Docker?

**`npm run dev`:** Uses **cloud database** (Prisma Accelerate) - no Docker needed
**Docker:** Uses **local database** (Docker PostgreSQL) - isolated, faster for testing

---

## Recommended Development Setup

### Option 1: npm run dev (Recommended for Daily Development) ⚡

**Best for:** Fast iteration, quick changes, daily coding

**Database:** Uses **cloud database** (Prisma Accelerate) from `.env.development.local`

**Setup:**

```bash
# Just run this - no Docker needed!
npm run dev
```

**Pros:**

- ✅ Faster hot reload
- ✅ Better error messages
- ✅ Easier debugging
- ✅ Uses cloud database (no Docker needed)
- ✅ Faster startup time
- ✅ Works from anywhere (with internet)

**Cons:**

- ❌ Requires internet connection
- ❌ Slightly slower queries (network latency)

---

### Option 2: Docker (Full Stack) 🐳

**Best for:** Testing with local database, offline development, isolated testing

**Database:** Uses **local database** (Docker PostgreSQL) from `docker-compose.dev.yml`

**Setup:**

```bash
# Start everything (database + app)
docker-compose -f docker-compose.dev.yml up --build
```

**Pros:**

- ✅ Everything in one command
- ✅ Local database (no internet needed)
- ✅ Database migrations run automatically
- ✅ Consistent across team members
- ✅ Isolated environment
- ✅ Faster queries (local database)
- ✅ Easy to reset/wipe database

**Cons:**

- ❌ Slower startup
- ❌ More resource intensive
- ❌ Harder to debug (logs in containers)

---

## My Recommendation: Hybrid Approach 🎯

### Daily Development (90% of time)

```bash
# Uses cloud database - no Docker needed!
npm run dev
```

### Testing with Local Database

```bash
# Use Docker to test with local database
docker-compose -f docker-compose.dev.yml up --build
```

### Before Committing (Testing)

```bash
# Test production build locally (uses cloud database)
npm run build:prod
npm run start
```

### Before Deploying (Full Test)

```bash
# Use Docker to test production-like setup with local database
docker-compose -f docker-compose.dev.yml up --build
```

---

## Pre-Development Checklist (Simplified) ✅

**Run this BEFORE starting development each day:**

### 1. Check Database is Running

```bash
# Check if Docker database is running
docker ps | grep duocards-db-dev

# If not running, start it:
docker-compose -f docker-compose.dev.yml up -d postgres

# Verify it's healthy (wait ~10 seconds)
docker-compose -f docker-compose.dev.yml ps
```

### 2. Check Environment Variables

```bash
# Verify your .env files are set up correctly
cat .env.development.local | grep PRISMA_DATABASE_URL
# Should show: postgresql://postgres:postgres@localhost:5432/duocards
```

### 3. Run Migrations (if schema changed)

```bash
# If you changed Prisma schema, run migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 4. Start Development Server

```bash
npm run dev
```

**That's it!** 🎉

---

## Pre-Deployment Checklist (Before Going Live) 🚢

**This is DIFFERENT from daily development.** Run this BEFORE deploying to production:

### Quick Pre-Deployment Test

```bash
# 1. Lint check
npm run lint

# 2. Build production version
npm run build:prod

# 3. Test production build locally
npm run start
# Visit http://localhost:3000 and test everything

# 4. Check environment variables are set in Vercel/dashboard
# (See PRE_DEPLOYMENT_CHECKLIST.md for full list)
```

**Full checklist:** See `PRE_DEPLOYMENT_CHECKLIST.md` for complete list.

---

## Daily Development Workflow 📝

### Morning Routine (First Time)

```bash
# 1. Pull latest changes
git pull

# 2. Start database
docker-compose -f docker-compose.dev.yml up -d postgres

# 3. Install dependencies (if package.json changed)
npm install

# 4. Run migrations (if schema changed)
npx prisma migrate deploy
npx prisma generate

# 5. Start dev server
npm run dev
```

### During Development

- Make changes
- See hot reload automatically
- Test in browser
- Check console for errors

### Before Committing

```bash
# 1. Lint check
npm run lint

# 2. Test that it builds
npm run build

# 3. Commit
git add .
git commit -m "Your message"
```

### Before Pushing/Deploying

```bash
# 1. Full production build test
npm run build:prod
npm run start
# Test everything works

# 2. Push
git push
```

---

## Common Scenarios

### Scenario 1: Starting Fresh

```bash
# Start database
docker-compose -f docker-compose.dev.yml up -d postgres

# Wait for database to be ready (~10 seconds)

# Run migrations
npx prisma migrate deploy
npx prisma generate

# Start dev server
npm run dev
```

### Scenario 2: Database Connection Issues

```bash
# Check if database is running
docker ps | grep postgres

# Check database logs
docker-compose -f docker-compose.dev.yml logs postgres

# Restart database
docker-compose -f docker-compose.dev.yml restart postgres

# Verify connection
npx prisma db pull  # Should work if connected
```

### Scenario 3: Schema Changed

```bash
# Create migration
npx prisma migrate dev --name your_migration_name

# This automatically:
# - Creates migration file
# - Applies it to database
# - Generates Prisma Client
```

### Scenario 4: Reset Database (DANGER: Deletes all data!)

```bash
# Stop containers
docker-compose -f docker-compose.dev.yml down

# Remove volumes (deletes all data!)
docker-compose -f docker-compose.dev.yml down -v

# Start fresh
docker-compose -f docker-compose.dev.yml up -d postgres
npx prisma migrate deploy
```

---

## Environment Setup Summary

### Development (Local)

- **Database:** Docker PostgreSQL (`localhost:5432`)
- **App:** `npm run dev` (Next.js dev server)
- **Env File:** `.env.development.local` (highest priority)

### Production (Vercel)

- **Database:** Vercel Postgres or Prisma Accelerate
- **App:** Vercel automatically builds and deploys
- **Env Variables:** Set in Vercel dashboard

---

## Quick Reference Commands

### Database

```bash
# Start database
docker-compose -f docker-compose.dev.yml up -d postgres

# Stop database
docker-compose -f docker-compose.dev.yml down

# View database logs
docker-compose -f docker-compose.dev.yml logs -f postgres

# Access database CLI
docker-compose -f docker-compose.dev.yml exec postgres psql -U postgres -d duocards

# Run Prisma Studio (database GUI)
npx prisma studio
```

### Development

```bash
# Start dev server
npm run dev

# Build for production
npm run build:prod

# Test production build
npm run start

# Lint code
npm run lint
```

### Prisma

```bash
# Create and apply migration
npx prisma migrate dev

# Apply migrations (production)
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate

# Open database GUI
npx prisma studio

# Check users in database
npm run check-users
```

---

## Troubleshooting

### "Can't connect to database"

1. Check Docker is running: `docker ps`
2. Check database container: `docker ps | grep postgres`
3. Check `.env.development.local` has correct `PRISMA_DATABASE_URL`
4. Restart database: `docker-compose -f docker-compose.dev.yml restart postgres`

### "Port 3000 already in use"

```bash
# Find what's using port 3000
lsof -i :3000

# Kill it or use different port
PORT=3001 npm run dev
```

### "Prisma Client not generated"

```bash
npx prisma generate
```

### "Migration errors"

```bash
# Reset database (WARNING: deletes data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres
npx prisma migrate deploy
```

---

## Summary: What Should You Do?

### ✅ Daily Development

1. Run dev: `npm run dev` (uses cloud database)
2. Code and test

### ✅ Before Committing

1. `npm run lint`
2. `npm run build` (quick check)
3. Commit

### ✅ Before Deploying

1. Follow `PRE_DEPLOYMENT_CHECKLIST.md`
2. Test production build: `npm run build:prod && npm run start`
3. Deploy

**That's it!** Keep it simple for daily work, use full checklist only before deployment.

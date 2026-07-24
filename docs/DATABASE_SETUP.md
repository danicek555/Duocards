# Your Database Setup ✅

> Stav k 2026-07-24 (v1.0.0): platné; produkce běží na Prisma Postgres (db.prisma.io).

## Dual Database Setup 🎯

You have **two database options** configured:

### 1. Cloud Database (Prisma Accelerate) - For `npm run dev`

**Location:** `.env.development.local`

- `PRISMA_DATABASE_URL` - Prisma Accelerate connection (for queries)
- `DIRECT_DATABASE_URL` - Direct PostgreSQL connection (for migrations)

**When used:** When you run `npm run dev` locally

### 2. Local Database (Docker PostgreSQL) - For Docker

**Location:** `docker-compose.dev.yml` (environment variables)

- `PRISMA_DATABASE_URL` - Docker PostgreSQL connection
- `DIRECT_DATABASE_URL` - Docker PostgreSQL connection

**When used:** When you run `docker-compose -f docker-compose.dev.yml up`

---

## How It Works

### ✅ `npm run dev` → Cloud Database

```bash
npm run dev
```

**Uses:** `.env.development.local` → Prisma Accelerate (cloud)

- ✅ No Docker needed
- ✅ Works from anywhere (with internet)
- ✅ Uses your cloud database

### ✅ Docker → Local Database

```bash
docker-compose -f docker-compose.dev.yml up --build
```

**Uses:** Docker environment variables → Local PostgreSQL container

- ✅ Isolated local database
- ✅ No internet needed
- ✅ Faster for testing
- ✅ Easy to reset/wipe

**Why:** Docker sets environment variables that override `.env.development.local` when running in containers.

---

## Important Notes

### 1. Internet Connection Required

- Prisma Accelerate is a cloud service
- You need internet connection to use it
- If offline, you'll get connection errors

### 2. Environment File Priority

- `.env.development.local` takes precedence over `.env`
- Your cloud database URLs are now in `.env.development.local`
- This means `npm run dev` will use your cloud database

### 3. Migrations

When you change your Prisma schema:

```bash
# This uses DIRECT_DATABASE_URL (direct PostgreSQL connection)
npx prisma migrate dev --name your_migration_name
```

---

## Development Workflow

### Daily Development:

```bash
# Just run this - no Docker needed!
npm run dev
```

### When Schema Changes:

```bash
# 1. Update schema.prisma
# 2. Create migration
npx prisma migrate dev --name add_new_field

# 3. Continue development
npm run dev
```

### Check Database:

```bash
# View users in database
npm run check-users

# Open Prisma Studio (database GUI)
npx prisma studio
```

---

## Why It Wasn't Working Before

The issue was:

1. `.env.development.local` had `localhost:5432` (no database there)
2. This overrode your cloud database URLs in `.env`
3. Prisma tried to connect to localhost → failed

**Now fixed:**

- ✅ `.env.development.local` uses your Prisma Accelerate URL (for `npm run dev`)
- ✅ Docker uses local PostgreSQL (configured in `docker-compose.dev.yml`)

---

## Summary

| Method            | Database Used                | Command                                       |
| ----------------- | ---------------------------- | --------------------------------------------- |
| **`npm run dev`** | ☁️ Cloud (Prisma Accelerate) | `npm run dev`                                 |
| **Docker**        | 🐳 Local (Docker PostgreSQL) | `docker-compose -f docker-compose.dev.yml up` |

### Quick Reference:

**For daily development (cloud database):**

```bash
npm run dev  # Uses Prisma Accelerate
```

**For testing with local database:**

```bash
docker-compose -f docker-compose.dev.yml up --build  # Uses Docker PostgreSQL
```

**You're all set!**

- `npm run dev` → Cloud database ✅
- Docker → Local database ✅

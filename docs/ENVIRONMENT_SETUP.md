# Environment Setup Guide 🔐

> Stav k 2026-07-24 (v1.0.0): platné; přehled proměnných viz .env.example a README → Nasazení.

## Overview

This project uses **different databases for different environments**:

- **Development**: Prisma Accelerate (cloud database)
- **Production**: Google Cloud SQL

## Environment Files Structure

```
.env                          # Base defaults (lowest priority)
.env.development.local        # Development overrides (Prisma Accelerate)
.env.production.example       # Production template (Cloud SQL)
```

## Development Setup

### Current Configuration (`.env.development.local`)

```env
# Prisma Accelerate - for local development
PRISMA_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_KEY"
DIRECT_DATABASE_URL="postgresql://direct-connection-url"
```

**This file is gitignored** - your Prisma Accelerate credentials stay local.

### Usage

```bash
# Development uses Prisma Accelerate automatically
npm run dev
```

## Production Setup

### Option 1: Vercel

1. Go to **Vercel Dashboard** → Your Project → **Settings** → **Environment Variables**

2. Add these variables for **Production** environment:
   ```
   PRISMA_DATABASE_URL=postgresql://postgres:PASSWORD@35.188.96.89:5432/duocards-database1?schema=public
   DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@35.188.96.89:5432/duocards-database1?schema=public
   ```

3. **Important**: Select **Production** (and optionally **Preview**) environment

4. **Authorize Vercel IPs** in Cloud SQL:
   ```bash
   # Get Vercel IP ranges (check Vercel docs for current IPs)
   gcloud sql instances patch duocards \
     --authorized-networks=VERCEL_IP_RANGE
   ```

### Option 2: Google Cloud Run (volitelná alternativa hostingu)

Cloud Run can use Cloud SQL Proxy natively via Unix sockets.

1. **Deploy with Cloud SQL connection:**
   ```bash
   gcloud run deploy duocards-app \
     --image us-west2-docker.pkg.dev/duocards-478723/duocards:latest \
     --add-cloudsql-instances duocards-478723:us-central1:duocards \
     --set-env-vars "PRISMA_DATABASE_URL=postgresql://postgres:PASSWORD@/duocards-database1?host=/cloudsql/duocards-478723:us-central1:duocards&schema=public" \
     --set-env-vars "DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@/duocards-database1?host=/cloudsql/duocards-478723:us-central1:duocards&schema=public" \
     --set-secrets "CLOUD_SQL_PASSWORD=cloud-sql-password:latest"
   ```

2. **Or use Secret Manager** (recommended):
   ```bash
   # Create secret
   echo -n "your-password" | gcloud secrets create cloud-sql-password --data-file=-
   
   # Grant Cloud Run access
   gcloud secrets add-iam-policy-binding cloud-sql-password \
     --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
     --role="roles/secretmanager.secretAccessor"
   ```

### Option 3: Docker with Cloud SQL Proxy

Use `docker-compose.prod-cloudsql.yml`:

```bash
# Set password
export CLOUD_SQL_PASSWORD=your_password

# Start services
docker-compose -f docker-compose.prod-cloudsql.yml up -d
```

## Environment Variable Priority

Next.js loads environment variables in this order (later overrides earlier):

1. `.env` (base defaults)
2. `.env.local` (local overrides)
3. `.env.development` / `.env.production` (environment-specific)
4. `.env.development.local` / `.env.production.local` (highest priority)

**In production**, platform environment variables (Vercel, Cloud Run, etc.) override file-based variables.

## Quick Reference

### Development
```bash
# Uses .env.development.local → Prisma Accelerate
npm run dev
```

### Production (Local Test)
```bash
# Override with Cloud SQL
PRISMA_DATABASE_URL="postgresql://..." DIRECT_DATABASE_URL="postgresql://..." npm run start
```

### Production (Deployed)
- Set environment variables in deployment platform
- Platform uses production environment automatically

## Migration Commands

### Development Migrations
```bash
# Uses Prisma Accelerate (from .env.development.local)
npx prisma migrate dev
```

### Production Migrations
```bash
# Set production environment variables first
export PRISMA_DATABASE_URL="postgresql://..."
export DIRECT_DATABASE_URL="postgresql://..."

# Run migrations
npx prisma migrate deploy
```

## Security Checklist

- ✅ `.env.development.local` is gitignored
- ✅ `.env.production.example` has no real passwords
- ✅ Production passwords stored in platform (Vercel/Cloud Run)
- ✅ Use Secret Manager for Cloud Run deployments
- ✅ Never commit passwords to git

## Troubleshooting

### Wrong Database in Production

**Problem**: Production is using Prisma Accelerate instead of Cloud SQL

**Solution**: 
1. Check environment variables in deployment platform
2. Verify they're set for **Production** environment
3. Redeploy after setting variables

### Development Using Cloud SQL

**Problem**: Development is trying to use Cloud SQL

**Solution**:
1. Check `.env.development.local` exists
2. Verify it has Prisma Accelerate URLs
3. Restart dev server: `npm run dev`

### Connection Errors

**Problem**: Can't connect to database

**Solution**:
1. Verify connection string format
2. Check if Cloud SQL Proxy is running (for local)
3. Verify authorized IPs (for direct connection)
4. Check username/password are correct


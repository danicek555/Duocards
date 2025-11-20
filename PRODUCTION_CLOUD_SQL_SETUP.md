# Production Cloud SQL Setup 🚀

This guide shows how to use **Prisma Accelerate for development** and **Google Cloud SQL for production**.

## Environment Strategy

| Environment                     | Database          | Configuration File             |
| ------------------------------- | ----------------- | ------------------------------ |
| **Development** (`npm run dev`) | Prisma Accelerate | `.env.development.local`       |
| **Production** (deployed)       | Google Cloud SQL  | Platform environment variables |

## Current Setup

### Development (`.env.development.local`)

```env
# Prisma Accelerate - for local development
PRISMA_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=YOUR_KEY"
DIRECT_DATABASE_URL="postgresql://direct-connection-url"
```

### Production (Platform Environment Variables)

You'll set these in your deployment platform (Vercel, Cloud Run, etc.)

## Setup for Different Platforms

### Option 1: Vercel Deployment

1. **Go to Vercel Dashboard** → Your Project → Settings → Environment Variables

2. **Add Production Variables:**

   ```
   PRISMA_DATABASE_URL=postgresql://postgres:PASSWORD@35.188.96.89:5432/duocards-database1?schema=public
   DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@35.188.96.89:5432/duocards-database1?schema=public
   ```

   **Environment:** Select `Production` (and optionally `Preview`)

3. **For Cloud SQL Proxy on Vercel:**

   Vercel doesn't support Cloud SQL Proxy directly. You have two options:

   **Option A: Direct Connection (Requires Authorized IP)**

   - Authorize Vercel's IP ranges
   - Use direct connection string

   **Option B: Use Private IP (Recommended)**

   - Deploy to Google Cloud Run (same VPC)
   - Use private IP connection

### Option 2: Google Cloud Run (Recommended for Cloud SQL)

This is the best option since Cloud Run can use Cloud SQL Proxy natively.

1. **Enable Cloud SQL Connection in Cloud Run:**

   When deploying, add Cloud SQL connection:

   ```bash
   gcloud run deploy duocards-app \
     --image us-west2-docker.pkg.dev/duocards-478723/duocards:latest \
     --add-cloudsql-instances duocards-478723:us-central1:duocards \
     --set-env-vars "PRISMA_DATABASE_URL=postgresql://postgres:PASSWORD@/duocards-database1?host=/cloudsql/duocards-478723:us-central1:duocards&schema=public" \
     --set-env-vars "DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@/duocards-database1?host=/cloudsql/duocards-478723:us-central1:duocards&schema=public"
   ```

2. **Or use Cloud Run YAML:**
   ```yaml
   apiVersion: serving.knative.dev/v1
   kind: Service
   metadata:
     name: duocards-app
   spec:
     template:
       metadata:
         annotations:
           run.googleapis.com/cloudsql-instances: duocards-478723:us-central1:duocards
       spec:
         containers:
           - image: us-west2-docker.pkg.dev/duocards-478723/duocards:latest
             env:
               - name: PRISMA_DATABASE_URL
                 value: "postgresql://postgres:PASSWORD@/duocards-database1?host=/cloudsql/duocards-478723:us-central1:duocards&schema=public"
               - name: DIRECT_DATABASE_URL
                 value: "postgresql://postgres:PASSWORD@/duocards-database1?host=/cloudsql/duocards-478723:us-central1:duocards&schema=public"
   ```

### Option 3: Docker with Cloud SQL Proxy

If deploying Docker containers, use Cloud SQL Proxy as a sidecar:

```yaml
# docker-compose.prod.yml
version: "3.8"

services:
  cloud-sql-proxy:
    image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0
    command:
      - "--address=0.0.0.0"
      - "--port=5432"
      - "duocards-478723:us-central1:duocards"
    volumes:
      - ~/.config/gcloud:/root/.config/gcloud:ro

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
      - PRISMA_DATABASE_URL=postgresql://postgres:PASSWORD@cloud-sql-proxy:5432/duocards-database1?schema=public
      - DIRECT_DATABASE_URL=postgresql://postgres:PASSWORD@cloud-sql-proxy:5432/duocards-database1?schema=public
    depends_on:
      - cloud-sql-proxy
```

## Connection String Formats

### For Cloud SQL Proxy (Unix Socket - Cloud Run)

```
postgresql://USER:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME&schema=public
```

### For Cloud SQL Proxy (TCP - Docker/Local)

```
postgresql://USER:PASSWORD@localhost:5432/DATABASE?schema=public
```

### For Direct Connection (Public IP)

```
postgresql://USER:PASSWORD@35.188.96.89:5432/DATABASE?schema=public
```

## Security Best Practices

1. ✅ **Use Google Secret Manager** for passwords in production
2. ✅ **Use Cloud SQL Proxy** when possible (more secure)
3. ✅ **Restrict authorized IPs** if using direct connection
4. ✅ **Never commit passwords** to git
5. ✅ **Use different passwords** for dev and production

## Migration Steps

### 1. Keep Development Setup

Your `.env.development.local` stays the same with Prisma Accelerate.

### 2. Set Production Variables

Set Cloud SQL connection strings in your deployment platform.

### 3. Run Production Migrations

```bash
# Set production environment variables first
export PRISMA_DATABASE_URL="postgresql://..."
export DIRECT_DATABASE_URL="postgresql://..."

# Run migrations
npx prisma migrate deploy
```

### 4. Test Production Connection

```bash
# Test connection
npx prisma db pull

# Or use Prisma Studio (with production env vars)
PRISMA_DATABASE_URL="..." npx prisma studio
```

## Quick Reference

### Development

```bash
# Uses .env.development.local (Prisma Accelerate)
npm run dev
```

### Production (Local Test)

```bash
# Override with Cloud SQL
PRISMA_DATABASE_URL="postgresql://..." DIRECT_DATABASE_URL="postgresql://..." npm run start
```

### Production (Deployed)

- Set environment variables in deployment platform
- Platform automatically uses production environment

## Troubleshooting

### Connection Refused

- Check if Cloud SQL Proxy is running
- Verify connection name is correct
- Check authorized IPs (for direct connection)

### Authentication Failed

- Verify username and password
- Check database name (`duocards-database1`)
- Ensure user has proper permissions

### Wrong Database

- Development uses Prisma Accelerate
- Production uses Cloud SQL
- Check which environment variables are loaded

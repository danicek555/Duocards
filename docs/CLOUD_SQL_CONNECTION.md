# Cloud SQL Connection Setup ✅

Your Cloud SQL instance is ready! Here's how to connect:

## Connection Details

- **Connection Name**: `duocards-478723:us-central1:duocards`
- **Public IP**: `35.188.96.89`
- **Database Version**: PostgreSQL 17
- **Available Databases**: 
  - `postgres` (default)
  - `duocards-database1`
- **User**: `postgres` (root user)

## Method 1: Cloud SQL Proxy (Recommended) 🔒

This is the most secure method and doesn't require opening your database to the internet.

### Step 1: Start Cloud SQL Proxy

```bash
# Run the proxy script (uses port 5433 to avoid conflict with Docker)
./scripts/start-cloud-sql-proxy.sh
```

**Or manually:**
```bash
cloud-sql-proxy duocards-478723:us-central1:duocards --port=5433
```

Keep this terminal window open - the proxy needs to stay running.

### Step 2: Update Environment Variables

Create or update `.env.development.local`:

```env
# Cloud SQL via Proxy (port 5433)
PRISMA_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5433/duocards-database1?schema=public"
DIRECT_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5433/duocards-database1?schema=public"
```

**Replace `YOUR_PASSWORD` with your Cloud SQL postgres user password.**

### Step 3: Run Migrations

```bash
# Make sure Cloud SQL Proxy is running first!
npx prisma migrate deploy
```

### Step 4: Test Connection

```bash
# Test connection
npx prisma db pull

# Or open Prisma Studio
npx prisma studio
```

## Method 2: Direct Connection (Public IP) ⚠️

**Note:** This requires your IP to be authorized. Only use for development.

### Step 1: Authorize Your IP

```bash
# Get your current IP
MY_IP=$(curl -s https://api.ipify.org)
echo "Your IP: $MY_IP"

# Authorize it
gcloud sql instances patch duocards \
  --authorized-networks=$MY_IP/32
```

### Step 2: Update Environment Variables

```env
# Direct connection (public IP)
PRISMA_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@35.188.96.89:5432/duocards-database1?schema=public"
DIRECT_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@35.188.96.89:5432/duocards-database1?schema=public"
```

## Quick Start Commands

```bash
# 1. Start Cloud SQL Proxy (in one terminal)
./scripts/start-cloud-sql-proxy.sh

# 2. In another terminal, update .env.development.local with connection string
# 3. Run migrations
npx prisma migrate deploy

# 4. Start your app
npm run dev
```

## Troubleshooting

### Port Already in Use

If port 5433 is in use, change it in `scripts/start-cloud-sql-proxy.sh`:
```bash
PROXY_PORT=5434  # or any other free port
```

Then update your connection string to use the new port.

### Authentication Failed

- Verify your password is correct
- Check if you're using the right database name (`duocards-database1`)
- Make sure Cloud SQL Proxy is running (for Method 1)

### Connection Refused

- Check if Cloud SQL Proxy is running: `lsof -i :5433`
- Verify the connection name is correct
- Check if your IP is authorized (for Method 2)

## Database Management

```bash
# List databases
gcloud sql databases list --instance=duocards

# List users
gcloud sql users list --instance=duocards

# Get instance info
gcloud sql instances describe duocards

# Get connection name
gcloud sql instances describe duocards --format="value(connectionName)"
```

## Next Steps

1. ✅ Start Cloud SQL Proxy
2. ✅ Update `.env.development.local` with connection string
3. ✅ Run migrations: `npx prisma migrate deploy`
4. ✅ Test connection: `npx prisma studio`
5. ✅ Start your app: `npm run dev`

## Security Notes

- 🔒 **Cloud SQL Proxy** is recommended - it's more secure and doesn't expose your database
- ⚠️ **Public IP** should only be used for development
- 🔑 Keep your database password secure - never commit it to git
- 🌐 Consider using Google Secret Manager for production passwords


# Google Cloud SQL Setup Guide 🗄️

> ARCHIV — produkce běží na Prisma Postgres; Cloud SQL se aktuálně nepoužívá.

This guide will help you connect your DuoCards application to Google Cloud SQL PostgreSQL.

## Prerequisites

1. Google Cloud Project: `duocards-478723`
2. Google Cloud SDK (gcloud) installed and authenticated
3. Billing enabled on your GCP project

## Step 1: Create Cloud SQL PostgreSQL Instance

### Option A: Using gcloud CLI

```bash
# Set your project
gcloud config set project duocards-478723

# Create Cloud SQL PostgreSQL instance
gcloud sql instances create duocards-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=us-west2 \
  --root-password=YOUR_SECURE_PASSWORD \
  --storage-type=SSD \
  --storage-size=10GB \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=04
```

**Note:** Replace `YOUR_SECURE_PASSWORD` with a strong password. Save this password securely!

### Option B: Using Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to **SQL** → **Create Instance**
3. Choose **PostgreSQL**
4. Configure:
   - **Instance ID**: `duocards-db`
   - **Database version**: PostgreSQL 16
   - **Region**: `us-west2` (to match your Artifact Registry)
   - **Machine type**: `db-f1-micro` (for development) or `db-n1-standard-1` (for production)
   - **Storage**: 10GB SSD
   - **Root password**: Set a strong password
5. Click **Create**

## Step 2: Create Database and User

```bash
# Create database
gcloud sql databases create duocards --instance=duocards-db

# Create a dedicated user (recommended, don't use root)
gcloud sql users create duocards_user \
  --instance=duocards-db \
  --password=YOUR_USER_PASSWORD
```

## Step 3: Configure Network Access

### Option A: Public IP (Easier for development)

```bash
# Get your current IP
MY_IP=$(curl -s https://api.ipify.org)
echo "Your IP: $MY_IP"

# Allow your IP to connect
gcloud sql instances patch duocards-db \
  --authorized-networks=$MY_IP/32

# Or allow all IPs (NOT RECOMMENDED for production)
gcloud sql instances patch duocards-db \
  --authorized-networks=0.0.0.0/0
```

### Option B: Private IP (Recommended for production)

```bash
# Enable private IP
gcloud sql instances patch duocards-db \
  --network=projects/duocards-478723/global/networks/default \
  --no-assign-ip
```

**Note:** Private IP requires VPC peering and is more complex. Use Public IP for development.

## Step 4: Get Connection Details

```bash
# Get connection name (for Cloud SQL Proxy)
gcloud sql instances describe duocards-db --format="value(connectionName)"

# Get public IP
gcloud sql instances describe duocards-db --format="value(ipAddresses[0].ipAddress)"
```

## Step 5: Configure Your Application

### For Local Development (using Cloud SQL Proxy - Recommended)

The Cloud SQL Proxy provides secure connections without opening your database to the internet.

1. **Install Cloud SQL Proxy:**

```bash
# Download Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.darwin.arm64
chmod +x cloud-sql-proxy

# Or install via Homebrew
brew install cloud-sql-proxy
```

2. **Start Cloud SQL Proxy:**

```bash
# Get your connection name first
CONNECTION_NAME=$(gcloud sql instances describe duocards-db --format="value(connectionName)")
echo "Connection name: $CONNECTION_NAME"

# Start proxy (runs on localhost:5432)
cloud-sql-proxy $CONNECTION_NAME --port=5432
```

3. **Update your `.env.development.local`:**

```env
# Cloud SQL via Proxy (localhost:5432)
PRISMA_DATABASE_URL="postgresql://duocards_user:YOUR_USER_PASSWORD@localhost:5432/duocards?schema=public"
DIRECT_DATABASE_URL="postgresql://duocards_user:YOUR_USER_PASSWORD@localhost:5432/duocards?schema=public"
```

### For Production/Docker (Direct Connection)

If your application runs on Google Cloud (Cloud Run, GKE, etc.), you can connect directly:

1. **Get connection details:**

```bash
# Get public IP
PUBLIC_IP=$(gcloud sql instances describe duocards-db --format="value(ipAddresses[0].ipAddress)")
echo "Public IP: $PUBLIC_IP"
```

2. **Update your production environment variables:**

```env
# Direct connection (replace with your actual IP and password)
PRISMA_DATABASE_URL="postgresql://duocards_user:YOUR_USER_PASSWORD@PUBLIC_IP:5432/duocards?schema=public"
DIRECT_DATABASE_URL="postgresql://duocards_user:YOUR_USER_PASSWORD@PUBLIC_IP:5432/duocards?schema=public"
```

**For Docker/Cloud Run:** Use environment variables or Google Secret Manager.

## Step 6: Run Migrations

```bash
# Make sure Cloud SQL Proxy is running (if using proxy method)
# Then run migrations
npx prisma migrate deploy

# Or for development
npx prisma migrate dev
```

## Step 7: Test Connection

```bash
# Test connection
npx prisma db pull

# Or open Prisma Studio
npx prisma studio
```

## Connection Methods Comparison

| Method              | Security     | Complexity | Best For                      |
| ------------------- | ------------ | ---------- | ----------------------------- |
| **Cloud SQL Proxy** | ✅ High      | Medium     | Local development, production |
| **Public IP**       | ⚠️ Medium    | Low        | Development, testing          |
| **Private IP**      | ✅✅ Highest | High       | Production (same VPC)         |

## Security Best Practices

1. ✅ **Use dedicated database user** (not root)
2. ✅ **Use Cloud SQL Proxy** for local development
3. ✅ **Restrict authorized networks** (don't use 0.0.0.0/0)
4. ✅ **Use Google Secret Manager** for passwords in production
5. ✅ **Enable SSL** (Cloud SQL Proxy does this automatically)
6. ✅ **Regular backups** (configured in instance settings)

## Troubleshooting

### Connection Refused

```bash
# Check if instance is running
gcloud sql instances describe duocards-db

# Check authorized networks
gcloud sql instances describe duocards-db --format="value(settings.ipConfiguration.authorizedNetworks)"
```

### Authentication Failed

- Verify username and password
- Check if user exists: `gcloud sql users list --instance=duocards-db`

### Cloud SQL Proxy Issues

```bash
# Check if proxy is running
lsof -i :5432

# Restart proxy
pkill cloud-sql-proxy
cloud-sql-proxy YOUR_CONNECTION_NAME --port=5432
```

## Quick Reference Commands

```bash
# List instances
gcloud sql instances list

# Get connection string
gcloud sql instances describe duocards-db --format="value(connectionName)"

# Get public IP
gcloud sql instances describe duocards-db --format="value(ipAddresses[0].ipAddress)"

# List databases
gcloud sql databases list --instance=duocards-db

# List users
gcloud sql users list --instance=duocards-db

# Restart instance
gcloud sql instances restart duocards-db
```

## Next Steps

1. ✅ Create Cloud SQL instance
2. ✅ Create database and user
3. ✅ Configure network access
4. ✅ Set up Cloud SQL Proxy (for local dev)
5. ✅ Update environment variables
6. ✅ Run migrations
7. ✅ Test connection

## Cost Estimation

- **db-f1-micro**: ~$7-10/month (development)
- **db-n1-standard-1**: ~$50-100/month (production)
- **Storage**: ~$0.17/GB/month
- **Backups**: Included (7 days retention)

Check [Google Cloud Pricing](https://cloud.google.com/sql/pricing) for current rates.

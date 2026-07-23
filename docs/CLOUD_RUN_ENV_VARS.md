# Cloud Run Environment Variables Setup 🔐

> ARCHIV — Cloud Run je aktuálně vypnutý. Návod slouží pro případné znovuzapnutí (SHARED_BACKEND_URL).

This guide lists all environment variables you need to set in Cloud Run for your app to work properly.

## ✅ Already Set (Database)

These are already configured:

- `PRISMA_DATABASE_URL` - Cloud SQL connection
- `DIRECT_DATABASE_URL` - Cloud SQL direct connection

## 🔴 Required Environment Variables

### 1. Email Service (Resend)

**Required for:** User registration, email verification

```bash
RESEND_API_KEY=re_your_resend_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

**How to get:**

1. Sign up at [resend.com](https://resend.com)
2. Go to API Keys → Create API Key
3. Copy the key (starts with `re_`)
4. For `FROM_EMAIL`, use your verified domain or Resend's default domain

**Set in Cloud Run:**

```bash
gcloud run services update duocards-app \
  --region us-west2 \
  --update-env-vars "RESEND_API_KEY=re_your_key" \
  --update-env-vars "FROM_EMAIL=noreply@yourdomain.com"
```

### 2. Authentication Secret

**Required for:** Signing JWT tokens, session security

```bash
AUTH_SECRET=your_random_secret_here
```

**Generate a secure secret:**

```bash
openssl rand -base64 32
```

**Set in Cloud Run:**

```bash
gcloud run services update duocards-app \
  --region us-west2 \
  --update-env-vars "AUTH_SECRET=$(openssl rand -base64 32)"
```

## 🟡 Optional but Recommended

### 3. App URL

**Used for:** Email links, OAuth redirects, absolute URLs

```bash
NEXT_PUBLIC_APP_URL=https://duocards-app-731652720086.us-west2.run.app
```

**Or if you have a custom domain:**

```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

**Set in Cloud Run:**

```bash
gcloud run services update duocards-app \
  --region us-west2 \
  --update-env-vars "NEXT_PUBLIC_APP_URL=https://duocards-app-731652720086.us-west2.run.app"
```

### 4. OpenAI API Key (for AI features)

**Required for:** Flashcard generation, pronunciation, translation

```bash
OPENAI_API_KEY=sk-your_openai_api_key
```

**How to get:**

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Go to API Keys → Create new secret key
3. Copy the key (starts with `sk-`)

**Set in Cloud Run:**

```bash
gcloud run services update duocards-app \
  --region us-west2 \
  --update-env-vars "OPENAI_API_KEY=sk-your_key"
```

### 5. Sentry (Error Monitoring)

**Optional:** Error tracking and monitoring

```bash
SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
NEXT_PUBLIC_SENTRY_DSN=https://your_sentry_dsn@sentry.io/project_id
```

**Set in Cloud Run:**

```bash
gcloud run services update duocards-app \
  --region us-west2 \
  --update-env-vars "SENTRY_DSN=your_dsn" \
  --update-env-vars "NEXT_PUBLIC_SENTRY_DSN=your_dsn"
```

## 📋 Complete Setup Command

Here's a complete command to set all recommended variables at once:

```bash
# Generate auth secret
AUTH_SECRET=$(openssl rand -base64 32)

# Update Cloud Run with all variables
gcloud run services update duocards-app \
  --region us-west2 \
  --update-env-vars \
    "RESEND_API_KEY=re_your_resend_key" \
    "FROM_EMAIL=noreply@yourdomain.com" \
    "AUTH_SECRET=$AUTH_SECRET" \
    "NEXT_PUBLIC_APP_URL=https://duocards-app-731652720086.us-west2.run.app" \
    "OPENAI_API_KEY=sk-your_openai_key"
```

## 🔒 Using Google Secret Manager (Recommended for Production)

For better security, store sensitive values in Secret Manager:

### 1. Create Secrets

```bash
# Create secrets
echo -n "re_your_resend_key" | gcloud secrets create resend-api-key --data-file=-
echo -n "sk-your_openai_key" | gcloud secrets create openai-api-key --data-file=-
echo -n "your_auth_secret" | gcloud secrets create auth-secret --data-file=-
```

### 2. Grant Cloud Run Access

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe duocards-478723 --format="value(projectNumber)")

# Grant access to Cloud Run service account
gcloud secrets add-iam-policy-binding resend-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding auth-secret \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 3. Update Cloud Run to Use Secrets

```bash
gcloud run services update duocards-app \
  --region us-west2 \
  --update-secrets \
    "RESEND_API_KEY=resend-api-key:latest" \
    "OPENAI_API_KEY=openai-api-key:latest" \
    "AUTH_SECRET=auth-secret:latest" \
  --update-env-vars \
    "FROM_EMAIL=noreply@yourdomain.com" \
    "NEXT_PUBLIC_APP_URL=https://duocards-app-731652720086.us-west2.run.app"
```

## 📝 Environment Variables Summary

| Variable                 | Required | Purpose              | Example              |
| ------------------------ | -------- | -------------------- | -------------------- |
| `PRISMA_DATABASE_URL`    | ✅       | Database connection  | Already set          |
| `DIRECT_DATABASE_URL`    | ✅       | Direct DB connection | Already set          |
| `RESEND_API_KEY`         | ✅       | Email service        | `re_...`             |
| `FROM_EMAIL`             | ✅       | Sender email         | `noreply@domain.com` |
| `AUTH_SECRET`            | ✅       | JWT signing          | Generated secret     |
| `NEXT_PUBLIC_APP_URL`    | 🟡       | App URL              | Your Cloud Run URL   |
| `OPENAI_API_KEY`         | 🟡       | AI features          | `sk-...`             |
| `SENTRY_DSN`             | ⚪       | Error tracking       | Optional             |
| `NEXT_PUBLIC_SENTRY_DSN` | ⚪       | Client-side Sentry   | Optional             |

## ✅ Quick Checklist

- [ ] `RESEND_API_KEY` - Email service
- [ ] `FROM_EMAIL` - Sender email address
- [ ] `AUTH_SECRET` - Authentication secret
- [ ] `NEXT_PUBLIC_APP_URL` - Your app URL
- [ ] `OPENAI_API_KEY` - For AI features (optional)
- [ ] `SENTRY_DSN` - Error monitoring (optional)

## 🧪 Test Your Setup

After setting variables, test your app:

```bash
# Check if app is running
curl https://duocards-app-731652720086.us-west2.run.app

# View logs
gcloud run services logs read duocards-app --region us-west2 --limit 50
```

## 🔍 Verify Environment Variables

```bash
# List all environment variables
gcloud run services describe duocards-app \
  --region us-west2 \
  --format="value(spec.template.spec.containers[0].env)"
```

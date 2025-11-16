# Environment Files Explained 🔐

## Why So Many `.env` Files?

Next.js uses a **priority-based system** for loading environment variables. Files are loaded in a specific order, with **later files overriding earlier ones**. This allows you to have different configurations for different environments.

## The Loading Order (Priority: Low → High)

```
1. .env                    ← Base defaults (lowest priority)
2. .env.local              ← Local overrides (ignored by git)
3. .env.development        ← Development defaults
4. .env.development.local   ← Development local overrides (highest priority in dev)
5. .env.production         ← Production defaults
6. .env.production.local   ← Production local overrides (highest priority in prod)
```

**Rule:** Variables in files loaded later **override** variables from files loaded earlier.

---

## Your Current Files Explained

### 1. `.env` (Base Configuration)
**Purpose:** Default environment variables for all environments
**Status:** ✅ Keep this
**Contains:** 
- Database URLs (now set to localhost for Docker)
- API keys (Resend, OpenAI, etc.)
- General app settings

**When used:** Always loaded first, acts as fallback defaults

---

### 2. `.env.development.local` (Development Overrides)
**Purpose:** Local development-specific variables that override `.env`
**Status:** ✅ Keep this
**Contains:**
- Vercel-specific settings (if you're testing Vercel integration)
- Local development URLs
- Development-only API keys

**When used:** Only in development mode (`npm run dev`)
**Priority:** HIGHEST in development (overrides everything else)

**Why separate?** 
- You might want different database URLs for local vs production
- You might have different API keys for testing
- This file is **gitignored** (won't be committed), so it's safe for secrets

---

### 3. `.env.example` (Template)
**Purpose:** Template showing what variables are needed (WITHOUT actual secrets)
**Status:** ✅ Keep this, commit to git
**Contains:** 
- Variable names with example/placeholder values
- Documentation of what's needed

**When used:** Never loaded by Next.js, just for documentation
**Example:**
```env
PRISMA_DATABASE_URL=postgresql://user:password@localhost:5432/dbname
RESEND_API_KEY=your_resend_key_here
```

---

### 4. `.env.sentry-build-plugin` (Sentry Configuration)
**Purpose:** Sentry-specific configuration for source map uploads
**Status:** ✅ Keep this (or move to `.env`)
**Contains:**
- `SENTRY_AUTH_TOKEN` for authenticating with Sentry

**When used:** During build process by Sentry plugin

---

### 5. `.env.backup` & `.env.development.local.backup` (Backups)
**Purpose:** Backups I created before modifying your files
**Status:** ⚠️ Can delete after confirming everything works
**Contains:** Your old configuration (with Prisma Accelerate URLs)

---

### 6. `.env.tmp` (Temporary)
**Purpose:** Temporary file from my script
**Status:** ❌ Can delete

---

## Why This System Exists

### 1. **Environment Separation**
```bash
# Development
.env.development.local → localhost database, test API keys

# Production (on Vercel)
Vercel dashboard → production database, real API keys
```

### 2. **Team Collaboration**
- `.env.example` → Shows what's needed (committed to git)
- `.env.local` → Your personal secrets (NOT committed, gitignored)
- Everyone can have different local settings

### 3. **Security**
- Files with `.local` are **gitignored** (won't be committed)
- Safe to put secrets in `.env.local` files
- `.env.example` has no secrets, safe to commit

---

## Best Practices

### ✅ DO:
1. **Commit `.env.example`** - Template for others
2. **Use `.env.local`** for secrets - Won't be committed
3. **Use `.env`** for non-sensitive defaults
4. **Use `.env.development.local`** for local dev overrides

### ❌ DON'T:
1. **Commit `.env.local`** files - They contain secrets
2. **Put secrets in `.env.example`** - Use placeholders
3. **Have duplicate variables** - Later files override earlier ones

---

## Your Current Setup (Recommended)

```
.env                          ← Base config (can commit if no secrets)
.env.development.local        ← Local dev overrides (gitignored, secrets here)
.env.example                  ← Template (committed to git)
.env.sentry-build-plugin      ← Sentry config (can move to .env)
```

---

## Quick Reference

| File | Git Status | When Used | Priority |
|------|------------|-----------|----------|
| `.env` | Can commit | Always | Low |
| `.env.local` | Gitignored | Always | Medium |
| `.env.development.local` | Gitignored | Dev only | High |
| `.env.production.local` | Gitignored | Prod only | High |
| `.env.example` | Committed | Never (docs) | N/A |

---

## Cleanup Recommendation

You can safely delete:
- `.env.backup` (after confirming everything works)
- `.env.development.local.backup` (after confirming everything works)
- `.env.tmp` (temporary file)

Keep:
- `.env` (base config)
- `.env.development.local` (local dev overrides)
- `.env.example` (template/documentation)
- `.env.sentry-build-plugin` (or move to `.env`)

---

## Example: How Variables Are Resolved

If you have:

**`.env`:**
```env
DATABASE_URL=postgresql://localhost:5432/mydb
API_KEY=default_key
```

**`.env.development.local`:**
```env
DATABASE_URL=postgresql://localhost:5432/devdb
```

**Result in development:**
- `DATABASE_URL` = `postgresql://localhost:5432/devdb` (from `.env.development.local`)
- `API_KEY` = `default_key` (from `.env`)

The `.env.development.local` value **overrides** the `.env` value!



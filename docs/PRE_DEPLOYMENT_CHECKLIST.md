# Pre-Deployment Checklist 🚢

> Stav k 2026-07-23 (v1.0.0): web = Vercel; sdílený backend je volitelný a aktuálně vypnutý (SHARED_BACKEND_URL). Kroky specifické pro Cloud Run platí jen při jeho znovuzapnutí.

> **Note:** This is for BEFORE deploying to production. For daily development, see `DEVELOPMENT_WORKFLOW.md`

## 1. Code Quality & Linting ✅

```bash
npm run lint
```

- Fix all linting errors (warnings can be fixed but aren't critical)
- Currently: 3 warnings for unused imports (should be fixed)

## 2. Build Test 🏗️

```bash
npm run build
# or for production
npm run build:prod
```

- Verify build completes without errors
- Check bundle size is reasonable
- Look for any build warnings

## 3. Production Build Test 🚀

```bash
npm run build:prod
npm run start
```

- Test the production build locally
- Visit http://localhost:3000
- Test all critical user flows

## 4. Environment Variables 🔐

Verify all required environment variables are set in your deployment platform (Vercel):

### Required Variables:

- `DATABASE_URL` - PostgreSQL connection string
- `RESEND_API_KEY` - Email service API key
- `FROM_EMAIL` - Email address for sending emails
- `AUTH_SECRET` - Secret for signing auth tokens (generate with: `openssl rand -base64 32`)

### Optional Variables:

- `NEXT_PUBLIC_APP_URL` - Your production URL (e.g., https://yourdomain.com)
- `NEXT_PUBLIC_API_BASE_URL` - API base URL (defaults to /api)
- `SENTRY_DSN` - If using Sentry (optional)
- `NEXT_PUBLIC_SENTRY_DSN` - Client-side Sentry DSN (optional)

## 5. Database Setup 🗄️

```bash
# Run migrations on production database
npx prisma migrate deploy

# Generate Prisma Client
npx prisma generate
```

Or if using Vercel:

- Ensure Vercel Postgres is connected
- The `build:vercel` script handles migrations automatically

## 6. Authentication Testing 🔒

- [ ] Register a new account
- [ ] Login with valid credentials
- [ ] Try accessing `/dashboard` without login (should redirect)
- [ ] Try accessing `/dashboard` with login (should work)
- [ ] Test logout functionality (if implemented)

## 7. Email Functionality 📧

- [ ] Test email verification flow
- [ ] Verify emails are being sent from correct address
- [ ] Check spam folder if emails originen't arriving
- [ ] Test email resend functionality

## 8. Form Validation ✅

- [ ] Test registration with invalid data
- [ ] Test password requirements
- [ ] Test email format validation
- [ ] Test password matching validation

## 9. Error Handling 🛡️

- [ ] Test network error scenarios
- [ ] Test invalid login credentials
- [ ] Test duplicate email registration
- [ ] Check error messages are user-friendly

## 10. Security Checks 🔐

- [ ] Verify passwords are hashed (not stored in plain text)
- [ ] Check auth cookies are HttpOnly and Secure (in production)
- [ ] Verify CORS settings
- [ ] Test SQL injection protection (Prisma handles this)
- [ ] Verify sensitive data isn't exposed in client-side code

## 11. Performance ⚡

- [ ] Check Lighthouse scores
- [ ] Verify images are optimized
- [ ] Check bundle size
- [ ] Test loading times

## 12. Browser Compatibility 🌐

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test on mobile devices

## 13. Accessibility ♿

- [ ] Test keyboard navigation
- [ ] Check color contrast
- [ ] Verify ARIA labels where needed
- [ ] Test screen reader compatibility

## 14. Monitoring & Logging 📊

- [ ] Set up Sentry (if using) with production DSN
- [ ] Verify error logging works
- [ ] Set up uptime monitoring

## 15. Final Manual Tests 🧪

- [ ] Complete user registration flow
- [ ] Complete login flow
- [ ] Navigate to dashboard
- [ ] Test all form submissions
- [ ] Test all notifications/modals
- [ ] Test responsive design on mobile

## 16. Documentation 📝

- [ ] Update README with deployment instructions
- [ ] Document environment variables needed
- [ ] Update any API documentation

## 17. Git & Version Control 📦

```bash
# Ensure everything is committed
git status

# Tag the release (optional)
git tag -a v1.0.0 -m "Initial production release"
git push origin v1.0.0
```

## Quick Test Script

Run this locally before deploying:

```bash
# 1. Lint
npm run lint

# 2. Build
npm run build:prod

# 3. Test production build
npm run start Hedge
# Then manually test in browser

# 4. Check environment
# Use /api/debug endpoint to verify env vars (if implemented)
```

## Vercel-Specific Checklist

If deploying to Vercel:

- [ ] Connect Git repository
- [ ] Set all environment variables in Vercel dashboard
- [ ] Configure build command: `npm run build:vercel`
- [ ] Set Node.js version (20.x recommended)
- [ ] Verify database connection
- [ ] Test preview deployments first

## Post-Deployment Testing 🎉

After deployment:

- [ ] Test production URL
- [ ] Verify HTTPS is working
- [ ] Test all critical flows
- [ ] Monitor error logs
- [ ] Check performance metrics
- [ ] Verify email delivery works in production

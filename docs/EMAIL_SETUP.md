# Email Verification Setup Guide

> Stav k 2026-07-24 (v1.0.0): platné (Resend).

Your DuoCards app is now configured to send real verification emails using Resend! Here's how to complete the setup:

## 1. Get a Resend API Key

1. Go to [resend.com](https://resend.com) and sign up for a free account
2. Navigate to [API Keys](https://resend.com/api-keys) in your dashboard
3. Click "Create API Key"
4. Give it a name like "DuoCards Production" or "DuoCards Development"
5. Copy the generated API key (it starts with `re_`)

## 2. Set Up Environment Variables

Create a `.env.local` file in your project root with the following content:

```bash
# Resend Email Service Configuration
RESEND_API_KEY=your_actual_api_key_here

# Email Configuration (optional - defaults will be used if not set)
# For development, you can leave this empty to use Resend's default domain
# For production, use your verified domain: FROM_EMAIL=noreply@yourdomain.com
FROM_EMAIL=
FROM_NAME=DuoCards
```

**Important:** Replace `your_actual_api_key_here` with the API key you copied from Resend.

## 3. Domain Configuration (Optional but Recommended)

For production use, you should:

1. **Add your domain** in the Resend dashboard under "Domains"
2. **Verify your domain** by adding the required DNS records
3. **Update the FROM_EMAIL** in your `.env.local` to use your verified domain

For development/testing, you can use the default Resend domain, but emails might go to spam.

## 4. Test the Email Verification

1. Start your development server: `npm run dev`
2. Try registering a new account with your email address
3. Check your email inbox (and spam folder) for the verification code
4. The email should have a beautiful HTML design with your verification code

## 5. Email Features

The verification emails include:

- ✅ Professional HTML design with your DuoCards branding
- ✅ Clear verification code display
- ✅ Plain text fallback for email clients that don't support HTML
- ✅ Expiration notice (10 minutes)
- ✅ Security notice for users who didn't sign up

## 6. Troubleshooting

### Emails not being sent?

- Check that `RESEND_API_KEY` is set correctly in your `.env.local`
- Verify the API key is valid in your Resend dashboard
- Check the console logs for error messages

### Emails going to spam?

- Add your domain to Resend and verify it
- Use a proper FROM_EMAIL address
- Consider setting up SPF/DKIM records for your domain

### API Key not working?

- Make sure you copied the full API key (it should start with `re_`)
- Check that the API key is active in your Resend dashboard
- Ensure there are no extra spaces or characters in your `.env.local` file

## 7. Production Considerations

For production deployment:

- Use environment variables in your hosting platform (Vercel, Netlify, etc.)
- Never commit your `.env.local` file to version control
- Consider using a custom domain for better deliverability
- Monitor your email sending limits and upgrade your Resend plan if needed

## Free Tier Limits

Resend's free tier includes:

- 3,000 emails per month
- 100 emails per day
- Perfect for development and small applications

---

Your email verification system is now ready! 🎉

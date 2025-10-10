# Resend Domain Setup Guide

## Step 1: Add Your Domain to Resend

1. Go to [resend.com/domains](https://resend.com/domains)
2. Click "Add Domain"
3. Enter your domain (e.g., `noreply.yourdomain.com` or `yourdomain.com`)
4. Click "Add Domain"

## Step 2: Get Resend DNS Records

After adding your domain, Resend will provide you with DNS records that look like this:

### SPF Record

```
Type: TXT
Name: @ (or your subdomain)
Value: v=spf1 include:_spf.resend.com ~all
```

### DKIM Records

```
Type: CNAME
Name: resend._domainkey
Value: resend._domainkey.resend.com

Type: CNAME
Name: resend2._domainkey
Value: resend2._domainkey.resend.com
```

### DMARC Record (Optional but Recommended)

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com
```

## Step 3: Update Your DNS

Replace your current Amazon SES records with the Resend ones:

### Remove These (Amazon SES):

- MX record pointing to `feedback-smtp.us-east-1.amazonses.com`
- SPF record with `include:amazonses.com`
- DKIM record with the long key

### Add These (Resend):

- SPF record with `include:_spf.resend.com`
- DKIM CNAME records provided by Resend
- DMARC record (recommended)

## Step 4: Update Your Environment Variables

Once your domain is verified in Resend:

```bash
# In your .env.local file
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=noreply@yourdomain.com
```

## Step 5: Verify Domain

1. Go back to Resend domains dashboard
2. Click "Verify" next to your domain
3. Wait for DNS propagation (can take up to 48 hours)
4. Once verified, you can send emails from your domain

## Current vs New Setup

### What You Have Now (Amazon SES):

```
MX: send.noreply → feedback-smtp.us-east-1.amazonses.com
SPF: send.noreply → v=spf1 include:amazonses.com ~all
DKIM: resend._domainkey.noreply → [Amazon SES key]
```

### What You Need (Resend):

```
SPF: @ → v=spf1 include:_spf.resend.com ~all
DKIM: resend._domainkey → resend._domainkey.resend.com
DKIM: resend2._domainkey → resend2._domainkey.resend.com
```

## Quick Start (No Domain Setup)

If you want to test immediately without setting up a domain:

1. Keep using `onboarding@resend.dev` (already configured)
2. Just add your `RESEND_API_KEY` to `.env.local`
3. Start sending emails right away!

## Benefits of Using Your Own Domain

- ✅ Better deliverability (less likely to go to spam)
- ✅ Professional appearance
- ✅ Brand consistency
- ✅ Higher sending limits

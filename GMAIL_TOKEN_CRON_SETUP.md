# Gmail Token Refresh Cron Job Setup

This guide explains how to set up automatic Gmail token refreshing to prevent token expiration.

## Overview

The `gmail-token-cron` Edge Function automatically refreshes Gmail access tokens that are about to expire (within 30 minutes). It uses the refresh tokens stored in the `gmail_tokens` table to get new access tokens from Google.

## Setup Instructions

### 1. Deploy the Function

The function is already created at `supabase/functions/gmail-token-cron/index.ts`. Make sure it's deployed:

```bash
supabase functions deploy gmail-token-cron
```

### 2. Set Up External Cron Job

Since Supabase Edge Functions don't have built-in cron support, use one of these external services:

#### Option A: GitHub Actions (Recommended for development)

Create `.github/workflows/refresh-gmail-tokens.yml`:

```yaml
name: Refresh Gmail Tokens

on:
  schedule:
    # Run every 30 minutes
    - cron: '*/30 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  refresh-tokens:
    runs-on: ubuntu-latest
    steps:
      - name: Call Gmail Token Refresh
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            ${{ secrets.SUPABASE_URL }}/functions/v1/gmail-token-cron
```

#### Option B: Cron-job.org (Free tier available)

1. Go to https://cron-job.org
2. Create a new cron job
3. Set URL: `https://your-project.supabase.co/functions/v1/gmail-token-cron`
4. Set Method: POST
5. Add Header: `Authorization: Bearer YOUR_ANON_KEY`
6. Set schedule: Every 30 minutes

#### Option C: Railway Cron Jobs

If using Railway for deployment, they have built-in cron support.

### 3. Environment Variables

Ensure these are set in your Supabase project:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Manual Testing

You can manually trigger the token refresh:

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  https://your-project.supabase.co/functions/v1/gmail-token-cron
```

## Monitoring

The function logs all activities. Check Supabase function logs to monitor:

- How many tokens were refreshed
- Any failures or errors
- Token expiry times

## Function Behavior

- **Triggers every 30 minutes** (recommended)
- **Refreshes tokens expiring within 30 minutes**
- **Updates database** with new access tokens
- **Handles invalid refresh tokens** by removing them
- **Logs all operations** for monitoring

## Security Notes

- Uses service role key for database access
- Only processes tokens with valid refresh tokens
- Removes invalid/expired refresh tokens automatically
- All operations are logged for audit trails
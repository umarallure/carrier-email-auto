# GTL Portal Scraper - Production System

## Overview

This system allows team members to scrape policy data from the GTL insurance carrier portal through a web-based interface with manual login flow. It combines the reliability of manual authentication with automated multi-page data extraction.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Team Member Flow                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Frontend: GTLScraperWizard.tsx                             │
│  - Step 1: Start Session (create job + browser)             │
│  - Step 2: Manual Login (user navigates & logs in)          │
│  - Step 3: Confirm Ready (user confirms login complete)     │
│  - Step 4: Start Scraping (automated extraction begins)     │
│  - Step 5: Download CSV (export scraped data)               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend: gtl-scraper-session Edge Function                 │
│  - POST /start - Initialize browser session                 │
│  - POST /confirm-ready - Mark login complete                │
│  - POST /scrape - Trigger scraping                          │
│  - GET /status/:id - Real-time status updates               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker: gtl-scraper-worker.js                              │
│  - Watches for 'ready' sessions in database                 │
│  - Connects to GoLogin browser (user already logged in)     │
│  - Scrapes all 19 pages of GTL portal                       │
│  - Extracts ~272 policies with full details                 │
│  - Saves to gtl_scraped_policies table                      │
│  - Updates progress in real-time                            │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Database: Supabase                                          │
│  - scraper_jobs: Job metadata & status                      │
│  - gtl_scraper_sessions: Session state tracking             │
│  - gtl_scraped_policies: Extracted policy data              │
└─────────────────────────────────────────────────────────────┘
```

## Setup Instructions

### 1. Database Migration

Apply the database schema:

```bash
# Apply the session table migration
supabase migration up
```

This creates:
- `gtl_scraper_sessions` table
- Necessary indexes and RLS policies

### 2. Deploy Edge Function

```bash
# Deploy the session management function
supabase functions deploy gtl-scraper-session
```

### 3. Start Background Worker

The worker processes scraping sessions:

```bash
# In a terminal (keep running)
npm run scraper:gtl-worker
```

**Important:** The worker must be running for scraping to execute. Consider using:
- **Development:** `npm run scraper:gtl-worker` in a dedicated terminal
- **Production:** PM2, systemd, or Docker container

### 4. Configure Environment Variables

Ensure these are set in `.env`:

```env
# GoLogin Configuration
GL_API_TOKEN=your_gologin_api_token
GL_PROFILE_ID=your_profile_id_with_vpn

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## User Guide for Team Members

### How to Scrape GTL Portal Data

1. **Navigate to Scraper Page**
   - Go to: `/scraper` in your app
   - Click on "New Scraping Job" tab

2. **Step 1: Start Session**
   - Enter a job name (e.g., "Weekly GTL Sync - Oct 17")
   - Click "Start Session"
   - Wait ~30-60 seconds for browser to initialize

3. **Step 2: Manual Login**
   - A GoLogin browser window will open
   - Navigate to: `https://gtlink.gtlic.com/MyBusiness`
   - Login with your GTL credentials
   - Wait for the policy list page to fully load
   - Verify you can see the table with policies

4. **Step 3: Confirm Ready**
   - Return to the web interface
   - Click "I'm Ready" button
   - This signals that you've successfully logged in

5. **Step 4: Scraping** (Automatic)
   - Click "Start Scraping" button
   - The system will automatically:
     - Navigate through all 19 pages
     - Extract ~272 policies
     - Save data to database
   - Progress updates in real-time
   - Takes ~2-3 minutes for all pages

6. **Step 5: Download Results**
   - Once complete, click "Download CSV File"
   - File will be saved as `gtl-policies-{job_id}.csv`
   - Contains all extracted policy data

### Viewing Results

- **Job History Tab:** See all past scraping jobs
- **Results Tab:** View extracted policies in table format
- **Export Button:** Download any completed job as CSV

## Data Extraction

### Fields Extracted per Policy

**From Main Table:**
- Policy Number
- Updated Date
- Plan Name
- Insured Name
- Face Amount
- Status (Active/Pending/etc.)

**From Detail Section:**
- Issue Date
- Application Date
- Premium Amount
- State
- Agent Name
- Agent Number
- Plan Code
- Applicant SSN (last 4)
- Date of Birth
- Gender
- Age
- Notes

### Database Schema

```sql
gtl_scraped_policies
├── id (UUID)
├── job_id (UUID) → scraper_jobs
├── policy_number (TEXT)
├── applicant_name (TEXT)
├── plan_name (TEXT)
├── plan_code (TEXT)
├── face_amount (TEXT)
├── premium (TEXT)
├── status (TEXT)
├── updated_date (TEXT)
├── issue_date (TEXT)
├── application_date (TEXT)
├── dob (TEXT)
├── gender (TEXT)
├── age (TEXT)
├── state (TEXT)
├── agent_name (TEXT)
├── agent_number (TEXT)
└── notes (TEXT)
```

## Technical Details

### Session States

```
initializing → waiting_for_login → ready → scraping → completed
                                                    ↘ failed
```

1. **initializing:** Browser starting up
2. **waiting_for_login:** Waiting for user to manually login
3. **ready:** User confirmed login, ready to scrape
4. **scraping:** Active data extraction in progress
5. **completed:** All pages scraped successfully
6. **failed:** Error occurred during process

### Real-Time Updates

- Frontend polls session status every 3 seconds
- Backend updates progress after each page
- Job history refreshes every 5 seconds
- Shows current page number and scraped count

### Error Handling

- **Browser not found:** User didn't login properly
- **Page timeout:** Network issues or slow portal
- **Database errors:** Check Supabase logs
- **Worker offline:** Start worker with `npm run scraper:gtl-worker`

## Troubleshooting

### Issue: "Session not found"
**Solution:** Browser session expired. Start a new session.

### Issue: "GTL portal page not found"
**Solution:** Ensure you navigated to the correct URL and logged in before clicking "I'm Ready".

### Issue: Scraping stuck at 0%
**Solution:** Check if worker is running: `npm run scraper:gtl-worker`

### Issue: Missing data in CSV
**Solution:** 
- Check that all 19 pages loaded during scraping
- Verify HTML selectors haven't changed on GTL portal
- Review worker logs for extraction errors

### Issue: Browser closes immediately
**Solution:** Check GoLogin API token and profile ID in `.env`

## Development Scripts

```bash
# Test scripts (from original workflow)
npm run test:step1    # Test GoLogin browser launch
npm run test:step2    # Test manual login + single-page scrape

# Production scripts
npm run scraper:gtl-worker    # Start background worker
npm run dev                   # Start frontend dev server
```

## Production Deployment

### Frontend
Deploy to Vercel/Netlify as usual:
```bash
npm run build
```

### Worker (Background Process)
Deploy to a server with Node.js:

**Option 1: PM2**
```bash
pm2 start scripts/gtl-scraper-worker.js --name "gtl-worker"
pm2 save
pm2 startup
```

**Option 2: Docker**
```dockerfile
FROM node:18
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "scripts/gtl-scraper-worker.js"]
```

**Option 3: Systemd Service**
```ini
[Unit]
Description=GTL Scraper Worker
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/app
ExecStart=/usr/bin/node scripts/gtl-scraper-worker.js
Restart=always

[Install]
WantedBy=multi-user.target
```

### Edge Functions
```bash
supabase functions deploy gtl-scraper-session
```

## Security Considerations

1. **Authentication:** RLS policies ensure users can only see their jobs
2. **Credentials:** GTL credentials never stored in database
3. **GoLogin VPN:** Profile uses VPN for IP rotation
4. **Service Role Key:** Only used by worker, never exposed to frontend

## Future Enhancements

- [ ] Multi-carrier support (ANAM, Aetna, etc.)
- [ ] Scheduled automatic scraping (cron jobs)
- [ ] Email notifications on completion
- [ ] Duplicate policy detection
- [ ] Data comparison with previous scrapes
- [ ] Export to Google Sheets integration

## Support

For issues or questions:
1. Check worker logs: `pm2 logs gtl-worker` (if using PM2)
2. Check Edge Function logs: Supabase Dashboard → Functions
3. Review database records: `gtl_scraper_sessions` table
4. Test with `test:step2` script first

---

**Built with:**
- Frontend: React + TypeScript + shadcn/ui
- Backend: Supabase Edge Functions (Deno)
- Worker: Node.js + GoLogin + Puppeteer
- Database: PostgreSQL (Supabase)

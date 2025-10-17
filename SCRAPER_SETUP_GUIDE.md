# Carrier Web Scraper Setup Guide

## Overview

The Carrier Web Scraper automates data extraction from insurance carrier portals (GTL, ANAM, Aetna) using Puppeteer with a Stealth Plugin to avoid detection. Scraped data is stored in Supabase and can be exported as CSV/JSON.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│         React Frontend (ScraperPage.tsx)            │
│  - Create scraping jobs                             │
│  - Monitor progress                                 │
│  - View & export results                            │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│      Supabase Edge Function (scraper-api)           │
│  - REST API for job management                      │
│  - Database operations                              │
│  - CSV/JSON export                                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│    Node.js Scraper Service (carrierScraper.js)      │
│  - Background job processor                         │
│  - Browser automation with Puppeteer                │
│  - Multi-carrier support                            │
│  - Rate limiting & error handling                   │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│       Carrier Portals (GTL, ANAM, AETNA)            │
│  - Browser-based data extraction                    │
│  - Multi-page scraping                              │
│  - Policy data collection                           │
└─────────────────────────────────────────────────────┘
```

## Database Schema

### scraper_jobs
Tracks scraping job status and progress
- `id` (UUID): Job identifier
- `carrier_name` (TEXT): GTL, ANAM, or AETNA
- `job_name` (TEXT): User-friendly name
- `status` (TEXT): pending, in_progress, completed, failed
- `total_records` (INTEGER): Total policies found
- `scraped_records` (INTEGER): Policies successfully scraped
- `error_message` (TEXT): Error details if failed
- `config` (JSONB): Carrier-specific configuration
- `started_at`, `completed_at` (TIMESTAMP): Execution times

### scraped_policies
Stores extracted policy data
- `id` (UUID): Record identifier
- `job_id` (UUID FK): Reference to scraper_jobs
- `carrier_name` (TEXT): Source carrier
- `policy_number` (TEXT): Policy identifier
- `applicant_name` (TEXT): Insured person
- `plan_name` (TEXT): Insurance plan
- `coverage_amount` (DECIMAL): Coverage limit
- `status` (TEXT): Policy status
- `issue_date`, `application_date` (DATE): Key dates
- `premium` (DECIMAL): Premium amount
- `agent_name`, `agent_number` (TEXT): Agent info
- `notes` (TEXT): Additional notes
- `raw_data` (JSONB): Original extracted data

## Installation & Setup

### 1. Install Dependencies

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
npm install @supabase/supabase-js
npm install dotenv
```

### 2. Configure Environment Variables

Create `.env` file in project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GTL Portal
GTL_USERNAME=your_gtl_username
GTL_PASSWORD=your_gtl_password
GTL_LOGIN_URL=https://yourgtlportal.com/login
GTL_PORTAL_URL=https://yourgtlportal.com/MyBusiness

# ANAM Portal
ANAM_USERNAME=your_anam_email@example.com
ANAM_PASSWORD=your_anam_password

# AETNA Portal
AETNA_USERNAME=your_aetna_username
AETNA_PASSWORD=your_aetna_password

# Scraper Options
HEADLESS=true
TIMEOUT=30000
RATE_LIMIT_MS=1000
```

### 3. Update package.json

Add scraper script to your `package.json`:

```json
{
  "scripts": {
    "scraper:watch": "node scripts/carrierScraper.js",
    "scraper:start": "GTL_USERNAME=user GTL_PASSWORD=pass node scripts/carrierScraper.js"
  }
}
```

### 4. Deploy Edge Function

```bash
supabase functions deploy scraper-api
```

## Usage

### Starting a Scraping Job

1. **Via UI**: Navigate to the Scraper page → "New Scraping Job" tab
2. **Via API**:

```bash
curl -X POST http://localhost:3000/api/scraper/start \
  -H "Content-Type: application/json" \
  -d '{
    "carrier_name": "GTL",
    "job_name": "Weekly GTL Sync"
  }'
```

### Monitoring Progress

```bash
# Get all jobs
curl http://localhost:3000/api/scraper/jobs

# Get job details
curl http://localhost:3000/api/scraper/jobs/{job_id}
```

### Exporting Data

```bash
# Export as CSV
curl http://localhost:3000/api/scraper/export/{job_id}?format=csv \
  -o policies.csv

# Export as JSON
curl http://localhost:3000/api/scraper/export/{job_id}?format=json \
  -o policies.json
```

## Running the Scraper Service

### Production (Docker recommended)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY scripts/ ./scripts/
COPY .env .env

CMD ["npm", "run", "scraper:watch"]
```

Build and run:
```bash
docker build -t carrier-scraper .
docker run --env-file .env carrier-scraper
```

### Development

```bash
# Run scraper with file watching
npm run scraper:watch

# Logs will show:
# [Scraper] Starting job abc123 for GTL
# [GTL] Navigating to login page...
# [GTL] Scraping page 1...
# [Scraper] Saved 50 policies for job abc123
```

## Carrier-Specific Setup

### GTL Portal

1. Get login URL from GTL
2. Update `GTL_LOGIN_URL` in environment
3. Test login credentials before first run
4. Portal typically has 18 pages of policies
5. Supports "Recent Business" page scraping

**Selectors Used:**
- Login: `[name="username"]`, `[name="password"]`, `button[type="submit"]`
- Table: `.DivTableRow`, `[class*="col-"]`
- Pagination: `a[href*="page="]`

### ANAM Portal

1. Use email as username
2. Update `ANAM_USERNAME` with email
3. Credentials stored securely
4. Supports policy listing page

**Selectors Used:**
- Login: `[name="email"]`, `[name="password"]`, `[type="submit"]`
- Table: `tbody tr`, `td` cells
- Pagination: Auto-handled via API

### AETNA Portal

1. Get credentials from Aetna account
2. Update `AETNA_USERNAME` and `AETNA_PASSWORD`
3. Agent portal support
4. Policy card-based layout

**Selectors Used:**
- Login: `[name="user"]`, `[name="password"]`, `.login-btn`
- Policies: `.policy-card`, `[data-field="*"]`
- Status: `.policy-status`

## Advanced Configuration

### Custom Selectors

Update `CARRIER_CONFIGS` in `carrierScraper.ts`:

```typescript
CUSTOM_CARRIER: {
  carrier_name: 'CustomCarrier',
  login_url: 'https://custom.com/login',
  portal_url: 'https://custom.com/policies',
  username_selector: '[data-testid="username"]',  // Custom selector
  password_selector: '[data-testid="password"]',
  login_button_selector: '[data-testid="login"]',
  policy_table_selector: '.policies-table',
  policy_row_selector: '.policy-row',
  max_pages: 20,
  rate_limit_ms: 2000,
}
```

### Error Handling

The scraper includes:
- Automatic retry logic
- Timeout handling
- Network error recovery
- Invalid selector fallbacks
- Detailed error logging

### Rate Limiting

Adjust `RATE_LIMIT_MS` to control speed:
- **500ms**: Fast scraping (may trigger anti-bot)
- **1000ms**: Balanced (recommended)
- **2000ms**: Slow, safer scraping

### Stealth Plugin

Puppeteer Extra's Stealth Plugin:
- Removes headless indicators
- Spoofs browser properties
- Handles anti-bot detection
- Recommended for production

## Troubleshooting

### "Login failed"
- Verify credentials in `.env`
- Check if portal URL is correct
- Ensure account isn't locked
- Try manual login to test credentials

### "Selectors not found"
- Verify portal HTML structure hasn't changed
- Update selectors in CARRIER_CONFIGS
- Test selectors in browser DevTools
- Check page load timing

### "Rate limited"
- Increase `RATE_LIMIT_MS` to 2000+
- Add random delays between actions
- Check portal's rate limit policies
- Consider request batching

### "Memory issues"
- Close unused browser pages
- Implement page pooling
- Reduce max concurrent jobs
- Monitor browser process memory

## Security Best Practices

1. **Environment Variables**
   - Never commit `.env` files
   - Rotate credentials regularly
   - Use service accounts where available

2. **Browser Automation**
   - Run in isolated environment
   - Use VPN if required
   - Monitor for account lockouts
   - Respect portal Terms of Service

3. **Data Storage**
   - Encrypt sensitive data in transit
   - Use Supabase Row-Level Security (RLS)
   - Audit data access
   - Regular backups

4. **Logging**
   - Mask credentials in logs
   - Monitor for failures
   - Alert on errors
   - Archive logs

## Performance Optimization

### Parallel Scraping

```javascript
// Scrape multiple carriers simultaneously
await Promise.all([
  runScraperJob(jobId1, 'GTL'),
  runScraperJob(jobId2, 'ANAM'),
  runScraperJob(jobId3, 'AETNA'),
]);
```

### Incremental Scraping

Only scrape updated policies:

```sql
SELECT policy_number FROM scraped_policies 
WHERE last_updated > NOW() - INTERVAL '24 hours'
```

### Caching

Store metadata to avoid re-scraping:
- Last scrape timestamp
- Policy counts
- Known fields

## Maintenance

### Weekly Tasks
- [ ] Review scraper logs
- [ ] Verify all carriers are accessible
- [ ] Check data quality
- [ ] Monitor error rates

### Monthly Tasks
- [ ] Update carrier portal selectors if UI changes
- [ ] Rotate credentials if required
- [ ] Clean up old job records
- [ ] Review data for anomalies

### Quarterly Tasks
- [ ] Update Puppeteer and dependencies
- [ ] Test disaster recovery
- [ ] Audit security settings
- [ ] Plan capacity upgrades

## Support & Resources

- **Puppeteer Docs**: https://pptr.dev/
- **Supabase API**: https://supabase.com/docs
- **Stealth Plugin**: https://github.com/berstend/puppeteer-extra
- **Issues**: Check application logs for detailed error messages

## Examples

### Example 1: Scrape GTL Weekly

```bash
# Create a cron job
0 2 * * 0 curl -X POST http://localhost:3000/api/scraper/start \
  -H "Content-Type: application/json" \
  -d '{"carrier_name":"GTL","job_name":"Weekly GTL"}'
```

### Example 2: Automated Export

```javascript
// Export last completed job
const { data: jobs } = await supabase
  .from('scraper_jobs')
  .select('*')
  .eq('status', 'completed')
  .eq('carrier_name', 'GTL')
  .order('completed_at', { ascending: false })
  .limit(1);

const jobId = jobs[0].id;
const response = await fetch(`/api/scraper/export/${jobId}?format=csv`);
```

### Example 3: Alert on Errors

```javascript
// Monitor for failed jobs
supabase
  .from('scraper_jobs')
  .on('*', payload => {
    if (payload.new.status === 'failed') {
      sendAlert(`Scraper failed: ${payload.new.error_message}`);
    }
  })
  .subscribe();
```

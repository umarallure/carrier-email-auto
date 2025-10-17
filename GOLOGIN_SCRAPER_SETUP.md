# GoLogin Cloud Browser Scraper Setup

This application uses **GoLogin** cloud browser instead of local Puppeteer for improved security, VPN support, and anti-detection capabilities.

## Why GoLogin?

✅ **Cloud-based**: No need to install Chrome/Chromium locally  
✅ **VPN Integration**: Use GoLogin profiles with built-in VPN  
✅ **Anti-Detection**: Better stealth than Puppeteer alone  
✅ **Profile Management**: Reuse browser profiles with saved settings  
✅ **Cross-Platform**: Works on any OS without browser dependencies

## Quick Setup

### 1. Get GoLogin Account

1. Sign up at [gologin.com](https://gologin.com)
2. Get your API token from the Dashboard
3. (Optional) Create a profile with VPN settings for carrier scraping

### 2. Install Dependencies

```bash
npm install gologin googleapis dotenv
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in:

```bash
# GoLogin Configuration
GL_API_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OGI2MGYyMTJkOTkwMGZiNjAyYzhjNmMiLCJ0eXBlIjoiZGV2Iiwiand0aWQiOiI2OGYyMzVlOWE3MDg1ZjhmOTAyYzc2ZjgifQ.788P5qYFIZ7OYr76TfI1TIJwffLZEFfiKN7XC3olBZM
GL_PROFILE_ID=68b749514f4576be73a48022

# Carrier Credentials
GTL_USERNAME=Abdulrheritage
GTL_PASSWORD=6jeFYFpq2Xb!hJi
GTL_LOGIN_URL=https://eapp.gtlic.com/
GTL_MY_BUSINESS_URL=https://gtlink.gtlic.com/MyBusiness

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Optional: Google Sheets Export
GOOGLE_SHEET_ID=your_google_sheet_id
GOOGLE_CREDENTIALS_FILE=credentials.json
```

### 4. Run the Scraper

```bash
npm run scraper:watch
```

You should see:
```
[Scraper] Starting job watcher with GoLogin cloud browser...
[Scraper] Polling interval: 10000ms
[Scraper] GoLogin Profile ID: your_profile_id (or Default)
```

## GoLogin Profile Setup (Optional but Recommended)

### Why Use a Profile?

Using a GoLogin profile allows you to:
- **Persist VPN connection** across scraping sessions
- **Save login sessions** to avoid re-authentication
- **Configure specific fingerprints** for better anti-detection
- **Set geolocation** to match carrier requirements

### Create a Profile

1. Go to [GoLogin Dashboard](https://app.gologin.com)
2. Click "Create Profile"
3. Configure:
   - **Browser**: Chrome
   - **Operating System**: Windows 10
   - **Proxy/VPN**: Select your VPN or proxy
   - **Geolocation**: Set to US (or carrier's required location)
   - **Timezone**: Match geolocation
4. Copy the **Profile ID** from the profile page
5. Add to `.env`: `GL_PROFILE_ID=your_profile_id_here`

### Profile Best Practices

**For GTL:**
- Location: United States
- Timezone: US/Eastern
- Language: English (US)
- WebRTC: Enabled

**For Multiple Carriers:**
- Create separate profiles for each carrier
- Update `GL_PROFILE_ID` based on which carrier you're scraping
- Or modify the code to select profile based on `carrier_name`

## Architecture

```
┌─────────────────┐
│  Scraper UI     │
│  (React App)    │
└────────┬────────┘
         │ Creates job
         ▼
┌─────────────────┐
│  scraper_jobs   │
│  (Supabase)     │
└────────┬────────┘
         │ Polls for pending
         ▼
┌─────────────────┐      ┌──────────────┐
│ gologinScraper  │─────▶│ GoLogin API  │
│   (Node.js)     │      │ (Cloud)      │
└────────┬────────┘      └──────────────┘
         │                       │
         │                       ▼
         │              ┌──────────────┐
         │              │ Cloud Browser│
         │              │ (with VPN)   │
         │              └──────┬───────┘
         │                     │
         │                     ▼
         │              ┌──────────────┐
         │              │GTL/ANAM/AETNA│
         │              │   Portals    │
         │              └──────────────┘
         ▼
┌─────────────────┐
│scraped_policies │
│  (Supabase)     │
└─────────────────┘
```

## Code Changes from Puppeteer

### Before (Local Puppeteer):
```javascript
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
puppeteer.use(StealthPlugin());

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox']
});
```

### After (GoLogin Cloud):
```javascript
import { GologinApi } from 'gologin';

const gologin = GologinApi({
  token: CONFIG.GL_API_TOKEN,
});

const { browser } = await gologin.launch({
  cloud: true,
  profileId: CONFIG.GL_PROFILE_ID, // Optional
});
```

## Files Updated

1. **scripts/gologinScraper.js** - New scraper using GoLogin
2. **package.json** - Added `gologin` and `googleapis` dependencies
3. **.env.example** - Added GoLogin configuration variables
4. **GOLOGIN_SCRAPER_SETUP.md** - This file

## Running the Scraper

### Start the Watcher Service

```bash
npm run scraper:watch
```

This runs `scripts/gologinScraper.js` which:
1. Polls the database every 10 seconds for pending jobs
2. Launches GoLogin cloud browser for each job
3. Logs into the carrier portal
4. Scrapes all pages
5. Saves data to Supabase
6. Optionally exports to Google Sheets

### Create a Scraping Job

**Via UI:**
1. Navigate to `/scraper` in your React app
2. Click "New Scraping Job" tab
3. Select carrier (GTL, ANAM, AETNA)
4. Enter job name
5. Click "Start Scraping"

**Via API:**
```bash
curl -X POST https://your-project.supabase.co/functions/v1/scraper-api \
  -H "Content-Type: application/json" \
  -d '{
    "carrier_name": "GTL",
    "job_name": "GTL Weekly Scrape"
  }'
```

### Monitor Progress

The UI will show real-time updates:
- Status: `pending` → `in_progress` → `completed`
- Progress: 0% → 100%
- Records scraped: Updates as pages are processed

## Troubleshooting

### "GoLogin API token is invalid"
- Check your `GL_API_TOKEN` in `.env`
- Verify token at [GoLogin Dashboard](https://app.gologin.com/api-token)

### "Profile not found"
- Check your `GL_PROFILE_ID` in `.env`
- Ensure profile exists in GoLogin Dashboard
- Or remove `GL_PROFILE_ID` to use default profile

### "Login failed" to Carrier Portal
- Verify credentials in `.env`
- Test manual login to carrier portal
- Check if account is locked
- Update login selectors in `gologinScraper.js` if portal changed

### "Browser launch timeout"
- GoLogin cloud servers may be busy, retry
- Check your internet connection
- Verify GoLogin subscription is active

### "No policies found"
- Check portal selectors in scraper code
- Carrier may have updated their UI
- Inspect the portal HTML to update selectors

## Cost Considerations

GoLogin pricing (as of 2025):
- **Free**: 3 profiles, 100 browser launches/month
- **Professional**: $49/month, unlimited launches
- **Business**: $99/month, team features

For production scraping, the Professional plan is recommended.

## Google Sheets Export (Optional)

### Setup

1. Create a Google Cloud Project
2. Enable Google Sheets API
3. Create Service Account
4. Download `credentials.json` to project root
5. Share your Google Sheet with the service account email
6. Add `GOOGLE_SHEET_ID` to `.env`

### Sheet Format

The scraper will create/update a sheet with these columns:

| Updated | Policy | Plan | Insured | Amount | Status | Issue Date | App Date | Premium | State | Agent | Agent # | Plan Code | DOB | Gender | Age | Notes |
|---------|--------|------|---------|--------|--------|------------|----------|---------|-------|-------|---------|-----------|-----|--------|-----|-------|

## Security Notes

⚠️ **Never commit `.env` file**  
⚠️ **Keep `credentials.json` private**  
⚠️ **Use environment variables in production**  
⚠️ **Rotate GoLogin API tokens regularly**  
⚠️ **Use separate profiles for different environments**

## Advanced Configuration

### Custom Carrier

Add to `gologinScraper.js`:

```javascript
async function scrapeCustomCarrier(page, jobId) {
  await page.goto('https://custom.com/login');
  
  // Login
  await page.type('#username', process.env.CUSTOM_USERNAME);
  await page.type('#password', process.env.CUSTOM_PASSWORD);
  await page.click('#login-btn');
  await page.waitForNavigation();

  // Scrape
  const policies = await page.evaluate(() => {
    // Your scraping logic here
  });

  return policies;
}
```

Then add to the switch statement:
```javascript
case 'CUSTOM':
  policies = await scrapeCustomCarrier(page, jobId);
  break;
```

### Rate Limiting

Adjust in `.env`:
```bash
RATE_LIMIT_MS=2000  # Wait 2 seconds between pages
MAX_PAGES=25        # Scrape up to 25 pages
```

### Scheduling with Cron

Use a cron job to create scraping jobs automatically:

```bash
# Daily at 2 AM
0 2 * * * curl -X POST https://your-project.supabase.co/functions/v1/scraper-api \
  -H "Content-Type: application/json" \
  -d '{"carrier_name":"GTL","job_name":"Daily GTL Scrape"}'
```

## Support

- **GoLogin Docs**: https://docs.gologin.com
- **GoLogin Support**: https://gologin.com/support
- **Scraper Issues**: Check application logs and SCRAPER_SETUP_GUIDE.md

---

**Next Steps:**
1. Get your GoLogin API token
2. Configure `.env` with credentials
3. Run `npm install`
4. Start the scraper: `npm run scraper:watch`
5. Create a test job from the UI

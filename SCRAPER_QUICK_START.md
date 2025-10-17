# Carrier Web Scraper - Quick Start Guide

## 5-Minute Setup

### 1. Install Scraper Dependencies

```bash
npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth dotenv
```

### 2. Create Environment File

Copy the example environment variables:

```bash
cp .env.example .env
```

Fill in your carrier credentials and Supabase keys.

### 3. Create Database Tables

Run the migration to create scraper tables:

```bash
supabase migration up
```

Or manually execute the SQL in `SCRAPER_SETUP_GUIDE.md` -> "Database Schema"

### 4. Deploy Edge Function

```bash
supabase functions deploy scraper-api
```

### 5. Start Scraper Service

```bash
npm run scraper:watch
```

You should see:
```
[Scraper] Watching for scraping jobs...
```

### 6. Access UI

Navigate to your app and go to `/scraper` route to access the Scraper page.

## Common Issues & Fixes

### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
# Kill it
kill -9 <PID>
```

### Chromium/Chrome Not Found
```bash
# Install Chrome
brew install chromium  # macOS
sudo apt-get install chromium-browser  # Linux
# Or set CHROME_EXECUTABLE_PATH in .env
```

### Login Fails
1. Verify credentials in .env are correct
2. Test manual login to carrier portal
3. Check if account is locked
4. Verify portal URL is current

### Supabase Connection Errors
1. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
2. Verify keys are from correct project
3. Test with: `curl https://your-project.supabase.co`

### Memory Issues
Increase available memory:
```bash
# Node.js with increased heap
node --max-old-space-size=4096 scripts/carrierScraper.js
```

## Testing Your Setup

### 1. Test Scraper UI
- Navigate to /scraper page
- Create a test job
- Monitor progress in "Scraping Jobs" tab

### 2. Test via API
```bash
curl -X POST http://localhost:3000/functions/v1/scraper-api \
  -H "Content-Type: application/json" \
  -d '{"carrier_name":"GTL","job_name":"Test"}'
```

### 3. Check Database
```bash
# Connect to Supabase
supabase projects list
# Query jobs
supabase db shell
SELECT * FROM scraper_jobs;
SELECT * FROM scraped_policies LIMIT 5;
```

## Production Deployment

### Docker Setup
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY scripts/ ./scripts/
COPY .env .env

EXPOSE 3000
CMD ["npm", "run", "scraper:watch"]
```

### Docker Compose
```yaml
version: '3.8'
services:
  scraper:
    build: .
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - GTL_USERNAME=${GTL_USERNAME}
      - GTL_PASSWORD=${GTL_PASSWORD}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

Run with:
```bash
docker-compose up -d
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: carrier-scraper
spec:
  replicas: 1
  selector:
    matchLabels:
      app: carrier-scraper
  template:
    metadata:
      labels:
        app: carrier-scraper
    spec:
      containers:
      - name: scraper
        image: carrier-scraper:latest
        env:
        - name: SUPABASE_URL
          valueFrom:
            secretKeyRef:
              name: scraper-secrets
              key: supabase-url
        - name: SUPABASE_SERVICE_ROLE_KEY
          valueFrom:
            secretKeyRef:
              name: scraper-secrets
              key: service-role-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
```

Deploy with:
```bash
kubectl apply -f scraper-deployment.yaml
```

## Monitoring & Maintenance

### View Logs
```bash
# Local
npm run scraper:watch 2>&1 | tee scraper.log

# Docker
docker logs carrier-scraper

# Kubernetes
kubectl logs deployment/carrier-scraper
```

### Monitor Job Progress
```bash
# Watch jobs in real-time
watch 'supabase db shell <<EOF
SELECT id, carrier_name, status, scraped_records, total_records FROM scraper_jobs ORDER BY created_at DESC LIMIT 10;
EOF'
```

### Health Check
```bash
# Create a health endpoint
curl http://localhost:3000/api/health

# Or use Supabase directly
curl https://your-project.supabase.co/rest/v1/scraper_jobs \
  -H "Authorization: Bearer $ANON_KEY" \
  -H "Prefer: count=exact"
```

### Cleanup Old Data
```sql
-- Delete jobs older than 30 days
DELETE FROM scraper_jobs 
WHERE created_at < NOW() - INTERVAL '30 days'
AND status IN ('completed', 'failed');

-- Archive old policies
INSERT INTO scraped_policies_archive
SELECT * FROM scraped_policies 
WHERE created_at < NOW() - INTERVAL '60 days';

DELETE FROM scraped_policies 
WHERE created_at < NOW() - INTERVAL '60 days';
```

## Advanced Configuration

### Custom Carrier Support
Add new carriers to `CARRIER_CONFIGS` in `carrierScraper.ts`:

```typescript
CUSTOM_CARRIER: {
  carrier_name: 'CustomCarrier',
  login_url: 'https://custom.com/login',
  portal_url: 'https://custom.com/policies',
  username: process.env.CUSTOM_USERNAME || '',
  password: process.env.CUSTOM_PASSWORD || '',
  username_selector: '[data-testid="user-input"]',
  password_selector: '[data-testid="pass-input"]',
  login_button_selector: '[data-testid="login-btn"]',
  policy_table_selector: '.policy-list',
  policy_row_selector: '.policy-item',
  max_pages: 20,
  rate_limit_ms: 1500,
}
```

### Performance Tuning
```javascript
// Parallel job processing
const MAX_CONCURRENT_JOBS = 3;

// Batch policy insertion
const BATCH_SIZE = 500;

// Cache policy data
const CACHE_TTL_MINUTES = 60;
```

### Error Recovery
```javascript
// Retry failed jobs automatically
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// Skip broken policies
const SKIP_ON_ERROR = true;
const ERROR_THRESHOLD = 0.1; // 10% error rate
```

## Support Resources

- **Puppeteer**: https://pptr.dev/
- **Supabase**: https://supabase.com/docs
- **Stealth Plugin**: https://github.com/berstend/puppeteer-extra
- **Issues**: Check application logs first

Need help? Check the full guides:
- `SCRAPER_SETUP_GUIDE.md` - Comprehensive setup
- `SCRAPER_INTEGRATION_GUIDE.md` - Integration steps

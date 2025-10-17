/**
 * Integration Guide: Adding Scraper Page to Application
 * 
 * This guide shows how to integrate the ScraperPage component into your existing
 * carrier-email-auto application alongside the email processing features.
 */

// ============================================================================
// STEP 1: Update App.tsx to include Scraper routing
// ============================================================================

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import ScraperPage from './components/ScraperPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scraper" element={<ScraperPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// ============================================================================
// STEP 2: Update Navigation to include Scraper link
// ============================================================================

// In DashboardSidebar.tsx or your main navigation component:

import { Link, useLocation } from 'react-router-dom';
import { Database, Mail, Settings } from 'lucide-react';

export function DashboardSidebar() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-slate-800 border-r border-slate-700 p-6 space-y-4">
      <h2 className="text-xl font-bold text-white mb-8">Navigation</h2>

      <Link
        to="/dashboard"
        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
          isActive('/dashboard')
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        <Mail className="h-5 w-5" />
        Email Processing
      </Link>

      <Link
        to="/scraper"
        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
          isActive('/scraper')
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        <Database className="h-5 w-5" />
        Carrier Scraper
      </Link>

      <Link
        to="/settings"
        className={`flex items-center gap-3 px-4 py-2 rounded-lg transition ${
          isActive('/settings')
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:bg-slate-700'
        }`}
      >
        <Settings className="h-5 w-5" />
        Settings
      </Link>
    </nav>
  );
}

// ============================================================================
// STEP 3: Create API handler in your backend
// ============================================================================

// Create src/api/scraperApi.ts

import { supabase } from '@/integrations/supabase';

export interface ScraperJob {
  id: string;
  carrier_name: string;
  job_name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  total_records?: number;
  scraped_records?: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export const scraperApi = {
  /**
   * Start a new scraping job
   */
  async startJob(carrierName: string, jobName: string): Promise<{ job_id: string }> {
    const response = await fetch('/functions/v1/scraper-api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        carrier_name: carrierName,
        job_name: jobName,
        action: 'start',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to start scraping job');
    }

    return response.json();
  },

  /**
   * Get all scraper jobs
   */
  async getJobs(): Promise<ScraperJob[]> {
    const { data, error } = await supabase
      .from('scraper_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Get job details
   */
  async getJob(jobId: string): Promise<ScraperJob> {
    const { data, error } = await supabase
      .from('scraper_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  /**
   * Get policies for a job
   */
  async getPolicies(jobId: string) {
    const { data, error } = await supabase
      .from('scraped_policies')
      .select('*')
      .eq('job_id', jobId)
      .limit(500);

    if (error) throw new Error(error.message);
    return data || [];
  },

  /**
   * Export job data as CSV
   */
  async exportCSV(jobId: string): Promise<Blob> {
    const policies = await this.getPolicies(jobId);

    if (policies.length === 0) {
      throw new Error('No data to export');
    }

    const headers = Object.keys(policies[0]);
    const csv = [
      headers.join(','),
      ...policies.map(p =>
        headers
          .map(h => {
            const value = p[h as keyof typeof p];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value).replace(/"/g, '""')}"`;
          })
          .join(',')
      ),
    ].join('\n');

    return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  },

  /**
   * Download exported data
   */
  async downloadExport(jobId: string, format: 'csv' | 'json' = 'csv') {
    const blob =
      format === 'csv' ? await this.exportCSV(jobId) : new Blob([JSON.stringify(await this.getPolicies(jobId))])

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `policies_${jobId}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};

// ============================================================================
// STEP 4: Deploy Edge Function
// ============================================================================

/*
Deploy the scraper-api edge function:

1. Ensure the function exists at:
   supabase/functions/scraper-api/index.ts

2. Deploy with:
   supabase functions deploy scraper-api

3. Test with:
   curl https://your-project.supabase.co/functions/v1/scraper-api \
     -H "Authorization: Bearer $ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{"carrier_name":"GTL","job_name":"Test"}'
*/

// ============================================================================
// STEP 5: Environment Variables (.env)
// ============================================================================

/*
Add these to your .env file:

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# For the Node.js scraper service:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

GTL_USERNAME=your_username
GTL_PASSWORD=your_password
GTL_LOGIN_URL=https://yourgtlportal.com/login
GTL_PORTAL_URL=https://yourgtlportal.com/MyBusiness

ANAM_USERNAME=your_email@example.com
ANAM_PASSWORD=your_password

AETNA_USERNAME=your_username
AETNA_PASSWORD=your_password

HEADLESS=true
TIMEOUT=30000
RATE_LIMIT_MS=1000
*/

// ============================================================================
// STEP 6: Database Setup
// ============================================================================

/*
Run the migration to create tables:

supabase migration up

Or manually run the migration from SCRAPER_SETUP_GUIDE.md
*/

// ============================================================================
// STEP 7: Run the Scraper Service
// ============================================================================

/*
Start the background scraper job processor:

# Development
npm run scraper:watch

# This watches for pending jobs in the database and processes them
# Make sure all environment variables are set

Logs will show:
[Scraper] Watching for scraping jobs...
[Scraper] Starting job abc123 for GTL
[GTL] Navigating to login page...
[GTL] Scraping page 1...
[Scraper] Saved 50 policies for job abc123
[Scraper] Job abc123 completed successfully
*/

// ============================================================================
// STEP 8: Data Flow Example
// ============================================================================

/*
User Flow:

1. User clicks "New Scraping Job" in ScraperPage
   ↓
2. Selects carrier (GTL, ANAM, AETNA)
   ↓
3. Enters job name
   ↓
4. Clicks "Start Scraping"
   ↓
5. Frontend calls scraperApi.startJob()
   ↓
6. Edge function creates job record in scraper_jobs table with status='pending'
   ↓
7. Node.js scraper service polls database every 10 seconds
   ↓
8. Detects pending job and updates status to 'in_progress'
   ↓
9. Launches Puppeteer browser
   ↓
10. Authenticates with carrier portal
    ↓
11. Scrapes policies across all pages
    ↓
12. Saves policies to scraped_policies table
    ↓
13. Updates job status to 'completed'
    ↓
14. Frontend polls and shows progress in real-time
    ↓
15. User can export data as CSV/JSON or view in results table
*/

// ============================================================================
// STEP 9: Real-Time Updates with Supabase Subscriptions
// ============================================================================

// Optional: Add real-time updates to ScraperPage

import { useEffect } from 'react';

export function useScraperJobUpdates(jobId: string | null, callback: (job: ScraperJob) => void) {
  useEffect(() => {
    if (!jobId) return;

    const subscription = supabase
      .from('scraper_jobs')
      .on('*', (payload) => {
        if (payload.new.id === jobId) {
          callback(payload.new);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [jobId, callback]);
}

// Use in component:
// useScraperJobUpdates(selectedJob, (job) => {
//   console.log('Job updated:', job);
//   setCurrentJob(job);
// });

// ============================================================================
// STEP 10: Testing the Setup
// ============================================================================

/*
To test the complete setup:

1. Create a test scraper job via the UI
   - Carrier: GTL
   - Job Name: "Test GTL Scraper"
   - Click "Start Scraping"

2. Check the status:
   - Job should appear in "Recent Scraping Jobs"
   - Status should show "pending" then "in_progress"

3. Monitor logs:
   - Run: npm run scraper:watch
   - Watch for log messages showing scraping progress

4. Verify data in database:
   - Query scraper_jobs table for your test job
   - Check scraped_policies for extracted data

5. Export and validate:
   - Click "Export" on completed job
   - Verify CSV/JSON contains policy data

6. Troubleshooting:
   - Check browser console for errors
   - Review Node.js console logs
   - Check Supabase logs for database errors
   - Verify environment variables are set correctly
*/

export default {};

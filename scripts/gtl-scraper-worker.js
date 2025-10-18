/**
 * GTL Scraper Worker with Manual Login Flow
 * 
 * This worker:
 * 1. Watches for GTL scraper sessions in 'ready' status
 * 2. Uses GoLogin cloud browser (already authenticated by user)
 * 3. Scrapes all 19 pages of GTL portal
 * 4. Saves policies to gtl_scraped_policies table
 * 5. Updates session and job status in real-time
 * 
 * Run: node scripts/gtl-scraper-worker.js
 */

import GoLogin from 'gologin';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Only load dotenv in development/local environment
if (process.env.NODE_ENV !== 'production') {
  dotenv.config();
}

// Debug: Log environment variables (remove in production)
console.log('=== Environment Variables Check ===');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ SET' : '✗ MISSING');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓ SET' : '✗ MISSING');
console.log('GL_API_TOKEN:', process.env.GL_API_TOKEN ? '✓ SET' : '✗ MISSING');
console.log('GL_PROFILE_ID:', process.env.GL_PROFILE_ID ? '✓ SET' : '✗ MISSING');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('=====================================');

// Configuration with validation
const CONFIG = {
  GL_API_TOKEN: process.env.GL_API_TOKEN,
  GL_PROFILE_ID: process.env.GL_PROFILE_ID,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  MAX_PAGES: parseInt(process.env.MAX_PAGES) || 19,
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS) || 5000,
};

// Validate required environment variables
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GL_API_TOKEN', 'GL_PROFILE_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  console.error('Please set these in Railway environment variables.');
  process.exit(1);
}

console.log('✅ All required environment variables are set');

// Create Supabase client
let supabase;
try {
  supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);
  console.log('✅ Supabase client created successfully');
} catch (error) {
  console.error('❌ Failed to create Supabase client:', error.message);
  process.exit(1);
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Update session status in database
 */
async function updateSession(sessionId, updates) {
  const { error } = await supabase
    .from('gtl_scraper_sessions')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) {
    console.error(`[Session ${sessionId}] Failed to update:`, error.message);
  }
}

/**
 * Update job status
 */
async function updateJob(jobId, updates) {
  const { error } = await supabase
    .from('scraper_jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error(`[Job ${jobId}] Failed to update:`, error.message);
  }
}

/**
 * Save policies to database in batches
 */
async function savePolicies(jobId, policies) {
  const batchSize = 50;
  let saved = 0;

  for (let i = 0; i < policies.length; i += batchSize) {
    const batch = policies.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('gtl_scraped_policies')
      .insert(batch.map(p => ({
        job_id: jobId,
        policy_number: p.policyNumber,
        applicant_name: p.insured,
        plan_name: p.plan,
        plan_code: p.planCode,
        face_amount: p.amount,
        premium: p.premium,
        status: p.status,
        updated_date: p.updated,
        issue_date: p.issueDate,
        application_date: p.applicationDate,
        dob: p.dob,
        gender: p.gender,
        age: p.age,
        state: p.state,
        agent_name: p.agent,
        agent_number: p.agentNumber,
        notes: p.notes,
      })));

    if (error) {
      console.error(`[Batch ${i}] Failed to save:`, error.message);
      throw error;
    }

    saved += batch.length;
    console.log(`  ✓ Saved ${saved}/${policies.length} policies`);
  }

  return saved;
}

/**
 * Scrape GTL Portal - Multi-page extraction
 * (Based on test-gtl-login.js logic)
 */
async function scrapeGTL(page, sessionId, jobId) {
  console.log(`[Session ${sessionId}] Starting multi-page scraping...`);
  
  const allPolicies = [];
  const totalPages = CONFIG.MAX_PAGES;

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    console.log(`[Session ${sessionId}] Scraping page ${pageNum}/${totalPages}...`);

    // Navigate to page (skip page 1 if already there)
    if (pageNum > 1) {
      await page.goto(`https://gtlink.gtlic.com/MyBusiness?page=${pageNum}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });
      await sleep(2000);
    }

    // Extract policies from current page
    const pagePolicies = await page.evaluate(() => {
      const results = [];
      const mainRows = document.querySelectorAll('.DivTableRow[id^="GTL"]');
      
      mainRows.forEach(row => {
        try {
          const policyId = row.id;
          
          // Extract main row data
          const cols = row.querySelectorAll('[class*="col-"]');
          const updated = cols[0]?.innerText.trim() || '';
          const policyNumber = cols[1]?.innerText.trim() || '';
          const plan = cols[2]?.innerText.trim() || '';
          const insured = cols[3]?.innerText.trim() || '';
          const amount = cols[4]?.innerText.trim() || '';
          const status = cols[5]?.innerText.trim() || '';
          
          // Find detail section
          const detailDiv = document.querySelector(`div.DivTableDetail[aria-labelledby="${policyId}"]`);
          
          let issueDate = '', applicationDate = '', premium = '', state = '';
          let agent = '', agentNumber = '', planCode = '';
          let applicantName = '', ssn = '', dob = '', gender = '', age = '';
          let notes = '';
          
          if (detailDiv) {
            const detailText = detailDiv.innerText;
            
            const issueDateMatch = detailText.match(/Issue Date:\s*(\d{2}\/\d{2}\/\d{2})/);
            if (issueDateMatch) issueDate = issueDateMatch[1];
            
            const appDateMatch = detailText.match(/Application Date:\s*(\d{2}\/\d{2}\/\d{2})/);
            if (appDateMatch) applicationDate = appDateMatch[1];
            
            const premiumMatch = detailText.match(/Premium:\s*\$?([\d,]+\.?\d*)/);
            if (premiumMatch) premium = premiumMatch[1];
            
            const stateMatch = detailText.match(/State:\s*([A-Z]{2})/);
            if (stateMatch) state = stateMatch[1];
            
            const agentMatch = detailText.match(/Agent:\s*([^\n]+)/);
            if (agentMatch) agent = agentMatch[1].trim();
            
            const agentNumMatch = detailText.match(/Agent #:\s*([^\n]+)/);
            if (agentNumMatch) agentNumber = agentNumMatch[1].trim();
            
            const planCodeMatch = detailText.match(/Plan Code:\s*([^\n]+)/);
            if (planCodeMatch) planCode = planCodeMatch[1].trim();
            
            const innerTable = detailDiv.querySelector('table');
            if (innerTable) {
              const dataRow = innerTable.querySelector('tr:nth-child(2)');
              if (dataRow) {
                const cells = dataRow.querySelectorAll('td');
                if (cells.length >= 5) {
                  applicantName = cells[0]?.innerText.trim() || '';
                  ssn = cells[1]?.innerText.trim() || '';
                  dob = cells[2]?.innerText.trim() || '';
                  gender = cells[3]?.innerText.trim() || '';
                  age = cells[4]?.innerText.trim() || '';
                }
              }
            }
            
            const notesTextarea = detailDiv.querySelector('textarea.MyBusinessNotes');
            if (notesTextarea) {
              notes = notesTextarea.value || notesTextarea.innerText || '';
            }
          }
          
          results.push({
            policyNumber,
            updated,
            plan,
            insured,
            amount,
            status,
            issueDate,
            applicationDate,
            premium,
            state,
            agent,
            agentNumber,
            planCode,
            applicantName,
            ssn,
            dob,
            gender,
            age,
            notes: notes.trim()
          });
          
        } catch (err) {
          console.error('Error extracting row:', err);
        }
      });
      
      return results;
    });

    console.log(`  ✓ Page ${pageNum}: Extracted ${pagePolicies.length} policies`);
    allPolicies.push(...pagePolicies);

    // Update progress in real-time
    await updateSession(sessionId, {
      current_page: pageNum,
      scraped_count: allPolicies.length,
    });

    await updateJob(jobId, {
      scraped_records: allPolicies.length,
      progress: Math.round((pageNum / totalPages) * 100),
    });

    // Delay between pages
    if (pageNum < totalPages) {
      await sleep(1500);
    }
  }

  return allPolicies;
}

/**
 * Process a scraping session
 */
async function processSession(session) {
  const sessionId = session.id;
  const jobId = session.job_id;
  
  console.log(`\n[Session ${sessionId}] Processing...`);
  
  // Double-check session is still ready (in case another worker picked it up)
  const { data: currentSession } = await supabase
    .from('gtl_scraper_sessions')
    .select('status')
    .eq('id', sessionId)
    .single();
    
  if (currentSession?.status !== 'ready') {
    console.log(`[Session ${sessionId}] Session status changed to ${currentSession?.status}, skipping`);
    return;
  }
  
  let GL;
  let browser = null;
  
  try {
    // Update to scraping status
    await updateSession(sessionId, { status: 'scraping', current_page: 1 });
    await updateJob(jobId, { status: 'in_progress', started_at: new Date().toISOString() });

    // Start GoLogin browser with retry logic
    console.log(`[Session ${sessionId}] Starting GoLogin browser...`);
    
    let wsUrl;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        GL = new GoLogin({
          token: CONFIG.GL_API_TOKEN,
          profile_id: CONFIG.GL_PROFILE_ID,
          // Don't restore last session to avoid issues with empty/corrupted sessions
          // extra_params: ['--restore-last-session']
        });
        
        console.log(`[Session ${sessionId}] GoLogin startup attempt ${retryCount + 1}/${maxRetries}`);
        const startupResult = await GL.start();
        wsUrl = startupResult.wsUrl;
        
        console.log(`[Session ${sessionId}] GoLogin started successfully`);
        break;
        
      } catch (error) {
        retryCount++;
        console.error(`[Session ${sessionId}] GoLogin startup failed (attempt ${retryCount}/${maxRetries}):`, error.message);
        
        if (GL) {
          try {
            await GL.stop();
          } catch (stopError) {
            console.error(`[Session ${sessionId}] Error stopping failed GL instance:`, stopError.message);
          }
          GL = null;
        }
        
        if (retryCount < maxRetries) {
          console.log(`[Session ${sessionId}] Retrying in 10 seconds...`);
          await sleep(10000);
        } else {
          throw new Error(`GoLogin startup failed after ${maxRetries} attempts: ${error.message}`);
        }
      }
    }
    
    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      ignoreHTTPSErrors: true,
    });
    
    console.log(`[Session ${sessionId}] Browser connected successfully`);

    // Find the GTL tab (user already logged in)
    const pages = await browser.pages();
    console.log(`[Session ${sessionId}] Found ${pages.length} open tabs`);
    
    let gtlPage = null;
    
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const url = p.url();
      const title = await p.title();
      console.log(`[Session ${sessionId}] Tab ${i + 1}: ${title} - ${url}`);
      
      if (url.includes('gtlink.gtlic.com') || url.includes('gtlic.com')) {
        gtlPage = p;
        break;
      }
    }

    if (!gtlPage) {
      // If no GTL page found, navigate to GTL login page
      console.log(`[Session ${sessionId}] No GTL page found, navigating to login page...`);
      
      // Get the first page (usually the default empty page)
      const firstPage = pages[0] || (await browser.newPage());
      
      try {
        console.log(`[Session ${sessionId}] Navigating to GTL portal...`);
        await firstPage.goto('https://gtlink.gtlic.com/MyBusiness', { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });
        
        console.log(`[Session ${sessionId}] Page loaded: ${firstPage.url()}`);
        
        // Wait a bit for any redirects or initial load
        await sleep(3000);
        
        // Check if we're on a GTL page now
        const currentUrl = firstPage.url();
        if (currentUrl.includes('gtlink.gtlic.com') || currentUrl.includes('gtlic.com')) {
          gtlPage = firstPage;
          console.log(`[Session ${sessionId}] Successfully navigated to GTL page`);
        } else {
          console.log(`[Session ${sessionId}] Current URL: ${currentUrl}`);
          throw new Error(`Navigated to ${currentUrl} but expected GTL portal. User may need to log in manually.`);
        }
        
      } catch (navError) {
        console.error(`[Session ${sessionId}] Failed to navigate to GTL:`, navError.message);
        throw new Error(`Could not access GTL portal. Please ensure you can manually access https://gtlink.gtlic.com/MyBusiness in your GoLogin profile. Error: ${navError.message}`);
      }
    }

    console.log(`[Session ${sessionId}] Found GTL page: ${gtlPage.url()}`);
    
    // Check if user is logged in by looking for policy data or login form
    try {
      const title = await gtlPage.title();
      console.log(`[Session ${sessionId}] Page title: ${title}`);
      
      // Wait for either policy data or login form to appear
      await gtlPage.waitForFunction(
        () => {
          // Check for policy table or login form
          const hasPolicyTable = document.querySelector('.policy-table, [data-testid*="policy"], .table, tbody tr');
          const hasLoginForm = document.querySelector('input[name="username"], input[name="password"], form[action*="login"]');
          const hasError = document.querySelector('.error, .alert-danger');
          
          return hasPolicyTable || hasLoginForm || hasError;
        },
        { timeout: 10000 }
      );
      
      console.log(`[Session ${sessionId}] Page content loaded`);
      
    } catch (waitError) {
      console.log(`[Session ${sessionId}] Page may still be loading, continuing...`);
    }

    // Scrape all pages
    const policies = await scrapeGTL(gtlPage, sessionId, jobId);
    
    console.log(`[Session ${sessionId}] Scraped ${policies.length} policies total`);

    // Save to database
    console.log(`[Session ${sessionId}] Saving to database...`);
    await savePolicies(jobId, policies);

    // Update to completed
    await updateSession(sessionId, {
      status: 'completed',
      scraped_count: policies.length,
    });

    await updateJob(jobId, {
      status: 'completed',
      total_records: policies.length,
      scraped_records: policies.length,
      completed_at: new Date().toISOString(),
      progress: 100,
    });

    console.log(`[Session ${sessionId}] ✓ Completed successfully!`);

  } catch (error) {
    console.error(`[Session ${sessionId}] Error:`, error.message);
    
    await updateSession(sessionId, {
      status: 'failed',
      error_message: error.message,
    });

    await updateJob(jobId, {
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    });

  } finally {
    if (browser) {
      await browser.close();
    }
    if (GL) {
      await GL.stop();
    }
  }
}

/**
 * Watch for sessions ready to scrape
 */
async function watchSessions() {
  console.log('[Worker] Starting GTL scraper worker...');
  console.log(`[Worker] Polling every ${CONFIG.POLL_INTERVAL_MS}ms`);
  
  while (true) {
    try {
      // Query for 'ready' sessions
      const { data: sessions, error } = await supabase
        .from('gtl_scraper_sessions')
        .select('*')
        .eq('status', 'ready')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('[Worker] Error querying sessions:', error.message);
      } else if (sessions && sessions.length > 0) {
        const session = sessions[0];
        console.log(`[Worker] Found ready session: ${session.id} (created: ${session.created_at})`);
        await processSession(session);
      }

    } catch (error) {
      console.error('[Worker] Unexpected error:', error);
    }

    await sleep(CONFIG.POLL_INTERVAL_MS);
  }
}

// Start the worker
watchSessions().catch(error => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});

/**
 * GTL Carrier Portal Scraper Service with GoLogin Cloud Browser
 * 
 * This service watches the database for pending GTL scraping jobs and processes them
 * using GoLogin cloud browser with VPN to scrape GTL portal.
 * Scraped data is stored in the gtl_scraped_policies table.
 */

import { GologinApi } from 'gologin';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Configuration
const CONFIG = {
  // GoLogin Cloud Browser
  GL_API_TOKEN: process.env.GL_API_TOKEN || '',
  GL_PROFILE_ID: process.env.GL_PROFILE_ID || null, // Optional: use specific profile with VPN
  GL_CLOUD: true,
  
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // GTL Portal (Only carrier we support)
  GTL_LOGIN_URL: process.env.GTL_LOGIN_URL || 'https://eapp.gtlic.com/',
  GTL_MY_BUSINESS_URL: process.env.GTL_MY_BUSINESS_URL || 'https://gtlink.gtlic.com/MyBusiness',
  GTL_USERNAME: process.env.GTL_USERNAME || '',
  GTL_PASSWORD: process.env.GTL_PASSWORD || '',

  // Scraper settings
  MAX_PAGES: parseInt(process.env.MAX_PAGES || '18'),
  RATE_LIMIT_MS: parseInt(process.env.RATE_LIMIT_MS || '1000'),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '10000'), // 10 seconds
};

// Initialize Supabase client
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY);

/**
 * Update scraper job status in database
 */
async function updateJobStatus(jobId, status, updates = {}) {
  const { error } = await supabase
    .from('scraper_jobs')
    .update({ 
      status, 
      updated_at: new Date().toISOString(), 
      ...updates 
    })
    .eq('id', jobId);

  if (error) {
    console.error(`[Job ${jobId}] Failed to update status:`, error.message);
  }
}

/**
 * Save GTL scraped policies to dedicated table in batches
 */
async function saveGTLPolicies(jobId, policies) {
  const batchSize = 100;
  let saved = 0;

  for (let i = 0; i < policies.length; i += batchSize) {
    const batch = policies.slice(i, i + batchSize);
    
    const { error } = await supabase
      .from('gtl_scraped_policies')
      .insert(batch.map(p => ({ 
        job_id: jobId,
        policy_number: p.policy_number,
        applicant_name: p.applicant_name,
        plan_name: p.plan_name,
        plan_code: p.plan_code,
        face_amount: p.face_amount,
        premium: p.premium,
        status: p.status,
        updated_date: p.updated_date,
        issue_date: p.issue_date,
        application_date: p.application_date,
        dob: p.dob,
        gender: p.gender,
        age: p.age,
        state: p.state,
        agent_name: p.agent_name,
        agent_number: p.agent_number,
        notes: p.notes,
      })));

    if (error) {
      console.error(`[Job ${jobId}] Failed to save batch:`, error.message);
      throw error;
    }

    saved += batch.length;
    console.log(`[Job ${jobId}] Saved ${saved}/${policies.length} policies to gtl_scraped_policies table`);
  }

  return saved;
}

/**
 * Extract detailed information from expanded GTL row
 */
async function extractGTLDetailedInfo(page, policyId) {
  try {
    const details = await page.evaluate((id) => {
      const detailDiv = document.querySelector(`[name="${id}"]`)?.closest('.DivTableDetail');
      if (!detailDiv) return null;

      const rows = detailDiv.querySelectorAll('div.row');
      let issueDate = '', appDate = '', premium = '', state = '';
      let agent = '', agentNum = '', planCode = '';
      let dob = '', gender = '', age = '', notes = '';

      // Extract from info rows
      if (rows.length > 0) {
        const firstRow = rows[0].textContent;
        const match = firstRow.match(/Issue Date:\s*(\S+).*Application Date:\s*(\S+).*Premium:\s*(\S+).*State:\s*(\S+)/);
        if (match) {
          issueDate = match[1];
          appDate = match[2];
          premium = match[3];
          state = match[4];
        }
      }

      if (rows.length > 1) {
        const secondRow = rows[1].textContent;
        const match = secondRow.match(/Agent:\s*(\S+.*?)\s+Agent #:\s*(\S+).*Plan Code:\s*(\S+)/);
        if (match) {
          agent = match[1].trim();
          agentNum = match[2];
          planCode = match[3];
        }
      }

      // Extract from table
      const tableRows = detailDiv.querySelectorAll('table tr');
      if (tableRows.length > 1) {
        const dataCells = tableRows[1].querySelectorAll('td');
        if (dataCells.length >= 5) {
          dob = dataCells[2]?.textContent?.trim() || '';
          gender = dataCells[3]?.textContent?.trim() || '';
          age = dataCells[4]?.textContent?.trim() || '';
        }
      }

      // Extract notes
      const notesArea = detailDiv.querySelector('.MyBusinessNotes');
      notes = notesArea?.textContent?.trim() || '';

      return {
        issueDate, appDate, premium, state, agent, agentNum, 
        planCode, dob, gender, age, notes
      };
    }, policyId);

    return details;
  } catch (err) {
    console.error(`Error extracting details for ${policyId}:`, err);
    return null;
  }
}

/**
 * Scrape GTL Portal (all pages)
 */
async function scrapeGTLPortal(page, jobId) {
  console.log(`[Job ${jobId}] Starting GTL scraping...`);
  
  // Login to GTL Portal
  console.log(`[Job ${jobId}] Navigating to GTL login...`);
  await page.goto(CONFIG.GTL_LOGIN_URL, { waitUntil: 'networkidle2' });

  console.log(`[Job ${jobId}] Logging in to GTL...`);
  await page.type('input[name="username"]', CONFIG.GTL_USERNAME);
  await page.type('input[name="password"]', CONFIG.GTL_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });

  // Navigate to Recent Business page
  console.log(`[Job ${jobId}] Navigating to GTL Recent Business...`);
  await page.goto(CONFIG.GTL_MY_BUSINESS_URL, { waitUntil: 'networkidle2' });

  // Scrape all pages
  const allPolicies = [];
  let pageNum = 1;

  while (pageNum <= CONFIG.MAX_PAGES) {
    console.log(`[Job ${jobId}] Scraping GTL page ${pageNum}...`);

    // Wait for table to load
    await page.waitForSelector('.DivTableRow', { timeout: 10000 }).catch(() => {});

    // Extract all policy rows on current page
    const pageData = await page.evaluate(() => {
      const rows = document.querySelectorAll('.DivTableRow');
      return Array.from(rows).map(row => {
        const cols = row.querySelectorAll('[class*="col-"]');
        return {
          updated: cols[0]?.textContent?.trim() || '',
          policy: cols[1]?.textContent?.trim() || '',
          plan: cols[2]?.textContent?.trim() || '',
          insured: cols[3]?.textContent?.trim() || '',
          amount: cols[4]?.textContent?.trim() || '',
          status: cols[5]?.textContent?.trim() || '',
          policyId: row.getAttribute('data-policy'),
        };
      });
    });

    // Extract detailed info for each policy
    for (const data of pageData) {
      const details = await extractGTLDetailedInfo(page, data.policyId);
      if (details) {
        allPolicies.push({
          policy_number: data.policy,
          applicant_name: data.insured,
          plan_name: data.plan,
          plan_code: details.planCode,
          face_amount: data.amount,
          premium: details.premium,
          status: data.status,
          updated_date: data.updated,
          issue_date: details.issueDate,
          application_date: details.appDate,
          dob: details.dob,
          gender: details.gender,
          age: details.age,
          state: details.state,
          agent_name: details.agent,
          agent_number: details.agentNum,
          notes: details.notes,
        });
      }

      // Update progress
      await updateJobStatus(jobId, 'in_progress', {
        scraped_records: allPolicies.length,
        progress: Math.round((pageNum / CONFIG.MAX_PAGES) * 100),
      });
    }

    // Navigate to next page if available
    if (pageNum < CONFIG.MAX_PAGES) {
      const nextButton = await page.$(`a[href="/MyBusiness?page=${pageNum + 1}"]`);
      if (nextButton) {
        await nextButton.click();
        await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
        await new Promise(resolve => setTimeout(resolve, CONFIG.RATE_LIMIT_MS));
      } else {
        console.log(`[Job ${jobId}] No more pages found at page ${pageNum}`);
        break;
      }
    }

    pageNum++;
  }

  console.log(`[Job ${jobId}] ✓ Scraped ${allPolicies.length} GTL policies`);
  return allPolicies;
}

/**
 * Process a single GTL scraping job with GoLogin
 */
async function processJob(job) {
  const jobId = job.id;
  const carrierName = job.carrier_name;

  console.log(`\n[Job ${jobId}] Processing ${carrierName} scraping job...`);

  // Validate that this is a GTL job
  if (carrierName.toUpperCase() !== 'GTL') {
    const errorMsg = `Only GTL carrier is supported. Received: ${carrierName}`;
    console.error(`[Job ${jobId}] ${errorMsg}`);
    await updateJobStatus(jobId, 'failed', {
      error_message: errorMsg,
      completed_at: new Date().toISOString(),
    });
    return;
  }

  const gologin = GologinApi({
    token: CONFIG.GL_API_TOKEN,
  });

  try {
    // Update status to in_progress
    await updateJobStatus(jobId, 'in_progress', {
      started_at: new Date().toISOString(),
      progress: 0,
    });

    // Launch GoLogin cloud browser
    console.log(`[Job ${jobId}] Launching GoLogin cloud browser...`);
    const { browser } = await gologin.launch({
      cloud: CONFIG.GL_CLOUD,
      ...(CONFIG.GL_PROFILE_ID && { profileId: CONFIG.GL_PROFILE_ID }),
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Scrape GTL portal
    console.log(`[Job ${jobId}] Starting GTL portal scraping...`);
    const policies = await scrapeGTLPortal(page, jobId);

    // Save to GTL-specific database table
    console.log(`[Job ${jobId}] Saving ${policies.length} policies to gtl_scraped_policies table...`);
    await saveGTLPolicies(jobId, policies);

    // Update job as completed
    await updateJobStatus(jobId, 'completed', {
      completed_at: new Date().toISOString(),
      total_records: policies.length,
      scraped_records: policies.length,
      progress: 100,
    });

    console.log(`[Job ${jobId}] ✓ GTL scraping completed successfully!`);

    await browser.close();

  } catch (error) {
    console.error(`[Job ${jobId}] Error:`, error);
    
    await updateJobStatus(jobId, 'failed', {
      error_message: error.message,
      completed_at: new Date().toISOString(),
    });

  } finally {
    await gologin.exit();
  }
}

/**
 * Watch for pending GTL scraping jobs and process them
 */
async function watchForJobs() {
  console.log('[GTL Scraper] Starting job watcher with GoLogin cloud browser...');
  console.log(`[GTL Scraper] Polling interval: ${CONFIG.POLL_INTERVAL_MS}ms`);
  console.log(`[GTL Scraper] GoLogin Profile ID: ${CONFIG.GL_PROFILE_ID || 'Default (will create new)'}`);
  console.log(`[GTL Scraper] Target: GTL carrier only`);

  while (true) {
    try {
      // Query for pending GTL jobs only
      const { data: jobs, error } = await supabase
        .from('scraper_jobs')
        .select('*')
        .eq('status', 'pending')
        .eq('carrier_name', 'GTL')
        .order('created_at', { ascending: true })
        .limit(1);

      if (error) {
        console.error('[GTL Scraper] Error querying jobs:', error.message);
      } else if (jobs && jobs.length > 0) {
        // Process the first pending GTL job
        await processJob(jobs[0]);
      }

    } catch (error) {
      console.error('[GTL Scraper] Unexpected error:', error);
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, CONFIG.POLL_INTERVAL_MS));
  }
}

// Start watching for GTL jobs
watchForJobs().catch(error => {
  console.error('[GTL Scraper] Fatal error:', error);
  process.exit(1);
});

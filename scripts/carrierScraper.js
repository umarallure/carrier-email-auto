/**
 * Carrier Portal Web Scraper
 * Uses Puppeteer to automate browser-based scraping of insurance carrier portals
 * Stores scraped data in Supabase and optionally exports to Google Sheets
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// Configuration from environment variables
const CONFIG = {
  // Supabase
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,

  // Carrier credentials
  GTL_USERNAME: process.env.GTL_USERNAME,
  GTL_PASSWORD: process.env.GTL_PASSWORD,
  GTL_LOGIN_URL: process.env.GTL_LOGIN_URL || 'https://yourgtlportal.com/login',
  GTL_PORTAL_URL: process.env.GTL_PORTAL_URL || 'https://yourgtlportal.com/MyBusiness',

  ANAM_USERNAME: process.env.ANAM_USERNAME,
  ANAM_PASSWORD: process.env.ANAM_PASSWORD,

  AETNA_USERNAME: process.env.AETNA_USERNAME,
  AETNA_PASSWORD: process.env.AETNA_PASSWORD,

  // Puppeteer options
  HEADLESS: process.env.HEADLESS !== 'false',
  TIMEOUT: parseInt(process.env.TIMEOUT || '30000'),
  RATE_LIMIT_MS: parseInt(process.env.RATE_LIMIT_MS || '1000'),
};

// Initialize Supabase client
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/**
 * Update scraper job status
 */
async function updateJobStatus(jobId, status, updates = {}) {
  const { error } = await supabase
    .from('scraper_jobs')
    .update({ status, updated_at: new Date().toISOString(), ...updates })
    .eq('id', jobId);

  if (error) {
    console.error('[Scraper] Error updating job status:', error);
  }
}

/**
 * Save scraped policies to database
 */
async function savePolicies(jobId, carrierName, policies) {
  try {
    const records = policies.map(policy => ({
      job_id: jobId,
      carrier_name: carrierName,
      policy_number: policy.policy_number,
      applicant_name: policy.applicant_name,
      plan_name: policy.plan_name,
      coverage_amount: policy.coverage_amount,
      status: policy.status,
      issue_date: policy.issue_date,
      application_date: policy.application_date,
      premium: policy.premium,
      state: policy.state,
      agent_name: policy.agent_name,
      agent_number: policy.agent_number,
      plan_code: policy.plan_code,
      date_of_birth: policy.date_of_birth,
      gender: policy.gender,
      age: policy.age,
      notes: policy.notes,
      last_updated: new Date().toISOString(),
      raw_data: policy.raw_data,
    }));

    const { error } = await supabase
      .from('scraped_policies')
      .insert(records);

    if (error) {
      throw new Error(`Failed to save policies: ${error.message}`);
    }

    console.log(`[Scraper] Saved ${records.length} policies for job ${jobId}`);
    return records.length;
  } catch (err) {
    console.error('[Scraper] Error saving policies:', err);
    throw err;
  }
}

/**
 * Scrape GTL Portal
 */
async function scrapeGTLPortal(browser, jobId) {
  const policies = [];
  let page;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(CONFIG.TIMEOUT);

    console.log('[GTL] Navigating to login page...');
    await page.goto(CONFIG.GTL_LOGIN_URL, { waitUntil: 'networkidle0' });

    // Login
    console.log('[GTL] Logging in...');
    await page.type('[name="username"]', CONFIG.GTL_USERNAME);
    await page.type('[name="password"]', CONFIG.GTL_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Navigate to Recent Business
    console.log('[GTL] Navigating to Recent Business...');
    await page.goto(CONFIG.GTL_PORTAL_URL, { waitUntil: 'networkidle0' });

    // Scrape pages
    let pageNum = 1;
    const maxPages = 18;

    while (pageNum <= maxPages) {
      console.log(`[GTL] Scraping page ${pageNum}...`);

      await page.waitForSelector('.DivTableRow', { timeout: 10000 }).catch(() => {});

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
          };
        });
      });

      for (const data of pageData) {
        policies.push({
          policy_number: data.policy,
          applicant_name: data.insured,
          plan_name: data.plan,
          coverage_amount: data.amount,
          status: data.status,
          last_updated: data.updated,
          raw_data: data,
        });
      }

      // Navigate to next page
      if (pageNum < maxPages) {
        const nextButton = await page.$(`a[href*="page=${pageNum + 1}"]`);
        if (nextButton) {
          await nextButton.click();
          await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
          await page.waitForTimeout(CONFIG.RATE_LIMIT_MS);
        } else {
          break;
        }
      }

      pageNum++;
    }

    return policies;

  } catch (error) {
    console.error('[GTL] Scraping error:', error);
    throw error;
  } finally {
    if (page) await page.close();
  }
}

/**
 * Scrape ANAM Portal
 */
async function scrapeANAMPortal(browser, jobId) {
  const policies = [];
  let page;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(CONFIG.TIMEOUT);

    console.log('[ANAM] Navigating to portal...');
    await page.goto('https://anamportal.com/login', { waitUntil: 'networkidle0' });

    // Login
    console.log('[ANAM] Logging in...');
    await page.type('[name="email"]', CONFIG.ANAM_USERNAME);
    await page.type('[name="password"]', CONFIG.ANAM_PASSWORD);
    await page.click('[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Navigate to policies page
    await page.goto('https://anamportal.com/policies', { waitUntil: 'networkidle0' });

    // Scrape policies
    const pageData = await page.evaluate(() => {
      const rows = document.querySelectorAll('tbody tr');
      return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        return {
          policy_number: cells[0]?.textContent?.trim() || '',
          applicant_name: cells[1]?.textContent?.trim() || '',
          plan_name: cells[2]?.textContent?.trim() || '',
          status: cells[3]?.textContent?.trim() || '',
          premium: cells[4]?.textContent?.trim() || '',
        };
      });
    });

    policies.push(...pageData);
    return policies;

  } catch (error) {
    console.error('[ANAM] Scraping error:', error);
    throw error;
  } finally {
    if (page) await page.close();
  }
}

/**
 * Scrape AETNA Portal
 */
async function scrapeAETNAPortal(browser, jobId) {
  const policies = [];
  let page;

  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setDefaultNavigationTimeout(CONFIG.TIMEOUT);

    console.log('[AETNA] Navigating to portal...');
    await page.goto('https://aetnaseniorproducts.com/login', { waitUntil: 'networkidle0' });

    // Login
    console.log('[AETNA] Logging in...');
    await page.type('[name="user"]', CONFIG.AETNA_USERNAME);
    await page.type('[name="password"]', CONFIG.AETNA_PASSWORD);
    await page.click('.login-btn');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });

    // Navigate to policies
    await page.goto('https://aetnaseniorproducts.com/agent-portal', { waitUntil: 'networkidle0' });

    // Scrape policies
    const pageData = await page.evaluate(() => {
      const cards = document.querySelectorAll('.policy-card');
      return Array.from(cards).map(card => ({
        policy_number: card.querySelector('[data-field="policy"]')?.textContent?.trim() || '',
        applicant_name: card.querySelector('[data-field="applicant"]')?.textContent?.trim() || '',
        plan_name: card.querySelector('[data-field="plan"]')?.textContent?.trim() || '',
        status: card.querySelector('[data-field="status"]')?.textContent?.trim() || '',
        coverage_amount: card.querySelector('[data-field="amount"]')?.textContent?.trim() || '',
      }));
    });

    policies.push(...pageData);
    return policies;

  } catch (error) {
    console.error('[AETNA] Scraping error:', error);
    throw error;
  } finally {
    if (page) await page.close();
  }
}

/**
 * Main scraping orchestration
 */
async function runScraperJob(jobId, carrierName) {
  let browser;

  try {
    console.log(`[Scraper] Starting job ${jobId} for ${carrierName}`);
    await updateJobStatus(jobId, 'in_progress', { started_at: new Date().toISOString() });

    browser = await puppeteer.launch({
      headless: CONFIG.HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    let policies = [];

    switch (carrierName) {
      case 'GTL':
        policies = await scrapeGTLPortal(browser, jobId);
        break;
      case 'ANAM':
        policies = await scrapeANAMPortal(browser, jobId);
        break;
      case 'AETNA':
        policies = await scrapeAETNAPortal(browser, jobId);
        break;
      default:
        throw new Error(`Unknown carrier: ${carrierName}`);
    }

    console.log(`[Scraper] Scraped ${policies.length} policies`);

    if (policies.length > 0) {
      await savePolicies(jobId, carrierName, policies);
    }

    await updateJobStatus(jobId, 'completed', {
      scraped_records: policies.length,
      total_records: policies.length,
      completed_at: new Date().toISOString(),
    });

    console.log(`[Scraper] Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`[Scraper] Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, 'failed', {
      error_message: error instanceof Error ? error.message : 'Unknown error',
      completed_at: new Date().toISOString(),
    });
  } finally {
    if (browser) await browser.close();
  }
}

/**
 * Watch for pending jobs and process them
 */
async function watchForJobs() {
  console.log('[Scraper] Watching for scraping jobs...');

  setInterval(async () => {
    try {
      const { data: pendingJobs, error } = await supabase
        .from('scraper_jobs')
        .select('*')
        .eq('status', 'pending')
        .limit(1);

      if (error) {
        console.error('[Scraper] Error fetching jobs:', error);
        return;
      }

      if (pendingJobs && pendingJobs.length > 0) {
        const job = pendingJobs[0];
        await runScraperJob(job.id, job.carrier_name);
      }
    } catch (err) {
      console.error('[Scraper] Error in job watcher:', err);
    }
  }, 10000); // Check every 10 seconds
}

// Start watching for jobs
if (require.main === module) {
  watchForJobs().catch(console.error);
}

module.exports = { runScraperJob, scrapeGTLPortal, scrapeANAMPortal, scrapeAETNAPortal };

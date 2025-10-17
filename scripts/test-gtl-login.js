/**
 * STEP 2: Manual GTL Navigation + Data Scraping
 * 
 * This script:
 * 1. Starts GoLogin browser profile
 * 2. Waits for you to manually login and navigate to My Business page
 * 3. You type "continue" when ready
 * 4. Script scrapes policy data from current page
 * 5. Can handle pagination (page=1, page=2, etc.)
 * 
 * Run: npm run test:step2
 */

import GoLogin from 'gologin';
import puppeteer from 'puppeteer-core';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';

dotenv.config();

const TEST_CONFIG = {
  apiToken: process.env.GL_API_TOKEN,
  profileId: process.env.GL_PROFILE_ID,
};

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper function to wait for user input
const waitForUserInput = () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question('\n⏸️  Type "continue" and press Enter when you are ready: ', (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
};

// Helper function to save data to CSV
const saveToCsv = (data, filename) => {
  if (data.length === 0) {
    console.log(`  ⚠ No data to save to ${filename}`);
    return;
  }

  // Get all unique keys from all objects
  const allKeys = new Set();
  data.forEach(obj => {
    Object.keys(obj).forEach(key => allKeys.add(key));
  });
  
  const headers = Array.from(allKeys);
  const csvContent = [
    headers.join(','),
    ...data.map(obj => 
      headers.map(header => {
        const value = obj[header] || '';
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(`  ✓ Saved ${data.length} records to ${filename}`);
};

console.log('=================================');
console.log('🧪 STEP 2: Manual Navigation + Scraping');
console.log('=================================\n');

async function testGTLLogin() {
  let GL;
  let browser = null;
  let page = null;
  
  try {
    // CHECKPOINT 1: Start GoLogin browser
    console.log('✓ Checkpoint 1: Starting GoLogin browser...');
    console.log('  Profile ID:', TEST_CONFIG.profileId);
    
    GL = new GoLogin({
      token: TEST_CONFIG.apiToken,
      profile_id: TEST_CONFIG.profileId,
    });
    
    const { wsUrl } = await GL.start();
    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      ignoreHTTPSErrors: true,
    });
    
    // Don't create a new page, use the existing one
    const pages = await browser.pages();
    page = pages[0]; // Use first existing page
    console.log('  ✅ Browser started successfully!');
    console.log(`  ℹ Found ${pages.length} existing page(s)\n`);

    // CHECKPOINT 2: Wait for manual navigation
    console.log('✓ Checkpoint 2: Manual navigation required');
    console.log('=================================');
    console.log('📋 INSTRUCTIONS:');
    console.log('1. The browser window is now open');
    console.log('2. Please manually:');
    console.log('   - Login to GTL portal');
    console.log('   - Navigate to: https://gtlink.gtlic.com/MyBusiness');
    console.log('   - Wait for the page to fully load');
    console.log('3. When you\'re ready, type "continue" below');
    console.log('=================================\n');

    // Wait for user to type "continue"
    let userInput = '';
    while (userInput !== 'continue') {
      userInput = await waitForUserInput();
      if (userInput !== 'continue') {
        console.log('❌ Please type "continue" (without quotes) to proceed\n');
      }
    }

    console.log('\n✅ Continuing with scraping...\n');

    // CHECKPOINT 3: Find the correct tab with GTL data
    console.log('✓ Checkpoint 3: Finding tab with GTL data...');
    const allPages = await browser.pages();
    console.log(`  ℹ Total tabs open: ${allPages.length}`);
    
    // Close any about:blank tabs
    for (const p of allPages) {
      const url = p.url();
      if (url === 'about:blank' || url === '') {
        console.log(`  ✓ Closing blank tab`);
        await p.close();
      }
    }
    
    // Find the tab with gtlink.gtlic.com
    const updatedPages = await browser.pages();
    let gtlPage = null;
    
    for (const p of updatedPages) {
      const url = p.url();
      console.log(`  ℹ Checking tab: ${url}`);
      if (url.includes('gtlink.gtlic.com')) {
        gtlPage = p;
        console.log(`  ✅ Found GTL tab!`);
        break;
      }
    }
    
    if (!gtlPage) {
      // If no GTL tab, use the first available tab
      gtlPage = updatedPages[0];
      console.log(`  ⚠ No GTL tab found, using first available tab`);
    }
    
    page = gtlPage;
    const currentUrl = page.url();
    console.log(`  ✓ Active tab URL: ${currentUrl}\n`);

    // CHECKPOINT 4: Get current page info
    console.log('✓ Checkpoint 4: Analyzing current page...');
    
    await page.screenshot({ 
      path: 'test-gtl-before-scraping.png',
      fullPage: true 
    });
    console.log('  ✓ Screenshot: test-gtl-before-scraping.png');

    const finalUrl = page.url();
    console.log(`  URL: ${finalUrl}`);

    // Check if we're on the My Business page
    if (!finalUrl.includes('gtlink.gtlic.com')) {
      console.log('  ⚠ Warning: Not on gtlink.gtlic.com domain');
      console.log('  Current URL:', finalUrl);
    }

    // CHECKPOINT 5: Extract policies from ALL pages
    console.log('\n✓ Checkpoint 5: Scraping policies from ALL pages...');
    console.log('  This will iterate through all 19 pages and extract data\n');
    
    let allPolicies = [];
    const maxPages = 19;
    
    for (let currentPageNum = 1; currentPageNum <= maxPages; currentPageNum++) {
      // Navigate to page (skip for page 1 since we're already there)
      if (currentPageNum > 1) {
        const pageUrl = `https://gtlink.gtlic.com/MyBusiness?page=${currentPageNum}`;
        console.log(`  📄 Loading page ${currentPageNum}/${maxPages}...`);
        
        await page.goto(pageUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
        
        await sleep(2000);
      } else {
        console.log(`  📄 Processing page ${currentPageNum}/${maxPages}...`);
      }

      // Extract policies from this page
      const pagePolicies = await page.evaluate(() => {
        const results = [];
        
        // Find all main table rows with policy data
        const mainRows = document.querySelectorAll('.DivTableRow[id^="GTL"]');
        
        mainRows.forEach(row => {
          try {
            const policyId = row.id;
            
            // Extract main row data from col-* divs
            const cols = row.querySelectorAll('[class*="col-"]');
            const updated = cols[0]?.innerText.trim() || '';
            const policyNumber = cols[1]?.innerText.trim() || '';
            const plan = cols[2]?.innerText.trim() || '';
            const insured = cols[3]?.innerText.trim() || '';
            const amount = cols[4]?.innerText.trim() || '';
            const status = cols[5]?.innerText.trim() || '';
            
            // Find the corresponding detail section
            const detailDiv = document.querySelector(`div.DivTableDetail[aria-labelledby="${policyId}"]`);
            
            let issueDate = '';
            let applicationDate = '';
            let premium = '';
            let state = '';
            let agent = '';
            let agentNumber = '';
            let planCode = '';
            let applicantName = '';
            let ssn = '';
            let dob = '';
            let gender = '';
            let age = '';
            let notes = '';
            
            if (detailDiv) {
              // Extract additional details
              const detailText = detailDiv.innerText;
              
              // Parse Issue Date
              const issueDateMatch = detailText.match(/Issue Date:\s*(\d{2}\/\d{2}\/\d{2})/);
              if (issueDateMatch) issueDate = issueDateMatch[1];
              
              // Parse Application Date
              const appDateMatch = detailText.match(/Application Date:\s*(\d{2}\/\d{2}\/\d{2})/);
              if (appDateMatch) applicationDate = appDateMatch[1];
              
              // Parse Premium
              const premiumMatch = detailText.match(/Premium:\s*\$?([\d,]+\.?\d*)/);
              if (premiumMatch) premium = premiumMatch[1];
              
              // Parse State
              const stateMatch = detailText.match(/State:\s*([A-Z]{2})/);
              if (stateMatch) state = stateMatch[1];
              
              // Parse Agent
              const agentMatch = detailText.match(/Agent:\s*([^\n]+)/);
              if (agentMatch) agent = agentMatch[1].trim();
              
              // Parse Agent #
              const agentNumMatch = detailText.match(/Agent #:\s*([^\n]+)/);
              if (agentNumMatch) agentNumber = agentNumMatch[1].trim();
              
              // Parse Plan Code
              const planCodeMatch = detailText.match(/Plan Code:\s*([^\n]+)/);
              if (planCodeMatch) planCode = planCodeMatch[1].trim();
              
              // Extract applicant details from inner table
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
              
              // Extract notes
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

      console.log(`  ✅ Page ${currentPageNum}: Extracted ${pagePolicies.length} policies`);
      allPolicies = allPolicies.concat(pagePolicies);
      
      // Small delay between pages
      if (currentPageNum < maxPages) {
        await sleep(1500);
      }
    }

    // CHECKPOINT 6: Save to CSV
    console.log(`\n✓ Checkpoint 6: Saving ${allPolicies.length} policies to CSV...`);
    
    const csvFilename = `gtl-policies-${new Date().toISOString().split('T')[0]}.csv`;
    saveToCsv(allPolicies, csvFilename);

    // SUCCESS
    console.log('\n=================================');
    console.log('✅ ALL PAGES SCRAPED & SAVED!');
    console.log('=================================');
    console.log(`Total pages: ${maxPages}`);
    console.log(`Total policies extracted: ${allPolicies.length}`);
    console.log(`CSV file: ${csvFilename}`);
    console.log(`Average per page: ${Math.round(allPolicies.length / maxPages)}`);
    
    if (allPolicies.length > 0) {
      console.log('\n✓ Sample policies (first 3):');
      allPolicies.slice(0, 3).forEach((policy, i) => {
        console.log(`\n  Policy ${i + 1}:`);
        console.log(`    Policy #: ${policy.policyNumber}`);
        console.log(`    Updated: ${policy.updated}`);
        console.log(`    Plan: ${policy.plan}`);
        console.log(`    Insured: ${policy.insured}`);
        console.log(`    Amount: ${policy.amount}`);
        console.log(`    Status: ${policy.status}`);
        console.log(`    Issue Date: ${policy.issueDate}`);
        console.log(`    Application Date: ${policy.applicationDate}`);
        console.log(`    Premium: ${policy.premium}`);
        console.log(`    State: ${policy.state}`);
        console.log(`    Agent: ${policy.agent}`);
        console.log(`    Agent #: ${policy.agentNumber}`);
        console.log(`    Plan Code: ${policy.planCode}`);
        console.log(`    Applicant: ${policy.applicantName}`);
        console.log(`    SSN: ${policy.ssn}`);
        console.log(`    DOB: ${policy.dob}`);
        console.log(`    Gender: ${policy.gender}`);
        console.log(`    Age: ${policy.age}`);
        if (policy.notes) console.log(`    Notes: ${policy.notes.substring(0, 100)}...`);
      });
    }
    
    console.log('\n=================================\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('=================================');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    
    // Take error screenshot if page exists
    if (page) {
      try {
        await page.screenshot({ path: 'test-gtl-ERROR.png', fullPage: true });
        console.error('\n📸 Error screenshot saved to: test-gtl-ERROR.png');
      } catch (e) {
        // Ignore screenshot errors
      }
    }
    
    console.error('\n=================================');
    process.exit(1);
  } finally {
    // Cleanup - keeping browser open for manual inspection
    console.log('\n✓ Keeping browser open for inspection...');
    console.log('  Press Ctrl+C to close and cleanup\n');
    
    // Wait indefinitely until user closes
    await new Promise(() => {});
  }
}

// Run the test
testGTLLogin();

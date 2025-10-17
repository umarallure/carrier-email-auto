/**
 * STEP 1: Test GoLogin Browser Launch
 * 
 * This script tests:
 * 1. GoLogin API connection
 * 2. Browser profile launch
 * 3. Basic navigation to google.com
 * 4. Screenshot capture
 * 
 * Run: node scripts/test-gologin.js
 */

import GoLogin from 'gologin';
import puppeteer from 'puppeteer-core';
import dotenv from 'dotenv';

dotenv.config();

const TEST_CONFIG = {
  apiToken: process.env.GL_API_TOKEN,
  profileId: process.env.GL_PROFILE_ID,
};

console.log('=================================');
console.log('🧪 STEP 1: GoLogin Browser Test');
console.log('=================================\n');

async function testGoLoginBrowser() {
  let GL;
  let browser = null;
  
  try {
    // CHECKPOINT 1: Validate environment
    console.log('✓ Checkpoint 1: Validating environment variables...');
    if (!TEST_CONFIG.apiToken) {
      throw new Error('❌ GL_API_TOKEN not found in .env file');
    }
    if (!TEST_CONFIG.profileId) {
      throw new Error('❌ GL_PROFILE_ID not found in .env file');
    }
    console.log(`  ✓ API Token: ${TEST_CONFIG.apiToken.substring(0, 20)}...`);
    console.log(`  ✓ Profile ID: ${TEST_CONFIG.profileId}\n`);

    // CHECKPOINT 2: Initialize GoLogin
    console.log('✓ Checkpoint 2: Initializing GoLogin instance...');
    GL = new GoLogin({
      token: TEST_CONFIG.apiToken,
      profile_id: TEST_CONFIG.profileId,
    });
    console.log('  ✓ GoLogin instance created\n');

    // CHECKPOINT 3: Start browser profile
    console.log('✓ Checkpoint 3: Starting browser profile (this may take 30-60 seconds)...');
    const { wsUrl } = await GL.start();
    console.log('  ✓ Browser launched successfully');
    console.log(`  ✓ WebSocket URL: ${wsUrl}\n`);

    // Connect to browser with puppeteer
    console.log('✓ Checkpoint 4: Connecting to browser with Puppeteer...');
    browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      ignoreHTTPSErrors: true,
    });
    console.log('  ✓ Puppeteer connected\n');

    // CHECKPOINT 5: Navigate to Google
    console.log('✓ Checkpoint 5: Opening new page and navigating to google.com...');
    const page = await browser.newPage();
    await page.goto('https://www.google.com', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    console.log('  ✓ Navigation successful');
    
    const title = await page.title();
    console.log(`  ✓ Page Title: "${title}"\n`);

    // CHECKPOINT 6: Take screenshot
    console.log('✓ Checkpoint 6: Taking screenshot...');
    await page.screenshot({ 
      path: 'test-google-screenshot.png',
      fullPage: true 
    });
    console.log('  ✓ Screenshot saved to: test-google-screenshot.png\n');

    // CHECKPOINT 7: Test search input
    console.log('✓ Checkpoint 7: Testing search functionality...');
    const searchBox = await page.$('textarea[name="q"]');
    if (searchBox) {
      await searchBox.type('GoLogin cloud browser test', { delay: 100 });
      console.log('  ✓ Typed search query');
      await page.screenshot({ path: 'test-google-search.png' });
      console.log('  ✓ Screenshot saved to: test-google-search.png\n');
    } else {
      console.log('  ⚠ Search box not found (might be regional difference)\n');
    }

    // SUCCESS
    console.log('=================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('=================================');
    console.log('Browser is working correctly.');
    console.log('Ready to proceed to Step 2: GTL Portal Login\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('=================================');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    console.error('\n=================================');
    process.exit(1);
  } finally {
    // CHECKPOINT 8: Cleanup
    if (browser) {
      console.log('\n✓ Checkpoint 8: Closing browser...');
      await browser.close();
      console.log('  ✓ Browser closed');
    }
    if (GL) {
      console.log('  ✓ Stopping GoLogin profile...');
      await GL.stop();
      console.log('  ✓ Profile stopped\n');
    }
  }
}

// Run the test
testGoLoginBrowser();

/**
 * Test script for gmail-sync function
 * 
 * This script tests the gmail-sync Edge Function deployment
 * 
 * Usage:
 * 1. First, get your Gmail access token from the app (http://localhost:8080)
 * 2. Update the ACCESS_TOKEN variable below
 * 3. Run: node test-gmail-sync.js
 */

const SUPABASE_URL = 'https://olxlunpsizvfulumdxkl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9seGx1bnBzaXp2ZnVsdW1keGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNzI1OTUsImV4cCI6MjA3Mjg0ODU5NX0.3eYzqsUUYwvnM3JOMBZ588p1oavhpFyzwaHnGle25E0';

// ⚠️ IMPORTANT: Replace this with your actual Gmail access token from the app
const ACCESS_TOKEN = 'YOUR_GMAIL_ACCESS_TOKEN_HERE';

async function testGmailSync() {
  console.log('🧪 Testing gmail-sync function...\n');
  
  if (ACCESS_TOKEN === 'YOUR_GMAIL_ACCESS_TOKEN_HERE') {
    console.error('❌ ERROR: Please update ACCESS_TOKEN with your actual Gmail access token');
    console.log('\n📝 To get your access token:');
    console.log('   1. Open http://localhost:8080 in your browser');
    console.log('   2. Go to Gmail Setup page');
    console.log('   3. Connect your Gmail account');
    console.log('   4. Copy the token shown on the page');
    console.log('   5. Update ACCESS_TOKEN in this file\n');
    return;
  }

  try {
    console.log('📡 Invoking gmail-sync function...');
    console.log(`   URL: ${SUPABASE_URL}/functions/v1/gmail-sync`);
    console.log(`   Carrier filter: all\n`);

    const startTime = Date.now();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/gmail-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        access_token: ACCESS_TOKEN,
        carrier_filter: 'all'
      })
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`⏱️  Response time: ${duration}s`);
    console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

    const data = await response.json();

    if (response.ok && data.success) {
      console.log('✅ SUCCESS! Gmail sync completed\n');
      console.log('📧 Results:');
      console.log(`   - Emails found: ${data.emails_found}`);
      console.log(`   - New emails synced: ${data.emails_synced}`);
      console.log(`   - Duplicates skipped: ${data.duplicates_skipped}`);
      console.log(`   - Message: ${data.message}\n`);
      
      if (data.labels_processed && data.labels_processed.length > 0) {
        console.log('🏷️  Labels processed:');
        data.labels_processed.forEach(label => {
          console.log(`   - ${label}`);
        });
      }
    } else {
      console.log('❌ FAILED! Gmail sync encountered an error\n');
      console.log('Error details:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('\nFull error:', error);
  }
}

// Run the test
testGmailSync();

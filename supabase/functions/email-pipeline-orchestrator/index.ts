import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

interface PipelineMetrics {
  start_time: string;
  end_time?: string;
  status: 'running' | 'completed' | 'failed';
  emails_synced: number;
  emails_categorized: number;
  emails_analyzed: number;
  errors: string[];
  step: string;
}

// Carrier to function mapping
const CARRIER_FUNCTION_MAP: Record<string, string> = {
  'ANAM': 'analyze-email-anam',
  'COREBRIDGE': 'analyze-email-corebridge',
  'ROYAL_NEIGHBORS': 'analyze-email-royal-neighbors',
  'MUTUAL OF OMAHA': 'analyze-email-mutual-omaha',
  'SBLI': 'analyze-email-sbli',
  'GUARANTEE TRUST': 'analyze-email-guarantee-trust',
  'AETNA': 'analyze-email-aetna',
  'TRANSAMERICA': 'analyze-email-transamerica',
  'LIBERTY BANKERS': 'analyze-email-liberty-bankers'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const metrics: PipelineMetrics = {
    start_time: new Date().toISOString(),
    status: 'running',
    emails_synced: 0,
    emails_categorized: 0,
    emails_analyzed: 0,
    errors: [],
    step: 'initialization'
  };

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('APP_URL') ?? '',
      Deno.env.get('ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader }
        }
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const body = await req.json().catch(() => ({}));
    const { 
      skip_gmail_sync = false,
      force_recategorize = false,
      batch_size = 50,
      analysis_batch_size = 25
    } = body;

    console.log('🚀 Starting automated email processing pipeline...');
    
    // Step 1: Gmail Sync
    metrics.step = 'gmail-sync';
    let gmailSyncResult = { emails_synced: 0 };
    
    if (!skip_gmail_sync) {
      console.log('📧 Step 1: Running Gmail Sync...');
      
      try {
        // Get Gmail access token from secure tokens
        const { data: tokenData } = await supabaseClient
          .from('secure_tokens')
          .select('encrypted_token')
          .eq('user_id', user.id)
          .eq('token_type', 'gmail_access_token')
          .single();

        if (!tokenData?.encrypted_token) {
          throw new Error('No Gmail access token found. Please authenticate with Gmail first.');
        }

        // Call gmail-sync function
        const gmailSyncResponse = await fetch(
          `${Deno.env.get('APP_URL')}/functions/v1/gmail-sync`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: tokenData.encrypted_token,
              carrier_filter: 'all'
            }),
          }
        );

        if (gmailSyncResponse.ok) {
          gmailSyncResult = await gmailSyncResponse.json();
          metrics.emails_synced = gmailSyncResult.emails_synced || 0;
          console.log(`✅ Gmail Sync completed: ${metrics.emails_synced} emails synced`);
        } else {
          const error = await gmailSyncResponse.text();
          throw new Error(`Gmail sync failed: ${error}`);
        }
      } catch (error) {
        console.error('❌ Gmail Sync failed:', error);
        metrics.errors.push(`Gmail Sync: ${error.message}`);
        // Continue with categorization of existing emails
      }
    } else {
      console.log('⏩ Skipping Gmail Sync (skip_gmail_sync = true)');
    }

    // Step 2: Email Categorization
    metrics.step = 'categorize-emails';
    console.log('🏷️  Step 2: Running Email Categorization...');
    
    try {
      const categorizationResponse = await fetch(
        `${Deno.env.get('APP_URL')}/functions/v1/categorize-emails`,
        {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            batch_size,
            force_recategorize
          }),
        }
      );

      if (categorizationResponse.ok) {
        const categorizationResult = await categorizationResponse.json();
        metrics.emails_categorized = categorizationResult.categorized_count || 0;
        console.log(`✅ Categorization completed: ${metrics.emails_categorized} emails categorized`);
      } else {
        const error = await categorizationResponse.text();
        throw new Error(`Email categorization failed: ${error}`);
      }
    } catch (error) {
      console.error('❌ Email Categorization failed:', error);
      metrics.errors.push(`Categorization: ${error.message}`);
      throw error;
    }

    // Step 3: Get emails that need analysis
    metrics.step = 'analysis-preparation';
    console.log('🔍 Step 3: Preparing emails for analysis...');
    
    // Get emails that have been categorized but not analyzed
    const { data: unanalyzedEmails, error: emailsError } = await supabaseClient
      .from('emails')
      .select(`
        id, 
        carrier, 
        carrier_label, 
        subject,
        folder_id,
        carrier_folders!inner(carrier_name)
      `)
      .eq('user_id', user.id)
      .not('folder_id', 'is', null)
      .limit(analysis_batch_size);

    if (emailsError) {
      throw new Error(`Failed to fetch emails for analysis: ${emailsError.message}`);
    }

    if (!unanalyzedEmails || unanalyzedEmails.length === 0) {
      console.log('ℹ️  No emails found for analysis');
      metrics.status = 'completed';
      metrics.end_time = new Date().toISOString();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Pipeline completed - no emails to analyze',
        metrics
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Filter out emails that already have analysis
    const emailIds = unanalyzedEmails.map(email => email.id);
    const { data: existingAnalyses } = await supabaseClient
      .from('email_analysis_results')
      .select('email_id')
      .in('email_id', emailIds);

    const analyzedEmailIds = new Set(existingAnalyses?.map(a => a.email_id) || []);
    const emailsToAnalyze = unanalyzedEmails.filter(email => !analyzedEmailIds.has(email.id));

    console.log(`📊 Found ${emailsToAnalyze.length} emails needing analysis (${unanalyzedEmails.length - emailsToAnalyze.length} already analyzed)`);

    // Step 4: Run analysis for each carrier
    metrics.step = 'email-analysis';
    let totalAnalyzed = 0;
    const carrierCounts: Record<string, number> = {};

    // Group emails by carrier
    const emailsByCarrier: Record<string, any[]> = {};
    for (const email of emailsToAnalyze) {
      const carrierName = email.carrier_folders?.carrier_name || 'UNKNOWN';
      if (!emailsByCarrier[carrierName]) {
        emailsByCarrier[carrierName] = [];
      }
      emailsByCarrier[carrierName].push(email);
    }

    console.log(`🔬 Step 4: Running Analysis by Carrier...`);
    console.log(`📋 Carriers found: ${Object.keys(emailsByCarrier).join(', ')}`);

    // Process each carrier
    for (const [carrierName, emails] of Object.entries(emailsByCarrier)) {
      const functionName = CARRIER_FUNCTION_MAP[carrierName] || 'analyze-email-generic';
      carrierCounts[carrierName] = 0;
      
      console.log(`🏢 Processing ${emails.length} ${carrierName} emails with ${functionName}...`);
      
      // Process emails in smaller batches to prevent timeouts
      const batchSize = 5;
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        // Process batch in parallel with limited concurrency
        const batchPromises = batch.map(async (email, batchIndex) => {
          try {
            console.log(`  📄 Analyzing ${carrierName} email ${i + batchIndex + 1}/${emails.length}: ${email.subject.substring(0, 50)}...`);
            
            const analysisResponse = await fetch(
              `${Deno.env.get('APP_URL')}/functions/v1/${functionName}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': authHeader,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  email_id: email.id,
                  force_reprocess: false
                }),
              }
            );

            if (analysisResponse.ok) {
              const result = await analysisResponse.json();
              if (result.success) {
                carrierCounts[carrierName]++;
                totalAnalyzed++;
                console.log(`    ✅ Analysis completed for email ${email.id}`);
              } else {
                console.log(`    ⚠️  Analysis failed for email ${email.id}: ${result.error || 'Unknown error'}`);
                metrics.errors.push(`Analysis failed for ${email.id}: ${result.error}`);
              }
            } else {
              const error = await analysisResponse.text();
              console.log(`    ❌ Analysis request failed for email ${email.id}: ${error}`);
              metrics.errors.push(`Analysis request failed for ${email.id}: ${error}`);
            }
          } catch (error) {
            console.error(`    💥 Exception during analysis of email ${email.id}:`, error);
            metrics.errors.push(`Exception analyzing ${email.id}: ${error.message}`);
          }
        });

        // Wait for batch to complete before processing next batch
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches to prevent overwhelming the system
        if (i + batchSize < emails.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`  ✅ Completed ${carrierName}: ${carrierCounts[carrierName]} emails analyzed`);
    }

    metrics.emails_analyzed = totalAnalyzed;
    metrics.status = 'completed';
    metrics.end_time = new Date().toISOString();

    const duration = ((new Date(metrics.end_time).getTime() - new Date(metrics.start_time).getTime()) / 1000).toFixed(2);
    
    console.log('🎉 Pipeline completed successfully!');
    console.log(`📊 Summary: ${metrics.emails_synced} synced, ${metrics.emails_categorized} categorized, ${metrics.emails_analyzed} analyzed in ${duration}s`);

    // Log pipeline completion
    await supabaseClient
      .from('pipeline_logs')
      .insert({
        user_id: user.id,
        pipeline_type: 'automated_email_processing',
        status: metrics.status,
        metrics: JSON.stringify(metrics),
        duration_seconds: parseFloat(duration)
      })
      .catch(err => console.log('Failed to log pipeline completion:', err));

    return new Response(JSON.stringify({
      success: true,
      message: `Pipeline completed successfully in ${duration} seconds`,
      metrics,
      carrier_breakdown: carrierCounts,
      errors: metrics.errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Pipeline failed:', error);
    
    metrics.status = 'failed';
    metrics.end_time = new Date().toISOString();
    metrics.errors.push(`Pipeline failure: ${error.message}`);

    // Log pipeline failure
    const supabaseClient = createClient(
      Deno.env.get('APP_URL') ?? '',
      Deno.env.get('ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization') || '' }
        }
      }
    );
    
    await supabaseClient
      .from('pipeline_logs')
      .insert({
        user_id: req.headers.get('user-id'),
        pipeline_type: 'automated_email_processing',
        status: 'failed',
        metrics: JSON.stringify(metrics),
        error_message: error.message
      })
      .catch(err => console.log('Failed to log pipeline failure:', err));

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      metrics,
      step_failed: metrics.step
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
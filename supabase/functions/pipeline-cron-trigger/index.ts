import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🕒 Pipeline cron trigger started at:', new Date().toISOString());

    // Verify this is a legitimate cron trigger
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.includes('Bearer')) {
      console.log('❌ No valid authorization header found');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - This endpoint is for cron triggers only' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('APP_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY') ?? '', // Use service role for cron
    );

    // Get all users who have Gmail tokens (active users)
    const { data: activeUsers, error: usersError } = await supabaseClient
      .from('gmail_tokens')
      .select(`
        user_id,
        auth.users!inner(id, email)
      `)
      .not('refresh_token', 'is', null);

    if (usersError) {
      console.error('❌ Failed to fetch active users:', usersError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch users',
        details: usersError.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('ℹ️ No active users found with Gmail tokens');
      return new Response(JSON.stringify({ 
        message: 'No active users to process',
        processed_users: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`👥 Found ${activeUsers.length} active users to process`);

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each user's pipeline
    for (const userToken of activeUsers) {
      const userId = userToken.user_id;
      const userEmail = userToken.auth?.users?.email || 'unknown';
      
      console.log(`🔄 Processing pipeline for user: ${userEmail} (${userId})`);
      
      try {
        // Create a user token for the pipeline call
        const { data: { session }, error: sessionError } = await supabaseClient.auth.admin.createSession({
          user_id: userId
        });

        if (sessionError || !session) {
          console.error(`❌ Failed to create session for user ${userEmail}:`, sessionError);
          results.push({
            user_id: userId,
            user_email: userEmail,
            success: false,
            error: `Failed to create session: ${sessionError?.message}`
          });
          errorCount++;
          continue;
        }

        // Call the pipeline orchestrator for this user
        const pipelineResponse = await fetch(
          `${Deno.env.get('APP_URL')}/functions/v1/email-pipeline-orchestrator`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              skip_gmail_sync: false,
              force_recategorize: false,
              batch_size: 50,
              analysis_batch_size: 20
            }),
          }
        );

        if (pipelineResponse.ok) {
          const pipelineResult = await pipelineResponse.json();
          console.log(`✅ Pipeline completed for user ${userEmail}:`, pipelineResult.message);
          
          results.push({
            user_id: userId,
            user_email: userEmail,
            success: true,
            metrics: pipelineResult.metrics,
            message: pipelineResult.message
          });
          successCount++;
        } else {
          const error = await pipelineResponse.text();
          console.error(`❌ Pipeline failed for user ${userEmail}:`, error);
          
          results.push({
            user_id: userId,
            user_email: userEmail,
            success: false,
            error: `Pipeline execution failed: ${error}`
          });
          errorCount++;
        }

        // Small delay between users to prevent overwhelming the system
        if (activeUsers.indexOf(userToken) < activeUsers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

      } catch (error) {
        console.error(`💥 Exception processing user ${userEmail}:`, error);
        results.push({
          user_id: userId,
          user_email: userEmail,
          success: false,
          error: `Exception: ${(error as Error).message}`
        });
        errorCount++;
      }
    }

    // Log the cron execution summary
    await supabaseClient
      .from('pipeline_logs')
      .insert({
        user_id: '00000000-0000-0000-0000-000000000000', // System user for cron logs
        pipeline_type: 'cron_batch_processing',
        status: errorCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'completed'),
        metrics: JSON.stringify({
          total_users: activeUsers.length,
          successful_users: successCount,
          failed_users: errorCount,
          execution_time: new Date().toISOString(),
          results: results.map(r => ({
            user_id: r.user_id,
            success: r.success,
            error: r.error || undefined
          }))
        })
      })
      .catch(err => console.log('Failed to log cron execution:', err));

    const summary = {
      success: true,
      message: `Cron execution completed: ${successCount} successful, ${errorCount} failed`,
      total_users: activeUsers.length,
      successful_users: successCount,
      failed_users: errorCount,
      execution_time: new Date().toISOString(),
      results: results
    };

    console.log('🎉 Cron execution summary:', summary.message);
    
    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Cron trigger failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
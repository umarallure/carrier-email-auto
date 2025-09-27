import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    console.log('🧪 Manual pipeline test started at:', new Date().toISOString());

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: 'Authorization header required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { 
      skip_gmail_sync = false,
      force_recategorize = false,
      batch_size = 50,
      analysis_batch_size = 20,
      test_mode = true
    } = body;

    console.log('📋 Test Parameters:', {
      skip_gmail_sync,
      force_recategorize,
      batch_size,
      analysis_batch_size,
      test_mode
    });

    // Call the pipeline orchestrator directly
    const pipelineResponse = await fetch(
      `${Deno.env.get('APP_URL')}/functions/v1/email-pipeline-orchestrator`,
      {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          skip_gmail_sync,
          force_recategorize,
          batch_size,
          analysis_batch_size
        }),
      }
    );

    if (pipelineResponse.ok) {
      const pipelineResult = await pipelineResponse.json();
      console.log('✅ Pipeline test completed successfully');
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Manual pipeline test completed',
        test_mode: true,
        pipeline_result: pipelineResult,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      const error = await pipelineResponse.text();
      console.error('❌ Pipeline test failed:', error);
      
      return new Response(JSON.stringify({
        success: false,
        error: `Pipeline test failed: ${error}`,
        test_mode: true,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('💥 Manual test failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message,
      test_mode: true,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
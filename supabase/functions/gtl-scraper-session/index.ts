/**
 * GTL Scraper Session Manager - Edge Function
 * 
 * Manages GoLogin browser sessions for GTL scraping with manual login flow.
 * Team members start session, manually login, then trigger scraping.
 * 
 * Endpoints:
 * - POST /start - Start GoLogin browser session
 * - POST /confirm-ready - User confirms they've logged in
 * - POST /scrape - Start scraping after login
 * - GET /status/:sessionId - Get session status
 * - POST /stop/:sessionId - Stop and cleanup session
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ScraperSession {
  id: string;
  job_id: string;
  status: 'initializing' | 'waiting_for_login' | 'ready' | 'scraping' | 'completed' | 'failed';
  browser_url?: string;
  current_page?: number;
  total_pages?: number;
  scraped_count?: number;
  error_message?: string;
  created_at: string;
  updated_at: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  console.log(`[GTL SCRAPER SESSION] Function called: ${req.method} ${req.url}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    console.log(`[DEBUG] Full URL: ${req.url}`);
    console.log(`[DEBUG] Pathname: ${url.pathname}`);
    console.log(`[DEBUG] Action: ${action}`);
    console.log(`[DEBUG] Method: ${req.method}`);

    // POST /start - Start new scraper session
    if (action === 'start' && req.method === 'POST') {
      const { job_name, user_email } = await req.json();

      if (!job_name) {
        return new Response(
          JSON.stringify({ error: 'job_name is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create scraper job
      const { data: job, error: jobError } = await supabase
        .from('scraper_jobs')
        .insert({
          carrier_name: 'GTL',
          job_name,
          status: 'pending',
          created_by: user_email || 'anonymous',
          config: {
            carrier_name: 'GTL',
            login_url: 'https://eapp.gtlic.com/',
            portal_url: 'https://gtlink.gtlic.com/MyBusiness',
            username: Deno.env.get('GTL_USERNAME') || '',
            password: Deno.env.get('GTL_PASSWORD') || '',
            username_selector: '[name="username"]',
            password_selector: '[name="password"]',
            login_button_selector: 'button[type="submit"]',
            policy_table_selector: '.policy-table',
            policy_row_selector: '.policy-row',
          },
        })
        .select()
        .single();

      if (jobError) {
        return new Response(
          JSON.stringify({ error: jobError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create session record
      const { data: session, error: sessionError } = await supabase
        .from('gtl_scraper_sessions')
        .insert({
          job_id: job.id,
          status: 'initializing',
          browser_url: null,
          current_page: 0,
          total_pages: 19,
          scraped_count: 0,
        })
        .select()
        .single();

      if (sessionError) {
        return new Response(
          JSON.stringify({ error: sessionError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // TODO: In production, this would trigger a worker to start GoLogin browser
      // For now, we'll simulate the browser being ready
      console.log(`[Session ${session.id}] Started for job ${job.id}`);

      // Update to waiting_for_login after "browser starts"
      await supabase
        .from('gtl_scraper_sessions')
        .update({
          status: 'waiting_for_login',
          browser_url: null, // No browser URL since we don't start the browser
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      return new Response(
        JSON.stringify({
          success: true,
          session_id: session.id,
          job_id: job.id,
          message: 'Session started. Please login to GTL portal.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /confirm-ready - User confirms manual login complete
    if (action === 'confirm-ready' && req.method === 'POST') {
      const { session_id } = await req.json();

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update session status
      const { error } = await supabase
        .from('gtl_scraper_sessions')
        .update({
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session_id);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Ready to scrape. Click "Start Scraping" to begin.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /scrape - Start scraping
    if (action === 'scrape' && req.method === 'POST') {
      const { session_id } = await req.json();

      if (!session_id) {
        return new Response(
          JSON.stringify({ error: 'session_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get session
      const { data: session, error: sessionError } = await supabase
        .from('gtl_scraper_sessions')
        .select('*')
        .eq('id', session_id)
        .single();

      if (sessionError || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (session.status !== 'ready') {
        return new Response(
          JSON.stringify({ error: 'Session not ready. Please confirm login first.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update to scraping status
      await supabase
        .from('gtl_scraper_sessions')
        .update({
          status: 'scraping',
          current_page: 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session_id);

      // Update job status
      await supabase
        .from('scraper_jobs')
        .update({
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', session.job_id);

      // TODO: In production, trigger actual scraping worker
      console.log(`[Session ${session_id}] Starting scraping...`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Scraping started. Monitor progress in Status tab.',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /status/:sessionId - Get session status
    if (req.method === 'GET' && url.pathname.includes('/status/')) {
      const sessionId = url.pathname.split('/status/')[1];

      const { data: session, error } = await supabase
        .from('gtl_scraper_sessions')
        .select('*, scraper_jobs(*)')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return new Response(
          JSON.stringify({ error: 'Session not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(session),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST /stop/:sessionId - Stop session
    if (req.method === 'POST' && url.pathname.includes('/stop/')) {
      const sessionId = url.pathname.split('/stop/')[1];

      // Get session
      const { data: session } = await supabase
        .from('gtl_scraper_sessions')
        .select('job_id')
        .eq('id', sessionId)
        .single();

      if (session) {
        // Update session
        await supabase
          .from('gtl_scraper_sessions')
          .update({
            status: 'failed',
            error_message: 'Stopped by user',
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId);

        // Update job
        await supabase
          .from('scraper_jobs')
          .update({
            status: 'failed',
            error_message: 'Stopped by user',
            completed_at: new Date().toISOString(),
          })
          .eq('id', session.job_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Session stopped' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in GTL scraper session:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

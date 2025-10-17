import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

interface ScraperRequest {
  carrier_name: string;
  job_name: string;
  action?: 'start' | 'status' | 'export';
  job_id?: string;
  format?: 'csv' | 'json';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const path = url.pathname;

    // POST /api/scraper/start - Start a new scraping job
    if (path === '/functions/v1/scraper-api' && req.method === 'POST') {
      const body: ScraperRequest = await req.json();

      if (!body.carrier_name || !body.job_name) {
        return new Response(
          JSON.stringify({ error: 'carrier_name and job_name are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create scraper job record
      const { data: job, error: jobError } = await supabase
        .from('scraper_jobs')
        .insert({
          carrier_name: body.carrier_name,
          job_name: body.job_name,
          status: 'pending',
          config: {
            carrier_name: body.carrier_name,
            login_url: `https://${body.carrier_name.toLowerCase()}.com/login`,
            portal_url: `https://${body.carrier_name.toLowerCase()}.com/portal`,
            username: Deno.env.get(`${body.carrier_name}_USERNAME`) || '',
            password: Deno.env.get(`${body.carrier_name}_PASSWORD`) || '',
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
        console.error('Error creating job:', jobError);
        return new Response(
          JSON.stringify({ error: jobError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Trigger background scraping task
      console.log(`[Scraper] Starting job ${job.id} for ${body.carrier_name}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          job_id: job.id,
          message: 'Scraping job started. Check status for progress.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api/scraper/jobs - List all scraper jobs
    if (path === '/functions/v1/scraper-api' && req.method === 'GET') {
      const { data: jobs, error } = await supabase
        .from('scraper_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(jobs),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api/scraper/policies/{jobId} - Get policies for a job
    if (path.includes('/scraper-api/policies/') && req.method === 'GET') {
      const jobId = path.split('/').pop();

      const { data: policies, error } = await supabase
        .from('scraped_policies')
        .select('*')
        .eq('job_id', jobId)
        .limit(500);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify(policies),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // GET /api/scraper/export/{jobId} - Export scraped data
    if (path.includes('/scraper-api/export/') && req.method === 'GET') {
      const jobId = path.split('/').pop();
      const format = url.searchParams.get('format') || 'csv';

      const { data: policies, error } = await supabase
        .from('scraped_policies')
        .select('*')
        .eq('job_id', jobId);

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (format === 'json') {
        return new Response(
          JSON.stringify(policies, null, 2),
          { 
            status: 200, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Content-Disposition': `attachment; filename="policies_${jobId}.json"`
            } 
          }
        );
      }

      // CSV format
      if (!policies || policies.length === 0) {
        return new Response(
          'No data to export',
          { status: 404, headers: corsHeaders }
        );
      }

      const headers = Object.keys(policies[0]);
      const csv = [
        headers.join(','),
        ...policies.map(p => 
          headers.map(h => {
            const value = p[h as keyof typeof p];
            if (value === null || value === undefined) return '';
            if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
            return String(value).replace(/"/g, '""');
          }).join(',')
        ),
      ].join('\n');

      return new Response(
        csv,
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="policies_${jobId}.csv"`,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in scraper API:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

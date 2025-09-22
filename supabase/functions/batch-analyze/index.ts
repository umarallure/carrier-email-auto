import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { carrier_filter, limit = 10 } = await req.json();

    console.log('Starting batch analysis for user:', user.id, 'carrier_filter:', carrier_filter);

    // Get unprocessed emails
    let query = supabaseClient
      .from('emails')
      .select('id, subject, carrier, carrier_label')
      .eq('user_id', user.id)
      .eq('status', 'unprocessed')
      .limit(limit);

    if (carrier_filter && carrier_filter !== 'all') {
      // Convert carrier filter to lowercase to match the stored values
      const normalizedCarrierFilter = carrier_filter.toLowerCase();
      query = query.eq('carrier', normalizedCarrierFilter);
    }

    const { data: emails, error: emailsError } = await query;

    if (emailsError) {
      console.error('Error fetching emails:', emailsError);
      throw new Error('Failed to fetch emails');
    }

    console.log(`Found ${emails?.length || 0} emails matching criteria`);
    if (emails && emails.length > 0) {
      console.log('Sample emails:', emails.slice(0, 2).map(e => ({ id: e.id, carrier: e.carrier, subject: e.subject })));
    }

    if (!emails || emails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No unprocessed emails found',
          processed_count: 0,
          debug_info: {
            carrier_filter: carrier_filter,
            normalized_filter: carrier_filter?.toLowerCase(),
            user_id: user.id
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${emails.length} emails to analyze`);

    // Process each email by calling the analyze-email function
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const email of emails) {
      try {
        console.log(`Analyzing email ${email.id}: ${email.subject}`);
        
        const analyzeResponse = await fetch(
          `${Deno.env.get('APP_URL')}/functions/v1/analyze-email`,
          {
            method: 'POST',
            headers: {
              'Authorization': authHeader,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email_id: email.id,
              force_reprocess: false,
            }),
          }
        );

        const analyzeResult = await analyzeResponse.json();
        
        if (analyzeResult.success) {
          successCount++;
          console.log(`Successfully analyzed email ${email.id}`);
          results.push({
            email_id: email.id,
            subject: email.subject,
            status: 'success',
          });
        } else {
          errorCount++;
          console.log(`Failed to analyze email ${email.id}: ${analyzeResult.error}`);
          results.push({
            email_id: email.id,
            subject: email.subject,
            status: 'error',
            error: analyzeResult.error,
          });
        }

        // Small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errorCount++;
        console.error(`Error analyzing email ${email.id}:`, error);
        results.push({
          email_id: email.id,
          subject: email.subject,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(`Batch analysis completed. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        total_emails: emails?.length || 0,
        success_count: successCount,
        error_count: errorCount,
        results,
        message: `Processed ${successCount} emails successfully, ${errorCount} errors`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in batch-analyze function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
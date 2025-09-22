import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
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
          headers: { Authorization: authHeader }
        }
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { email_id, force_reprocess } = await req.json();
    if (!email_id) {
      throw new Error('Email ID required');
    }

    console.log('Starting email analysis routing for email:', email_id);

    // Fetch the email from database to determine carrier
    const { data: email, error: emailError } = await supabaseClient
      .from('emails')
      .select('*, folder_id')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single();

    if (emailError || !email) {
      throw new Error('Email not found or not accessible');
    }

    // Get the carrier folder to determine which function to call
    let carrierName = email.carrier_label || 'Generic';
    
    if (email.folder_id) {
      const { data: folder, error: folderError } = await supabaseClient
        .from('carrier_folders')
        .select('carrier_name')
        .eq('id', email.folder_id)
        .single();
      
      if (!folderError && folder) {
        carrierName = folder.carrier_name;
      }
    }

    console.log('Determined carrier:', carrierName);

    // Route to appropriate carrier-specific function
    let targetFunction = 'analyze-email-generic';
    switch (carrierName.toUpperCase()) {
      case 'ANAM':
        targetFunction = 'analyze-email-anam';
        break;
      case 'COREBRIDGE':
        targetFunction = 'analyze-email-corebridge';
        break;
      case 'ROYAL NEIGHBORS OF AMERICA':
      case 'ROYAL NEIGHBORS':
      case 'ROYAL_NEIGHBORS':
        targetFunction = 'analyze-email-royal-neighbors';
        break;
      case 'MUTUAL OF OMAHA':
      case 'MUTUAL OMAHA':
      case 'MOH':
        targetFunction = 'analyze-email-mutual-omaha';
        break;
      case 'SBLI':
      case 'SAVINGS BANK LIFE INSURANCE':
        targetFunction = 'analyze-email-sbli';
        break;
      case 'GUARANTEE TRUST LIFE':
      case 'GTL':
        targetFunction = 'analyze-email-guarantee-trust';
        break;
      case 'AETNA':
        targetFunction = 'analyze-email-aetna';
        break;
      case 'TRANSAMERICA':
        targetFunction = 'analyze-email-transamerica';
        break;
      case 'LIBERTY':
      case 'LIBERTY BANKERS':
        targetFunction = 'analyze-email-liberty-bankers';
        break;
      default:
        targetFunction = 'analyze-email-generic';
        break;
    }

    console.log(`Routing to ${targetFunction} for carrier ${carrierName}`);

    // Call the appropriate carrier-specific function
    const { data, error } = await supabaseClient.functions.invoke(targetFunction, {
      body: { 
        email_id: email_id,
        force_reprocess: force_reprocess
      }
    });

    if (error) {
      console.error(`Error from ${targetFunction}:`, error);
      throw error;
    }

    console.log('Analysis routing completed successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis: data.analysis,
      message: `Email analyzed successfully via ${targetFunction}`,
      carrier: carrierName,
      routed_to: targetFunction
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-email routing function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

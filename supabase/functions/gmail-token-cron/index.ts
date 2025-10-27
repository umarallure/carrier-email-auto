import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// Get environment variables
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting Gmail token refresh cron job');

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check environment variables
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Find tokens that expire within the next 30 minutes
    const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000);
    console.log('Looking for tokens expiring before:', thirtyMinutesFromNow.toISOString());

    const { data: expiringTokens, error: queryError } = await supabase
      .from('gmail_tokens')
      .select('*')
      .lt('expires_at', thirtyMinutesFromNow.toISOString())
      .not('refresh_token', 'is', null);

    if (queryError) {
      console.error('Error querying expiring tokens:', queryError);
      throw queryError;
    }

    console.log(`Found ${expiringTokens?.length || 0} tokens that need refreshing`);

    if (!expiringTokens || expiringTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tokens need refreshing',
          refreshed_count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let refreshedCount = 0;
    let failedCount = 0;
    const results = [];

    // Process each expiring token
    for (const token of expiringTokens) {
      try {
        console.log(`Refreshing token for user ${token.user_id}`);

        // Use refresh token to get new access token
        const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: token.refresh_token!,
            grant_type: 'refresh_token',
          }),
        });

        if (!refreshResponse.ok) {
          const errorData = await refreshResponse.json();
          console.error(`Token refresh failed for user ${token.user_id}:`, errorData);

          // If refresh token is invalid, remove the token record
          if (errorData.error === 'invalid_grant') {
            console.log(`Removing invalid refresh token for user ${token.user_id}`);
            await supabase
              .from('gmail_tokens')
              .delete()
              .eq('user_id', token.user_id);
          }

          failedCount++;
          results.push({
            user_id: token.user_id,
            success: false,
            error: errorData.error_description || errorData.error
          });
          continue;
        }

        const refreshData = await refreshResponse.json();
        console.log(`Token refresh successful for user ${token.user_id}`);

        // Calculate new expiry time
        const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000);

        // Update the token in database
        const { error: updateError } = await supabase
          .from('gmail_tokens')
          .update({
            access_token: refreshData.access_token,
            expires_at: newExpiresAt.toISOString(),
            // Note: Google may or may not return a new refresh_token
            // If it does, update it; if not, keep the existing one
            ...(refreshData.refresh_token && { refresh_token: refreshData.refresh_token }),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', token.user_id);

        if (updateError) {
          console.error(`Error updating token for user ${token.user_id}:`, updateError);
          failedCount++;
          results.push({
            user_id: token.user_id,
            success: false,
            error: updateError.message
          });
        } else {
          console.log(`Token updated successfully for user ${token.user_id}`);
          refreshedCount++;
          results.push({
            user_id: token.user_id,
            success: true,
            new_expires_at: newExpiresAt.toISOString()
          });
        }

      } catch (error) {
        console.error(`Unexpected error refreshing token for user ${token.user_id}:`, error);
        failedCount++;
        results.push({
          user_id: token.user_id,
          success: false,
          error: error.message
        });
      }
    }

    console.log(`Token refresh completed: ${refreshedCount} successful, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refreshed ${refreshedCount} tokens, ${failedCount} failed`,
        refreshed_count: refreshedCount,
        failed_count: failedCount,
        results: results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in gmail-token-cron function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

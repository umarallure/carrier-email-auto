import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailData {
  gmail_id: string;
  subject: string;
  body: string;
  received_date: string;
  carrier: string;
  carrier_label: string;
  attachments?: string[];
}

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
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
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

    const { access_token, carrier_filter } = await req.json();

    if (!access_token) {
      throw new Error('Gmail access token required');
    }

    console.log('Starting Gmail sync for user:', user.id);

    // Fetch emails from Gmail API
    const gmailResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=category:promotions OR category:updates OR category:social',
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }
    );

    if (!gmailResponse.ok) {
      throw new Error(`Gmail API error: ${gmailResponse.statusText}`);
    }

    const gmailData = await gmailResponse.json();
    const messages = gmailData.messages || [];

    console.log(`Found ${messages.length} messages to process`);

    const emailsToInsert: EmailData[] = [];

    // Process each message
    for (const message of messages.slice(0, 10)) { // Limit to 10 for initial sync
      try {
        const messageResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`,
            },
          }
        );

        if (!messageResponse.ok) continue;

        const messageData = await messageResponse.json();
        const headers = messageData.payload?.headers || [];
        
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h: any) => h.name === 'From')?.value || '';
        const date = headers.find((h: any) => h.name === 'Date')?.value || new Date().toISOString();

        // Extract email body
        let body = '';
        if (messageData.payload?.body?.data) {
          body = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        } else if (messageData.payload?.parts) {
          const textPart = messageData.payload.parts.find((part: any) => part.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
        }

        // Determine carrier based on sender domain or email content
        let carrier = 'unknown';
        let carrier_label = 'Other';
        
        const domain = from.match(/@([^>]+)/)?.[1]?.toLowerCase() || '';
        const emailContent = `${subject} ${from}`.toLowerCase();
        
        if (domain.includes('aig') || emailContent.includes('aig') || emailContent.includes('american international group')) {
          carrier = 'aig';
          carrier_label = 'AIG';
        } else if (domain.includes('anam') || emailContent.includes('anam')) {
          carrier = 'anam';
          carrier_label = 'ANAM';
        } else if (domain.includes('liberty') || emailContent.includes('liberty mutual') || emailContent.includes('safeco')) {
          carrier = 'liberty';
          carrier_label = 'Liberty';
        } else if (domain.includes('rna') || emailContent.includes('rockingham') || emailContent.includes('rockingham national')) {
          carrier = 'rna';
          carrier_label = 'RNA';
        }

        // Apply carrier filter if specified
        if (carrier_filter && carrier_filter !== 'all' && carrier !== carrier_filter) {
          continue;
        }

        // Check for attachments
        const attachments: string[] = [];
        if (messageData.payload?.parts) {
          messageData.payload.parts.forEach((part: any) => {
            if (part.filename && part.filename.length > 0) {
              attachments.push(part.filename);
            }
          });
        }

        emailsToInsert.push({
          gmail_id: message.id,
          subject: subject.substring(0, 500), // Limit length
          body: body.substring(0, 5000), // Limit length
          received_date: new Date(date).toISOString(),
          carrier,
          carrier_label,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        continue;
      }
    }

    console.log(`Inserting ${emailsToInsert.length} emails`);

    // Insert emails into database
    const insertPromises = emailsToInsert.map(async (emailData) => {
      const { error } = await supabaseClient
        .from('emails')
        .upsert({
          user_id: user.id,
          ...emailData,
          status: 'unprocessed',
        }, {
          onConflict: 'gmail_id,user_id'
        });

      if (error) {
        console.error('Error inserting email:', error);
      }
    });

    await Promise.all(insertPromises);

    return new Response(
      JSON.stringify({ 
        success: true, 
        emails_synced: emailsToInsert.length,
        message: `Successfully synced ${emailsToInsert.length} emails` 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in gmail-sync function:', error);
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
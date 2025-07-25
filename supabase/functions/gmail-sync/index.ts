import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface EmailData {
  gmail_id: string;
  subject: string;
  body: string;
  received_date: string;
  carrier: string;
  carrier_label: string;
  gmail_url?: string;
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

    // Get list of labels to find AIG and RNA label IDs
    const labelsResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      }
    );

    if (!labelsResponse.ok) {
      throw new Error(`Gmail Labels API error: ${labelsResponse.statusText}`);
    }

    const labelsData = await labelsResponse.json();
    const labels = labelsData.labels || [];

    // Find AIG, RNA, and ANAM label IDs
    const aigLabel = labels.find((label: any) => label.name === 'AIG');
    const rnaLabel = labels.find((label: any) => label.name === 'RNA');
    const anamLabel = labels.find((label: any) => label.name === 'ANAM');

    console.log('Found labels:', { 
      aig: aigLabel?.id || 'not found', 
      rna: rnaLabel?.id || 'not found',
      anam: anamLabel?.id || 'not found'
    });

    let allMessages: any[] = [];

    // Fetch emails from AIG label if it exists (sorted by newest first, last 7 days)
    if (aigLabel) {
      const aigResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=${aigLabel.id}&q=newer_than:7d`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      if (aigResponse.ok) {
        const aigData = await aigResponse.json();
        allMessages = allMessages.concat((aigData.messages || []).map((msg: any) => ({ ...msg, sourceLabel: 'AIG' })));
        console.log(`Found ${aigData.messages?.length || 0} AIG emails from last 7 days`);
      }
    }

    // Fetch emails from RNA label if it exists (sorted by newest first, last 7 days)
    if (rnaLabel) {
      const rnaResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=${rnaLabel.id}&q=newer_than:7d`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      if (rnaResponse.ok) {
        const rnaData = await rnaResponse.json();
        allMessages = allMessages.concat((rnaData.messages || []).map((msg: any) => ({ ...msg, sourceLabel: 'RNA' })));
        console.log(`Found ${rnaData.messages?.length || 0} RNA emails from last 7 days`);
      }
    }

    // Fetch emails from ANAM label if it exists (sorted by newest first, last 7 days)
    if (anamLabel) {
      const anamResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&labelIds=${anamLabel.id}&q=newer_than:7d`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      if (anamResponse.ok) {
        const anamData = await anamResponse.json();
        allMessages = allMessages.concat((anamData.messages || []).map((msg: any) => ({ ...msg, sourceLabel: 'ANAM' })));
        console.log(`Found ${anamData.messages?.length || 0} ANAM emails from last 7 days`);
      }
    }

    // If no labels found, fallback to searching by keywords
    if (!aigLabel && !rnaLabel && !anamLabel) {
      console.log('No AIG, RNA, or ANAM labels found, falling back to keyword search');
      const gmailQuery = 'from:(aig.com OR rockingham.com OR anam.com) OR subject:(aig OR rockingham OR rna OR anam) newer_than:30d';
      
      const fallbackResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(gmailQuery)}`,
        {
          headers: {
            'Authorization': `Bearer ${access_token}`,
          },
        }
      );

      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        allMessages = (fallbackData.messages || []).map((msg: any) => ({ ...msg, sourceLabel: 'Search' }));
      }
    }

    const messages = allMessages;

    console.log(`Found ${messages.length} messages to process`);

    const emailsToInsert: EmailData[] = [];

    // Process each message (process all messages, no artificial limit)
    for (const message of messages) {
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

        // Determine carrier based on Gmail label first, then fallback to domain/content analysis
        let carrier = 'unknown';
        let carrier_label = 'Other';
        
        // Use the source label if available
        if (message.sourceLabel === 'AIG') {
          carrier = 'aig';
          carrier_label = 'AIG';
        } else if (message.sourceLabel === 'RNA') {
          carrier = 'rna';
          carrier_label = 'RNA';
        } else if (message.sourceLabel === 'ANAM') {
          carrier = 'anam';
          carrier_label = 'ANAM';
        } else {
          // Fallback to domain/content analysis
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
          } else if (domain.includes('rna') || domain.includes('rockingham') || emailContent.includes('rockingham national')) {
            carrier = 'rna';
            carrier_label = 'RNA';
          }
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

        // Construct Gmail URL - using the message ID and source label if available
        let gmailUrl = `https://mail.google.com/mail/u/0/#search/${message.id}`;
        if (message.sourceLabel && message.sourceLabel !== 'Search') {
          gmailUrl = `https://mail.google.com/mail/u/0/#label/${message.sourceLabel}/${message.id}`;
        }

        emailsToInsert.push({
          gmail_id: message.id,
          subject: subject.substring(0, 500), // Limit length
          body: body.substring(0, 5000), // Limit length
          received_date: new Date(date).toISOString(),
          carrier,
          carrier_label,
          gmail_url: gmailUrl,
          attachments: attachments.length > 0 ? attachments : undefined,
        });

      } catch (error) {
        console.error(`Error processing message ${message.id}:`, error);
        continue;
      }
    }

    console.log(`Inserting ${emailsToInsert.length} emails`);

    // Bulk check for existing emails to avoid duplicates (more efficient)
    const gmailIds = emailsToInsert.map(email => email.gmail_id);
    const { data: existingEmails } = await supabaseClient
      .from('emails')
      .select('gmail_id')
      .eq('user_id', user.id)
      .in('gmail_id', gmailIds);

    const existingGmailIds = new Set(existingEmails?.map(email => email.gmail_id) || []);
    const newEmails = emailsToInsert.filter(email => !existingGmailIds.has(email.gmail_id));

    console.log(`Found ${existingGmailIds.size} duplicate emails, inserting ${newEmails.length} new emails`);

    // Insert only new emails
    if (newEmails.length > 0) {
      const { error: bulkInsertError } = await supabaseClient
        .from('emails')
        .insert(
          newEmails.map(emailData => ({
            user_id: user.id,
            ...emailData,
            status: 'unprocessed',
          }))
        );

      if (bulkInsertError) {
        console.error('Error bulk inserting emails:', bulkInsertError);
        throw new Error('Failed to insert emails');
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        emails_found: emailsToInsert.length,
        emails_synced: newEmails.length,
        duplicates_skipped: existingGmailIds.size,
        message: `Successfully synced ${newEmails.length} new emails (${existingGmailIds.size} duplicates skipped)` 
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
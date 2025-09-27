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
  from_email: string;
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

    const { access_token, carrier_filter } = await req.json();

    if (!access_token) {
      throw new Error('Gmail access token required');
    }

    console.log('Starting Gmail sync for user:', user.id);

    // Get all existing Gmail IDs from database to avoid duplicates
    const { data: existingEmailIds } = await supabaseClient
      .from('emails')
      .select('gmail_id')
      .eq('user_id', user.id);

    const existingGmailIds = new Set(existingEmailIds?.map(email => email.gmail_id) || []);
    console.log(`Found ${existingGmailIds.size} existing emails in database`);

    let allMessages: any[] = [];
    let nextPageToken: string | undefined;
    let totalFetched = 0;
    const maxResults = 100; // Reduced to prevent timeout
    const maxTotalEmails = 500; // Reduced limit to prevent timeout

    // Fetch all emails from inbox (not just labeled ones)
    do {
      console.log(`Fetching emails batch ${Math.floor(totalFetched / maxResults) + 1}...`);
      
      let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=in:inbox`;
      if (nextPageToken) {
        url += `&pageToken=${nextPageToken}`;
      }

      const inboxResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (!inboxResponse.ok) {
        throw new Error(`Gmail Inbox API error: ${inboxResponse.statusText}`);
      }

      const inboxData = await inboxResponse.json();
      const messages = inboxData.messages || [];
      
      // Filter out emails that already exist in database
      const newMessages = messages.filter((msg: any) => !existingGmailIds.has(msg.id));
      
      allMessages = allMessages.concat(newMessages.map((msg: any) => ({ ...msg, sourceLabel: 'Inbox' })));
      totalFetched += messages.length;
      
      console.log(`Fetched ${messages.length} emails, ${newMessages.length} are new, total fetched: ${totalFetched}`);
      
      nextPageToken = inboxData.nextPageToken;
      
      // Stop if we have enough new emails or reached the limit
      if (allMessages.length >= 50 || totalFetched >= maxTotalEmails) {
        console.log(`Stopping fetch: ${allMessages.length} new emails found or reached limit`);
        break;
      }
      
    } while (nextPageToken && allMessages.length < 50);

    const messages = allMessages;

    // Process messages in smaller batches to prevent timeout
    const BATCH_SIZE = 25; // Process only 25 messages at a time to prevent timeout
    const messagesToProcess = messages.slice(0, BATCH_SIZE);

    console.log(`Processing ${messagesToProcess.length} messages (limited from ${messages.length} to prevent timeout)`);

    const emailsToInsert: EmailData[] = [];

    // Process each message (process limited messages to prevent timeout)
    for (let i = 0; i < messagesToProcess.length; i++) {
      const message = messagesToProcess[i];
      try {
        console.log(`Processing message ${i + 1}/${messagesToProcess.length}: ${message.id}`);
        
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

        // Improved email body extraction function
        const extractEmailBody = (payload: any): string => {
          let body = '';
          
          // Direct body content
          if (payload.body?.data) {
            try {
              body = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              if (body.trim()) return body;
            } catch (e) {
              console.log('Error decoding direct body:', e);
            }
          }
          
          // Check parts for body content
          if (payload.parts && Array.isArray(payload.parts)) {
            for (const part of payload.parts) {
              // Handle nested multipart
              if (part.mimeType?.startsWith('multipart/') && part.parts) {
                const nestedBody = extractEmailBody(part);
                if (nestedBody.trim()) return nestedBody;
              }
              
              // Look for text/plain first (preferred for clean content)
              if (part.mimeType === 'text/plain' && part.body?.data) {
                try {
                  body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                  if (body.trim()) return body;
                } catch (e) {
                  console.log('Error decoding text/plain part:', e);
                }
              }
              
              // Fallback to text/html if no plain text found
              if (part.mimeType === 'text/html' && part.body?.data && !body) {
                try {
                  const htmlBody = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
                  // Basic HTML to text conversion (remove tags)
                  body = htmlBody.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
                  if (body.trim()) return body;
                } catch (e) {
                  console.log('Error decoding text/html part:', e);
                }
              }
            }
          }
          
          return body;
        };

        // Extract email body using improved function
        const body = extractEmailBody(messageData.payload);

        // Set default carrier and label for all emails
        let carrier = 'unknown';
        let carrier_label = 'Other';

        // Apply carrier filter if specified
        if (carrier_filter && carrier_filter !== 'all' && carrier !== carrier_filter) {
          continue;
        }

        // Check for attachments (simplified - no downloading)
        const attachments: string[] = [];
        
        const collectAttachments = (payload: any) => {
          if (payload.parts && Array.isArray(payload.parts)) {
            for (const part of payload.parts) {
              if (part.filename && part.filename.length > 0) {
                attachments.push(part.filename);
              }
              // Recursively check nested parts
              if (part.parts) {
                collectAttachments(part);
              }
            }
          }
        };
        
        collectAttachments(messageData.payload);

        // Construct Gmail URL - using the message ID and source label if available
        let gmailUrl = `https://mail.google.com/mail/u/0/#search/${message.id}`;
        if (message.sourceLabel && message.sourceLabel !== 'Search') {
          gmailUrl = `https://mail.google.com/mail/u/0/#label/${message.sourceLabel}/${message.id}`;
        }

        emailsToInsert.push({
          gmail_id: message.id,
          subject: subject.substring(0, 500), // Limit length
          body: body.substring(0, 10000), // Increased limit for better body capture
          from_email: from.substring(0, 255), // Add from_email field
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

    // Since we already filtered for new emails above, all emails in emailsToInsert are new
    const newEmails = emailsToInsert;

    console.log(`Inserting ${newEmails.length} new emails`);

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
        emails_found: totalFetched,
        emails_synced: newEmails.length,
        duplicates_skipped: totalFetched - emailsToInsert.length,
        message: `Successfully synced ${newEmails.length} new emails from ${totalFetched} total emails checked` 
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
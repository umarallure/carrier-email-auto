import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }
    const supabaseClient = createClient(Deno.env.get('APP_URL') ?? '', Deno.env.get('ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });
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

    // Fetch carrier folders from database
    const { data: carrierFolders, error: foldersError } = await supabaseClient
      .from('carrier_folders')
      .select('*')
      .eq('is_active', true);

    if (foldersError || !carrierFolders) {
      throw new Error('Failed to fetch carrier folders');
    }

    console.log(`Loaded ${carrierFolders.length} carrier folders`);

    // Fetch all Gmail labels
    const labelsResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });

    if (!labelsResponse.ok) {
      throw new Error(`Gmail Labels API error: ${labelsResponse.statusText}`);
    }

    const labelsData = await labelsResponse.json();
    const gmailLabels = labelsData.labels || [];
    
    console.log(`Found ${gmailLabels.length} Gmail labels`);

    // Function to detect carrier from Gmail label name - Exact matching priority
    const detectCarrierFromLabel = (labelName: string) => {
      const lowerLabel = labelName.toLowerCase().trim();
      
      // Priority 1: EXACT match with carrier_name (highest priority)
      for (const folder of carrierFolders) {
        if (folder.carrier_name === 'UNCATEGORIZED') continue;
        
        if (lowerLabel === folder.carrier_name.toLowerCase()) {
          console.log(`Label "${labelName}" EXACT matched carrier_name: ${folder.carrier_name}`);
          return folder;
        }
      }
      
      // Priority 2: EXACT match with display_name
      for (const folder of carrierFolders) {
        if (folder.carrier_name === 'UNCATEGORIZED') continue;
        
        if (lowerLabel === folder.display_name.toLowerCase()) {
          console.log(`Label "${labelName}" EXACT matched display_name: ${folder.display_name}`);
          return folder;
        }
      }
      
      // Priority 3: Contains carrier_name (partial match)
      for (const folder of carrierFolders) {
        if (folder.carrier_name === 'UNCATEGORIZED') continue;
        
        if (lowerLabel.includes(folder.carrier_name.toLowerCase())) {
          console.log(`Label "${labelName}" CONTAINS carrier_name: ${folder.carrier_name}`);
          return folder;
        }
      }
      
      // Priority 4: Contains display_name (partial match)
      for (const folder of carrierFolders) {
        if (folder.carrier_name === 'UNCATEGORIZED') continue;
        
        if (lowerLabel.includes(folder.display_name.toLowerCase())) {
          console.log(`Label "${labelName}" CONTAINS display_name: ${folder.display_name}`);
          return folder;
        }
      }
      
      // Priority 5: Keyword match (lowest priority)
      for (const folder of carrierFolders) {
        if (folder.carrier_name === 'UNCATEGORIZED') continue;
        
        const keywordMatch = folder.keywords?.some((keyword: string) => {
          const match = lowerLabel.includes(keyword.toLowerCase());
          if (match) {
            console.log(`Label "${labelName}" matched keyword: ${keyword} for ${folder.carrier_name}`);
          }
          return match;
        });
        
        if (keywordMatch) {
          return folder;
        }
      }
      
      console.log(`No carrier match found for label: "${labelName}"`);
      return null;
    };

    // Filter for carrier-related labels only (exclude system labels)
    const carrierLabels = gmailLabels.filter((label: any) => {
      if (label.type === 'system') return false;
      const detectedCarrier = detectCarrierFromLabel(label.name);
      return detectedCarrier !== null;
    });

    console.log(`Found ${carrierLabels.length} carrier-related labels:`, 
      carrierLabels.map((l: any) => l.name));

    // Get all existing Gmail IDs from database to avoid duplicates
    const { data: existingEmailIds } = await supabaseClient.from('emails').select('gmail_id').eq('user_id', user.id);
    const existingGmailIds = new Set(existingEmailIds?.map((email: any)=>email.gmail_id) || []);
    console.log(`Found ${existingGmailIds.size} existing emails in database`);

    let allMessages: any[] = [];
    const maxResults = 100;
    const maxTotalEmails = 500;

    // Fetch emails from each carrier label
    for (const label of carrierLabels) {
      const carrierFolder = detectCarrierFromLabel(label.name);
      if (!carrierFolder) continue;

      // Apply carrier filter if specified
      if (carrier_filter && carrier_filter !== 'all' && carrierFolder.carrier_name !== carrier_filter) {
        continue;
      }

      console.log(`Fetching emails from label: ${label.name} (${carrierFolder.carrier_name})`);

      let nextPageToken;
      let labelTotalFetched = 0;

      do {
        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=${label.id}&q=in:inbox`;
        if (nextPageToken) {
          url += `&pageToken=${nextPageToken}`;
        }

        const labelResponse = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });

        if (!labelResponse.ok) {
          console.error(`Error fetching emails from label ${label.name}:`, labelResponse.statusText);
          break;
        }

        const labelData = await labelResponse.json();
        const messages = labelData.messages || [];

        // Filter out emails that already exist in database
        const newMessages = messages.filter((msg: any) => !existingGmailIds.has(msg.id));

        allMessages = allMessages.concat(newMessages.map((msg: any) => ({
          ...msg,
          sourceLabel: label.name,
          carrierFolder: carrierFolder
        })));

        labelTotalFetched += messages.length;
        console.log(`Fetched ${messages.length} emails from ${label.name}, ${newMessages.length} are new`);

        nextPageToken = labelData.nextPageToken;

        // Stop if we have enough emails or reached the limit
        if (allMessages.length >= 50 || labelTotalFetched >= maxTotalEmails) {
          break;
        }
      } while (nextPageToken && allMessages.length < 50);

      // Stop processing more labels if we have enough emails
      if (allMessages.length >= 50) {
        break;
      }
    }

    const messages = allMessages;
    // Process messages in smaller batches to prevent timeout
    const BATCH_SIZE = 25; // Process only 25 messages at a time to prevent timeout
    const messagesToProcess = messages.slice(0, BATCH_SIZE);
    console.log(`Processing ${messagesToProcess.length} messages (limited from ${messages.length} to prevent timeout)`);
    const emailsToInsert = [];
    // Process each message (process limited messages to prevent timeout)
    for(let i = 0; i < messagesToProcess.length; i++){
      const message = messagesToProcess[i];
      try {
        console.log(`Processing message ${i + 1}/${messagesToProcess.length}: ${message.id}`);
        const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          headers: {
            'Authorization': `Bearer ${access_token}`
          }
        });
        if (!messageResponse.ok) continue;
        const messageData = await messageResponse.json();
        const headers = messageData.payload?.headers || [];
        const subject = headers.find((h)=>h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find((h)=>h.name === 'From')?.value || '';
        const date = headers.find((h)=>h.name === 'Date')?.value || new Date().toISOString();
        // Improved email body extraction function
        const extractEmailBody = (payload)=>{
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
            for (const part of payload.parts){
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

        // Simple carrier detection - ONLY use the label from Gmail
        let carrier = 'unknown';
        let carrier_label = 'Other';
        let folderId = null;

        // Use the carrier folder from the Gmail label directly
        if (message.carrierFolder) {
          carrier = message.carrierFolder.carrier_name;
          carrier_label = message.carrierFolder.display_name;
          folderId = message.carrierFolder.id;
          console.log(`Assigned to carrier from label: ${carrier}`);
        } else {
          // If no carrier folder matched, assign to UNCATEGORIZED
          const uncategorizedFolder = carrierFolders.find((f: any) => f.carrier_name === 'UNCATEGORIZED');
          if (uncategorizedFolder) {
            carrier = 'UNCATEGORIZED';
            carrier_label = uncategorizedFolder.display_name;
            folderId = uncategorizedFolder.id;
            console.log(`No carrier label matched - assigned to UNCATEGORIZED`);
          }
        }

        // Apply carrier filter if specified
        if (carrier_filter && carrier_filter !== 'all' && carrier !== carrier_filter) {
          console.log(`Skipping email - carrier ${carrier} doesn't match filter ${carrier_filter}`);
          continue;
        }
        // Check for attachments (simplified - no downloading)
        const attachments = [];
        const collectAttachments = (payload)=>{
          if (payload.parts && Array.isArray(payload.parts)) {
            for (const part of payload.parts){
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
          subject: subject.substring(0, 500),
          body: body.substring(0, 10000),
          from_email: from.substring(0, 255),
          received_date: new Date(date).toISOString(),
          carrier,
          carrier_label,
          folder_id: folderId,
          gmail_url: gmailUrl,
          attachments: attachments.length > 0 ? attachments : undefined
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
      const { error: bulkInsertError } = await supabaseClient.from('emails').insert(newEmails.map((emailData)=>({
          user_id: user.id,
          ...emailData,
          status: 'unprocessed'
        })));
      if (bulkInsertError) {
        console.error('Error bulk inserting emails:', bulkInsertError);
        throw new Error('Failed to insert emails');
      }
    }
    return new Response(JSON.stringify({
      success: true,
      emails_found: messages.length,
      emails_synced: newEmails.length,
      duplicates_skipped: messages.length - emailsToInsert.length,
      message: `Successfully synced ${newEmails.length} new emails from ${messages.length} labeled emails checked`,
      labels_processed: carrierLabels.map((l: any) => l.name)
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in gmail-sync function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

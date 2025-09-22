import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

const openRouterApiKey = Deno.env.get('OPENROUTER_API_KEY') || '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';

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

    const { batch_size = 50, force_recategorize = false } = await req.json();

    console.log('Starting email categorization process...');

    // Get all carrier folders
    const { data: folders, error: foldersError } = await supabaseClient
      .from('carrier_folders')
      .select('*')
      .eq('is_active', true);

    if (foldersError) {
      throw new Error(`Failed to fetch folders: ${foldersError.message}`);
    }

    // Get emails to categorize - prioritize COREBRIDGE pattern emails that might be misclassified
    let emailQuery = supabaseClient
      .from('emails')
      .select('id, subject, body, from_email, carrier_label, folder_id')
      .eq('user_id', user.id)
      .limit(batch_size);

    // If force_recategorize is true, process all emails
    if (!force_recategorize) {
      // First priority: emails with COREBRIDGE patterns that are currently categorized (might be misclassified)
      const corebridgePatternEmails = supabaseClient
        .from('emails')
        .select('id, subject, body, from_email, carrier_label, folder_id')
        .eq('user_id', user.id)
        .not('folder_id', 'is', null)
        .or('subject.ilike.%corebridge%,body.ilike.%corebridge%,subject.ilike.%sigiteam%,body.ilike.%sigiteam%,body.ilike.%sigiteam@corebridgefinancial.com%')
        .limit(Math.floor(batch_size / 2));

      const { data: corebridgeEmails } = await corebridgePatternEmails;
      
      if (corebridgeEmails && corebridgeEmails.length > 0) {
        console.log(`Found ${corebridgeEmails.length} potentially misclassified COREBRIDGE emails`);
        emailQuery = supabaseClient
          .from('emails')
          .select('id, subject, body, from_email, carrier_label, folder_id')
          .eq('user_id', user.id)
          .or(`id.in.(${corebridgeEmails.map(e => e.id).join(',')}),folder_id.is.null`)
          .limit(batch_size);
      } else {
        // Fallback to uncategorized emails only
        emailQuery = emailQuery.is('folder_id', null);
      }
    }

    const { data: emails, error: emailsError } = await emailQuery;
    if (emailsError) {
      throw new Error(`Failed to fetch emails: ${emailsError.message}`);
    }

    if (!emails || emails.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No emails to categorize',
        categorized_count: 0,
        total_processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${emails.length} emails for categorization`);

    // Function to categorize a single email using AI
    const categorizeEmail = async (email: any) => {
      const subject = email.subject?.toLowerCase() || '';
      const body = email.body?.toLowerCase() || '';
      const fromEmail = email.from_email?.toLowerCase() || '';
      const fullContent = `${subject} ${body} ${fromEmail}`;

      // PRIORITY 1: Special rule for SIGITeam emails - these should ALWAYS go to COREBRIDGE
      if (fromEmail.includes('sigiteam')) {
        const corebridgeFolder = folders.find(f => f.carrier_name === 'COREBRIDGE');
        if (corebridgeFolder) {
          console.log(`HIGH PRIORITY: SIGITeam email ${email.id} -> COREBRIDGE`);
          return corebridgeFolder.id;
        }
      }

      // PRIORITY 2: Check for forwarded emails with SIGITeam in the body
      if (body.includes('from: sigiteam') || body.includes('sigiteam@corebridgefinancial.com')) {
        const corebridgeFolder = folders.find(f => f.carrier_name === 'COREBRIDGE');
        if (corebridgeFolder) {
          console.log(`FORWARDED SIGITeam email ${email.id} -> COREBRIDGE`);
          return corebridgeFolder.id;
        }
      }

      // PRIORITY 3: Check for forwarded ANAM emails (noreply@aatx.com)
      if (body.includes('noreply@aatx.com') || body.includes('from:') && body.includes('aatx.com')) {
        const anamFolder = folders.find(f => f.carrier_name === 'ANAM');
        if (anamFolder) {
          console.log(`FORWARDED ANAM email ${email.id} -> ANAM`);
          return anamFolder.id;
        }
      }

      // PRIORITY 3.5: Check for direct ANAM emails (noreply@aatx.com in from_email)
      if (fromEmail.includes('noreply@aatx.com') || fromEmail.includes('aatx.com')) {
        const anamFolder = folders.find(f => f.carrier_name === 'ANAM');
        if (anamFolder) {
          console.log(`DIRECT ANAM email ${email.id} -> ANAM`);
          return anamFolder.id;
        }
      }

      // PRIORITY 4: Check for forwarded TRANSAMERICA emails (noreply@transamerica.com)
      if (body.includes('noreply@transamerica.com') || body.includes('from:') && body.includes('transamerica.com')) {
        const transamericaFolder = folders.find(f => f.carrier_name === 'TRANSAMERICA');
        if (transamericaFolder) {
          console.log(`FORWARDED TRANSAMERICA email ${email.id} -> TRANSAMERICA`);
          return transamericaFolder.id;
        }
      }

      // PRIORITY 5: Rule-based matching for all other emails
      for (const folder of folders) {
        if (folder.carrier_name === 'UNCATEGORIZED') continue;

        // Check keywords in subject and body
        const keywordMatch = folder.keywords?.some((keyword: string) => 
          fullContent.includes(keyword.toLowerCase())
        );

        // Check body keywords
        const bodyKeywordMatch = folder.body_keywords?.some((keyword: string) => 
          fullContent.includes(keyword.toLowerCase())
        );

        // Check if carrier email addresses appear anywhere in the email content (forwarded emails)
        const emailInContentMatch = folder.email_addresses?.some((addr: string) => 
          fullContent.includes(addr.toLowerCase())
        );

        if (keywordMatch || bodyKeywordMatch || emailInContentMatch) {
          console.log(`Rule-based match found for email ${email.id}: ${folder.carrier_name}`);
          return folder.id;
        }
      }

      // If no rule-based match, use AI
      try {
        const aiPrompt = `
You are an expert email categorizer for insurance companies. Analyze this FORWARDED email content and determine which carrier it belongs to. Focus ONLY on the email body content, not the From field.

Email Content:
Subject: ${email.subject || 'No subject'}
Body: ${(email.body || '').substring(0, 1500)}...

Available Insurance Carriers (return EXACT carrier name):

1. AETNA - Aetna Senior Supplemental Insurance
   - Look for: noreply@aetna.com, "Aetna", "Senior Supplemental Insurance"

2. COREBRIDGE - Corebridge Financial 
   - Look for: SIGITeam@corebridgefinancial.com, "Corebridge Financial", "SIGITeam", "corebridge", "corebridgefinancial.com", "SIGITeam <SIGITeam@corebridgefinancial.com>"

3. RNA - Royal Neighbors (Rockingham National)
   - Look for: agentnoreply@royalneighbors.org, "Royal", "Neighbors of America", "RNA"

4. ANAM - American Amicable
   - Look for: noreply@aatx.com, "Policyholder Correspondence-AMERICAN AMICABLE", "AMERICAN AMICABLE", "Correspondence"

5. MOH - Mutual of Omaha
   - Look for: @mutualofomaha.com, "Mutual of Omaha Confidential", "Mutual of Omaha"

6. GTL - Guarantee Trust Life Insurance Company
   - Look for: @gtlic.com, "Guarantee Trust Life Insurance Company"

7. SBLI - SBLI Life Insurance
   - Look for: records@sbli.com, "SBLI"

8. LIBERTY - Liberty Bankers Life Insurance Company  
   - Look for: DoNotReply@bounce.life-insurers.com, "Liberty Bankers Life Insurance Company"

9. TRANSAMERICA - Transamerica Life Insurance
   - Look for: noreply@transamerica.com, "Transamerica"

10. ROYAL_NEIGHBORS - Royal Neighbors of America
    - Look for: AgentNoReply@royalneighbors.org, "Royal Neighbors"

Instructions:
1. Search the ENTIRE email body for carrier email addresses, company names, and keywords
2. Look for forwarded email headers or signatures that mention these carriers
3. Check for carrier-specific terminology, logos text, or company references
4. Pay special attention to forwarded message headers like "From: SIGITeam <SIGITeam@corebridgefinancial.com>"
5. If you see "SIGITeam" or "corebridge" anywhere in the email, it's likely COREBRIDGE
6. Return ONLY the exact carrier name: "AETNA", "COREBRIDGE", "RNA", "ANAM", "MOH", "GTL", "SBLI", "LIBERTY", "TRANSAMERICA", "ROYAL_NEIGHBORS"
7. If no clear match is found, return "UNCATEGORIZED"
8. Focus on content within the email body, not the sender information

Return only the carrier name, nothing else.`;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterApiKey}`,
            'HTTP-Referer': 'https://unlimited-insurance-automation.com',
            'X-Title': 'Email Categorization',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'openai/gpt-oss-120b:free',
            messages: [
              {
                role: 'system',
                content: 'You are an expert insurance email categorizer. Always return only the carrier name, nothing else.'
              },
              {
                role: 'user',
                content: aiPrompt
              }
            ],
            temperature: 0.1,
            max_tokens: 50
          })
        });

        if (!response.ok) {
          console.error('AI categorization error:', response.statusText);
          return folders.find(f => f.carrier_name === 'UNCATEGORIZED')?.id;
        }

        const aiData = await response.json();
        const aiResult = aiData.choices[0].message.content.trim().toUpperCase();
        
        console.log(`AI categorization result for email ${email.id}: ${aiResult}`);
        
        // Find matching folder
        const matchingFolder = folders.find(f => f.carrier_name === aiResult);
        return matchingFolder?.id || folders.find(f => f.carrier_name === 'UNCATEGORIZED')?.id;

      } catch (error) {
        console.error('Error in AI categorization:', error);
        return folders.find(f => f.carrier_name === 'UNCATEGORIZED')?.id;
      }
    };

    // Process emails in batches
    const results = {
      success_count: 0,
      error_count: 0,
      categorized_emails: [] as any[]
    };

    for (const email of emails) {
      try {
        const folderId = await categorizeEmail(email);
        
        // Update email with folder assignment
        const { error: updateError } = await supabaseClient
          .from('emails')
          .update({ 
            folder_id: folderId,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`Failed to update email ${email.id}:`, updateError);
          results.error_count++;
        } else {
          results.success_count++;
          const folder = folders.find(f => f.id === folderId);
          results.categorized_emails.push({
            email_id: email.id,
            subject: email.subject,
            folder_name: folder?.display_name || 'Unknown'
          });
        }

      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        results.error_count++;
      }
    }

    console.log(`Categorization completed: ${results.success_count} success, ${results.error_count} errors`);

    return new Response(JSON.stringify({
      success: true,
      message: `Categorized ${results.success_count} emails successfully`,
      categorized_count: results.success_count,
      error_count: results.error_count,
      total_processed: emails.length,
      categorized_emails: results.categorized_emails
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in categorize-emails function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

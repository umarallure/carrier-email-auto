import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// AETNA Action Mapping based on carrier status codes and indications
// Maps Aetna status codes and rejection reasons to GHL stages and note templates
const AETNA_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  // Application Submitted
  "We have received the application": {
    indication: "We have received the application(s) : Submitted Application(s):",
    ghlNote: "Application Submitted to the carrier waiting for the next update",
    ghlStage: "Pending Approval"
  },
  "Submitted Application": {
    indication: "We have received the application(s) : Submitted Application(s):",
    ghlNote: "Application Submitted to the carrier waiting for the next update",
    ghlStage: "Pending Approval"
  },
  
  // Declined
  "Declined": {
    indication: "Declined: Application Declined (pending explanation from correspondence email) Declined Application(s):",
    ghlNote: "Application has been declined. Please check manually for the underwriting explanation in the correspondence email.",
    ghlStage: "Declined Underwriting"
  },
  "Application Declined": {
    indication: "Declined: Application Declined (pending explanation from correspondence email) Declined Application(s):",
    ghlNote: "Application has been declined. Please check manually for the underwriting explanation in the correspondence email.",
    ghlStage: "Declined Underwriting"
  },
  
  // Incomplete/Withdrawn
  "Incomplete": {
    indication: "Incomplete: Application can be moved to withdrawn with note that says",
    ghlNote: "Application closed as incomplete. Need to reconfirm clients information and resell with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "Application can be moved to withdrawn": {
    indication: "Incomplete: Application can be moved to withdrawn with note that says",
    ghlNote: "Application closed as incomplete. Need to reconfirm clients information and resell with another carrier",
    ghlStage: "Application Withdrawn"
  },
  
  // Issued - Pending First Draft
  "We have issued the application": {
    indication: "We have issued the application(s) below:Issued Application(s):",
    ghlNote: "The Carrier has accepted the application and we are waiting for the first darft payment",
    ghlStage: "Issued - Pending First Draft"
  },
  "Issued Application": {
    indication: "We have issued the application(s) below:Issued Application(s):",
    ghlNote: "The Carrier has accepted the application and we are waiting for the first darft payment",
    ghlStage: "Issued - Pending First Draft"
  },
  
  // Potential Lapse - No Action (to be ignored in extraction)
  "Potential lapse": {
    indication: "Potential lapse:The following clients are at risk of their policies lapsing due to non-payment. Your immediate attention is greatly appreciated.",
    ghlNote: "The Usual Update from carrier about the failed payment",
    ghlStage: "No Action"
  },
  
  // Failed Payment - Incorrect Banking Info
  "Unable to Locate Account": {
    indication: "The following EFT transaction(s) have been rejected due to reason shown below. Your immediate attention is greatly appreciated.Insufficient fund(s): Unable to Locate Account",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "Account Closed": {
    indication: "The following EFT transaction(s) have been rejected due to reason shown below. Your immediate attention is greatly appreciated.Insufficient fund(s): Account Closed",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  
  // Failed Payment - Unauthorized Draft
  "Authorization Revoked": {
    indication: "The following EFT transaction(s) have been rejected due to reason shown below. Your immediate attention is greatly appreciated.Insufficient fund(s): Authorization Revoked",
    ghlNote: "EFT rejected – authorization revoked by client. Contact for reauthorization.",
    ghlStage: "FDPF Unauthorized Draft"
  },
  
  // Failed Payment - Insufficient Funds
  "Insufficient Funds": {
    indication: "The following EFT transaction(s) have been rejected due to reason shown below. Your immediate attention is greatly appreciated.Insufficient fund(s): Insufficient Funds",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "Insufficient fund": {
    indication: "The following EFT transaction(s) have been rejected due to reason shown below. Your immediate attention is greatly appreciated.Insufficient fund(s):",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  
  // General categories for backward compatibility
  "Pending": {
    indication: "Pending action or information required",
    ghlNote: "Pending action required. Need to review and provide requested information or documentation to Aetna.",
    ghlStage: "Pending"
  }
};

// Function to get action mapping with 4-tier priority matching
// Priority: 1) Exact subcategory match, 2) Partial subcategory match, 3) Exact category match, 4) Partial category match
function getAetnaActionMapping(category: string, subcategory: string) {
  console.log('[AETNA Action Mapping] Searching for:', { category, subcategory });

  // Tier 1: Exact subcategory match
  if (subcategory && AETNA_ACTION_MAPPING[subcategory]) {
    console.log('[AETNA Action Mapping] Tier 1 - Exact subcategory match found:', subcategory);
    return AETNA_ACTION_MAPPING[subcategory];
  }

  // Tier 2: Partial subcategory match (case-insensitive contains)
  if (subcategory) {
    const subcategoryLower = subcategory.toLowerCase();
    for (const [key, value] of Object.entries(AETNA_ACTION_MAPPING)) {
      if (key.toLowerCase().includes(subcategoryLower) || subcategoryLower.includes(key.toLowerCase())) {
        console.log('[AETNA Action Mapping] Tier 2 - Partial subcategory match found:', key);
        return value;
      }
    }
  }

  // Tier 3: Exact category match
  if (category && AETNA_ACTION_MAPPING[category]) {
    console.log('[AETNA Action Mapping] Tier 3 - Exact category match found:', category);
    return AETNA_ACTION_MAPPING[category];
  }

  // Tier 4: Partial category match (case-insensitive contains)
  if (category) {
    const categoryLower = category.toLowerCase();
    for (const [key, value] of Object.entries(AETNA_ACTION_MAPPING)) {
      if (key.toLowerCase().includes(categoryLower) || categoryLower.includes(key.toLowerCase())) {
        console.log('[AETNA Action Mapping] Tier 4 - Partial category match found:', key);
        return value;
      }
    }
  }

  // Default fallback
  console.log('[AETNA Action Mapping] No match found, using Pending default');
  return AETNA_ACTION_MAPPING["Pending"];
}

// Function to clean string data (remove brackets, quotes, arrays)
function cleanString(value: any): string | null {
  if (!value) return null;
  
  if (Array.isArray(value)) {
    value = value[0] || '';
  }
  
  if (typeof value !== 'string') {
    value = String(value);
  }
  
  // Remove leading/trailing brackets and quotes
  value = value.trim()
    .replace(/^\[|\]$/g, '')
    .replace(/^["']|["']$/g, '')
    .trim();
  
  return value || null;
}

// Function to clean HTML and extract text content
function cleanHtmlContent(html: string): string {
  if (!html) return '';
  
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove HTML tags but preserve table structure
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, ' | ');
  text = text.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&apos;/g, "'");
  
  // Clean up excessive whitespace
  text = text.replace(/\n\s*\n/g, '\n').trim();
  
  return text;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email_id, force_reprocess = false } = await req.json()
    
    if (!email_id) {
      throw new Error('Email ID is required')
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if analysis already exists and force_reprocess is false
    if (!force_reprocess) {
      const { data: existingAnalysis } = await supabase
        .from('email_analysis_results')
        .select('*')
        .eq('email_id', email_id)
        .single()

      if (existingAnalysis) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Analysis already exists',
            analysis: existingAnalysis 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        )
      }
    }

    // Fetch email data
    const { data: email, error: emailError } = await supabase
      .from('emails')
      .select('*')
      .eq('id', email_id)
      .single()

    if (emailError || !email) {
      throw new Error('Email not found')
    }
    
    // Clean HTML content
    const cleanedEmailBody = cleanHtmlContent(email.body);

    // Aetna specific AI analysis prompt - Extract ALL policy updates individually
    const prompt = `
You are an AI specialist in analyzing Aetna insurance carrier emails.

**YOUR MAIN TASK:**
Extract EVERY policy update from this email. Do NOT skip or combine updates. Return an array with ONE object per policy update.

**EMAIL SECTIONS TO PROCESS:**
1. "Potential lapse" → IGNORE (informational only, do not extract)
2. "Intent to cancel" → EXTRACT (each policy separately)
3. "Insufficient fund(s)" → EXTRACT (each policy separately)
4. Any other sections → EXTRACT

**CRITICAL EXTRACTION RULES:**
1. Parse HTML tables and extract each row as a separate policy
2. For each policy, extract: Policy Number, Applicant Name, and the specific reason/status
3. Map the reason to the appropriate Aetna status code
4. Create individual JSON objects - one per policy
5. Each policy gets its own GHL stage and notes based on its specific reason

**AETNA STATUS CODE MAPPING:**

**Cancellation (Intent to cancel):**
- "Coverage" / "Cancellation Reason: Coverage" → Subcategory: "Cancelled - Coverage"
- "Other" reasons → Subcategory: "Cancelled - Other Reason"
- GHL Stage: "Chargeback Cancellation"
- GHL Note: "Client requested cancellation. Process cancellation request and close policy."

**EFT Rejections (Insufficient fund(s)):**
- "Authorization Revoked" → Subcategory: "Authorization Revoked", GHL Stage: "FDPF Unauthorized Draft", GHL Note: "EFT rejected – authorization revoked by client. Contact for reauthorization."
- "Account Closed" → Subcategory: "Account Closed", GHL Stage: "FDPF Incorrect Banking Info", GHL Note: "Failed Payment due to incorrect banking info - account closed. Reconfirm banking information and redate policy."
- "Unable to Locate Account" → Subcategory: "Unable to Locate Account", GHL Stage: "FDPF Incorrect Banking Info", GHL Note: "Failed Payment due to incorrect banking info. Reconfirm banking information and redate policy."
- "Insufficient Funds" → Subcategory: "Insufficient Funds", GHL Stage: "FDPF Insufficient Funds", GHL Note: "EFT rejected due to insufficient funds. Contact client and schedule policy redate."

**Potential Lapse (IGNORE - do NOT extract):**
- Contains informational data only - skip completely

Email Subject: ${email.subject}
Email Cleaned Body:
${cleanedEmailBody}

**FOR EACH POLICY UPDATE:**
Return a JSON object with EXACTLY these fields:

{
  "customer_name": "exact applicant name from email",
  "policy_id": "exact policy number from email",
  "email_update_date": "date mentioned (YYYY-MM-DD) or null",
  "category": "Cancellation" OR "Failed Payment" OR "Other",
  "subcategory": "specific status code (e.g., 'Cancelled - Coverage', 'Authorization Revoked', 'Insufficient Funds')",
  "summary": "brief one-sentence description of this specific policy's status",
  "suggested_action": "specific action for this policy",
  "ghl_stage": "exact GHL stage for this policy",
  "ghl_note": "exact GHL note/message for this policy"
}

**RETURN FORMAT:**
- If multiple policies: return JSON array with one object per policy
- If single policy: return single JSON object
- Do NOT include policies from "Potential lapse" section
- Do NOT combine policies - each must be separate

Return ONLY valid JSON, nothing else.
`;

    console.log('[AETNA] Starting AI analysis for email:', email_id);
    
    // Call Groq API
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_completion_tokens: 2048,
        top_p: 1,
        stream: false,
        stop: null
      })
    })

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text()
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`)
    }

    const aiResponse = await groqResponse.json()
    const aiContent = aiResponse.choices[0]?.message?.content

    if (!aiContent) {
      throw new Error('No response from Groq AI')
    }

    console.log('[AETNA] Raw AI response:', aiContent.substring(0, 500));

    // Parse AI response
    let analysisData
    try {
      // Clean the response to extract JSON
      const cleanContent = aiContent.replace(/```json\n?|\n?```/g, '').trim()
      analysisData = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('[AETNA] Failed to parse Groq AI response:', aiContent)
      throw new Error('Invalid AI response format')
    }

    // Handle array response (multiple policies) or single object
    const policies = Array.isArray(analysisData) ? analysisData : [analysisData];
    
    console.log(`[AETNA] Extracted ${policies.length} policy update(s)`);

    // Safety check: if no valid policy data
    if (!policies || policies.length === 0 || !policies[0]) {
      console.log('[AETNA] No actionable policy data found');
      
      // Update email status and return
      await supabase
        .from('emails')
        .update({ status: 'completed' })
        .eq('id', email_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No actionable policy updates found in email',
          policies_count: 0,
          analysis: null
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('[AETNA] Processing policies and creating records...');

    // Map category to database-allowed values
    const mapCategoryToDatabase = (category: string, ghlStage: string): string => {
      if (ghlStage.includes('FDPF')) return 'Failed payment';
      if (ghlStage === 'Chargeback Cancellation') return 'Cancelled policy';
      if (category === 'Cancellation') return 'Cancelled policy';
      if (category === 'Failed Payment') return 'Failed payment';
      return 'Pending';
    };

    // Build ONE combined analysis record with all policies
    // Store policies as comma-separated customer/policy data in customer_name and policy_id fields
    const allCustomerNames: string[] = [];
    const allPolicyIds: string[] = [];
    const emailActionsToInsert: any[] = [];
    let combinedCategory = 'Pending';
    let combinedSubcategory = 'Unspecified';
    let combinedSummary = '';
    let combinedSuggestedAction = '';
    
    for (let i = 0; i < policies.length; i++) {
      const policyData = policies[i];
      
      const cleanedCustomerName = cleanString(policyData.customer_name);
      const cleanedPolicyId = cleanString(policyData.policy_id);
      
      console.log(`[AETNA] Processing policy ${i + 1}/${policies.length}: ${cleanedCustomerName} - ${cleanedPolicyId}`);
      
      // Collect customer and policy names for combined record
      allCustomerNames.push(cleanedCustomerName || '');
      allPolicyIds.push(cleanedPolicyId || '');
      
      // Sanitize email_update_date
      let emailUpdateDate = policyData.email_update_date;
      if (emailUpdateDate === 'null' || emailUpdateDate === 'NULL' || emailUpdateDate === '') {
        emailUpdateDate = null;
      }
      
      // Map category to allowed database values
      const dbCategory = mapCategoryToDatabase(policyData.category || '', policyData.ghl_stage || '');
      
      // Use first policy's category for the combined record
      if (i === 0) {
        combinedCategory = dbCategory;
        combinedSubcategory = policyData.subcategory || 'Unspecified';
        combinedSummary = policyData.summary || 'Policy update';
        combinedSuggestedAction = policyData.suggested_action || 'Review and respond';
      }
      
      // Create individual email_action for each policy with its specific GHL stage/notes
      const emailAction = {
        email_id: email_id,
        customer_name: cleanedCustomerName,
        policy_id: cleanedPolicyId,
        email_subject: email.subject,
        email_received_date: email.received_date,
        carrier: 'Aetna',
        carrier_label: 'Aetna Senior Supplemental',
        category: dbCategory,
        subcategory: policyData.subcategory || 'Unspecified',
        summary: policyData.summary,
        suggested_action: policyData.suggested_action,
        priority: 'high',
        action_status: 'pending',
        action_code: policyData.subcategory || 'Other',
        ghl_note: policyData.ghl_note,
        ghl_stage_change: policyData.ghl_stage,
        created_at: new Date().toISOString()
      };
      
      emailActionsToInsert.push(emailAction);
      
      console.log(`[AETNA] Policy ${i + 1}: ${policyData.ghl_stage} - ${policyData.ghl_note}`);
    }

    // Create ONE combined analysis record with all policies (comma-separated)
    console.log('[AETNA] Creating combined analysis record...');
    
    const combinedAnalysisRecord = {
      email_id: email_id,
      customer_name: allCustomerNames.join(', '),
      policy_id: allPolicyIds.join(', '),
      reason: combinedSuggestedAction,
      category: combinedCategory,
      subcategory: combinedSubcategory,
      summary: combinedSummary,
      suggested_action: combinedSuggestedAction,
      review_status: 'pending',
      document_links: null,
      carrier: 'Aetna',
      action_code: combinedSubcategory,
      ghl_note: `${policies.length} policy update(s) processed`,
      ghl_stage: 'Aetna Analysis Complete',
      analysis_timestamp: new Date().toISOString()
    };
    
    // Insert the combined analysis record
    const { data: insertedAnalysis, error: analysisError } = await supabase
      .from('email_analysis_results')
      .insert(combinedAnalysisRecord)
      .select()
      .single();
    
    if (analysisError) {
      console.error('[AETNA] Error inserting analysis:', analysisError);
      throw new Error(`Failed to save analysis: ${analysisError.message}`);
    }
    
    console.log(`[AETNA] Combined analysis inserted with ID: ${insertedAnalysis.id}`);
    
    // Add analysis_id to all email_actions
    const emailActionsWithAnalysisId = emailActionsToInsert.map(action => ({
      ...action,
      analysis_id: insertedAnalysis.id
    }));

    // Insert all email actions (separate records for each policy)
    console.log(`[AETNA] Inserting ${emailActionsWithAnalysisId.length} separate email actions...`);
    
    if (emailActionsWithAnalysisId.length > 0) {
      const { data: insertedActions, error: actionsError } = await supabase
        .from('email_actions')
        .insert(emailActionsWithAnalysisId)
        .select();

      if (actionsError) {
        console.error('[AETNA] Error inserting email actions:', actionsError);
        throw new Error(`Failed to save email actions: ${actionsError.message}`);
      } else {
        console.log(`[AETNA] Successfully inserted ${insertedActions?.length || 0} email actions`);
      }
    }

    // Update email status
    await supabase
      .from('emails')
      .update({ status: 'completed' })
      .eq('id', email_id)

    console.log('[AETNA] Analysis completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Aetna email analysis completed - ${policies.length} policy update(s) processed`,
        policies_count: policies.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in Aetna analysis:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

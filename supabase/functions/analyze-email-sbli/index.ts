import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// SBLI Action Mapping based on carrier status codes and indications
// Maps SBLI status codes to GHL stages and note templates
const SBLI_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  // Approved/Issued - No Action
  "Final Decision/Policy Approved pending": {
    indication: "Final Decision/Policy Approved pending",
    ghlNote: "(no note)",
    ghlStage: "No action"
  },
  "Policy Approved": {
    indication: "Final Decision/Policy Approved pending",
    ghlNote: "(no note)",
    ghlStage: "No action"
  },
  "Approved": {
    indication: "Final Decision/Policy Approved pending",
    ghlNote: "(no note)",
    ghlStage: "No action"
  },
  
  // Policy Mailed/Sent - No Action
  "Policy Mailed/Sent": {
    indication: "Policy Mailed/Sent",
    ghlNote: "(no note)",
    ghlStage: "No Action"
  },
  "Policy Mailed": {
    indication: "Policy Mailed/Sent",
    ghlNote: "(no note)",
    ghlStage: "No Action"
  },
  "Policy Sent": {
    indication: "Policy Mailed/Sent",
    ghlNote: "(no note)",
    ghlStage: "No Action"
  },
  
  // Policy Placed In Force/Issued and Paid - No Action
  "Policy Placed In Force": {
    indication: "Policy Placed In Force,Issued and Paid",
    ghlNote: "(no note)",
    ghlStage: "No action"
  },
  "Issued and Paid": {
    indication: "Policy Placed In Force,Issued and Paid",
    ghlNote: "(no note)",
    ghlStage: "No action"
  },
  "In Force": {
    indication: "Policy Placed In Force,Issued and Paid",
    ghlNote: "(no note)",
    ghlStage: "No action"
  },
  
  // Policy Lapse Notice Sent - Pending Lapse
  "Policy Lapse Notice Sent": {
    indication: "Policy Lapse Notice Sent The following events have occurred on this policy.The Policy has lapsed. Please take necessary steps to ensure your client is notified accordingly. Our system will be updated tonight to reflect this change in status.",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  "Lapse Notice": {
    indication: "Policy Lapse Notice Sent The following events have occurred on this policy.The Policy has lapsed. Please take necessary steps to ensure your client is notified accordingly. Our system will be updated tonight to reflect this change in status.",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  "Policy Lapsed": {
    indication: "Policy Lapse Notice Sent The following events have occurred on this policy.The Policy has lapsed. Please take necessary steps to ensure your client is notified accordingly. Our system will be updated tonight to reflect this change in status.",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  "Pending Lapse": {
    indication: "Policy Lapse Notice Sent The following events have occurred on this policy.The Policy has lapsed. Please take necessary steps to ensure your client is notified accordingly. Our system will be updated tonight to reflect this change in status.",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  
  // Payment Rejection - Insufficient Funds
  "Payment Rejection : The following events have occurred on this policy .A recently submitted payment could not be processed per the following reason:\nInsufficient funds": {
    indication: "Payment Rejection : The following events have occurred on this policy .A recently submitted payment could not be processed per the following reason:\nInsufficient funds",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "Insufficient funds": {
    indication: "Payment Rejection : Insufficient funds",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "Insufficient Funds": {
    indication: "Payment Rejection : Insufficient funds",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  
  // Payment Rejection - Invalid Number (Incorrect Banking Info)
  "Payment Rejection:We have recently updated the following information.\nA recently submitted payment could not be processed per the following reason:\nInvalid Number": {
    indication: "Payment Rejection:We have recently updated the following information.\nA recently submitted payment could not be processed per the following reason:\nInvalid Number",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "Invalid Number": {
    indication: "Payment Rejection: Invalid Number",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "Invalid number": {
    indication: "Payment Rejection: Invalid Number",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  
  // Payment Rejection - Payment Stopped (Unauthorized Draft)
  "Payment Rejection:The following events have occurred on this policy\nA recently submitted payment could not be processed per the following reason:\nPayment stopped": {
    indication: "Payment Rejection:The following events have occurred on this policy\nA recently submitted payment could not be processed per the following reason:\nPayment stopped",
    ghlNote: "Payment failure due to charge not being authorized by clients bank\n\nNeed to connect client to their bank to authorize the draft, then request policy redate with carrier",
    ghlStage: "FDPF Unauthorized Draft"
  },
  "Payment stopped": {
    indication: "Payment Rejection: Payment stopped",
    ghlNote: "Payment failure due to charge not being authorized by clients bank\n\nNeed to connect client to their bank to authorize the draft, then request policy redate with carrier",
    ghlStage: "FDPF Unauthorized Draft"
  },
  "Payment Stopped": {
    indication: "Payment Rejection: Payment stopped",
    ghlNote: "Payment failure due to charge not being authorized by clients bank\n\nNeed to connect client to their bank to authorize the draft, then request policy redate with carrier",
    ghlStage: "FDPF Unauthorized Draft"
  },
  
  // General categories for backward compatibility
  "Payment Rejection": {
    indication: "Payment rejection or failed payment",
    ghlNote: "Failed Payment detected. Need to contact client and reconfirm payment information",
    ghlStage: "Pending Failed Payment Fix"
  },
  "Failed Payment": {
    indication: "Payment failed or returned",
    ghlNote: "Failed Payment detected. Need to contact client and reconfirm payment information",
    ghlStage: "Pending Failed Payment Fix"
  },
  "Other": {
    indication: "General inquiry or other matter",
    ghlNote: "General inquiry received. Need to review and determine appropriate action for SBLI matter.",
    ghlStage: "Needs manual check"
  }
};

// Function to get action mapping with 4-tier priority matching
// Priority: 1) Exact subcategory match, 2) Partial subcategory match, 3) Exact category match, 4) Partial category match
function getSBLIActionMapping(category: string, subcategory: string) {
  console.log('[SBLI Action Mapping] Searching for:', { category, subcategory });

  // Tier 1: Exact subcategory match
  if (subcategory && SBLI_ACTION_MAPPING[subcategory]) {
    console.log('[SBLI Action Mapping] Tier 1 - Exact subcategory match found:', subcategory);
    return { mapping: SBLI_ACTION_MAPPING[subcategory], code: subcategory };
  }

  // Tier 2: Partial subcategory match (case-insensitive contains)
  if (subcategory) {
    const subcategoryLower = subcategory.toLowerCase();
    for (const [key, value] of Object.entries(SBLI_ACTION_MAPPING)) {
      if (key.toLowerCase().includes(subcategoryLower) || subcategoryLower.includes(key.toLowerCase())) {
        console.log('[SBLI Action Mapping] Tier 2 - Partial subcategory match found:', key);
        return { mapping: value, code: key };
      }
    }
  }

  // Tier 3: Exact category match
  if (category && SBLI_ACTION_MAPPING[category]) {
    console.log('[SBLI Action Mapping] Tier 3 - Exact category match found:', category);
    return { mapping: SBLI_ACTION_MAPPING[category], code: category };
  }

  // Tier 4: Partial category match (case-insensitive contains)
  if (category) {
    const categoryLower = category.toLowerCase();
    for (const [key, value] of Object.entries(SBLI_ACTION_MAPPING)) {
      if (key.toLowerCase().includes(categoryLower) || categoryLower.includes(key.toLowerCase())) {
        console.log('[SBLI Action Mapping] Tier 4 - Partial category match found:', key);
        return { mapping: value, code: key };
      }
    }
  }

  // Default fallback
  console.log('[SBLI Action Mapping] No match found, using Other default');
  return { mapping: SBLI_ACTION_MAPPING["Other"], code: "Other" };
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
    .replace(/^[\"']|[\"']$/g, '')
    .trim();
  
  return value || null;
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

    // SBLI (Savings Bank Life Insurance) specific AI analysis prompt with enhanced status code detection
    const prompt = `
You are an AI assistant specialized in analyzing SBLI (Savings Bank Life Insurance) emails. SBLI provides life insurance, disability insurance, and retirement planning services primarily in Massachusetts and New York.

**CRITICAL EXTRACTION RULES FOR SBLI EMAILS:**
1. **STATUS CODE PRIORITY**: Place the most specific SBLI status code or indication in the **subcategory** field (this is **CRITICAL** for accurate action mapping).
2. **MULTIPLE POLICIES**: If email contains multiple policy updates, extract EACH policy as a separate record.
3. **EXACT PHRASES**: Look for exact phrases from SBLI notifications and use them as-is.

**SBLI STATUS CODES TO DETECT (Place in subcategory field):**

**Policy Status - No Action Required:**
- "Final Decision/Policy Approved pending" → Category: "Policy Status", Subcategory: "Policy Approved"
- "Policy Mailed/Sent" → Category: "Policy Status", Subcategory: "Policy Mailed"
- "Policy Placed In Force" / "Issued and Paid" → Category: "Policy Status", Subcategory: "In Force"

**Pending Lapse:**
- "Policy Lapse Notice Sent" → Category: "Pending Lapse", Subcategory: "Lapse Notice"
- "Policy has lapsed" → Category: "Pending Lapse", Subcategory: "Policy Lapsed"

**Failed Payment - Insufficient Funds:**
- "Payment Rejection" + "Insufficient funds" → Category: "Failed Payment", Subcategory: "Insufficient Funds"
- "payment could not be processed" + "Insufficient funds" → Category: "Failed Payment", Subcategory: "Insufficient funds"

**Failed Payment - Incorrect Banking Info:**
- "Payment Rejection" + "Invalid Number" → Category: "Failed Payment", Subcategory: "Invalid Number"
- "payment could not be processed" + "Invalid Number" → Category: "Failed Payment", Subcategory: "Invalid number"

**Failed Payment - Unauthorized Draft:**
- "Payment Rejection" + "Payment stopped" → Category: "Failed Payment", Subcategory: "Payment Stopped"
- "payment could not be processed" + "Payment stopped" → Category: "Failed Payment", Subcategory: "Payment stopped"

**General Categories:**
- "Payment Rejection" (general) → Category: "Failed Payment", Subcategory: "Payment Rejection"
- Other matters → Category: "Other", Subcategory: as appropriate

Analyze this email and extract the following information in JSON format:

Email Subject: ${email.subject}
Email Body: ${email.body}
From: ${email.from_email || 'Unknown'}
Date: ${email.received_date}

For EACH policy update in the email, provide:

1. **customer_name**: Extract the policyholder/customer name (look for names in body, signature, or subject)
2. **policy_id**: Find policy numbers, certificate numbers, or account numbers
3. **email_update_date**: Extract the date of the status update mentioned in the email (format: YYYY-MM-DD). If no specific date is mentioned, use null.
4. **category**: Use one of the categories listed above based on SBLI status codes
5. **subcategory**: **CRITICAL** - Place the EXACT SBLI status phrase here. Examples:
   - "Policy Approved"
   - "Policy Mailed"
   - "In Force"
   - "Lapse Notice"
   - "Insufficient Funds"
   - "Invalid Number"
   - "Payment Stopped"
6. **summary**: Brief summary of the specific policy update (not the entire email)
7. **suggested_action**: What action should be taken for this specific policy
8. **review_status**: 
   - "needs_immediate_attention" for failed payments, lapse notices requiring immediate action
   - "standard_processing" for policy status updates, approvals
   - "low_priority" for mailed/sent notifications
9. **document_links**: Extract any URLs or document references
10. **reason**: Specific reason for the status (e.g., "Policy approved and mailed", "Payment rejected - insufficient funds", "Policy pending lapse")

**IMPORTANT REMINDERS:**
- Each policy should be a separate JSON object if multiple policies exist
- Place the most specific status code in the subcategory field
- If email has 3 policies, return array of 3 objects

Return ONLY a valid JSON array of objects (one per policy update), or a single JSON object if only one policy. Do not include any other text or explanation.
`

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
        max_completion_tokens: 1024,
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
      throw new Error('No response from AI')
    }

    // Parse AI response
    let analysisData
    try {
      // Clean the response to extract JSON
      const cleanContent = aiContent.replace(/```json\n?|\n?```/g, '').trim()
      analysisData = JSON.parse(cleanContent)
    } catch (parseError) {
      console.error('Failed to parse Groq AI response:', aiContent)
      throw new Error('Invalid AI response format')
    }

    // Handle array response (multiple policies) or single object
    const policies = Array.isArray(analysisData) ? analysisData : [analysisData];
    
    console.log(`[SBLI] Processing ${policies.length} policy update(s) from email`);

    // Safety check: if no valid policy data, mark as informational
    if (!policies || policies.length === 0 || !policies[0]) {
      console.log('[SBLI] No actionable policy data found - marking as informational update');
      
      // Save as informational/skipped update
      const { data: savedAnalysis, error: saveError } = await supabase
        .from('email_analysis_results')
        .upsert({
          email_id: email_id,
          customer_name: 'N/A',
          policy_id: 'N/A',
          email_update_date: null,
          reason: 'Informational email - no actionable updates',
          category: 'Pending',
          subcategory: 'Informational Update',
          summary: 'This email contains only informational updates that do not require action.',
          suggested_action: 'No action required - informational only',
          review_status: 'pending',
          document_links: null,
          carrier: 'SBLI',
          action_code: 'Ignore Update',
          ghl_note: 'Ignore Update',
          ghl_stage: 'Already updated',
          analysis_timestamp: new Date().toISOString()
        })
        .select()
        .single()

      if (saveError) {
        console.error(`Failed to save informational analysis:`, saveError.message);
        throw new Error(`Failed to save analysis: ${saveError.message}`)
      }

      // Update email status
      await supabase
        .from('emails')
        .update({ status: 'completed' })
        .eq('id', email_id)

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'SBLI email processed - informational only (no actionable updates)',
          analysis: savedAnalysis,
          policies_count: 0,
          is_informational: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Collect all customer names and policy IDs
    const customerNames: string[] = [];
    const policyIds: string[] = [];
    const summaries: string[] = [];
    const reasons: string[] = [];
    
    // Use the first policy's data for primary fields, but collect all names/IDs
    let primaryPolicy = policies[0];
    let primaryActionMapping = null;
    
    for (const policyData of policies) {
      // Clean customer name and policy ID (remove brackets, quotes, etc.)
      const cleanedCustomerName = cleanString(policyData.customer_name);
      const cleanedPolicyId = cleanString(policyData.policy_id);
      
      if (cleanedCustomerName) customerNames.push(cleanedCustomerName);
      if (cleanedPolicyId) policyIds.push(cleanedPolicyId);
      if (policyData.summary) summaries.push(policyData.summary);
      if (policyData.reason) reasons.push(policyData.reason);
      
      // Use the first policy with a valid action mapping as primary
      if (!primaryActionMapping) {
        const { mapping } = getSBLIActionMapping(policyData.category || '', policyData.subcategory || '');
        primaryActionMapping = mapping;
        primaryPolicy = policyData;
      }
    }
    
    // Get action mapping for primary policy
    const { mapping: actionMapping, code: actionCode } = getSBLIActionMapping(
      primaryPolicy.category || '', 
      primaryPolicy.subcategory || ''
    );
    
    // Sanitize email_update_date (convert string "null" to actual null)
    let emailUpdateDate = primaryPolicy.email_update_date;
    if (emailUpdateDate === 'null' || emailUpdateDate === 'NULL' || emailUpdateDate === '') {
      emailUpdateDate = null;
    }

    // Map SBLI categories to database-allowed categories
    const mapCategoryToDatabase = (category: string, ghlStage: string) => {
      // Use ghlStage to determine the appropriate database category
      if (ghlStage.includes('FDPF')) return 'Failed payment';
      if (ghlStage === 'Pending Lapse') return 'Pending Lapse';
      if (ghlStage === 'No Action' || ghlStage === 'No action') return 'Pending';
      if (ghlStage === 'Needs manual check') return 'Pending';
      if (ghlStage === 'Pending Failed Payment Fix') return 'Failed payment';
      return 'Pending'; // Default fallback
    };

    const databaseCategory = mapCategoryToDatabase(primaryPolicy.category || '', actionMapping.ghlStage);
    
    // Combine multiple policy IDs and customer names with comma separation
    const combinedCustomerNames = customerNames.length > 0 ? customerNames.join(', ') : 'Unknown';
    const combinedPolicyIds = policyIds.length > 0 ? policyIds.join(', ') : 'Not provided';
    const combinedSummary = summaries.length > 0 ? summaries.join(' | ') : 'No summary available';
    const combinedReason = reasons.length > 0 ? reasons.join(' | ') : 'General inquiry';

    // Save analysis results to database (single record with combined data)
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('email_analysis_results')
      .upsert({
        email_id: email_id,
        customer_name: combinedCustomerNames,
        policy_id: combinedPolicyIds,
        email_update_date: emailUpdateDate,
        reason: combinedReason,
        category: databaseCategory,
        subcategory: primaryPolicy.subcategory || 'Unspecified',
        summary: combinedSummary,
        suggested_action: primaryPolicy.suggested_action || 'Review and respond',
        review_status: primaryPolicy.review_status === 'needs_immediate_attention' ? 'pending' : 'pending',
        document_links: primaryPolicy.document_links || null,
        carrier: 'SBLI',
        action_code: actionCode,
        ghl_note: actionMapping.ghlNote,
        ghl_stage: actionMapping.ghlStage,
        analysis_timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (saveError) {
      console.error(`Failed to save analysis:`, saveError.message);
      throw new Error(`Failed to save analysis: ${saveError.message}`)
    }

    // Update email status
    await supabase
      .from('emails')
      .update({ status: 'completed' })
      .eq('id', email_id)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `SBLI email analysis completed - ${policies.length} policy update(s) processed`,
        analysis: savedAnalysis,
        policies_count: policies.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in SBLI analysis:', error)
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

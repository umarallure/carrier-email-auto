import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
// COREBRIDGE Action Mapping based on carrier status codes and indications
// Maps Corebridge status codes to GHL stages and note templates
const COREBRIDGE_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  // Failed Payment - Incorrect Banking Info
  "Unable to Locate Account": {
    indication: "Failed Payment",
    ghlNote: "Reason For Failed Payment: Incorrect Banking information\n\nAction Required: Reconfirm banking information and request policy redate",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "INVALID ACCOUNT NUMBER": {
    indication: "Failed Payment",
    ghlNote: "Reason For Failed Payment: Incorrect Banking information\n\nAction Required: Reconfirm banking information and request policy redate",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "Account Closed": {
    indication: "Failed Payment",
    ghlNote: "Reason For Failed Payment: Bank Account Closed\n\nAction Required: Reconfirm banking information and request policy redate",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  
  // Failed Payment - Insufficient Funds
  "CREDIT FLOOR": {
    indication: "Failed Payment",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "Insufficient Funds": {
    indication: "Failed Payment",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  
  // Failed Payment - Unauthorized Draft
  "ACCOUNT FROZEN": {
    indication: "Failed Payment",
    ghlNote: "Reason for Failed Payment: Bank Account Frozen\n\nAction Required: Either collect new banking information, or confir with the bank that the account can be put in good standing",
    ghlStage: "FDPF Unauthorized Draft"
  },
  "Payment Stoped": {
    indication: "Failed Payment",
    ghlNote: "Reason for Failed Payment: Unauthorized Draft\n\nAction Required: Connect client to their bank and authorize the draft, then request a policy redate with carrier",
    ghlStage: "FDPF Unauthorized Draft"
  },
  "Payment Stopped": {
    indication: "Failed Payment",
    ghlNote: "Reason for Failed Payment: Unauthorized Draft\n\nAction Required: Connect client to their bank and authorize the draft, then request a policy redate with carrier",
    ghlStage: "FDPF Unauthorized Draft"
  },
  "Not Authorized": {
    indication: "Failed Payment",
    ghlNote: "Reason for Failed Payment: Unauthorized Draft\n\nAction Required: Connect client to their bank and authorize the draft, then request a policy redate with carrier",
    ghlStage: "FDPF Unauthorized Draft"
  },
  
  // Pending Manual Action
  "we need you to take action on the following": {
    indication: "Pending Manual Action",
    ghlNote: "**Need to do manual check for notes**",
    ghlStage: "Pending Manual Action"
  },
  "Corebridge Financial has identified a discrepancy in the information supplied": {
    indication: "Pending Manual Action",
    ghlNote: "**Need to do manual check for notes**",
    ghlStage: "Pending Manual Action"
  },
  "discrepancy": {
    indication: "Pending Manual Action",
    ghlNote: "**Need to do manual check for notes**",
    ghlStage: "Pending Manual Action"
  },
  
  // Policy Reissued - Fixed Failed Payment
  "policy has been reissued": {
    indication: "Policy Reissued After Failed Payment",
    ghlNote: "The Policy got Fixed",
    ghlStage: "Pending Failed Payment Fix"
  },
  "reissued with an effective date": {
    indication: "Policy Reissued After Failed Payment",
    ghlNote: "The Policy got Fixed",
    ghlStage: "Pending Failed Payment Fix"
  },
  "policy reissued": {
    indication: "Policy Reissued After Failed Payment",
    ghlNote: "The Policy got Fixed",
    ghlStage: "Pending Failed Payment Fix"
  },
  
  // General categories maintained for backward compatibility
  "Pending": {
    indication: "Pending action or information required",
    ghlNote: "Pending action required. Need to review and provide requested information or documentation to Corebridge.",
    ghlStage: "Pending"
  },
  "Failed payment": {
    indication: "Payment processing failure",
    ghlNote: "Payment failure detected. Need to review payment method and resolve billing issues with Corebridge.",
    ghlStage: "Failed payment"
  },
  "Chargeback": {
    indication: "Charge disputed by customer",
    ghlNote: "Chargeback initiated. Need to work with customer to resolve the dispute and potentially reprocess payment.",
    ghlStage: "Chargeback"
  },
  "Cancelled policy": {
    indication: "Policy has been cancelled",
    ghlNote: "Policy cancellation processed. Need to confirm cancellation details and discuss replacement options if needed.",
    ghlStage: "Chargeback Cancellation"
  },
  "Post Underwriting Update": {
    indication: "Underwriting decision or policy update",
    ghlNote: "Underwriting update received. Need to review the decision and inform customer of next steps.",
    ghlStage: "Post Underwriting Update"
  },
  "Pending Lapse": {
    indication: "Policy at risk of lapsing",
    ghlNote: "Policy pending lapse. Need to contact customer immediately to arrange payment and prevent policy lapse.",
    ghlStage: "Pending Lapse"
  },
  "Declined/Closed as Incomplete": {
    indication: "Application declined or closed incomplete",
    ghlNote: "Application declined or closed as incomplete. Need to review reasons and explore alternative options with customer.",
    ghlStage: "Declined Underwriting"
  }
};

// Function to get action mapping with 4-tier priority matching
function getCorebridgeActionMapping(category: string, subcategory: string) {
  // Priority 1: Try exact match with subcategory (Corebridge status codes are often in subcategory)
  if (subcategory && COREBRIDGE_ACTION_MAPPING[subcategory]) {
    console.log(`Matched subcategory: ${subcategory}`);
    return { mapping: COREBRIDGE_ACTION_MAPPING[subcategory], code: subcategory };
  }
  
  // Priority 2: Try partial match with subcategory
  if (subcategory) {
    const subcategoryLower = subcategory.toLowerCase().trim();
    for (const [key, value] of Object.entries(COREBRIDGE_ACTION_MAPPING)) {
      if (subcategoryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(subcategoryLower)) {
        console.log(`Partial matched subcategory: ${subcategory} -> ${key}`);
        return { mapping: value, code: key };
      }
    }
  }
  
  // Priority 3: Try exact match with category
  if (COREBRIDGE_ACTION_MAPPING[category]) {
    console.log(`Matched category: ${category}`);
    return { mapping: COREBRIDGE_ACTION_MAPPING[category], code: category };
  }
  
  // Priority 4: Try partial match with category
  const categoryLower = category.toLowerCase();
  for (const [key, value] of Object.entries(COREBRIDGE_ACTION_MAPPING)) {
    if (categoryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(categoryLower)) {
      console.log(`Partial matched category: ${category} -> ${key}`);
      return { mapping: value, code: key };
    }
  }
  
  // Fallback to "Pending"
  console.log(`No match found, using fallback for: ${category} / ${subcategory}`);
  return { mapping: COREBRIDGE_ACTION_MAPPING["Pending"], code: "Pending" };
}
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
    const { email_id, force_reprocess } = await req.json();
    if (!email_id) {
      throw new Error('Email ID required');
    }
    console.log('Starting COREBRIDGE email analysis for email:', email_id);
    // Fetch the email from database
    const { data: email, error: emailError } = await supabaseClient.from('emails').select('*').eq('id', email_id).eq('user_id', user.id).single();
    if (emailError || !email) {
      throw new Error('Email not found or not accessible');
    }
    // Check if already analyzed (unless force reprocess)
    if (!force_reprocess) {
      const { data: existingAnalysis } = await supabaseClient.from('email_analysis_results').select('id').eq('email_id', email_id).single();
      if (existingAnalysis) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Email already analyzed',
          analysis_id: existingAnalysis.id
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }
    // COREBRIDGE-specific analysis prompt
    const corebridgeAnalysisPrompt = `You are a specialist email analyst for COREBRIDGE Financial (formerly AIG Life & Retirement). You have deep expertise in COREBRIDGE's specific processes, terminology, and customer service patterns.

For COREBRIDGE emails, pay special attention to:
- SIGITeam correspondence and communications
- Specific Corebridge status codes and error messages
Analyze the following email and extract key information in the EXACT JSON format specified below.

Email Details:
Subject: ${email.subject}
Carrier: COREBRIDGE
Body: ${email.body}

Pay special attention to body content especially forward section to get the info after the subject to find the required fields we need like Forward to get the most of the related info such as customer name, policy number and email_update_date.

CRITICAL: You MUST return a JSON object with exactly these fields:

{
  "customer_name": "string or null - Extract customer name if clearly mentioned ignore this agent name Lydia Sutton and extract the customer name only ",
  "policy_id": "string or null - Extract policy number, account number, or reference number", 
  "email_update_date": "YYYY-MM-DD or null - Extract any specific follow-up date mentioned",
  "summary": "string - Brief 2-3 sentence summary of the email content analyzing the whole body of the email",
  "suggested_action": "string - Specific recommended action based on email whole body content",
  "category": "string - Must be one of: Pending, Failed payment, Chargeback, Cancelled policy, Post Underwriting Update, Pending Lapse, Declined/Closed as Incomplete",
  "reason": "string - reason for the email update regarding the policy",
  "subcategory": "**CRITICAL** - Put the EXACT Corebridge status code here (e.g., 'Unable to Locate Account', 'CREDIT FLOOR', 'Insufficient Funds', 'Account Closed', 'INVALID ACCOUNT NUMBER', 'ACCOUNT FROZEN', 'Payment Stopped', 'Not Authorized', 'policy has been reissued', 'reissued with an effective date', 'policy reissued', 'discrepancy'). This is the most important field for action mapping.",
  "document_links": "array of strings or null - Extract any document URLs found in the email"
}

COREBRIDGE STATUS CODES TO DETECT:
**Failed Payment Codes:**
- "Unable to Locate Account" - Incorrect banking information
- "CREDIT FLOOR" - Insufficient funds
- "Insufficient Funds" - NSF situation
- "Account Closed" - Bank account closed
- "INVALID ACCOUNT NUMBER" - Incorrect banking information
- "ACCOUNT FROZEN" - Bank account frozen
- "Payment Stopped" or "Payment Stoped" - Unauthorized draft
- "Not Authorized" - Unauthorized draft

**Policy Reissued Codes (Fixed Failed Payment):**
- "policy has been reissued" - Policy reissued after failed payment
- "reissued with an effective date" - Policy reissued with new effective date
- "policy reissued" - Policy was reissued

**Pending Manual Action Codes:**
- "we need you to take action on the following" - Requires manual review
- "Corebridge Financial has identified a discrepancy in the information supplied" - Information discrepancy
- "discrepancy" - Any discrepancy requiring review

CATEGORY CLASSIFICATION RULES:
1. **Pending**: Use when carrier requests additional info, documentation, calls, premium verification, policy inquiries, general inquiries, customer service communications, application updates, underwriting updates, policy status updates, billing updates, claim updates, account updates, coverage inquiries, premium changes, beneficiary updates, address changes, or document requests
2. **Failed payment**: Use for all payment-related failures (insufficient funds, card issues, bank problems, authorization issues, account closed, invalid account, frozen account)
3. **Chargeback**: Use when customer disputes a charge through their bank/card company
4. **Cancelled policy**: Use when policy is terminated/cancelled
5. **Post Underwriting Update**: Use for underwriting decisions (approved as applied, approved differently, or declined), claims submitted, payment confirmations, policy updates
6. **Pending Lapse**: Use when policy is about to lapse but hasn't yet
7. **Declined/Closed as Incomplete**: Use when application is closed due to max rewrites, coverage limits, or no response

IMPORTANT RULES:
1. category MUST be exactly one of the predefined categories listed above
2. **subcategory** should contain the EXACT Corebridge status code when found in the email body
3. Return ONLY valid JSON, no additional text or formatting
4. If uncertain about category, use "Pending" 
5. Focus on actionable insights for customer service representatives
6. Extract dates in YYYY-MM-DD format only
7. Pay special attention to SIGITeam communications and policy servicing requests
8. Scan the email body carefully for Corebridge status codes and put them in subcategory field`;
    console.log('Sending COREBRIDGE analysis request to Groq API');
    // Call Groq API for analysis
    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'user',
            content: corebridgeAnalysisPrompt
          }
        ],
        temperature: 0.1,
        max_completion_tokens: 1024,
        top_p: 1,
        stream: false,
        stop: null
      })
    });
    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq API error: ${groqResponse.status} - ${errorText}`);
    }
    const aiResponse = await groqResponse.json();
    const aiContent = aiResponse.choices[0]?.message?.content;
    if (!aiContent) {
      throw new Error('No response from Groq AI');
    }
    // Parse the JSON response
    let analysisResult;
    try {
      // Clean the response text in case there's extra formatting
      const cleanedText = aiContent.replace(/```json\n?|\n?```/g, '').trim();
      analysisResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Groq AI response as JSON:', aiContent);
      // Fallback analysis
      analysisResult = {
        category: 'Pending',
        subcategory: 'Manual review required',
        summary: 'COREBRIDGE email analysis failed - manual review required',
        suggested_action: 'Manual review required due to analysis error',
        customer_name: null,
        policy_id: null,
        reason: 'Analysis parsing error',
        email_update_date: null,
        document_links: null
      };
    }
    console.log('Parsed COREBRIDGE analysis result:', analysisResult);
    // Log the category being returned by AI
    console.log('AI returned category:', analysisResult.category);
    
    // Process action codes and map to GHL fields using 4-tier priority matching
    const { mapping: actionMapping, code: actionCode } = getCorebridgeActionMapping(
      analysisResult.category,
      analysisResult.subcategory
    );
    const ghlNote = actionMapping.ghlNote;
    const ghlStage = actionMapping.ghlStage;
    
    console.log(`Final mapping: code="${actionCode}", stage="${ghlStage}"`);
    
    // Clean customer name and policy ID - remove brackets, quotes, and extra whitespace
    const cleanString = (value: any): string => {
      if (!value) return '';
      
      let cleaned = String(value);
      
      // Remove array brackets
      cleaned = cleaned.replace(/^\[|\]$/g, '');
      
      // Remove quotes (single and double)
      cleaned = cleaned.replace(/^["']|["']$/g, '');
      
      // If it's an array, get first element
      if (Array.isArray(value) && value.length > 0) {
        cleaned = String(value[0]);
      }
      
      // Trim whitespace
      cleaned = cleaned.trim();
      
      return cleaned;
    };

    const customerName = cleanString(analysisResult.customer_name) || null;
    const policyId = cleanString(analysisResult.policy_id) || null;
    
    // Validate the category against allowed values (must match email_actions table constraint)
    const allowedCategories = [
      "Pending",
      "Failed payment",
      "Chargeback",
      "Cancelled policy",
      "Post Underwriting Update",
      "Pending Lapse",
      "Declined/Closed as Incomplete"
    ];
    if (!allowedCategories.includes(analysisResult.category)) {
      console.warn(`Invalid category "${analysisResult.category}", defaulting to "Pending"`);
      analysisResult.category = "Pending";
    }
    // Insert analysis result into database
    const { data: insertedAnalysis, error: insertError } = await supabaseClient.from('email_analysis_results').insert({
      email_id: email_id,
      customer_name: customerName,
      policy_id: policyId,
      category: analysisResult.category,
      subcategory: analysisResult.subcategory,
      summary: analysisResult.summary,
      suggested_action: analysisResult.suggested_action,
      email_update_date: analysisResult.email_update_date && analysisResult.email_update_date !== 'null' ? analysisResult.email_update_date : null,
      reason: analysisResult.reason,
      document_links: analysisResult.document_links ? JSON.stringify(analysisResult.document_links) : null,
      action_code: actionCode,
      ghl_note: ghlNote,
      ghl_stage: ghlStage,
      carrier: 'COREBRIDGE',
      review_status: 'pending',
      is_reviewed: false,
      analysis_timestamp: new Date().toISOString()
    }).select().single();
    if (insertError) {
      console.error('Error inserting COREBRIDGE analysis:', insertError);
      throw new Error('Failed to save COREBRIDGE analysis results');
    }
    // Update email status to completed
    await supabaseClient.from('emails').update({
      status: 'completed'
    }).eq('id', email_id);
    console.log('COREBRIDGE analysis completed successfully');
    return new Response(JSON.stringify({
      success: true,
      analysis: insertedAnalysis,
      message: 'COREBRIDGE email analyzed successfully',
      carrier: 'COREBRIDGE'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in analyze-email-corebridge function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      carrier: 'COREBRIDGE'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

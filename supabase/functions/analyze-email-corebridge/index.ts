import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

// COREBRIDGE Action Mapping for automated action sheet population
const COREBRIDGE_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
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
  },
  "Policy inquiry": {
    indication: "Customer inquiry about policy details",
    ghlNote: "Policy inquiry received. Need to review the specific questions and provide accurate information to the customer.",
    ghlStage: "Policy Inquiry"
  },
  "Claim submitted": {
    indication: "Insurance claim has been submitted",
    ghlNote: "Claim submitted successfully. Need to track the claim status and keep customer informed of progress.",
    ghlStage: "Claim Processing"
  },
  "Payment confirmation": {
    indication: "Payment has been confirmed",
    ghlNote: "Payment confirmation received. No immediate action required unless customer has questions.",
    ghlStage: "Payment Confirmed"
  },
  "Policy update": {
    indication: "Policy information has been updated",
    ghlNote: "Policy update processed. Need to verify the changes and inform customer if necessary.",
    ghlStage: "Policy Update"
  },
  "Document request": {
    indication: "Additional documents requested",
    ghlNote: "Document request received. Need to gather and submit the requested documentation to Corebridge.",
    ghlStage: "Document Request"
  },
  "Application Update": {
    indication: "Application status has been updated",
    ghlNote: "Application update received. Need to review the changes and inform customer of next steps.",
    ghlStage: "Application Update"
  },
  "Underwriting Update": {
    indication: "Underwriting decision received",
    ghlNote: "Underwriting update received. Need to review the decision and inform customer of next steps.",
    ghlStage: "Underwriting Update"
  },
  "Policy Status": {
    indication: "Policy status information",
    ghlNote: "Policy status update received. Need to review and inform customer if necessary.",
    ghlStage: "Policy Status"
  },
  "Billing Update": {
    indication: "Billing information updated",
    ghlNote: "Billing update received. Need to review billing changes and inform customer if necessary.",
    ghlStage: "Billing Update"
  },
  "Claim Update": {
    indication: "Claim status has been updated",
    ghlNote: "Claim update received. Need to review the changes and keep customer informed.",
    ghlStage: "Claim Update"
  },
  "Customer Service": {
    indication: "Customer service communication",
    ghlNote: "Customer service communication received. Need to review and respond as necessary.",
    ghlStage: "Customer Service"
  },
  "General Inquiry": {
    indication: "General customer inquiry",
    ghlNote: "General inquiry received. Need to review and provide appropriate response.",
    ghlStage: "General Inquiry"
  },
  "Account Update": {
    indication: "Account information updated",
    ghlNote: "Account update received. Need to verify changes and inform customer if necessary.",
    ghlStage: "Account Update"
  },
  "Coverage Inquiry": {
    indication: "Inquiry about coverage details",
    ghlNote: "Coverage inquiry received. Need to review and provide accurate coverage information.",
    ghlStage: "Coverage Inquiry"
  },
  "Premium Change": {
    indication: "Premium amount has changed",
    ghlNote: "Premium change received. Need to review the change and inform customer of new premium amount.",
    ghlStage: "Premium Change"
  },
  "Beneficiary Update": {
    indication: "Beneficiary information updated",
    ghlNote: "Beneficiary update received. Need to verify the changes and confirm with customer.",
    ghlStage: "Beneficiary Update"
  },
  "Address Change": {
    indication: "Address information updated",
    ghlNote: "Address change received. Need to verify the new address and update records accordingly.",
    ghlStage: "Address Change"
  }
};

// Function to get action mapping for a specific category
function getCorebridgeActionMapping(category: string) {
  return COREBRIDGE_ACTION_MAPPING[category] || COREBRIDGE_ACTION_MAPPING["Pending"];
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

    console.log('Starting COREBRIDGE email analysis for email:', email_id);

    // Fetch the email from database
    const { data: email, error: emailError } = await supabaseClient
      .from('emails')
      .select('*')
      .eq('id', email_id)
      .eq('user_id', user.id)
      .single();

    if (emailError || !email) {
      throw new Error('Email not found or not accessible');
    }

    // Check if already analyzed (unless force reprocess)
    if (!force_reprocess) {
      const { data: existingAnalysis } = await supabaseClient
        .from('email_analysis_results')
        .select('id')
        .eq('email_id', email_id)
        .single();

      if (existingAnalysis) {
        return new Response(JSON.stringify({
          success: true,
          message: 'Email already analyzed',
          analysis_id: existingAnalysis.id
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // COREBRIDGE-specific analysis prompt
    const corebridgeAnalysisPrompt = `You are a specialist email analyst for COREBRIDGE Financial (formerly AIG Life & Retirement). You have deep expertise in COREBRIDGE's specific processes, terminology, and customer service patterns.

For COREBRIDGE emails, pay special attention to:
- SIGITeam correspondence and communications
- Policy management and servicing requests
- Annuity and life insurance product specifics
- Premium payment schedules and processing
- Beneficiary changes and policy updates
- Surrender and withdrawal requests
- Required minimum distributions (RMDs)
- 1035 exchanges and transfers

Analyze the following email and extract key information in the EXACT JSON format specified below.

Email Details:
Subject: ${email.subject}
Carrier: COREBRIDGE
Body: ${email.body}

Pay special attention to body content especially forward section to get the info after the subject to find the required fields we need like Forward to get the most of the related info such as customer name, policy number and email_update_date.

CRITICAL: You MUST return a JSON object with exactly these fields:

{
  "customer_name": "string or null - Extract customer name if clearly mentioned",
  "policy_id": "string or null - Extract policy number, account number, or reference number", 
  "email_update_date": "YYYY-MM-DD or null - Extract any specific follow-up date mentioned",
  "summary": "string - Brief 2-3 sentence summary of the email content analyzing the whole body of the email",
  "suggested_action": "string - Specific recommended action based on email whole body content",
  "category": "string - Must be one of: Pending, Failed payment, Chargeback, Cancelled policy, Post Underwriting Update, Pending Lapse, Declined/Closed as Incomplete, Policy inquiry, Claim submitted, Payment confirmation, Policy update, Document request, Application Update, Underwriting Update, Policy Status, Billing Update, Claim Update, Customer Service, General Inquiry, Account Update, Coverage Inquiry, Premium Change, Beneficiary Update, Address Change",
  "reason": "string - reason for the email update regarding the policy",
  "subcategory": "string or null - Based on category, choose from appropriate subcategories",
  "document_links": "array of strings or null - Extract any document URLs found in the email"
}

CATEGORY CLASSIFICATION RULES:
1. **Pending**: Use when carrier requests additional info, documentation, calls, or premium verification
2. **Failed payment**: Use for all payment-related failures (insufficient funds, card issues, bank problems, authorization issues)
3. **Chargeback**: Use when customer disputes a charge through their bank/card company
4. **Cancelled policy**: Use when policy is terminated/cancelled
5. **Post Underwriting Update**: Use for underwriting decisions (approved as applied, approved differently, or declined)
6. **Pending Lapse**: Use when policy is about to lapse but hasn't yet
7. **Declined/Closed as Incomplete**: Use when application is closed due to max rewrites, coverage limits, or no response
8. **Policy inquiry**: Use when customer asks questions about their policy details, coverage, or status
9. **Claim submitted**: Use when a claim has been successfully submitted and is being processed
10. **Payment confirmation**: Use when payment has been successfully processed and confirmed
11. **Policy update**: Use when policy information or details have been changed or updated
12. **Document request**: Use when carrier requests additional documentation or forms
13. **Application Update**: Use when application status changes (received, processing, etc.)
14. **Underwriting Update**: Use for underwriting-related communications and decisions
15. **Policy Status**: Use for general policy status updates and confirmations
16. **Billing Update**: Use for billing-related changes and notifications
17. **Claim Update**: Use when claim status changes or updates are provided
18. **Customer Service**: Use for general customer service communications
19. **General Inquiry**: Use for miscellaneous customer questions and inquiries
20. **Account Update**: Use when account information is modified
21. **Coverage Inquiry**: Use when customer asks about coverage details
22. **Premium Change**: Use when premium amounts are changed
23. **Beneficiary Update**: Use when beneficiary information is updated
24. **Address Change**: Use when address information is changed

SUBCATEGORY RULES:
- For "Pending": Requesting additional information, Requesting copy of drivers license/SSN, Requesting call to carrier with client, Verify changed premium amount
- For "Failed payment": Insufficient funds, Credit limit reached on credit card, Banking information invalid, Credit Card number incorrect, Bank frozen, Bank account closed, Charge not authorized by bank
- For "Post Underwriting Update": Approved as applied, Approved other than applied, Declined
- For "Declined/Closed as Incomplete": Max rewrites, Max coverage, Closed - no response to agent requirements

IMPORTANT RULES:
1. category MUST be exactly one of the predefined categories listed above
2. subcategory should match the category-specific options when applicable
3. Return ONLY valid JSON, no additional text or formatting
4. If uncertain about category, use "Pending" 
5. Focus on actionable insights for customer service representatives
6. Extract dates in YYYY-MM-DD format only
7. Pay special attention to SIGITeam communications and policy servicing requests`

    console.log('Sending COREBRIDGE analysis request to Groq API');

    // Call Groq API for analysis
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
            content: corebridgeAnalysisPrompt
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
      throw new Error('No response from Groq AI')
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

    // Process action codes and map to GHL fields
    const actionMapping = getCorebridgeActionMapping(analysisResult.category);
    const actionCode = analysisResult.category; // Use category as action code for COREBRIDGE
    const ghlNote = actionMapping.ghlNote;
    const ghlStage = actionMapping.ghlStage;

    // Validate the category against allowed values
    const allowedCategories = [
      "Pending",
      "Failed payment",
      "Chargeback",
      "Cancelled policy",
      "Post Underwriting Update",
      "Pending Lapse",
      "Declined/Closed as Incomplete",
      "Policy inquiry",
      "Claim submitted",
      "Payment confirmation",
      "Policy update",
      "Document request",
      "Application Update",
      "Underwriting Update",
      "Policy Status",
      "Billing Update",
      "Claim Update",
      "Customer Service",
      "General Inquiry",
      "Account Update",
      "Coverage Inquiry",
      "Premium Change",
      "Beneficiary Update",
      "Address Change"
    ];

    if (!allowedCategories.includes(analysisResult.category)) {
      console.warn(`Invalid category "${analysisResult.category}", defaulting to "Pending"`);
      analysisResult.category = "Pending";
    }

    // Insert analysis result into database
    const { data: insertedAnalysis, error: insertError } = await supabaseClient
      .from('email_analysis_results')
      .insert({
        email_id: email_id,
        customer_name: analysisResult.customer_name,
        policy_id: analysisResult.policy_id,
        category: analysisResult.category,
        subcategory: analysisResult.subcategory,
        summary: analysisResult.summary,
        suggested_action: analysisResult.suggested_action,
        email_update_date: analysisResult.email_update_date,
        reason: analysisResult.reason,
        document_links: analysisResult.document_links ? JSON.stringify(analysisResult.document_links) : null,
        action_code: actionCode,
        ghl_note: ghlNote,
        ghl_stage: ghlStage,
        carrier: 'COREBRIDGE',
        review_status: 'pending',
        is_reviewed: false,
        analysis_timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting COREBRIDGE analysis:', insertError);
      throw new Error('Failed to save COREBRIDGE analysis results');
    }

    // Update email status to completed
    await supabaseClient
      .from('emails')
      .update({ status: 'completed' })
      .eq('id', email_id);

    console.log('COREBRIDGE analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis: insertedAnalysis,
      message: 'COREBRIDGE email analyzed successfully',
      carrier: 'COREBRIDGE'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-email-corebridge function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false,
      carrier: 'COREBRIDGE'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

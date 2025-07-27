import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};
const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');
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
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
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
    if (!togetherApiKey) {
      throw new Error('Together.ai API key not configured');
    }
    console.log('Starting email analysis for email:', email_id);
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
    // Get carrier-specific analysis prompt
    const getCarrierPrompt = (carrier, subject, body)=>{
      const baseCategories = [
        "Pending",
        "Failed payment",
        "Chargeback",
        "Cancelled policy",
        "Post Underwriting Update",
        "Pending Lapse",
        "Declined/Closed as Incomplete"
      ];
      const subcategoriesByCategory = {
        "Pending": [
          "Requesting additional information",
          "Requesting copy of drivers license/SSN",
          "Requesting call to carrier with client",
          "Verify changed premium amount"
        ],
        "Failed payment": [
          "Insufficient funds",
          "Credit limit reached on credit card",
          "Banking information invalid",
          "Credit Card number incorrect",
          "Bank frozen",
          "Bank account closed",
          "Charge not authorized by bank"
        ],
        "Post Underwriting Update": [
          "Approved as applied",
          "Approved other than applied",
          "Declined"
        ],
        "Declined/Closed as Incomplete": [
          "Max rewrites",
          "Max coverage",
          "Closed - no response to agent requirements"
        ]
      };
      let carrierSpecificInstructions = '';
      switch(carrier.toLowerCase()){
        case 'aig':
          carrierSpecificInstructions = `
For AIG (American International Group) emails, pay special attention to:
-You will be given an email with subject and body .
-Pay special attention to body content  especially forward section to get the info after the subject to find the required fields we need most of the relted info related to the application and resaon and action to be taken`;
          break;
        case 'anam':
          carrierSpecificInstructions = `
Extract all customer entries from this email.

Each entry includes:
- Policy: [policy_number]
- Name: [customer_name]
- Doc: [document_description]
- (optional) A link after "Click to view correspondence"

Instructions:
1. Extract all entries — do not skip or stop early.
2. Remove leading zeros from policy numbers (e.g., 0110377940 → 110377940).
3. Return these fields as comma-separated strings:
   - "customer_name": "Name1, Name2, ..."
   - "policy_id": "ID1, ID2, ..."
   - "reason": "Doc1; Doc2; ..."
4. Also return all document URLs (if present) in a separate array called "document_links".

Example output format:
{
  "customer_name": "...",
  "policy_id": "...",
  "reason": "...",
  "document_links": ["...", "..."]
}
`;
;
          break;
        case 'liberty':
          carrierSpecificInstructions = `
For Liberty Mutual emails, pay special attention to:
- Policy numbers typically start with "LM" or numeric formats
- Business vs personal insurance distinctions
- Safeco brand references (Liberty subsidiary)
- Workers' compensation and commercial coverage
- Auto and property insurance specifics
- Agent portal and servicing requirements`;
          break;
        case 'rna':
          carrierSpecificInstructions = `
For RNA (Rockingham National) emails, pay special attention to:
- Policy numbers and account reference formats
- Regional coverage areas and restrictions
- Underwriting appetite and guidelines
- Premium payment methods and schedules
- Claims reporting procedures
- Agent appointment and contracting information`;
          break;
        default:
          carrierSpecificInstructions = `
For this insurance carrier, focus on standard insurance patterns:
- Policy numbers and account references
- Premium payment schedules and methods
- Underwriting requirements and documentation
- Coverage types and limits
- Claims and billing communications`;
      }
      return `You are a specialist email analyst for ${carrier} insurance company. You have deep expertise in ${carrier}'s specific processes, terminology, and customer service patterns.

${carrierSpecificInstructions}

Analyze the following email and extract key information in the EXACT JSON format specified below.

Email Details:
Subject: ${subject}
Carrier: ${carrier}
Body: ${body}

-You will be given an email with subject and body .
-Pay special attention to body content  especially forward section to get the info after the subject to find the required fields we need like Forwardto get the most of the relted info such as customer name , policy number and email_update_date.
CRITICAL: You MUST return a JSON object with exactly these fields:

{
  "customer_name": "string or null - Extract customer name if clearly mentioned",
  "policy_id": "string or null - Extract policy number, account number, or reference number", 
  "email_update_date": "YYYY-MM-DD or null - Extract any specific follow-up date mentioned",
  "summary": "string - Brief 2-3 sentence summary of the email content analyzing the whold body of the email",
  "suggested_action": "string - Specific recommended action based on email whole body content",
  "category": "string - Must be one of: ${baseCategories.join(', ')}",
  "reason": "string- reason for the email update regarding the policy 1 line in case of ANAM it will multiple based on the DOC list each customer will have the reason the DOC .",
  "subcategory": "string or null - Based on category, choose from appropriate subcategories",
  "document_links": "array of strings or null - Extract any document URLs found in the email, especially ANAM portal links"
}

CATEGORY CLASSIFICATION RULES:
1. **Pending**: Use when carrier requests additional info, documentation, calls, or premium verification
2. **Failed payment**: Use for all payment-related failures (insufficient funds, card issues, bank problems, authorization issues)
3. **Chargeback**: Use when customer disputes a charge through their bank/card company
4. **Cancelled policy**: Use when policy is terminated/cancelled
5. **Post Underwriting Update**: Use for underwriting decisions (approved as applied, approved differently, or declined)
6. **Pending Lapse**: Use when policy is about to lapse but hasn't yet
7. **Declined/Closed as Incomplete**: Use when application is closed due to max rewrites, coverage limits, or no response

SUBCATEGORY RULES:
- For "Pending": ${subcategoriesByCategory["Pending"]?.join(', ') || 'General pending'}
- For "Failed payment": ${subcategoriesByCategory["Failed payment"]?.join(', ') || 'Payment issue'}
- For "Post Underwriting Update": ${subcategoriesByCategory["Post Underwriting Update"]?.join(', ') || 'Underwriting decision'}
- For "Declined/Closed as Incomplete": ${subcategoriesByCategory["Declined/Closed as Incomplete"]?.join(', ') || 'Application incomplete'}

IMPORTANT RULES:
1. category MUST be exactly one of the predefined categories listed above
2. subcategory should match the category-specific options when applicable
3. Return ONLY valid JSON, no additional text or formatting
4. If uncertain about category, use "Pending" 
5. Focus on actionable insights for customer service representatives
6. Extract dates in YYYY-MM-DD format only`;
    };
    const analysisPrompt = getCarrierPrompt(email.carrier_label, email.subject, email.body);
    console.log('Sending analysis request to Together.ai for carrier:', email.carrier_label);
    // Call Together.ai API for analysis
    const togetherResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${togetherApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        messages: [
          {
            role: 'system',
            content: `You are an expert insurance email analyst.Your role is read all the email content inculding the subject ,body , forward info and . Always respond with valid JSON only in the exact format requested.`
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800,
        top_p: 0.9,
        repetition_penalty: 1.0
      })
    });
    if (!togetherResponse.ok) {
      throw new Error(`Together.ai API error: ${togetherResponse.statusText}`);
    }
    const togetherData = await togetherResponse.json();
    const analysisText = togetherData.choices[0].message.content;
    console.log('Raw Together.ai response:', analysisText);
   ;
    // Parse the JSON response
    let analysisResult;
    try {
      // Clean the response text in case there's extra formatting
      const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse Together.ai response as JSON:', analysisText);
      // Fallback analysis
      analysisResult = {
        category: 'Pending',
        subcategory: 'Manual review required',
        summary: 'Email analysis failed - manual review required',
        suggested_action: 'Manual review required due to analysis error'
      };
    }
    console.log('Parsed analysis result:', analysisResult);
    // Validate the category against allowed values
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
    // Insert analysis result into database - using INSERT instead of upsert to avoid conflict issues
    const { data: insertedAnalysis, error: insertError } = await supabaseClient.from('email_analysis_results').insert({
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
      review_status: 'pending',
      is_reviewed: false
    }).select().single();
    if (insertError) {
      console.error('Error inserting analysis:', insertError);
      throw new Error('Failed to save analysis results');
    }
    // Update email status to completed
    await supabaseClient.from('emails').update({
      status: 'completed'
    }).eq('id', email_id);
    console.log('Analysis completed successfully');
    return new Response(JSON.stringify({
      success: true,
      analysis: insertedAnalysis,
      message: 'Email analyzed successfully'
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in analyze-email function:', error);
    return new Response(JSON.stringify({
      error: error.message,
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

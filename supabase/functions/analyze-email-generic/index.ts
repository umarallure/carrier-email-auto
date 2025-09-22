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

    const { email_id, force_reprocess } = await req.json();
    if (!email_id) {
      throw new Error('Email ID required');
    }

    console.log('Starting Generic email analysis for email:', email_id);

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

    // Generic analysis prompt for all other carriers
    const genericAnalysisPrompt = `You are a specialist email analyst for insurance companies. You have expertise in analyzing various insurance carrier communications, terminology, and customer service patterns.

For insurance emails, pay attention to:
- Policy numbers and account references
- Premium payment schedules and methods
- Underwriting requirements and documentation
- Coverage types and limits
- Claims and billing communications
- Customer service requests and updates

Analyze the following email and extract key information in the EXACT JSON format specified below.

Email Details:
Subject: ${email.subject}
Carrier: ${email.carrier_label || 'Generic'}
Body: ${email.body}

Pay special attention to body content especially forward section to get the info after the subject to find the required fields we need like Forward to get the most of the related info such as customer name, policy number and email_update_date.

CRITICAL: You MUST return a JSON object with exactly these fields:

{
  "customer_name": "string or null - Extract customer name if clearly mentioned",
  "policy_id": "string or null - Extract policy number, account number, or reference number", 
  "email_update_date": "YYYY-MM-DD or null - Extract any specific follow-up date mentioned",
  "summary": "string - Brief 2-3 sentence summary of the email content analyzing the whole body of the email",
  "suggested_action": "string - Specific recommended action based on email whole body content",
  "category": "string - Must be one of: Pending, Failed payment, Chargeback, Cancelled policy, Post Underwriting Update, Pending Lapse, Declined/Closed as Incomplete",
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
6. Extract dates in YYYY-MM-DD format only`;

    console.log('Sending Generic analysis request to OpenRouter');

    // Call OpenRouter API for analysis
    const analysisResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openRouterApiKey}`,
        'HTTP-Referer': 'https://unlimited-insurance-automation.com',
        'X-Title': 'Generic Insurance Email Analysis',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b:free',
        messages: [
          {
            role: 'system',
            content: 'You are an expert insurance email analyst. Your role is to read all email content including the subject, body, and forward info. Always respond with valid JSON only in the exact format requested.'
          },
          {
            role: 'user',
            content: genericAnalysisPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 800
      })
    });

    if (!analysisResponse.ok) {
      throw new Error(`OpenRouter API error: ${analysisResponse.statusText}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.choices[0].message.content;
    console.log('Raw OpenRouter response:', analysisText);

    // Parse the JSON response
    let analysisResult;
    try {
      // Clean the response text in case there's extra formatting
      const cleanedText = analysisText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      analysisResult = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse OpenRouter response as JSON:', analysisText);
      // Fallback analysis
      analysisResult = {
        category: 'Pending',
        subcategory: 'Manual review required',
        summary: 'Generic email analysis failed - manual review required',
        suggested_action: 'Manual review required due to analysis error',
        customer_name: null,
        policy_id: null,
        reason: 'Analysis parsing error',
        email_update_date: null,
        document_links: null
      };
    }

    console.log('Parsed Generic analysis result:', analysisResult);

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
        review_status: 'pending',
        is_reviewed: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting Generic analysis:', insertError);
      throw new Error('Failed to save Generic analysis results');
    }

    // Update email status to completed
    await supabaseClient
      .from('emails')
      .update({ status: 'completed' })
      .eq('id', email_id);

    console.log('Generic analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis: insertedAnalysis,
      message: 'Email analyzed successfully',
      carrier: email.carrier_label || 'Generic'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-email-generic function:', error);
    return new Response(JSON.stringify({
      error: error.message,
      success: false,
      carrier: 'Generic'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

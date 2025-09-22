import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

// ANAM Action Code Mapping for automated action sheet population
const ANAM_ACTION_CODE_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  "BANK DRAFT RETURNED INSUFF": {
    indication: "Insufficient Funds",
    ghlNote: "Failed Payment due to insufficient Funds.\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "BANK DRAFT RETURNED UNPAID": {
    indication: "Failed Payment - Need to open memo to see what the issue is",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "BK ACT RTN - MEMO": {
    indication: "Incorrect Bank Account Number",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "BK DRAFT RTN UNPAID": {
    indication: "Failed Payment - Need to open memo to see what the issue is",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "BK DRFT RTN NSF W/AGT INFO": {
    indication: "Insufficient Funds",
    ghlNote: "Failed Payment due to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "BK DRFT RTN-UNPD AGT INFO": {
    indication: "Failed Payment - Need to open memo to see what the issue is",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "CLOSED APP INF NOT REC NO$": {
    indication: "Closed as incomplete - can fulfill requirements and the policy will reissue. Have up to 90 days to reopen",
    ghlNote: "Policy closed as incomplete due to client information discrepancy.\n\nNeed to reconfirm personal details and submit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "DECLIN-SCK NO$ NO$": {
    indication: "Declined per prescription history - can call in to confirm what medical question was the reason for the decline",
    ghlNote: "Declined as per the MIB check. Need to requote and submit with another carrier",
    ghlStage: "Declined Underwriting"
  },
  "DECLINE-APP INFO NO$": {
    indication: "Declined per app info - need to call AMAM to confirm the exact reason",
    ghlNote: "Needs manual check",
    ghlStage: "Declined Underwriting"
  },
  "DECLINE-MED DATA MIB NO$": {
    indication: "Declined per prescription history - can call in to confirm what medical question was the reason for the decline",
    ghlNote: "Declined as per the MIB check. Need to requote and submit with another carrier",
    ghlStage: "Declined Underwriting"
  },
  "DECLINE-MED DATA NO$": {
    indication: "Declined per prescription history - can call in to confirm what medical question was the reason for the decline",
    ghlNote: "Declined as per the MIB check. Need to requote and submit with another carrier",
    ghlStage: "Declined Underwriting"
  },
  "DECLINE-MED.REC.HIST NO$": {
    indication: "Declined per prescription history - can call in to confirm what medical question was the reason for the decline",
    ghlNote: "Declined as per the MIB check. Need to requote and submit with another carrier",
    ghlStage: "Declined Underwriting"
  },
  "DECLINE-MULT POL NO$": {
    indication: "Declined as per reapplying guidelines",
    ghlNote: "Policy withdrawn as per reapplying guidelines.\n\nNeed to resubmit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "DECLINE-MULT POS": {
    indication: "Declined as per reapplying guidelines",
    ghlNote: "Policy withdrawn as per reapplying guidelines.\n\nNeed to resubmit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "ENDORSEMENT NOT RCVD": {
    indication: "No endorsement for rate class received - we can still send in the request",
    ghlNote: "Agent needs to send in endorsement for rate class change (Client approved for other than applied for)",
    ghlStage: "Pending Manual Action"
  },
  "ENDORSMT -REINSTATE&REDATE": {
    indication: "Pending - No action required",
    ghlNote: "No current action required at this time. Policy is still pending",
    ghlStage: "Pending Approval"
  },
  "GRACE PERIOD EXPIRY NOTICE": {
    indication: "Policy is pending lapse",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  "KS COND REC": {
    indication: "No action required",
    ghlNote: "No Note",
    ghlStage: "No change"
  },
  "LAPSE NOTICE SENT": {
    indication: "Policy has lapsed",
    ghlNote: "Policy has lapsed. Need to reconfirm banking information and redraft with another carrier",
    ghlStage: "Chargeback Failed Payment"
  },
  "NEED ENDORSEMENT": {
    indication: "Need client to sign endorsement to change rate class",
    ghlNote: "Agent needs to send in endorsement for rate class change (Client approved for other than applied for)",
    ghlStage: "Pending Manual Action"
  },
  "NEED PHONE INTERVIEW APPTI": {
    indication: "Need phone interview",
    ghlNote: "Need to connect applicant with AMAM to complete a phone interview",
    ghlStage: "Pending Manual Action"
  },
  "NOT TAKEN BK DRAFT": {
    indication: "",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "NOT TAKEN BY REQUEST-PO": {
    indication: "Client requested to cancel",
    ghlNote: "Client called AMAM to cancel their policy",
    ghlStage: "Chargeback Cancellation"
  },
  "NT+CHECK-30 DAY REF": {
    indication: "Client cancelled in their free look period",
    ghlNote: "Client called AMAM to cancel their policy in their free look period",
    ghlStage: "Chargeback Cancellation"
  },
  "POL CANCELED - NOT TAKEN": {
    indication: "Client requested to cancel",
    ghlNote: "Client called AMAM to cancel their policy",
    ghlStage: "Chargeback Cancellation"
  },
  "PRENOTE RTURN,ACCNT CLSD": {
    indication: "Failed Payment Account closed",
    ghlNote: "Failed Payment due to bank account being closed\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "PRENOTE RTURN,INVALD ACCT#": {
    indication: "Failed payment Invalid Account Number",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "REDATE ENDORS RCVD -LTR": {
    indication: "Indicates that the redate request was received - No action required",
    ghlNote: "Policy redate request has been received by AMAM",
    ghlStage: "Pending Failed Payment Fix"
  },
  "REDATE POLICY -LTR W/NDR": {
    indication: "Indicates that the redate request was received - No action required",
    ghlNote: "Policy redate request has been received by AMAM",
    ghlStage: "Pending Failed Payment Fix"
  },
  "REQUEST W-9,NO BWH": {
    indication: "SSN invalid, need to send W-9 with valid SSN to issue",
    ghlNote: "SSN came back as invalid on application. American Amicable is requesting a copy of applicant's W-9 to issue policy, so we should reconfirm SSN and resubmit with another carrier.",
    ghlStage: "Application Withdrawn"
  },
  "S.S. INSUFFICIENT FUNDS": {
    indication: "Failed payment insufficient funds",
    ghlNote: "Failed Payment due to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "SCRIPTCHECK MIB POST NO$": {
    indication: "Declined per prescription history - can call in to confirm what medical question was the reason for the decline",
    ghlNote: "Declined as per the MIB check. Need to requote and submit with another carrier",
    ghlStage: "Declined Underwriting"
  },
  "SEND POL.CANCEL REQ-NO VAL": {
    indication: "Client Called to cancel their policy",
    ghlNote: "Client called AMAM to cancel their policy",
    ghlStage: "Chargeback Cancellation"
  },
  "SEND POL.CANCEL REQ. FORM": {
    indication: "Client Called to cancel their policy",
    ghlNote: "Client called AMAM to cancel their policy",
    ghlStage: "Chargeback Cancellation"
  },
  "SEND RET POLICY TO AGENT": {
    indication: "AMAM is requesting we update the address and send the policy paperwork to the applicant - Will not keep the policy from being issued",
    ghlNote: "No Note",
    ghlStage: "No change"
  },
  "TERMINATE NO CASH VALUE": {
    indication: "Client Called to cancel their policy",
    ghlNote: "Client called AMAM to cancel their policy",
    ghlStage: "Chargeback Cancellation"
  },
  "UNDERWRITING SERVICES PI++": {
    indication: "Requesting wet signature for HIPPA Authorization - Need to cancel the policy and resubmit elsewhere",
    ghlNote: "AMAM is requesting a wet signature on a HIPPA authorization. We should cancel the policy and resubmit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "UT 9396": {
    indication: "Copy of replacement for mailed - No action required",
    ghlNote: "No Note",
    ghlStage: "No change"
  },
  "UW AGREF AGENT MEMO": {
    indication: "Agent action required - Need to manually open memo",
    ghlNote: "Needs manual check",
    ghlStage: "Pending Manual Action"
  },
  "WD APPTICAL/WD": {
    indication: "Withdrawn",
    ghlNote: "Needs manual check",
    ghlStage: "Application Withdrawn"
  }
};

// Function to extract action codes from email content
function extractActionCodes(emailBody: string): string[] {
  const actionCodes: string[] = [];
  const bodyUpper = emailBody.toUpperCase();

  // Look for action codes in the mapping
  for (const code of Object.keys(ANAM_ACTION_CODE_MAPPING)) {
    if (bodyUpper.includes(code)) {
      actionCodes.push(code);
    }
  }

  return [...new Set(actionCodes)]; // Remove duplicates
}

// Function to get action mapping for a specific code
function getActionMapping(actionCode: string) {
  return ANAM_ACTION_CODE_MAPPING[actionCode] || null;
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

    console.log('Starting ANAM email analysis for email:', email_id);

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

    // ANAM-specific analysis prompt
    const anamAnalysisPrompt = `You are a specialist email analyst for ANAM (American National) insurance company. You have deep expertise in ANAM's specific processes, terminology, and customer service patterns.

For ANAM emails, pay special attention to:
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
   - "reason": "Doc1; Doc2; ..." (use the DOC field as the reason for each customer)
4. Also return all document URLs (if present) in a separate array called "document_links".
5. **CRITICAL**: Extract any ANAM action codes found in the email. Look for codes like "BANK DRAFT RETURNED INSUFF", "BK ACT RTN - MEMO", "DECLINE-MED DATA NO$", etc. Return them as a comma-separated string in "action_codes" field.

Analyze the following email and extract key information in the EXACT JSON format specified below.

Email Details:
Subject: ${email.subject}
Carrier: ANAM
Body: ${email.body}

Pay special attention to body content especially forward section to get the info after the subject to find the required fields we need like Forward to get the most of the related info such as customer name, policy number and email_update_date.

CRITICAL: You MUST return a JSON object with exactly these fields:

{
  "customer_name": "string or null - Extract customer name if clearly mentioned (comma-separated for multiple)",
  "policy_id": "string or null - Extract policy number, account number, or reference number (comma-separated for multiple)",
  "email_update_date": "YYYY-MM-DD or null - Extract any specific follow-up date mentioned",
  "summary": "string - When multiple customers are present, format as numbered list: 1) Customer Name -> Policy Number -> DOC Name - additional summary if any. For single customer, provide brief 2-3 sentence summary of the email content analyzing the whole body of the email. Include information about each customer and their specific DOC/reason",
  "suggested_action": "string - Specific recommended action based on email whole body content",
  "category": "string - Must be one of: Pending, Failed payment, Chargeback, Cancelled policy, Post Underwriting Update, Pending Lapse, Declined/Closed as Incomplete",
  "reason": "string - reason for the email update regarding the policy. Use the DOC field from each customer entry, separated by semicolons",
  "subcategory": "string or null - Based on category, choose from appropriate subcategories",
  "document_links": "array of strings or null - Extract any document URLs found in the email, especially ANAM portal links",
  "action_codes": "string or null - Extract ANAM action codes found in the email (comma-separated). Look for codes like BANK DRAFT RETURNED INSUFF, BK ACT RTN - MEMO, DECLINE-MED DATA NO$, etc."
}

CATEGORY CLASSIFICATION RULES:
1. **Pending**: Use when carrier requests additional info, documentation, calls, or premium verification
2. **Failed payment**: Use for all payment-related failures (insufficient funds, card issues, bank problems, authorization issues)
3. **Chargeback**: Use when customer disputes a charge through their bank/card company
4. **Cancelled policy**: Use when policy is terminated/cancelled
5. **Post Underwriting Update**: Use for underwriting decisions (approved as applied, approved differently, or declined)
6. **Pending Lapse**: Use when policy is about to lapse but hasn't yet
7. **Declined/Closed as Incomplete**: Use when application is closed due to max rewrites, coverage limits, or no response

IMPORTANT RULES:
1. category MUST be exactly one of the predefined categories listed above
2. subcategory should match the category-specific options when applicable
3. Return ONLY valid JSON, no additional text or formatting
4. If uncertain about category, use "Pending"
5. Focus on actionable insights for customer service representatives
6. Extract dates in YYYY-MM-DD format only
7. For ANAM emails, prioritize extracting multiple customer entries from correspondence lists
8. Use the DOC field as the primary reason for each customer
9. For SUMMARY formatting when multiple customers:
   - Format as numbered list: 1) Customer Name -> Policy Number -> DOC Name - additional summary if any
   - Example: 1) Madonna M Blakeman -> 0110790610 -> ABDR2 BK DRFT RTN-UNPD AGT INFO - Bank draft returned unpaid, agent information needed
   - Include brief additional context for each customer if available from the email content
10. For single customer emails, provide standard 2-3 sentence summary`;

    console.log('Sending ANAM analysis request to Groq API');

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
            content: anamAnalysisPrompt
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
        summary: 'ANAM email analysis failed - manual review required',
        suggested_action: 'Manual review required due to analysis error',
        customer_name: null,
        policy_id: null,
        reason: 'Analysis parsing error',
        email_update_date: null,
        document_links: null
      };
    }

    console.log('Parsed ANAM analysis result:', analysisResult);

    // Process action codes and map to GHL fields
    let actionCode = null;
    let ghlNote = null;
    let ghlStage = null;

    if (analysisResult.action_codes) {
      const extractedCodes = extractActionCodes(analysisResult.action_codes);
      if (extractedCodes.length > 0) {
        // Use the first action code found (can be enhanced to handle multiple codes per customer later)
        actionCode = extractedCodes[0];
        const mapping = getActionMapping(actionCode);
        if (mapping) {
          ghlNote = mapping.ghlNote;
          ghlStage = mapping.ghlStage;
        }
      }
    }

    // Also try to extract action codes directly from email body as fallback
    if (!actionCode) {
      const bodyActionCodes = extractActionCodes(email.body);
      if (bodyActionCodes.length > 0) {
        actionCode = bodyActionCodes[0];
        const mapping = getActionMapping(actionCode);
        if (mapping) {
          ghlNote = mapping.ghlNote;
          ghlStage = mapping.ghlStage;
        }
      }
    }

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
        action_code: actionCode,
        ghl_note: ghlNote,
        ghl_stage: ghlStage,
        carrier: 'ANAM',
        review_status: 'pending',
        is_reviewed: false,
        analysis_timestamp: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting ANAM analysis:', insertError);
      throw new Error('Failed to save ANAM analysis results');
    }

    // Update email status to completed
    await supabaseClient
      .from('emails')
      .update({ status: 'completed' })
      .eq('id', email_id);

    console.log('ANAM analysis completed successfully');

    return new Response(JSON.stringify({
      success: true,
      analysis: insertedAnalysis,
      message: 'ANAM email analyzed successfully',
      carrier: 'ANAM'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in analyze-email-anam function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      success: false,
      carrier: 'ANAM'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

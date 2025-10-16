import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

// ANAM Action Code Mapping for automated action sheet population
// Maps ANAM (American Amicable) action codes to GHL stages and note templates
const ANAM_ACTION_CODE_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  // Failed Payment - Insufficient Funds
  "BANK DRAFT RETURNED INSUFF": {
    indication: "Insufficient Funds",
    ghlNote: "Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "BK DRFT RTN NSF W/AGT INFO": {
    indication: "Insufficient Funds",
    ghlNote: "Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "S.S. INSUFFICIENT FUNDS": {
    indication: "Failed payment insufficient funds",
    ghlNote: "Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "ABDI2 BK DRFT RTN NSF W/AGT INFO": {
    indication: "Failed payment insufficient funds",
    ghlNote: "Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "SSDF2 S.S. INSUFFICIENT FUNDS": {
    indication: "Failed payment insufficient funds",
    ghlNote: "Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  
  // Failed Payment - Incorrect Banking Info
  "BK ACT RTN - MEMO": {
    indication: "Incorrect Bank Account Number",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
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
  
  // Failed Payment - Needs Manual Check
  "BANK DRAFT RETURNED UNPAID": {
    indication: "Failed Payment - Need to open memo to see what the issue is",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "BK DRAFT RTN UNPAID": {
    indication: "Failed Payment - Need to open memo to see what the issue is",
    ghlNote: "Needs manual check",
    ghlStage: "N"
  },
  "BK DRFT RTN-UNPD AGT INFO": {
    indication: "Failed Payment - Need to open memo to see what the issue is",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "NOT TAKEN BK DRAFT": {
    indication: "",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  
  // Application Withdrawn
  "CLOSED APP INF NOT REC NO$": {
    indication: "Closed as incomplete - can fullfil requirements and the policy will reissue. Have up to 90 days to reopen",
    ghlNote: "Policy closed as incomplete due to client information discrepency. \n\nNeed to reconfirm personal details and submit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "REQUEST W-9,NO BWH": {
    indication: "SSN invalid, need to send W-9 with valid SSN to issue",
    ghlNote: "SSN came back as invalid on application. American amicable is requesting a copy of applicants W-9 to issue policy, so we should reconfirm SSN and resubmit with another carrier. ",
    ghlStage: "Application Withdrawn"
  },
  "UNDERWRITING SERVICES PI++": {
    indication: "Requesting wet signature for HIPPA Authorization - Need to cancel the policy and resubmit elsewhere",
    ghlNote: "AMAM is requesting a wet signature on a HIPPA authorization. We should cancel the policy and resubmit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "WD APPTICAL/WD": {
    indication: "Withdrawn ",
    ghlNote: "Needs manual check",
    ghlStage: "Application Withdrawn"
  },
  "DECLINE-MULT POL NO$": {
    indication: "Declined as per reapplying guidelines",
    ghlNote: "Policy withdrawn as per reapplying guidelines. \n\nNeed to resubmit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "DECLINE-MULT POS": {
    indication: "Declined as per reapplying guidelines",
    ghlNote: "Policy withdrawn as per reapplying guidelines. \n\nNeed to resubmit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  
  // Declined Underwriting
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
  "SCRIPTCHECK MIB POST NO$": {
    indication: "Declined per prescription history - can call in to confirm what medical question was the reason for the decline",
    ghlNote: "Declined as per the MIB check. Need to requote and submit with another carrier",
    ghlStage: "Declined Underwriting"
  },
  
  // Pending Manual Action
  "ENDORSEMENT NOT RCVD": {
    indication: "No endoursement for rate class received - we can still send in the request",
    ghlNote: "Agent needs to send in endoursement for rate class change (Client approved for other than applied for)",
    ghlStage: "Pending Manual Action"
  },
  "IMAN3 Endor/Elim of Cvrg Not Rcvd": {
    indication: "Endorsement or elimination of coverage not received",
    ghlNote: "Agent needs to send in endoursement for rate class change (Client approved for other than applied for)",
    ghlStage: "Pending Manual Action"
  },
  "NEED ENDORSEMENT": {
    indication: "Need client to sign endoursement to change rate class",
    ghlNote: "Agent needs to send in endoursement for rate class change (Client approved for other than applied for)",
    ghlStage: "Pending Manual Action"
  },
  "NEED PHONE INTERVIEW APPTI": {
    indication: "Need phone interview",
    ghlNote: "Need to connect applicant with AMAM to complete a phone interview",
    ghlStage: "Pending Manual Action"
  },
  "UW AGREF AGENT MEMO": {
    indication: "Agent action required - Need to manually open memo",
    ghlNote: "Needs manual check",
    ghlStage: "Pending Manual Action"
  },
  
  // Pending Approval
  "ENDORSMT -REINSTATE&REDATE": {
    indication: "Pending - No action required",
    ghlNote: "No current action required at this time. Policy is still pending",
    ghlStage: "Pending Approval"
  },
  
  // Pending Lapse
  "GRACE PERIOD EXPIRY NOTICE": {
    indication: "Policy is pending lapse",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  
  // Pending Failed Payment Fix
  "REDATE ENDORS RCVD -LTR": {
    indication: "Indicates that the redate request was received - No action required",
    ghlNote: "Policy redate request has been recieved by AMAM",
    ghlStage: "Pending Failed Payment Fix"
  },
  "REDATE POLICY -LTR W/NDR": {
    indication: "Indicates that the redate request was received - No action required",
    ghlNote: "Policy redate request has been recieved by AMAM",
    ghlStage: "Pending Failed Payment Fix"
  },
  
  // Chargeback Failed Payment
  "LAPSE NOTICE SENT": {
    indication: "Policy has lapsed",
    ghlNote: "Policy has lapsed. Need to reconfirm banking information and redraft with another carrier",
    ghlStage: "Chargeback Failed Payment"
  },
  
  // Chargeback Cancellation
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
  "TERMINATE NO CASH VALUE": {
    indication: "Client Called to cancel their policy",
    ghlNote: "Client called AMAM to cancel their policy",
    ghlStage: "Chargeback Cancellation"
  },
  
  // No Change
  "KS COND REC": {
    indication: "No action required",
    ghlNote: "No Note",
    ghlStage: "No change"
  },
  "SEND RET POLICY TO AGENT": {
    indication: "AMAM is requesting we update the address and send the policy paperwork to the applicant - Will not keep the policy from being issued",
    ghlNote: "No Note",
    ghlStage: "No change"
  },
  "UT 9396": {
    indication: "Copy of replacement for mailed - No action required",
    ghlNote: "No Note",
    ghlStage: "No change"
  }
};

// Function to get action mapping with 4-tier priority matching (same as Royal Neighbors)
function getAnamActionMapping(category: string, subcategory: string) {
  // Priority 1: Try exact match with subcategory (ANAM action codes are often in subcategory)
  if (subcategory && ANAM_ACTION_CODE_MAPPING[subcategory]) {
    console.log(`Matched subcategory: ${subcategory}`);
    return { mapping: ANAM_ACTION_CODE_MAPPING[subcategory], code: subcategory };
  }
  
  // Priority 2: Try partial match with subcategory
  if (subcategory) {
    const subcategoryUpper = subcategory.toUpperCase().trim();
    for (const [key, value] of Object.entries(ANAM_ACTION_CODE_MAPPING)) {
      if (subcategoryUpper.includes(key.toUpperCase()) || key.toUpperCase().includes(subcategoryUpper)) {
        console.log(`Partial matched subcategory: ${subcategory} -> ${key}`);
        return { mapping: value, code: key };
      }
    }
  }
  
  // Priority 3: Try exact match with category
  if (ANAM_ACTION_CODE_MAPPING[category]) {
    console.log(`Matched category: ${category}`);
    return { mapping: ANAM_ACTION_CODE_MAPPING[category], code: category };
  }
  
  // Priority 4: Try partial match with category
  const categoryUpper = category.toUpperCase();
  for (const [key, value] of Object.entries(ANAM_ACTION_CODE_MAPPING)) {
    if (categoryUpper.includes(key.toUpperCase()) || key.toUpperCase().includes(categoryUpper)) {
      console.log(`Partial matched category: ${category} -> ${key}`);
      return { mapping: value, code: key };
    }
  }
  
  // Fallback - return null to indicate no mapping found
  console.log(`No match found for: ${category} / ${subcategory}`);
  return { mapping: null, code: null };
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
    const anamAnalysisPrompt = `You are a specialist email analyst for ANAM (American Amicable) insurance company. You have deep expertise in ANAM's specific processes, terminology, and customer service patterns.

For ANAM emails, pay special attention to:
Extract all customer entries from this email.

Each entry includes:
- Policy: [policy_number]
- Name: [customer_name]
- Doc: [document_description]
- (optional) A link after "Click to view correspondence"

Instructions:
1. Extract all entries — do not skip or stop early.
2. **CRITICAL**: PRESERVE ALL LEADING ZEROS in policy numbers. Policy numbers MUST be treated as TEXT/STRINGS, not numbers. For example, "0111274830" must remain "0111274830", NOT "111274830". Always include the leading zero if present.
3. Return these fields as comma-separated strings:
   - "customer_name": "Name1, Name2, ..."
   - "policy_id": "ID1, ID2, ..." (PRESERVE leading zeros - treat as text strings)
   - "reason": "Doc1; Doc2; ..." (use the DOC field as the reason for each customer)
4. Also return all document URLs (if present) in a separate array called "document_links".
5. **CRITICAL**: Extract any ANAM action codes found in the email body or DOC field. These are the most important for action mapping.

Analyze the following email and extract key information in the EXACT JSON format specified below.

Email Details:
Subject: ${email.subject}
Carrier: ANAM
Body: ${email.body}

Pay special attention to body content especially forward section to get the info after the subject to find the required fields we need like Forward to get the most of the related info such as customer name, policy number and email_update_date.

CRITICAL: You MUST return a JSON object with exactly these fields:

{
  "customer_name": "string or null - Extract customer name if clearly mentioned (comma-separated for multiple)",
  "policy_id": "string or null - Extract policy number AS A STRING (NOT a number). PRESERVE LEADING ZEROS. Example: '0111274830' NOT 111274830. Comma-separated for multiple policies.",
  "email_update_date": "YYYY-MM-DD or null - Extract any specific follow-up date mentioned. If no date found, use null (NOT the string 'null')",
  "summary": "string - When multiple customers are present, format as numbered list: 1) Customer Name -> Policy Number -> DOC Name - additional summary if any. For single customer, provide brief 2-3 sentence summary of the email content analyzing the whole body of the email. Include information about each customer and their specific DOC/reason",
  "suggested_action": "string - Specific recommended action based on email whole body content",
  "category": "string - Must be one of: Pending, Failed payment, Chargeback, Cancelled policy, Post Underwriting Update, Pending Lapse, Declined/Closed as Incomplete",
  "reason": "string - reason for the email update regarding the policy. Use the DOC field from each customer entry, separated by semicolons",
  "subcategory": "**CRITICAL** - Put the EXACT ANAM action code here (e.g., 'BANK DRAFT RETURNED INSUFF', 'BK ACT RTN - MEMO', 'DECLINE-MED DATA NO$', 'REDATE ENDORS RCVD -LTR', 'LAPSE NOTICE SENT'). This is the most important field for action mapping. Look for these codes in the email body or DOC field.",
  "document_links": "array of strings or null - Extract any document URLs found in the email, especially ANAM portal links"
}

**IMPORTANT NOTE ABOUT POLICY NUMBERS**: 
Policy numbers MUST be enclosed in quotes to treat them as strings, not numbers. This preserves leading zeros.
Example: "policy_id": "0111274830, 0111275450" (CORRECT)
NOT: "policy_id": 111274830 (WRONG - loses leading zero)

ANAM ACTION CODES TO DETECT (put in subcategory field):
**Failed Payment Codes:**
- "BANK DRAFT RETURNED INSUFF" - Insufficient funds
- "BK DRFT RTN NSF W/AGT INFO" - NSF with agent info
- "S.S. INSUFFICIENT FUNDS" - Insufficient funds
- "BK ACT RTN - MEMO" - Incorrect bank account number
- "PRENOTE RTURN,ACCNT CLSD" - Account closed
- "PRENOTE RTURN,INVALD ACCT#" - Invalid account number
- "BANK DRAFT RETURNED UNPAID" - Unpaid draft - needs manual check
- "BK DRAFT RTN UNPAID" - Unpaid draft - needs manual check
- "BK DRFT RTN-UNPD AGT INFO" - Unpaid draft with agent info
- "NOT TAKEN BK DRAFT" - Not taken bank draft

**Application Status Codes:**
- "CLOSED APP INF NOT REC NO$" - Closed as incomplete
- "REQUEST W-9,NO BWH" - Invalid SSN, need W-9
- "UNDERWRITING SERVICES PI++" - Need wet signature HIPPA
- "WD APPTICAL/WD" - Withdrawn application

**Declined Codes:**
- "DECLIN-SCK NO$ NO$" - Declined per prescription history
- "DECLINE-APP INFO NO$" - Declined per app info
- "DECLINE-MED DATA MIB NO$" - Declined per MIB
- "DECLINE-MED DATA NO$" - Declined per medical data
- "DECLINE-MED.REC.HIST NO$" - Declined per medical records
- "SCRIPTCHECK MIB POST NO$" - Declined per script check
- "DECLINE-MULT POL NO$" - Declined per multiple policies
- "DECLINE-MULT POS" - Declined per multiple positions

**Manual Action Codes:**
- "ENDORSEMENT NOT RCVD" - No endorsement received
- "NEED ENDORSEMENT" - Need client to sign endorsement
- "NEED PHONE INTERVIEW APPTI" - Phone interview required
- "UW AGREF AGENT MEMO" - Agent memo required

**Policy Status Codes:**
- "ENDORSMT -REINSTATE&REDATE" - Reinstate and redate
- "GRACE PERIOD EXPIRY NOTICE" - Pending lapse
- "REDATE ENDORS RCVD -LTR" - Redate request received
- "REDATE POLICY -LTR W/NDR" - Redate policy
- "LAPSE NOTICE SENT" - Policy lapsed

**Cancellation Codes:**
- "NOT TAKEN BY REQUEST-PO" - Client requested cancel
- "NT+CHECK-30 DAY REF" - Free look cancellation
- "POL CANCELED - NOT TAKEN" - Policy cancelled
- "SEND POL.CANCEL REQ-NO VAL" - Cancel request no value
- "SEND POL.CANCEL REQ. FORM" - Cancel request form
- "TERMINATE NO CASH VALUE" - Terminated no cash value

**No Change Codes:**
- "KS COND REC" - No action required
- "SEND RET POLICY TO AGENT" - Return policy to agent
- "UT 9396" - Replacement mailed

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
2. **subcategory** should contain the EXACT ANAM action code when found in the email body or DOC field
3. Return ONLY valid JSON, no additional text or formatting
4. If uncertain about category, use "Pending"
5. Focus on actionable insights for customer service representatives
6. For email_update_date: If no date is found, return null (NOT the string "null")
7. For ANAM emails, prioritize extracting multiple customer entries from correspondence lists
8. Use the DOC field as the primary reason for each customer
9. For SUMMARY formatting when multiple customers:
   - Format as numbered list: 1) Customer Name -> Policy Number -> DOC Name - additional summary if any
   - Example: 1) Madonna M Blakeman -> 0110790610 -> ABDR2 BK DRFT RTN-UNPD AGT INFO - Bank draft returned unpaid, agent information needed
   - Include brief additional context for each customer if available from the email content
10. For single customer emails, provide standard 2-3 sentence summary
11. Scan the email body and DOC fields carefully for ANAM action codes and put them in subcategory field`;

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
    console.log('AI returned category:', analysisResult.category);

    // Process action codes and map to GHL fields using 4-tier priority matching
    const { mapping: actionMapping, code: actionCode } = getAnamActionMapping(
      analysisResult.category,
      analysisResult.subcategory
    );
    
    let ghlNote = null;
    let ghlStage = null;
    
    if (actionMapping) {
      ghlNote = actionMapping.ghlNote;
      ghlStage = actionMapping.ghlStage;
    }
    
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
    
    // Clean the email_update_date - handle string "null" and ensure proper null value
    let emailUpdateDate = analysisResult.email_update_date;
    if (emailUpdateDate === 'null' || emailUpdateDate === '' || !emailUpdateDate) {
      emailUpdateDate = null;
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
        customer_name: customerName,
        policy_id: policyId,
        category: analysisResult.category,
        subcategory: analysisResult.subcategory,
        summary: analysisResult.summary,
        suggested_action: analysisResult.suggested_action,
        email_update_date: emailUpdateDate,
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

    console.log('ANAM analysis inserted successfully, now creating email actions for each customer...');

    // Create individual email_actions for each customer with their specific DOC code mapping
    // Parse comma-separated values
    const customerNames = customerName ? customerName.split(',').map((n: string) => n.trim()) : [];
    const policyIds = policyId ? policyId.split(',').map((p: string) => p.trim()) : [];
    const reasons = analysisResult.reason ? analysisResult.reason.split(';').map((r: string) => r.trim()) : [];
    
    console.log(`Found ${customerNames.length} customers to process`);
    console.log('Customer Names:', customerNames);
    console.log('Policy IDs:', policyIds);
    console.log('Reasons (DOC codes):', reasons);

    // Extract DOC codes from summary if available (format: "1) Name -> Policy -> DOC CODE - desc")
    const extractDocCodeFromSummary = (summary: string, customerIndex: number): string | null => {
      if (!summary) return null;
      
      // Look for pattern: "N) Name -> Policy -> DOC CODE - description"
      // Split by newlines and period followed by space to handle both formats
      const lines = summary.split(/[\\n.]/).filter((l: string) => l.trim().length > 0);
      
      for (const line of lines) {
        const trimmed = line.trim();
        // Check if this line starts with the customer number
        if (trimmed.startsWith(`${customerIndex + 1})`)) {
          console.log(`Found line for customer ${customerIndex + 1}: "${trimmed}"`);
          
          // Split by ->
          const parts = trimmed.split('->');
          
          if (parts.length >= 3) {
            // Get the third part (DOC CODE) - everything after second ->
            const docPart = parts[2].trim();
            
            // Extract text before the first dash (-) which is the DOC code
            const dashIndex = docPart.indexOf('-');
            const docCode = dashIndex > 0 ? docPart.substring(0, dashIndex).trim() : docPart.trim();
            
            console.log(`Extracted DOC code for customer ${customerIndex + 1}: "${docCode}"`);
            return docCode;
          }
        }
      }
      
      console.log(`No DOC code found in summary for customer ${customerIndex + 1}`);
      return null;
    };

    // Create email_actions for each customer
    const emailActionsToInsert = [];
    
    for (let i = 0; i < Math.max(customerNames.length, policyIds.length); i++) {
      const custName = customerNames[i] || null;
      const polId = policyIds[i] || null;
      const reason = reasons[i] || null;
      
      // Try to extract DOC code from summary first, then fall back to reason
      let docCode = extractDocCodeFromSummary(analysisResult.summary, i);
      if (!docCode && reason) {
        docCode = reason;
      }
      
      console.log(`Processing customer ${i + 1}: ${custName}, Policy: ${polId}, DOC: ${docCode}`);
      
      // Map the DOC code to GHL stage and notes
      let customerGhlNote = ghlNote;
      let customerGhlStage = ghlStage;
      
      if (docCode) {
        const { mapping: docMapping } = getAnamActionMapping('', docCode);
        if (docMapping) {
          customerGhlNote = docMapping.ghlNote;
          customerGhlStage = docMapping.ghlStage;
          console.log(`Mapped DOC code "${docCode}" -> Stage: "${customerGhlStage}", Note: "${customerGhlNote}"`);
        } else {
          console.log(`No mapping found for DOC code "${docCode}", using default mapping`);
        }
      }
      
      emailActionsToInsert.push({
        email_id: email_id,
        analysis_id: insertedAnalysis.id,
        customer_name: custName,
        policy_id: polId,
        email_subject: email.subject,
        email_received_date: email.received_date,
        carrier: 'ANAM',
        carrier_label: 'American Amicable',
        category: analysisResult.category,
        subcategory: docCode || analysisResult.subcategory,
        summary: analysisResult.summary,
        suggested_action: analysisResult.suggested_action,
        priority: 'medium',
        action_status: 'pending',
        action_code: docCode || analysisResult.subcategory,
        ghl_note: customerGhlNote,
        ghl_stage_change: customerGhlStage,
        created_at: new Date().toISOString()
      });
    }

    console.log(`Inserting ${emailActionsToInsert.length} email actions...`);

    // Insert all email actions
    if (emailActionsToInsert.length > 0) {
      const { data: insertedActions, error: actionsError } = await supabaseClient
        .from('email_actions')
        .insert(emailActionsToInsert)
        .select();

      if (actionsError) {
        console.error('Error inserting email actions:', actionsError);
        // Don't throw error here, analysis is already saved
      } else {
        console.log(`Successfully inserted ${insertedActions?.length || 0} email actions`);
      }
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

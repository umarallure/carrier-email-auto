import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// ROYAL NEIGHBORS Action Mapping based on carrier status codes and indications
// Maps RNA status codes to GHL stages and note templates
const ROYAL_NEIGHBORS_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  // Failed Payment - Insufficient Funds
  "NSF CHECK RETURNED": {
    indication: "NSF CHECK RETURNED - Insufficient Funds",
    ghlNote: "Failed Payment due to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  "Insufficient Funds": {
    indication: "NSF CHECK RETURNED - Insufficient Funds",
    ghlNote: "Failed Payment due to insufficient Funds\n\nNeed to call client back and schedule a policy redate",
    ghlStage: "FDPF Insufficient Funds"
  },
  
  // Failed Payment - Incorrect Banking Info
  "NSF ACCOUNT CLOSED": {
    indication: "NSF ACCOUNT CLOSED - Account closed",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "Account Closed": {
    indication: "NSF ACCOUNT CLOSED - Account closed",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "NSF OTHER": {
    indication: "NSF OTHER - no account to locate, or payment stopped by their bank",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  "Payment Stopped": {
    indication: "NSF OTHER - no account to locate, or payment stopped by their bank",
    ghlNote: "Failed Payment due to incorrect banking info\n\nNeed to reconfirm banking information and redate policy",
    ghlStage: "FDPF Incorrect Banking Info"
  },
  
  // Cancellations and Withdrawals
  "CON TERM WITHDRAWN": {
    indication: "CON TERM WITHDRAWN - client cancelled, denied after underwriting, or agent license was not valid/up to date",
    ghlNote: "Needs manual check",
    ghlStage: "Needs manual check"
  },
  "CON TERM NT NO PAY": {
    indication: "CON TERM NT NO PAY - client called in and cancelled the policy",
    ghlNote: "Client called to cancel their Policy",
    ghlStage: "Chargeback Cancellation"
  },
  "Client Cancellation": {
    indication: "CON TERM NT NO PAY - client called in and cancelled the policy",
    ghlNote: "Client called to cancel their Policy",
    ghlStage: "Chargeback Cancellation"
  },
  
  // Declined After Underwriting
  "CON TERM DECLINED": {
    indication: "CON TERM DECLINED - declined after underwriting",
    ghlNote: "The Application got Declined Underwriting",
    ghlStage: "Declined Underwriting"
  },
  "Declined Underwriting": {
    indication: "CON TERM DECLINED - declined after underwriting",
    ghlNote: "The Application got Declined Underwriting",
    ghlStage: "Declined Underwriting"
  },
  
  // Pending/Suspended
  "CON SUS HOME OFFICE": {
    indication: "CON SUS HOME OFFICE - either client cancelled, or the client requested to not be billed this month",
    ghlNote: "Need to contact carrier to find the reason for failed payment",
    ghlStage: "FDPF Pending Reason"
  },
  "SUSPENDED": {
    indication: "The following certificate(s) are within the grace period: SUSPENDED",
    ghlNote: "Need to check for the reason for the failed payment contact with client.",
    ghlStage: "FDPF Pending Reason"
  },
  "Suspended": {
    indication: "CON SUS HOME OFFICE - either client cancelled, or the client requested to not be billed this month",
    ghlNote: "Need to contact carrier to find the reason for failed payment",
    ghlStage: "FDPF Pending Reason"
  },
  
  // Incomplete Application
  "CON TERM INCOMPLETE": {
    indication: "CON TERM INCOMPLETE - underwriting had agent requirements, but they were not received in time",
    ghlNote: "Policy closed as incomplete due to client information discrepancy. Need to reconfirm personal details and submit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  "Incomplete Application": {
    indication: "CON TERM INCOMPLETE - underwriting had agent requirements, but they were not received in time",
    ghlNote: "Policy closed as incomplete due to client information discrepancy. Need to reconfirm personal details and submit with another carrier",
    ghlStage: "Application Withdrawn"
  },
  
  // Lapsed Policy
  "CON TERM LAPSED": {
    indication: "CON TERM LAPSED - policy lapsed due to non-payment",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Chargeback Failed Payment"
  },
  "Lapsed Policy": {
    indication: "CON TERM LAPSED - policy lapsed due to non-payment",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Chargeback Failed Payment"
  },
  "Pending Lapse": {
    indication: "CON TERM LAPSED - policy lapsed due to non-payment",
    ghlNote: "Policy is pending lapse. Need to reconfirm banking information and request a redraft",
    ghlStage: "Pending Lapse"
  },
  
  // Approved and Issued
  "Approved": {
    indication: "approved and issued",
    ghlNote: "The Policy Got approved waiting for the first draft payment.",
    ghlStage: "Issued - Pending First Draft"
  },
  "Approval": {
    indication: "approved and issued",
    ghlNote: "The Policy Got approved waiting for the first draft payment.",
    ghlStage: "Issued - Pending First Draft"
  },
  
  // General categories maintained for backward compatibility
  "Premium Payment": {
    indication: "Premium payment or billing issue",
    ghlNote: "Failed Payment detected. Need to contact client and reconfirm payment information",
    ghlStage: "Pending Failed Payment Fix"
  },
  "Failed Payment": {
    indication: "Payment failed or returned",
    ghlNote: "Failed Payment detected. Need to contact client and reconfirm payment information",
    ghlStage: "Pending Failed Payment Fix"
  },
  "Policy Changes": {
    indication: "Policy change or update request",
    ghlNote: "Policy change request received. Need to review requested changes and process according to Royal Neighbors procedures.",
    ghlStage: "Post Underwriting Update"
  },
  "General Inquiry": {
    indication: "General inquiry or question",
    ghlNote: "General inquiry received. Need to review and respond to member concerns regarding their policy or membership.",
    ghlStage: "Pending"
  },
  "Other": {
    indication: "General inquiry or other matter",
    ghlNote: "General inquiry received. Need to review and determine appropriate action for Royal Neighbors matter.",
    ghlStage: "Needs manual check"
  }
};

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

    // Royal Neighbors of America specific AI analysis prompt
    const prompt = `
You are an AI assistant specialized in analyzing Royal Neighbors of America (RNA) insurance emails. RNA is a fraternal benefit society providing life insurance, annuities, and financial services.

Analyze this email and extract the following information in JSON format:

Email Subject: ${email.subject}
Email Body: ${email.body}
From: ${email.from_email || 'Unknown'}
Date: ${email.received_date}

Please analyze this Royal Neighbors of America email and provide:

1. **customer_name**: Extract the member/policyholder name (look for names in signature, body, or subject)
2. **policy_id**: Find policy numbers, certificate numbers, or member IDs (RNA uses various formats)
3. **category**: Classify the email based on RNA status codes and indications. Look for these specific codes:
   
   **Failed Payment Status Codes:**
   - "NSF CHECK RETURNED" - Insufficient Funds
   - "Insufficient Funds" - For NSF/insufficient funds situations
   - "NSF ACCOUNT CLOSED" - Account closed
   - "Account Closed" - Banking account no longer active
   - "NSF OTHER" - Payment stopped by bank or account not found
   - "Payment Stopped" - Payment blocked by customer or bank
   - "SUSPENDED" - Certificate within grace period
   
   **Cancellation/Termination Codes:**
   - "CON TERM WITHDRAWN" - Client cancelled or agent license invalid
   - "CON TERM NT NO PAY" - Client called to cancel
   - "Client Cancellation" - Voluntary cancellation
   - "CON TERM DECLINED" - Declined after underwriting
   - "Declined Underwriting" - Application denied
   
   **Status/Processing Codes:**
   - "CON SUS HOME OFFICE" - Suspended or billing held
   - "Suspended" - Policy temporarily on hold
   - "CON TERM INCOMPLETE" - Missing underwriting requirements
   - "Incomplete Application" - Application not finalized
   - "CON TERM LAPSED" - Policy lapsed due to non-payment
   - "Lapsed Policy" or "Pending Lapse" - Policy about to lapse
   - "Approved" or "Approval" - Policy approved and issued, pending first draft
   
   **General Categories:**
   - "Premium Payment" - General payment issues
   - "Failed Payment" - Any payment failure
   - "Policy Changes" - Policy modifications needed
   - "General Inquiry" - Standard questions
   - "Other" - Unspecified matters

4. **subcategory**: **CRITICAL** - Put the EXACT RNA status code here (e.g., "NSF CHECK RETURNED", "CON TERM DECLINED", "CON TERM LAPSED"). This is the most important field for action mapping. If you find a specific RNA code in the email, put it here exactly as shown above.
5. **summary**: Brief summary of the email content and purpose
6. **suggested_action**: What action should be taken (respond to inquiry, process request, follow up, etc.)
7. **review_status**: 
   - "needs_immediate_attention" for urgent claims, complaints, or time-sensitive requests
   - "standard_processing" for routine inquiries and requests
   - "low_priority" for general information requests
8. **document_links**: Extract any URLs or document references mentioned
9. **reason**: Specific reason for contact - look for RNA status codes like "NSF CHECK RETURNED", "CON TERM DECLINED", "SUSPENDED", "Approved", "Approval", etc.

**IMPORTANT**: Scan the email body carefully for RNA status codes (NSF, CON TERM, CON SUS, SUSPENDED, Approved, Approval, etc.) and use these as the category when found.

Return ONLY a valid JSON object with these fields. Do not include any other text or explanation.
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

    // Map Royal Neighbors categories to database-allowed categories (must match email_actions constraint)
    const mapCategoryToDatabase = (category: string) => {
      const categoryMap: Record<string, string> = {
        // Failed Payment Categories
        'NSF CHECK RETURNED': 'Failed payment',
        'Insufficient Funds': 'Failed payment',
        'NSF ACCOUNT CLOSED': 'Failed payment',
        'Account Closed': 'Failed payment',
        'NSF OTHER': 'Failed payment',
        'Payment Stopped': 'Failed payment',
        'Premium Payment': 'Failed payment',
        'Failed Payment': 'Failed payment',
        'SUSPENDED': 'Failed payment',
        
        // Cancellation Categories
        'CON TERM NT NO PAY': 'Cancelled policy',
        'Client Cancellation': 'Cancelled policy',
        
        // Declined/Incomplete Categories
        'CON TERM DECLINED': 'Declined/Closed as Incomplete',
        'Declined Underwriting': 'Declined/Closed as Incomplete',
        'CON TERM INCOMPLETE': 'Declined/Closed as Incomplete',
        'Incomplete Application': 'Declined/Closed as Incomplete',
        
        // Pending/Suspended Categories
        'CON SUS HOME OFFICE': 'Pending',
        'Suspended': 'Pending',
        'CON TERM WITHDRAWN': 'Pending',
        'General Inquiry': 'Pending',
        'Approved': 'Pending',
        'Approval': 'Pending',
        
        // Lapsed Categories
        'CON TERM LAPSED': 'Pending Lapse',
        'Lapsed Policy': 'Pending Lapse',
        'Pending Lapse': 'Pending Lapse',
        
        // Policy Changes
        'Policy Changes': 'Post Underwriting Update',
        
        // Default
        'Other': 'Pending'
      }
      return categoryMap[category] || 'Pending'
    }

    // Get action mapping - prioritize subcategory over category for RNA status codes
    const getActionMapping = (category: string, subcategory: string) => {
      // Priority 1: Try exact match with subcategory (RNA status codes are often in subcategory)
      if (subcategory && ROYAL_NEIGHBORS_ACTION_MAPPING[subcategory]) {
        console.log(`Matched subcategory: ${subcategory}`);
        return { mapping: ROYAL_NEIGHBORS_ACTION_MAPPING[subcategory], code: subcategory };
      }
      
      // Priority 2: Try partial match with subcategory
      if (subcategory) {
        const subcategoryUpper = subcategory.toUpperCase().trim();
        for (const [key, value] of Object.entries(ROYAL_NEIGHBORS_ACTION_MAPPING)) {
          if (subcategoryUpper.includes(key.toUpperCase()) || key.toUpperCase().includes(subcategoryUpper)) {
            console.log(`Partial matched subcategory: ${subcategory} -> ${key}`);
            return { mapping: value, code: key };
          }
        }
      }
      
      // Priority 3: Try exact match with category
      if (ROYAL_NEIGHBORS_ACTION_MAPPING[category]) {
        console.log(`Matched category: ${category}`);
        return { mapping: ROYAL_NEIGHBORS_ACTION_MAPPING[category], code: category };
      }
      
      // Priority 4: Try partial match with category
      const categoryLower = category.toLowerCase();
      for (const [key, value] of Object.entries(ROYAL_NEIGHBORS_ACTION_MAPPING)) {
        if (categoryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(categoryLower)) {
          console.log(`Partial matched category: ${category} -> ${key}`);
          return { mapping: value, code: key };
        }
      }
      
      // Fallback to "Other"
      console.log(`No match found, using fallback for: ${category} / ${subcategory}`);
      return { mapping: ROYAL_NEIGHBORS_ACTION_MAPPING["Other"], code: "Other" };
    };

    const { mapping: actionMapping, code: actionCode } = getActionMapping(analysisData.category, analysisData.subcategory);
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

    const customerName = cleanString(analysisData.customer_name) || 'Unknown';
    const policyId = cleanString(analysisData.policy_id) || 'Not provided';

    // Save analysis results to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('email_analysis_results')
      .upsert({
        email_id: email_id,
        customer_name: customerName,
        policy_id: policyId,
        reason: analysisData.reason || 'General inquiry',
        category: mapCategoryToDatabase(analysisData.category) || 'Pending',
        subcategory: analysisData.subcategory || 'Unspecified',
        summary: analysisData.summary || 'No summary available',
        suggested_action: analysisData.suggested_action || 'Review and respond',
        review_status: analysisData.review_status === 'needs_immediate_attention' ? 'pending' : 'pending',
        document_links: analysisData.document_links || null,
        carrier: 'Royal Neighbors',
        action_code: actionCode,
        ghl_note: ghlNote,
        ghl_stage: ghlStage,
        analysis_timestamp: new Date().toISOString()
      })
      .select()
      .single()

    if (saveError) {
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
        message: 'Royal Neighbors of America email analysis completed',
        analysis: savedAnalysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in Royal Neighbors analysis:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// SBLI Action Mapping for automated action sheet population
const SBLI_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  "Life Insurance Policy": {
    indication: "Life insurance policy inquiry or question",
    ghlNote: "Life insurance policy inquiry received. Need to review policy details and provide information about coverage options.",
    ghlStage: "Pending"
  },
  "Disability Insurance": {
    indication: "Disability insurance inquiry or claim",
    ghlNote: "Disability insurance inquiry received. Need to review disability coverage and assist with claim or policy questions.",
    ghlStage: "Pending"
  },
  "Retirement Planning": {
    indication: "Retirement planning or annuity inquiry",
    ghlNote: "Retirement planning inquiry received. Need to review retirement options and provide guidance on annuities or savings plans.",
    ghlStage: "Pending"
  },
  "Claims Processing": {
    indication: "Claim processing or status inquiry",
    ghlNote: "Claim processing inquiry received. Need to review claim status and follow up with SBLI for resolution.",
    ghlStage: "Pending"
  },
  "Premium Payment": {
    indication: "Premium payment or billing issue",
    ghlNote: "Premium payment issue detected. Need to review payment status and resolve billing concerns with SBLI.",
    ghlStage: "Failed payment"
  },
  "Policy Administration": {
    indication: "Policy administration or change request",
    ghlNote: "Policy administration request received. Need to review requested changes and process according to SBLI procedures.",
    ghlStage: "Post Underwriting Update"
  },
  "Beneficiary Services": {
    indication: "Beneficiary designation or change request",
    ghlNote: "Beneficiary services request received. Need to review and process beneficiary designation changes.",
    ghlStage: "Pending"
  },
  "Customer Service": {
    indication: "General customer service inquiry",
    ghlNote: "Customer service inquiry received. Need to review and respond to customer concerns regarding their policy.",
    ghlStage: "Pending"
  },
  "Agent Communication": {
    indication: "Agent or broker communication",
    ghlNote: "Agent communication received. Need to review agent inquiry and coordinate response with appropriate parties.",
    ghlStage: "Pending"
  },
  "Complaint": {
    indication: "Customer complaint or dissatisfaction",
    ghlNote: "Customer complaint received. Need to address concerns immediately and work toward resolution with SBLI.",
    ghlStage: "Pending Manual Action"
  },
  "Other": {
    indication: "General inquiry or other matter",
    ghlNote: "General inquiry received. Need to review and determine appropriate action for SBLI matter.",
    ghlStage: "Needs manual check"
  }
};

// Function to get action mapping for a specific category
function getSBLActionMapping(category: string) {
  return SBLI_ACTION_MAPPING[category] || SBLI_ACTION_MAPPING["Other"];
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

    // SBLI (Savings Bank Life Insurance) specific AI analysis prompt
    const prompt = `
You are an AI assistant specialized in analyzing SBLI (Savings Bank Life Insurance) emails. SBLI provides life insurance, disability insurance, and retirement planning services primarily in Massachusetts and New York.

Analyze this email and extract the following information in JSON format:

Email Subject: ${email.subject}
Email Body: ${email.body}
From: ${email.from_email || 'Unknown'}
Date: ${email.received_date}

Please analyze this SBLI email and provide:

1. **customer_name**: Extract the policyholder/customer name
2. **policy_id**: Find policy numbers, certificate numbers, or account numbers
3. **category**: Classify the email type:
   - "Life Insurance Policy"
   - "Disability Insurance"
   - "Retirement Planning"
   - "Claims Processing"
   - "Premium Payment"
   - "Policy Administration"
   - "Beneficiary Services"
   - "Customer Service"
   - "Agent Communication"
   - "Complaint"
   - "Other"

4. **subcategory**: More specific classification within the category
5. **summary**: Brief summary of the email content and purpose
6. **suggested_action**: What action should be taken
7. **review_status**: 
   - "needs_immediate_attention" for urgent claims, complaints, or time-sensitive requests
   - "standard_processing" for routine inquiries and requests
   - "low_priority" for general information requests
8. **document_links**: Extract any URLs or document references mentioned
9. **reason**: Specific reason for contact (e.g., "beneficiary change", "claim submission", "premium inquiry")

Focus on SBLI specific terminology:
- Savings Bank Life Insurance context
- Massachusetts and New York specific regulations
- Group and individual policies
- Dividend payments and policy values
- Agent and broker communications
- State-specific insurance requirements

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

    // Map SBLI categories to database-allowed categories
    const mapCategoryToDatabase = (category: string) => {
      const categoryMap: Record<string, string> = {
        'Life Insurance Policy': 'Pending',
        'Disability Insurance': 'Pending',
        'Retirement Planning': 'Pending',
        'Claims Processing': 'Pending',
        'Premium Payment': 'Failed payment',
        'Policy Administration': 'Post Underwriting Update',
        'Beneficiary Services': 'Pending',
        'Customer Service': 'Pending',
        'Agent Communication': 'Pending',
        'Complaint': 'Pending',
        'Other': 'Pending'
      }
      return categoryMap[category] || 'Pending'
    }

    // Get action mapping for the category
    const actionMapping = getSBLActionMapping(analysisData.category);
    const actionCode = analysisData.category; // Use category as action code for SBLI
    const ghlNote = actionMapping.ghlNote;
    const ghlStage = actionMapping.ghlStage;

    // Save analysis results to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('email_analysis_results')
      .upsert({
        email_id: email_id,
        customer_name: analysisData.customer_name || 'Unknown',
        policy_id: analysisData.policy_id || 'Not provided',
        reason: analysisData.reason || 'General inquiry',
        category: mapCategoryToDatabase(analysisData.category) || 'Pending',
        subcategory: analysisData.subcategory || 'Unspecified',
        summary: analysisData.summary || 'No summary available',
        suggested_action: analysisData.suggested_action || 'Review and respond',
        review_status: analysisData.review_status === 'needs_immediate_attention' ? 'pending' : 'pending',
        document_links: analysisData.document_links || null,
        carrier: 'SBLI',
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
        message: 'SBLI email analysis completed',
        analysis: savedAnalysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in SBLI analysis:', error)
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

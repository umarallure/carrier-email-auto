import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// ROYAL NEIGHBORS Action Mapping for automated action sheet population
const ROYAL_NEIGHBORS_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  "Life Insurance Inquiry": {
    indication: "Life insurance policy inquiry or question",
    ghlNote: "Life insurance inquiry received. Need to review policy details and provide information about coverage options.",
    ghlStage: "Pending"
  },
  "Annuity Service Request": {
    indication: "Annuity service or management request",
    ghlNote: "Annuity service request received. Need to review annuity details and assist with account management.",
    ghlStage: "Pending"
  },
  "Member Benefits": {
    indication: "Member benefits inquiry or request",
    ghlNote: "Member benefits inquiry received. Need to review fraternal benefits and assist member with available services.",
    ghlStage: "Pending"
  },
  "Fraternal Activities": {
    indication: "Fraternal activities or membership inquiry",
    ghlNote: "Fraternal activities inquiry received. Need to provide information about Royal Neighbors activities and membership benefits.",
    ghlStage: "Pending"
  },
  "Claims Processing": {
    indication: "Claim processing or status inquiry",
    ghlNote: "Claim processing inquiry received. Need to review claim status and follow up with Royal Neighbors for resolution.",
    ghlStage: "Pending"
  },
  "Premium Payment": {
    indication: "Premium payment or billing issue",
    ghlNote: "Premium payment issue detected. Need to review payment status and resolve billing concerns with Royal Neighbors.",
    ghlStage: "Failed payment"
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
  "Complaint": {
    indication: "Member complaint or dissatisfaction",
    ghlNote: "Member complaint received. Need to address concerns immediately and work toward resolution with Royal Neighbors.",
    ghlStage: "Pending Manual Action"
  },
  "Other": {
    indication: "General inquiry or other matter",
    ghlNote: "General inquiry received. Need to review and determine appropriate action for Royal Neighbors matter.",
    ghlStage: "Needs manual check"
  }
};

// Function to get action mapping for a specific category
function getRoyalNeighborsActionMapping(category: string) {
  return ROYAL_NEIGHBORS_ACTION_MAPPING[category] || ROYAL_NEIGHBORS_ACTION_MAPPING["Other"];
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
3. **category**: Classify the email type:
   - "Life Insurance Inquiry"
   - "Annuity Service Request" 
   - "Member Benefits"
   - "Fraternal Activities"
   - "Claims Processing"
   - "Premium Payment"
   - "Policy Changes"
   - "General Inquiry"
   - "Complaint"
   - "Other"

4. **subcategory**: More specific classification within the category
5. **summary**: Brief summary of the email content and purpose
6. **suggested_action**: What action should be taken (respond to inquiry, process request, follow up, etc.)
7. **review_status**: 
   - "needs_immediate_attention" for urgent claims, complaints, or time-sensitive requests
   - "standard_processing" for routine inquiries and requests
   - "low_priority" for general information requests
8. **document_links**: Extract any URLs or document references mentioned
9. **reason**: Specific reason for contact (e.g., "beneficiary change request", "cash value inquiry", "fraternal benefit question")

Focus on Royal Neighbors of America specific terminology:
- Member services vs customer service
- Certificate numbers for life insurance
- Fraternal benefits and activities
- Cash value and surrender options
- Beneficiary designations
- Premium modes and payment schedules

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
        'Life Insurance Inquiry': 'Pending',
        'Annuity Service Request': 'Pending',
        'Member Benefits': 'Pending',
        'Fraternal Activities': 'Pending',
        'Claims Processing': 'Pending',
        'Premium Payment': 'Failed payment',
        'Policy Changes': 'Post Underwriting Update',
        'General Inquiry': 'Pending',
        'Complaint': 'Pending',
        'Other': 'Pending'
      }
      return categoryMap[category] || 'Pending'
    }

    // Get action mapping for the category
    const actionMapping = getRoyalNeighborsActionMapping(analysisData.category);
    const actionCode = analysisData.category; // Use category as action code for ROYAL NEIGHBORS
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

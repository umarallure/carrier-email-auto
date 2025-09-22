import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// GUARANTEE TRUST Action Mapping for automated action sheet population
const GUARANTEE_TRUST_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  "Term Life Insurance": {
    indication: "Term life insurance policy inquiry or issue",
    ghlNote: "Term life insurance matter requiring attention. Need to review policy details and assist with term coverage options.",
    ghlStage: "Pending"
  },
  "Whole Life Insurance": {
    indication: "Whole life insurance policy inquiry or issue",
    ghlNote: "Whole life insurance matter requiring attention. Need to review permanent coverage details and assist customer.",
    ghlStage: "Pending"
  },
  "Simplified Issue Policy": {
    indication: "Simplified issue policy inquiry or processing",
    ghlNote: "Simplified issue policy matter. Need to review guaranteed acceptance requirements and assist with application.",
    ghlStage: "Pending"
  },
  "Claims Processing": {
    indication: "Claim processing or adjudication issue",
    ghlNote: "Claim processing issue identified. Need to review claim status and follow up with Guarantee Trust for resolution.",
    ghlStage: "Pending"
  },
  "Premium Payment": {
    indication: "Premium payment or billing issue",
    ghlNote: "Premium payment issue detected. Need to review payment status and resolve billing concerns with Guarantee Trust.",
    ghlStage: "Failed payment"
  },
  "Policy Administration": {
    indication: "Policy administration or servicing request",
    ghlNote: "Policy administration matter requiring attention. Need to review policy changes and update records accordingly.",
    ghlStage: "Post Underwriting Update"
  },
  "Underwriting": {
    indication: "Underwriting decision or application status",
    ghlNote: "Underwriting matter requiring attention. Need to review application status and inform customer of next steps.",
    ghlStage: "Pending"
  },
  "Customer Service": {
    indication: "General customer service inquiry",
    ghlNote: "Customer service inquiry received. Need to review and respond to customer concerns regarding their policy.",
    ghlStage: "Pending"
  },
  "Agent Support": {
    indication: "Agent support or commission inquiry",
    ghlNote: "Agent support matter requiring attention. Need to review agent concerns and provide appropriate assistance.",
    ghlStage: "Pending Manual Action"
  },
  "Policy Conversion": {
    indication: "Policy conversion request or inquiry",
    ghlNote: "Policy conversion inquiry received. Need to review conversion options and assist customer with term-to-permanent conversion.",
    ghlStage: "Post Underwriting Update"
  },
  "Complaint": {
    indication: "Customer complaint or dissatisfaction",
    ghlNote: "Customer complaint received. Need to address concerns immediately and work toward resolution with Guarantee Trust.",
    ghlStage: "Pending Manual Action"
  },
  "Other": {
    indication: "General inquiry or other matter",
    ghlNote: "General inquiry received. Need to review and determine appropriate action for Guarantee Trust matter.",
    ghlStage: "Needs manual check"
  }
};

// Function to get action mapping for a specific category
function getGuaranteeTrustActionMapping(category: string) {
  return GUARANTEE_TRUST_ACTION_MAPPING[category] || GUARANTEE_TRUST_ACTION_MAPPING["Other"];
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

    // Guarantee Trust Life Insurance specific AI analysis prompt
    const prompt = `
You are an AI assistant specialized in analyzing Guarantee Trust Life Insurance Company emails. GTL is known for providing affordable life insurance coverage and simplified issue policies.

Analyze this email and extract the following information in JSON format:

Email Subject: ${email.subject}
Email Body: ${email.body}
From: ${email.from_email || 'Unknown'}
Date: ${email.received_date}

Please analyze this Guarantee Trust Life Insurance email and provide:

1. **customer_name**: Extract the policyholder/customer name
2. **policy_id**: Find policy numbers, certificate numbers, or account numbers (GTL uses various formats)
3. **category**: Classify the email type:
   - "Term Life Insurance"
   - "Whole Life Insurance"
   - "Simplified Issue Policy"
   - "Claims Processing"
   - "Premium Payment"
   - "Policy Administration"
   - "Underwriting"
   - "Customer Service"
   - "Agent Support"
   - "Policy Conversion"
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
9. **reason**: Specific reason for contact (e.g., "policy conversion inquiry", "claim submission", "premium question")

Focus on Guarantee Trust Life specific terminology:
- Simplified issue and guaranteed acceptance policies
- Term life conversion options
- Graded death benefits
- Level premium periods
- Agent and distributor communications
- Policy administration services

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

    // Map Guarantee Trust Life categories to database-allowed categories
    const mapCategoryToDatabase = (category: string) => {
      const categoryMap: Record<string, string> = {
        'Term Life Insurance': 'Pending',
        'Whole Life Insurance': 'Pending',
        'Simplified Issue Policy': 'Pending',
        'Claims Processing': 'Pending',
        'Premium Payment': 'Failed payment',
        'Policy Administration': 'Post Underwriting Update',
        'Underwriting': 'Pending',
        'Customer Service': 'Pending',
        'Agent Support': 'Pending',
        'Policy Conversion': 'Post Underwriting Update',
        'Complaint': 'Pending',
        'Other': 'Pending'
      }
      return categoryMap[category] || 'Pending'
    }

    // Get action mapping for the category
    const actionMapping = getGuaranteeTrustActionMapping(analysisData.category);
    const actionCode = analysisData.category; // Use category as action code for GUARANTEE TRUST
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
        carrier: 'Guarantee Trust',
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
        message: 'Guarantee Trust Life email analysis completed',
        analysis: savedAnalysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in Guarantee Trust Life analysis:', error)
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

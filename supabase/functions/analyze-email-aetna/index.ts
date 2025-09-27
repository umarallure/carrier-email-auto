import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

// AETNA Action Mapping for automated action sheet population
const AETNA_ACTION_MAPPING: Record<string, { indication: string; ghlNote: string; ghlStage: string }> = {
  "Billing and Payment": {
    indication: "Payment or billing related issue",
    ghlNote: "Billing or payment issue detected. Need to review account status and resolve payment concerns.",
    ghlStage: "Failed payment"
  },
  "Claims Processing": {
    indication: "Claim processing or adjudication issue",
    ghlNote: "Claim processing issue identified. Need to review claim status and follow up with Aetna for resolution.",
    ghlStage: "Pending"
  },
  "Appeals and Grievances": {
    indication: "Appeal or grievance filed",
    ghlNote: "Appeal or grievance has been submitted. Need to monitor status and provide support to member.",
    ghlStage: "Pending Manual Action"
  },
  "Prior Authorization": {
    indication: "Prior authorization request or issue",
    ghlNote: "Prior authorization required or issue detected. Need to ensure proper authorization is obtained for services.",
    ghlStage: "Pending Approval"
  },
  "Provider Network": {
    indication: "Provider network or referral issue",
    ghlNote: "Provider network issue identified. Need to assist member with finding in-network providers or resolving referral issues.",
    ghlStage: "Pending Manual Action"
  },
  "Member Services": {
    indication: "General member service inquiry",
    ghlNote: "Member service inquiry received. Need to review and respond to member concerns.",
    ghlStage: "Pending"
  },
  "Health Insurance": {
    indication: "Health insurance policy or coverage issue",
    ghlNote: "Health insurance matter requiring attention. Need to review policy details and assist member.",
    ghlStage: "Pending"
  },
  "Life Insurance": {
    indication: "Life insurance policy or coverage issue",
    ghlNote: "Life insurance matter requiring attention. Need to review policy details and assist member.",
    ghlStage: "Pending"
  },
  "Disability Insurance": {
    indication: "Disability insurance policy or coverage issue",
    ghlNote: "Disability insurance matter requiring attention. Need to review policy details and assist member.",
    ghlStage: "Pending"
  },
  "Employee Benefits": {
    indication: "Employee benefits or group coverage issue",
    ghlNote: "Employee benefits matter requiring attention. Need to review group coverage and assist member.",
    ghlStage: "Pending"
  },
  "Compliance": {
    indication: "Compliance or regulatory issue",
    ghlNote: "Compliance matter requiring attention. Need to ensure all regulatory requirements are met.",
    ghlStage: "Pending Manual Action"
  },
  "Other": {
    indication: "General inquiry or other matter",
    ghlNote: "General inquiry received. Need to review and determine appropriate action.",
    ghlStage: "Needs manual check"
  }
};

// Function to get action mapping for a specific category
function getAetnaActionMapping(category: string) {
  return AETNA_ACTION_MAPPING[category] || AETNA_ACTION_MAPPING["Other"];
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

    // Aetna specific AI analysis prompt
    const prompt = `
You are an AI assistant specialized in analyzing Aetna insurance emails. Aetna is a major health insurance company that also provides life insurance, disability insurance, and employee benefits.

Analyze this email and extract the following information in JSON format:

Email Subject: ${email.subject}
Email Body: ${email.body}
From: ${email.from_email || 'Unknown'}
Date: ${email.received_date}

Please analyze this Aetna email and provide:

1. **customer_name**: Extract the member/policyholder name
2. **policy_id**: Find member IDs, policy numbers, or group numbers (Aetna uses various formats)
3. **category**: Classify the email type using ONE of these exact categories:
   - "Billing and Payment" (for premium payments, billing issues, payment failures)
   - "Claims Processing" (for claim submissions, claim status, claim payments)
   - "Provider Network" (for provider directories, referrals, network issues)
   - "Prior Authorization" (for pre-authorization requests, approvals, denials)
   - "Member Services" (for ID cards, coverage questions, general inquiries)
   - "Appeals and Grievances" (for appeals, grievances, disputes)
   - "Compliance" (for HIPAA, privacy, regulatory matters)
   - "Other" (for anything that doesn't fit above categories)

4. **subcategory**: More specific classification within the category
5. **summary**: Brief summary of the email content and purpose
6. **suggested_action**: What action should be taken
7. **review_status**: 
   - "needs_immediate_attention" for urgent claims, appeals, or time-sensitive requests
   - "standard_processing" for routine inquiries and requests
   - "low_priority" for general information requests
8. **document_links**: Extract any URLs or document references mentioned
9. **reason**: Specific reason for contact (e.g., "prior authorization request", "claim denial appeal", "member inquiry")

Focus on Aetna specific terminology:
- Member services and benefits
- Provider networks and referrals
- Prior authorization requirements
- Claims adjudication
- Appeals and grievance processes
- Group and individual policies
- Health and wellness programs
- CVS Health integration services

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
      throw new Error('No response from Groq AI')
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

    // Map Aetna categories to database-allowed categories (must match email_actions constraint)
    const mapCategoryToDatabase = (category: string) => {
      const categoryMap: Record<string, string> = {
        'Billing and Payment': 'Failed payment',
        'Claims Processing': 'Pending',
        'Provider Network': 'Pending',
        'Prior Authorization': 'Pending',
        'Member Services': 'Pending',
        'Appeals and Grievances': 'Pending',
        'Compliance': 'Pending',
        'Other': 'Pending'
      }
      return categoryMap[category] || 'Pending'
    }

    // Get action mapping for the category
    const actionMapping = getAetnaActionMapping(analysisData.category);
    const actionCode = analysisData.category; // Use category as action code for AETNA
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
        carrier: 'Aetna',
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
        message: 'Aetna email analysis completed',
        analysis: savedAnalysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in Aetna analysis:', error)
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

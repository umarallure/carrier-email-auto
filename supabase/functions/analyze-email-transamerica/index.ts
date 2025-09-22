import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
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

    // Transamerica specific AI analysis prompt
    const prompt = `
You are an AI assistant specialized in analyzing Transamerica insurance and financial services emails. Transamerica is a major life insurance company offering life insurance, annuities, retirement plans, and investment services.

Analyze this email and extract the following information in JSON format:

Email Subject: ${email.subject}
Email Body: ${email.body}
From: ${email.from_email || 'Unknown'}
Date: ${email.received_date}

Please analyze this Transamerica email and provide:

1. **customer_name**: Extract the policyholder/customer name
2. **policy_id**: Find policy numbers, contract numbers, account numbers, or participant IDs (Transamerica uses various formats)
3. **category**: Classify the email type:
   - "Life Insurance"
   - "Annuity Services"
   - "Retirement Plans"
   - "401(k) Administration"
   - "Investment Services"
   - "Claims Processing"
   - "Premium Payment"
   - "Policy Administration"
   - "Participant Services"
   - "Beneficiary Services"
   - "Underwriting"
   - "Customer Service"
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
9. **reason**: Specific reason for contact (e.g., "loan request", "beneficiary change", "retirement distribution", "account transfer")

Focus on Transamerica specific terminology:
- Transamerica life insurance products
- Variable and fixed annuities
- 401(k) and retirement plan administration
- Participant services and distributions
- Account values and performance
- Beneficiary designations
- Premium financing and payments
- Investment options and transfers

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

    // Save analysis results to database
    const { data: savedAnalysis, error: saveError } = await supabase
      .from('email_analysis_results')
      .upsert({
        email_id: email_id,
        customer_name: analysisData.customer_name || 'Unknown',
        policy_id: analysisData.policy_id || 'Not provided',
        reason: analysisData.reason || 'General inquiry',
        category: analysisData.category || 'Customer Service',
        subcategory: analysisData.subcategory || 'Unspecified',
        summary: analysisData.summary || 'No summary available',
        suggested_action: analysisData.suggested_action || 'Review and respond',
        review_status: analysisData.review_status === 'needs_immediate_attention' ? 'pending' : 'pending',
        document_links: analysisData.document_links || null,
        carrier: 'Transamerica',
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
        message: 'Transamerica email analysis completed',
        analysis: savedAnalysis 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error in Transamerica analysis:', error)
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

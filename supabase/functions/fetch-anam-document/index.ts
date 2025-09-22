import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

const togetherApiKey = Deno.env.get('TOGETHER_API_KEY');

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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const { document_url, policy_id, customer_name, session_cookie } = await req.json();

    if (!document_url) {
      throw new Error('Document URL required');
    }

    console.log('Fetching ANAM document from:', document_url);

    // Parse the document URL to extract parameters
    const urlObj = new URL(document_url);
    const params = {
      pol: urlObj.searchParams.get('pol'),
      doc: urlObj.searchParams.get('doc'),
      hash: urlObj.searchParams.get('hash'),
      agtnum: urlObj.searchParams.get('agtnum'),
      type: urlObj.searchParams.get('type')
    };

    console.log('Document parameters:', params);

    // Attempt to fetch the document
    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    };

    // Add session cookie if provided (for authenticated requests)
    if (session_cookie) {
      headers['Cookie'] = session_cookie;
    }

    let documentContent = '';
    let fetchError = null;

    try {
      const response = await fetch(document_url, {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      });

      if (response.ok) {
        documentContent = await response.text();
        console.log('Successfully fetched document, length:', documentContent.length);
      } else {
        fetchError = `HTTP ${response.status}: ${response.statusText}`;
        console.log('Failed to fetch document:', fetchError);
      }
    } catch (error) {
      fetchError = error.message;
      console.log('Error fetching document:', fetchError);
    }

    // If we couldn't fetch the document, return the URL info for manual processing
    if (!documentContent || documentContent.length < 100) {
      return new Response(JSON.stringify({
        success: false,
        error: fetchError || 'Document content unavailable',
        document_info: {
          url: document_url,
          policy_number: params.pol,
          document_id: params.doc,
          agent_number: params.agtnum,
          document_type: params.type,
          requires_authentication: true
        },
        suggestion: 'This document requires authentication. You may need to log into the ANAM portal manually to access it.'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If we have document content, analyze it with AI
    if (togetherApiKey && documentContent.length > 100) {
      console.log('Analyzing document content with AI...');

      const analysisPrompt = `
Analyze this ANAM insurance document and extract key information. The document is related to:
- Policy ID: ${policy_id || params.pol || 'Unknown'}
- Customer: ${customer_name || 'Unknown'}

Document Content:
${documentContent}

Please extract and return a JSON object with:
{
  "document_type": "string - Type of document (correspondence, notice, etc.)",
  "policy_number": "string - Policy number mentioned",
  "customer_name": "string - Customer name mentioned", 
  "update_reason": "string - Main reason/purpose of this document",
  "key_dates": "array of strings - Any important dates mentioned",
  "action_required": "string - Any action required from customer or agent",
  "summary": "string - 2-3 sentence summary of document content",
  "additional_details": "string - Any other important information"
}

Return only valid JSON, no additional text.`;

      try {
        const aiResponse = await fetch('https://api.together.xyz/v1/chat/completions', {
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
                content: 'You are an expert insurance document analyst. Always respond with valid JSON only.'
              },
              {
                role: 'user',
                content: analysisPrompt
              }
            ],
            temperature: 0.1,
            max_tokens: 1000,
            top_p: 0.9
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const analysisText = aiData.choices[0].message.content;
          
          try {
            const cleanedResponse = analysisText.replace(/```json\n?|\n?```/g, '').trim();
            const analysis = JSON.parse(cleanedResponse);

            return new Response(JSON.stringify({
              success: true,
              document_info: {
                url: document_url,
                policy_number: params.pol,
                document_id: params.doc,
                agent_number: params.agtnum,
                document_type: params.type
              },
              content_analysis: analysis,
              raw_content: documentContent.substring(0, 2000) // First 2000 chars for reference
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });

          } catch (parseError) {
            console.log('AI analysis parse error:', parseError);
          }
        }
      } catch (aiError) {
        console.log('AI analysis error:', aiError);
      }
    }

    // Return document content without AI analysis if AI failed
    return new Response(JSON.stringify({
      success: true,
      document_info: {
        url: document_url,
        policy_number: params.pol,
        document_id: params.doc,
        agent_number: params.agtnum,
        document_type: params.type
      },
      raw_content: documentContent.substring(0, 2000), // First 2000 chars
      note: 'Document fetched but AI analysis unavailable'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in fetch-anam-document function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

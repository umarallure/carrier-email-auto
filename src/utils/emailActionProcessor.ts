import { supabase } from '@/integrations/supabase/client';

interface EmailAnalysisResult {
  id: string;
  email_id: string;
  customer_name: string | null;
  policy_id: string | null;
  email_update_date: string | null;
  summary: string | null;
  suggested_action: string | null;
  category: string | null;
  subcategory: string | null;
}

interface Email {
  id: string;
  subject: string;
  received_date: string;
  carrier: string;
  carrier_label: string;
  user_id: string;
}

/**
 * Processes analyzed emails and creates action entries
 * Handles multiple customers mentioned in a single email by creating separate action entries
 */
export const processEmailsIntoActions = async (
  emailIds?: string[],
  forceReprocess: boolean = false
): Promise<{ success: number; errors: number; details: string[] }> => {
  const results = {
    success: 0,
    errors: 0,
    details: [] as string[]
  };

  try {
    // Build query for analysis results
    let analysisQuery = supabase
      .from('email_analysis_results')
      .select(`
        *,
        emails!inner(
          id,
          subject,
          received_date,
          carrier,
          carrier_label,
          user_id
        )
      `);

    // Filter by specific email IDs if provided
    if (emailIds && emailIds.length > 0) {
      analysisQuery = analysisQuery.in('email_id', emailIds);
    }

    // Only process analyses with customer names
    analysisQuery = analysisQuery.not('customer_name', 'is', null);

    const { data: analysisResults, error: analysisError } = await analysisQuery;

    if (analysisError) {
      throw analysisError;
    }

    if (!analysisResults || analysisResults.length === 0) {
      results.details.push('No analysis results found with customer information');
      return results;
    }

    // Process each analysis result
    for (const analysis of analysisResults) {
      try {
        const email = analysis.emails;
        
        // Check if action already exists for this analysis
        if (!forceReprocess) {
          const { data: existingActions } = await supabase
            .from('email_actions')
            .select('id')
            .eq('analysis_id', analysis.id)
            .eq('customer_name', analysis.customer_name);

          if (existingActions && existingActions.length > 0) {
            results.details.push(`Action already exists for ${analysis.customer_name} - ${email.subject}`);
            continue;
          }
        }

        // Parse customer names in case multiple customers are mentioned
        const customerNames = parseCustomerNames(analysis.customer_name);
        const policyIds = parsePolicyIds(analysis.policy_id);

        // Create action entries for each customer
        for (let i = 0; i < customerNames.length; i++) {
          const customerName = customerNames[i];
          const policyId = policyIds[i] || policyIds[0] || null; // Use corresponding policy ID or first one

          // Determine initial priority based on category
          const priority = determinePriority(analysis.category, analysis.subcategory);
          
          // Generate action code
          const actionCode = generateActionCode(email.carrier, analysis.category, customerName);

          // For ANAM: Extract individual DOC code from summary for this specific customer
          let ghlNote = null;
          let ghlStage = null;
          
          if (email.carrier === 'ANAM' && analysis.summary) {
            const docCodeForCustomer = extractDocCodeForCustomer(analysis.summary, customerName, policyId);
            if (docCodeForCustomer) {
              const mapping = getAnamActionMapping(docCodeForCustomer);
              if (mapping) {
                ghlNote = mapping.ghlNote;
                ghlStage = mapping.ghlStage;
              }
            }
          }

          const actionData = {
            email_id: analysis.email_id,
            analysis_id: analysis.id,
            customer_name: customerName.trim(),
            policy_id: policyId,
            email_subject: email.subject,
            email_received_date: email.received_date,
            carrier: email.carrier,
            carrier_label: email.carrier_label,
            email_update_date: analysis.email_update_date,
            summary: analysis.summary,
            suggested_action: analysis.suggested_action,
            category: analysis.category,
            subcategory: analysis.subcategory,
            action_code: actionCode,
            action_status: 'pending',
            priority: priority,
            is_processed: false,
            ghl_note: ghlNote, // Add GHL note
            ghl_stage_change: ghlStage // Add GHL stage
          };

          // Insert the action
          const { error: insertError } = await supabase
            .from('email_actions')
            .insert([actionData]);

          if (insertError) {
            throw insertError;
          }

          results.success++;
          results.details.push(`Created action for ${customerName} - ${email.subject}`);
        }

      } catch (error: any) {
        results.errors++;
        results.details.push(`Error processing ${analysis.customer_name}: ${error.message}`);
        console.error('Error processing analysis:', error);
      }
    }

  } catch (error: any) {
    results.errors++;
    results.details.push(`General error: ${error.message}`);
    console.error('Error in processEmailsIntoActions:', error);
  }

  return results;
};

/**
 * Parse customer names that might be separated by delimiters
 */
const parseCustomerNames = (customerNameString: string | null): string[] => {
  if (!customerNameString) return [];
  
  // Split by common delimiters and clean up
  const names = customerNameString
    .split(/[,;|&]|\band\b/i)
    .map(name => name.trim())
    .filter(name => name.length > 0);
  
  return names.length > 0 ? names : [customerNameString.trim()];
};

/**
 * Parse policy IDs that might be separated by delimiters
 */
const parsePolicyIds = (policyIdString: string | null): string[] => {
  if (!policyIdString) return [];
  
  // Split by common delimiters and clean up
  const ids = policyIdString
    .split(/[,;|&]/)
    .map(id => id.trim())
    .filter(id => id.length > 0);
  
  return ids.length > 0 ? ids : [policyIdString.trim()];
};

/**
 * Determine priority based on category and subcategory
 */
const determinePriority = (category: string | null, subcategory: string | null): string => {
  if (!category) return 'medium';
  
  const urgentCategories = ['Failed payment', 'Cancelled policy', 'Chargeback'];
  const highCategories = ['Pending Lapse', 'Post Underwriting Update'];
  
  if (urgentCategories.includes(category)) {
    return 'urgent';
  }
  
  if (highCategories.includes(category)) {
    return 'high';
  }
  
  // Check subcategory for additional priority clues
  if (subcategory) {
    const urgentSubcategories = ['Premium due', 'Policy lapse'];
    if (urgentSubcategories.some(sub => subcategory.toLowerCase().includes(sub.toLowerCase()))) {
      return 'high';
    }
  }
  
  return 'medium';
};

/**
 * Generate action code based on carrier, category, and customer
 */
const generateActionCode = (carrier: string, category: string | null, customerName: string): string => {
  const carrierCode = getCarrierCode(carrier);
  const categoryCode = getCategoryCode(category);
  const customerCode = customerName.substring(0, 3).toUpperCase();
  const timestamp = Date.now().toString().slice(-6);
  
  return `${carrierCode}-${categoryCode}-${customerCode}-${timestamp}`;
};

/**
 * Get short carrier code
 */
const getCarrierCode = (carrier: string): string => {
  const codes: Record<string, string> = {
    'AETNA': 'AET',
    'ANAM': 'ANM',
    'COREBRIDGE': 'CBR',
    'SBLI': 'SBL',
    'MUTUAL OF OMAHA': 'MOO',
    'GUARANTEE TRUST LIFE': 'GTL',
    'TRANSAMERICA': 'TRA',
    'LIBERTY BANKERS': 'LIB',
    'ROYAL NEIGHBORS': 'RNE'
  };
  
  return codes[carrier.toUpperCase()] || 'GEN';
};

/**
 * Get short category code
 */
const getCategoryCode = (category: string | null): string => {
  if (!category) return 'GEN';
  
  const codes: Record<string, string> = {
    'Failed payment': 'FP',
    'Cancelled policy': 'CP',
    'Chargeback': 'CB',
    'Pending': 'PD',
    'Post Underwriting Update': 'PU',
    'Pending Lapse': 'PL',
    'Declined/Closed as Incomplete': 'DI'
  };
  
  return codes[category] || 'GEN';
};

/**
 * Extract DOC code for a specific customer from ANAM summary
 * ANAM summaries are formatted like: "1) Customer Name -> Policy Number -> DOC Code - description"
 */
const extractDocCodeForCustomer = (summary: string, customerName: string, policyId: string | null): string | null => {
  try {
    // Split summary into numbered entries
    const entries = summary.split(/\d+\)/).filter(e => e.trim());
    
    for (const entry of entries) {
      // Check if this entry matches the customer name or policy ID
      const entryLower = entry.toLowerCase();
      const customerLower = customerName.toLowerCase();
      
      if (entryLower.includes(customerLower) || (policyId && entryLower.includes(policyId))) {
        // Extract DOC code - it's after the second arrow (->)
        const parts = entry.split('->');
        if (parts.length >= 3) {
          // DOC code is the third part, before the dash
          const docPart = parts[2].trim();
          const docCode = docPart.split('-')[0].trim();
          return docCode;
        }
      }
    }
  } catch (error) {
    console.error('Error extracting DOC code:', error);
  }
  
  return null;
};

/**
 * ANAM Action Code Mapping - simplified version for frontend use
 * Maps ANAM action codes to GHL stages and notes
 */
const getAnamActionMapping = (docCode: string): { ghlNote: string; ghlStage: string } | null => {
  // Comprehensive ANAM mapping
  const ANAM_MAPPING: Record<string, { ghlNote: string; ghlStage: string }> = {
    // Failed Payment - Insufficient Funds
    'BANK DRAFT RETURNED INSUFF': {
      ghlNote: 'Failed Payment to to insufficient Funds\n\nNeed to call client back and schedule a policy redate',
      ghlStage: 'FDPF Insufficient Funds'
    },
    'BK DRFT RTN NSF W/AGT INFO': {
      ghlNote: 'Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate',
      ghlStage: 'FDPF Insufficient Funds'
    },
    'S.S. INSUFFICIENT FUNDS': {
      ghlNote: 'Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate',
      ghlStage: 'FDPF Insufficient Funds'
    },
    'SSDF2 S.S. INSUFFICIENT FUNDS': {
      ghlNote: 'Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate',
      ghlStage: 'FDPF Insufficient Funds'
    },
    'ABDI2 BK DRFT RTN NSF W/AGT INFO': {
      ghlNote: 'Failed Paymen to to insufficient Funds\n\nNeed to call client back and schedule a policy redate',
      ghlStage: 'FDPF Insufficient Funds'
    },
    'ABDR2 BK DRFT RTN-UNPD AGT INFO': {
      ghlNote: 'Needs manual check',
      ghlStage: 'Needs manual check'
    },
    // Endorsement/Manual Action
    'ENDORSEMENT NOT RCVD': {
      ghlNote: 'Agent needs to send in endoursement for rate class change (Client approved for other than applied for)',
      ghlStage: 'Pending Manual Action'
    },
    'IMAN3 Endor/Elim of Cvrg Not Rcvd': {
      ghlNote: 'Agent needs to send in endoursement for rate class change (Client approved for other than applied for)',
      ghlStage: 'Pending Manual Action'
    },
    // Declined codes
    'DECLINE-MULT POL NO$': {
      ghlNote: 'Policy withdrawn as per reapplying guidelines. \n\nNeed to resubmit with another carrier',
      ghlStage: 'Application Withdrawn'
    },
    'DECLINE-MULT POS': {
      ghlNote: 'Policy withdrawn as per reapplying guidelines. \n\nNeed to resubmit with another carrier',
      ghlStage: 'Application Withdrawn'
    },
    'UREAP DECLINE-MULT POS': {
      ghlNote: 'Policy withdrawn as per reapplying guidelines. \n\nNeed to resubmit with another carrier',
      ghlStage: 'Application Withdrawn'
    },
    'UWDMA DECLINE-MULT POL NO$': {
      ghlNote: 'Policy withdrawn as per reapplying guidelines. \n\nNeed to resubmit with another carrier',
      ghlStage: 'Application Withdrawn'
    },
    // Add more mappings as needed...
  };
  
  // Try exact match first
  if (ANAM_MAPPING[docCode]) {
    return ANAM_MAPPING[docCode];
  }
  
  // Try partial match (case-insensitive)
  const docCodeUpper = docCode.toUpperCase();
  for (const [key, value] of Object.entries(ANAM_MAPPING)) {
    if (key.toUpperCase().includes(docCodeUpper) || docCodeUpper.includes(key.toUpperCase())) {
      return value;
    }
  }
  
  return null;
};

/**
 * Process all unprocessed analysis results into actions
 */
export const processAllUnprocessedAnalysis = async (): Promise<{ success: number; errors: number; details: string[] }> => {
  console.log('Starting to process all unprocessed analysis results into actions');
  
  // Get all analysis results that don't have corresponding actions
  const { data: unprocessedAnalysis, error } = await supabase
    .from('email_analysis_results')
    .select(`
      id,
      email_id,
      customer_name
    `)
    .not('customer_name', 'is', null)
    .not('id', 'in', `(SELECT analysis_id FROM email_actions)`);

  if (error) {
    console.error('Error fetching unprocessed analysis:', error);
    return { success: 0, errors: 1, details: [error.message] };
  }

  if (!unprocessedAnalysis || unprocessedAnalysis.length === 0) {
    return { success: 0, errors: 0, details: ['No unprocessed analysis results found'] };
  }

  console.log(`Found ${unprocessedAnalysis.length} unprocessed analysis results`);

  // Process the email IDs
  const emailIds = [...new Set(unprocessedAnalysis.map(a => a.email_id))];
  return await processEmailsIntoActions(emailIds, false);
};

/**
 * Manually trigger action creation for specific analysis results
 */
export const createActionsForAnalysis = async (analysisIds: string[]): Promise<{ success: number; errors: number; details: string[] }> => {
  const results = {
    success: 0,
    errors: 0,
    details: [] as string[]
  };

  try {
    for (const analysisId of analysisIds) {
      const { data: analysis, error } = await supabase
        .from('email_analysis_results')
        .select(`
          *,
          emails!inner(
            id,
            subject,
            received_date,
            carrier,
            carrier_label,
            user_id
          )
        `)
        .eq('id', analysisId)
        .single();

      if (error || !analysis) {
        results.errors++;
        results.details.push(`Analysis not found: ${analysisId}`);
        continue;
      }

      const processResult = await processEmailsIntoActions([analysis.email_id], true);
      results.success += processResult.success;
      results.errors += processResult.errors;
      results.details.push(...processResult.details);
    }
  } catch (error: any) {
    results.errors++;
    results.details.push(`Error: ${error.message}`);
  }

  return results;
};
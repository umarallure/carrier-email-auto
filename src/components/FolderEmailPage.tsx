import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  Mail, 
  RefreshCw, 
  Brain, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  Search,
  Folder,
  FolderOpen,
  Sparkles,
  Filter,
  Users,
  CalendarIcon,
  X
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface CarrierFolder {
  id: string;
  carrier_name: string;
  display_name: string;
  color: string;
  icon: string;
  email_count?: number;
  unanalyzed_count?: number;
}

interface Email {
  id: string;
  carrier: string;
  subject: string;
  body?: string;
  received_date: string;
  status: string;
  carrier_label: string;
  gmail_url?: string;
  folder_id?: string;
  from_email?: string;
}

interface AnalysisResult {
  customer_name: string;
  policy_id: string;
  reason?: string;
  category: string;
  subcategory: string;
  summary: string;
  suggested_action: string;
  review_status: string;
  document_links?: string[] | string | null;
}

export const FolderEmailPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gmailAccessToken, setGmailAccessToken] = useState('');
  const [hasGmailToken, setHasGmailToken] = useState(false);
  const [folders, setFolders] = useState<CarrierFolder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<CarrierFolder | null>(null);
  const [emails, setEmails] = useState<Email[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [subcategoryFilter, setSubcategoryFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [categorizing, setCategorizing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [analyzingEmails, setAnalyzingEmails] = useState<Set<string>>(new Set());
  const [unanalyzedCount, setUnanalyzedCount] = useState(0);
  const [analyzingFolder, setAnalyzingFolder] = useState<string | null>(null);
  
  const EMAILS_PER_PAGE = 50;

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('gmail_access_token');
    const expires = localStorage.getItem('gmail_access_token_expires');
    
    if (token && expires && parseInt(expires) > Date.now()) {
      setGmailAccessToken(token);
      setHasGmailToken(true);
    } else {
      // Clean up expired token
      localStorage.removeItem('gmail_access_token');
      localStorage.removeItem('gmail_access_token_expires');
      setGmailAccessToken('');
      setHasGmailToken(false);
    }
  }, []);
  const getCarrierAnalysisLabel = (carrierName: string, isBatch: boolean = false) => {
    const prefix = isBatch ? 'Batch ' : '';
    const suffix = ' Analysis';
    
    switch (carrierName?.toUpperCase()) {
      case 'ANAM':
        return `${prefix}ANAM${suffix}`;
      case 'COREBRIDGE':
        return `${prefix}COREBRIDGE${suffix}`;
      case 'ROYAL NEIGHBORS OF AMERICA':
      case 'ROYAL NEIGHBORS':
      case 'ROYAL_NEIGHBORS':
        return `${prefix}Royal Neighbors${suffix}`;
      case 'MUTUAL OF OMAHA':
      case 'MUTUAL OMAHA':
      case 'MOH':
        return `${prefix}Mutual of Omaha${suffix}`;
      case 'SBLI':
      case 'SAVINGS BANK LIFE INSURANCE':
        return `${prefix}SBLI${suffix}`;
      case 'GUARANTEE TRUST LIFE':
      case 'GTL':
        return `${prefix}Guarantee Trust Life${suffix}`;
      case 'AETNA':
        return `${prefix}Aetna${suffix}`;
      case 'TRANSAMERICA':
        return `${prefix}Transamerica${suffix}`;
      case 'LIBERTY':
      case 'LIBERTY BANKERS':
        return `${prefix}Liberty Bankers${suffix}`;
      default:
        return `${prefix}${suffix}`.replace('  ', ' ').trim();
    }
  };

  useEffect(() => {
    if (user) {
      fetchFolders();
    }
  }, [user]);

  useEffect(() => {
    if (selectedFolder && user) {
      fetchFolderEmails();
      fetchUnanalyzedCount();
    }
  }, [selectedFolder, currentPage, searchQuery, categoryFilter, subcategoryFilter, dateFilter, user]);

  const fetchFolders = async () => {
    try {
      setLoading(true);
      
      // Fetch folders with email counts
      const { data: foldersData, error: foldersError } = await supabase
        .from('carrier_folders')
        .select('*')
        .eq('is_active', true)
        .order('display_name');

      if (foldersError) throw foldersError;

      // Get email counts and unanalyzed counts for each folder
      const foldersWithCounts = await Promise.all(
        (foldersData || []).map(async (folder) => {
          // Get total email count
          const { count: totalCount } = await supabase
            .from('emails')
            .select('*', { count: 'exact', head: true })
            .eq('folder_id', folder.id);

          // Get all emails in folder for unanalyzed count calculation
          const { data: folderEmails } = await supabase
            .from('emails')
            .select('id')
            .eq('folder_id', folder.id);

          let unanalyzedCount = 0;
          if (folderEmails && folderEmails.length > 0) {
            // Get analyzed email IDs for this folder
            const { data: analyzedEmails } = await supabase
              .from('email_analysis_results')
              .select('email_id')
              .in('email_id', folderEmails.map(email => email.id));
            
            // Calculate unanalyzed count
            const analyzedEmailIds = new Set(analyzedEmails?.map(a => a.email_id) || []);
            unanalyzedCount = folderEmails.filter(email => !analyzedEmailIds.has(email.id)).length;
          }
          
          console.log(`Folder ${folder.display_name}: Total=${totalCount}, Unanalyzed=${unanalyzedCount}`);
          
          return {
            ...folder,
            email_count: totalCount || 0,
            unanalyzed_count: unanalyzedCount || 0
          };
        })
      );

      // Get uncategorized email count
      const { count: uncategorizedEmails } = await supabase
        .from('emails')
        .select('*', { count: 'exact', head: true })
        .is('folder_id', null);
      
      setUncategorizedCount(uncategorizedEmails || 0);
      setFolders(foldersWithCounts);
      
      // Auto-select first folder with emails
      const folderWithEmails = foldersWithCounts.find(f => f.email_count && f.email_count > 0);
      if (folderWithEmails && !selectedFolder) {
        setSelectedFolder(folderWithEmails);
      }

    } catch (error: any) {
      toast({
        title: "Error fetching folders",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnanalyzedCount = async () => {
    if (!selectedFolder) return;
    
    try {
      // Get all emails in the folder
      const { data: allEmails, error: emailsError } = await supabase
        .from('emails')
        .select('id')
        .eq('folder_id', selectedFolder.id);
        
      if (emailsError) throw emailsError;
      
      if (!allEmails || allEmails.length === 0) {
        setUnanalyzedCount(0);
        return;
      }
      
      // Get analyzed email IDs
      const { data: analyzedEmails, error: analyzedError } = await supabase
        .from('email_analysis_results')
        .select('email_id')
        .in('email_id', allEmails.map(email => email.id));
        
      if (analyzedError) throw analyzedError;
      
      // Calculate unanalyzed count
      const analyzedEmailIds = new Set(analyzedEmails?.map(a => a.email_id) || []);
      const unanalyzedEmails = allEmails.filter(email => !analyzedEmailIds.has(email.id));
      
      setUnanalyzedCount(unanalyzedEmails.length);
    } catch (error: any) {
      console.error('Error fetching unanalyzed count:', error);
      setUnanalyzedCount(0);
    }
  };

  const fetchFolderEmails = async () => {
    if (!selectedFolder) return;

    try {
      setLoading(true);
      
      // For search queries, we need to fetch all emails first to filter properly
      if (searchQuery.trim()) {
        const searchTerm = searchQuery.trim().toLowerCase();
        
        // Fetch all emails in the folder (without pagination for search)
        const emailQuery = (supabase as any)
          .from("emails")
          .select("id, subject, received_date, carrier, carrier_label, gmail_id, status, created_at, updated_at, user_id")
          .eq('folder_id', selectedFolder.id)
          .order("received_date", { ascending: false });
        
        const { data: allEmails, error: allEmailsError } = await emailQuery;

        if (allEmailsError) throw allEmailsError;

        // Fetch all analysis results for these emails
        const allEmailIds = allEmails?.map((email: any) => email.id) || [];
        const { data: allAnalysis, error: allAnalysisError } = await supabase
          .from("email_analysis_results")
          .select("email_id, customer_name, policy_id, category, subcategory, summary, suggested_action")
          .in('email_id', allEmailIds);

        if (allAnalysisError) throw allAnalysisError;

        // Combine emails with analysis
        const emailsWithAnalysis = allEmails?.map((email: any) => ({
          ...email,
          email_analysis_results: allAnalysis?.filter((analysis: any) => analysis.email_id === email.id) || []
        })) || [];

        // Filter by search term and filters
        let filteredEmails = emailsWithAnalysis.filter((email: any) => {
          // Search in email fields
          const emailMatch = searchQuery.trim() === "" || 
            email.subject.toLowerCase().includes(searchTerm) ||
            email.received_date.toLowerCase().includes(searchTerm);
          
          // Search in analysis fields
          const analysis = email.email_analysis_results?.[0];
          const analysisMatch = searchQuery.trim() === "" || (analysis && (
            (analysis.customer_name && analysis.customer_name.toLowerCase().includes(searchTerm)) ||
            (analysis.policy_id && analysis.policy_id.toLowerCase().includes(searchTerm)) ||
            (analysis.category && analysis.category.toLowerCase().includes(searchTerm)) ||
            (analysis.subcategory && analysis.subcategory.toLowerCase().includes(searchTerm)) ||
            (analysis.summary && analysis.summary.toLowerCase().includes(searchTerm)) ||
            (analysis.suggested_action && analysis.suggested_action.toLowerCase().includes(searchTerm))
          ));

          // Apply category filter
          const categoryMatch = !categoryFilter || (analysis && analysis.category === categoryFilter);
          
          // Apply subcategory filter
          const subcategoryMatch = !subcategoryFilter || (analysis && analysis.subcategory === subcategoryFilter);
          
          // Apply date filter
          const dateMatch = !dateFilter || 
            new Date(email.received_date).toDateString() === dateFilter.toDateString();
          
          return (emailMatch || analysisMatch) && categoryMatch && subcategoryMatch && dateMatch;
        });

        // Apply pagination to filtered results
        const from = (currentPage - 1) * EMAILS_PER_PAGE;
        const to = Math.min(from + EMAILS_PER_PAGE, filteredEmails.length);
        const paginatedEmails = filteredEmails.slice(from, to);
        
        // Create analysis results map for the search results
        const resultsMap: Record<string, AnalysisResult> = {};
        paginatedEmails.forEach((email: any) => {
          const analysis = email.email_analysis_results?.[0];
          if (analysis) {
            resultsMap[email.id] = analysis;
          }
        });
        
        setEmails(paginatedEmails);
        setAnalysisResults(resultsMap);
        setTotalEmails(filteredEmails.length);
        setLoading(false);
        return;
      }

      // For non-search queries, use simple pagination
      const from = (currentPage - 1) * EMAILS_PER_PAGE;
      const to = from + EMAILS_PER_PAGE - 1;
      
      const { data: emailsData, error: emailsError, count } = await ((supabase as any)
        .from("emails")
        .select("id, subject, received_date, carrier, carrier_label, gmail_id, status, created_at, updated_at, user_id", { count: 'exact' })
        .eq('folder_id', selectedFolder.id)
        .order("received_date", { ascending: false })
        .range(from, to));

      if (emailsError) throw emailsError;

      // Fetch analysis results for these emails
      const paginatedEmailIds = emailsData?.map((email: any) => email.id) || [];
      const { data: analysisData, error: analysisError } = await supabase
        .from("email_analysis_results")
        .select("email_id, customer_name, policy_id, category, subcategory, summary, suggested_action")
        .in('email_id', paginatedEmailIds);

      if (analysisError) throw analysisError;

      // Combine emails with their analysis results
      const emailsWithAnalysis = emailsData?.map((email: any) => ({
        ...email,
        email_analysis_results: analysisData?.filter((analysis: any) => analysis.email_id === email.id) || []
      })) || [];

      // Apply filters client-side
      let filteredEmails = emailsWithAnalysis;
      if (categoryFilter || subcategoryFilter || dateFilter) {
        filteredEmails = emailsWithAnalysis.filter((email: any) => {
          const analysis = email.email_analysis_results?.[0];
          
          // Apply category filter
          const categoryMatch = !categoryFilter || (analysis && analysis.category === categoryFilter);
          
          // Apply subcategory filter
          const subcategoryMatch = !subcategoryFilter || (analysis && analysis.subcategory === subcategoryFilter);
          
          // Apply date filter
          const dateMatch = !dateFilter || 
            new Date(email.received_date).toDateString() === dateFilter.toDateString();
          
          return categoryMatch && subcategoryMatch && dateMatch;
        });
      }

      setEmails(filteredEmails);
      setTotalEmails(filteredEmails.length);
      
      // Create analysis results map from the combined data
      const resultsMap: Record<string, AnalysisResult> = {};
      filteredEmails.forEach((email: any) => {
        const analysis = email.email_analysis_results?.[0];
        if (analysis) {
          resultsMap[email.id] = analysis;
        }
      });
      setAnalysisResults(resultsMap);
      setLoading(false);

    } catch (error: any) {
      toast({
        title: "Error fetching emails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCategorizeEmails = async () => {
    try {
      setCategorizing(true);
      
      const { data, error } = await supabase.functions.invoke('categorize-emails', {
        body: { 
          batch_size: 100,
          force_recategorize: false  // Only process uncategorized emails
        }
      });

      if (error) throw error;

      toast({
        title: "Email Categorization Complete",
        description: `Successfully categorized ${data.categorized_count} emails. ${data.error_count} errors occurred.`,
      });

      // Refresh folders and current view
      await fetchFolders();
      if (selectedFolder) {
        await fetchFolderEmails();
      }
      
    } catch (error: any) {
      toast({
        title: "Categorization Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCategorizing(false);
    }
  };

  const handleFolderBatchAnalysis = async (folder: CarrierFolder) => {
    if (!folder) {
      console.error('No folder provided for batch analysis');
      return;
    }
    
    console.log('Starting batch analysis for folder:', folder.display_name);
    
    try {
      setAnalyzingFolder(folder.id);
      
      // First, let's get all emails in the folder
      const { data: allFolderEmails, error: allEmailsError } = await supabase
        .from('emails')
        .select('id, subject, carrier_label')
        .eq('folder_id', folder.id);
      
      if (allEmailsError) {
        console.error('Error fetching all emails:', allEmailsError);
        throw allEmailsError;
      }
      
      console.log(`Total emails in ${folder.display_name} folder: ${allFolderEmails?.length || 0}`);
      
      // Get emails that already have analysis results
      const { data: analyzedEmails, error: analyzedError } = await supabase
        .from('email_analysis_results')
        .select('email_id')
        .in('email_id', allFolderEmails?.map(e => e.id) || []);
      
      if (analyzedError) {
        console.error('Error fetching analyzed emails:', analyzedError);
        throw analyzedError;
      }
      
      console.log(`Already analyzed emails in ${folder.display_name}: ${analyzedEmails?.length || 0}`);
      
      // Filter out emails that already have analysis
      const analyzedEmailIds = new Set(analyzedEmails?.map(a => a.email_id) || []);
      const unanalyzedEmails = allFolderEmails?.filter(email => !analyzedEmailIds.has(email.id)) || [];
      
      console.log(`Unanalyzed emails in ${folder.display_name}: ${unanalyzedEmails.length}`);

      if (unanalyzedEmails.length === 0) {
        toast({
          title: "No Emails to Analyze",
          description: `All emails in ${folder.display_name} have already been analyzed.`,
        });
        setAnalyzingFolder(null);
        return;
      }

      // Limit to 20 emails for batch processing
      const emailsToProcess = unanalyzedEmails.slice(0, 20);
      console.log(`Processing ${emailsToProcess.length} emails (max 20) from ${folder.display_name}`);

      // Determine which function to use based on carrier
      let functionName = 'analyze-email-generic';
      const carrierName = folder.carrier_name.toUpperCase();
      console.log('Determining function for carrier:', carrierName);
      
      switch (carrierName) {
        case 'ANAM':
          functionName = 'analyze-email-anam';
          break;
        case 'COREBRIDGE':
          functionName = 'analyze-email-corebridge';
          break;
        case 'ROYAL NEIGHBORS OF AMERICA':
        case 'ROYAL NEIGHBORS':
        case 'ROYAL_NEIGHBORS':
          functionName = 'analyze-email-royal-neighbors';
          break;
        case 'MUTUAL OF OMAHA':
        case 'MUTUAL OMAHA':
        case 'MOH':
          functionName = 'analyze-email-mutual-omaha';
          break;
        case 'SBLI':
        case 'SAVINGS BANK LIFE INSURANCE':
          functionName = 'analyze-email-sbli';
          break;
        case 'GUARANTEE TRUST LIFE':
        case 'GTL':
          functionName = 'analyze-email-guarantee-trust';
          break;
        case 'AETNA':
          functionName = 'analyze-email-aetna';
          break;
        case 'TRANSAMERICA':
          functionName = 'analyze-email-transamerica';
          break;
        case 'LIBERTY':
        case 'LIBERTY BANKERS':
          functionName = 'analyze-email-liberty-bankers';
          break;
        default:
          functionName = 'analyze-email-generic';
          break;
      }
      
      console.log('Selected function name:', functionName);

      let successCount = 0;
      let errorCount = 0;

      // Process emails one by one
      for (let i = 0; i < emailsToProcess.length; i++) {
        const email = emailsToProcess[i];
        try {
          console.log(`Processing email ${i + 1}/${emailsToProcess.length}: ${email.subject}`);
          
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke(functionName, {
            body: { 
              email_id: email.id,
              force_reprocess: false
            }
          });

          if (analysisError) {
            console.error(`Error analyzing email ${email.id}:`, analysisError);
            errorCount++;
          } else {
            console.log(`Successfully analyzed email ${email.id}`);
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to analyze email ${email.id}:`, error);
          errorCount++;
        }

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const totalProcessed = successCount + errorCount;
      toast({
        title: `${folder.display_name} Analysis Complete`,
        description: `Processed ${totalProcessed} emails: ${successCount} successful, ${errorCount} failed.`,
      });

      // Refresh the email list and folder counts
      await fetchFolders();
      if (selectedFolder?.id === folder.id) {
        await fetchFolderEmails();
        await fetchUnanalyzedCount();
      }
      
    } catch (error: any) {
      console.error('Batch analysis error:', error);
      toast({
        title: "Batch Analysis Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setAnalyzingFolder(null);
    }
  };

  const handleBatchAnalysis = async () => {
    if (!selectedFolder) {
      console.error('No folder selected for batch analysis');
      return;
    }
    
    console.log('Starting batch analysis for folder:', selectedFolder.display_name);
    
    try {
      setCategorizing(true);
      
      // First, let's get all emails in the folder to debug
      const { data: allFolderEmails, error: allEmailsError } = await supabase
        .from('emails')
        .select('id, subject, carrier_label')
        .eq('folder_id', selectedFolder.id);
      
      if (allEmailsError) {
        console.error('Error fetching all emails:', allEmailsError);
        throw allEmailsError;
      }
      
      console.log(`Total emails in folder: ${allFolderEmails?.length || 0}`);
      
      // Get emails that already have analysis results
      const { data: analyzedEmails, error: analyzedError } = await supabase
        .from('email_analysis_results')
        .select('email_id')
        .in('email_id', allFolderEmails?.map(e => e.id) || []);
      
      if (analyzedError) {
        console.error('Error fetching analyzed emails:', analyzedError);
        throw analyzedError;
      }
      
      console.log(`Already analyzed emails: ${analyzedEmails?.length || 0}`);
      
      // Filter out emails that already have analysis
      const analyzedEmailIds = new Set(analyzedEmails?.map(a => a.email_id) || []);
      const unanalyzedEmails = allFolderEmails?.filter(email => !analyzedEmailIds.has(email.id)) || [];
      
      console.log(`Unanalyzed emails found: ${unanalyzedEmails.length}`);

      if (unanalyzedEmails.length === 0) {
        toast({
          title: "No Emails to Analyze",
          description: "All emails in this folder have already been analyzed.",
        });
        setCategorizing(false);
        return;
      }

      if (!unanalyzedEmails || unanalyzedEmails.length === 0) {
        toast({
          title: "No Emails to Analyze",
          description: "All emails in this folder have already been analyzed.",
        });
        setCategorizing(false);
        return;
      }

      // Limit to 20 emails for batch processing
      const emailsToProcess = unanalyzedEmails.slice(0, 20);
      console.log(`Processing ${emailsToProcess.length} emails (max 20) in ${selectedFolder.display_name} folder`);

      // Determine which function to use
      let functionName = 'analyze-email-generic';
      const carrierName = selectedFolder.carrier_name.toUpperCase();
      console.log('Determining function for carrier:', carrierName);
      
      switch (carrierName) {
        case 'ANAM':
          functionName = 'analyze-email-anam';
          break;
        case 'COREBRIDGE':
          functionName = 'analyze-email-corebridge';
          break;
        case 'ROYAL NEIGHBORS OF AMERICA':
        case 'ROYAL NEIGHBORS':
        case 'ROYAL_NEIGHBORS':
          functionName = 'analyze-email-royal-neighbors';
          break;
        case 'MUTUAL OF OMAHA':
        case 'MUTUAL OMAHA':
        case 'MOH':
          functionName = 'analyze-email-mutual-omaha';
          break;
        case 'SBLI':
        case 'SAVINGS BANK LIFE INSURANCE':
          functionName = 'analyze-email-sbli';
          break;
        case 'GUARANTEE TRUST LIFE':
        case 'GTL':
          functionName = 'analyze-email-guarantee-trust';
          break;
        case 'AETNA':
          functionName = 'analyze-email-aetna';
          break;
        case 'TRANSAMERICA':
          functionName = 'analyze-email-transamerica';
          break;
        case 'LIBERTY':
        case 'LIBERTY BANKERS':
          functionName = 'analyze-email-liberty-bankers';
          break;
        default:
          functionName = 'analyze-email-generic';
          break;
      }
      
      console.log('Selected function name:', functionName);

      console.log(`Starting batch analysis with ${functionName} for ${emailsToProcess.length} emails`);

      let successCount = 0;
      let errorCount = 0;

      // Process emails one by one to avoid overwhelming the API
      for (let i = 0; i < emailsToProcess.length; i++) {
        const email = emailsToProcess[i];
        try {
          console.log(`Processing email ${i + 1}/${emailsToProcess.length}: ${email.subject}`);
          
          console.log(`Invoking function: ${functionName} for email: ${email.id}`);
          
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke(functionName, {
            body: { 
              email_id: email.id,
              force_reprocess: false
            }
          });

          if (analysisError) {
            console.error(`Error analyzing email ${email.id}:`, analysisError);
            console.error('Full error details:', JSON.stringify(analysisError, null, 2));
            errorCount++;
          } else {
            console.log(`Successfully analyzed email ${email.id}`);
            console.log('Analysis result:', analysisData);
            successCount++;
          }
        } catch (error) {
          console.error(`Failed to analyze email ${email.id}:`, error);
          console.error('Error details:', JSON.stringify(error, null, 2));
          errorCount++;
        }

        // Small delay to prevent rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const totalProcessed = successCount + errorCount;
      toast({
        title: "Batch Analysis Complete",
        description: `Processed ${totalProcessed} emails: ${successCount} successful, ${errorCount} failed.`,
      });

      // Refresh the email list and unanalyzed count to show updated analysis results
      await fetchFolderEmails();
      await fetchUnanalyzedCount();
      
    } catch (error: any) {
      console.error('Batch analysis error:', error);
      toast({
        title: "Batch Analysis Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setCategorizing(false);
    }
  };

  const handleSingleAnalysis = async (emailId: string, email: Email) => {
    try {
      // Add email to analyzing set
      setAnalyzingEmails(prev => new Set(prev).add(emailId));
      
      // Determine which function to call based on the folder carrier
      let functionName = 'analyze-email-generic'; // Default fallback
      
      if (selectedFolder) {
        switch (selectedFolder.carrier_name.toUpperCase()) {
          case 'ANAM':
            functionName = 'analyze-email-anam';
            break;
          case 'COREBRIDGE':
            functionName = 'analyze-email-corebridge';
            break;
          case 'ROYAL NEIGHBORS OF AMERICA':
          case 'ROYAL NEIGHBORS':
          case 'ROYAL_NEIGHBORS':
            functionName = 'analyze-email-royal-neighbors';
            break;
          case 'MUTUAL OF OMAHA':
          case 'MUTUAL OMAHA':
          case 'MOH':
            functionName = 'analyze-email-mutual-omaha';
            break;
          case 'SBLI':
          case 'SAVINGS BANK LIFE INSURANCE':
            functionName = 'analyze-email-sbli';
            break;
          case 'GUARANTEE TRUST LIFE':
          case 'GTL':
            functionName = 'analyze-email-guarantee-trust';
            break;
          case 'AETNA':
            functionName = 'analyze-email-aetna';
            break;
          case 'TRANSAMERICA':
            functionName = 'analyze-email-transamerica';
            break;
          case 'LIBERTY':
          case 'LIBERTY BANKERS':
            functionName = 'analyze-email-liberty-bankers';
            break;
          default:
            functionName = 'analyze-email-generic';
            break;
        }
      }

      console.log(`Calling ${functionName} for email ${emailId} in folder ${selectedFolder?.carrier_name}`);

      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { 
          email_id: emailId,
          force_reprocess: false
        }
      });

      if (error) {
        console.error(`Error from ${functionName}:`, error);
        throw error;
      }

      toast({
        title: "Analysis Complete",
        description: `${selectedFolder?.carrier_name || 'Email'} analysis completed successfully`,
      });

      await fetchFolderEmails();
      await fetchUnanalyzedCount();
      
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast({
        title: "Analysis Failed",
        description: error.message || 'Unknown error occurred',
        variant: "destructive",
      });
    } finally {
      // Remove email from analyzing set
      setAnalyzingEmails(prev => {
        const newSet = new Set(prev);
        newSet.delete(emailId);
        return newSet;
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed": return "default";
      case "processing": return "secondary";
      case "failed": return "destructive";
      default: return "outline";
    }
  };

  const getCategoryBadgeVariant = (category: string) => {
    switch (category) {
      case "Failed payment": return "destructive";
      case "Cancelled policy": return "destructive";
      case "Pending": return "secondary";
      default: return "default";
    }
  };

  const totalPages = Math.ceil(totalEmails / EMAILS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Carrier Folders</h1>
          <p className="text-muted-foreground">
            Organize emails by insurance carriers with AI-powered categorization
          </p>
          {uncategorizedCount > 0 && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-sm">
                {uncategorizedCount} emails ready for categorization
              </Badge>
            </div>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={handleCategorizeEmails}
            disabled={categorizing || uncategorizedCount === 0}
            className="flex items-center space-x-2"
          >
            <Sparkles className="h-4 w-4" />
            <span>
              {categorizing 
                ? "Categorizing..." 
                : uncategorizedCount > 0 
                  ? `Categorize ${uncategorizedCount} Emails` 
                  : "All Emails Categorized"
              }
            </span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Folders Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Folder className="h-5 w-5" />
                <span>Carrier Folders</span>
              </CardTitle>
              <CardDescription>
                Click a folder to view emails
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1">
                {folders.map((folder) => (
                  <div key={folder.id} className={`border-l-4 ${
                    selectedFolder?.id === folder.id
                      ? 'bg-muted border-l-primary'
                      : 'border-l-transparent'
                  }`}>
                    <button
                      onClick={() => {
                        setSelectedFolder(folder);
                        setCurrentPage(1);
                      }}
                      className="w-full text-left p-3 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          {selectedFolder?.id === folder.id ? (
                            <FolderOpen className="h-4 w-4" style={{ color: folder.color }} />
                          ) : (
                            <Folder className="h-4 w-4" style={{ color: folder.color }} />
                          )}
                          <span className="font-medium text-sm">{folder.display_name}</span>
                        </div>
                        <div className="flex space-x-1">
                          {folder.email_count ? (
                            <Badge variant="secondary" className="text-xs">
                              {folder.email_count}
                            </Badge>
                          ) : null}
                          {folder.unanalyzed_count && folder.unanalyzed_count > 0 ? (
                            <Badge variant="destructive" className="text-xs">
                              {folder.unanalyzed_count} unanalyzed
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Email List */}
        <div className="lg:col-span-3">
          {selectedFolder ? (
            <Card>
              <CardHeader className="space-y-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center space-x-2">
                        <Folder className="h-5 w-5" style={{ color: selectedFolder.color }} />
                        <span>{selectedFolder.display_name}</span>
                        {(searchQuery || categoryFilter || subcategoryFilter || dateFilter) && (
                          <Badge variant="secondary" className="text-xs">
                            {[searchQuery, categoryFilter, subcategoryFilter, dateFilter].filter(Boolean).length} filter{[searchQuery, categoryFilter, subcategoryFilter, dateFilter].filter(Boolean).length !== 1 ? 's' : ''} active
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {totalEmails} emails in this folder
                      </CardDescription>
                    </div>
                    <Button
                      onClick={() => {
                        console.log('Batch analysis button clicked');
                        console.log('Selected folder:', selectedFolder?.display_name);
                        console.log('Unanalyzed count:', unanalyzedCount);
                        console.log('Categorizing state:', categorizing);
                        handleBatchAnalysis();
                      }}
                      disabled={categorizing || unanalyzedCount === 0}
                      variant="outline"
                      className="flex items-center space-x-2 whitespace-nowrap"
                    >
                      <Brain className="h-4 w-4" />
                      <span>
                        {categorizing ? "Analyzing..." : unanalyzedCount > 0 
                          ? `${getCarrierAnalysisLabel(selectedFolder?.carrier_name || '', true)} (${Math.min(unanalyzedCount, 20)})` 
                          : "All Analyzed"
                        }
                      </span>
                    </Button>
                  </div>
                  
                  {/* Filters Row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[280px] max-w-md">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by subject, customer, policy ID..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="pl-8"
                      />
                    </div>
                    
                    {/* Category Filter */}
                    <Select value={categoryFilter || "all"} onValueChange={(value) => {
                      const newValue = value === "all" ? "" : value;
                      setCategoryFilter(newValue);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="Failed payment">Failed payment</SelectItem>
                        <SelectItem value="Cancelled policy">Cancelled policy</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Policy inquiry">Policy inquiry</SelectItem>
                        <SelectItem value="Claim submitted">Claim submitted</SelectItem>
                        <SelectItem value="Payment confirmation">Payment confirmation</SelectItem>
                        <SelectItem value="Policy update">Policy update</SelectItem>
                        <SelectItem value="Document request">Document request</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Subcategory Filter */}
                    <Select value={subcategoryFilter || "all"} onValueChange={(value) => {
                      const newValue = value === "all" ? "" : value;
                      setSubcategoryFilter(newValue);
                      setCurrentPage(1);
                    }}>
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Subcategory" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Subcategories</SelectItem>
                        <SelectItem value="Premium due">Premium due</SelectItem>
                        <SelectItem value="Payment method">Payment method</SelectItem>
                        <SelectItem value="Bank account">Bank account</SelectItem>
                        <SelectItem value="Credit card">Credit card</SelectItem>
                        <SelectItem value="Policy lapse">Policy lapse</SelectItem>
                        <SelectItem value="Reinstatement">Reinstatement</SelectItem>
                        <SelectItem value="Coverage inquiry">Coverage inquiry</SelectItem>
                        <SelectItem value="Beneficiary update">Beneficiary update</SelectItem>
                        <SelectItem value="Address change">Address change</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Date Filter */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-36 justify-start text-left font-normal ${
                            !dateFilter && "text-muted-foreground"
                          }`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFilter ? format(dateFilter, "MMM d") : "Date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFilter}
                          onSelect={(date) => {
                            setDateFilter(date);
                            setCurrentPage(1);
                          }}
                          initialFocus
                        />
                        {dateFilter && (
                          <div className="p-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setDateFilter(undefined);
                                setCurrentPage(1);
                              }}
                              className="w-full"
                            >
                              <X className="mr-2 h-4 w-4" />
                              Clear date
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                    
                    {/* Clear Filters Button */}
                    {(searchQuery || categoryFilter || subcategoryFilter || dateFilter) && (
                      <Button
                        onClick={() => {
                          setSearchQuery("");
                          setCategoryFilter("");
                          setSubcategoryFilter("");
                          setDateFilter(undefined);
                          setCurrentPage(1);
                        }}
                        variant="ghost"
                        size="sm"
                        className="flex items-center space-x-1 whitespace-nowrap"
                      >
                        <X className="h-4 w-4" />
                        <span>Clear</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                      <p>Loading emails...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Subject</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Policy ID</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Subcategory</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {emails.map((email) => {
                          const analysis = analysisResults[email.id];
                          return (
                            <TableRow key={email.id}>
                              <TableCell className="max-w-[300px] truncate">
                                {email.subject}
                              </TableCell>
                              <TableCell>
                                {analysis?.customer_name || "Not analyzed"}
                              </TableCell>
                              <TableCell>
                                <div className="max-w-[120px] break-words text-xs">
                                  {analysis?.policy_id || "Not analyzed"}
                                </div>
                              </TableCell>
                              <TableCell>
                                {analysis?.category ? (
                                  <Badge variant={getCategoryBadgeVariant(analysis.category)}>
                                    {analysis.category}
                                  </Badge>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {analysis?.subcategory ? (
                                  <span className="text-sm text-muted-foreground">
                                    {analysis.subcategory}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell>
                                {new Date(email.received_date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center space-x-2">
                                  {!analysis && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSingleAnalysis(email.id, email)}
                                      disabled={analyzingEmails.has(email.id)}
                                      className="flex items-center space-x-1"
                                    >
                                      {analyzingEmails.has(email.id) ? (
                                        <>
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                          <span>Analyzing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Brain className="h-3 w-3" />
                                          <span>
                                            {getCarrierAnalysisLabel(selectedFolder?.carrier_name || '')}
                                          </span>
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {analysis && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleSingleAnalysis(email.id, email)}
                                      disabled={analyzingEmails.has(email.id)}
                                      className="flex items-center space-x-1 text-xs"
                                    >
                                      {analyzingEmails.has(email.id) ? (
                                        <>
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                          <span>Re-analyzing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3" />
                                          <span>Re-analyze</span>
                                        </>
                                      )}
                                    </Button>
                                  )}
                                  {email.gmail_url && (
                                    <Button size="sm" variant="outline" asChild>
                                      <a href={email.gmail_url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-3 w-3 mr-1" />
                                        Gmail
                                      </a>
                                    </Button>
                                  )}
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setSelectedEmail(email)}
                                      >
                                        View
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                      <DialogHeader>
                                        <DialogTitle className="flex items-center space-x-2">
                                          <span>Email Details</span>
                                          {analysis && (
                                            <Badge variant={getCategoryBadgeVariant(analysis.category)}>
                                              {analysis.category}
                                            </Badge>
                                          )}
                                        </DialogTitle>
                                        <DialogDescription>
                                          {email.subject}
                                        </DialogDescription>
                                      </DialogHeader>
                                      <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div>
                                            <Label>From</Label>
                                            <p className="text-sm break-words">{email.from_email}</p>
                                          </div>
                                          <div>
                                            <Label>Carrier Folder</Label>
                                            <div className="flex items-center space-x-2">
                                              <Folder className="h-4 w-4" style={{ color: selectedFolder?.color }} />
                                              <span className="text-sm">{selectedFolder?.display_name}</span>
                                            </div>
                                          </div>
                                          <div>
                                            <Label>Status</Label>
                                            <Badge variant={getStatusBadgeVariant(email.status)}>
                                              {email.status}
                                            </Badge>
                                          </div>
                                          <div>
                                            <Label>Received Date</Label>
                                            <p className="text-sm">{new Date(email.received_date).toLocaleString()}</p>
                                          </div>
                                          {analysis && (
                                            <>
                                              <div>
                                                <Label>Customer</Label>
                                                <p className="text-sm">{analysis.customer_name || 'Not specified'}</p>
                                              </div>
                                              <div>
                                                <Label>Policy ID</Label>
                                                <p className="text-sm">{analysis.policy_id || 'Not specified'}</p>
                                              </div>
                                            </>
                                          )}
                                        </div>
                                        
                                        {/* Email Body */}
                                        {email.body && (
                                          <div className="mt-4">
                                            <Label>Email Body</Label>
                                            <div className="mt-2 p-4 border rounded-lg bg-gray-50 max-h-64 overflow-y-auto">
                                              <pre className="text-sm whitespace-pre-wrap break-words">
                                                {email.body}
                                              </pre>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {analysis && (
                                          <>
                                            <div>
                                              <Label>Summary</Label>
                                              <p className="text-sm mt-1">{analysis.summary}</p>
                                            </div>
                                            <div>
                                              <Label>Suggested Action</Label>
                                              <p className="text-sm mt-1">{analysis.suggested_action}</p>
                                            </div>
                                            {analysis.reason && (
                                              <div>
                                                <Label>Reason</Label>
                                                <p className="text-sm mt-1">{analysis.reason}</p>
                                              </div>
                                            )}
                                            {analysis.subcategory && (
                                              <div>
                                                <Label>Subcategory</Label>
                                                <Badge variant="outline" className="mt-1">
                                                  {analysis.subcategory}
                                                </Badge>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                    
                    {/* Pagination */}
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {Math.min((currentPage - 1) * EMAILS_PER_PAGE + 1, totalEmails)} - {Math.min(currentPage * EMAILS_PER_PAGE, totalEmails)} of {totalEmails} emails
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {currentPage} of {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center p-8">
                <div className="text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-medium mb-2">Select a Folder</h3>
                  <p className="text-muted-foreground mb-4">
                    Choose a carrier folder from the sidebar to view emails
                  </p>
                  {folders.length === 0 && (
                    <Button onClick={handleCategorizeEmails} disabled={categorizing}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start AI Categorization
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Mail, Filter, RefreshCw, Brain, Download, Play, TestTube, Loader2, Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TestEmailProcessor from "@/components/TestEmailProcessor";
import GmailAuth from "@/components/GmailAuth";

interface Email {
  id: string;
  carrier: string;
  subject: string;
  received_date: string;
  status: string;
  carrier_label: string;
  gmail_url?: string;
  attachments?: string[];
  pdf_extracted_content?: string;
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
  pdf_analysis?: any[];
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [gmailAccessToken, setGmailAccessToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  const [emails, setEmails] = useState<Email[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [loading, setLoading] = useState(true);
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [customDateFrom, setCustomDateFrom] = useState<string>("");
  const [customDateTo, setCustomDateTo] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalEmails, setTotalEmails] = useState(0);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  
  const EMAILS_PER_PAGE = 50;

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('gmail_access_token');
    const expires = localStorage.getItem('gmail_access_token_expires');
    
    if (token && expires && parseInt(expires) > Date.now()) {
      setGmailAccessToken(token);
    } else {
      // Clean up expired token
      localStorage.removeItem('gmail_access_token');
      localStorage.removeItem('gmail_access_token_expires');
      setGmailAccessToken('');
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user, currentPage, carrierFilter, statusFilter, categoryFilter, searchQuery, dateFilter, customDateFrom, customDateTo]); // Refetch when filters or page changes

  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching emails with filters...', { 
        page: currentPage, 
        carrierFilter, 
        statusFilter, 
        categoryFilter, 
        searchQuery,
        dateFilter,
        customDateFrom,
        customDateTo
      });
      
      // Build the query for emails with pagination
      let emailQuery = supabase
        .from("emails")
        .select("*", { count: 'exact' })
        .order("received_date", { ascending: false });

      // Apply carrier filter
      if (carrierFilter !== "all") {
        emailQuery = emailQuery.eq("carrier_label", carrierFilter);
      }

      // Apply status filter
      if (statusFilter !== "all") {
        emailQuery = emailQuery.eq("status", statusFilter);
      }

      // Apply date filter
      if (dateFilter !== "all") {
        const now = new Date();
        let fromDate: Date;
        
        switch (dateFilter) {
          case "today":
            fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            emailQuery = emailQuery.gte("received_date", fromDate.toISOString());
            break;
          case "yesterday":
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
            const yesterdayEnd = new Date(yesterdayStart);
            yesterdayEnd.setDate(yesterdayEnd.getDate() + 1);
            emailQuery = emailQuery
              .gte("received_date", yesterdayStart.toISOString())
              .lt("received_date", yesterdayEnd.toISOString());
            break;
          case "last7days":
            fromDate = new Date(now);
            fromDate.setDate(fromDate.getDate() - 7);
            emailQuery = emailQuery.gte("received_date", fromDate.toISOString());
            break;
          case "last30days":
            fromDate = new Date(now);
            fromDate.setDate(fromDate.getDate() - 30);
            emailQuery = emailQuery.gte("received_date", fromDate.toISOString());
            break;
          case "custom":
            if (customDateFrom) {
              emailQuery = emailQuery.gte("received_date", new Date(customDateFrom).toISOString());
            }
            if (customDateTo) {
              const toDate = new Date(customDateTo);
              toDate.setDate(toDate.getDate() + 1); // Include the entire day
              emailQuery = emailQuery.lt("received_date", toDate.toISOString());
            }
            break;
        }
      }

      // Apply pagination
      const from = (currentPage - 1) * EMAILS_PER_PAGE;
      const to = from + EMAILS_PER_PAGE - 1;
      emailQuery = emailQuery.range(from, to);

      const { data: emailsData, error: emailsError, count } = await emailQuery;

      if (emailsError) throw emailsError;

      setEmails(emailsData || []);
      setTotalEmails(count || 0);

      // Fetch analysis results for the current page emails
      const emailIds = emailsData?.map(email => email.id) || [];
      
      if (emailIds.length > 0) {
        let analysisQuery = supabase
          .from("email_analysis_results")
          .select("*")
          .in("email_id", emailIds);

        // Apply category filter to analysis results
        if (categoryFilter !== "all") {
          analysisQuery = analysisQuery.eq("category", categoryFilter);
        }

        const { data: resultsData, error: resultsError } = await analysisQuery;

        if (resultsError) throw resultsError;

        // Create a map of email_id to analysis result
        const resultsMap: Record<string, AnalysisResult> = {};
        resultsData?.forEach((result) => {
          resultsMap[result.email_id] = result;
        });
        setAnalysisResults(resultsMap);

        // If category filter is applied, filter emails that have matching analysis
        if (categoryFilter !== "all" && emailsData) {
          const filteredEmails = emailsData.filter(email => resultsMap[email.id]);
          setEmails(filteredEmails);
        }
      }

    } catch (error: any) {
      toast({
        title: "Error fetching data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGmailSync = async () => {
    if (!gmailAccessToken) {
      toast({
        title: "Error",
        description: "Please enter a Gmail access token",
        variant: "destructive",
      });
      return;
    }

    // Basic token validation
    if (gmailAccessToken.length < 50) {
      toast({
        title: "Error",
        description: "Gmail access token appears to be invalid (too short)",
        variant: "destructive",
      });
      return;
    }

    try {
      setGmailSyncing(true);
      
      console.log('Calling test-gmail-sync function with token:', gmailAccessToken.substring(0, 20) + '...');
      
      const { data, error } = await supabase.functions.invoke('test-gmail-sync', {
        body: { 
          access_token: gmailAccessToken,
          carrier_filter: carrierFilter !== "all" ? carrierFilter : undefined
        }
      });

      console.log('Gmail sync response:', { data, error });

      if (error) {
        console.error('Gmail sync error details:', error);
        throw new Error(`Gmail sync failed: ${error.message || JSON.stringify(error)}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Unknown error occurred during Gmail sync');
      }

      toast({
        title: "Gmail Sync Complete",
        description: `Successfully synced ${data.emails_synced} emails (${data.duplicates_skipped} duplicates skipped)`,
      });

      // Don't automatically refresh - let user manually refresh if needed
      // await fetchEmails();
      
    } catch (error: any) {
      console.error('Gmail sync error:', error);
      toast({
        title: "Gmail Sync Failed",
        description: error.message || "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleBatchAnalysis = async () => {
    try {
      setAnalyzing(true);
      
      const { data, error } = await supabase.functions.invoke('batch-analyze', {
        body: { 
          carrier_filter: carrierFilter !== "all" ? carrierFilter : undefined,
          limit: 10
        }
      });

      if (error) throw error;

      toast({
        title: "Batch Analysis Complete",
        description: `Processed ${data.success_count} emails successfully, ${data.error_count} errors`,
      });

      // Refresh the data
      await fetchEmails();
      
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSingleAnalysis = async (emailId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-email', {
        body: { 
          email_id: emailId,
          force_reprocess: false
        }
      });

      if (error) throw error;

      toast({
        title: "Analysis Complete",
        description: "Email analyzed successfully",
      });

      // Refresh the data
      await fetchEmails();
      
    } catch (error: any) {
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredEmails = emails.filter((email) => {
    // Search functionality - search in subject, customer name, and policy ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const analysis = analysisResults[email.id];
      
      const matchesSubject = email.subject.toLowerCase().includes(query);
      const matchesCustomer = analysis?.customer_name?.toLowerCase().includes(query) || false;
      const matchesPolicyId = analysis?.policy_id?.toLowerCase().includes(query) || false;
      
      if (!matchesSubject && !matchesCustomer && !matchesPolicyId) {
        return false;
      }
    }
    
    return true; // Other filters are applied at the database level
  });

  const availableCarriers = [...new Set(emails.map(e => e.carrier_label))].sort();
  const availableCategories = [...new Set(Object.values(analysisResults).map(r => r.category))].filter(Boolean).sort();

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

  const fetchAnamDocument = async (documentUrl: string, policyId?: string, customerName?: string) => {
    try {
      console.log('Fetching ANAM document:', documentUrl);
      
      // Show loading toast
      const loadingToast = toast({
        title: "Fetching Document",
        description: "Analyzing ANAM document, please wait...",
      });

      const { data, error } = await supabase.functions.invoke('fetch-anam-document', {
        body: { 
          document_url: documentUrl,
          policy_id: policyId,
          customer_name: customerName
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function error: ${error.message}`);
      }

      if (data.success && data.content_analysis) {
        toast({
          title: "Document Analyzed Successfully",
          description: `Analysis complete: ${data.content_analysis.document_type || 'Document analyzed'}`,
        });

        // Create a detailed view of the document analysis
        const analysisText = `
Document Analysis Results:

Document Type: ${data.content_analysis.document_type || 'Unknown'}
Policy Number: ${data.content_analysis.policy_number || policyId || 'Not specified'}
Customer Name: ${data.content_analysis.customer_name || customerName || 'Not specified'}
Update Reason: ${data.content_analysis.update_reason || 'Not specified'}
Action Required: ${data.content_analysis.action_required || 'None specified'}

Summary:
${data.content_analysis.summary || 'No summary available'}

Key Dates: ${Array.isArray(data.content_analysis.key_dates) ? data.content_analysis.key_dates.join(', ') : 'None specified'}

Additional Details:
${data.content_analysis.additional_details || 'None provided'}
`;

        // Show analysis in a more user-friendly way
        toast({
          title: "Document Analysis Complete",
          description: "Check the console for detailed analysis results",
        });
        
        // Log detailed results to console for now (could be improved with a modal)
        console.log('ANAM Document Analysis:', data.content_analysis);
        alert(`ANAM Document Analysis:\n\n${analysisText}`);
        
      } else if (data.document_info && !data.success) {
        // Document requires authentication or couldn't be fetched
        const errorMsg = data.error || 'Document requires authentication';
        
        toast({
          title: "Document Access Required",
          description: errorMsg.includes('authentication') || errorMsg.includes('login') 
            ? "This document requires login. Opening the ANAM portal..."
            : `Unable to fetch document: ${errorMsg}`,
          variant: "destructive"
        });
        
        console.log('Document fetch failed:', data);
        
        // Show the document info and open the link manually
        const documentInfo = `
Document Information:
- URL: ${documentUrl}
- Policy: ${data.document_info.policy_number || policyId || 'Unknown'}
- Document ID: ${data.document_info.document_id || 'Unknown'}
- Agent Number: ${data.document_info.agent_number || 'Unknown'}
- Document Type: ${data.document_info.document_type || 'Unknown'}

Error: ${errorMsg}

The document link will open in a new tab for manual access.
`;
        
        alert(documentInfo);
        
        // Open the document URL in a new tab for manual access
        window.open(documentUrl, '_blank');
      } else {
        // Unexpected response format
        console.error('Unexpected response format:', data);
        toast({
          title: "Unexpected Response",
          description: "The document service returned an unexpected response format",
          variant: "destructive"
        });
      }
      
    } catch (error: any) {
      console.error('Document fetch error:', error);
      
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Provide more specific error messages based on the error type
      if (errorMessage.includes('Network error') || errorMessage.includes('fetch')) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (errorMessage.includes('timeout')) {
        errorMessage = 'Request timed out. The ANAM server may be slow or unavailable.';
      } else if (errorMessage.includes('HTTP 4')) {
        errorMessage = 'Authentication required. Please log into the ANAM portal first.';
      } else if (errorMessage.includes('HTTP 5')) {
        errorMessage = 'ANAM server error. Please try again later.';
      }
      
      toast({
        title: "Document Analysis Failed",
        description: errorMessage,
        variant: "destructive",
      });

      // Always provide fallback option to open the document manually
      const shouldOpenManually = confirm(
        `Document analysis failed: ${errorMessage}\n\nWould you like to open the document manually in the ANAM portal?`
      );
      
      if (shouldOpenManually) {
        window.open(documentUrl, '_blank');
      }
    }
  };

  const processPdfAttachments = async (emailId: string, pdfPassword?: string) => {
    try {
      console.log('Processing PDF attachments for email:', emailId);
      
      // Use the known Liberty password if not provided
      const password = pdfPassword || 'LBL75078';
      
      // Show loading toast
      toast({
        title: "Processing PDFs",
        description: "Extracting content from PDF attachments...",
      });

      console.log('Calling process-pdf-attachments function...');
      
      const { data, error } = await supabase.functions.invoke('process-pdf-attachments', {
        body: { 
          email_id: emailId,
          pdf_password: password
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw new Error(`Function invocation failed: ${error.message}`);
      }

      if (data && data.success) {
        toast({
          title: "PDF Processing Complete",
          description: `Successfully processed ${data.pdfs_processed} PDFs with ${data.analyses_generated} analyses generated`,
        });

        // Refresh the data to show updated content
        await fetchEmails();
        
        // Show details of what was extracted
        const details = `
PDF Processing Results:
- PDFs Processed: ${data.pdfs_processed}
- Content Length: ${data.extracted_content_length} characters
- AI Analyses: ${data.analyses_generated}
- Password Used: ${password}

The extracted content has been saved and can be viewed in the email details.
`;
        
        alert(details);
        
      } else {
        throw new Error(data?.error || 'Unknown error during PDF processing');
      }
      
    } catch (error: any) {
      console.error('PDF processing error:', error);
      
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Provide more specific error messages
      if (errorMessage.includes('No PDF attachments')) {
        errorMessage = 'This email does not contain any PDF attachments to process.';
      } else if (errorMessage.includes('not yet downloaded')) {
        errorMessage = 'PDF attachments need to be downloaded first. Please sync this Liberty email again.';
      } else if (errorMessage.includes('Invalid password')) {
        errorMessage = 'PDF password is incorrect. The correct password for Liberty PDFs is "LBL75078".';
      } else if (errorMessage.includes('Function invocation failed')) {
        errorMessage = 'Unable to connect to the PDF processing service. Please check your connection and try again.';
      } else if (errorMessage.includes('Failed to send a request')) {
        errorMessage = 'Network error: Unable to reach the PDF processing service. Please try again.';
      }
      
      toast({
        title: "PDF Processing Failed",
        description: errorMessage,
        variant: "destructive",
      });

      // Offer to try with different password if password-related error
      if (errorMessage.includes('password') && !pdfPassword) {
        const userPassword = prompt('Enter the PDF password (default: LBL75078):');
        if (userPassword && userPassword !== 'LBL75078') {
          await processPdfAttachments(emailId, userPassword);
        }
      }
    }
  };

  // Helper function to parse multi-customer data
  const parseMultiCustomerData = (analysis: AnalysisResult) => {
    if (!analysis.customer_name || !analysis.policy_id) {
      return [{
        customer_name: analysis.customer_name || 'Unknown',
        policy_id: analysis.policy_id || 'Unknown',
        reason: analysis.reason || '-'
      }];
    }

    const customers = analysis.customer_name.split(',').map(name => name.trim());
    const policies = analysis.policy_id.split(',').map(policy => policy.trim());
    const reasons = analysis.reason ? analysis.reason.split(';').map(reason => reason.trim()) : [];

    // Ensure all arrays have the same length
    const maxLength = Math.max(customers.length, policies.length, reasons.length);
    
    return Array.from({ length: maxLength }, (_, index) => ({
      customer_name: customers[index] || 'Unknown',
      policy_id: policies[index] || 'Unknown',
      reason: reasons[index] || '-'
    }));
  };

  // Helper function to safely parse document links
  const parseDocumentLinks = (analysis: AnalysisResult): string[] => {
    if (!analysis.document_links) {
      return [];
    }

    // If it's already an array, return it
    if (Array.isArray(analysis.document_links)) {
      return analysis.document_links;
    }

    // If it's a string, try to parse it as JSON
    if (typeof analysis.document_links === 'string') {
      try {
        const parsed = JSON.parse(analysis.document_links);
        return Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        console.error('Failed to parse document_links JSON:', error);
        return [];
      }
    }

    return [];
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Fetching your email data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Email Automation Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="overview" className="w-full">
                    <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="gmail">Gmail Setup</TabsTrigger>
            <TabsTrigger value="processing">Processing</TabsTrigger>
            <TabsTrigger value="testing">Testing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5" />
                    Gmail Sync
                  </CardTitle>
                  <CardDescription>
                    Sync emails from your Gmail account for analysis
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gmail-token">Gmail Access Token</Label>
                    <Input
                      id="gmail-token"
                      type="password"
                      placeholder="Enter your Gmail access token"
                      value={gmailAccessToken}
                      onChange={(e) => {
                        const token = e.target.value;
                        setGmailAccessToken(token);
                        if (token) {
                          localStorage.setItem('gmail_access_token', token);
                          localStorage.setItem('gmail_access_token_expires', (Date.now() + 3600000).toString()); // 1 hour
                        } else {
                          localStorage.removeItem('gmail_access_token');
                          localStorage.removeItem('gmail_access_token_expires');
                        }
                      }}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={async () => {
                        if (!gmailAccessToken.trim()) {
                          toast({ title: "Error", description: "Please enter a Gmail access token", variant: "destructive" });
                          return;
                        }
                        
                        try {
                          const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
                            headers: { 'Authorization': `Bearer ${gmailAccessToken}` }
                          });
                          
                          if (response.ok) {
                            const data = await response.json();
                            toast({ title: "Token Valid", description: `Connected to ${data.emailAddress}` });
                          } else {
                            toast({ title: "Token Invalid", description: "Please get a new access token", variant: "destructive" });
                          }
                        } catch (error: any) {
                          toast({ title: "Token Test Failed", description: error.message, variant: "destructive" });
                        }
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Test Token
                    </Button>
                    
                    <Button 
                      onClick={handleGmailSync} 
                      disabled={gmailSyncing || !gmailAccessToken.trim()}
                      className="flex-1"
                    >
                      {gmailSyncing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Sync Gmail
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Analysis
                  </CardTitle>
                  <CardDescription>
                    Process emails with AI to extract insights and categorize
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    onClick={handleBatchAnalysis} 
                    disabled={analyzing || emails.length === 0}
                    className="w-full"
                  >
                    {analyzing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Analyze Unprocessed Emails
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{emails.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {emails.filter(e => e.status === 'processed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Processing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {emails.filter(e => e.status === 'unprocessed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {emails.filter(e => e.status === 'failed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by subject, customer, policy..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Carrier</Label>
                <Select value={carrierFilter} onValueChange={(value) => {
                  setCarrierFilter(value);
                  setCurrentPage(1); // Reset to first page when filtering
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All carriers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Carriers</SelectItem>
                    {availableCarriers.map((carrier) => (
                      <SelectItem key={carrier} value={carrier}>
                        {carrier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(value) => {
                  setStatusFilter(value);
                  setCurrentPage(1); // Reset to first page when filtering
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="unprocessed">Unprocessed</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryFilter} onValueChange={(value) => {
                  setCategoryFilter(value);
                  setCurrentPage(1); // Reset to first page when filtering
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {availableCategories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Received</Label>
                <Select value={dateFilter} onValueChange={(value) => {
                  setDateFilter(value);
                  setCurrentPage(1); // Reset to first page when filtering
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All dates" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Dates</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="last7days">Last 7 Days</SelectItem>
                    <SelectItem value="last30days">Last 30 Days</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Custom Date Range Inputs */}
            {dateFilter === "custom" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="date-from">From Date</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={customDateFrom}
                    onChange={(e) => {
                      setCustomDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-to">To Date</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={customDateTo}
                    onChange={(e) => {
                      setCustomDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* Clear Filters Button */}
            <Button 
              variant="outline" 
              onClick={() => {
                setCarrierFilter("all");
                setStatusFilter("all");
                setCategoryFilter("all");
                setSearchQuery("");
                setDateFilter("all");
                setCustomDateFrom("");
                setCustomDateTo("");
                setCurrentPage(1);
              }}
              className="mt-2"
            >
              Clear All Filters
            </Button>
          </CardContent>
        </Card>

        {/* Emails Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Emails</CardTitle>
                <CardDescription>
                  Showing {filteredEmails.length} of {totalEmails} emails (Page {currentPage} of {Math.ceil(totalEmails / EMAILS_PER_PAGE)})
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchEmails}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredEmails.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No emails found matching your filters.</p>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Carrier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Policy ID</TableHead>
                      <TableHead>Received</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmails.map((email) => {
                      const analysis = analysisResults[email.id];
                      return (
                        <TableRow key={email.id}>
                          <TableCell className="font-medium max-w-xs truncate" title={email.subject}>
                            {email.subject}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{email.carrier_label}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(email.status)}>
                              {email.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {analysis?.category ? (
                              <Badge variant={getCategoryBadgeVariant(analysis.category)}>
                                {analysis.category}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              if (!analysis?.customer_name) {
                                return <span className="text-muted-foreground">-</span>;
                              }
                              const customers = analysis.customer_name.split(',').map(name => name.trim());
                              if (customers.length > 1) {
                                return (
                                  <div title={analysis.customer_name}>
                                    {customers[0]} <span className="text-muted-foreground">+{customers.length - 1} more</span>
                                  </div>
                                );
                              }
                              return analysis.customer_name;
                            })()}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              if (!analysis?.policy_id) {
                                return <span className="text-muted-foreground">-</span>;
                              }
                              const policies = analysis.policy_id.split(',').map(policy => policy.trim());
                              if (policies.length > 1) {
                                return (
                                  <div title={analysis.policy_id}>
                                    {policies[0]} <span className="text-muted-foreground">+{policies.length - 1} more</span>
                                  </div>
                                );
                              }
                              return analysis.policy_id;
                            })()}
                          </TableCell>
                          <TableCell>
                            {new Date(email.received_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    onClick={() => setSelectedEmail(email)}
                                  >
                                    View
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
                                  <DialogHeader className="pb-4 border-b">
                                    <DialogTitle className="text-xl font-semibold text-left pr-8">
                                      {selectedEmail?.subject}
                                    </DialogTitle>
                                    <DialogDescription className="text-left">
                                      Email details and AI analysis results
                                    </DialogDescription>
                                  </DialogHeader>
                                  {selectedEmail && (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
                                      {/* Left Column - Email Details & Summary */}
                                      <div className="space-y-6">
                                        {/* Email Details Card */}
                                        <Card>
                                          <CardHeader className="pb-3">
                                            <CardTitle className="text-lg flex items-center gap-2">
                                              <Mail className="h-5 w-5" />
                                              Email Details
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="space-y-3">
                                            <div className="grid grid-cols-2 gap-4">
                                              <div>
                                                <p className="text-sm font-medium text-muted-foreground">Carrier</p>
                                                <Badge variant="outline" className="mt-1">{selectedEmail.carrier_label}</Badge>
                                              </div>
                                              <div>
                                                <p className="text-sm font-medium text-muted-foreground">Status</p>
                                                <Badge variant={getStatusBadgeVariant(selectedEmail.status)} className="mt-1">
                                                  {selectedEmail.status}
                                                </Badge>
                                              </div>
                                            </div>
                                            <div>
                                              <p className="text-sm font-medium text-muted-foreground">Received</p>
                                              <p className="text-sm mt-1">{new Date(selectedEmail.received_date).toLocaleString()}</p>
                                            </div>
                                          </CardContent>
                                        </Card>

                                        {/* AI Analysis Summary */}
                                        {analysisResults[selectedEmail.id] && (
                                          <Card>
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-lg flex items-center gap-2">
                                                <Brain className="h-5 w-5" />
                                                Analysis Summary
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                  <p className="text-sm font-medium text-muted-foreground">Category</p>
                                                  <Badge variant={getCategoryBadgeVariant(analysisResults[selectedEmail.id].category)} className="mt-1">
                                                    {analysisResults[selectedEmail.id].category}
                                                  </Badge>
                                                </div>
                                                <div>
                                                  <p className="text-sm font-medium text-muted-foreground">Subcategory</p>
                                                  <p className="text-sm mt-1">{analysisResults[selectedEmail.id].subcategory}</p>
                                                </div>
                                              </div>
                                              <div>
                                                <p className="text-sm font-medium text-muted-foreground">Summary</p>
                                                <p className="text-sm mt-1 leading-relaxed">{analysisResults[selectedEmail.id].summary}</p>
                                              </div>
                                              <div>
                                                <p className="text-sm font-medium text-muted-foreground">Suggested Action</p>
                                                <p className="text-sm mt-1 leading-relaxed">{analysisResults[selectedEmail.id].suggested_action}</p>
                                              </div>
                                            </CardContent>
                                          </Card>
                                        )}
                                      </div>

                                      {/* Right Column - Customer Details & Documents */}
                                      <div className="space-y-6">
                                        {/* Customer Information */}
                                        {analysisResults[selectedEmail.id] && (
                                          <Card>
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-lg flex items-center gap-2">
                                                <span className="h-5 w-5 flex items-center justify-center bg-primary text-primary-foreground rounded text-xs font-bold">
                                                  {(() => {
                                                    const customerData = parseMultiCustomerData(analysisResults[selectedEmail.id]);
                                                    return customerData.length;
                                                  })()}
                                                </span>
                                                Customer Information
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                              {(() => {
                                                const customerData = parseMultiCustomerData(analysisResults[selectedEmail.id]);
                                                return (
                                                  <div className="space-y-3 max-h-64 overflow-y-auto">
                                                    {customerData.map((customer, index) => (
                                                      <div key={index} className="bg-muted/50 p-4 rounded-lg border">
                                                        <div className="flex items-center gap-2 mb-3">
                                                          <span className="text-xs font-semibold bg-primary text-primary-foreground px-2 py-1 rounded">
                                                            Customer {index + 1}
                                                          </span>
                                                        </div>
                                                        <div className="space-y-2">
                                                          <div>
                                                            <p className="text-xs font-medium text-muted-foreground">Name</p>
                                                            <p className="text-sm font-medium">{customer.customer_name}</p>
                                                          </div>
                                                          <div>
                                                            <p className="text-xs font-medium text-muted-foreground">Policy ID</p>
                                                            <p className="text-sm font-mono">{customer.policy_id}</p>
                                                          </div>
                                                          <div>
                                                            <p className="text-xs font-medium text-muted-foreground">Reason</p>
                                                            <p className="text-sm leading-relaxed">{customer.reason}</p>
                                                          </div>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                );
                                              })()}
                                            </CardContent>
                                          </Card>
                                        )}

                                        {/* PDF Attachments for Liberty */}
                                        {selectedEmail && selectedEmail.carrier_label === 'Liberty' && (
                                          <Card>
                                            <CardHeader className="pb-3">
                                              <CardTitle className="text-lg flex items-center gap-2">
                                                <Download className="h-5 w-5" />
                                                PDF Attachments
                                              </CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                              <div className="space-y-4">
                                                {/* Show regular attachments */}
                                                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                                  <div>
                                                    <p className="text-sm font-medium text-muted-foreground mb-2">Email Attachments</p>
                                                    <div className="space-y-2">
                                                      {selectedEmail.attachments.map((filename, index) => (
                                                        <div key={index} className="flex items-center gap-3 p-2 bg-muted/30 rounded border">
                                                          <div className="flex-1">
                                                            <p className="text-sm font-medium">{filename}</p>
                                                            {filename.toLowerCase().endsWith('.pdf') && (
                                                              <p className="text-xs text-muted-foreground">Password-protected PDF</p>
                                                            )}
                                                          </div>
                                                          {filename.toLowerCase().endsWith('.pdf') && (
                                                            <Button 
                                                              variant="outline" 
                                                              size="sm"
                                                              onClick={() => processPdfAttachments(selectedEmail.id)}
                                                            >
                                                              <Brain className="h-3 w-3 mr-1" />
                                                              Extract
                                                            </Button>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Show extracted PDF content if available */}
                                                {(selectedEmail as any).pdf_extracted_content && (
                                                  <div>
                                                    <p className="text-sm font-medium text-muted-foreground mb-2">Extracted PDF Content</p>
                                                    <div className="bg-muted/50 p-3 rounded border max-h-32 overflow-y-auto">
                                                      <p className="text-xs font-mono whitespace-pre-wrap">
                                                        {((selectedEmail as any).pdf_extracted_content as string).substring(0, 500)}
                                                        {((selectedEmail as any).pdf_extracted_content as string).length > 500 && '...'}
                                                      </p>
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Show PDF analysis if available */}
                                                {analysisResults[selectedEmail.id]?.pdf_analysis && (
                                                  <div>
                                                    <p className="text-sm font-medium text-muted-foreground mb-2">PDF Analysis Results</p>
                                                    <div className="space-y-2">
                                                      {(analysisResults[selectedEmail.id].pdf_analysis as any[]).map((analysis, index) => (
                                                        <div key={index} className="bg-muted/50 p-3 rounded border">
                                                          <p className="text-sm font-medium mb-2">{analysis.filename}</p>
                                                          {analysis.analysis && (
                                                            <div className="text-xs space-y-1">
                                                              {analysis.analysis.policy_number && (
                                                                <p><span className="font-medium">Policy:</span> {analysis.analysis.policy_number}</p>
                                                              )}
                                                              {analysis.analysis.customer_name && (
                                                                <p><span className="font-medium">Customer:</span> {analysis.analysis.customer_name}</p>
                                                              )}
                                                              {analysis.analysis.document_type && (
                                                                <p><span className="font-medium">Type:</span> {analysis.analysis.document_type}</p>
                                                              )}
                                                              {analysis.analysis.premium_amount && (
                                                                <p><span className="font-medium">Premium:</span> {analysis.analysis.premium_amount}</p>
                                                              )}
                                                            </div>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}

                                                {/* Show process button if no content extracted yet */}
                                                {!((selectedEmail as any).pdf_extracted_content) && selectedEmail.attachments?.some(att => att.toLowerCase().endsWith('.pdf')) && (
                                                  <div className="pt-2">
                                                    <Button 
                                                      onClick={() => processPdfAttachments(selectedEmail.id)}
                                                      className="w-full"
                                                    >
                                                      <Brain className="h-4 w-4 mr-2" />
                                                      Process PDF Attachments
                                                    </Button>
                                                  </div>
                                                )}
                                              </div>
                                            </CardContent>
                                          </Card>
                                        )}

                                        {/* ANAM Documents */}
                                        {selectedEmail && (() => {
                                          const documentLinks = parseDocumentLinks(analysisResults[selectedEmail.id] || {} as AnalysisResult);
                                          return documentLinks.length > 0 && (
                                            <Card>
                                              <CardHeader className="pb-3">
                                                <CardTitle className="text-lg flex items-center gap-2">
                                                  <ExternalLink className="h-5 w-5" />
                                                  ANAM Documents ({documentLinks.length})
                                                </CardTitle>
                                              </CardHeader>
                                              <CardContent>
                                                <div className="space-y-3">
                                                  {documentLinks.map((docUrl, index) => (
                                                    <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
                                                      <div className="flex-1">
                                                        <p className="text-sm font-medium">Document {index + 1}</p>
                                                        
                                                      </div>
                                                      <div className="flex gap-2">
                                                        <Button 
                                                          variant="outline" 
                                                          size="sm"
                                                          onClick={() => fetchAnamDocument(
                                                            docUrl, 
                                                            analysisResults[selectedEmail.id]?.policy_id, 
                                                            analysisResults[selectedEmail.id]?.customer_name
                                                          )}
                                                        >
                                                          <Brain className="h-3 w-3 mr-1" />
                                                          Analyze
                                                        </Button>
                                                        <Button 
                                                          variant="ghost" 
                                                          size="sm"
                                                          onClick={() => window.open(docUrl, '_blank')}
                                                        >
                                                          <ExternalLink className="h-3 w-3 mr-1" />
                                                          Open
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                              </CardContent>
                                            </Card>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>
                              {email.gmail_url && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => window.open(email.gmail_url, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  Open Email
                                </Button>
                              )}
                              {email.status === 'unprocessed' && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleSingleAnalysis(email.id)}
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  Analyze
                                </Button>
                              )}
                              {email.carrier_label === 'Liberty' && email.attachments && email.attachments.some(att => att.toLowerCase().endsWith('.pdf')) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => processPdfAttachments(email.id)}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Process PDFs
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * EMAILS_PER_PAGE) + 1} to {Math.min(currentPage * EMAILS_PER_PAGE, totalEmails)} of {totalEmails} emails
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, Math.ceil(totalEmails / EMAILS_PER_PAGE)) }, (_, i) => {
                        const totalPages = Math.ceil(totalEmails / EMAILS_PER_PAGE);
                        let pageNum;
                        
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            disabled={loading}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalEmails / EMAILS_PER_PAGE), prev + 1))}
                      disabled={currentPage >= Math.ceil(totalEmails / EMAILS_PER_PAGE) || loading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Gmail Setup Tab */}
          <TabsContent value="gmail" className="space-y-8">
            <GmailAuth />
          </TabsContent>

          {/* Processing Tab */}
          <TabsContent value="processing" className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Email Processing</CardTitle>
                <CardDescription>
                  Sync and analyze your emails
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Gmail Sync Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Existing Gmail sync card content will go here */}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="testing" className="space-y-8">
            <TestEmailProcessor />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
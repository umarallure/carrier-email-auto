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
import { useAuth } from "@/hooks/useAuth";
import { Mail, Filter, RefreshCw, Brain, ExternalLink, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSecureToken } from "@/hooks/useSecureToken";

interface Email {
  id: string;
  carrier: string;
  subject: string;
  received_date: string;
  status: string;
  carrier_label: string;
  gmail_url?: string;
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

export const InboxPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { token: gmailAccessToken, hasToken: hasGmailToken } = useSecureToken('gmail_access_token');
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

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user, currentPage, carrierFilter, statusFilter, categoryFilter, searchQuery, dateFilter, customDateFrom, customDateTo]);

  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      let emailQuery = supabase
        .from("emails")
        .select("*", { count: 'exact' })
        .order("received_date", { ascending: false });

      // Apply filters
      if (carrierFilter !== "all") {
        emailQuery = emailQuery.eq("carrier_label", carrierFilter);
      }

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
              toDate.setDate(toDate.getDate() + 1);
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

      // Fetch analysis results
      const emailIds = emailsData?.map(email => email.id) || [];
      
      if (emailIds.length > 0) {
        let analysisQuery = supabase
          .from("email_analysis_results")
          .select("*")
          .in("email_id", emailIds);

        if (categoryFilter !== "all") {
          analysisQuery = analysisQuery.eq("category", categoryFilter);
        }

        const { data: resultsData, error: resultsError } = await analysisQuery;

        if (resultsError) throw resultsError;

        const resultsMap: Record<string, AnalysisResult> = {};
        resultsData?.forEach((result) => {
          resultsMap[result.email_id] = result;
        });
        setAnalysisResults(resultsMap);

        if (categoryFilter !== "all" && emailsData) {
          const filteredEmails = emailsData.filter(email => resultsMap[email.id]);
          setEmails(filteredEmails);
        }
      }

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

  const handleGmailSync = async () => {
    if (!hasGmailToken) {
      toast({
        title: "Error",
        description: "Please authenticate with Gmail first",
        variant: "destructive",
      });
      return;
    }

    try {
      setGmailSyncing(true);
      
      const { data, error } = await supabase.functions.invoke('gmail-sync', {
        body: { 
          access_token: gmailAccessToken,
          carrier_filter: carrierFilter !== "all" ? carrierFilter : undefined
        }
      });

      if (error) {
        throw new Error(`Gmail sync failed: ${error.message || JSON.stringify(error)}`);
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Unknown error occurred during Gmail sync');
      }

      toast({
        title: "Gmail Sync Complete",
        description: `Successfully synced ${data.emails_synced} emails (${data.duplicates_skipped} duplicates skipped)`,
      });

      await fetchEmails();
      
    } catch (error: any) {
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
    
    return true;
  });

  const availableCarriers = [...new Set(emails.map(e => e.carrier_label))].filter(carrier => carrier && carrier.trim() !== '').sort();
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

  const totalPages = Math.ceil(totalEmails / EMAILS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
          <p className="text-muted-foreground">
            Manage and process carrier emails from AIG, RNA, ANAM, and Liberty
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            onClick={handleGmailSync}
            disabled={gmailSyncing || !hasGmailToken}
            className="flex items-center space-x-2"
          >
            <Mail className="h-4 w-4" />
            <span>{gmailSyncing ? "Syncing..." : "Sync Gmail"}</span>
          </Button>
          <Button 
            onClick={handleBatchAnalysis}
            disabled={analyzing}
            variant="outline"
            className="flex items-center space-x-2"
          >
            <Brain className="h-4 w-4" />
            <span>{analyzing ? "Analyzing..." : "Batch Analyze"}</span>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search emails..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="carrier">Carrier</Label>
              <Select value={carrierFilter} onValueChange={setCarrierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All carriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All carriers</SelectItem>
                  {availableCarriers.map((carrier) => (
                    <SelectItem key={carrier} value={carrier}>
                      {carrier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Table */}
      <Card>
        <CardHeader>
          <CardTitle>Emails ({totalEmails} total)</CardTitle>
          <CardDescription>
            Showing {Math.min((currentPage - 1) * EMAILS_PER_PAGE + 1, totalEmails)} - {Math.min(currentPage * EMAILS_PER_PAGE, totalEmails)} of {totalEmails} emails
          </CardDescription>
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
                    <TableHead>Carrier</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Policy ID</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmails.map((email) => {
                    const analysis = analysisResults[email.id];
                    return (
                      <TableRow key={email.id}>
                        <TableCell>
                          <Badge variant="outline">{email.carrier_label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {email.subject}
                        </TableCell>
                        <TableCell>
                          {analysis?.customer_name || "Not analyzed"}
                        </TableCell>
                        <TableCell>
                          {analysis?.policy_id || "Not analyzed"}
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
                          <Badge variant={getStatusBadgeVariant(email.status)}>
                            {email.status}
                          </Badge>
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
                                onClick={() => handleSingleAnalysis(email.id)}
                              >
                                <Brain className="h-3 w-3 mr-1" />
                                Analyze
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
                                  <DialogTitle>Email Details</DialogTitle>
                                  <DialogDescription>
                                    {email.subject}
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label>Carrier</Label>
                                      <p className="text-sm">{email.carrier_label}</p>
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
                                          <p className="text-sm">{analysis.customer_name}</p>
                                        </div>
                                        <div>
                                          <Label>Policy ID</Label>
                                          <p className="text-sm">{analysis.policy_id}</p>
                                        </div>
                                        <div>
                                          <Label>Category</Label>
                                          <Badge variant={getCategoryBadgeVariant(analysis.category)}>
                                            {analysis.category}
                                          </Badge>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                  {analysis && (
                                    <div>
                                      <Label>Summary</Label>
                                      <p className="text-sm mt-1">{analysis.summary}</p>
                                    </div>
                                  )}
                                  {analysis && (
                                    <div>
                                      <Label>Suggested Action</Label>
                                      <p className="text-sm mt-1">{analysis.suggested_action}</p>
                                    </div>
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
    </div>
  );
};

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
import { LogOut, Mail, Filter, RefreshCw, Brain, Download, Play, TestTube, Loader2 } from "lucide-react";
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
}

interface AnalysisResult {
  customer_name: string;
  policy_id: string;
  category: string;
  subcategory: string;
  summary: string;
  suggested_action: string;
  review_status: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [emails, setEmails] = useState<Email[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [loading, setLoading] = useState(true);
  const [carrierFilter, setCarrierFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [gmailAccessToken, setGmailAccessToken] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

  useEffect(() => {
    if (user) {
      fetchEmails();
    }
  }, [user]); // Only fetch when user changes, not on every render

  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      console.log('Fetching emails and analysis results...'); // Debug log
      
      // Fetch emails with limit to reduce data transfer
      const { data: emailsData, error: emailsError } = await supabase
        .from("emails")
        .select("*")
        .order("received_date", { ascending: false })
        .limit(100); // Limit to 100 most recent emails

      if (emailsError) throw emailsError;

      setEmails(emailsData || []);

      // Only fetch analysis results for the emails we actually have
      const emailIds = emailsData?.map(email => email.id) || [];
      
      if (emailIds.length > 0) {
        const { data: resultsData, error: resultsError } = await supabase
          .from("email_analysis_results")
          .select("*")
          .in("email_id", emailIds); // Only fetch analysis for current emails

        if (resultsError) throw resultsError;

        // Create a map of email_id to analysis result
        const resultsMap: Record<string, AnalysisResult> = {};
        resultsData?.forEach((result) => {
          resultsMap[result.email_id] = result;
        });
        setAnalysisResults(resultsMap);
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
    if (!gmailAccessToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter your Gmail access token",
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

      if (error) throw error;

      toast({
        title: "Gmail Sync Complete",
        description: `Successfully synced ${data.emails_synced} emails`,
      });

      // Don't automatically refresh - let user manually refresh if needed
      // await fetchEmails();
      
    } catch (error: any) {
      toast({
        title: "Gmail Sync Failed",
        description: error.message,
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
    const carrierMatch = carrierFilter === "all" || email.carrier_label === carrierFilter;
    const statusMatch = statusFilter === "all" || email.status === statusFilter;
    return carrierMatch && statusMatch;
  });

  const availableCarriers = [...new Set(emails.map(e => e.carrier_label))].sort();

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
                      onChange={(e) => setGmailAccessToken(e.target.value)}
                    />
                  </div>
                  <Button 
                    onClick={handleGmailSync} 
                    disabled={gmailSyncing || !gmailAccessToken.trim()}
                    className="w-full"
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

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Carrier</Label>
                <Select value={carrierFilter} onValueChange={setCarrierFilter}>
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="unprocessed">Unprocessed</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emails Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Emails</CardTitle>
                <CardDescription>
                  All emails from insurance carriers with AI analysis results
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
                        <TableCell className="font-medium">{email.subject}</TableCell>
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
                          {analysis?.customer_name || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {analysis?.policy_id || (
                            <span className="text-muted-foreground">-</span>
                          )}
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
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>{selectedEmail?.subject}</DialogTitle>
                                  <DialogDescription>
                                    Email details and AI analysis results
                                  </DialogDescription>
                                </DialogHeader>
                                {selectedEmail && (
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-medium mb-2">Email Details</h4>
                                      <p><strong>Carrier:</strong> {selectedEmail.carrier_label}</p>
                                      <p><strong>Status:</strong> {selectedEmail.status}</p>
                                      <p><strong>Received:</strong> {new Date(selectedEmail.received_date).toLocaleString()}</p>
                                    </div>
                                    {analysisResults[selectedEmail.id] && (
                                      <div>
                                        <h4 className="font-medium mb-2">AI Analysis</h4>
                                        <div className="bg-muted p-4 rounded-lg space-y-2">
                                          <p><strong>Customer:</strong> {analysisResults[selectedEmail.id].customer_name}</p>
                                          <p><strong>Policy ID:</strong> {analysisResults[selectedEmail.id].policy_id}</p>
                                          <p><strong>Category:</strong> {analysisResults[selectedEmail.id].category}</p>
                                          <p><strong>Subcategory:</strong> {analysisResults[selectedEmail.id].subcategory}</p>
                                          <p><strong>Summary:</strong> {analysisResults[selectedEmail.id].summary}</p>
                                          <p><strong>Suggested Action:</strong> {analysisResults[selectedEmail.id].suggested_action}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
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
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          {/* Gmail Setup Tab */}
          <TabsContent value="gmail" className="space-y-8">
            <GmailAuth 
              onTokenReceived={setGmailAccessToken}
              currentToken={gmailAccessToken}
            />
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
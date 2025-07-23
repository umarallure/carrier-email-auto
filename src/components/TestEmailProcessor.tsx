import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, TestTube } from "lucide-react";

const TestEmailProcessor = () => {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState({
    subject: "Payment Failed - Policy ABC123456",
    body: "Dear John Doe,\n\nWe were unable to process your payment for policy ABC123456. Your payment was declined due to insufficient funds in your account. Please update your payment method or add funds to your account.\n\nPolicy holder: John Doe\nPolicy ID: ABC123456\nAmount due: $89.99\nDue date: 2025-01-15\n\nPlease contact us at 1-800-555-0123 to resolve this issue.\n\nThank you,\nAIG Customer Service",
    carrier: "AIG"
  });
  const [analysisResult, setAnalysisResult] = useState<any>(null);

  const sampleEmails = {
    "Failed Payment": {
      subject: "Payment Failed - Policy ABC123456",
      body: "Dear John Doe,\n\nWe were unable to process your payment for policy ABC123456. Your payment was declined due to insufficient funds in your account. Please update your payment method or add funds to your account.\n\nPolicy holder: John Doe\nPolicy ID: ABC123456\nAmount due: $89.99\nDue date: 2025-01-15\n\nPlease contact us at 1-800-555-0123 to resolve this issue.\n\nThank you,\nAIG Customer Service",
      carrier: "AIG"
    },
    "Pending Documentation": {
      subject: "Additional Documentation Required - Policy XYZ789",
      body: "Dear Sarah Smith,\n\nTo complete the underwriting process for your policy XYZ789, we need the following additional documents:\n\n- Copy of valid driver's license\n- Proof of Social Security Number\n- Recent utility bill for address verification\n\nPlease submit these documents within 10 business days to avoid policy cancellation.\n\nCustomer: Sarah Smith\nPolicy: XYZ789\n\nSubmit via our secure portal or call 1-800-LIBERTY.\n\nBest regards,\nLiberty Mutual Underwriting Team",
      carrier: "Liberty"
    },
    "Post Underwriting - Approved": {
      subject: "Underwriting Complete - Policy DEF456 Approved",
      body: "Dear Mike Johnson,\n\nGreat news! Your policy application DEF456 has been approved as applied. Your coverage will begin on 2025-02-01.\n\nPolicy holder: Mike Johnson\nPolicy number: DEF456\nCoverage amount: $500,000\nMonthly premium: $125.00\n\nWelcome to ANAM Insurance!\n\nCustomer Service Team",
      carrier: "ANAM"
    }
  };

  const testAnalysis = async () => {
    try {
      setTesting(true);
      setAnalysisResult(null);

      // Create a test email in the database
      const { data: insertedEmail, error: insertError } = await supabase
        .from('emails')
        .insert({
          subject: testEmail.subject,
          body: testEmail.body,
          carrier: testEmail.carrier.toLowerCase(),
          carrier_label: testEmail.carrier,
          received_date: new Date().toISOString(),
          status: 'unprocessed',
          gmail_id: `test_${Date.now()}`,
          user_id: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Analyze the email
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-email', {
        body: { 
          email_id: insertedEmail.id,
          force_reprocess: true
        }
      });

      if (analysisError) throw analysisError;

      setAnalysisResult(analysisData.analysis);

      toast({
        title: "Test Complete",
        description: "Email analysis completed successfully",
      });

    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const loadSampleEmail = (sampleType: string) => {
    if (sampleEmails[sampleType as keyof typeof sampleEmails]) {
      setTestEmail(sampleEmails[sampleType as keyof typeof sampleEmails]);
      setAnalysisResult(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Test Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Email Analysis Tester
          </CardTitle>
          <CardDescription>
            Test the AI email processing pipeline with sample or custom emails
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Load Sample Email</Label>
            <Select onValueChange={loadSampleEmail}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a sample email" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Failed Payment">Failed Payment Example</SelectItem>
                <SelectItem value="Pending Documentation">Pending Documentation</SelectItem>
                <SelectItem value="Post Underwriting - Approved">Approved Policy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="carrier">Carrier</Label>
            <Select value={testEmail.carrier} onValueChange={(value) => setTestEmail(prev => ({ ...prev, carrier: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select carrier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AIG">AIG</SelectItem>
                <SelectItem value="ANAM">ANAM</SelectItem>
                <SelectItem value="Liberty">Liberty</SelectItem>
                <SelectItem value="RNA">RNA</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Email Subject</Label>
            <Input
              id="subject"
              value={testEmail.subject}
              onChange={(e) => setTestEmail(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Enter email subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">Email Body</Label>
            <Textarea
              id="body"
              value={testEmail.body}
              onChange={(e) => setTestEmail(prev => ({ ...prev, body: e.target.value }))}
              placeholder="Enter email content"
              rows={8}
            />
          </div>

          <Button 
            onClick={testAnalysis} 
            disabled={testing || !testEmail.subject.trim() || !testEmail.body.trim()}
            className="w-full"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Test Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
          <CardDescription>
            AI-generated analysis results in JSON format
          </CardDescription>
        </CardHeader>
        <CardContent>
          {analysisResult ? (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Extracted Information</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Customer:</strong> {analysisResult.customer_name || 'Not found'}</p>
                  <p><strong>Policy ID:</strong> {analysisResult.policy_id || 'Not found'}</p>
                  <p><strong>Category:</strong> 
                    <span className="ml-1 px-2 py-1 bg-primary/10 text-primary rounded text-xs">
                      {analysisResult.category}
                    </span>
                  </p>
                  <p><strong>Subcategory:</strong> 
                    <span className="ml-1 px-2 py-1 bg-secondary/10 text-secondary-foreground rounded text-xs">
                      {analysisResult.subcategory || 'None'}
                    </span>
                  </p>
                  <p><strong>Update Date:</strong> {analysisResult.email_update_date || 'None'}</p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Summary</h4>
                <p className="text-sm">{analysisResult.summary}</p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Suggested Action</h4>
                <p className="text-sm">{analysisResult.suggested_action}</p>
              </div>

              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium mb-2">Raw JSON</h4>
                <pre className="text-xs overflow-auto max-h-40">
                  {JSON.stringify(analysisResult, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <TestTube className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Run a test analysis to see results here</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TestEmailProcessor;
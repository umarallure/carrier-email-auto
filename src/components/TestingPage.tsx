import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import TestEmailProcessor from "@/components/TestEmailProcessor";
import { TestTube, Zap, Brain, Mail } from "lucide-react";

export const TestingPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Testing & Development</h1>
          <p className="text-muted-foreground">
            Test email processing and AI analysis functionality
          </p>
        </div>
      </div>

      {/* Testing Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <TestTube className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <CardTitle className="text-lg">Sample Emails</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Test with pre-built email samples for different scenarios and carriers
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="text-center">
            <Brain className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <CardTitle className="text-lg">AI Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Test AI analysis capabilities with custom email content and carrier types
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="text-center">
            <Zap className="h-8 w-8 mx-auto text-purple-600 mb-2" />
            <CardTitle className="text-lg">Real-time Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Get instant feedback on email categorization and data extraction
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Testing Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Test</CardTitle>
          <CardDescription>
            Use the testing interface to validate email processing functionality
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                1
              </div>
              <div>
                <h4 className="font-medium">Choose a Sample Email</h4>
                <p className="text-sm text-muted-foreground">
                  Select from pre-configured sample emails or create your own custom email content
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                2
              </div>
              <div>
                <h4 className="font-medium">Select Carrier</h4>
                <p className="text-sm text-muted-foreground">
                  Choose the carrier (AIG, RNA, ANAM, Liberty) to test carrier-specific analysis rules
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                3
              </div>
              <div>
                <h4 className="font-medium">Run Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Click "Test Analysis" to process the email and see extracted data and categorization
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-semibold">
                4
              </div>
              <div>
                <h4 className="font-medium">Review Results</h4>
                <p className="text-sm text-muted-foreground">
                  Examine the extracted customer information, policy details, and suggested actions
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Interface */}
      <TestEmailProcessor />

      {/* Testing Scenarios */}
      <Card>
        <CardHeader>
          <CardTitle>Testing Scenarios</CardTitle>
          <CardDescription>
            Common scenarios to validate with the testing interface
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-medium">Payment Issues</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Failed payment due to insufficient funds</li>
                <li>• Credit card expiration</li>
                <li>• Bank account closure</li>
                <li>• Chargeback notifications</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Policy Changes</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Policy cancellation requests</li>
                <li>• Coverage modifications</li>
                <li>• Renewal notifications</li>
                <li>• Premium adjustments</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Documentation Requests</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Driver's license verification</li>
                <li>• Proof of address</li>
                <li>• Social Security Number confirmation</li>
                <li>• Additional underwriting documents</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Underwriting Updates</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Approved as applied</li>
                <li>• Approved with modifications</li>
                <li>• Declined applications</li>
                <li>• Additional information requests</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Development Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Development Notes</CardTitle>
          <CardDescription>
            Important information for developers and testers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">AI Model Configuration</h4>
              <p className="text-sm text-muted-foreground">
                The system uses Together.ai's API for email analysis. Different carriers may have specific prompts and categorization rules.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Testing Environment</h4>
              <p className="text-sm text-muted-foreground">
                Test emails are processed through the same pipeline as production emails but are clearly marked as test data.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Error Handling</h4>
              <p className="text-sm text-muted-foreground">
                Test various error scenarios including API failures, malformed emails, and edge cases to validate system robustness.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Performance Testing</h4>
              <p className="text-sm text-muted-foreground">
                Monitor processing times and API response times during testing to identify potential performance bottlenecks.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SimpleGmailAuth from "@/components/SimpleGmailAuth";
import { Mail, Shield, Zap, CheckCircle } from "lucide-react";

export const GmailSetupPage = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gmail Setup</h1>
          <p className="text-muted-foreground">
            Connect your Gmail account to automatically sync carrier emails
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="text-center">
            <Shield className="h-8 w-8 mx-auto text-blue-600 mb-2" />
            <CardTitle className="text-lg">Secure Authentication</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Your Gmail tokens are stored securely in your browser's local storage
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="text-center">
            <Zap className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <CardTitle className="text-lg">Automatic Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              Automatically detect and sync emails from AIG, RNA, ANAM, and Liberty carriers
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="text-center">
            <Mail className="h-8 w-8 mx-auto text-purple-600 mb-2" />
            <CardTitle className="text-lg">Smart Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center">
              AI-powered analysis extracts customer info, policy details, and categorizes emails
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Steps */}
      <Card>
        <CardHeader>
          <CardTitle>Setup Process</CardTitle>
          <CardDescription>
            Follow these simple steps to connect your Gmail account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                1
              </div>
              <div>
                <h4 className="font-medium">Authenticate with Google</h4>
                <p className="text-sm text-muted-foreground">
                  Click "Connect with Google" below to securely authenticate your Gmail account
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                2
              </div>
              <div>
                <h4 className="font-medium">Grant Permissions</h4>
                <p className="text-sm text-muted-foreground">
                  Allow read-only access to your Gmail account (we never modify or delete emails)
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-sm font-semibold">
                3
              </div>
              <div>
                <h4 className="font-medium">Label Your Emails</h4>
                <p className="text-sm text-muted-foreground">
                  Organize your carrier emails with labels: AIG, RNA, ANAM, Liberty
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-semibold">
                <CheckCircle className="h-3 w-3" />
              </div>
              <div>
                <h4 className="font-medium">Start Processing</h4>
                <p className="text-sm text-muted-foreground">
                  Begin syncing and analyzing your carrier emails automatically
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gmail Auth Component */}
      <SimpleGmailAuth />

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle>Need Help?</CardTitle>
          <CardDescription>
            Common questions and troubleshooting tips
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">What permissions do you need?</h4>
              <p className="text-sm text-muted-foreground">
                We only request read-only access to your Gmail account. We cannot send emails, delete emails, or modify your account in any way.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">How are my credentials stored?</h4>
              <p className="text-sm text-muted-foreground">
                Your Gmail access tokens are stored securely in your browser's local storage. Tokens automatically expire and can be refreshed as needed.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">What if I don't have carrier labels?</h4>
              <p className="text-sm text-muted-foreground">
                You can create Gmail labels manually or let our system automatically detect carrier emails based on sender domains and content patterns.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Can I disconnect my account?</h4>
              <p className="text-sm text-muted-foreground">
                Yes, you can disconnect your Gmail account at any time using the "Disconnect" button above. This will remove all stored tokens and stop email syncing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

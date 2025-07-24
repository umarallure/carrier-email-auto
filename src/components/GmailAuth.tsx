import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, ExternalLink, Key, CheckCircle } from "lucide-react";

// Google OAuth configuration
const GOOGLE_CLIENT_ID = "500006223329-2kfsfb1k06qfkf1epa58mj52ikkscnsh.apps.googleusercontent.com";
const REDIRECT_URI = window.location.origin + "/auth/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
].join(" ");

interface GmailAuthProps {
  onTokenReceived: (token: string) => void;
  currentToken?: string;
}

const GmailAuth = ({ onTokenReceived, currentToken }: GmailAuthProps) => {
  const { toast } = useToast();
  const [manualToken, setManualToken] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);

  // Method 1: OAuth Flow (Recommended)
  const handleGoogleOAuth = () => {
    setIsConnecting(true);
    
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");

    // Open popup window for OAuth
    const popup = window.open(
      authUrl.toString(),
      "gmail-auth",
      "width=500,height=600,scrollbars=yes,resizable=yes"
    );

    // Listen for the callback
    const messageListener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      if (event.data.type === "GMAIL_AUTH_SUCCESS") {
        popup?.close();
        onTokenReceived(event.data.token);
        setIsConnecting(false);
        window.removeEventListener("message", messageListener);
        
        toast({
          title: "Gmail Connected",
          description: "Successfully connected to Gmail API",
        });
      } else if (event.data.type === "GMAIL_AUTH_ERROR") {
        popup?.close();
        setIsConnecting(false);
        window.removeEventListener("message", messageListener);
        
        toast({
          title: "Connection Failed",
          description: event.data.error,
          variant: "destructive",
        });
      }
    };

    window.addEventListener("message", messageListener);

    // Check if popup was closed manually
    const checkClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkClosed);
        setIsConnecting(false);
        window.removeEventListener("message", messageListener);
      }
    }, 1000);
  };

  // Method 2: Manual Token Entry (For testing/development)
  const handleManualToken = () => {
    if (!manualToken.trim()) {
      toast({
        title: "Error",
        description: "Please enter an access token",
        variant: "destructive",
      });
      return;
    }

    onTokenReceived(manualToken.trim());
    toast({
      title: "Token Added",
      description: "Gmail access token has been set",
    });
  };

  const testConnection = async () => {
    if (!currentToken) {
      toast({
        title: "No Token",
        description: "Please connect Gmail first",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
          },
        }
      );

      if (response.ok) {
        const profile = await response.json();
        toast({
          title: "Connection Test Successful",
          description: `Connected to ${profile.emailAddress}`,
        });
      } else {
        throw new Error("Invalid token or expired");
      }
    } catch (error) {
      toast({
        title: "Connection Test Failed",
        description: "Token may be invalid or expired",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* OAuth Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Connect Gmail (Recommended)
          </CardTitle>
          <CardDescription>
            Securely connect your Gmail account using OAuth 2.0
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>Setup Required:</strong> You need to configure Google OAuth credentials first.
              <a 
                href="#setup-guide" 
                className="text-blue-600 underline ml-1"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('setup-guide')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                View setup guide below
              </a>
            </p>
          </div>
          
          <Button 
            onClick={handleGoogleOAuth}
            disabled={isConnecting}
            className="w-full"
          >
            {isConnecting ? (
              "Connecting..."
            ) : (
              <>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect with Google
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Manual Token Method */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Manual Token Entry
          </CardTitle>
          <CardDescription>
            For testing or if you have an existing access token
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="manual-token">Gmail Access Token</Label>
            <Input
              id="manual-token"
              type="password"
              placeholder="Enter your Gmail access token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
            />
          </div>
          <Button 
            onClick={handleManualToken}
            disabled={!manualToken.trim()}
            variant="outline"
            className="w-full"
          >
            Set Token
          </Button>
        </CardContent>
      </Card>

      {/* Connection Status */}
      {currentToken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-green-600">
              ✅ Gmail token is set
            </div>
            <Button onClick={testConnection} variant="outline" size="sm">
              Test Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Setup Guide */}
      <Card id="setup-guide">
        <CardHeader>
          <CardTitle>Setup Guide</CardTitle>
          <CardDescription>
            How to get Gmail API credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm space-y-3">
            <div>
              <strong>1. Create Google Cloud Project:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Go to <a href="https://console.cloud.google.com/" target="_blank" className="text-blue-600 underline">Google Cloud Console</a></li>
                <li>• Create a new project</li>
              </ul>
            </div>
            
            <div>
              <strong>2. Enable Gmail API:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Go to "APIs & Services" → "Library"</li>
                <li>• Search for "Gmail API" and enable it</li>
              </ul>
            </div>
            
            <div>
              <strong>3. Create OAuth Credentials:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Go to "APIs & Services" → "Credentials"</li>
                <li>• Create "OAuth client ID" for web application</li>
                <li>• Add authorized redirect URI: <code className="bg-gray-100 px-1 rounded">{REDIRECT_URI}</code></li>
              </ul>
            </div>
            
            <div>
              <strong>4. Configure OAuth Consent:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Add required scopes: gmail.readonly</li>
                <li>• Add test users (your email)</li>
              </ul>
            </div>
            
            <div>
              <strong>5. Update Code:</strong>
              <ul className="ml-4 mt-1 space-y-1">
                <li>• Replace <code className="bg-gray-100 px-1 rounded">YOUR_GOOGLE_CLIENT_ID</code> with your actual client ID</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GmailAuth;

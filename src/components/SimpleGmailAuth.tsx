import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useSecureToken } from "@/hooks/useSecureToken";
import { Mail, CheckCircle, Loader2, ExternalLink } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";

const SimpleGmailAuth = () => {
  const { toast } = useToast();
  const { token: currentToken, loading: tokenLoading, saveToken, deleteToken, hasToken, refreshToken } = useSecureToken('gmail_access_token');
  const [isConnecting, setIsConnecting] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Google OAuth configuration - redirect to main app
  const GOOGLE_CLIENT_ID = "400227932479-de4fkijknsnsle6249ef48acvlt7lnkg.apps.googleusercontent.com";
  const REDIRECT_URI = "http://localhost:8080/"; // Try with trailing slash to match Google Cloud Console
  const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email"
  ].join(" ");

  // Handle OAuth callback when returning from Google
  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    console.log('OAuth callback detected:');
    console.log('Code:', code ? 'Present' : 'Not present');
    console.log('Error:', error);
    console.log('State:', state);
    console.log('Current URL:', window.location.href);
    console.log('Session storage gmail_auth_pending:', sessionStorage.getItem('gmail_auth_pending'));
    console.log('Current token state:', currentToken);
    console.log('Has token:', hasToken);
    console.log('Token loading:', tokenLoading);

    // Only process if we have parameters and haven't already processed this callback
    const hasProcessedCallback = sessionStorage.getItem('oauth_callback_processed');
    if (hasProcessedCallback && !code && !error) {
      console.log('OAuth callback already processed, skipping...');
      return;
    }

    // Check if this is a return from Gmail OAuth
    if (state === 'gmail_auth' || sessionStorage.getItem('gmail_auth_pending')) {
      sessionStorage.removeItem('gmail_auth_pending');
      sessionStorage.setItem('oauth_callback_processed', 'true');

      if (error) {
        console.error('OAuth error:', error);
        sessionStorage.removeItem('oauth_callback_processed');
        toast({
          title: "Authentication Failed",
          description: `OAuth Error: ${error}`,
          variant: "destructive",
        });
        // Clean up URL
        navigate('/', { replace: true });
        return;
      }

      if (code) {
        console.log('Exchanging code for token...');
        const testUri = sessionStorage.getItem('test_redirect_uri');
        sessionStorage.removeItem('test_redirect_uri');
        exchangeCodeForToken(code, testUri);
        return;
      }
    }
  }, [searchParams, navigate, toast]);

  const exchangeCodeForToken = async (code: string, testUri?: string | null) => {
    try {
      setIsConnecting(true);

      console.log('Exchanging code for token...');
      console.log('Code length:', code.length);
      console.log('Redirect URI being sent:', REDIRECT_URI);

      // Call Supabase Edge Function for token exchange
      const response = await fetch('https://olxlunpsizvfulumdxkl.supabase.co/functions/v1/gmail-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9seGx1bnBzaXp2ZnVsdW1keGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyNzI1OTUsImV4cCI6MjA3Mjg0ODU5NX0.3eYzqsUUYwvnM3JOMBZ588p1oavhpFyzwaHnGle25E0`
        },
        body: JSON.stringify({
          code,
          redirect_uri: REDIRECT_URI
        }),
      });

      console.log('Supabase response status:', response.status);
      console.log('Supabase response headers:', Object.fromEntries(response.headers.entries()));

      const data = await response.json();
      console.log('Supabase response data:', data);

      if (data.success && data.access_token) {
        console.log('Token exchange successful!');

        // Always save to localStorage as primary storage for now
        console.log('Saving token to localStorage...');
        localStorage.setItem('gmail_access_token', data.access_token);
        localStorage.setItem('gmail_access_token_expires', (Date.now() + 3600000).toString()); // 1 hour

        // Also try secure storage (won't affect the UI if it fails)
        try {
          await saveToken(data.access_token, 3600);
        } catch (saveError) {
          console.warn('Secure token storage failed, but localStorage worked:', saveError);
        }

        toast({
          title: "Gmail Connected",
          description: "Successfully connected to Gmail API",
        });
      } else {
        console.error('Token exchange failed:', data);
        throw new Error(data.error || 'No access token received');
      }
    } catch (error: any) {
      console.error('Error in exchangeCodeForToken:', error);
      toast({
        title: "Connection Failed",
        description: error.message || 'Failed to exchange code for token',
        variant: "destructive",
      });
    } finally {
      setIsConnecting(false);
      // Clean up URL
      navigate('/', { replace: true });
    }
  };

  // Test different redirect URIs
  const testRedirectUri = (testUri: string) => {
    console.log('Testing redirect URI:', testUri);
    sessionStorage.removeItem('oauth_callback_processed'); // Clear any previous callback processing flag
    
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", testUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", "gmail_auth");

    console.log('Test OAuth URL:', authUrl.toString());
    
    // Store auth state in sessionStorage to handle return
    sessionStorage.setItem('gmail_auth_pending', 'true');
    sessionStorage.setItem('test_redirect_uri', testUri);
    
    // Redirect to Google OAuth
    window.location.href = authUrl.toString();
  };

  // Automatic OAuth Flow - redirect to Google
  const handleGoogleOAuth = () => {
    console.log('Starting Google OAuth flow...');
    sessionStorage.removeItem('oauth_callback_processed'); // Clear any previous callback processing flag
    sessionStorage.setItem('gmail_auth_pending', 'true');

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", "gmail_auth"); // Add state parameter for security

    console.log('Generated OAuth URL:', authUrl.toString());
    console.log('OAuth URL redirect_uri param:', authUrl.searchParams.get('redirect_uri'));

    // Redirect to Google OAuth
    console.log('Redirecting to Google OAuth...');
    window.location.href = authUrl.toString();
  };

  const handleDisconnect = async () => {
    try {
      await deleteToken();
      toast({
        title: "Disconnected",
        description: "Gmail connection removed successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (tokenLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      {hasToken && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-800 font-medium">Gmail Connected</span>
              </div>
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={refreshToken}
                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  Refresh
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDisconnect}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Disconnect
                </Button>
              </div>
            </div>
            <p className="text-green-700 text-sm mt-1">
              Token: {currentToken.substring(0, 20)}...
            </p>
            <p className="text-green-700 text-xs mt-1">
              Status: Connected and ready to sync emails
            </p>
          </CardContent>
        </Card>
      )}

      {/* Automatic OAuth Flow */}
      {!hasToken && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Mail className="h-5 w-5" />
              <span>Connect Gmail Account</span>
            </CardTitle>
            <CardDescription>
              Connect your Gmail account automatically to sync insurance carrier emails
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Automatic Setup:</strong> Click the button below to securely connect your Gmail account. 
                You'll be redirected to Google to authorize access, then automatically returned to this page.
              </p>
            </div>

            <Button 
              onClick={handleGoogleOAuth}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Connecting to Google...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Connect with Google Gmail
                </>
              )}
            </Button>

            {/* Debug buttons for testing different redirect URIs */}
            <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">Debug: Try different redirect URIs</p>
              <div className="flex space-x-2">
                <Button 
                  onClick={() => testRedirectUri("http://localhost:8080/")}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  Test localhost:8080/
                </Button>
                <Button 
                  onClick={() => testRedirectUri("http://127.0.0.1:8080/")}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  Test 127.0.0.1:8080/
                </Button>
                <Button 
                  onClick={() => testRedirectUri("http://[::1]:8080/")}
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                >
                  Test [::1]:8080/
                </Button>
              </div>
            </div>

            {/* Debug info */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-2">Debug Info:</p>
              <div className="text-xs space-y-1">
                <p>Token Loading: {tokenLoading ? 'Yes' : 'No'}</p>
                <p>Has Token: {hasToken ? 'Yes' : 'No'}</p>
                <p>Is Connecting: {isConnecting ? 'Yes' : 'No'}</p>
                <p>Token Length: {currentToken.length}</p>
                <p>localStorage Token: {localStorage.getItem('gmail_access_token') ? 'Present' : 'Not present'}</p>
                <p>localStorage Expires: {localStorage.getItem('gmail_access_token_expires') ? 'Present' : 'Not present'}</p>
                <p>Current Time: {Date.now()}</p>
                <p>Expires Time: {localStorage.getItem('gmail_access_token_expires') ? parseInt(localStorage.getItem('gmail_access_token_expires')!) : 'N/A'}</p>
              </div>
              <Button 
                onClick={() => {
                  console.log('Manual localStorage check:');
                  console.log('gmail_access_token:', localStorage.getItem('gmail_access_token'));
                  console.log('gmail_access_token_expires:', localStorage.getItem('gmail_access_token_expires'));
                  console.log('gmail_token_expires (old key):', localStorage.getItem('gmail_token_expires'));
                }}
                variant="outline" 
                size="sm"
                className="mt-2 text-xs"
              >
                Check localStorage
              </Button>
              <Button 
                onClick={() => {
                  // Set a test token to verify loading works
                  const testToken = 'ya29.test_token_' + Date.now();
                  localStorage.setItem('gmail_access_token', testToken);
                  localStorage.setItem('gmail_access_token_expires', (Date.now() + 3600000).toString());
                  console.log('Test token set in localStorage:', testToken);
                  // Refresh the token state
                  window.location.reload();
                }}
                variant="outline" 
                size="sm"
                className="mt-2 ml-2 text-xs"
              >
                Set Test Token
              </Button>
            </div>

            <div className="text-xs text-muted-foreground text-center">
              <p>You'll be redirected to Google to sign in and grant permissions.</p>
              <p>This app will only access emails from insurance carriers.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SimpleGmailAuth;

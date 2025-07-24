import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const GmailCallback = () => {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      // Send error message to parent window
      window.opener?.postMessage({
        type: 'GMAIL_AUTH_ERROR',
        error: error
      }, window.location.origin);
      window.close();
      return;
    }

    if (code) {
      // Exchange authorization code for access token
      exchangeCodeForToken(code);
    }
  }, [searchParams]);

  const exchangeCodeForToken = async (code: string) => {
    try {
      // Call Supabase Edge Function for token exchange
      const response = await fetch('https://gpeyczvopatbsssvaion.supabase.co/functions/v1/gmail-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZXljenZvcGF0YnNzc3ZhaW9uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNzUxMTIsImV4cCI6MjA2ODg1MTExMn0.1t2OyhEqhZe54IbgMKPlR7KElNZXOmNGaF9jzf_Ocjk`
        },
        body: JSON.stringify({ 
          code,
          redirect_uri: window.location.origin + '/auth/callback'
        }),
      });

      const data = await response.json();

      if (data.success && data.access_token) {
        // Send token to parent window
        window.opener?.postMessage({
          type: 'GMAIL_AUTH_SUCCESS',
          token: data.access_token
        }, window.location.origin);
      } else {
        throw new Error(data.error || 'No access token received');
      }
    } catch (error) {
      window.opener?.postMessage({
        type: 'GMAIL_AUTH_ERROR',
        error: 'Failed to exchange code for token'
      }, window.location.origin);
    }
    
    window.close();
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Connecting to Gmail...</h2>
        <p className="text-gray-600">Please wait while we complete the authentication.</p>
      </div>
    </div>
  );
};

export default GmailCallback;

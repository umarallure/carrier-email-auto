import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecureToken {
  token: string;
  expires_at: string | null;
}

export const useSecureToken = (tokenType: string) => {
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Load token on mount
  useEffect(() => {
    loadToken();
  }, [tokenType]);

  const loadToken = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Loading token for type:', tokenType);

      const { data, error } = await supabase.functions.invoke(`secure-token/retrieve?token_type=${encodeURIComponent(tokenType)}`, {
        method: 'GET'
      });

      console.log('Secure token retrieve response:', { data, error });

      if (error) {
        if (error.message?.includes('Token not found') || error.message?.includes('Token expired')) {
          // Token doesn't exist or expired, this is not an error
          console.log('Token not found or expired, checking localStorage fallback');
          setToken('');
          return;
        }
        throw error;
      }

      if (data?.success && data?.token) {
        console.log('Token loaded from secure storage');
        setToken(data.token);
      } else {
        // Try localStorage fallback
        console.log('No token from secure storage, trying localStorage fallback');
        const localToken = localStorage.getItem(`${tokenType}`);
        const localExpires = localStorage.getItem(`${tokenType}_expires`);

        console.log('localStorage debug:');
        console.log('- tokenType:', tokenType);
        console.log('- localToken key:', `${tokenType}`);
        console.log('- localExpires key:', `${tokenType}_expires`);
        console.log('- localToken value:', localToken);
        console.log('- localExpires value:', localExpires);

        // Check for old key format and migrate if needed
        const oldExpiresKey = tokenType.replace('_access_token', '_token') + '_expires';
        const oldExpires = localStorage.getItem(oldExpiresKey);
        if (!localExpires && oldExpires) {
          console.log('Found old expires key format, migrating...');
          localStorage.setItem(`${tokenType}_expires`, oldExpires);
          localStorage.removeItem(oldExpiresKey);
        }

        console.log('localStorage values:', { localToken: localToken ? 'Present' : 'Not present', localExpires });

        if (localToken && localExpires) {
          const expiresTime = parseInt(localExpires);
          if (Date.now() < expiresTime) {
            console.log('Valid token found in localStorage, setting token');
            setToken(localToken);
            return;
          } else {
            // Token expired, clean up
            console.log('Token in localStorage has expired, cleaning up');
            localStorage.removeItem(`${tokenType}`);
            localStorage.removeItem(`${tokenType}_expires`);
          }
        }
        setToken('');
      }
    } catch (err: any) {
      console.error('Error loading secure token:', err);
      setError(err.message);

      // Try localStorage fallback on error
      console.log('Error occurred, trying localStorage fallback');
      const localToken = localStorage.getItem(`${tokenType}`);
      const localExpires = localStorage.getItem(`${tokenType}_expires`);

      console.log('localStorage fallback debug:');
      console.log('- tokenType:', tokenType);
      console.log('- localToken key:', `${tokenType}`);
      console.log('- localExpires key:', `${tokenType}_expires`);
      console.log('- localToken value:', localToken);
      console.log('- localExpires value:', localExpires);

      // Check for old key format and migrate if needed
      const oldExpiresKey = tokenType.replace('_access_token', '_token') + '_expires';
      const oldExpires = localStorage.getItem(oldExpiresKey);
      if (!localExpires && oldExpires) {
        console.log('Found old expires key format in error handler, migrating...');
        localStorage.setItem(`${tokenType}_expires`, oldExpires);
        localStorage.removeItem(oldExpiresKey);
      }

      console.log('localStorage fallback values:', { localToken: localToken ? 'Present' : 'Not present', localExpires });

      if (localToken && localExpires) {
        const expiresTime = parseInt(localExpires);
        if (Date.now() < expiresTime) {
          console.log('Valid token found in localStorage fallback, setting token');
          setToken(localToken);
          return;
        } else {
          // Token expired, clean up
          console.log('Token in localStorage has expired, cleaning up');
          localStorage.removeItem(`${tokenType}`);
          localStorage.removeItem(`${tokenType}_expires`);
        }
      }
      console.log('No valid token found anywhere, setting empty token');
      setToken('');
    } finally {
      setLoading(false);
      console.log('Token loading complete, final state:', { token: token, loading: false });
    }
  };

  const saveToken = async (newToken: string, expiresIn?: number) => {
    try {
      setError(null);

      const { data, error } = await supabase.functions.invoke('secure-token/store', {
        body: {
          token_type: tokenType,
          token: newToken,
          expires_in: expiresIn
        }
      });

      if (error) throw error;

      // Check if token was actually stored successfully
      if (data?.success) {
        console.log('Token stored successfully in secure storage');
        setToken(newToken);
        toast({
          title: "Token saved securely",
          description: "Your token has been encrypted and stored securely.",
        });
        return; // Success, don't use fallback
      } else {
        console.log('Secure storage returned success=false, using localStorage fallback');
        throw new Error('Secure storage failed');
      }
    } catch (err: any) {
      console.error('Error saving secure token:', err);
      setError(err.message);

      // Always use localStorage fallback
      console.log('Using localStorage fallback for token storage');
      localStorage.setItem(`${tokenType}`, newToken);
      if (expiresIn) {
        localStorage.setItem(`${tokenType}_expires`, (Date.now() + expiresIn * 1000).toString());
      }
      setToken(newToken);

      toast({
        title: "Token saved (fallback)",
        description: "Token stored locally due to secure storage issue.",
      });
    }
  };

  const deleteToken = async () => {
    try {
      setError(null);

      const { data, error } = await supabase.functions.invoke('secure-token/delete', {
        body: {
          token_type: tokenType
        }
      });

      if (error) throw error;

      if (data?.success) {
        setToken('');
        toast({
          title: "Token deleted",
          description: "Your token has been securely deleted.",
        });
      }
    } catch (err: any) {
      console.error('Error deleting secure token:', err);
      setError(err.message);

      // Clean up localStorage anyway
      localStorage.removeItem(`${tokenType}`);
      localStorage.removeItem(`${tokenType}_expires`);
      setToken('');

      toast({
        title: "Token deleted (fallback)",
        description: "Token removed from local storage.",
      });
    }
  };

  const refreshToken = async () => {
    await loadToken();
  };

  return {
    token,
    loading,
    error,
    saveToken,
    deleteToken,
    refreshToken,
    hasToken: token.length > 0
  };
};

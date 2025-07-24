import { useEffect, useState } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Try local signout first (clears local storage)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      if (error) {
        console.warn('Auth signout error (continuing with local cleanup):', error);
      }
      
      // Force clear local state regardless of API response
      setUser(null);
      setSession(null);
      
      // Clear any remaining auth data from localStorage
      localStorage.removeItem('supabase.auth.token');
      
      // Redirect to auth page
      window.location.href = '/auth';
      
    } catch (error) {
      console.error('Signout error:', error);
      // Force logout locally even if API call fails
      setUser(null);
      setSession(null);
      localStorage.clear();
      window.location.href = '/auth';
    }
  };

  return {
    user,
    session,
    loading,
    signOut,
  };
};
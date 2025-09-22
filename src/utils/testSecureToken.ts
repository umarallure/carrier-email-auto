// Test the secure-token function
import { supabase } from '@/integrations/supabase/client';

export async function testSecureTokenFunction() {
  console.log('Testing secure-token function...');
  
  try {
    // Test a simple call to the function
    const { data, error } = await supabase.functions.invoke('secure-token/retrieve?token_type=test', {
      method: 'GET'
    });
    
    console.log('Function response:', { data, error });
    
    if (error) {
      console.error('Function call failed:', error);
      return { success: false, error: error.message };
    }
    
    // Even if no token is found, this means the function is working
    console.log('Function is accessible');
    return { success: true, message: 'Function is working' };
    
  } catch (err) {
    console.error('Function test failed:', err);
    return { success: false, error: err.message };
  }
}

// Call this function from browser console to test
if (typeof window !== 'undefined') {
  (window as any).testSecureTokenFunction = testSecureTokenFunction;
}

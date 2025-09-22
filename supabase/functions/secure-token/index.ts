import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-my-custom-header',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

// Simple encryption/decryption using Web Crypto API
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function encryptToken(token: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-in-production'),
    'AES-GCM',
    false,
    ['encrypt']
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

async function decryptToken(encryptedToken: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(Deno.env.get('TOKEN_ENCRYPTION_KEY') || 'default-key-change-in-production'),
    'AES-GCM',
    false,
    ['decrypt']
  );

  const combined = new Uint8Array(atob(encryptedToken).split('').map(c => c.charCodeAt(0)));
  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encrypted
  );

  return decoder.decode(decrypted);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('APP_URL') ?? '',
      Deno.env.get('ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    if (req.method === 'POST' && action === 'store') {
      const { token_type, token, expires_in } = await req.json();

      if (!token_type || !token) {
        throw new Error('token_type and token are required');
      }

      // Encrypt the token
      const encryptedToken = await encryptToken(token);

      // Calculate expiration date
      const expiresAt = expires_in
        ? new Date(Date.now() + (expires_in * 1000))
        : null;

      // Store the encrypted token
      const { data, error } = await supabaseClient
        .from('secure_tokens')
        .upsert({
          user_id: user.id,
          token_type,
          encrypted_token: encryptedToken,
          expires_at: expiresAt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,token_type'
        });

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        message: 'Token stored securely'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });

    } else if (req.method === 'GET' && action === 'retrieve') {
      const tokenType = url.searchParams.get('token_type');

      if (!tokenType) {
        throw new Error('token_type parameter is required');
      }

      // Retrieve the encrypted token
      const { data, error } = await supabaseClient
        .from('secure_tokens')
        .select('encrypted_token, expires_at')
        .eq('user_id', user.id)
        .eq('token_type', tokenType)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return new Response(JSON.stringify({
            success: false,
            message: 'Token not found'
          }), {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
        throw error;
      }

      // Check if token is expired
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        // Delete expired token
        await supabaseClient
          .from('secure_tokens')
          .delete()
          .eq('user_id', user.id)
          .eq('token_type', tokenType);

        return new Response(JSON.stringify({
          success: false,
          message: 'Token expired'
        }), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Decrypt the token
      const decryptedToken = await decryptToken(data.encrypted_token);

      return new Response(JSON.stringify({
        success: true,
        token: decryptedToken,
        expires_at: data.expires_at
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });

    } else if (req.method === 'DELETE' && action === 'delete') {
      const { token_type } = await req.json();

      if (!token_type) {
        throw new Error('token_type is required');
      }

      const { error } = await supabaseClient
        .from('secure_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token_type', token_type);

      if (error) throw error;

      return new Response(JSON.stringify({
        success: true,
        message: 'Token deleted'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    return new Response(JSON.stringify({
      error: 'Invalid action'
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('Secure token error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

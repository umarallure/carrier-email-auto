-- Create secure_tokens table for storing sensitive data
CREATE TABLE public.secure_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  token_type TEXT NOT NULL, -- 'gmail_access_token', 'gmail_refresh_token', etc.
  encrypted_token TEXT NOT NULL, -- Encrypted token data
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.secure_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for secure_tokens table
CREATE POLICY "Users can view their own tokens"
ON public.secure_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tokens"
ON public.secure_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
ON public.secure_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
ON public.secure_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_secure_tokens_user_id ON public.secure_tokens(user_id);
CREATE INDEX idx_secure_tokens_type ON public.secure_tokens(token_type);
CREATE INDEX idx_secure_tokens_expires_at ON public.secure_tokens(expires_at);

-- Create function to update timestamps
CREATE TRIGGER update_secure_tokens_updated_at
  BEFORE UPDATE ON public.secure_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create gmail_tokens table for storing Gmail OAuth tokens
CREATE TABLE public.gmail_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.gmail_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for gmail_tokens table
CREATE POLICY "Users can view their own Gmail tokens"
ON public.gmail_tokens
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Gmail tokens"
ON public.gmail_tokens
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Gmail tokens"
ON public.gmail_tokens
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Gmail tokens"
ON public.gmail_tokens
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_gmail_tokens_user_id ON public.gmail_tokens(user_id);
CREATE INDEX idx_gmail_tokens_expires_at ON public.gmail_tokens(expires_at);

-- Create function to update timestamps
CREATE TRIGGER update_gmail_tokens_updated_at
  BEFORE UPDATE ON public.gmail_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one token per user (replace old tokens)
CREATE UNIQUE INDEX idx_gmail_tokens_user_unique ON public.gmail_tokens(user_id);
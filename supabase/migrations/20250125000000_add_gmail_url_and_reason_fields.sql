-- Add gmail_url column to emails table
ALTER TABLE public.emails 
ADD COLUMN gmail_url TEXT;

-- Create index on gmail_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_emails_gmail_url ON public.emails(gmail_url);

-- Add comment to describe the new columns
COMMENT ON COLUMN public.emails.gmail_url IS 'Direct link to the Gmail email in the browser';

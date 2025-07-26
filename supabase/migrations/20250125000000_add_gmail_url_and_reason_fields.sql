-- Add gmail_url column to emails table
ALTER TABLE public.emails 
ADD COLUMN gmail_url TEXT;

-- Add document_links column to email_analysis_results table
ALTER TABLE public.email_analysis_results 
ADD COLUMN document_links JSONB;

-- Create index on gmail_url for faster lookups
CREATE INDEX IF NOT EXISTS idx_emails_gmail_url ON public.emails(gmail_url);

-- Create index on document_links for faster lookups
CREATE INDEX IF NOT EXISTS idx_analysis_document_links ON public.email_analysis_results USING GIN(document_links);

-- Add comment to describe the new columns
COMMENT ON COLUMN public.emails.gmail_url IS 'Direct link to the Gmail email in the browser';
COMMENT ON COLUMN public.email_analysis_results.document_links IS 'JSON array of document URLs found in the email';

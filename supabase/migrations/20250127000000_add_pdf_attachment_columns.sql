-- Add columns for PDF attachment storage and extraction
ALTER TABLE public.emails 
ADD COLUMN pdf_attachments JSONB,  -- Store PDF attachment metadata and base64 content
ADD COLUMN pdf_extracted_content TEXT;  -- Store extracted text content from PDFs

-- Add columns to analysis results for PDF-specific data
ALTER TABLE public.email_analysis_results
ADD COLUMN pdf_analysis JSONB;  -- Store structured analysis of PDF content

-- Create index for PDF content search
CREATE INDEX idx_emails_pdf_content ON public.emails USING gin (to_tsvector('english', pdf_extracted_content));

-- Add comment for documentation
COMMENT ON COLUMN public.emails.pdf_attachments IS 'JSONB array storing PDF attachment metadata including filename, size, password_protected flag, and base64 content';
COMMENT ON COLUMN public.emails.pdf_extracted_content IS 'Extracted text content from all PDF attachments combined';
COMMENT ON COLUMN public.email_analysis_results.pdf_analysis IS 'Structured analysis of PDF content including policy details, dates, amounts, etc.';

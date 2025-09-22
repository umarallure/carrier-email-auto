-- Add carrier column to email_analysis_results table
ALTER TABLE public.email_analysis_results
ADD COLUMN IF NOT EXISTS carrier TEXT;

-- Add comment for the carrier column
COMMENT ON COLUMN public.email_analysis_results.carrier IS 'Insurance carrier name (e.g., Aetna, Transamerica, etc.)';

-- Create index for the carrier column for better query performance
CREATE INDEX IF NOT EXISTS idx_email_analysis_results_carrier ON public.email_analysis_results(carrier);
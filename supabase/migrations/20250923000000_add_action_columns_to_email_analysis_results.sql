-- Add new columns to email_analysis_results table for action tracking
ALTER TABLE public.email_analysis_results
ADD COLUMN IF NOT EXISTS action_code TEXT,
ADD COLUMN IF NOT EXISTS ghl_note TEXT,
ADD COLUMN IF NOT EXISTS ghl_stage TEXT;

-- Add comments for the new columns
COMMENT ON COLUMN public.email_analysis_results.action_code IS 'Custom action code for tracking email analysis actions';
COMMENT ON COLUMN public.email_analysis_results.ghl_note IS 'GoHighLevel note/comment associated with this analysis';
COMMENT ON COLUMN public.email_analysis_results.ghl_stage IS 'GoHighLevel stage information for this analysis';

-- Create indexes for the new columns for better performance
CREATE INDEX IF NOT EXISTS idx_email_analysis_results_action_code ON public.email_analysis_results(action_code);
CREATE INDEX IF NOT EXISTS idx_email_analysis_results_ghl_stage ON public.email_analysis_results(ghl_stage);
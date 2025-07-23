-- Add unique constraint to email_id in email_analysis_results table
-- This allows upsert operations to work correctly

ALTER TABLE public.email_analysis_results 
ADD CONSTRAINT unique_email_analysis UNIQUE (email_id);

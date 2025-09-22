-- Update email_analysis_results category check constraint to include all valid categories
ALTER TABLE public.email_analysis_results
DROP CONSTRAINT IF EXISTS email_analysis_results_category_check;

ALTER TABLE public.email_analysis_results
ADD CONSTRAINT email_analysis_results_category_check
CHECK (category IN (
  'Pending',
  'Failed payment',
  'Chargeback',
  'Cancelled policy',
  'Post Underwriting Update',
  'Pending Lapse',
  'Declined/Closed as Incomplete',
  'Policy inquiry',
  'Claim submitted',
  'Payment confirmation',
  'Policy update',
  'Document request'
));
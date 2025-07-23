-- Create emails table for storing raw email data
CREATE TABLE public.emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  carrier TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT,
  attachments TEXT[], -- Array of attachment URLs
  received_date TIMESTAMP WITH TIME ZONE NOT NULL,
  gmail_id TEXT UNIQUE NOT NULL,
  carrier_label TEXT NOT NULL,
  status TEXT DEFAULT 'unprocessed' CHECK (status IN ('unprocessed', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create email_analysis_results table for storing AI analysis
CREATE TABLE public.email_analysis_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  customer_name TEXT,
  policy_id TEXT,
  email_update_date DATE,
  summary TEXT,
  suggested_action TEXT,
  category TEXT CHECK (category IN ('Pending', 'Failed payment', 'Chargeback', 'Cancelled policy', 'Post Underwriting Update', 'Pending Lapse', 'Declined/Closed as Incomplete')),
  subcategory TEXT,
  analysis_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_reviewed BOOLEAN DEFAULT false,
  review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_analysis_results ENABLE ROW LEVEL SECURITY;

-- Create policies for emails table
CREATE POLICY "Users can view their own emails" 
ON public.emails 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own emails" 
ON public.emails 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own emails" 
ON public.emails 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own emails" 
ON public.emails 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for email_analysis_results table
CREATE POLICY "Users can view analysis results for their emails" 
ON public.email_analysis_results 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_analysis_results.email_id 
    AND emails.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create analysis results for their emails" 
ON public.email_analysis_results 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_analysis_results.email_id 
    AND emails.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update analysis results for their emails" 
ON public.email_analysis_results 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_analysis_results.email_id 
    AND emails.user_id = auth.uid()
  )
);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON public.emails
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_analysis_results_updated_at
  BEFORE UPDATE ON public.email_analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_emails_user_id ON public.emails(user_id);
CREATE INDEX idx_emails_carrier ON public.emails(carrier);
CREATE INDEX idx_emails_status ON public.emails(status);
CREATE INDEX idx_emails_received_date ON public.emails(received_date);
CREATE INDEX idx_email_analysis_results_email_id ON public.email_analysis_results(email_id);
CREATE INDEX idx_email_analysis_results_category ON public.email_analysis_results(category);
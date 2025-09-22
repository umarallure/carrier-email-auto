-- Create email_actions table for converting analyzed emails into actionable tasks
-- Each customer mentioned in an email becomes a separate action/task entry
CREATE TABLE public.email_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Reference to original email and analysis
  email_id UUID NOT NULL REFERENCES public.emails(id) ON DELETE CASCADE,
  analysis_id UUID NOT NULL REFERENCES public.email_analysis_results(id) ON DELETE CASCADE,
  
  -- Customer information (from analysis)
  customer_name TEXT NOT NULL,
  policy_id TEXT,
  
  -- Email metadata (duplicated for easy access)
  email_subject TEXT NOT NULL,
  email_received_date TIMESTAMP WITH TIME ZONE NOT NULL,
  carrier TEXT NOT NULL,
  carrier_label TEXT NOT NULL,
  
  -- Analysis data (duplicated for easy access)
  email_update_date DATE,
  summary TEXT,
  suggested_action TEXT,
  category TEXT CHECK (category IN ('Pending', 'Failed payment', 'Chargeback', 'Cancelled policy', 'Post Underwriting Update', 'Pending Lapse', 'Declined/Closed as Incomplete')),
  subcategory TEXT,
  
  -- New action-specific fields
  action_code TEXT, -- Custom action code for tracking
  ghl_note TEXT, -- GoHighLevel note/comment
  ghl_stage_change TEXT, -- GoHighLevel stage change information
  
  -- Action status and workflow
  action_status TEXT DEFAULT 'pending' CHECK (action_status IN ('pending', 'in_progress', 'completed', 'cancelled', 'on_hold')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID, -- Can be assigned to a specific user
  due_date DATE, -- Optional due date for the action
  
  -- Processing metadata
  is_processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID,
  
  -- Additional fields for flexibility
  notes TEXT, -- Internal notes for the action
  external_reference TEXT, -- External system reference (like GHL contact ID)
  tags TEXT[], -- Array of tags for categorization
  
  -- Standard timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure we can link back to the user through email
  CONSTRAINT fk_email_user FOREIGN KEY (email_id) REFERENCES public.emails(id)
);

-- Enable Row Level Security
ALTER TABLE public.email_actions ENABLE ROW LEVEL SECURITY;

-- Create policies for email_actions table
CREATE POLICY "Users can view actions for their emails" 
ON public.email_actions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_actions.email_id 
    AND emails.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create actions for their emails" 
ON public.email_actions 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_actions.email_id 
    AND emails.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update actions for their emails" 
ON public.email_actions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_actions.email_id 
    AND emails.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete actions for their emails" 
ON public.email_actions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.emails 
    WHERE emails.id = email_actions.email_id 
    AND emails.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_email_actions_updated_at
  BEFORE UPDATE ON public.email_actions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_email_actions_email_id ON public.email_actions(email_id);
CREATE INDEX idx_email_actions_analysis_id ON public.email_actions(analysis_id);
CREATE INDEX idx_email_actions_customer_name ON public.email_actions(customer_name);
CREATE INDEX idx_email_actions_policy_id ON public.email_actions(policy_id);
CREATE INDEX idx_email_actions_action_status ON public.email_actions(action_status);
CREATE INDEX idx_email_actions_priority ON public.email_actions(priority);
CREATE INDEX idx_email_actions_category ON public.email_actions(category);
CREATE INDEX idx_email_actions_carrier ON public.email_actions(carrier);
CREATE INDEX idx_email_actions_assigned_to ON public.email_actions(assigned_to);
CREATE INDEX idx_email_actions_due_date ON public.email_actions(due_date);
CREATE INDEX idx_email_actions_created_at ON public.email_actions(created_at);
CREATE INDEX idx_email_actions_is_processed ON public.email_actions(is_processed);

-- Create a function to automatically create action entries from analysis results
CREATE OR REPLACE FUNCTION public.create_action_from_analysis()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract email information
  INSERT INTO public.email_actions (
    email_id,
    analysis_id,
    customer_name,
    policy_id,
    email_subject,
    email_received_date,
    carrier,
    carrier_label,
    email_update_date,
    summary,
    suggested_action,
    category,
    subcategory
  )
  SELECT 
    NEW.email_id,
    NEW.id,
    NEW.customer_name,
    NEW.policy_id,
    e.subject,
    e.received_date,
    e.carrier,
    e.carrier_label,
    NEW.email_update_date,
    NEW.summary,
    NEW.suggested_action,
    NEW.category,
    NEW.subcategory
  FROM public.emails e
  WHERE e.id = NEW.email_id
  AND NEW.customer_name IS NOT NULL; -- Only create actions when we have customer info
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create actions when analysis is inserted
CREATE TRIGGER create_action_on_analysis_insert
  AFTER INSERT ON public.email_analysis_results
  FOR EACH ROW
  EXECUTE FUNCTION public.create_action_from_analysis();

-- Add some helpful views for common queries
CREATE VIEW public.pending_actions AS
SELECT 
  ea.*,
  e.user_id,
  e.gmail_id,
  e.body as email_body
FROM public.email_actions ea
JOIN public.emails e ON ea.email_id = e.id
WHERE ea.action_status = 'pending'
ORDER BY ea.priority DESC, ea.created_at ASC;

CREATE VIEW public.high_priority_actions AS
SELECT 
  ea.*,
  e.user_id,
  e.gmail_id
FROM public.email_actions ea
JOIN public.emails e ON ea.email_id = e.id
WHERE ea.priority IN ('high', 'urgent')
AND ea.action_status IN ('pending', 'in_progress')
ORDER BY ea.priority DESC, ea.due_date ASC NULLS LAST;

-- Add RLS policies for the views
ALTER VIEW public.pending_actions SET (security_invoker = on);
ALTER VIEW public.high_priority_actions SET (security_invoker = on);
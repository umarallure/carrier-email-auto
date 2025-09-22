-- Check if email_actions table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'email_actions';

-- If it doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.email_actions (
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
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_actions ENABLE ROW LEVEL SECURITY;

-- Create policies for email_actions table (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view actions for their emails' AND tablename = 'email_actions') THEN
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
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create actions for their emails' AND tablename = 'email_actions') THEN
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
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update actions for their emails' AND tablename = 'email_actions') THEN
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
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete actions for their emails' AND tablename = 'email_actions') THEN
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
    END IF;
END $$;

-- Create indexes for better performance (only if they don't exist)
CREATE INDEX IF NOT EXISTS idx_email_actions_email_id ON public.email_actions(email_id);
CREATE INDEX IF NOT EXISTS idx_email_actions_analysis_id ON public.email_actions(analysis_id);
CREATE INDEX IF NOT EXISTS idx_email_actions_customer_name ON public.email_actions(customer_name);
CREATE INDEX IF NOT EXISTS idx_email_actions_policy_id ON public.email_actions(policy_id);
CREATE INDEX IF NOT EXISTS idx_email_actions_action_status ON public.email_actions(action_status);
CREATE INDEX IF NOT EXISTS idx_email_actions_priority ON public.email_actions(priority);
CREATE INDEX IF NOT EXISTS idx_email_actions_category ON public.email_actions(category);
CREATE INDEX IF NOT EXISTS idx_email_actions_carrier ON public.email_actions(carrier);
CREATE INDEX IF NOT EXISTS idx_email_actions_assigned_to ON public.email_actions(assigned_to);
CREATE INDEX IF NOT EXISTS idx_email_actions_due_date ON public.email_actions(due_date);
CREATE INDEX IF NOT EXISTS idx_email_actions_created_at ON public.email_actions(created_at);
CREATE INDEX IF NOT EXISTS idx_email_actions_is_processed ON public.email_actions(is_processed);

-- Create trigger for automatic timestamp updates (only if it doesn't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_email_actions_updated_at') THEN
        CREATE TRIGGER update_email_actions_updated_at
          BEFORE UPDATE ON public.email_actions
          FOR EACH ROW
          EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Verify table creation
SELECT 'email_actions table created successfully' as result;
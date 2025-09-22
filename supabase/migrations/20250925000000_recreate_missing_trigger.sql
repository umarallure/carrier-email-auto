-- Recreate the missing trigger for automatic action creation
-- This trigger should fire after INSERT on email_analysis_results

-- First, ensure the function exists
CREATE OR REPLACE FUNCTION public.create_action_from_analysis()
RETURNS TRIGGER AS $$
DECLARE
  customer_names TEXT[];
  policy_ids TEXT[];
  customer_count INTEGER;
  policy_count INTEGER;
  i INTEGER;
  current_customer_name TEXT;
  current_policy_id TEXT;
BEGIN
  -- Only create actions when we have customer info
  IF NEW.customer_name IS NULL OR NEW.customer_name = '' THEN
    RETURN NEW;
  END IF;

  -- Split comma-separated customer names and policy IDs
  customer_names := string_to_array(trim(NEW.customer_name), ',');
  policy_ids := CASE
    WHEN NEW.policy_id IS NOT NULL AND NEW.policy_id != ''
    THEN string_to_array(trim(NEW.policy_id), ',')
    ELSE NULL
  END;

  -- Get the count of customers
  customer_count := array_length(customer_names, 1);
  policy_count := CASE WHEN policy_ids IS NOT NULL THEN array_length(policy_ids, 1) ELSE 0 END;

  -- Create action entries for each customer
  FOR i IN 1..customer_count LOOP
    current_customer_name := trim(customer_names[i]);
    current_policy_id := CASE
      WHEN policy_ids IS NOT NULL AND i <= policy_count THEN trim(policy_ids[i])
      ELSE NULL
    END;

    -- Skip empty customer names
    IF current_customer_name != '' THEN
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
        subcategory,
        action_code,
        ghl_note,
        ghl_stage_change
      )
      SELECT
        NEW.email_id,
        NEW.id,
        current_customer_name,
        current_policy_id,
        e.subject,
        e.received_date,
        e.carrier,
        e.carrier_label,
        NEW.email_update_date,
        NEW.summary,
        NEW.suggested_action,
        NEW.category,
        NEW.subcategory,
        NEW.action_code,
        NEW.ghl_note,
        NEW.ghl_stage
      FROM public.emails e
      WHERE e.id = NEW.email_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'create_action_on_analysis_insert') THEN
        CREATE TRIGGER create_action_on_analysis_insert
          AFTER INSERT ON public.email_analysis_results
          FOR EACH ROW
          EXECUTE FUNCTION public.create_action_from_analysis();
    END IF;
END $$;

-- Test the trigger by manually calling it on existing data that should have triggered it
-- This will create actions for any recent analyses that don't have actions yet
DO $$
DECLARE
  analysis_record RECORD;
  customer_names TEXT[];
  policy_ids TEXT[];
  customer_count INTEGER;
  policy_count INTEGER;
  i INTEGER;
  current_customer_name TEXT;
  current_policy_id TEXT;
BEGIN
  -- Loop through recent analyses without actions
  FOR analysis_record IN
    SELECT ear.*, e.subject, e.received_date, e.carrier, e.carrier_label
    FROM public.email_analysis_results ear
    JOIN public.emails e ON ear.email_id = e.id
    WHERE ear.customer_name IS NOT NULL
      AND ear.customer_name != ''
      AND ear.created_at >= '2025-09-22 00:00:00+00'
      AND NOT EXISTS (
        SELECT 1 FROM public.email_actions ea
        WHERE ea.analysis_id = ear.id
      )
  LOOP
    -- Split comma-separated customer names and policy IDs
    customer_names := string_to_array(trim(analysis_record.customer_name), ',');
    policy_ids := CASE
      WHEN analysis_record.policy_id IS NOT NULL AND analysis_record.policy_id != ''
      THEN string_to_array(trim(analysis_record.policy_id), ',')
      ELSE NULL
    END;

    -- Get the count of customers
    customer_count := array_length(customer_names, 1);
    policy_count := CASE WHEN policy_ids IS NOT NULL THEN array_length(policy_ids, 1) ELSE 0 END;

    -- Create action entries for each customer
    FOR i IN 1..customer_count LOOP
      current_customer_name := trim(customer_names[i]);
      current_policy_id := CASE
        WHEN policy_ids IS NOT NULL AND i <= policy_count THEN trim(policy_ids[i])
        ELSE NULL
      END;

      -- Skip empty customer names
      IF current_customer_name != '' THEN
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
          subcategory,
          action_code,
          ghl_note,
          ghl_stage_change
        ) VALUES (
          analysis_record.email_id,
          analysis_record.id,
          current_customer_name,
          current_policy_id,
          analysis_record.subject,
          analysis_record.received_date,
          analysis_record.carrier,
          analysis_record.carrier_label,
          analysis_record.email_update_date,
          analysis_record.summary,
          analysis_record.suggested_action,
          analysis_record.category,
          analysis_record.subcategory,
          analysis_record.action_code,
          analysis_record.ghl_note,
          analysis_record.ghl_stage
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Set priorities for the newly created actions
UPDATE public.email_actions
SET priority = CASE
  WHEN category = 'Failed payment' THEN 'high'
  WHEN category = 'Pending Lapse' THEN 'urgent'
  WHEN category = 'Chargeback' THEN 'high'
  WHEN category = 'Cancelled policy' THEN 'medium'
  WHEN category = 'Post Underwriting Update' THEN 'medium'
  WHEN category = 'Declined/Closed as Incomplete' THEN 'low'
  ELSE 'medium'
END
WHERE priority = 'medium' AND created_at >= '2025-09-22 00:00:00+00';

SELECT 'Trigger recreated and recent actions backfilled' as result;
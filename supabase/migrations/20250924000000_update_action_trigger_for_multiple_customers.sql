-- Update the trigger function to handle multiple customers and include action code mapping
CREATE OR REPLACE FUNCTION public.create_action_from_analysis()
RETURNS TRIGGER AS $$
DECLARE
  customer_names TEXT[];
  policy_ids TEXT[];
  customer_count INTEGER;
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
  policy_ids := string_to_array(trim(COALESCE(NEW.policy_id, '')), ',');

  -- Get the count of customers
  customer_count := array_length(customer_names, 1);

  -- If no policy IDs provided, create empty array of same length
  IF policy_ids IS NULL OR array_length(policy_ids, 1) IS NULL THEN
    policy_ids := array_fill(''::TEXT, ARRAY[customer_count]);
  END IF;

  -- Ensure policy_ids array matches customer_names length
  IF array_length(policy_ids, 1) < customer_count THEN
    -- Pad with empty strings if fewer policy IDs than customers
    FOR i IN (array_length(policy_ids, 1) + 1)..customer_count LOOP
      policy_ids := policy_ids || '';
    END LOOP;
  END IF;

  -- Create action entries for each customer
  FOR i IN 1..customer_count LOOP
    current_customer_name := trim(customer_names[i]);
    current_policy_id := CASE WHEN i <= array_length(policy_ids, 1) THEN trim(policy_ids[i]) ELSE '' END;

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
        CASE WHEN current_policy_id != '' THEN current_policy_id ELSE NULL END,
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
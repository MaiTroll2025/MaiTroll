-- Secure spend_coins and add court_levy_fine

-- 1. Update spend_coins (4-arg) to be strict: Only allow spending own coins or Admin
CREATE OR REPLACE FUNCTION spend_coins(p_user_id uuid, p_amount integer, p_reason text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance int;
  v_is_admin boolean;
BEGIN
  -- Authorization Check
  -- Allow if user is spending their own coins
  IF p_user_id = auth.uid() THEN
    -- OK
  ELSE
    -- Check if caller is admin/lead officer
    SELECT (role IN ('admin', 'lead_troll_officer') OR is_admin = true OR is_lead_officer = true)
    INTO v_is_admin
    FROM user_profiles
    WHERE id = auth.uid();
    
    IF v_is_admin IS NOT TRUE THEN
       RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: You can only spend your own coins.');
    END IF;
  END IF;

  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Check balance
  SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_user_id;
  
  IF v_balance IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'User not found');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- Update balance
  UPDATE user_profiles 
  SET troll_coins = troll_coins - p_amount 
  WHERE id = p_user_id;

  -- Log transaction
  INSERT INTO coin_ledger (user_id, amount, event_type, description, metadata)
  VALUES (p_user_id, -p_amount, 'spend', p_reason, p_metadata);

  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- 2. Create court_levy_fine for Judges to penalize users
CREATE OR REPLACE FUNCTION court_levy_fine(
    p_defendant_id uuid,
    p_amount integer,
    p_reason text,
    p_court_id uuid,
    p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_judge_id uuid;
  v_is_authorized boolean := false;
  v_balance int;
BEGIN
  -- Check if caller is the Judge of the specified court session
  SELECT judge_id INTO v_judge_id
  FROM court_sessions
  WHERE id = p_court_id;
  
  IF v_judge_id = auth.uid() THEN
     v_is_authorized := true;
  ELSE
     -- Fallback: Check if caller is admin
     SELECT (role IN ('admin', 'lead_troll_officer') OR is_admin = true OR is_lead_officer = true)
     INTO v_is_authorized
     FROM user_profiles
     WHERE id = auth.uid();
  END IF;

  IF NOT v_is_authorized THEN
     RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: You are not the judge of this session.');
  END IF;
  
  -- Set bypass flag
  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  -- Check balance
  SELECT troll_coins INTO v_balance FROM user_profiles WHERE id = p_defendant_id;
  
  IF v_balance IS NULL THEN
     RETURN jsonb_build_object('success', false, 'message', 'Defendant not found');
  END IF;

  IF v_balance < p_amount THEN
     RETURN jsonb_build_object('success', false, 'message', 'Insufficient funds');
  END IF;

  -- Deduct
  UPDATE user_profiles 
  SET troll_coins = troll_coins - p_amount 
  WHERE id = p_defendant_id;

  -- Log
  INSERT INTO coin_ledger (user_id, amount, event_type, description, metadata)
  VALUES (p_defendant_id, -p_amount, 'court_fine', p_reason, p_metadata);
    
  RETURN jsonb_build_object('success', true, 'new_balance', v_balance - p_amount);
END;
$$;

-- Finalize Executive Powers with centralized logging
-- Updates all president RPCs to log to government_actions_log

-- 1. Spend Treasury
CREATE OR REPLACE FUNCTION public.spend_president_treasury(
  p_amount_cents BIGINT,
  p_reason TEXT,
  p_recipient_id UUID DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_daily_spend BIGINT;
  v_daily_limit BIGINT := 100000; -- $1000.00 limit per day
  v_max_tx BIGINT := 25000; -- $250.00 max per transaction
  v_actor_role TEXT;
BEGIN
  -- Determine Role (President or VP)
  IF EXISTS (
    SELECT 1 FROM user_role_grants urg
    JOIN system_roles sr ON urg.role_id = sr.id
    WHERE urg.user_id = auth.uid()
    AND sr.name = 'president'
    AND (urg.expires_at IS NULL OR urg.expires_at > NOW())
  ) THEN
    v_actor_role := 'president';
  ELSIF EXISTS (
    SELECT 1 FROM user_role_grants urg
    JOIN system_roles sr ON urg.role_id = sr.id
    WHERE urg.user_id = auth.uid()
    AND sr.name = 'vice_president'
    AND (urg.expires_at IS NULL OR urg.expires_at > NOW())
  ) THEN
    v_actor_role := 'vice_president';
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Check Limits
  IF p_amount_cents > v_max_tx THEN
    RAISE EXCEPTION 'Transaction exceeds maximum limit';
  END IF;

  -- Check Daily Spend
  SELECT COALESCE(SUM(ABS(amount_cents)), 0) INTO v_daily_spend
  FROM president_treasury_ledger
  WHERE actor_id = auth.uid()
  AND kind = 'spend'
  AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_spend + p_amount_cents > v_daily_limit THEN
    RAISE EXCEPTION 'Daily spend limit exceeded';
  END IF;

  -- Deduct from Treasury
  INSERT INTO president_treasury_ledger (amount_cents, kind, currency, actor_id, metadata)
  VALUES (
    -p_amount_cents, 
    'spend', 
    'USD', 
    auth.uid(),
    jsonb_build_object('reason', p_reason, 'recipient_id', p_recipient_id)
  );

  -- Log to Government Actions Log
  PERFORM public.log_government_action(
    auth.uid(),
    v_actor_role,
    'spend_treasury',
    COALESCE(p_recipient_id::text, 'treasury'),
    jsonb_build_object(
        'amount_cents', p_amount_cents,
        'reason', p_reason,
        'currency', 'USD'
    )
  );
END;
$$;

-- 2. Appoint VP
CREATE OR REPLACE FUNCTION public.appoint_vice_president(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pres_expires TIMESTAMPTZ;
  v_vp_role_id UUID;
  v_target_username TEXT;
BEGIN
  -- Check President
  SELECT urg.expires_at INTO v_pres_expires
  FROM user_role_grants urg
  JOIN system_roles sr ON urg.role_id = sr.id
  WHERE urg.user_id = auth.uid() 
  AND sr.name = 'president'
  AND (urg.expires_at IS NULL OR urg.expires_at > NOW());
  
  IF v_pres_expires IS NULL THEN
    RAISE EXCEPTION 'Not President';
  END IF;
  
  -- Get Target Username for Logging
  SELECT username INTO v_target_username FROM user_profiles WHERE id = p_user_id;
  
  -- Remove existing VP
  UPDATE president_appointments
  SET status = 'removed', removed_at = NOW(), removed_by = auth.uid()
  WHERE status = 'active';
  
  SELECT id INTO v_vp_role_id FROM system_roles WHERE name = 'vice_president';
  
  -- Expire existing VP role grants
  UPDATE user_role_grants
  SET expires_at = NOW()
  WHERE role_id = v_vp_role_id AND (expires_at IS NULL OR expires_at > NOW());
  
  -- Create Appointment
  INSERT INTO president_appointments (
    president_user_id, 
    vice_president_user_id, 
    starts_at, 
    ends_at, 
    status
  ) VALUES (
    auth.uid(),
    p_user_id,
    NOW(),
    v_pres_expires, -- VP term aligns with President's remaining term
    'active'
  );
  
  -- Grant Role
  INSERT INTO user_role_grants (user_id, role_id, expires_at)
  VALUES (p_user_id, v_vp_role_id, v_pres_expires);

  -- Log to Government Actions Log
  PERFORM public.log_government_action(
    auth.uid(),
    'president',
    'appoint_vp',
    p_user_id::text,
    jsonb_build_object(
        'target_username', v_target_username,
        'term_ends_at', v_pres_expires
    )
  );
END;
$$;

-- 3. Raise Payouts
CREATE OR REPLACE FUNCTION public.president_raise_payouts(p_amount_cents BIGINT)
RETURNS VOID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  -- Check President
  IF NOT EXISTS (
    SELECT 1 FROM user_role_grants urg
    JOIN system_roles sr ON urg.role_id = sr.id
    WHERE urg.user_id = auth.uid() 
    AND sr.name = 'president'
    AND (urg.expires_at IS NULL OR urg.expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'Not President';
  END IF;

  -- Check Treasury
  SELECT COALESCE(SUM(amount_cents), 0) INTO v_balance FROM president_treasury_ledger WHERE currency = 'USD';
  
  IF v_balance < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;

  -- Deduct/Reserve
  INSERT INTO president_treasury_ledger (amount_cents, kind, currency, actor_id)
  VALUES (-p_amount_cents, 'reserve', 'USD', auth.uid());
  
  -- Update Policy
  UPDATE payout_policy
  SET max_payout_cents = max_payout_cents + p_amount_cents; 
  
  -- Log to Government Actions Log
  PERFORM public.log_government_action(
    auth.uid(),
    'president',
    'raise_payouts',
    'payout_policy',
    jsonb_build_object(
        'amount_cents', p_amount_cents,
        'currency', 'USD'
    )
  );
END;
$$;

-- 4. Post Announcement
CREATE OR REPLACE FUNCTION public.president_post_announcement(p_message TEXT)
RETURNS UUID
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check Role
  IF NOT EXISTS (
    SELECT 1 FROM user_role_grants urg
    JOIN system_roles sr ON urg.role_id = sr.id
    WHERE urg.user_id = auth.uid()
    AND sr.name = 'president'
    AND (urg.expires_at IS NULL OR urg.expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Create Post
  INSERT INTO troll_posts (user_id, content, post_type)
  VALUES (auth.uid(), p_message, 'announcement')
  RETURNING id INTO v_id;

  -- Log to Government Actions Log
  PERFORM public.log_government_action(
    auth.uid(),
    'president',
    'post_announcement',
    v_id::text,
    jsonb_build_object(
        'message_snippet', substring(p_message from 1 for 100)
    )
  );

  RETURN v_id;
END;
$$;

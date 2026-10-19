-- Credit Card Application System
-- - credit_card_applications: tracks user applications for credit cards
-- - Auto-approve when credit_score >= 500
-- - Monthly credit limit reset (30 days)
-- - Credit report RPC viewable by clicking username

BEGIN;

-- Credit card applications table
CREATE TABLE IF NOT EXISTS public.credit_card_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'revoked')),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  credit_score_at_application INTEGER,
  credit_limit BIGINT DEFAULT 0,
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_cca_user_id ON public.credit_card_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_cca_status ON public.credit_card_applications(status);

ALTER TABLE public.credit_card_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cca_select_owner" ON public.credit_card_applications;
CREATE POLICY cca_select_owner ON public.credit_card_applications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "cca_insert_owner" ON public.credit_card_applications;
CREATE POLICY cca_insert_owner ON public.credit_card_applications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
GRANT SELECT, INSERT ON public.credit_card_applications TO authenticated;

-- Reset all users' credit cards: start at 400, no active card yet
UPDATE public.user_profiles
SET credit_score = GREATEST(0, LEAST(800, COALESCE(credit_score, 400))),
    credit_limit = COALESCE(credit_limit, 0)
WHERE credit_score IS NULL OR credit_limit IS NULL;

-- Credit Card Application RPC
-- Auto-approves if credit_score >= 500, otherwise denies
CREATE OR REPLACE FUNCTION public.apply_for_credit_card()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile RECORD;
  v_existing RECORD;
  v_score INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check for existing application
  SELECT * INTO v_existing
  FROM public.credit_card_applications
  WHERE user_id = v_user_id
    AND status IN ('pending', 'approved')
  ORDER BY applied_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already have a credit card application ' || v_existing.status
    );
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  v_score := COALESCE(v_profile.credit_score, 400);

  IF v_score >= 500 THEN
    -- Auto-approve
    INSERT INTO public.credit_card_applications (
      user_id, status, applied_at, reviewed_at, reviewed_by,
      credit_score_at_application, credit_limit, reason, metadata
    )
    VALUES (
      v_user_id, 'approved', NOW(), NOW(), NULL,
      v_score, 250,
      'Auto-approved: credit score >= 500',
      jsonb_build_object('auto_approved', true, 'initial_limit', 250)
    )
    RETURNING id INTO v_existing.id;

    -- Set credit limit on profile
    UPDATE public.user_profiles
    SET credit_limit = 250,
        credit_used = COALESCE(credit_used, 0),
        updated_at = NOW()
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'status', 'approved',
      'credit_score', v_score,
      'credit_limit', 250,
      'message', 'Credit card application approved automatically.'
    );
  ELSE
    -- Deny
    INSERT INTO public.credit_card_applications (
      user_id, status, applied_at, reviewed_at, reviewed_by,
      credit_score_at_application, credit_limit, reason, metadata
    )
    VALUES (
      v_user_id, 'denied', NOW(), NOW(), NULL,
      v_score, 0,
      'Auto-denied: credit score < 500',
      jsonb_build_object('auto_approved', false, 'required_score', 500, 'current_score', v_score)
    )
    RETURNING id INTO v_existing.id;

    RETURN jsonb_build_object(
      'success', false,
      'status', 'denied',
      'credit_score', v_score,
      'required_score', 500,
      'message', 'Credit card application denied. Your credit score must be at least 500.'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_for_credit_card() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_for_credit_card() TO authenticated;

-- Monthly credit limit reset function
-- Users with no balance: limit resets to base (250)
-- Users with balance: limit stays, debt goes to credit report
CREATE OR REPLACE FUNCTION public.reset_monthly_credit_limits()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
  v_reset_count INTEGER := 0;
  v_report_count INTEGER := 0;
  v_cur RECORD;
BEGIN
  FOR v_cur IN
    SELECT id, credit_score, credit_limit, credit_used
    FROM public.user_profiles
    WHERE credit_limit > 0 OR credit_used > 0
  LOOP
    IF COALESCE(v_cur.credit_used, 0) <= 0 THEN
      -- No balance: reset limit to base 250
      UPDATE public.user_profiles
      SET credit_limit = 250,
          updated_at = NOW()
      WHERE id = v_cur.id;

      v_reset_count := v_reset_count + 1;
    ELSE
      -- Has balance: report to credit report (log event)
      PERFORM public.apply_credit_score_event(
        v_cur.id,
        'credit_limit_not_reset_balance',
        0,
        'credit_limit_balance:' || v_cur.id::TEXT || ':' || date_trunc('month', NOW())::TEXT,
        'user_profiles',
        v_cur.id,
        jsonb_build_object('credit_used', v_cur.credit_used, 'credit_limit', v_cur.credit_limit)
      );

      v_report_count := v_report_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'limits_reset', v_reset_count,
    'balances_reported', v_report_count,
    'message', 'Monthly credit limit reset complete.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_monthly_credit_limits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_credit_limits() TO service_role;

-- Credit Report RPC: viewable by clicking any username
CREATE OR REPLACE FUNCTION public.get_credit_report(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile RECORD;
  v_credit RECORD;
  v_app RECORD;
  v_tier TEXT;
  v_events JSONB;
  v_small_purchases INTEGER;
  v_loans INTEGER;
  v_gifts_sent INTEGER;
  v_gifts_received INTEGER;
  v_broadcast_hours BIGINT;
  v_viewing_hours BIGINT;
BEGIN
  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT * INTO v_credit
  FROM public.user_credit
  WHERE user_id = p_user_id;

  v_tier := COALESCE(v_credit.tier, public.get_credit_tier(COALESCE(v_profile.credit_score, 400)));

  -- Recent credit events (last 90 days)
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_type', event_type,
      'delta', delta,
      'created_at', created_at,
      'metadata', metadata
    )
    ORDER BY created_at DESC
  ), '[]'::jsonb)
  INTO v_events
  FROM public.credit_events
  WHERE user_id = p_user_id
    AND created_at >= NOW() - INTERVAL '90 days';

  -- Count small installment purchases (credit building)
  SELECT COALESCE(COUNT(*), 0) INTO v_small_purchases
  FROM public.small_installment_purchases
  WHERE user_id = p_user_id;

  -- Loan count
  SELECT COALESCE(COUNT(*), 0) INTO v_loans
  FROM public.loans
  WHERE user_id = p_user_id;

  -- Gifts sent/received counts
  SELECT COALESCE(COUNT(*), 0) INTO v_gifts_sent
  FROM public.stream_gifts
  WHERE sender_id = p_user_id;

  SELECT COALESCE(COUNT(*), 0) INTO v_gifts_received
  FROM public.stream_gifts
  WHERE receiver_id = p_user_id;

  -- Broadcast/viewing hours this month
  SELECT COALESCE(hosted_seconds, 0), COALESCE(viewed_seconds, 0)
  INTO v_broadcast_hours, v_viewing_hours
  FROM public.credit_activity_monthly_totals
  WHERE user_id = p_user_id
    AND month_start = date_trunc('month', NOW())::DATE;

  -- Latest application
  SELECT * INTO v_app
  FROM public.credit_card_applications
  WHERE user_id = p_user_id
  ORDER BY applied_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'username', v_profile.username,
    'credit_score', COALESCE(v_profile.credit_score, 400),
    'credit_tier', v_tier,
    'credit_limit', COALESCE(v_profile.credit_limit, 0),
    'credit_used', COALESCE(v_profile.credit_used, 0),
    'credit_available', COALESCE(v_profile.credit_limit, 0) - COALESCE(v_profile.credit_used, 0),
    'application_status', COALESCE(v_app.status, 'none'),
    'application_reason', v_app.reason,
    'credit_card_active', (v_app.status = 'approved'),
    'small_installment_purchases', v_small_purchases,
    'active_loans', v_loans,
    'gifts_sent', v_gifts_sent,
    'gifts_received', v_gifts_received,
    'broadcast_hours_this_month', FLOOR(v_broadcast_hours / 3600.0),
    'viewing_hours_this_month', FLOOR(v_viewing_hours / 7200.0),
    'recent_events', v_events,
    'how_to_increase', jsonb_build_array(
      'Broadcast live streams (+1 point per verified host hour)',
      'View live streams (+1 point per 2 verified viewer hours)',
      'Send gifts in streams (+1 point per 1,000 coins gifted)',
      'Pay off credit card debt (+5 points)',
      'Make small installment purchases (under 100 coins via credit card)',
      'Avoid taking loans (each loan drops score by 1-10 points)'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_credit_report(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_credit_report(UUID) TO authenticated;

COMMIT;

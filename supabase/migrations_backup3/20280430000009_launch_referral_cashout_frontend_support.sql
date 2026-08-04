-- Launch hardening for referral/cashout paths.
-- Safe to run after the emergency stream/gift SQL. No broad schema rewrites.

CREATE OR REPLACE FUNCTION public.get_referral_list(p_user_id uuid)
RETURNS TABLE (
  referred_user_id uuid,
  username text,
  avatar_url text,
  troll_coins bigint,
  total_earned_coins bigint,
  onboarding_complete boolean,
  is_qualified_referral boolean,
  qualified_referral_at timestamptz,
  referred_at timestamptz,
  progress_percent bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    up.id AS referred_user_id,
    up.username::text,
    up.avatar_url::text,
    COALESCE(up.troll_coins, 0)::bigint AS troll_coins,
    COALESCE(up.total_earned_coins, 0)::bigint AS total_earned_coins,
    COALESCE(up.onboarding_complete, false) AS onboarding_complete,
    COALESCE(up.is_qualified_referral, false) AS is_qualified_referral,
    up.qualified_referral_at,
    up.created_at AS referred_at,
    LEAST(
      100::bigint,
      FLOOR((COALESCE(up.troll_coins, 0)::numeric / 5000) * 100)::bigint
    ) AS progress_percent
  FROM public.user_profiles up
  WHERE up.referred_by_user_id = p_user_id
  ORDER BY up.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_referral_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_referral_signup(p_user_id uuid, p_referral_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id uuid;
BEGIN
  IF p_user_id IS NULL OR p_referral_code IS NULL OR btrim(p_referral_code) = '' THEN
    RETURN false;
  END IF;

  SELECT id INTO v_referrer_id
  FROM public.user_profiles
  WHERE id::text = btrim(p_referral_code)
    AND id <> p_user_id
  LIMIT 1;

  IF v_referrer_id IS NULL THEN
    SELECT id INTO v_referrer_id
    FROM public.users
    WHERE referral_code = btrim(p_referral_code)
      AND id <> p_user_id
    LIMIT 1;
  END IF;

  IF v_referrer_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.user_profiles
  SET referred_by_user_id = v_referrer_id,
      referred_user_bonus_active = true
  WHERE id = p_user_id
    AND referred_by_user_id IS NULL;

  BEGIN
    INSERT INTO public.referrals (
      recruiter_id,
      referrer_id,
      referred_user_id,
      referred_id,
      reward_status,
      status,
      reward_amount,
      referred_at,
      deadline
    )
    VALUES (
      v_referrer_id,
      v_referrer_id,
      p_user_id,
      p_user_id,
      'pending',
      'pending',
      1000,
      now(),
      now() + interval '21 days'
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_referral_signup referral row skipped for %: %', p_user_id, SQLERRM;
  END;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.handle_referral_signup(uuid, text) TO authenticated, service_role;

UPDATE public.cashout_tiers
SET cash_amount = 25,
    currency = 'USD',
    processing_fee_percentage = 0,
    is_active = true
WHERE coin_amount = 5000;

INSERT INTO public.cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active)
SELECT 5000, 25, 'USD', 0, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.cashout_tiers WHERE coin_amount = 5000
);

CREATE OR REPLACE FUNCTION public.request_visa_redemption(p_user_id uuid, p_coins bigint, p_usd numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reserved bigint;
  v_available bigint;
  v_total bigint;
  v_usd numeric(10,2);
  v_redemption_id uuid;
  v_referred_bonus_coins bigint := 0;
  v_referrer_bonus_coins bigint := 0;
  v_referred_bonus_active boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  v_usd := CASE p_coins
    WHEN 5000    THEN 25
    WHEN 15000   THEN 50
    WHEN 30000   THEN 150
    WHEN 60000   THEN 300
    WHEN 120000  THEN 600
    WHEN 200000  THEN 1000
    WHEN 400000  THEN 2000
    ELSE NULL
  END;

  IF v_usd IS NULL THEN
    RAISE EXCEPTION 'Invalid tier';
  END IF;

  IF p_usd IS NULL OR p_usd::numeric(10,2) <> v_usd THEN
    RAISE EXCEPTION 'USD does not match tier';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.loans l
    WHERE l.user_id = p_user_id
      AND l.status IN ('active', 'late', 'overdue', 'delinquent', 'defaulted')
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Active loans must be paid before cashout';
  END IF;

  SELECT
    COALESCE(troll_coins, 0)::bigint,
    COALESCE(reserved_troll_coins, 0)::bigint,
    COALESCE(referred_user_bonus_active, false)
  INTO v_total, v_reserved, v_referred_bonus_active
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_available := v_total - v_reserved;
  IF v_available < p_coins THEN
    RAISE EXCEPTION 'Insufficient available coins';
  END IF;

  IF v_referred_bonus_active THEN
    v_referred_bonus_coins := FLOOR(p_coins::numeric * 0.02)::bigint;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.referred_by_user_id = p_user_id
      AND COALESCE(up.is_qualified_referral, false) = true
    LIMIT 1
  ) THEN
    v_referrer_bonus_coins := 1000;
  END IF;

  UPDATE public.user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins, 0) + p_coins,
      troll_coins = COALESCE(troll_coins, 0) + v_referred_bonus_coins + v_referrer_bonus_coins,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.visa_redemptions (
    user_id, coins_reserved, usd_amount, status, note, created_at
  ) VALUES (
    p_user_id,
    p_coins::integer,
    v_usd,
    'pending',
    jsonb_build_object(
      'referred_cashout_bonus_coins', v_referred_bonus_coins,
      'referrer_cashout_bonus_coins', v_referrer_bonus_coins
    )::text,
    now()
  )
  RETURNING id INTO v_redemption_id;

  IF v_referred_bonus_coins > 0 OR v_referrer_bonus_coins > 0 THEN
    BEGIN
      INSERT INTO public.coin_transactions (
        user_id,
        type,
        amount,
        description,
        metadata,
        source,
        source_type,
        source_id,
        status
      )
      VALUES (
        p_user_id,
        'referral_reward',
        (v_referred_bonus_coins + v_referrer_bonus_coins)::integer,
        'Referral cashout bonus',
        jsonb_build_object(
          'visa_redemption_id', v_redemption_id,
          'referred_cashout_bonus_coins', v_referred_bonus_coins,
          'referrer_cashout_bonus_coins', v_referrer_bonus_coins
        ),
        'cashout',
        'visa_redemption',
        v_redemption_id::text,
        'completed'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'request_visa_redemption bonus transaction skipped for %: %', p_user_id, SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'redemption_id', v_redemption_id,
    'referred_cashout_bonus_coins', v_referred_bonus_coins,
    'referrer_cashout_bonus_coins', v_referrer_bonus_coins,
    'WalletBefore', jsonb_build_object(
      'available', v_available,
      'reserved', v_reserved
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available - p_coins + v_referred_bonus_coins + v_referrer_bonus_coins,
      'reserved', v_reserved + p_coins
    ),
    'RedemptionStatus', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_visa_redemption(uuid, bigint, numeric) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

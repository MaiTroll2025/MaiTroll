-- Enforce launch new-user cashout promo.
-- Applies only to users created on/after May 1, 2026 3:00 PM MDT (2026-05-01 21:00 UTC).
-- Bonus is once per user, on a 5,000 coin cashout.

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
  v_new_user_promo_coins bigint := 0;
  v_referred_bonus_active boolean := false;
  v_created_at timestamptz;
  v_cashout_fee_coins bigint;
  v_total_reserved_coins bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
    RAISE EXCEPTION 'Invalid user';
  END IF;

  IF EXTRACT(DOW FROM (now() AT TIME ZONE 'America/Denver')) = 5 THEN
    IF (
      SELECT COUNT(*)
      FROM public.verification_requests vr
      WHERE vr.user_id = p_user_id
        AND vr.source = 'cashout'
        AND vr.status = 'denied'
        AND vr.created_at >= date_trunc('week', now() AT TIME ZONE 'America/Denver')
    ) >= 3 THEN
      RAISE EXCEPTION 'ID verification rejected 3 times this week. Try again next Friday.';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.verification_requests vr
      WHERE vr.user_id = p_user_id
        AND vr.status = 'approved'
      LIMIT 1
    ) THEN
      RAISE EXCEPTION 'Friday cashouts require approved ID verification';
    END IF;
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
    COALESCE(referred_user_bonus_active, false),
    created_at
  INTO v_total, v_reserved, v_referred_bonus_active, v_created_at
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_cashout_fee_coins := CEIL(p_coins::numeric * 0.029)::bigint;
  v_total_reserved_coins := p_coins + v_cashout_fee_coins;

  v_available := v_total - v_reserved;
  IF v_available < v_total_reserved_coins THEN
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

  IF p_coins = 5000
     AND v_created_at >= '2026-05-01 21:00:00+00'::timestamptz
     AND NOT EXISTS (
       SELECT 1
       FROM public.coin_transactions ct
       WHERE ct.user_id = p_user_id
         AND (
           ct.description = 'New user first cashout bonus'
           OR (ct.metadata->>'new_user_cashout_bonus_coins')::bigint > 0
         )
       LIMIT 1
     )
  THEN
    v_new_user_promo_coins := 1000;
  END IF;

  UPDATE public.user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins, 0) + v_total_reserved_coins,
      troll_coins = COALESCE(troll_coins, 0) + v_referred_bonus_coins + v_referrer_bonus_coins + v_new_user_promo_coins,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.visa_redemptions (
    user_id, coins_reserved, usd_amount, status, note, created_at
  ) VALUES (
    p_user_id,
    v_total_reserved_coins::integer,
    v_usd,
    'pending',
    jsonb_build_object(
      'cashout_payout_coins', p_coins,
      'cashout_fee_rate', 0.029,
      'cashout_fee_coins', v_cashout_fee_coins,
      'referred_cashout_bonus_coins', v_referred_bonus_coins,
      'referrer_cashout_bonus_coins', v_referrer_bonus_coins,
      'new_user_cashout_bonus_coins', v_new_user_promo_coins,
      'new_user_promo_start_utc', '2026-05-01T21:00:00Z'
    )::text,
    now()
  )
  RETURNING id INTO v_redemption_id;

  IF v_referred_bonus_coins > 0 OR v_referrer_bonus_coins > 0 OR v_new_user_promo_coins > 0 THEN
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
        (v_referred_bonus_coins + v_referrer_bonus_coins + v_new_user_promo_coins)::integer,
        CASE WHEN v_new_user_promo_coins > 0 THEN 'New user first cashout bonus' ELSE 'Referral cashout bonus' END,
        jsonb_build_object(
          'visa_redemption_id', v_redemption_id,
          'referred_cashout_bonus_coins', v_referred_bonus_coins,
          'referrer_cashout_bonus_coins', v_referrer_bonus_coins,
          'new_user_cashout_bonus_coins', v_new_user_promo_coins
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
    'new_user_cashout_bonus_coins', v_new_user_promo_coins,
    'cashout_fee_rate', 0.029,
    'cashout_fee_coins', v_cashout_fee_coins,
    'coins_reserved_total', v_total_reserved_coins,
    'WalletBefore', jsonb_build_object(
      'available', v_available,
      'reserved', v_reserved
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available - v_total_reserved_coins + v_referred_bonus_coins + v_referrer_bonus_coins + v_new_user_promo_coins,
      'reserved', v_reserved + v_total_reserved_coins
    ),
    'RedemptionStatus', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_visa_redemption(uuid, bigint, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_visa_redemption(uuid, bigint, numeric) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

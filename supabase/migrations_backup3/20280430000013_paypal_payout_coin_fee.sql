-- Apply the 0%coin fee to PayPal payout requests as well as Visa redemptions.

CREATE OR REPLACE FUNCTION public.request_paypal_payout(p_user_id uuid, p_coins bigint, p_usd numeric)
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
  v_payout_id uuid;
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

  SELECT COALESCE(troll_coins, 0)::bigint, COALESCE(reserved_troll_coins, 0)::bigint
    INTO v_total, v_reserved
  FROM public.user_profiles
  WHERE id = p_user_id;

  v_cashout_fee_coins := CEIL(p_coins::numeric * 0.029)::bigint;
  v_total_reserved_coins := p_coins + v_cashout_fee_coins;
  v_available := v_total - v_reserved;

  IF v_available < v_total_reserved_coins THEN
    RAISE EXCEPTION 'Insufficient available coins';
  END IF;

  UPDATE public.user_profiles
  SET reserved_troll_coins = COALESCE(reserved_troll_coins, 0) + v_total_reserved_coins,
      updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.payout_requests (
    user_id,
    coins_redeemed,
    coin_amount,
    requested_coins,
    coins_used,
    cash_amount,
    status,
    created_at,
    processing_fee,
    net_amount,
    notes
  ) VALUES (
    p_user_id,
    v_total_reserved_coins,
    v_total_reserved_coins,
    v_total_reserved_coins,
    v_total_reserved_coins::integer,
    v_usd,
    'pending',
    now(),
    0,
    v_usd,
    jsonb_build_object(
      'cashout_payout_coins', p_coins,
      'cashout_fee_rate', 0.029,
      'cashout_fee_coins', v_cashout_fee_coins
    )::text
  )
  RETURNING id INTO v_payout_id;

  RETURN jsonb_build_object(
    'payout_request_id', v_payout_id,
    'cashout_fee_rate', 0.029,
    'cashout_fee_coins', v_cashout_fee_coins,
    'coins_reserved_total', v_total_reserved_coins,
    'WalletBefore', jsonb_build_object(
      'available', v_available,
      'reserved', v_reserved
    ),
    'WalletAfter', jsonb_build_object(
      'available', v_available - v_total_reserved_coins,
      'reserved', v_reserved + v_total_reserved_coins
    ),
    'PayoutStatus', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_paypal_payout(uuid, bigint, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_paypal_payout(uuid, bigint, numeric) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

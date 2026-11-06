BEGIN;

SET LOCAL search_path = pg_catalog, public;

CREATE OR REPLACE FUNCTION public.admin_update_any_profile_field(
  p_user_id uuid,
  p_updates jsonb,
  p_admin_id uuid,
  p_reason text DEFAULT 'Admin Update'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_role text;
  v_is_admin boolean;
  v_is_lead_officer boolean;
  v_updated_rows integer;
BEGIN
  SELECT role, is_admin, is_lead_officer
  INTO v_admin_role, v_is_admin, v_is_lead_officer
  FROM public.user_profiles
  WHERE id = p_admin_id;

  IF NOT (
    COALESCE(v_admin_role IN ('admin', 'lead_troll_officer'), false)
    OR COALESCE(v_is_admin, false)
    OR COALESCE(v_is_lead_officer, false)
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can perform this action'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR jsonb_typeof(p_updates) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'A target user and updates object are required'
      USING ERRCODE = '22023';
  END IF;

  PERFORM set_config('app.bypass_coin_protection', 'true', true);

  UPDATE public.user_profiles
  SET role = COALESCE((p_updates->>'role')::text, role),
      is_admin = COALESCE((p_updates->>'is_admin')::boolean, is_admin),
      is_lead_officer = COALESCE((p_updates->>'is_lead_officer')::boolean, is_lead_officer),
      is_troll_officer = COALESCE((p_updates->>'is_troll_officer')::boolean, is_troll_officer),
      troll_coins = COALESCE((p_updates->>'troll_coins')::bigint, troll_coins),
      level = COALESCE((p_updates->>'level')::int, level),
      xp = COALESCE((p_updates->>'xp')::int, xp),
      bypass_broadcast_restriction = COALESCE((p_updates->>'bypass_broadcast_restriction')::boolean, bypass_broadcast_restriction),
      rgb_username_expires_at = COALESCE((p_updates->>'rgb_username_expires_at')::timestamptz, rgb_username_expires_at),
      glowing_username_color = COALESCE((p_updates->>'glowing_username_color')::text, glowing_username_color),
      username_style = COALESCE((p_updates->>'username_style')::text, username_style),
      badge = COALESCE((p_updates->>'badge')::text, badge),
      updated_at = now()
  WHERE id = p_user_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Target user not found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_id, target_id, action, details, created_at)
  VALUES (
    p_admin_id,
    p_user_id,
    'update_profile_field',
    jsonb_build_object('updates', p_updates, 'reason', p_reason),
    now()
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_cashout(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_license public.user_driver_licenses%ROWTYPE;
  v_license_status text;
  v_now timestamptz := now();
  v_has_warrant boolean;
  v_cashout_restricted_until timestamptz;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = '42501';
  END IF;

  SELECT cashout_restricted_until
  INTO v_cashout_restricted_until
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF v_cashout_restricted_until IS NOT NULL AND v_cashout_restricted_until > v_now THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'CASHOUT_RESTRICTED',
      'message', 'Your cash-out is restricted until ' || to_char(v_cashout_restricted_until, 'MM/DD HH24:MI')
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.court_warrants
    WHERE user_id = p_user_id AND status = 'active'
  ) INTO v_has_warrant;

  IF v_has_warrant THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'WARRANT_ACTIVE',
      'message', 'You have an active warrant. Cash-out is restricted until the warrant is resolved.'
    );
  END IF;

  SELECT *
  INTO v_license
  FROM public.user_driver_licenses
  WHERE user_id = p_user_id
  LIMIT 1;
  v_license_status := COALESCE(v_license.status, 'none');

  IF v_license_status = 'suspended' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_SUSPENDED', 'message', 'Your Mai Troll license is suspended. You cannot cash out.');
  END IF;

  IF v_license_status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_REVOKED', 'message', 'Your Mai Troll license has been revoked. You cannot cash out.');
  END IF;

  IF v_license_status = 'expired'
     OR (v_license.expires_at IS NOT NULL AND v_license.expires_at < v_now) THEN
    RETURN jsonb_build_object('success', false, 'code', 'LICENSE_EXPIRED', 'message', 'Your Mai Troll license has expired. Renew it to cash out.');
  END IF;

  IF v_license_status = 'none' THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_LICENSE', 'message', 'You need a Mai Troll license to cash out.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'code', 'LICENSE_ACTIVE',
    'message', 'License valid for cashout',
    'data', jsonb_build_object('status', v_license_status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_first_cashout_match_slot(
  p_user_id uuid,
  p_payout_request_id uuid,
  p_qualifying_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_promo public.cashout_promotions%ROWTYPE;
  v_payout public.payout_requests%ROWTYPE;
  v_existing_claim uuid;
  v_winner_number integer;
  v_match_amount numeric(10, 2);
  v_match_coins bigint;
  v_claim_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT *
  INTO v_payout
  FROM public.payout_requests
  WHERE id = p_payout_request_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_payout.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending cashout for this user is required');
  END IF;

  SELECT *
  INTO v_promo
  FROM public.cashout_promotions
  WHERE slug = 'first_cashout_match'
    AND enabled = true
    AND v_now BETWEEN starts_at AND ends_at
    AND winners_claimed < max_winners
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active promotion available');
  END IF;

  SELECT id
  INTO v_existing_claim
  FROM public.cashout_promotion_claims
  WHERE promotion_id = v_promo.id
    AND user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User has already claimed this promotion',
      'code', 'already_claimed'
    );
  END IF;

  IF v_payout.cash_amount < v_promo.minimum_cashout THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cashout does not meet minimum threshold',
      'code', 'below_minimum'
    );
  END IF;

  UPDATE public.cashout_promotions
  SET winners_claimed = winners_claimed + 1,
      updated_at = v_now
  WHERE id = v_promo.id
    AND winners_claimed < max_winners
  RETURNING winners_claimed INTO v_winner_number;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promotion slots exhausted', 'code', 'no_slots');
  END IF;

  IF v_promo.match_type = 'percentage' THEN
    v_match_amount := round(v_payout.cash_amount * v_promo.match_percentage / 100.0, 2);
  ELSE
    v_match_amount := least(v_promo.max_match_amount, v_payout.cash_amount);
  END IF;

  IF v_match_amount IS NULL OR v_match_amount < 0 THEN
    RAISE EXCEPTION 'Promotion match amount is invalid'
      USING ERRCODE = '22023';
  END IF;

  v_match_coins := greatest(round(v_match_amount * 200), 0);
  IF v_match_coins IS NULL OR v_match_coins <= 0 THEN
    RAISE EXCEPTION 'Promotion coin amount is invalid'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.cashout_promotion_claims (
    promotion_id,
    user_id,
    payout_request_id,
    qualifying_amount,
    match_amount,
    match_coins,
    winner_number,
    status,
    review_status,
    metadata
  )
  VALUES (
    v_promo.id,
    p_user_id,
    p_payout_request_id,
    v_payout.cash_amount,
    v_match_amount,
    v_match_coins,
    v_winner_number,
    'pending',
    'none',
    jsonb_build_object('reserved_at', v_now, 'promotion_name', v_promo.name)
  )
  RETURNING id INTO v_claim_id;

  RETURN jsonb_build_object(
    'success', true,
    'promotion_id', v_promo.id,
    'claim_id', v_claim_id,
    'winner_number', v_winner_number,
    'match_amount', v_match_amount,
    'match_coins', v_match_coins,
    'spots_remaining', v_promo.max_winners - v_winner_number
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_first_cashout_match(
  p_claim_id uuid,
  p_admin_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_claim public.cashout_promotion_claims%ROWTYPE;
  v_payout public.payout_requests%ROWTYPE;
  v_promo public.cashout_promotions%ROWTYPE;
  v_now timestamptz := now();
  v_updated_rows integer;
BEGIN
  SELECT *
  INTO v_claim
  FROM public.cashout_promotion_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Claim not found');
  END IF;

  SELECT *
  INTO v_payout
  FROM public.payout_requests
  WHERE id = v_claim.payout_request_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_payout.status IS NULL
     OR v_payout.status NOT IN ('paid', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout has not been finalized');
  END IF;

  SELECT *
  INTO v_claim
  FROM public.cashout_promotion_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF v_claim.status = 'issued' THEN
    RETURN jsonb_build_object(
      'success', true,
      'match_coins', v_claim.match_coins,
      'match_amount', v_claim.match_amount,
      'winner_number', v_claim.winner_number,
      'duplicate', true
    );
  END IF;

  IF v_claim.status IS NULL OR v_claim.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Claim is not in an issuable state',
      'status', v_claim.status
    );
  END IF;

  SELECT *
  INTO v_promo
  FROM public.cashout_promotions
  WHERE id = v_claim.promotion_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promotion not found');
  END IF;

  IF v_claim.match_coins <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promotion reward amount is invalid');
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_claim.match_coins,
      updated_at = v_now
  WHERE id = v_claim.user_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Promotion recipient not found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    description,
    metadata,
    created_at
  )
  VALUES (
    v_claim.user_id,
    v_claim.match_coins,
    'promotion_reward',
    format(
      'First Cashout Match - Winner #%s: +%s coins (%s)',
      v_claim.winner_number,
      v_claim.match_coins,
      v_promo.name
    ),
    jsonb_build_object(
      'promotion_id', v_promo.id,
      'claim_id', v_claim.id,
      'payout_request_id', v_claim.payout_request_id,
      'qualifying_amount', v_claim.qualifying_amount,
      'match_amount', v_claim.match_amount,
      'match_coins', v_claim.match_coins,
      'winner_number', v_claim.winner_number,
      'admin_id', p_admin_id
    ),
    v_now
  );

  UPDATE public.cashout_promotion_claims
  SET status = 'issued',
      issued_at = v_now,
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object('issued_at', v_now, 'admin_id', p_admin_id)
  WHERE id = p_claim_id;

  RETURN jsonb_build_object(
    'success', true,
    'match_coins', v_claim.match_coins,
    'match_amount', v_claim.match_amount,
    'winner_number', v_claim.winner_number,
    'duplicate', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.award_friday_battle_gifter_bonus(
  p_gifter_id uuid,
  p_battle_id uuid,
  p_gift_total_coins bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_bonus bigint;
  v_txn_key text;
  v_existing_id uuid;
  v_updated_rows integer;
BEGIN
  IF p_gifter_id IS NULL
     OR p_battle_id IS NULL
     OR p_gift_total_coins IS NULL
     OR p_gift_total_coins <= 0 THEN
    RAISE EXCEPTION 'Invalid Friday battle reward inputs'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_gifter_id::text || ':' || p_battle_id::text, 0)
  );

  v_txn_key := p_gifter_id::text || '_' || p_battle_id::text || '_friday_battle';

  SELECT id
  INTO v_existing_id
  FROM public.coin_transactions
  WHERE user_id = p_gifter_id
    AND type = 'friday_battle_bonus'
    AND metadata->>'battle_id' = p_battle_id::text
    AND metadata->>'txn_key' = v_txn_key;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'bonus_coins', 0,
      'duplicate', true,
      'message', 'Friday battle bonus already awarded for this gifter+battle'
    );
  END IF;

  v_bonus := public.calculate_friday_battle_gifter_bonus(
    p_gifter_id,
    p_battle_id,
    p_gift_total_coins
  );

  IF v_bonus IS NULL OR v_bonus <= 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'bonus_coins', 0,
      'message', 'Bonus cap reached or zero'
    );
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_bonus
  WHERE id = p_gifter_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Gifter not found'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    transaction_type,
    metadata
  )
  VALUES (
    p_gifter_id,
    v_bonus,
    'friday_battle_bonus',
    'friday_battle_bonus',
    jsonb_build_object(
      'battle_id', p_battle_id::text,
      'gift_total_coins', p_gift_total_coins,
      'bonus_percentage', 5,
      'txn_key', v_txn_key,
      'source', 'friday_battle_gifter_bonus'
    )
  );

  PERFORM public.consume_reward_budget(v_bonus, 'other_sink');

  RETURN jsonb_build_object(
    'success', true,
    'bonus_coins', v_bonus,
    'duplicate', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.troll_bank_finalize_cashout(
  p_request_id uuid,
  p_admin_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payout public.payout_requests%ROWTYPE;
  v_claim_id uuid;
  v_promo_result jsonb;
  v_now timestamptz := now();
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'A verified processing actor is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_payout
  FROM public.payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  IF v_payout.status IN ('paid', 'completed') THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already paid', 'duplicate', true);
  END IF;

  IF v_payout.status IS NULL
     OR v_payout.status NOT IN ('pending', 'approved', 'processing') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout is not in a payable state',
      'status', v_payout.status
    );
  END IF;

  UPDATE public.payout_requests
  SET status = 'paid',
      paid_at = v_now,
      updated_at = v_now,
      processed_by = p_admin_id
  WHERE id = p_request_id;

  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    description,
    metadata,
    created_at
  )
  VALUES (
    v_payout.user_id,
    0,
    'cashout',
    'Cashout finalized - payout processed',
    jsonb_build_object(
      'payout_request_id', p_request_id,
      'admin_id', p_admin_id,
      'action', 'finalize'
    ),
    v_now
  );

  SELECT id
  INTO v_claim_id
  FROM public.cashout_promotion_claims
  WHERE payout_request_id = p_request_id
    AND status IN ('pending', 'approved')
  LIMIT 1;

  IF v_claim_id IS NOT NULL THEN
    BEGIN
      v_promo_result := public.issue_first_cashout_match(v_claim_id, p_admin_id);
    EXCEPTION
      WHEN OTHERS THEN
        v_promo_result := jsonb_build_object('success', false, 'error', SQLERRM);
    END;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payout_id', p_request_id,
    'promotion_issued', COALESCE((v_promo_result->>'success')::boolean, false),
    'promotion', v_promo_result,
    'duplicate', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.troll_bank_deny_cashout(
  p_request_id uuid,
  p_admin_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payout public.payout_requests%ROWTYPE;
  v_claim public.cashout_promotion_claims%ROWTYPE;
  v_coins_to_return bigint;
  v_updated_rows integer;
  v_now timestamptz := now();
BEGIN
  IF p_admin_id IS NULL THEN
    RAISE EXCEPTION 'A verified processing actor is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_payout
  FROM public.payout_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  IF v_payout.status IN ('denied', 'rejected') THEN
    RETURN jsonb_build_object('success', true, 'coins_returned', 0, 'duplicate', true);
  END IF;

  IF v_payout.status IN ('paid', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel a paid payout');
  END IF;

  IF v_payout.status IS NULL
     OR v_payout.status NOT IN ('pending', 'approved', 'processing', 'failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout is not in a refundable state',
      'status', v_payout.status
    );
  END IF;

  v_coins_to_return := COALESCE(v_payout.coin_amount, 0) + COALESCE(v_payout.fee_coins, 0);
  IF v_coins_to_return < 0 THEN
    RAISE EXCEPTION 'Invalid payout refund amount'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_coins_to_return,
      updated_at = v_now
  WHERE id = v_payout.user_id;

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
  IF v_updated_rows = 0 THEN
    RAISE EXCEPTION 'Payout owner not found'
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.payout_requests
  SET status = 'denied',
      updated_at = v_now,
      processed_by = p_admin_id,
      rejection_reason = p_reason
  WHERE id = p_request_id;

  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    description,
    metadata,
    created_at
  )
  VALUES (
    v_payout.user_id,
    v_coins_to_return,
    'refund',
    'Cashout denied - coins and fee returned',
    jsonb_build_object(
      'payout_request_id', p_request_id,
      'admin_id', p_admin_id,
      'reason', p_reason
    ),
    v_now
  );

  SELECT *
  INTO v_claim
  FROM public.cashout_promotion_claims
  WHERE payout_request_id = p_request_id
    AND status = 'pending'
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.cashout_promotions
    SET winners_claimed = GREATEST(winners_claimed - 1, 0),
        updated_at = v_now
    WHERE id = v_claim.promotion_id;

    UPDATE public.cashout_promotion_claims
    SET status = 'rejected',
        review_status = 'rejected',
        reviewed_by = p_admin_id,
        reviewed_at = v_now,
        review_reason = COALESCE(p_reason, 'Payout denied - promotion slot returned'),
        metadata = COALESCE(metadata, '{}'::jsonb)
          || jsonb_build_object('denied_at', v_now, 'admin_id', p_admin_id)
    WHERE id = v_claim.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'coins_returned', v_coins_to_return,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_cashout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_cashout(uuid) TO authenticated, service_role;

DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT n.nspname,
           p.proname,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname = ANY (ARRAY[
        'add_free_coins',
        'add_paid_coins',
        'add_troll_coins',
        'adjust_balance',
        'troll_bank_credit_coins',
        'admin_grant_coins',
        'admin_update_any_profile_field',
        'troll_bank_finalize_cashout',
        'troll_bank_deny_cashout',
        'reserve_first_cashout_match_slot',
        'issue_first_cashout_match',
        'award_friday_battle_gifter_bonus',
        'send_gift_in_stream'
      ])
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
      v_function.nspname,
      v_function.proname,
      v_function.identity_args
    );
  END LOOP;
END;
$$;

COMMIT;

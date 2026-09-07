-- ============================================================================
-- Migration: First Cashout Match Promotion
-- Date: 2026-09-07
-- Purpose: Implements a configurable first-cashout-match promotion with
--          atomic slot reservation, financial ledger tracking, and admin controls.
-- ============================================================================

-- 1. Promotion configuration table
CREATE TABLE IF NOT EXISTS public.cashout_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'First Cashout Match',
  slug TEXT NOT NULL DEFAULT 'first_cashout_match',
  enabled BOOLEAN NOT NULL DEFAULT false,
  max_winners INTEGER NOT NULL DEFAULT 10,
  winners_claimed INTEGER NOT NULL DEFAULT 0,
  max_match_amount NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  minimum_cashout NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
  match_type TEXT NOT NULL DEFAULT 'percentage' CHECK (match_type IN ('fixed', 'percentage')),
  match_percentage INTEGER DEFAULT 50 CHECK (match_percentage >= 0 AND match_percentage <= 100),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  eligible_coin_sources TEXT[] NOT NULL DEFAULT ARRAY['gift_received', 'purchase'],
  description TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_first_cashout_match
  ON public.cashout_promotions(slug)
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_cashout_promotions_enabled
  ON public.cashout_promotions(enabled);

CREATE INDEX IF NOT EXISTS idx_cashout_promotions_slug
  ON public.cashout_promotions(slug);

ALTER TABLE public.cashout_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage cashout promotions"
  ON public.cashout_promotions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  );

CREATE POLICY "Public can read active promotion"
  ON public.cashout_promotions
  FOR SELECT
  USING (enabled = true AND NOW() BETWEEN starts_at AND ends_at);

-- 2. Promotion claims table
CREATE TABLE IF NOT EXISTS public.cashout_promotion_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.cashout_promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  payout_request_id UUID NOT NULL REFERENCES public.payout_requests(id) ON DELETE CASCADE,
  qualifying_amount NUMERIC(10, 2) NOT NULL,
  match_amount NUMERIC(10, 2) NOT NULL,
  match_coins BIGINT NOT NULL,
  winner_number INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'under_review', 'issued', 'reversed')),
  review_status TEXT NOT NULL DEFAULT 'none' CHECK (review_status IN ('none', 'pending', 'approved', 'rejected')),
  review_reason TEXT,
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issued_at TIMESTAMPTZ,
  reversed_at TIMESTAMPTZ,
  CONSTRAINT unique_user_promotion UNIQUE (promotion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cashout_promotion_claims_promotion
  ON public.cashout_promotion_claims(promotion_id);

CREATE INDEX IF NOT EXISTS idx_cashout_promotion_claims_user
  ON public.cashout_promotion_claims(user_id);

CREATE INDEX IF NOT EXISTS idx_cashout_promotion_claims_status
  ON public.cashout_promotion_claims(status);

CREATE INDEX IF NOT EXISTS idx_cashout_promotion_claims_payout
  ON public.cashout_promotion_claims(payout_request_id);

ALTER TABLE public.cashout_promotion_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims"
  ON public.cashout_promotion_claims
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage claims"
  ON public.cashout_promotion_claims
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.role = 'admin' OR up.is_admin = true)
    )
  );

-- 3. RPC: Get active promotion config
CREATE OR REPLACE FUNCTION public.get_first_cashout_match_promotion()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'slug', p.slug,
    'enabled', p.enabled,
    'max_winners', p.max_winners,
    'winners_claimed', p.winners_claimed,
    'max_match_amount', p.max_match_amount,
    'minimum_cashout', p.minimum_cashout,
    'match_type', p.match_type,
    'match_percentage', p.match_percentage,
    'starts_at', p.starts_at,
    'ends_at', p.ends_at,
    'eligible_coin_sources', p.eligible_coin_sources,
    'description', p.description,
    'terms', p.terms,
    'spots_remaining', GREATEST(p.max_winners - p.winners_claimed, 0),
    'is_active', p.enabled AND NOW() BETWEEN p.starts_at AND p.ends_at AND p.winners_claimed < p.max_winners
  )
  FROM public.cashout_promotions p
  WHERE p.slug = 'first_cashout_match'
  ORDER BY p.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_first_cashout_match_promotion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_first_cashout_match_promotion() TO service_role;

-- 4. RPC: Check eligibility and reserve a promotion slot atomically
CREATE OR REPLACE FUNCTION public.reserve_first_cashout_match_slot(
  p_user_id UUID,
  p_payout_request_id UUID,
  p_qualifying_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_existing_claim UUID;
  v_winner_number INTEGER;
  v_match_amount NUMERIC(10, 2);
  v_match_coins BIGINT;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Get active promotion
  SELECT * INTO v_promo
  FROM public.cashout_promotions
  WHERE slug = 'first_cashout_match'
    AND enabled = true
    AND NOW() BETWEEN starts_at AND ends_at
    AND winners_claimed < max_winners
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active promotion available');
  END IF;

  -- Check if user already claimed this promotion
  SELECT id INTO v_existing_claim
  FROM public.cashout_promotion_claims
  WHERE promotion_id = v_promo.id AND user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User has already claimed this promotion', 'code', 'already_claimed');
  END IF;

  -- Check minimum cashout
  IF p_qualifying_amount < v_promo.minimum_cashout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cashout does not meet minimum threshold', 'code', 'below_minimum');
  END IF;

  -- Atomically increment winner count and get winner number
  UPDATE public.cashout_promotions
  SET winners_claimed = winners_claimed + 1,
      updated_at = v_now
  WHERE id = v_promo.id
    AND winners_claimed < max_winners
  RETURNING winners_claimed, max_winners INTO v_winner_number, v_promo.max_winners;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promotion slots exhausted', 'code', 'no_slots');
  END IF;

  -- Calculate match amount
  IF v_promo.match_type = 'percentage' THEN
    v_match_amount := ROUND(p_qualifying_amount * v_promo.match_percentage / 100.0, 2);
  ELSE
    v_match_amount := LEAST(v_promo.max_match_amount, p_qualifying_amount);
  END IF;

  -- Convert match amount to coins (200 coins = $1)
  v_match_coins := GREATEST(ROUND(v_match_amount * 200), 0);

  -- Create claim record
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
  ) VALUES (
    v_promo.id,
    p_user_id,
    p_payout_request_id,
    p_qualifying_amount,
    v_match_amount,
    v_match_coins,
    v_winner_number,
    'pending',
    'none',
    jsonb_build_object(
      'reserved_at', v_now,
      'promotion_name', v_promo.name
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'promotion_id', v_promo.id,
    'claim_id', (SELECT id FROM public.cashout_promotion_claims WHERE user_id = p_user_id AND promotion_id = v_promo.id ORDER BY created_at DESC LIMIT 1),
    'winner_number', v_winner_number,
    'match_amount', v_match_amount,
    'match_coins', v_match_coins,
    'spots_remaining', v_promo.max_winners - v_winner_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_first_cashout_match_slot(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_first_cashout_match_slot(UUID, UUID, NUMERIC) TO service_role;

-- 5. RPC: Issue the promotional match (called after payout is finalized)
CREATE OR REPLACE FUNCTION public.issue_first_cashout_match(
  p_claim_id UUID,
  p_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
  v_promo RECORD;
  v_payout RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT * INTO v_claim
  FROM public.cashout_promotion_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Claim not found');
  END IF;

  IF v_claim.status NOT IN ('pending', 'approved') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Claim is not in a issuable state', 'status', v_claim.status);
  END IF;

  SELECT * INTO v_promo
  FROM public.cashout_promotions
  WHERE id = v_claim.promotion_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promotion not found');
  END IF;

  -- Verify payout is finalized
  SELECT * INTO v_payout
  FROM public.payout_requests
  WHERE id = v_claim.payout_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout request not found');
  END IF;

  IF v_payout.status NOT IN ('paid', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout has not been finalized', 'payout_status', v_payout.status);
  END IF;

  -- Credit user with match coins
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_claim.match_coins,
      updated_at = v_now
  WHERE id = v_claim.user_id;

  -- Log promotion reward transaction
  INSERT INTO public.coin_transactions (
    user_id,
    amount,
    type,
    description,
    metadata,
    created_at
  ) VALUES (
    v_claim.user_id,
    v_claim.match_coins,
    'promotion_reward',
    format('First Cashout Match - Winner #%s: +%s coins (%s)', v_claim.winner_number, v_claim.match_coins, v_promo.name),
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

  -- Update claim status
  UPDATE public.cashout_promotion_claims
  SET status = 'issued',
      issued_at = v_now,
      metadata = jsonb_build_object('issued_at', v_now, 'admin_id', p_admin_id) || metadata
  WHERE id = p_claim_id;

  RETURN jsonb_build_object(
    'success', true,
    'match_coins', v_claim.match_coins,
    'match_amount', v_claim.match_amount,
    'winner_number', v_claim.winner_number
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_first_cashout_match(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_first_cashout_match(UUID, UUID) TO service_role;

-- 6. RPC: Admin upsert promotion settings
CREATE OR REPLACE FUNCTION public.admin_upsert_first_cashout_match_promotion(
  p_enabled BOOLEAN DEFAULT NULL,
  p_max_winners INTEGER DEFAULT NULL,
  p_max_match_amount NUMERIC DEFAULT NULL,
  p_minimum_cashout NUMERIC DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_terms TEXT DEFAULT NULL,
  p_match_type TEXT DEFAULT NULL,
  p_match_percentage INTEGER DEFAULT NULL,
  p_eligible_coin_sources TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_promo RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Ensure caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'admin' OR up.is_admin = true)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_promo
  FROM public.cashout_promotions
  WHERE slug = 'first_cashout_match'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.cashout_promotions
    SET
      enabled = COALESCE(p_enabled, enabled),
      max_winners = COALESCE(p_max_winners, max_winners),
      max_match_amount = COALESCE(p_max_match_amount, max_match_amount),
      minimum_cashout = COALESCE(p_minimum_cashout, minimum_cashout),
      starts_at = COALESCE(p_starts_at, starts_at),
      ends_at = COALESCE(p_ends_at, ends_at),
      description = COALESCE(p_description, description),
      terms = COALESCE(p_terms, terms),
      match_type = COALESCE(p_match_type, match_type),
      match_percentage = COALESCE(p_match_percentage, match_percentage),
      eligible_coin_sources = COALESCE(p_eligible_coin_sources, eligible_coin_sources),
      updated_at = v_now
    WHERE id = v_promo.id
    RETURNING * INTO v_promo;
  ELSE
    INSERT INTO public.cashout_promotions (
      name,
      slug,
      enabled,
      max_winners,
      max_match_amount,
      minimum_cashout,
      starts_at,
      ends_at,
      description,
      terms,
      match_type,
      match_percentage,
      eligible_coin_sources
    ) VALUES (
      'First Cashout Match',
      'first_cashout_match',
      COALESCE(p_enabled, false),
      COALESCE(p_max_winners, 10),
      COALESCE(p_max_match_amount, 10.00),
      COALESCE(p_minimum_cashout, 10.00),
      COALESCE(p_starts_at, v_now),
      COALESCE(p_ends_at, v_now + INTERVAL '30 days'),
      p_description,
      p_terms,
      COALESCE(p_match_type, 'percentage'),
      COALESCE(p_match_percentage, 50),
      COALESCE(p_eligible_coin_sources, ARRAY['gift_received', 'purchase'])
    )
    RETURNING * INTO v_promo;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'promotion', row_to_json(v_promo)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_upsert_first_cashout_match_promotion(BOOLEAN, INTEGER, NUMERIC, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER, TEXT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_first_cashout_match_promotion(BOOLEAN, INTEGER, NUMERIC, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, INTEGER, TEXT[]) TO service_role;

-- 7. RPC: Admin list claims
CREATE OR REPLACE FUNCTION public.admin_list_first_cashout_match_claims(
  p_status TEXT DEFAULT NULL,
  p_review_status TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (up.role = 'admin' OR up.is_admin = true)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT jsonb_agg(row_to_json(c))
  INTO v_result
  FROM (
    SELECT
      c.id,
      c.promotion_id,
      c.user_id,
      c.payout_request_id,
      c.qualifying_amount,
      c.match_amount,
      c.match_coins,
      c.winner_number,
      c.status,
      c.review_status,
      c.review_reason,
      c.reviewed_by,
      c.reviewed_at,
      c.created_at,
      c.issued_at,
      c.reversed_at,
      c.metadata,
      up.username,
      up.display_name,
      up.avatar_url,
      pr.status AS payout_status,
      pr.cash_amount AS payout_cash_amount
    FROM public.cashout_promotion_claims c
    LEFT JOIN public.user_profiles up ON up.id = c.user_id
    LEFT JOIN public.payout_requests pr ON pr.id = c.payout_request_id
    WHERE (p_status IS NULL OR c.status = p_status)
      AND (p_review_status IS NULL OR c.review_status = p_review_status)
    ORDER BY c.created_at DESC
    LIMIT GREATEST(LEAST(p_limit, 500), 1)
  ) c;

  RETURN jsonb_build_object(
    'success', true,
    'claims', COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_first_cashout_match_claims(TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_first_cashout_match_claims(TEXT, TEXT, INTEGER) TO service_role;

-- 8. RPC: Admin review/approve/reject claim
CREATE OR REPLACE FUNCTION public.admin_review_first_cashout_match_claim(
  p_claim_id UUID,
  p_action TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
  v_admin_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = v_admin_id
      AND (up.role = 'admin' OR up.is_admin = true)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_claim
  FROM public.cashout_promotion_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Claim not found');
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.cashout_promotion_claims
    SET review_status = 'approved',
        status = 'approved',
        reviewed_by = v_admin_id,
        reviewed_at = v_now,
        review_reason = p_reason,
        metadata = jsonb_build_object('reviewed_at', v_now, 'reviewed_by', v_admin_id, 'review_reason', p_reason) || metadata
    WHERE id = p_claim_id;

    RETURN jsonb_build_object('success', true, 'message', 'Claim approved');
  ELSIF p_action = 'reject' THEN
    -- Return the winner slot to the promotion
    UPDATE public.cashout_promotions
    SET winners_claimed = GREATEST(winners_claimed - 1, 0),
        updated_at = v_now
    WHERE id = v_claim.promotion_id;

    UPDATE public.cashout_promotion_claims
    SET review_status = 'rejected',
        status = 'rejected',
        reviewed_by = v_admin_id,
        reviewed_at = v_now,
        review_reason = p_reason,
        metadata = jsonb_build_object('reviewed_at', v_now, 'reviewed_by', v_admin_id, 'review_reason', p_reason) || metadata
    WHERE id = p_claim_id;

    RETURN jsonb_build_object('success', true, 'message', 'Claim rejected, slot returned');
  ELSIF p_action = 'flag' THEN
    UPDATE public.cashout_promotion_claims
    SET review_status = 'pending',
        status = 'under_review',
        review_reason = p_reason,
        metadata = jsonb_build_object('flagged_at', v_now, 'flagged_by', v_admin_id, 'flag_reason', p_reason) || metadata
    WHERE id = p_claim_id;

    RETURN jsonb_build_object('success', true, 'message', 'Claim flagged for review');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_review_first_cashout_match_claim(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_first_cashout_match_claim(UUID, TEXT, TEXT) TO service_role;

-- 9. Seed initial promotion row if none exists
INSERT INTO public.cashout_promotions (
  name,
  slug,
  enabled,
  max_winners,
  max_match_amount,
  minimum_cashout,
  starts_at,
  ends_at,
  description,
  terms
)
SELECT
  'First Cashout Match',
  'first_cashout_match',
  false,
  10,
  10.00,
  10.00,
  NOW(),
  NOW() + INTERVAL '30 days',
  'First 10 eligible broadcasters get their first cashout matched by MaiTroll.',
  'One match per broadcaster. Must be first eligible cashout. Promotion must be active.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cashout_promotions WHERE slug = 'first_cashout_match'
);

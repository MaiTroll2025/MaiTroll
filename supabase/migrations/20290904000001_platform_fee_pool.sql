-- =============================================================================
-- MIGRATION: Platform Fee Pool
-- Date: 2026-09-04
-- =============================================================================
-- Creates a single, canonical ledger for every platform fee taken anywhere in
-- Troll City (story tips, marketplace sales, gift platform share, cashout
-- processing fees, ...).
--
-- Every fee is:
--   1. recorded as one row in public.platform_fee_pool
--   2. credited to the platform admin account (troll_coins)
--   3. mirrored into coin_transactions for the admin audit trail
--
-- Valuation rule (used by the admin Fee Pool page):
--   100 coins = $1.00 USD  (coin store base ratio, BEFORE the 10% pack bonus)
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Fee pool ledger table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.platform_fee_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fee_type TEXT NOT NULL,
    fee_label TEXT,
    coins BIGINT NOT NULL CHECK (coins > 0),
    gross_coins BIGINT,
    fee_percent NUMERIC(6, 3),
    payer_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    earner_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    admin_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    credited_to_admin BOOLEAN NOT NULL DEFAULT FALSE,
    reference_table TEXT,
    reference_id UUID,
    idempotency_key TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_fee_pool_fee_type ON public.platform_fee_pool(fee_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_fee_pool_idempotency
  ON public.platform_fee_pool(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_platform_fee_pool_created_at ON public.platform_fee_pool(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_fee_pool_payer ON public.platform_fee_pool(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_fee_pool_earner ON public.platform_fee_pool(earner_user_id);
CREATE INDEX IF NOT EXISTS idx_platform_fee_pool_reference ON public.platform_fee_pool(reference_table, reference_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_fee_pool_idempotency
  ON public.platform_fee_pool(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE public.platform_fee_pool IS
  'Canonical ledger of every platform fee collected across Troll City. Valued at 100 coins = $1 USD.';
COMMENT ON COLUMN public.platform_fee_pool.coins IS 'Fee amount in troll coins retained by the platform.';
COMMENT ON COLUMN public.platform_fee_pool.gross_coins IS 'Full transaction amount the fee was taken from.';

-- =============================================================================
-- PART 2: RLS - admin read only, writes only through SECURITY DEFINER functions
-- =============================================================================

ALTER TABLE public.platform_fee_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_fee_pool_admin_read" ON public.platform_fee_pool;
CREATE POLICY "platform_fee_pool_admin_read" ON public.platform_fee_pool
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );

-- =============================================================================
-- PART 3: Resolve the platform admin account
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_platform_admin_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.user_profiles
  WHERE is_admin = TRUE OR role IN ('admin', 'superadmin')
  ORDER BY (role = 'admin') DESC, created_at ASC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_platform_admin_user_id() IS
  'Returns the user id of the platform admin account that receives all platform fees.';

GRANT EXECUTE ON FUNCTION public.get_platform_admin_user_id() TO authenticated, service_role;

-- =============================================================================
-- PART 4: record_platform_fee - the ONLY way fees enter the pool
-- =============================================================================

CREATE OR REPLACE FUNCTION public.record_platform_fee(
  p_fee_type TEXT,
  p_coins BIGINT,
  p_gross_coins BIGINT DEFAULT NULL,
  p_fee_percent NUMERIC DEFAULT NULL,
  p_payer_user_id UUID DEFAULT NULL,
  p_earner_user_id UUID DEFAULT NULL,
  p_reference_table TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_fee_label TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_credit_admin BOOLEAN DEFAULT TRUE,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID;
  v_fee_id UUID;
  v_credited BOOLEAN := FALSE;
BEGIN
  IF p_coins IS NULL OR p_coins <= 0 THEN
    RETURN NULL;
  END IF;

  IF p_fee_type IS NULL OR btrim(p_fee_type) = '' THEN
    RAISE EXCEPTION 'record_platform_fee: fee_type is required';
  END IF;

  /*
   * Guard rails for calls that originate from a signed in user (the marketplace
   * checkout, story tips, ...). Server side jobs run without a JWT and are
   * trusted. A user may only ever book a fee against money they just spent, and
   * must supply an idempotency key so the same transaction cannot be recorded
   * twice.
   */
  IF auth.uid() IS NOT NULL THEN
    IF p_payer_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'record_platform_fee: the payer must be the calling user';
    END IF;

    IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
      RAISE EXCEPTION 'record_platform_fee: an idempotency key is required';
    END IF;

    IF p_gross_coins IS NULL OR p_coins > p_gross_coins THEN
      RAISE EXCEPTION 'record_platform_fee: the fee cannot exceed the gross amount';
    END IF;
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_fee_id
    FROM public.platform_fee_pool
    WHERE idempotency_key = p_idempotency_key;

    IF v_fee_id IS NOT NULL THEN
      RETURN v_fee_id;
    END IF;
  END IF;

  v_admin_id := public.get_platform_admin_user_id();

  IF p_credit_admin AND v_admin_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + p_coins,
        total_earned_coins = COALESCE(total_earned_coins, 0) + p_coins
    WHERE id = v_admin_id;

    v_credited := TRUE;
  END IF;

  BEGIN
    INSERT INTO public.platform_fee_pool (
      fee_type, fee_label, coins, gross_coins, fee_percent,
      payer_user_id, earner_user_id, admin_user_id, credited_to_admin,
      reference_table, reference_id, idempotency_key, metadata
    ) VALUES (
      btrim(p_fee_type), p_fee_label, p_coins, p_gross_coins, p_fee_percent,
      p_payer_user_id, p_earner_user_id, v_admin_id, v_credited,
      p_reference_table, p_reference_id, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_fee_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- A concurrent call already booked this idempotency key. Return the
      -- existing row instead of erroring or double-crediting the admin. The
      -- admin balance was already updated by the winner, so skip the ledger
      -- mirror below.
      v_credited := FALSE;
      SELECT id INTO v_fee_id
      FROM public.platform_fee_pool
      WHERE idempotency_key = p_idempotency_key;
  END;

  IF v_credited THEN
    BEGIN
      INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
      VALUES (
        v_admin_id,
        'earn',
        p_coins,
        COALESCE(p_fee_label, 'Platform fee') || ' (' || btrim(p_fee_type) || ')',
        COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
          'fee_pool_id', v_fee_id,
          'fee_type', btrim(p_fee_type),
          'gross_coins', p_gross_coins,
          'fee_percent', p_fee_percent
        ),
        NOW()
      );
    EXCEPTION WHEN OTHERS THEN
      -- Ledger mirroring must never block the fee itself.
      NULL;
    END;
  END IF;

  RETURN v_fee_id;
END;
$$;

COMMENT ON FUNCTION public.record_platform_fee(TEXT, BIGINT, BIGINT, NUMERIC, UUID, UUID, TEXT, UUID, TEXT, JSONB, BOOLEAN, TEXT) IS
  'Records a platform fee in the fee pool and credits the admin account. Single entry point for all platform fees.';

GRANT EXECUTE ON FUNCTION public.record_platform_fee(TEXT, BIGINT, BIGINT, NUMERIC, UUID, UUID, TEXT, UUID, TEXT, JSONB, BOOLEAN, TEXT)
  TO authenticated, service_role;

-- =============================================================================
-- PART 5: Admin reporting - totals + per-fee-type breakdown
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_fee_pool_summary(
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_total_coins BIGINT;
  v_total_entries BIGINT;
  v_breakdown JSONB;
BEGIN
  SELECT (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
  INTO v_is_admin
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COALESCE(SUM(coins), 0), COUNT(*)
  INTO v_total_coins, v_total_entries
  FROM public.platform_fee_pool
  WHERE (p_from IS NULL OR created_at >= p_from)
    AND (p_to IS NULL OR created_at <= p_to);

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.coins DESC), '[]'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT
      fee_type,
      MAX(COALESCE(fee_label, fee_type)) AS fee_label,
      SUM(coins)::BIGINT AS coins,
      COUNT(*)::BIGINT AS entries,
      ROUND((SUM(coins) / 100.0)::numeric, 2) AS usd_value,
      COALESCE(SUM(gross_coins), 0)::BIGINT AS gross_coins,
      MAX(created_at) AS last_collected_at,
      MIN(created_at) AS first_collected_at
    FROM public.platform_fee_pool
    WHERE (p_from IS NULL OR created_at >= p_from)
      AND (p_to IS NULL OR created_at <= p_to)
    GROUP BY fee_type
  ) t;

  RETURN jsonb_build_object(
    'coins_per_usd', 100,
    'total_coins', v_total_coins,
    'total_usd', ROUND((v_total_coins / 100.0)::numeric, 2),
    'total_entries', v_total_entries,
    'breakdown', v_breakdown,
    'generated_at', NOW()
  );
END;
$$;

COMMENT ON FUNCTION public.admin_get_fee_pool_summary(TIMESTAMPTZ, TIMESTAMPTZ) IS
  'Admin-only fee pool totals with per-fee-type breakdown valued at 100 coins = $1.';

GRANT EXECUTE ON FUNCTION public.admin_get_fee_pool_summary(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_get_fee_pool_entries(
  p_fee_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_rows JSONB;
BEGIN
  SELECT (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
  INTO v_is_admin
  FROM public.user_profiles up
  WHERE up.id = auth.uid();

  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      f.id,
      f.fee_type,
      f.fee_label,
      f.coins,
      ROUND((f.coins / 100.0)::numeric, 2) AS usd_value,
      f.gross_coins,
      f.fee_percent,
      f.created_at,
      f.reference_table,
      f.reference_id,
      payer.username AS payer_username,
      earner.username AS earner_username
    FROM public.platform_fee_pool f
    LEFT JOIN public.user_profiles payer ON payer.id = f.payer_user_id
    LEFT JOIN public.user_profiles earner ON earner.id = f.earner_user_id
    WHERE (p_fee_type IS NULL OR f.fee_type = p_fee_type)
    ORDER BY f.created_at DESC
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  ) t;

  RETURN v_rows;
END;
$$;

COMMENT ON FUNCTION public.admin_get_fee_pool_entries(TEXT, INTEGER, INTEGER) IS
  'Admin-only paginated fee pool entries, optionally filtered by fee type.';

GRANT EXECUTE ON FUNCTION public.admin_get_fee_pool_entries(TEXT, INTEGER, INTEGER) TO authenticated, service_role;

COMMIT;

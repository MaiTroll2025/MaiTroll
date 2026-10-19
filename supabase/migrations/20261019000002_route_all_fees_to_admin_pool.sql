-- Route every platform fee into admin_pool.trollcoins_balance as well as the
-- platform admin's user_profiles.troll_coins, so the Admin Pool page reflects
-- all fees collected across Troll City.
--
-- record_platform_fee() is the single entry point for all platform fees
-- (marketplace sales, story tips, cashout processing, gift platform share, ...).
-- It already credits user_profiles.troll_coins and records platform_fee_pool.
-- This migration adds a mirror credit into public.admin_pool so that /admin/pool
-- shows the full fee accumulation.

BEGIN;

-- Ensure admin_pool table exists (defensive; created by earlier migrations)
CREATE TABLE IF NOT EXISTS public.admin_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  trollcoins_balance NUMERIC(18,2) DEFAULT 0,
  total_liability_coins BIGINT DEFAULT 0,
  total_liability_usd NUMERIC(18,2) DEFAULT 0,
  total_paid_usd NUMERIC(18,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure admin_pool_ledger table exists (defensive)
CREATE TABLE IF NOT EXISTS public.admin_pool_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(18,3) NOT NULL,
  reason TEXT NOT NULL,
  ref_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS on admin_pool / admin_pool_ledger (admin write/read only)
ALTER TABLE public.admin_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_pool_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read admin_pool" ON public.admin_pool;
DROP POLICY IF EXISTS "Admins can insert admin_pool" ON public.admin_pool;
DROP POLICY IF EXISTS "Admins can update admin_pool" ON public.admin_pool;
DROP POLICY IF EXISTS "Admins can delete admin_pool" ON public.admin_pool;
DROP POLICY IF EXISTS "Admins can read admin_pool_ledger" ON public.admin_pool_ledger;
DROP POLICY IF EXISTS "Admins can insert admin_pool_ledger" ON public.admin_pool_ledger;

CREATE POLICY "Admins can read admin_pool" ON public.admin_pool
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );
CREATE POLICY "Admins can insert admin_pool" ON public.admin_pool
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );
CREATE POLICY "Admins can update admin_pool" ON public.admin_pool
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );
CREATE POLICY "Admins can delete admin_pool" ON public.admin_pool
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );

CREATE POLICY "Admins can read admin_pool_ledger" ON public.admin_pool_ledger
  FOR SELECT USING (
    auth.uid() = ref_user_id OR
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );
CREATE POLICY "Admins can insert admin_pool_ledger" ON public.admin_pool_ledger
  FOR INSERT WITH CHECK (
    auth.uid() = ref_user_id OR
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin = TRUE OR up.role IN ('admin', 'superadmin', 'ceo'))
    )
  );

-- Recreate record_platform_fee to also credit admin_pool.trollcoins_balance
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
  v_pool_id UUID;
BEGIN
  IF p_coins IS NULL OR p_coins <= 0 THEN
    RETURN NULL;
  END IF;

  IF p_fee_type IS NULL OR btrim(p_fee_type) = '' THEN
    RAISE EXCEPTION 'record_platform_fee: fee_type is required';
  END IF;

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

  -- NEW: Mirror the fee into admin_pool.trollcoins_balance so the Admin Pool
  -- page reflects every platform fee. Upsert the single pool row.
  IF p_credit_admin AND v_admin_id IS NOT NULL THEN
    SELECT id INTO v_pool_id
    FROM public.admin_pool
    LIMIT 1;

    IF v_pool_id IS NULL THEN
      INSERT INTO public.admin_pool (user_id, trollcoins_balance, updated_at)
      VALUES (v_admin_id, p_coins, now())
      RETURNING id INTO v_pool_id;
    ELSE
      UPDATE public.admin_pool
      SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + p_coins,
          updated_at = now()
      WHERE id = v_pool_id;
    END IF;

    INSERT INTO public.admin_pool_ledger (
      amount, reason, ref_user_id, created_at
    ) VALUES (
      p_coins,
      COALESCE(p_fee_label, 'Platform fee') || ' (' || btrim(p_fee_type) || ')',
      v_admin_id,
      now()
    );
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
      NULL;
    END;
  END IF;

  RETURN v_fee_id;
END;
$$;

COMMIT;

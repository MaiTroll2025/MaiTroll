-- Route Creator Subscription platform (CEO) fee into admin_pool.trollcoins_balance
-- Currently subscribe_to_creator credits v_ceo_amount directly to the admin's
-- user_profiles.troll_coins but never touches admin_pool. This migration mirrors
-- the same amount into admin_pool so the Admin Pool page reflects it.

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

-- Recreate subscribe_to_creator to also credit admin_pool.trollcoins_balance
-- with the CEO/platform fee amount (v_ceo_amount).
CREATE OR REPLACE FUNCTION public.subscribe_to_creator(p_creator_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_subscriber public.user_profiles%ROWTYPE;
  v_creator public.user_profiles%ROWTYPE;
  v_existing public.user_subscriptions%ROWTYPE;
  v_subscription_id UUID;
  v_price INTEGER;
  v_creator_amount INTEGER;
  v_ceo_amount INTEGER;
  v_ceo_id UUID;
  v_platform_fee_percent INTEGER;
  v_pool_id UUID;
BEGIN
  SELECT * INTO v_subscriber
  FROM public.user_profiles
  WHERE id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscriber not authenticated');
  END IF;

  SELECT * INTO v_creator
  FROM public.user_profiles
  WHERE id = p_creator_id;
  IF NOT FOUND OR NOT v_creator.creator_subscription_enabled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Creator subscriptions not available');
  END IF;

  IF v_subscriber.id = v_creator.id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot subscribe to yourself');
  END IF;

  v_price := COALESCE(v_creator.creator_subscription_price_coins, 100);
  IF v_price <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid creator subscription price');
  END IF;

  v_platform_fee_percent := CASE
    WHEN private.mai_supreme_is_active(v_subscriber.id) THEN 0
    ELSE 20
  END;
  v_ceo_amount := v_price * v_platform_fee_percent / 100;
  v_creator_amount := v_price - v_ceo_amount;

  SELECT * INTO v_existing
  FROM public.user_subscriptions
  WHERE subscriber_id = v_subscriber.id
    AND broadcaster_id = v_creator.id
    AND is_active = true
  FOR UPDATE;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already subscribed to this creator');
  END IF;

  IF COALESCE(v_subscriber.troll_coins, 0) < v_price THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient coins. Required: ' || v_price || '. You have: ' || COALESCE(v_subscriber.troll_coins, 0)
    );
  END IF;

  SELECT id INTO v_ceo_id
  FROM public.user_profiles
  WHERE role IN ('admin', 'ceo', 'superadmin')
  LIMIT 1;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_price
  WHERE id = v_subscriber.id;

  UPDATE public.user_profiles
  SET troll_coins = troll_coins + v_creator_amount
  WHERE id = v_creator.id;

  IF v_ceo_amount > 0 AND v_ceo_id IS NOT NULL THEN
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_ceo_amount
    WHERE id = v_ceo_id;

    -- NEW: Mirror the CEO/platform fee into admin_pool.trollcoins_balance
    SELECT id INTO v_pool_id
    FROM public.admin_pool
    LIMIT 1;

    IF v_pool_id IS NULL THEN
      INSERT INTO public.admin_pool (user_id, trollcoins_balance, updated_at)
      VALUES (v_ceo_id, v_ceo_amount, now())
      RETURNING id INTO v_pool_id;
    ELSE
      UPDATE public.admin_pool
      SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_ceo_amount,
          updated_at = now()
      WHERE id = v_pool_id;
    END IF;

    INSERT INTO public.admin_pool_ledger (
      amount, reason, ref_user_id, created_at
    ) VALUES (
      v_ceo_amount,
      'Creator Subscription Platform Fee',
      v_ceo_id,
      now()
    );
  END IF;

  INSERT INTO public.user_subscriptions (
    subscriber_id,
    broadcaster_id,
    price_paid_coins,
    creator_amount_coins,
    ceo_amount_coins,
    started_at,
    expires_at,
    is_active
  ) VALUES (
    v_subscriber.id,
    v_creator.id,
    v_price,
    v_creator_amount,
    v_ceo_amount,
    now(),
    now() + INTERVAL '30 days',
    true
  ) RETURNING id INTO v_subscription_id;

  INSERT INTO public.subscription_revenue_log (
    broadcaster_id,
    subscription_id,
    amount_coins,
    transaction_type,
    status,
    notes
  ) VALUES (
    v_creator.id,
    v_subscription_id,
    v_price,
    'monthly_fee',
    'completed',
    CASE WHEN v_platform_fee_percent = 0
      THEN 'Creator subscription - platform fee waived (Mai Supreme)'
      ELSE 'Creator subscription - platform fee applied'
    END
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription_id,
    'price_paid_coins', v_price,
    'creator_amount_coins', v_creator_amount,
    'ceo_amount_coins', v_ceo_amount,
    'platform_fee_percent', v_platform_fee_percent,
    'expires_at', now() + INTERVAL '30 days'
  );
END;
$$;

COMMIT;

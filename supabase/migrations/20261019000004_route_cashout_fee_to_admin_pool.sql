-- Route Cashout provider fees into admin_pool.trollcoins_balance
-- Currently request_cashout deducts v_fee_amount from the user's troll_coins
-- but never credits it anywhere (it effectively disappears from the user balance
-- with no corresponding admin credit). This migration mirrors the fee into
-- admin_pool.trollcoins_balance so the Admin Pool page reflects it.

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

-- Recreate request_cashout to also credit admin_pool.trollcoins_balance
-- with v_fee_amount (Venmo/CashApp 5%, PayPal $0.25=50 coins, others 0).
CREATE OR REPLACE FUNCTION public.request_cashout(
    p_user_id UUID,
    p_coins_to_redeem BIGINT,
    p_provider_type TEXT,
    p_provider_username TEXT,
    p_user_tag TEXT DEFAULT NULL,
    p_id_verification_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user RECORD;
    v_available_coins BIGINT;
    v_cashout_count_7d BIGINT;
    v_weekly_limit BIGINT;
    v_tier RECORD;
    v_cash_amount NUMERIC(12,2);
    v_fee_amount BIGINT := 0;
    v_fee_pct NUMERIC(5,2) := 0;
    v_net_amount NUMERIC(12,2);
    v_payout_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_base_coins BIGINT;
    v_pool_id UUID;
    v_admin_id UUID;
BEGIN
    SELECT * INTO v_user
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found');
    END IF;

    -- Determine fee based on provider
    -- Venmo/CashApp: 5% of coins redeemed (200 coins = $1 ratio)
    -- PayPal: $0.25 equivalent = 50 coins (at 200:1 cashout ratio)
    -- Others (ACH, check): $0
    v_fee_amount := CASE
        WHEN LOWER(p_provider_type) IN ('venmo', 'cash_app') THEN ROUND(p_coins_to_redeem * 0.05)
        WHEN LOWER(p_provider_type) = 'paypal' THEN 50
        ELSE 0
    END;

    v_fee_pct := CASE
        WHEN LOWER(p_provider_type) IN ('venmo', 'cash_app') THEN 5.0
        WHEN LOWER(p_provider_type) = 'paypal' THEN ROUND(50::numeric * 100.0 / p_coins_to_redeem, 2)
        ELSE 0.0
    END;

    -- Total coins needed: tier coins + fee coins
    v_available_coins := COALESCE(v_user.troll_coins, 0);

    IF v_available_coins < (p_coins_to_redeem + v_fee_amount) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient coin balance for cashout (including fee).',
            'available_coins', v_available_coins,
            'requested', p_coins_to_redeem,
            'fee_coins', v_fee_amount,
            'total_required', p_coins_to_redeem + v_fee_amount
        );
    END IF;

    v_weekly_limit := CASE WHEN COALESCE(v_user.mai_pay_plus, false) THEN 20 ELSE 10 END;
    SELECT COUNT(*) INTO v_cashout_count_7d
    FROM public.payout_requests
    WHERE user_id = p_user_id
      AND status IN ('approved', 'paid', 'completed')
      AND created_at > v_now - INTERVAL '7 days';

    IF v_cashout_count_7d >= v_weekly_limit THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'You have reached the weekly cashout limit. Please try again later.',
            'code', 'weekly_limit_reached',
            'count', v_cashout_count_7d,
            'limit', v_weekly_limit
        );
    END IF;

    IF COALESCE(v_user.mai_pay_plus, false) THEN
        IF p_coins_to_redeem <= 0 OR (p_coins_to_redeem % 2) <> 0 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Invalid Mai Pay Plus cashout amount. Plus tiers require double the standard coin amount.',
                'code', 'invalid_plus_amount'
            );
        END IF;

        v_base_coins := p_coins_to_redeem / 2;

        SELECT * INTO v_tier
        FROM public.cashout_tiers
        WHERE coin_amount = v_base_coins
          AND is_active = TRUE
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('Invalid Mai Pay Plus cashout amount. %s coins does not match any active tier (base: %s).', p_coins_to_redeem, v_base_coins),
                'code', 'tier_not_found'
            );
        END IF;
    ELSE
        SELECT * INTO v_tier
        FROM public.cashout_tiers
        WHERE coin_amount <= p_coins_to_redeem
          AND is_active = TRUE
        ORDER BY coin_amount DESC
        LIMIT 1;

        IF NOT FOUND THEN
            SELECT * INTO v_tier
            FROM public.cashout_tiers
            WHERE is_active = TRUE
            ORDER BY coin_amount ASC
            LIMIT 1;

            IF NOT FOUND THEN
                RETURN jsonb_build_object('success', false, 'error', 'No active cashout tiers configured.');
            END IF;
        END IF;
    END IF;

    v_cash_amount := v_tier.cash_amount;
    v_net_amount := v_cash_amount;

    -- Deduct coins + fee from troll_coins
    UPDATE public.user_profiles
    SET troll_coins = GREATEST(0, COALESCE(troll_coins, 0) - p_coins_to_redeem - v_fee_amount),
        updated_at = v_now
    WHERE id = p_user_id;

    -- NEW: Credit the cashout fee into admin_pool.trollcoins_balance
    IF v_fee_amount > 0 THEN
      SELECT id INTO v_admin_id
      FROM public.user_profiles
      WHERE role IN ('admin', 'ceo', 'superadmin')
      LIMIT 1;

      IF v_admin_id IS NOT NULL THEN
        SELECT id INTO v_pool_id
        FROM public.admin_pool
        LIMIT 1;

        IF v_pool_id IS NULL THEN
          INSERT INTO public.admin_pool (user_id, trollcoins_balance, updated_at)
          VALUES (v_admin_id, v_fee_amount, v_now)
          RETURNING id INTO v_pool_id;
        ELSE
          UPDATE public.admin_pool
          SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_fee_amount,
              updated_at = v_now
          WHERE id = v_pool_id;
        END IF;

        INSERT INTO public.admin_pool_ledger (
          amount, reason, ref_user_id, created_at
        ) VALUES (
          v_fee_amount,
          'Cashout Provider Fee (' || LOWER(p_provider_type) || ')',
          v_admin_id,
          v_now
        );
      END IF;
    END IF;

    -- Create payout request with fee_coins
    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        net_amount,
        fee_coins,
        status,
        provider_type,
        provider_username,
        user_tag,
        id_verification_url,
        id_verification_uploaded_at,
        created_at,
        updated_at
    ) VALUES (
        p_user_id,
        p_coins_to_redeem,
        v_cash_amount,
        v_net_amount,
        v_fee_amount,
        'pending',
        p_provider_type,
        p_provider_username,
        p_user_tag,
        p_id_verification_url,
        CASE WHEN p_id_verification_url IS NOT NULL THEN v_now ELSE NULL END,
        v_now,
        v_now
    ) RETURNING id INTO v_payout_id;

    -- Log coin transaction for the deduction (coins + fee)
    INSERT INTO public.coin_transactions (
        user_id,
        amount,
        type,
        description,
        metadata,
        created_at
    ) VALUES (
        p_user_id,
        -(p_coins_to_redeem + v_fee_amount),
        'cashout',
        'Cashout request submitted - coins and fee deducted',
        jsonb_build_object(
            'payout_request_id', v_payout_id,
            'provider_type', p_provider_type,
            'provider_username', p_provider_username,
            'user_tag', p_user_tag,
            'cash_amount', v_cash_amount,
            'fee_coins', v_fee_amount,
            'fee_percentage', v_fee_pct
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'payout_id', v_payout_id,
        'coins_reserved', p_coins_to_redeem,
        'fee_coins', v_fee_amount,
        'fee_percentage', v_fee_pct,
        'total_coins_charged', p_coins_to_redeem + v_fee_amount,
        'usd_amount', v_cash_amount,
        'status', 'pending'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMIT;

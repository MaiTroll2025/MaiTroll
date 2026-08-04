-- Car and Property Insurance RPCs
-- This migration adds simple policy tables and RPC helpers used by the
-- CarDealershipPage and GeneralStorePage UIs.

-- 1. Car insurance policies table
CREATE TABLE IF NOT EXISTS public.car_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  car_garage_id UUID NOT NULL,
  plan_id UUID,
  price_paid_coins BIGINT NOT NULL,
  duration_days INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.car_insurance_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own car insurance"
    ON public.car_insurance_policies
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own car insurance"
    ON public.car_insurance_policies
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own car insurance"
    ON public.car_insurance_policies
    FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE ON public.car_insurance_policies TO authenticated;

-- 2. Property insurance policies table
CREATE TABLE IF NOT EXISTS public.property_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  property_id UUID NOT NULL,
  plan_id UUID,
  price_paid_coins BIGINT NOT NULL,
  duration_days INTEGER NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.property_insurance_policies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own property insurance"
    ON public.property_insurance_policies
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own property insurance"
    ON public.property_insurance_policies
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own property insurance"
    ON public.property_insurance_policies
    FOR UPDATE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT SELECT, INSERT, UPDATE ON public.property_insurance_policies TO authenticated;

-- 3. Helper: internal upsert for car insurance
DROP FUNCTION IF EXISTS public._apply_car_insurance(UUID, UUID, UUID, BIGINT, INTEGER);
CREATE OR REPLACE FUNCTION public._apply_car_insurance(
  p_user_id UUID,
  p_car_garage_id UUID,
  p_plan_id UUID,
  p_price BIGINT,
  p_duration_days INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;

  UPDATE public.car_insurance_policies
  SET is_active = false,
      expires_at = LEAST(expires_at, NOW())
  WHERE user_id = p_user_id
    AND car_garage_id = p_car_garage_id
    AND is_active = true;

  INSERT INTO public.car_insurance_policies (
    user_id,
    car_garage_id,
    plan_id,
    price_paid_coins,
    duration_days,
    starts_at,
    expires_at,
    is_active
  ) VALUES (
    p_user_id,
    p_car_garage_id,
    p_plan_id,
    p_price,
    p_duration_days,
    NOW(),
    v_expires_at,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._apply_car_insurance(UUID, UUID, UUID, BIGINT, INTEGER) TO authenticated;

-- 4. Helper: internal upsert for property insurance
DROP FUNCTION IF EXISTS public._apply_property_insurance(UUID, UUID, UUID, BIGINT, INTEGER);
CREATE OR REPLACE FUNCTION public._apply_property_insurance(
  p_user_id UUID,
  p_property_id UUID,
  p_plan_id UUID,
  p_price BIGINT,
  p_duration_days INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_expires_at TIMESTAMPTZ;
BEGIN
  v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;

  UPDATE public.property_insurance_policies
  SET is_active = false,
      expires_at = LEAST(expires_at, NOW())
  WHERE user_id = p_user_id
    AND property_id = p_property_id
    AND is_active = true;

  INSERT INTO public.property_insurance_policies (
    user_id,
    property_id,
    plan_id,
    price_paid_coins,
    duration_days,
    starts_at,
    expires_at,
    is_active
  ) VALUES (
    p_user_id,
    p_property_id,
    p_plan_id,
    p_price,
    p_duration_days,
    NOW(),
    v_expires_at,
    true
  );

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public._apply_property_insurance(UUID, UUID, UUID, BIGINT, INTEGER) TO authenticated;

-- 5. Public RPC: buy_car_insurance
DROP FUNCTION IF EXISTS public.buy_car_insurance(UUID, UUID);
CREATE OR REPLACE FUNCTION public.buy_car_insurance(
  car_garage_id UUID,
  plan_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION WHEN undefined_table THEN
    v_price := 2000;
    v_duration_days := 7;
  END;

  IF v_price IS NULL OR v_duration_days IS NULL THEN
    v_price := 2000;
    v_duration_days := 7;
  END IF;

  PERFORM public.deduct_coins(v_user_id, v_price, 'paid');

  RETURN public._apply_car_insurance(
    v_user_id,
    car_garage_id,
    plan_id,
    v_price,
    v_duration_days
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_car_insurance(UUID, UUID) TO authenticated;

-- 6. Public RPC: buy_property_insurance
DROP FUNCTION IF EXISTS public.buy_property_insurance(UUID, UUID);
CREATE OR REPLACE FUNCTION public.buy_property_insurance(
  house_id UUID,
  plan_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION WHEN undefined_table THEN
    v_price := 2000;
    v_duration_days := 7;
  END;

  IF v_price IS NULL OR v_duration_days IS NULL THEN
    v_price := 2000;
    v_duration_days := 7;
  END IF;

  PERFORM public.deduct_coins(v_user_id, v_price, 'paid');

  RETURN public._apply_property_insurance(
    v_user_id,
    house_id,
    plan_id,
    v_price,
    v_duration_days
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'message', SQLERRM
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_property_insurance(UUID, UUID) TO authenticated;


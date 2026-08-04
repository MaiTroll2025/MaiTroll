-- Fix 22P02: Change user_insurances.insurance_id and policy plan_ids to TEXT to support string IDs
DO $$ 
BEGIN
  -- 1. Fix user_insurances table
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_insurances') THEN
    -- First drop any existing FK that might depend on it being UUID
    ALTER TABLE public.user_insurances DROP CONSTRAINT IF EXISTS user_insurances_insurance_id_fkey;
    
    -- Change column type to TEXT
    ALTER TABLE public.user_insurances ALTER COLUMN insurance_id TYPE TEXT;
    
    -- Re-add FK to insurance_options (which uses TEXT ids)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance_options') THEN
      ALTER TABLE public.user_insurances 
        ADD CONSTRAINT user_insurances_insurance_id_fkey 
        FOREIGN KEY (insurance_id) REFERENCES public.insurance_options(id);
    END IF;
  END IF;

  -- 2. Fix car_insurance_policies table (plan_id needs to be TEXT)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'car_insurance_policies') THEN
    ALTER TABLE public.car_insurance_policies ALTER COLUMN plan_id TYPE TEXT;
  END IF;

  -- 3. Fix property_insurance_policies table (plan_id needs to be TEXT)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'property_insurance_policies') THEN
    ALTER TABLE public.property_insurance_policies ALTER COLUMN plan_id TYPE TEXT;
  END IF;

  -- 4. Fix PGRST200: Add missing relationship between user_inventory and marketplace_items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_inventory') THEN
    -- Check if FK exists, if not add it
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'user_inventory_item_id_fkey' 
      AND table_name = 'user_inventory'
    ) THEN
      ALTER TABLE public.user_inventory
        ADD CONSTRAINT user_inventory_item_id_fkey
        FOREIGN KEY (item_id) REFERENCES public.marketplace_items(id);
    END IF;
  END IF;

END $$;

-- 5. Verify and fix buy_car_insurance RPC
DROP FUNCTION IF EXISTS public.buy_car_insurance(UUID, UUID);

CREATE OR REPLACE FUNCTION public.buy_car_insurance(
  car_garage_id UUID,
  plan_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_user_id UUID;
  v_price BIGINT;
  v_duration_days INTEGER;
  v_car_count INTEGER;
  v_total_price BIGINT;
  v_expires_at TIMESTAMPTZ;
  car_row RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
  END IF;

  -- Get plan details
  BEGIN
    SELECT price_paid_coins, duration_days
    INTO v_price, v_duration_days
    FROM public.insurance_plans
    WHERE id = plan_id;
  EXCEPTION 
    WHEN undefined_table OR invalid_text_representation THEN
       v_price := NULL;
    WHEN OTHERS THEN
       v_price := NULL;
  END;

  IF v_price IS NULL THEN
    -- Fallback or check insurance_options
    BEGIN
        SELECT cost, duration_hours/24 
        INTO v_price, v_duration_days
        FROM public.insurance_options
        WHERE id = plan_id;
    EXCEPTION WHEN OTHERS THEN
        v_price := 2000;
        v_duration_days := 7;
    END;
  END IF;

  IF v_price IS NULL THEN
    v_price := 2000;
    v_duration_days := 7;
  END IF;

  -- Count owned cars
  SELECT COUNT(*) INTO v_car_count
  FROM public.user_cars
  WHERE user_id = v_user_id;

  IF v_car_count = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'You do not own any cars');
  END IF;

  v_total_price := v_price * v_car_count;

  PERFORM public.deduct_coins(v_user_id, v_total_price, 'paid');

  v_expires_at := NOW() + (v_duration_days || ' days')::INTERVAL;

  -- Apply to all cars
  FOR car_row IN SELECT id FROM public.user_cars WHERE user_id = v_user_id LOOP
    UPDATE public.car_insurance_policies
    SET is_active = false, expires_at = LEAST(expires_at, NOW())
    WHERE user_id = v_user_id AND car_garage_id = car_row.id AND is_active = true;

    INSERT INTO public.car_insurance_policies (
      user_id, car_garage_id, plan_id, price_paid_coins, duration_days, starts_at, expires_at, is_active
    ) VALUES (
      v_user_id, car_row.id, plan_id, v_price, v_duration_days, NOW(), v_expires_at, true
    );

    UPDATE public.user_cars SET insurance_expiry = v_expires_at WHERE id = car_row.id;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expires_at,
    'cars_covered', v_car_count,
    'total_price', v_total_price
  );
END;
$$;

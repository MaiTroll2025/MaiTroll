-- Add pet health promo code system
-- Keeps pet at 100% health for 24 hours

BEGIN;

-- Create table to track pet health promo redemptions
CREATE TABLE IF NOT EXISTS public.pet_health_promo_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code TEXT NOT NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_health_promo_redemptions_user ON public.pet_health_promo_redemptions (user_id);
CREATE INDEX IF NOT EXISTS idx_pet_health_promo_redemptions_expires ON public.pet_health_promo_redemptions (expires_at);

ALTER TABLE public.pet_health_promo_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pet health promo redemptions" ON public.pet_health_promo_redemptions;
CREATE POLICY "Users can read own pet health promo redemptions"
  ON public.pet_health_promo_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can insert pet health promo redemptions" ON public.pet_health_promo_redemptions;
CREATE POLICY "Service role can insert pet health promo redemptions"
  ON public.pet_health_promo_redemptions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Function to apply pet health promo code effect
CREATE OR REPLACE FUNCTION public.apply_pet_health_promo(
  p_user_id UUID,
  p_promo_code TEXT,
  p_duration_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet public.pets%ROWTYPE;
  v_expires_at TIMESTAMPTZ := NOW() + (p_duration_hours || ' hours')::INTERVAL;
  v_redemption_id UUID;
BEGIN
  -- Validate promo code
  IF p_promo_code <> 'ceopet1' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid promo code'
    );
  END IF;

  -- Get user's active primary pet
  SELECT * INTO v_pet
  FROM public.pets
  WHERE owner_id = p_user_id
    AND is_primary = true
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No active primary pet found'
    );
  END IF;

  -- Check if user already has an active pet health promo
  IF EXISTS (
    SELECT 1 FROM public.pet_health_promo_redemptions
    WHERE user_id = p_user_id
      AND expires_at > NOW()
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You already have an active pet health promo'
    );
  END IF;

  -- Apply instant health boost to 100% for all health types
  UPDATE public.pets
  SET
    care_status = 100,
    hunger_status = 100,
    walk_status = 100,
    attention_status = 100,
    needs = jsonb_build_object(
      'hunger', false,
      'walk', false,
      'care', false
    ),
    next_hunger_decay_at = v_expires_at,
    next_walk_decay_at = v_expires_at,
    next_attention_decay_at = v_expires_at,
    updated_at = NOW()
  WHERE id = v_pet.id;

  -- Record the redemption
  INSERT INTO public.pet_health_promo_redemptions (user_id, promo_code, pet_id, expires_at)
  VALUES (p_user_id, p_promo_code, v_pet.id, v_expires_at)
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Pet health set to 100% for 24 hours',
    'pet_id', v_pet.id,
    'pet_name', v_pet.name,
    'expires_at', v_expires_at,
    'redemption_id', v_redemption_id
  );
END;
$$;

-- Function to maintain pet health at 100% during promo period (called by cron)
CREATE OR REPLACE FUNCTION public.maintain_pet_health_promos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_redemption public.pet_health_promo_redemptions%ROWTYPE;
  v_processed INTEGER := 0;
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtext('maintain_pet_health_promos')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already_running');
  END IF;

  FOR v_redemption IN
    SELECT *
    FROM public.pet_health_promo_redemptions
    WHERE expires_at > NOW()
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.pets
    SET
      care_status = 100,
      hunger_status = 100,
      walk_status = 100,
      attention_status = 100,
      needs = jsonb_build_object(
        'hunger', false,
        'walk', false,
        'care', false
      ),
      updated_at = NOW()
    WHERE id = v_redemption.pet_id
      AND is_active = true;

    v_processed := v_processed + 1;
  END LOOP;

  -- Clean up expired redemptions
  DELETE FROM public.pet_health_promo_redemptions
  WHERE expires_at <= NOW();

  RETURN jsonb_build_object(
    'processed', v_processed,
    'cleaned_expired', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_pet_health_promo(UUID, TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_pet_health_promo(UUID, TEXT, INTEGER) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.maintain_pet_health_promos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maintain_pet_health_promos() TO service_role;

-- Schedule the maintenance function to run every minute
DO $schedule$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE 'SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = $1'
      USING 'maintain-pet-health-promos';
    EXECUTE 'SELECT cron.schedule($1, $2, $3)'
      USING 'maintain-pet-health-promos', '* * * * *',
            'SELECT public.maintain_pet_health_promos()';
  ELSE
    RAISE NOTICE 'pg_cron is unavailable; schedule public.maintain_pet_health_promos() once per minute.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule maintain_pet_health_promos; schedule once per minute: %', SQLERRM;
END;
$schedule$;

-- Add purchasable item for the pet health promo code in coin store
INSERT INTO public.purchasable_items (item_key, display_name, category, coin_price, is_active, metadata)
SELECT 'pet_health_promo_ceopet1', 'Unlimited Pet Health (24h)', 'gift', 0, true,
  jsonb_build_object(
    'promo_code', 'ceopet1',
    'description', 'Redeem code ceopet1 to keep your pet at 100% health for 24 hours',
    'type', 'promo_code',
    'duration_hours', 24
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchasable_items WHERE item_key = 'pet_health_promo_ceopet1'
);

COMMIT;
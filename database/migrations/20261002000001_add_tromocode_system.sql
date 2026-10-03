CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.tromocodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  normalized_code text NOT NULL UNIQUE,
  description text,
  promotion_type text NOT NULL CHECK (promotion_type IN (
    'percentage_discount',
    'fixed_coin_discount',
    'free_item',
    'bonus_coins',
    'free_duration'
  )),
  promotion_value numeric NOT NULL CHECK (promotion_value >= 0),
  applies_to text NOT NULL CHECK (applies_to IN (
    'verified_badge',
    'profile_frame',
    'insurance_plan',
    'perk',
    'all_eligible'
  ) AND applies_to <> 'coin_pack'),
  max_uses integer NULL CHECK (max_uses IS NULL OR max_uses >= 1),
  usage_count integer NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  starts_at timestamptz NOT NULL,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tromocode_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tromocode_id uuid NOT NULL REFERENCES public.tromocodes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  product_type text NOT NULL CHECK (product_type IN (
    'verified_badge',
    'profile_frame',
    'insurance_plan',
    'perk',
    'all_eligible',
    'coin_pack'
  )),
  product_id uuid,
  original_amount integer NOT NULL DEFAULT 0,
  discount_amount integer NOT NULL DEFAULT 0,
  final_amount integer NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tromocode_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tromocodes_normalized_code ON public.tromocodes (normalized_code);
CREATE INDEX IF NOT EXISTS idx_tromocodes_active_start_expire ON public.tromocodes (is_active, starts_at, expires_at);
CREATE INDEX IF NOT EXISTS idx_tromocodes_applies_to ON public.tromocodes (applies_to);
CREATE INDEX IF NOT EXISTS idx_tromocode_redemptions_tromocode_id ON public.tromocode_redemptions (tromocode_id);
CREATE INDEX IF NOT EXISTS idx_tromocode_redemptions_user_id ON public.tromocode_redemptions (user_id);

ALTER TABLE public.tromocodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tromocode_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own redemptions" ON public.tromocode_redemptions;
DROP POLICY IF EXISTS "Users can insert their own redemptions via secure backend" ON public.tromocode_redemptions;
DROP POLICY IF EXISTS "Admins can read tromocodes" ON public.tromocodes;
DROP POLICY IF EXISTS "Admins can insert tromocodes" ON public.tromocodes;
DROP POLICY IF EXISTS "Admins can update tromocodes" ON public.tromocodes;
DROP POLICY IF EXISTS "Admins can delete tromocodes" ON public.tromocodes;
DROP POLICY IF EXISTS "Admins can read tromocode redemptions" ON public.tromocode_redemptions;
DROP POLICY IF EXISTS "Admins can manage tromocode redemptions" ON public.tromocode_redemptions;

CREATE OR REPLACE FUNCTION public.is_tromocode_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role IN ('admin', 'secretary', 'ceo', 'superadmin')
        OR up.is_admin = true
      )
  );
$$;

CREATE POLICY "Users can read their own redemptions" ON public.tromocode_redemptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own redemptions via secure backend" ON public.tromocode_redemptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read tromocodes" ON public.tromocodes
  FOR SELECT
  USING (public.is_tromocode_admin_user());

CREATE POLICY "Admins can insert tromocodes" ON public.tromocodes
  FOR INSERT
  WITH CHECK (public.is_tromocode_admin_user());

CREATE POLICY "Admins can update tromocodes" ON public.tromocodes
  FOR UPDATE
  USING (public.is_tromocode_admin_user())
  WITH CHECK (public.is_tromocode_admin_user());

CREATE POLICY "Admins can delete tromocodes" ON public.tromocodes
  FOR DELETE
  USING (public.is_tromocode_admin_user());

CREATE POLICY "Admins can read tromocode redemptions" ON public.tromocode_redemptions
  FOR SELECT
  USING (auth.uid() = user_id OR public.is_tromocode_admin_user());

CREATE POLICY "Admins can manage tromocode redemptions" ON public.tromocode_redemptions
  FOR ALL
  USING (auth.uid() = user_id OR public.is_tromocode_admin_user())
  WITH CHECK (auth.uid() = user_id OR public.is_tromocode_admin_user());

CREATE OR REPLACE FUNCTION public.normalize_tromocode_input(raw_code text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(regexp_replace(trim(COALESCE(raw_code, '')), '\s+', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.set_tromocode_normalized_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.normalized_code := public.normalize_tromocode_input(NEW.code);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tromocodes_set_normalized_code ON public.tromocodes;

CREATE TRIGGER trg_tromocodes_set_normalized_code
BEFORE INSERT OR UPDATE OF code, updated_at
ON public.tromocodes
FOR EACH ROW
EXECUTE FUNCTION public.set_tromocode_normalized_columns();

CREATE OR REPLACE FUNCTION public.validate_tromocode(
  p_code text,
  p_product_type text,
  p_original_amount integer,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text := public.normalize_tromocode_input(p_code);
  v_code record;
  v_existing_redemption boolean;
  v_discount integer;
BEGIN
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Invalid TromoCode.');
  END IF;

  IF p_product_type = 'coin_pack' THEN
    RETURN jsonb_build_object('valid', false, 'message', 'TromoCodes cannot be used for Coin Packs.');
  END IF;

  SELECT * INTO v_code
  FROM public.tromocodes
  WHERE normalized_code = v_normalized
  FOR UPDATE;

  IF v_code.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'message', 'Invalid TromoCode.');
  END IF;

  IF v_code.is_active IS FALSE THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This TromoCode is not active.');
  END IF;

  IF v_code.starts_at IS NOT NULL AND NOW() < (v_code.starts_at - interval '1 minute') THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This TromoCode is not available yet.');
  END IF;

  IF v_code.expires_at IS NOT NULL AND NOW() >= v_code.expires_at THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This TromoCode has expired.');
  END IF;

  IF v_code.max_uses IS NOT NULL AND v_code.usage_count >= v_code.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This TromoCode has reached its usage limit.');
  END IF;

  IF NOT (v_code.applies_to = 'all_eligible' OR v_code.applies_to = p_product_type) THEN
    RETURN jsonb_build_object('valid', false, 'message', 'This TromoCode is not valid for this purchase.');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.tromocode_redemptions
    WHERE tromocode_id = v_code.id AND user_id = p_user_id
  ) INTO v_existing_redemption;

  IF v_existing_redemption THEN
    RETURN jsonb_build_object('valid', false, 'message', 'You have already used this TromoCode.');
  END IF;

  IF v_code.promotion_type = 'percentage_discount' THEN
    v_discount := LEAST(p_original_amount, ROUND(p_original_amount * (v_code.promotion_value / 100.0)::numeric));
  ELSIF v_code.promotion_type = 'fixed_coin_discount' THEN
    v_discount := LEAST(p_original_amount, COALESCE(v_code.promotion_value::integer, 0));
  ELSE
    v_discount := 0;
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_code.code,
    'promotion_type', v_code.promotion_type,
    'promotion_value', v_code.promotion_value,
    'original_amount', p_original_amount,
    'discount_amount', v_discount,
    'final_amount', GREATEST(0, p_original_amount - v_discount),
    'message', 'TromoCode applied.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_tromocode(
  p_code text,
  p_product_type text,
  p_original_amount integer,
  p_user_id uuid DEFAULT auth.uid(),
  p_product_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validation jsonb;
  v_tromocode_id uuid;
BEGIN
  v_validation := public.validate_tromocode(p_code, p_product_type, p_original_amount, p_user_id);

  IF (v_validation->>'valid')::boolean = false THEN
    RETURN v_validation;
  END IF;

  SELECT id INTO v_tromocode_id
  FROM public.tromocodes
  WHERE normalized_code = public.normalize_tromocode_input(p_code)
  FOR UPDATE;

  INSERT INTO public.tromocode_redemptions (
    tromocode_id,
    user_id,
    product_type,
    product_id,
    original_amount,
    discount_amount,
    final_amount
  ) VALUES (
    v_tromocode_id,
    p_user_id,
    p_product_type,
    p_product_id,
    (v_validation->>'original_amount')::integer,
    (v_validation->>'discount_amount')::integer,
    (v_validation->>'final_amount')::integer
  );

  UPDATE public.tromocodes
  SET usage_count = usage_count + 1,
      updated_at = now()
  WHERE id = v_tromocode_id;

  RETURN jsonb_build_object(
    'valid', true,
    'code', v_validation->>'code',
    'promotion_type', v_validation->>'promotion_type',
    'promotion_value', v_validation->>'promotion_value',
    'original_amount', v_validation->>'original_amount',
    'discount_amount', v_validation->>'discount_amount',
    'final_amount', v_validation->>'final_amount',
    'message', 'TromoCode redeemed.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_tromocode(
  p_code text,
  p_description text,
  p_promotion_type text,
  p_promotion_value numeric,
  p_applies_to text,
  p_max_uses integer,
  p_starts_at timestamptz,
  p_expires_at timestamptz,
  p_is_active boolean DEFAULT true,
  p_created_by uuid DEFAULT auth.uid()
)
RETURNS public.tromocodes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.tromocodes;
BEGIN
  INSERT INTO public.tromocodes (
    code,
    description,
    promotion_type,
    promotion_value,
    applies_to,
    max_uses,
    starts_at,
    expires_at,
    is_active,
    created_by
  ) VALUES (
    p_code,
    p_description,
    p_promotion_type,
    p_promotion_value,
    p_applies_to,
    p_max_uses,
    COALESCE(p_starts_at, now()),
    p_expires_at,
    p_is_active,
    p_created_by
  )
  RETURNING * INTO v_code;

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_tromocode_stats()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'active_codes', COALESCE((SELECT count(*) FROM public.tromocodes WHERE is_active = true), 0),
    'total_redemptions', COALESCE((SELECT count(*) FROM public.tromocode_redemptions), 0),
    'expired_codes', COALESCE((SELECT count(*) FROM public.tromocodes WHERE expires_at IS NOT NULL AND expires_at < now()), 0),
    'inactive_codes', COALESCE((SELECT count(*) FROM public.tromocodes WHERE is_active = false), 0)
  );
$$;

CREATE OR REPLACE FUNCTION public.get_admin_tromocode_redemptions(p_tromocode_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  tromocode_id uuid,
  user_id uuid,
  product_type text,
  product_id uuid,
  original_amount integer,
  discount_amount integer,
  final_amount integer,
  redeemed_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.tromocode_id,
    r.user_id,
    r.product_type,
    r.product_id,
    r.original_amount,
    r.discount_amount,
    r.final_amount,
    r.redeemed_at
  FROM public.tromocode_redemptions r
  WHERE p_tromocode_id IS NULL OR r.tromocode_id = p_tromocode_id
  ORDER BY r.redeemed_at DESC;
$$;

REVOKE ALL ON public.tromocodes FROM public;
REVOKE ALL ON public.tromocode_redemptions FROM public;
REVOKE ALL ON FUNCTION public.is_tromocode_admin_user() FROM public;
REVOKE ALL ON FUNCTION public.validate_tromocode(text, text, integer, uuid) FROM public;
REVOKE ALL ON FUNCTION public.redeem_tromocode(text, text, integer, uuid, uuid) FROM public;
REVOKE ALL ON FUNCTION public.create_tromocode(text, text, text, numeric, text, integer, timestamptz, timestamptz, boolean, uuid) FROM public;
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_tromocode_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_tromocode_input(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_tromocode(text, text, integer, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.redeem_tromocode(text, text, integer, uuid, uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_tromocode(text, text, text, numeric, text, integer, timestamptz, timestamptz, boolean, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_tromocode_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_tromocode_redemptions(uuid) TO authenticated;

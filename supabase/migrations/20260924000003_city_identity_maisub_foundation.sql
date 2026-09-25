-- City identity and MaiSub foundation.
-- These records sit on top of the existing profile, XP, wallet, and cashout systems.

CREATE TABLE IF NOT EXISTS public.city_identities (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  street_name TEXT NOT NULL CHECK (char_length(trim(street_name)) BETWEEN 2 AND 80),
  zip_code TEXT NOT NULL CHECK (zip_code ~ '^[0-9]{5}(-[0-9]{4})?$'),
  neighborhood_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_city_identities_zip_code
  ON public.city_identities (zip_code);

ALTER TABLE public.city_identities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Residents can read city identities" ON public.city_identities;
DROP POLICY IF EXISTS "Residents can create own city identity" ON public.city_identities;
DROP POLICY IF EXISTS "Residents can update own city identity" ON public.city_identities;

CREATE POLICY "Residents can read city identities"
  ON public.city_identities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Residents can create own city identity"
  ON public.city_identities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Residents can update own city identity"
  ON public.city_identities FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_city_identity(
  p_street_name TEXT,
  p_zip_code TEXT,
  p_neighborhood_name TEXT DEFAULT NULL
)
RETURNS public.city_identities
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_identity public.city_identities;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.city_identities (user_id, street_name, zip_code, neighborhood_name)
  VALUES (auth.uid(), trim(p_street_name), trim(p_zip_code), NULLIF(trim(p_neighborhood_name), ''))
  ON CONFLICT (user_id) DO UPDATE SET
    street_name = EXCLUDED.street_name,
    zip_code = EXCLUDED.zip_code,
    neighborhood_name = EXCLUDED.neighborhood_name,
    updated_at = now()
  RETURNING * INTO v_identity;

  RETURN v_identity;
END;
$$;

REVOKE ALL ON FUNCTION public.set_city_identity(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_city_identity(TEXT, TEXT, TEXT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.access_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('broadcast_access', 'profile_access', 'mail_access')),
  enabled BOOLEAN NOT NULL DEFAULT false,
  price_coins BIGINT NOT NULL DEFAULT 0 CHECK (price_coins >= 0 AND price_coins <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, access_type)
);

ALTER TABLE public.access_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access products are publicly readable" ON public.access_products;
DROP POLICY IF EXISTS "Owners manage access products" ON public.access_products;

CREATE POLICY "Access products are publicly readable"
  ON public.access_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners manage access products"
  ON public.access_products FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.configure_access_product(
  p_access_type TEXT,
  p_enabled BOOLEAN,
  p_price_coins BIGINT
)
RETURNS public.access_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.access_products;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_access_type NOT IN ('broadcast_access', 'profile_access', 'mail_access') THEN
    RAISE EXCEPTION 'Unsupported access type';
  END IF;
  IF p_price_coins < 0 OR p_price_coins > 1000 THEN
    RAISE EXCEPTION 'Price must be between 0 and 1000 Troll Coins';
  END IF;

  INSERT INTO public.access_products (owner_id, access_type, enabled, price_coins)
  VALUES (auth.uid(), p_access_type, p_enabled, p_price_coins)
  ON CONFLICT (owner_id, access_type) DO UPDATE SET
    enabled = EXCLUDED.enabled,
    price_coins = EXCLUDED.price_coins,
    updated_at = now()
  RETURNING * INTO v_product;

  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_access_product(TEXT, BOOLEAN, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.configure_access_product(TEXT, BOOLEAN, BIGINT) TO authenticated;

CREATE TABLE IF NOT EXISTS public.access_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  access_type TEXT NOT NULL CHECK (access_type IN ('broadcast_access', 'profile_access', 'mail_access')),
  amount_coins BIGINT NOT NULL CHECK (amount_coins > 0 AND amount_coins <= 1000),
  wallet_transaction_id UUID,
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (buyer_id, recipient_id, access_type),
  UNIQUE (buyer_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_access_purchases_recipient
  ON public.access_purchases (recipient_id, created_at DESC);

ALTER TABLE public.access_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers and recipients can read access purchases"
  ON public.access_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id OR auth.uid() = recipient_id);

CREATE TABLE IF NOT EXISTS public.access_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL CHECK (access_type IN ('broadcast_access', 'profile_access', 'mail_access')),
  purchase_id UUID NOT NULL UNIQUE REFERENCES public.access_purchases(id) ON DELETE RESTRICT,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (viewer_id, recipient_id, access_type)
);

ALTER TABLE public.access_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read access entitlements"
  ON public.access_entitlements FOR SELECT
  TO authenticated
  USING (auth.uid() = viewer_id OR auth.uid() = recipient_id);

CREATE TABLE IF NOT EXISTS public.maisub_locked_funds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source_purchase_id UUID NOT NULL UNIQUE REFERENCES public.access_purchases(id) ON DELETE RESTRICT,
  amount_coins BIGINT NOT NULL CHECK (amount_coins > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'locked', 'released', 'cancelled')),
  release_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'locked' AND release_at IS NOT NULL) OR status <> 'locked')
);

ALTER TABLE public.maisub_locked_funds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read MaiSub locked funds"
  ON public.maisub_locked_funds FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

COMMENT ON TABLE public.access_purchases IS
  'Durable MaiSub purchase records. Financial settlement must occur through the canonical wallet RPC.';

COMMENT ON TABLE public.maisub_locked_funds IS
  'Auditable MaiSub savings state; locked funds are not available for cashout until released.';

CREATE OR REPLACE FUNCTION public.purchase_access(
  p_recipient_id UUID,
  p_access_type TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_id UUID := auth.uid();
  v_product public.access_products%ROWTYPE;
  v_purchase public.access_purchases%ROWTYPE;
  v_debit JSONB;
  v_credit JSON;
  v_amount BIGINT;
BEGIN
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_recipient_id IS NULL OR p_recipient_id = v_buyer_id THEN
    RAISE EXCEPTION 'Invalid access recipient';
  END IF;
  IF p_access_type NOT IN ('broadcast_access', 'profile_access', 'mail_access') THEN
    RAISE EXCEPTION 'Unsupported access type';
  END IF;
  IF p_idempotency_key IS NULL OR char_length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'A valid idempotency key is required';
  END IF;

  SELECT * INTO v_product
  FROM public.access_products
  WHERE owner_id = p_recipient_id
    AND access_type = p_access_type
  FOR UPDATE;

  IF NOT FOUND OR NOT v_product.enabled OR v_product.price_coins <= 0 THEN
    RAISE EXCEPTION 'This access product is not available';
  END IF;
  v_amount := v_product.price_coins;

  SELECT * INTO v_purchase
  FROM public.access_purchases
  WHERE buyer_id = v_buyer_id
    AND recipient_id = p_recipient_id
    AND access_type = p_access_type
  FOR UPDATE;

  IF FOUND AND v_purchase.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'purchase_id', v_purchase.id, 'already_granted', true);
  END IF;

  IF v_purchase.id IS NULL THEN
    INSERT INTO public.access_purchases (
      buyer_id, recipient_id, access_type, amount_coins, idempotency_key, status
    )
    VALUES (
      v_buyer_id, p_recipient_id, p_access_type, v_amount, trim(p_idempotency_key), 'pending'
    )
    RETURNING * INTO v_purchase;
  ELSIF v_purchase.idempotency_key <> trim(p_idempotency_key) THEN
    RAISE EXCEPTION 'Access purchase already exists';
  END IF;

  SELECT public.troll_bank_spend_coins_secure(
    v_buyer_id,
    v_amount,
    'paid',
    'access_purchase',
    v_purchase.id::text,
    jsonb_build_object('recipient_id', p_recipient_id, 'access_type', p_access_type)
  ) INTO v_debit;

  IF COALESCE((v_debit ->> 'success')::BOOLEAN, false) IS NOT TRUE THEN
    RAISE EXCEPTION '%', COALESCE(v_debit ->> 'error', 'Unable to debit Troll Coins');
  END IF;

  SELECT public.troll_bank_credit_coins(
    p_recipient_id,
    v_amount,
    'gifted',
    'access_purchase',
    v_purchase.id::text,
    jsonb_build_object('buyer_id', v_buyer_id, 'access_type', p_access_type)
  ) INTO v_credit;

  UPDATE public.access_purchases
  SET status = 'completed',
      wallet_transaction_id = NULLIF(v_debit ->> 'ledger_id', '')::UUID,
      completed_at = now()
  WHERE id = v_purchase.id;

  INSERT INTO public.access_entitlements (
    viewer_id, recipient_id, access_type, purchase_id
  )
  VALUES (v_buyer_id, p_recipient_id, p_access_type, v_purchase.id)
  ON CONFLICT (viewer_id, recipient_id, access_type) DO NOTHING;

  RETURN jsonb_build_object(
    'success', true,
    'purchase_id', v_purchase.id,
    'entitlement_granted', true,
    'amount_coins', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_access(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purchase_access(UUID, TEXT, TEXT) TO authenticated;
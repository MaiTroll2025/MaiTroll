BEGIN;

ALTER TABLE public.maipiks_stories
  ADD COLUMN IF NOT EXISTS monetization_mode TEXT NOT NULL DEFAULT 'free'
    CHECK (monetization_mode IN ('free', 'paid', 'subscribers_only', 'free_for_subscribers')),
  ADD COLUMN IF NOT EXISTS base_price_coins BIGINT NOT NULL DEFAULT 0
    CHECK (base_price_coins >= 0),
  ADD COLUMN IF NOT EXISTS subscriber_discount_mode TEXT NOT NULL DEFAULT 'platform'
    CHECK (subscriber_discount_mode IN ('platform', 'none')),
  ADD COLUMN IF NOT EXISTS paid_access_duration TEXT NOT NULL DEFAULT 'until_story_expiry'
    CHECK (paid_access_duration IN ('until_story_expiry', '1h', '6h', '24h', '7d', 'permanent'));

ALTER TABLE public.subscription_tiers
  ADD COLUMN IF NOT EXISTS maipiks_discount_percent INTEGER NOT NULL DEFAULT 0
    CHECK (maipiks_discount_percent BETWEEN 0 AND 100);

CREATE OR REPLACE FUNCTION public.admin_set_subscription_maipiks_discount(
  p_tier_id UUID,
  p_discount_percent INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin_user(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_discount_percent IS NULL OR p_discount_percent < 0 OR p_discount_percent > 100 THEN
    RAISE EXCEPTION 'Discount must be between 0 and 100 percent';
  END IF;

  UPDATE public.subscription_tiers
  SET maipiks_discount_percent = p_discount_percent,
      updated_at = NOW()
  WHERE id = p_tier_id
  RETURNING id INTO v_updated;

  IF v_updated IS NULL THEN
    RAISE EXCEPTION 'Subscription tier not found';
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'tier_id', v_updated, 'discount_percent', p_discount_percent);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_subscription_maipiks_discount(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_maipiks_discount(UUID, INTEGER) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.maipiks_story_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID REFERENCES public.maipiks_stories(id) ON DELETE SET NULL,
  story_item_id UUID REFERENCES public.maipiks_story_items(id) ON DELETE SET NULL,
  purchaser_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  creator_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  access_expires_at TIMESTAMPTZ,
  base_price_coins BIGINT NOT NULL CHECK (base_price_coins >= 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  discount_coins BIGINT NOT NULL DEFAULT 0 CHECK (discount_coins >= 0),
  final_price_coins BIGINT NOT NULL CHECK (final_price_coins >= 0),
  creator_earnings_coins BIGINT NOT NULL DEFAULT 0 CHECK (creator_earnings_coins >= 0),
  platform_fee_coins BIGINT NOT NULL DEFAULT 0 CHECK (platform_fee_coins >= 0),
  subscription_tier_id UUID REFERENCES public.subscription_tiers(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.user_subscriptions(id) ON DELETE SET NULL,
  spend_transaction_id UUID,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_maipiks_story_purchases_viewer
  ON public.maipiks_story_purchases(purchaser_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_purchases_creator
  ON public.maipiks_story_purchases(creator_id, purchased_at DESC);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_purchases_access
  ON public.maipiks_story_purchases(purchaser_id, story_id, access_expires_at)
  WHERE status = 'completed';

ALTER TABLE public.maipiks_story_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maipiks_story_purchases_read_participants" ON public.maipiks_story_purchases;
CREATE POLICY "maipiks_story_purchases_read_participants"
  ON public.maipiks_story_purchases
  FOR SELECT USING (auth.uid() = purchaser_id OR auth.uid() = creator_id);

GRANT SELECT ON public.maipiks_story_purchases TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_story_pricing(p_story_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_story public.maipiks_stories%ROWTYPE;
  v_subscription_id UUID;
  v_tier_id UUID;
  v_tier_discount INTEGER := 0;
  v_is_subscriber BOOLEAN := FALSE;
  v_has_purchase BOOLEAN := FALSE;
  v_base_price BIGINT := 0;
  v_discount_percent INTEGER := 0;
  v_discount_coins BIGINT := 0;
  v_final_price BIGINT := 0;
  v_access BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_story
  FROM public.maipiks_stories
  WHERE id = p_story_id
    AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('available', FALSE, 'has_access', FALSE);
  END IF;

  IF v_viewer IS NOT NULL AND v_viewer <> v_story.user_id AND EXISTS (
    SELECT 1 FROM public.user_blocks b
    WHERE (b.blocker_id = v_viewer AND b.blocked_id = v_story.user_id)
       OR (b.blocker_id = v_story.user_id AND b.blocked_id = v_viewer)
  ) THEN
    RETURN jsonb_build_object('available', FALSE, 'has_access', FALSE);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.maipiks_story_purchases p
    WHERE p.story_id = v_story.id
      AND p.purchaser_id = v_viewer
      AND p.status = 'completed'
      AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
  ) INTO v_has_purchase;

  IF v_story.expires_at <= NOW() AND NOT v_has_purchase THEN
    RETURN jsonb_build_object('available', FALSE, 'has_access', FALSE);
  END IF;

  IF v_viewer IS NOT NULL AND v_viewer <> v_story.user_id THEN
    SELECT us.id, us.tier_id, COALESCE(st.maipiks_discount_percent, 0)
    INTO v_subscription_id, v_tier_id, v_tier_discount
    FROM public.user_subscriptions us
    JOIN public.subscription_tiers st ON st.id = us.tier_id
    WHERE us.subscriber_id = v_viewer
      AND us.broadcaster_id = v_story.user_id
      AND us.is_active = TRUE
      AND (us.expires_at IS NULL OR us.expires_at > NOW())
    ORDER BY st.maipiks_discount_percent DESC, us.started_at DESC
    LIMIT 1;
    v_is_subscriber := FOUND;
  END IF;

  IF v_viewer = v_story.user_id THEN
    v_access := TRUE;
  ELSIF v_story.visibility = 'followers' AND NOT EXISTS (
    SELECT 1 FROM public.user_follows
    WHERE follower_id = v_viewer AND following_id = v_story.user_id
  ) THEN
    v_access := FALSE;
  ELSIF v_story.visibility = 'private' AND NOT v_is_subscriber THEN
    v_access := FALSE;
  ELSIF v_story.monetization_mode = 'free' THEN
    v_access := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.maipiks_story_purchases p
      WHERE p.story_id = v_story.id
        AND p.purchaser_id = v_viewer
        AND p.status = 'completed'
        AND (p.access_expires_at IS NULL OR p.access_expires_at > NOW())
    ) INTO v_has_purchase;

    IF v_story.monetization_mode = 'subscribers_only' THEN
      v_access := v_is_subscriber;
    ELSIF v_story.monetization_mode = 'free_for_subscribers' AND v_is_subscriber THEN
      v_access := TRUE;
    ELSE
      v_base_price := v_story.base_price_coins;
      IF v_is_subscriber AND v_story.subscriber_discount_mode = 'platform' THEN
        v_discount_percent := v_tier_discount;
      END IF;
      v_discount_coins := FLOOR(v_base_price * v_discount_percent / 100.0)::BIGINT;
      v_final_price := GREATEST(v_base_price - v_discount_coins, 0);
      v_access := v_has_purchase OR v_final_price = 0;
    END IF;
  END IF;

  IF v_story.monetization_mode = 'free' OR v_story.monetization_mode = 'subscribers_only' THEN
    v_base_price := 0;
    v_final_price := 0;
  ELSIF v_story.monetization_mode = 'free_for_subscribers' AND v_is_subscriber THEN
    v_base_price := 0;
    v_final_price := 0;
  ELSE
    v_base_price := v_story.base_price_coins;
    IF v_is_subscriber AND v_story.subscriber_discount_mode = 'platform' THEN
      v_discount_percent := v_tier_discount;
    END IF;
    v_discount_coins := FLOOR(v_base_price * v_discount_percent / 100.0)::BIGINT;
    v_final_price := GREATEST(v_base_price - v_discount_coins, 0);
  END IF;

  RETURN jsonb_build_object(
    'available', TRUE,
    'has_access', v_access,
    'is_owner', v_viewer = v_story.user_id,
    'is_subscriber', v_is_subscriber,
    'monetization_mode', v_story.monetization_mode,
    'base_price_coins', v_base_price,
    'discount_percent', v_discount_percent,
    'discount_coins', v_discount_coins,
    'final_price_coins', v_final_price,
    'subscription_id', v_subscription_id,
    'subscription_tier_id', v_tier_id,
    'paid_access_duration', v_story.paid_access_duration
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_story_pricing(UUID) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_purchase_story(p_story_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer UUID := auth.uid();
  v_story public.maipiks_stories%ROWTYPE;
  v_quote JSONB;
  v_creator_coins BIGINT;
  v_platform_coins BIGINT;
  v_base_price BIGINT;
  v_discount_coins BIGINT;
  v_final_price BIGINT;
  v_discount_percent INTEGER;
  v_balance BIGINT;
  v_new_balance BIGINT;
  v_purchase_id UUID;
  v_transaction_id UUID;
  v_fee_id UUID;
  v_access_expires_at TIMESTAMPTZ;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_story_id::TEXT || ':' || v_viewer::TEXT, 0));

  SELECT * INTO v_story
  FROM public.maipiks_stories
  WHERE id = p_story_id
    AND deleted_at IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Story is unavailable';
  END IF;
  IF v_story.user_id = v_viewer THEN
    RAISE EXCEPTION 'You cannot purchase your own story';
  END IF;

  v_quote := public.maipiks_story_pricing(p_story_id);
  IF NOT COALESCE((v_quote->>'available')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Story is unavailable';
  END IF;
  IF COALESCE((v_quote->>'has_access')::BOOLEAN, FALSE) THEN
    RETURN jsonb_build_object('success', TRUE, 'already_unlocked', TRUE, 'price', 0);
  END IF;
  IF v_story.monetization_mode = 'subscribers_only' THEN
    RAISE EXCEPTION 'An active subscription is required';
  END IF;

  IF v_story.visibility = 'followers' AND NOT EXISTS (
    SELECT 1 FROM public.user_follows
    WHERE follower_id = v_viewer AND following_id = v_story.user_id
  ) THEN
    RAISE EXCEPTION 'Follow this creator to access the story';
  END IF;
  IF v_story.visibility = 'private' AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions
    WHERE subscriber_id = v_viewer
      AND broadcaster_id = v_story.user_id
      AND is_active = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'An active subscription is required';
  END IF;

  v_base_price := (v_quote->>'base_price_coins')::BIGINT;
  v_discount_percent := (v_quote->>'discount_percent')::INTEGER;
  v_discount_coins := (v_quote->>'discount_coins')::BIGINT;
  v_final_price := (v_quote->>'final_price_coins')::BIGINT;
  v_creator_coins := FLOOR(v_final_price * 0.80)::BIGINT;
  v_platform_coins := v_final_price - v_creator_coins;

  IF v_final_price > 0 THEN
    SELECT COALESCE(troll_coins, 0) INTO v_balance
    FROM public.user_profiles
    WHERE id = v_viewer
    FOR UPDATE;

    IF NOT FOUND OR v_balance < v_final_price THEN
      RAISE EXCEPTION 'Insufficient Troll Coins';
    END IF;

    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) - v_final_price,
        total_spent_coins = COALESCE(total_spent_coins, 0) + v_final_price
    WHERE id = v_viewer
    RETURNING troll_coins INTO v_new_balance;

    IF v_creator_coins > 0 THEN
      UPDATE public.user_profiles
      SET troll_coins = COALESCE(troll_coins, 0) + v_creator_coins,
          total_earned_coins = COALESCE(total_earned_coins, 0) + v_creator_coins
      WHERE id = v_story.user_id;
    END IF;

    INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
    VALUES (
      v_viewer, 'spend', v_final_price, 'MAI Piks story purchase',
      jsonb_build_object('story_id', p_story_id, 'creator_id', v_story.user_id, 'creator_coins', v_creator_coins, 'platform_coins', v_platform_coins),
      NOW()
    )
    RETURNING id INTO v_transaction_id;

    IF v_creator_coins > 0 THEN
      INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
      VALUES (
        v_story.user_id, 'earn', v_creator_coins, 'MAI Piks story sale',
        jsonb_build_object('story_id', p_story_id, 'purchaser_id', v_viewer, 'gross_coins', v_final_price, 'platform_coins', v_platform_coins),
        NOW()
      );
    END IF;

    IF v_platform_coins > 0 THEN
      v_fee_id := public.record_platform_fee(
        p_fee_type => 'maipiks_story_sale',
        p_coins => v_platform_coins,
        p_gross_coins => v_final_price,
        p_idempotency_key => 'maipiks_story_sale:' || v_transaction_id::TEXT,
        p_fee_percent => 20,
        p_payer_user_id => v_viewer,
        p_earner_user_id => v_story.user_id,
        p_reference_table => 'maipiks_story_purchases',
        p_reference_id => v_transaction_id,
        p_fee_label => 'MAI Piks Story Sale',
        p_metadata => jsonb_build_object('story_id', p_story_id)
      );
    END IF;
  ELSE
    SELECT COALESCE(troll_coins, 0) INTO v_new_balance
    FROM public.user_profiles WHERE id = v_viewer;
  END IF;

  v_access_expires_at := CASE v_story.paid_access_duration
    WHEN 'until_story_expiry' THEN v_story.expires_at
    WHEN '1h' THEN NOW() + INTERVAL '1 hour'
    WHEN '6h' THEN NOW() + INTERVAL '6 hours'
    WHEN '24h' THEN NOW() + INTERVAL '24 hours'
    WHEN '7d' THEN NOW() + INTERVAL '7 days'
    WHEN 'permanent' THEN NULL
    ELSE v_story.expires_at
  END;

  INSERT INTO public.maipiks_story_purchases (
    story_id, purchaser_id, creator_id, purchased_at, access_expires_at,
    base_price_coins, discount_percent, discount_coins, final_price_coins,
    creator_earnings_coins, platform_fee_coins,
    subscription_tier_id, subscription_id, spend_transaction_id, status
  ) VALUES (
    p_story_id, v_viewer, v_story.user_id, NOW(), v_access_expires_at,
    v_base_price, v_discount_percent, v_discount_coins, v_final_price,
    v_creator_coins, v_platform_coins,
    NULLIF(v_quote->>'subscription_tier_id', '')::UUID,
    NULLIF(v_quote->>'subscription_id', '')::UUID,
    v_transaction_id, 'completed'
  ) RETURNING id INTO v_purchase_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'purchase_id', v_purchase_id,
    'transaction_id', v_transaction_id,
    'base_price_coins', v_base_price,
    'discount_percent', v_discount_percent,
    'discount_coins', v_discount_coins,
    'final_price_coins', v_final_price,
    'creator_coins', v_creator_coins,
    'platform_coins', v_platform_coins,
    'access_expires_at', v_access_expires_at,
    'new_balance', v_new_balance
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_purchase_story(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_add_story_item(
  p_media_url TEXT,
  p_media_type TEXT,
  p_visibility TEXT,
  p_storage_path TEXT,
  p_thumbnail_url TEXT,
  p_caption TEXT,
  p_duration_ms INTEGER,
  p_lifetime_hours INTEGER,
  p_monetization_mode TEXT,
  p_base_price_coins BIGINT,
  p_subscriber_discount_mode TEXT,
  p_paid_access_duration TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_story_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_monetization_mode IS NULL OR p_monetization_mode NOT IN ('free', 'paid', 'subscribers_only', 'free_for_subscribers') THEN
    RAISE EXCEPTION 'Invalid monetization mode';
  END IF;
  IF p_base_price_coins IS NULL OR p_base_price_coins < 0 OR p_base_price_coins > 1000000 THEN
    RAISE EXCEPTION 'Invalid Troll Coin price';
  END IF;
  IF p_monetization_mode IN ('paid', 'free_for_subscribers') AND p_base_price_coins < 1 THEN
    RAISE EXCEPTION 'A paid story requires a positive base price';
  END IF;
  IF p_monetization_mode IN ('free', 'subscribers_only') AND p_base_price_coins <> 0 THEN
    RAISE EXCEPTION 'This story mode cannot have a price';
  END IF;
  IF p_subscriber_discount_mode IS NULL OR p_subscriber_discount_mode NOT IN ('platform', 'none') THEN
    RAISE EXCEPTION 'Invalid subscriber discount mode';
  END IF;
  IF p_paid_access_duration IS NULL OR p_paid_access_duration NOT IN ('until_story_expiry', '1h', '6h', '24h', '7d', 'permanent') THEN
    RAISE EXCEPTION 'Invalid paid access duration';
  END IF;

  v_result := public.maipiks_add_story_item(
    p_media_url,
    p_media_type,
    p_visibility,
    p_storage_path,
    p_thumbnail_url,
    p_caption,
    p_duration_ms,
    p_lifetime_hours
  );

  v_story_id := (v_result->>'story_id')::UUID;
  UPDATE public.maipiks_stories
  SET monetization_mode = p_monetization_mode,
      base_price_coins = p_base_price_coins,
      subscriber_discount_mode = p_subscriber_discount_mode,
      paid_access_duration = p_paid_access_duration,
      updated_at = NOW()
  WHERE id = v_story_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Could not configure the story';
  END IF;

  RETURN v_result || jsonb_build_object(
    'monetization_mode', p_monetization_mode,
    'base_price_coins', p_base_price_coins,
    'paid_access_duration', p_paid_access_duration
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_add_story_item(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, BIGINT, TEXT, TEXT)
  TO authenticated, service_role;

DROP POLICY IF EXISTS "maipiks_authorized_read" ON storage.objects;
CREATE POLICY "maipiks_authorized_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'maipiks'
    AND (
      EXISTS (
        SELECT 1
        FROM public.maipiks_posts p
        WHERE p.storage_path = name
          AND p.deleted_at IS NULL
          AND (
            p.user_id = auth.uid()
            OR p.visibility = 'everyone'
            OR (p.visibility = 'followers' AND EXISTS (
              SELECT 1 FROM public.user_follows f
              WHERE f.follower_id = auth.uid() AND f.following_id = p.user_id
            ))
            OR (p.visibility = 'private' AND EXISTS (
              SELECT 1 FROM public.user_subscriptions s
              WHERE s.subscriber_id = auth.uid() AND s.broadcaster_id = p.user_id
                AND s.is_active = TRUE AND (s.expires_at IS NULL OR s.expires_at > NOW())
            ))
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.maipiks_story_items i
        JOIN public.maipiks_stories s ON s.id = i.story_id
        WHERE i.storage_path = name
          AND i.deleted_at IS NULL
          AND i.expires_at > NOW()
          AND s.deleted_at IS NULL
          AND s.expires_at > NOW()
          AND (s.user_id = auth.uid() OR public.maipiks_story_pricing(s.id)->>'has_access' = 'true')
      )
    )
  );

CREATE OR REPLACE FUNCTION public.maipiks_require_story_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story_id UUID;
  v_access JSONB;
BEGIN
  IF TG_TABLE_NAME = 'maipiks_story_tips' THEN
    v_story_id := NEW.story_id;
  END IF;

  IF v_story_id IS NULL THEN
    SELECT story_id INTO v_story_id
    FROM public.maipiks_story_items
    WHERE id = NEW.story_item_id;
  END IF;

  v_access := public.maipiks_story_pricing(v_story_id);
  IF NOT COALESCE((v_access->>'has_access')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'Story access is required for this interaction';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_require_story_access() FROM PUBLIC;

DROP TRIGGER IF EXISTS maipiks_paid_view_access ON public.maipiks_story_views;
CREATE TRIGGER maipiks_paid_view_access
  BEFORE INSERT OR UPDATE ON public.maipiks_story_views
  FOR EACH ROW
  EXECUTE FUNCTION public.maipiks_require_story_access();

DROP TRIGGER IF EXISTS maipiks_paid_tip_access ON public.maipiks_story_tips;
CREATE TRIGGER maipiks_paid_tip_access
  BEFORE INSERT ON public.maipiks_story_tips
  FOR EACH ROW
  EXECUTE FUNCTION public.maipiks_require_story_access();

COMMIT;
BEGIN;

CREATE TABLE IF NOT EXISTS public.ghost_mode_entitlements (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'supreme')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

ALTER TABLE public.ghost_mode_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_mode_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ghost_mode_entitlements TO authenticated;
GRANT SELECT ON public.ghost_mode_entitlements TO service_role;

DROP POLICY IF EXISTS ghost_mode_entitlements_owner_read ON public.ghost_mode_entitlements;
CREATE POLICY ghost_mode_entitlements_owner_read
  ON public.ghost_mode_entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.ghost_mode_is_active(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ghost_mode_entitlements e
    WHERE e.user_id = p_target_user_id
      AND e.starts_at <= now()
      AND (e.expires_at IS NULL OR e.expires_at > now())
  );
$$;

REVOKE ALL ON FUNCTION private.ghost_mode_is_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ghost_mode_is_active(UUID) TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.ghost_mode_supreme_is_active(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.ghost_mode_entitlements e
    WHERE e.user_id = p_target_user_id
      AND e.tier = 'supreme'
      AND e.starts_at <= now()
      AND e.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION private.ghost_mode_supreme_is_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.ghost_mode_supreme_is_active(UUID) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.mai_supreme_entitlements (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > starts_at)
);

CREATE OR REPLACE FUNCTION private.mai_supreme_is_active(p_target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mai_supreme_entitlements e
    WHERE e.user_id = p_target_user_id
      AND e.starts_at <= now()
      AND e.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION private.mai_supreme_is_active(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.mai_supreme_is_active(UUID) TO anon, authenticated;

ALTER TABLE public.mai_supreme_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mai_supreme_entitlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mai_supreme_entitlements TO authenticated;
GRANT SELECT ON public.mai_supreme_entitlements TO service_role;

DROP POLICY IF EXISTS mai_supreme_entitlements_owner_read ON public.mai_supreme_entitlements;
CREATE POLICY mai_supreme_entitlements_owner_read
  ON public.mai_supreme_entitlements FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ghost_mode_coin_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'supreme')),
  amount_coins INTEGER NOT NULL CHECK (
    (tier = 'basic' AND amount_coins = 200)
    OR (tier = 'supreme' AND amount_coins = 5000)
  ),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.ghost_mode_coin_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_mode_coin_purchases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ghost_mode_coin_purchases TO authenticated;

DROP POLICY IF EXISTS ghost_mode_coin_purchases_owner_read ON public.ghost_mode_coin_purchases;
CREATE POLICY ghost_mode_coin_purchases_owner_read
  ON public.ghost_mode_coin_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.mai_supreme_coin_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount_coins INTEGER NOT NULL DEFAULT 2200 CHECK (amount_coins = 2200),
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.mai_supreme_coin_purchases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mai_supreme_coin_purchases FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.mai_supreme_coin_purchases TO authenticated;

DROP POLICY IF EXISTS mai_supreme_coin_purchases_owner_read ON public.mai_supreme_coin_purchases;
CREATE POLICY mai_supreme_coin_purchases_owner_read
  ON public.mai_supreme_coin_purchases FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.ghost_mode_identity_access_audit (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  accessed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ghost_mode_identity_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_mode_identity_access_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_ghost_mode_staff()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (
          up.is_admin IS TRUE
          OR up.is_superadmin IS TRUE
          OR up.is_troll_officer IS TRUE
          OR up.is_lead_officer IS TRUE
          OR lower(COALESCE(up.role, '')) IN (
            'admin', 'superadmin', 'owner', 'ceo', 'staff',
            'lead_troll_officer', 'lead_officer', 'troll_officer', 'officer',
            'secretary', 'executive_secretary', 'troll_city_secretary',
            'prosecutor', 'attorney', 'judge', 'auctioneer', 'pastor',
            'journalist', 'ceo_assistant', 'noah_assistant', 'president',
            'vice_president', 'hr_admin', 'hr_manager', 'agency_hr',
            'agency_hr_manager', 'agency_leader', 'marketing_agent',
            'empire_partner', 'notary', 'broadofficer', 'temp_city_admin',
            'temp_admin', 'moderator', 'tcnn_news_caster',
            'tcnn_chief_news_caster'
          )
          OR lower(COALESCE(up.troll_role, '')) IN (
            'admin', 'superadmin', 'owner', 'ceo', 'staff',
            'lead_troll_officer', 'lead_officer', 'troll_officer', 'officer',
            'secretary', 'moderator'
          )
        )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_ghost_mode_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_ghost_mode_staff() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_active_mai_supreme_entitlement()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mai_supreme_entitlements e
    WHERE e.user_id = auth.uid()
      AND e.starts_at <= now()
      AND e.expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION public.has_active_mai_supreme_entitlement() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_mai_supreme_entitlement() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.buy_ghost_mode_supreme()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance BIGINT;
  v_expiry TIMESTAMPTZ;
  v_start TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT COALESCE(troll_coins, 0)
    INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
  IF v_balance < 5000 THEN
    RAISE EXCEPTION 'INSUFFICIENT_TROLL_COINS';
  END IF;

  SELECT CASE
           WHEN tier = 'supreme' AND expires_at > now() THEN expires_at
           ELSE now()
         END
    INTO v_start
    FROM public.ghost_mode_entitlements
    WHERE user_id = v_user_id
    FOR UPDATE;
  v_start := COALESCE(v_start, now());
  v_expiry := v_start + INTERVAL '30 days';

  UPDATE public.user_profiles
    SET troll_coins = v_balance - 5000
    WHERE id = v_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
      v_user_id,
      -5000,
      'purchase',
      'Ghost Mode Supreme',
      jsonb_build_object('tier', 'supreme', 'expires_at', v_expiry)
    );

  INSERT INTO public.ghost_mode_entitlements (user_id, tier, starts_at, expires_at, updated_at)
    VALUES (v_user_id, 'supreme', v_start, v_expiry, now())
    ON CONFLICT (user_id) DO UPDATE
      SET tier = 'supreme',
          starts_at = EXCLUDED.starts_at,
          expires_at = EXCLUDED.expires_at,
          updated_at = now();

  INSERT INTO public.ghost_mode_coin_purchases (user_id, tier, amount_coins, expires_at)
    VALUES (v_user_id, 'supreme', 5000, v_expiry);

  RETURN jsonb_build_object(
    'success', true,
    'tier', 'supreme',
    'expires_at', v_expiry,
    'balance', v_balance - 5000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buy_ghost_mode_supreme() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_ghost_mode_supreme() TO authenticated;

CREATE OR REPLACE FUNCTION public.activate_basic_ghost_mode()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance BIGINT;
  v_start TIMESTAMPTZ;
  v_expiry TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT COALESCE(troll_coins, 0)
    INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
  IF v_balance < 200 THEN
    RAISE EXCEPTION 'INSUFFICIENT_TROLL_COINS';
  END IF;

  SELECT CASE
           WHEN tier = 'basic' AND expires_at > now() THEN expires_at
           ELSE now()
         END
    INTO v_start
    FROM public.ghost_mode_entitlements
    WHERE user_id = v_user_id
    FOR UPDATE;
  v_start := COALESCE(v_start, now());
  v_expiry := v_start + INTERVAL '1 day';

  UPDATE public.user_profiles
    SET troll_coins = v_balance - 200
    WHERE id = v_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
      v_user_id,
      -200,
      'purchase',
      'Basic Ghost Mode - 1 day',
      jsonb_build_object('tier', 'basic', 'expires_at', v_expiry)
    );

  INSERT INTO public.ghost_mode_entitlements (user_id, tier, starts_at, expires_at, updated_at)
    VALUES (v_user_id, 'basic', v_start, v_expiry, now())
    ON CONFLICT (user_id) DO UPDATE
      SET tier = 'basic',
          starts_at = EXCLUDED.starts_at,
          expires_at = EXCLUDED.expires_at,
          updated_at = now();

  INSERT INTO public.ghost_mode_coin_purchases (user_id, tier, amount_coins, expires_at)
    VALUES (v_user_id, 'basic', 200, v_expiry);

  RETURN jsonb_build_object(
    'success', true,
    'tier', 'basic',
    'expires_at', v_expiry,
    'balance', v_balance - 200
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_basic_ghost_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_basic_ghost_mode() TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_mai_supreme()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_balance BIGINT;
  v_start TIMESTAMPTZ;
  v_expiry TIMESTAMPTZ;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT COALESCE(troll_coins, 0)
    INTO v_balance
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;
  IF v_balance < 2200 THEN
    RAISE EXCEPTION 'INSUFFICIENT_TROLL_COINS';
  END IF;

  SELECT CASE WHEN expires_at > now() THEN expires_at ELSE now() END
    INTO v_start
    FROM public.mai_supreme_entitlements
    WHERE user_id = v_user_id
    FOR UPDATE;
  v_start := COALESCE(v_start, now());
  v_expiry := v_start + INTERVAL '1 month';

  UPDATE public.user_profiles
    SET troll_coins = v_balance - 2200
    WHERE id = v_user_id;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata)
    VALUES (
      v_user_id,
      -2200,
      'purchase',
      'Mai Supreme - 1 month',
      jsonb_build_object('membership', 'mai_supreme', 'expires_at', v_expiry)
    );

  INSERT INTO public.mai_supreme_entitlements (user_id, starts_at, expires_at, updated_at)
    VALUES (v_user_id, v_start, v_expiry, now())
    ON CONFLICT (user_id) DO UPDATE
      SET starts_at = EXCLUDED.starts_at,
          expires_at = EXCLUDED.expires_at,
          updated_at = now();

  INSERT INTO public.mai_supreme_coin_purchases (user_id, amount_coins, expires_at)
    VALUES (v_user_id, 2200, v_expiry);

  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_expiry,
    'balance', v_balance - 2200
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buy_mai_supreme() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_mai_supreme() TO authenticated;

CREATE OR REPLACE FUNCTION public.deactivate_ghost_mode()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  DELETE FROM public.ghost_mode_entitlements WHERE user_id = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_ghost_mode() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_ghost_mode() TO authenticated;

DROP POLICY IF EXISTS user_profiles_hide_active_ghost_identity ON public.user_profiles;
CREATE POLICY user_profiles_hide_active_ghost_identity
  ON public.user_profiles AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    id = auth.uid()
    OR public.is_ghost_mode_staff()
    OR NOT private.ghost_mode_is_active(user_profiles.id)
  );

CREATE OR REPLACE VIEW public.user_profiles_public_identity
WITH (security_barrier = true)
AS
SELECT
  up.id,
  CASE
    WHEN e.user_id IS NOT NULL
      AND e.starts_at <= now()
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND auth.uid() IS DISTINCT FROM up.id
      AND NOT public.is_ghost_mode_staff()
      AND NOT public.has_active_mai_supreme_entitlement()
    THEN 'xxxxx'
    ELSE COALESCE(NULLIF(up.username, ''), 'User')
  END AS username,
  CASE
    WHEN e.user_id IS NOT NULL
      AND e.starts_at <= now()
      AND (e.expires_at IS NULL OR e.expires_at > now())
      AND auth.uid() IS DISTINCT FROM up.id
      AND NOT public.is_ghost_mode_staff()
      AND NOT public.has_active_mai_supreme_entitlement()
    THEN CASE WHEN e.tier = 'supreme' THEN '/ghost-supreme.svg' ELSE '/ghost-basic.svg' END
    ELSE up.avatar_url
  END AS avatar_url
FROM public.user_profiles up
LEFT JOIN public.ghost_mode_entitlements e ON e.user_id = up.id;

REVOKE ALL ON public.user_profiles_public_identity FROM PUBLIC;
GRANT SELECT ON public.user_profiles_public_identity TO anon, authenticated;

ALTER TABLE public.stream_audience_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stream_presence_hide_active_ghost_identity ON public.stream_audience_presence;
CREATE POLICY stream_presence_hide_active_ghost_identity
  ON public.stream_audience_presence AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR public.is_ghost_mode_staff()
    OR NOT private.ghost_mode_is_active(stream_audience_presence.user_id)
  );

CREATE OR REPLACE VIEW public.stream_audience_presence_public
WITH (security_barrier = true)
AS
SELECT
  presence.id,
  presence.stream_id,
  presence.user_id,
  CASE
    WHEN entitlement.user_id IS NOT NULL
      AND entitlement.starts_at <= now()
      AND (entitlement.expires_at IS NULL OR entitlement.expires_at > now())
      AND auth.uid() IS DISTINCT FROM presence.user_id
      AND NOT public.is_ghost_mode_staff()
      AND NOT public.has_active_mai_supreme_entitlement()
    THEN 'xxxxx'
    ELSE presence.username
  END AS username,
  CASE
    WHEN entitlement.user_id IS NOT NULL
      AND entitlement.starts_at <= now()
      AND (entitlement.expires_at IS NULL OR entitlement.expires_at > now())
      AND auth.uid() IS DISTINCT FROM presence.user_id
      AND NOT public.is_ghost_mode_staff()
      AND NOT public.has_active_mai_supreme_entitlement()
    THEN CASE WHEN entitlement.tier = 'supreme' THEN '/ghost-supreme.svg' ELSE '/ghost-basic.svg' END
    ELSE presence.avatar_url
  END AS avatar_url,
  presence.joined_at,
  presence.left_at,
  presence.is_active,
  presence.gift_total,
  presence.seat_id,
  presence.role,
  presence.last_seen_at
FROM public.stream_audience_presence presence
LEFT JOIN public.ghost_mode_entitlements entitlement ON entitlement.user_id = presence.user_id;

REVOKE ALL ON public.stream_audience_presence_public FROM PUBLIC;
GRANT SELECT ON public.stream_audience_presence_public TO anon, authenticated;

ALTER TABLE public.stream_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS stream_messages_ghost_supreme_private_read ON public.stream_messages;
CREATE POLICY stream_messages_ghost_supreme_private_read
  ON public.stream_messages AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    NOT private.ghost_mode_supreme_is_active(stream_messages.user_id)
    OR stream_messages.user_id = auth.uid()
    OR public.is_ghost_mode_staff()
    OR EXISTS (
      SELECT 1
      FROM public.streams s
      WHERE s.id = stream_messages.stream_id
        AND (s.broadcaster_id = auth.uid() OR s.owner_id = auth.uid() OR s.user_id = auth.uid())
        AND NOT EXISTS (
          SELECT 1
          FROM public.user_blocks b
          WHERE (b.blocker_id = auth.uid() AND b.blocked_id = stream_messages.user_id)
             OR (b.blocker_id = stream_messages.user_id AND b.blocked_id = auth.uid())
        )
    )
  );

ALTER TABLE public.troll_wall_posts
  ADD COLUMN IF NOT EXISTS privacy_mode TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS selected_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

CREATE TABLE IF NOT EXISTS public.ghost_mode_saved_users (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  saved_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, saved_user_id),
  CHECK (user_id <> saved_user_id)
);

ALTER TABLE public.ghost_mode_saved_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ghost_mode_saved_users FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.ghost_mode_saved_users TO authenticated;

DROP POLICY IF EXISTS ghost_mode_saved_users_owner_read ON public.ghost_mode_saved_users;
CREATE POLICY ghost_mode_saved_users_owner_read
  ON public.ghost_mode_saved_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ghost_mode_saved_users_supreme_save ON public.ghost_mode_saved_users;
CREATE POLICY ghost_mode_saved_users_supreme_save
  ON public.ghost_mode_saved_users FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND private.ghost_mode_supreme_is_active(auth.uid())
  );

DROP POLICY IF EXISTS ghost_mode_saved_users_owner_delete ON public.ghost_mode_saved_users;
CREATE POLICY ghost_mode_saved_users_owner_delete
  ON public.ghost_mode_saved_users FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.troll_wall_posts'::regclass
      AND conname = 'troll_wall_posts_privacy_mode_check'
  ) THEN
    ALTER TABLE public.troll_wall_posts
      ADD CONSTRAINT troll_wall_posts_privacy_mode_check
      CHECK (privacy_mode IN ('public', 'selected'));
  END IF;
END;
$$;

ALTER TABLE public.troll_wall_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS troll_wall_posts_ghost_identity_private_read ON public.troll_wall_posts;
CREATE POLICY troll_wall_posts_ghost_identity_private_read
  ON public.troll_wall_posts AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (
    (privacy_mode = 'public' AND NOT private.ghost_mode_is_active(troll_wall_posts.user_id))
    OR troll_wall_posts.user_id = auth.uid()
    OR public.is_ghost_mode_staff()
  );

DROP POLICY IF EXISTS troll_wall_posts_supreme_private_insert ON public.troll_wall_posts;
CREATE POLICY troll_wall_posts_supreme_private_insert
  ON public.troll_wall_posts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    troll_wall_posts.user_id = auth.uid()
    AND (
      privacy_mode = 'public'
      OR (
        privacy_mode = 'selected'
        AND private.ghost_mode_supreme_is_active(auth.uid())
        AND cardinality(selected_user_ids) > 0
      )
    )
  );

DROP POLICY IF EXISTS troll_wall_posts_supreme_private_update ON public.troll_wall_posts;
CREATE POLICY troll_wall_posts_supreme_private_update
  ON public.troll_wall_posts AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (troll_wall_posts.user_id = auth.uid())
  WITH CHECK (
    troll_wall_posts.user_id = auth.uid()
    AND (
      privacy_mode = 'public'
      OR (
        privacy_mode = 'selected'
        AND private.ghost_mode_supreme_is_active(auth.uid())
        AND cardinality(selected_user_ids) > 0
      )
    )
  );

CREATE OR REPLACE VIEW public.troll_wall_posts_public
WITH (security_barrier = true)
AS
SELECT
  p.id,
  p.user_id,
  identity.username,
  identity.avatar_url,
  up.is_admin,
  up.is_troll_officer,
  up.is_og_user,
  up.created_at AS user_created_at,
  up.is_verified,
  up.is_gold,
  up.username_style,
  up.badge,
  up.officer_level,
  up.troller_level,
  up.is_troller,
  p.is_pinned,
  p.post_type,
  p.content,
  p.metadata,
  p.likes,
  p.created_at,
  p.reply_to_post_id,
  p.deleted_at
FROM public.troll_wall_posts p
JOIN public.user_profiles up ON up.id = p.user_id
JOIN public.user_profiles_public_identity identity ON identity.id = p.user_id
WHERE
  (
    p.privacy_mode = 'public'
    OR p.user_id = auth.uid()
    OR auth.uid() = ANY(p.selected_user_ids)
    OR public.is_ghost_mode_staff()
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_blocks b
    WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.user_id)
       OR (b.blocker_id = p.user_id AND b.blocked_id = auth.uid())
  )
  AND (
    p.privacy_mode = 'public'
    OR p.user_id = auth.uid()
    OR public.is_ghost_mode_staff()
    OR private.ghost_mode_supreme_is_active(p.user_id)
  );

REVOKE ALL ON public.troll_wall_posts_public FROM PUBLIC;
GRANT SELECT ON public.troll_wall_posts_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_staff_ghost_profile(p_target_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  ghost_mode_tier TEXT,
  ghost_mode_active BOOLEAN,
  ghost_mode_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_ghost_mode_staff() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  INSERT INTO public.ghost_mode_identity_access_audit (actor_user_id, target_user_id)
    VALUES (v_actor, p_target_user_id);

  RETURN QUERY
  SELECT
    up.id,
    COALESCE(up.username, 'User'),
    up.avatar_url,
    e.tier,
    COALESCE(e.starts_at <= now() AND (e.expires_at IS NULL OR e.expires_at > now()), false),
    e.expires_at
  FROM public.user_profiles up
  LEFT JOIN public.ghost_mode_entitlements e ON e.user_id = up.id
  WHERE up.id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_ghost_profile(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_ghost_profile(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_staff_ghost_profiles(p_target_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  ghost_mode_tier TEXT,
  ghost_mode_active BOOLEAN,
  ghost_mode_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.is_ghost_mode_staff() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  INSERT INTO public.ghost_mode_identity_access_audit (actor_user_id, target_user_id)
  SELECT v_actor, target_id
  FROM (SELECT DISTINCT unnest(p_target_user_ids) AS target_id) requested
  JOIN public.user_profiles up ON up.id = requested.target_id;

  RETURN QUERY
  SELECT
    up.id,
    COALESCE(up.username, 'User'),
    up.avatar_url,
    e.tier,
    COALESCE(e.starts_at <= now() AND (e.expires_at IS NULL OR e.expires_at > now()), false),
    e.expires_at
  FROM public.user_profiles up
  LEFT JOIN public.ghost_mode_entitlements e ON e.user_id = up.id
  WHERE up.id = ANY(COALESCE(p_target_user_ids, ARRAY[]::UUID[]));
END;
$$;

REVOKE ALL ON FUNCTION public.get_staff_ghost_profiles(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_staff_ghost_profiles(UUID[]) TO authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.request_cashout(uuid,bigint,text,text,text,text)') IS NOT NULL
     AND to_regprocedure('public.request_cashout_with_standard_fees(uuid,bigint,text,text,text,text)') IS NULL THEN
    ALTER FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT)
      RENAME TO request_cashout_with_standard_fees;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.request_cashout_with_standard_fees(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_cashout_with_standard_fees(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

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
SET row_security = off
AS $$
DECLARE
  v_forwarded_provider TEXT := p_provider_type;
  v_result JSONB;
  v_payout_id UUID;
  v_ghost_supreme_active BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  PERFORM 1
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  v_ghost_supreme_active := private.ghost_mode_supreme_is_active(p_user_id);
  IF v_ghost_supreme_active
     AND lower(COALESCE(p_provider_type, '')) IN ('venmo', 'cash_app', 'paypal') THEN
    v_forwarded_provider := 'ach';
  END IF;

  v_result := public.request_cashout_with_standard_fees(
    p_user_id,
    p_coins_to_redeem,
    v_forwarded_provider,
    p_provider_username,
    p_user_tag,
    p_id_verification_url
  );

  IF COALESCE((v_result->>'success')::BOOLEAN, false) AND v_forwarded_provider <> p_provider_type THEN
    v_payout_id := NULLIF(v_result->>'payout_id', '')::UUID;
    IF v_payout_id IS NOT NULL THEN
      UPDATE public.payout_requests
      SET provider_type = p_provider_type
      WHERE id = v_payout_id
        AND user_id = p_user_id;

      UPDATE public.coin_transactions
      SET metadata = COALESCE(metadata, '{}'::JSONB) || jsonb_build_object(
        'provider_type', p_provider_type,
        'fee_coins', 0,
        'fee_percentage', 0,
        'ghost_mode_supreme_fee_exemption', true
      )
      WHERE metadata->>'payout_request_id' = v_payout_id::TEXT
        AND user_id = p_user_id;

      v_result := jsonb_set(v_result, '{fee_coins}', '0'::JSONB, true);
      v_result := jsonb_set(v_result, '{fee_percentage}', '0'::JSONB, true);
      v_result := jsonb_set(
        v_result,
        '{total_coins_charged}',
        to_jsonb(p_coins_to_redeem),
        true
      );
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_cashout(UUID, BIGINT, TEXT, TEXT, TEXT, TEXT)
  TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.coin_pack_catalog (
  package_key TEXT PRIMARY KEY,
  coin_amount BIGINT NOT NULL CHECK (coin_amount > 0),
  list_price_usd NUMERIC(10, 2) NOT NULL CHECK (list_price_usd > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_pack_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coin_pack_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.coin_pack_catalog TO service_role;

INSERT INTO public.coin_pack_catalog (package_key, coin_amount, list_price_usd)
VALUES
  ('pkg-100', 125, 1.00),
  ('pkg-300', 375, 3.00),
  ('pkg-500', 625, 5.00),
  ('pkg-1000', 1250, 10.00),
  ('pkg-2500', 3125, 25.00),
  ('pkg-5000', 6250, 50.00),
  ('pkg-10000', 12500, 100.00),
  ('pkg-15000', 18750, 150.00),
  ('pkg-25000', 31250, 250.00),
  ('pkg-50000', 62500, 500.00),
  ('pkg-100000', 125000, 1000.00),
  ('pkg-250000', 312500, 2500.00)
ON CONFLICT (package_key) DO UPDATE
SET coin_amount = EXCLUDED.coin_amount,
    list_price_usd = EXCLUDED.list_price_usd,
    updated_at = now();

INSERT INTO public.purchasable_items (
  item_key,
  display_name,
  category,
  coin_price,
  usd_price,
  is_coin_pack,
  is_active,
  frontend_source,
  metadata
)
SELECT
  c.package_key,
  CASE c.package_key
    WHEN 'pkg-100' THEN 'Micro Pack'
    WHEN 'pkg-300' THEN 'Starter Pack'
    WHEN 'pkg-500' THEN 'Small Boost'
    WHEN 'pkg-1000' THEN 'Casual Pack'
    WHEN 'pkg-2500' THEN 'Bronze Pack'
    WHEN 'pkg-5000' THEN 'Silver Pack'
    WHEN 'pkg-10000' THEN 'Gold Pack'
    WHEN 'pkg-15000' THEN 'Platinum Pack'
    WHEN 'pkg-25000' THEN 'Diamond Pack'
    WHEN 'pkg-50000' THEN 'Legendary Pack'
    WHEN 'pkg-100000' THEN 'Titan Pack'
    ELSE 'Immortal Pack'
  END,
  'coin_pack',
  c.coin_amount::INTEGER,
  c.list_price_usd,
  TRUE,
  TRUE,
  'coinConfig.ts',
  jsonb_build_object('coins', c.coin_amount, 'coins_received', c.coin_amount)
FROM public.coin_pack_catalog c
ON CONFLICT (item_key) DO UPDATE
SET display_name = EXCLUDED.display_name,
    category = EXCLUDED.category,
    coin_price = EXCLUDED.coin_price,
    usd_price = EXCLUDED.usd_price,
    is_coin_pack = TRUE,
    is_active = TRUE,
    frontend_source = EXCLUDED.frontend_source,
    metadata = COALESCE(public.purchasable_items.metadata, '{}'::JSONB) || EXCLUDED.metadata;

CREATE OR REPLACE FUNCTION public.get_my_coin_pack_discount_percent()
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 0
    WHEN private.ghost_mode_supreme_is_active(auth.uid()) THEN 10
    WHEN private.mai_supreme_is_active(auth.uid()) THEN 5
    ELSE 0
  END;
$$;

REVOKE ALL ON FUNCTION public.get_my_coin_pack_discount_percent() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_coin_pack_discount_percent() TO authenticated;

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
      THEN 'Mai Supreme platform fee waiver - 100% to creator'
      ELSE 'Creator subscription - 80% to creator, 20% to CEO'
    END
  );

  UPDATE public.user_profiles
  SET monthly_subscriber_count = COALESCE(monthly_subscriber_count, 0) + 1
  WHERE id = v_creator.id;

  PERFORM pg_notify(
    'subscription_created',
    jsonb_build_object(
      'broadcaster_id', v_creator.id,
      'subscriber_id', v_subscriber.id,
      'subscriber_username', v_subscriber.username,
      'amount', v_price
    )::text
  );

  RETURN jsonb_build_object(
    'success', true,
    'platform_fee_percent', v_platform_fee_percent,
    'subscription', jsonb_build_object(
      'id', v_subscription_id,
      'price_paid_coins', v_price,
      'creator_amount_coins', v_creator_amount,
      'ceo_amount_coins', v_ceo_amount
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.subscribe_to_creator(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.subscribe_to_creator(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.join_town_meeting_seat(
  p_meeting_id UUID,
  p_seat_number INTEGER,
  p_display_role TEXT,
  p_participant_identity TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_meeting RECORD;
  v_profile RECORD;
  v_existing RECORD;
  v_is_mai_supreme BOOLEAN;
  v_is_official BOOLEAN;
  v_display_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_meeting
  FROM public.town_meetings
  WHERE id = p_meeting_id
    AND is_active = true
    AND is_ended = false;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'meeting_not_active');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  v_is_mai_supreme := private.mai_supreme_is_active(v_profile.id);
  v_is_official := v_profile.role IN (
    'admin', 'owner', 'ceo', 'staff', 'secretary',
    'lead_troll', 'lead_troll_officer', 'troll_officer', 'pastor',
    'president', 'vice_president', 'official', 'prosecutor', 'attorney'
  ) OR v_profile.is_admin = true OR v_profile.is_staff = true;

  IF NOT v_is_official AND NOT v_is_mai_supreme THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;
  IF p_seat_number IS NULL OR p_seat_number < 1 OR p_seat_number > 8 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_seat');
  END IF;

  SELECT * INTO v_existing
  FROM public.town_meeting_seats
  WHERE meeting_id = p_meeting_id
    AND user_id = v_profile.id
    AND left_at IS NULL
    AND removed_at IS NULL
  LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_assigned');
  END IF;

  v_display_role := CASE
    WHEN v_is_official THEN COALESCE(v_profile.role, 'official')
    ELSE 'mai_supreme_member'
  END;

  INSERT INTO public.town_meeting_seats (
    meeting_id,
    seat_number,
    user_id,
    display_role,
    participant_identity,
    joined_at,
    created_at
  ) VALUES (
    p_meeting_id,
    p_seat_number,
    v_profile.id,
    v_display_role,
    v_profile.id::TEXT,
    now(),
    now()
  );

  INSERT INTO public.town_meeting_participants (
    meeting_id,
    user_id,
    role,
    joined_at,
    created_at
  ) VALUES (
    p_meeting_id,
    v_profile.id,
    v_display_role,
    now(),
    now()
  )
  ON CONFLICT (meeting_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        joined_at = EXCLUDED.joined_at,
        left_at = NULL;

  RETURN jsonb_build_object('success', true, 'display_role', v_display_role);
END;
$$;

REVOKE ALL ON FUNCTION public.join_town_meeting_seat(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_town_meeting_seat(UUID, INTEGER, TEXT, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.notify_mai_supreme_town_meeting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    is_read,
    created_at
  )
  SELECT
    e.user_id,
    'town_meeting_started',
    'Mai Troll Town Meeting',
    'A Town Meeting is available to attend.',
    jsonb_build_object('meeting_id', NEW.id, 'title', NEW.title),
    false,
    now()
  FROM public.mai_supreme_entitlements e
  WHERE e.starts_at <= now()
    AND e.expires_at > now();

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_mai_supreme_town_meeting() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.town_meetings') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS notify_mai_supreme_town_meeting ON public.town_meetings';
    EXECUTE 'CREATE TRIGGER notify_mai_supreme_town_meeting
      AFTER INSERT ON public.town_meetings
      FOR EACH ROW
      EXECUTE FUNCTION private.notify_mai_supreme_town_meeting()';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.notify_new_mai_supreme_town_meetings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
BEGIN
  IF NEW.starts_at > now() OR NEW.expires_at <= now() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.starts_at <= now() AND OLD.expires_at > now() THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    metadata,
    is_read,
    created_at
  )
  SELECT
    NEW.user_id,
    'town_meeting_started',
    'Mai Troll Town Meeting',
    'A Town Meeting is available to attend.',
    jsonb_build_object('meeting_id', m.id, 'title', m.title),
    false,
    now()
  FROM public.town_meetings m
  WHERE m.is_active = true
    AND m.is_ended = false;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.notify_new_mai_supreme_town_meetings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notify_new_mai_supreme_town_meetings ON public.mai_supreme_entitlements;
CREATE TRIGGER notify_new_mai_supreme_town_meetings
  AFTER INSERT OR UPDATE ON public.mai_supreme_entitlements
  FOR EACH ROW
  EXECUTE FUNCTION private.notify_new_mai_supreme_town_meetings();

CREATE OR REPLACE FUNCTION public.submit_government_proposal(
  p_title TEXT,
  p_description TEXT,
  p_category TEXT,
  p_submitter_role TEXT,
  p_public_visibility BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_profile RECORD;
  v_proposal_id UUID;
  v_is_mai_supreme BOOLEAN;
  v_is_official BOOLEAN;
  v_submitter_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = auth.uid();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'profile_not_found');
  END IF;

  v_is_mai_supreme := private.mai_supreme_is_active(v_profile.id);
  v_is_official := v_profile.role IN (
    'admin', 'owner', 'ceo', 'staff', 'secretary',
    'lead_troll', 'lead_troll_officer', 'troll_officer', 'pastor',
    'president', 'vice_president', 'official', 'prosecutor', 'attorney'
  ) OR v_profile.is_admin = true OR v_profile.is_staff = true;

  IF NOT v_is_official AND NOT v_is_mai_supreme THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authorized');
  END IF;
  IF NOT v_is_official AND lower(COALESCE(p_category, '')) <> 'law' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'mai_supreme_members_may_submit_law_proposals_only');
  END IF;
  IF p_title IS NULL OR length(trim(p_title)) = 0
     OR p_description IS NULL OR length(trim(p_description)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'title_and_description_required');
  END IF;

  v_submitter_role := CASE
    WHEN v_is_official THEN COALESCE(p_submitter_role, v_profile.role)
    ELSE 'mai_supreme_member'
  END;

  INSERT INTO public.government_proposals (
    title,
    description,
    category,
    submitted_by,
    submitter_role,
    public_visibility,
    created_at,
    updated_at
  ) VALUES (
    trim(p_title),
    trim(p_description),
    COALESCE(NULLIF(trim(p_category), ''), 'general'),
    v_profile.id,
    v_submitter_role,
    COALESCE(p_public_visibility, true),
    now(),
    now()
  )
  RETURNING id INTO v_proposal_id;

  INSERT INTO public.government_audit_log (
    actor_id,
    action,
    target_type,
    target_id,
    details,
    created_at
  ) VALUES (
    v_profile.id,
    'proposal_submitted',
    'government_proposals',
    v_proposal_id,
    jsonb_build_object('title', p_title, 'category', p_category),
    now()
  );

  RETURN jsonb_build_object('success', true, 'proposal_id', v_proposal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_government_proposal(TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_government_proposal(TEXT, TEXT, TEXT, TEXT, BOOLEAN)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

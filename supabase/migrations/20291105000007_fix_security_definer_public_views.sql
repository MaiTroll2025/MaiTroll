-- Keep public-facing views invoker-security. Narrow SECURITY DEFINER functions
-- below provide only the sanitized rows/columns these views are meant to expose.
CREATE OR REPLACE FUNCTION private.get_user_profiles_public_identity()
RETURNS TABLE (
  id uuid,
  username text,
  avatar_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
SET row_security = off
AS $$
  SELECT
    CASE
      WHEN private.ghost_mode_is_active(up.id)
        AND auth.uid() IS DISTINCT FROM up.id
        AND NOT public.is_ghost_mode_staff()
        AND NOT public.has_active_mai_supreme_entitlement()
      THEN NULL::uuid
      ELSE up.id
    END,
    CASE
      WHEN private.ghost_mode_is_active(up.id)
        AND auth.uid() IS DISTINCT FROM up.id
        AND NOT public.is_ghost_mode_staff()
        AND NOT public.has_active_mai_supreme_entitlement()
      THEN 'xxxxx'
      ELSE COALESCE(NULLIF(up.username, ''), 'User')
    END,
    CASE
      WHEN private.ghost_mode_is_active(up.id)
        AND auth.uid() IS DISTINCT FROM up.id
        AND NOT public.is_ghost_mode_staff()
        AND NOT public.has_active_mai_supreme_entitlement()
      THEN CASE
        WHEN private.ghost_mode_supreme_is_active(up.id) THEN '/ghost-supreme.svg'
        ELSE '/ghost-basic.svg'
      END
      ELSE up.avatar_url
    END
  FROM public.user_profiles up;
$$;
ALTER FUNCTION private.get_user_profiles_public_identity() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.get_user_profiles_public_identity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_user_profiles_public_identity() TO anon, authenticated;

CREATE OR REPLACE VIEW public.user_profiles_public_identity
WITH (security_barrier = true, security_invoker = true)
AS
SELECT identity.id, identity.username, identity.avatar_url
FROM private.get_user_profiles_public_identity() AS identity;

REVOKE ALL ON public.user_profiles_public_identity FROM PUBLIC;
GRANT SELECT ON public.user_profiles_public_identity TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_stream_audience_presence_public()
RETURNS TABLE (
  id uuid,
  stream_id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  joined_at timestamptz,
  left_at timestamptz,
  is_active boolean,
  gift_total integer,
  seat_id integer,
  role text,
  last_seen_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
SET row_security = off
AS $$
  SELECT
    presence.id,
    presence.stream_id,
    presence.user_id,
    presence.username,
    presence.avatar_url,
    presence.joined_at,
    presence.left_at,
    presence.is_active,
    presence.gift_total,
    presence.seat_id,
    presence.role,
    presence.last_seen_at
  FROM public.stream_audience_presence AS presence
  WHERE
    NOT private.ghost_mode_is_active(presence.user_id)
    OR presence.user_id = auth.uid()
    OR public.is_ghost_mode_staff()
    OR public.has_active_mai_supreme_entitlement();
$$;
ALTER FUNCTION private.get_stream_audience_presence_public() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.get_stream_audience_presence_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_stream_audience_presence_public() TO anon, authenticated;

CREATE OR REPLACE VIEW public.stream_audience_presence_public
WITH (security_barrier = true, security_invoker = true)
AS
SELECT presence.id, presence.stream_id, presence.user_id, presence.username,
       presence.avatar_url, presence.joined_at, presence.left_at,
       presence.is_active, presence.gift_total, presence.seat_id,
       presence.role, presence.last_seen_at
FROM private.get_stream_audience_presence_public() AS presence;

REVOKE ALL ON public.stream_audience_presence_public FROM PUBLIC;
GRANT SELECT ON public.stream_audience_presence_public TO anon, authenticated;

CREATE OR REPLACE FUNCTION private.get_troll_wall_posts_public()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  is_admin boolean,
  is_troll_officer boolean,
  is_og_user boolean,
  user_created_at timestamptz,
  is_verified boolean,
  is_gold boolean,
  username_style text,
  badge text,
  officer_level integer,
  troller_level integer,
  is_troller boolean,
  is_pinned boolean,
  post_type text,
  content text,
  metadata jsonb,
  likes bigint,
  created_at timestamptz,
  reply_to_post_id uuid,
  deleted_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
SET row_security = off
AS $$
  SELECT
    p.id,
    p.user_id,
    identity.username,
    identity.avatar_url,
    up.is_admin,
    up.is_troll_officer,
    up.is_og_user,
    up.created_at,
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
  FROM public.troll_wall_posts AS p
  JOIN public.user_profiles AS up ON up.id = p.user_id
  JOIN private.get_user_profiles_public_identity() AS identity ON identity.id = p.user_id
  WHERE
    (
      p.privacy_mode = 'public'
      OR p.user_id = auth.uid()
      OR auth.uid() = ANY(p.selected_user_ids)
      OR public.is_ghost_mode_staff()
    )
    AND (
      NOT private.ghost_mode_is_active(p.user_id)
      OR p.user_id = auth.uid()
      OR public.is_ghost_mode_staff()
    )
    AND (p.deleted_at IS NULL OR public.is_admin(auth.uid()))
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_blocks AS b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = p.user_id)
         OR (b.blocker_id = p.user_id AND b.blocked_id = auth.uid())
    )
    AND (
      p.privacy_mode = 'public'
      OR p.user_id = auth.uid()
      OR public.is_ghost_mode_staff()
      OR private.ghost_mode_supreme_is_active(p.user_id)
    );
$$;
ALTER FUNCTION private.get_troll_wall_posts_public() OWNER TO postgres;
REVOKE ALL ON FUNCTION private.get_troll_wall_posts_public() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.get_troll_wall_posts_public() TO anon, authenticated;

CREATE OR REPLACE VIEW public.troll_wall_posts_public
WITH (security_barrier = true, security_invoker = true)
AS
SELECT posts.id, posts.user_id, posts.username, posts.avatar_url,
       posts.is_admin, posts.is_troll_officer, posts.is_og_user,
       posts.user_created_at, posts.is_verified, posts.is_gold,
       posts.username_style, posts.badge, posts.officer_level,
       posts.troller_level, posts.is_troller, posts.is_pinned,
       posts.post_type, posts.content, posts.metadata, posts.likes,
       posts.created_at, posts.reply_to_post_id, posts.deleted_at
FROM private.get_troll_wall_posts_public() AS posts;

REVOKE ALL ON public.troll_wall_posts_public FROM PUBLIC;
GRANT SELECT ON public.troll_wall_posts_public TO anon, authenticated;

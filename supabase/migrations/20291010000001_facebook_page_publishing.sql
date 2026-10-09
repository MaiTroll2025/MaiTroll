-- ============================================================
-- MAI TROLL — Facebook Page Auto-Publishing Integration
-- Migration: 20291010000001_facebook_page_publishing.sql
--
-- Additive Facebook schema, three Troll Wall opt-in columns, role
-- permission grants, and a data migration for the retired marketing role.
-- Existing announcement, auth, and RLS behavior is otherwise preserved.
-- ============================================================

-- ============================================================
-- PART 1: FACEBOOK PAGE CONNECTION
-- One row per Facebook Page Mai Troll has authorized.
-- A partial unique index guarantees at most ONE row can be in
-- the 'connected' state at any time (the official Mai Troll Page).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facebook_page_connections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id                 text NOT NULL,
  page_name               text NOT NULL,
  connection_status       text NOT NULL DEFAULT 'connected'
                            CHECK (connection_status IN ('connected', 'needs_attention', 'disconnected')),

  connected_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Global switch: publish qualifying Mai Troll content to the Page
  automatic_publishing    boolean NOT NULL DEFAULT false,

  -- Source-specific switches
  publish_announcements           boolean NOT NULL DEFAULT true,
  publish_featured_wall_posts     boolean NOT NULL DEFAULT true,
  auto_publish_general_wall_posts boolean NOT NULL DEFAULT false,

  granted_scopes          text[] NOT NULL DEFAULT '{}',
  graph_api_version       text NOT NULL,

  -- Never the token itself — only a non-reversible hint for the UI
  token_last4             text,
  token_expires_at        timestamptz,

  last_verified_at        timestamptz,
  last_error_category     text,
  last_error_message      text,

  disconnected_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  disconnected_at         timestamptz,

  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Only one Facebook Page may be connected at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_facebook_page_connections_single_active
  ON public.facebook_page_connections ((connection_status))
  WHERE connection_status = 'connected';

CREATE INDEX IF NOT EXISTS idx_facebook_page_connections_status
  ON public.facebook_page_connections (connection_status, updated_at DESC);

COMMENT ON TABLE public.facebook_page_connections IS
  'Authorized Facebook Page connections for Mai Troll automated publishing. Contains no secrets.';

-- ============================================================
-- PART 2: PAGE ACCESS TOKEN STORAGE (SERVER-ONLY)
-- RLS is enabled with ZERO policies on purpose:
--   * anon / authenticated requests can never read or write it
--   * only the service_role key used by Edge Functions can
-- Tokens are never returned to the browser by any code path.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facebook_page_credentials (
  connection_id   uuid PRIMARY KEY
                    REFERENCES public.facebook_page_connections(id) ON DELETE CASCADE,
  access_token    text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_page_credentials ENABLE ROW LEVEL SECURITY;

-- Deliberately no policies. service_role bypasses RLS.
COMMENT ON TABLE public.facebook_page_credentials IS
  'SECRET. Facebook Page access tokens. Service-role only: RLS enabled with no policies.';

-- OAuth state nonces are stored as hashes and consumed once by the callback.
CREATE TABLE IF NOT EXISTS public.facebook_oauth_states (
  nonce_hash  text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_facebook_oauth_states_expiry
  ON public.facebook_oauth_states (expires_at);
-- ============================================================
-- PART 3: PUBLISHING HISTORY / IDEMPOTENCY LEDGER
-- The unique index on (source_type, source_id, facebook_page_id)
-- IS the duplicate-protection mechanism. The publish Edge
-- Function inserts the row BEFORE calling Meta; a duplicate
-- click, refresh, retry or webhook can never create a second row
-- and therefore can never create a second Facebook post.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.facebook_publications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type         text NOT NULL
                        CHECK (source_type IN (
                          'announcement',
                          'admin_broadcast',
                          'wall_post',
                          'troll_post',
                          'stream',
                          'gaming_stream',
                          'podcast',
                          'court_session'
                        )),
  source_id           uuid NOT NULL,
  source_title        text,

  facebook_page_id    text NOT NULL,
  facebook_post_id    text,
  facebook_post_url   text,

  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'published', 'failed', 'retrying')),

  attempt_count       integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 3,

  -- Safe, categorised error surfaced to admins (never a token or stack)
  error_category      text,
  error_message       text,

  -- Snapshot of what was sent, for admin review. Contains only
  -- content that was already public, never internal data.
  payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
  image_attached      boolean NOT NULL DEFAULT false,
  image_skipped_reason text,

  last_attempt_at     timestamptz,
  next_retry_at       timestamptz,
  published_at        timestamptz,

  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- DUPLICATE PROTECTION: one publication record per source per Page.
CREATE UNIQUE INDEX IF NOT EXISTS uq_facebook_publications_source_page
  ON public.facebook_publications (source_type, source_id, facebook_page_id);

CREATE INDEX IF NOT EXISTS idx_facebook_publications_created
  ON public.facebook_publications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facebook_publications_status
  ON public.facebook_publications (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_facebook_publications_source
  ON public.facebook_publications (source_type, source_id);

COMMENT ON TABLE public.facebook_publications IS
  'Facebook publishing ledger. Unique on (source_type, source_id, facebook_page_id) for idempotent publishing.';

-- ============================================================
-- PART 4: updated_at MAINTENANCE
-- ============================================================

CREATE OR REPLACE FUNCTION public.touch_facebook_integration_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_facebook_page_connections_touch ON public.facebook_page_connections;
CREATE TRIGGER trg_facebook_page_connections_touch
  BEFORE UPDATE ON public.facebook_page_connections
  FOR EACH ROW EXECUTE FUNCTION public.touch_facebook_integration_updated_at();

DROP TRIGGER IF EXISTS trg_facebook_publications_touch ON public.facebook_publications;
CREATE TRIGGER trg_facebook_publications_touch
  BEFORE UPDATE ON public.facebook_publications
  FOR EACH ROW EXECUTE FUNCTION public.touch_facebook_integration_updated_at();

-- ============================================================
-- PART 5: SELF-CONTAINED ADMIN PREDICATE
-- Defined here rather than reusing is_admin() so this migration
-- cannot break if another migration is reordered. It does NOT
-- replace or modify is_admin() / is_admin_consolidated().
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        is_admin = true
        OR role IN ('admin', 'superadmin', 'ceo', 'owner')
        OR troll_role IN ('admin', 'superadmin', 'ceo', 'owner')
      )
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin(uuid) IS
  'Platform-admin check used by the Facebook publishing integration. Additive; does not replace is_admin().';

-- Convenience overload for the current JWT subject.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_platform_admin(auth.uid());
$$;

-- ============================================================
-- PART 6: ROW LEVEL SECURITY
-- Admin-only read. No client writes at all — every mutation goes
-- through a server-side Edge Function using the service role.
-- Never USING (true) / WITH CHECK (true).
-- ============================================================

ALTER TABLE public.facebook_page_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facebook_connections_admin_select" ON public.facebook_page_connections;
CREATE POLICY "facebook_connections_admin_select"
  ON public.facebook_page_connections
  FOR SELECT
  USING (public.is_platform_admin(auth.uid()));

ALTER TABLE public.facebook_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "facebook_publications_admin_select" ON public.facebook_publications;
CREATE POLICY "facebook_publications_admin_select"
  ON public.facebook_publications
  FOR SELECT
  USING (public.is_platform_admin(auth.uid()));
-- ============================================================
-- PART 7: TROLL WALL — FACEBOOK FEATURE OPT-IN
-- Additive columns only. Existing rows default to NOT featured,
-- so no Troll Wall post is ever published to Facebook unless an
-- administrator explicitly opts it in.
-- ============================================================

ALTER TABLE public.troll_wall_posts
  ADD COLUMN IF NOT EXISTS is_facebook_featured  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS facebook_featured_at  timestamptz,
  ADD COLUMN IF NOT EXISTS facebook_featured_by  uuid;

COMMENT ON COLUMN public.troll_wall_posts.is_facebook_featured IS
  'Admin opt-in allowing this Troll Wall post to be published to the official Mai Troll Facebook Page.';

CREATE INDEX IF NOT EXISTS idx_troll_wall_posts_facebook_featured
  ON public.troll_wall_posts (is_facebook_featured)
  WHERE is_facebook_featured = true;

-- ------------------------------------------------------------
-- Admin-only toggle.
--
-- The Troll Wall RLS allows a post owner to update their own row
-- (used by the existing Boost feature). A plain column update from
-- the browser would therefore let a user feature their OWN post on
-- the official Mai Troll Facebook Page. This SECURITY DEFINER RPC
-- is the only supported way to change the flag, and it verifies the
-- caller server-side before writing.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_wall_post_facebook_featured(
  p_post_id  uuid,
  p_featured boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_platform_admin(v_actor) THEN
    RAISE EXCEPTION 'Only administrators may feature Troll Wall posts on Facebook';
  END IF;

  UPDATE public.troll_wall_posts
     SET is_facebook_featured = COALESCE(p_featured, false),
         facebook_featured_at = CASE WHEN COALESCE(p_featured, false) THEN now() ELSE NULL END,
         facebook_featured_by = CASE WHEN COALESCE(p_featured, false) THEN v_actor ELSE NULL END
   WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Troll Wall post not found';
  END IF;

  RETURN COALESCE(p_featured, false);
END;
$$;

COMMENT ON FUNCTION public.set_wall_post_facebook_featured(uuid, boolean) IS
  'Admin-only opt-in/opt-out for publishing a Troll Wall post to the Mai Troll Facebook Page.';

REVOKE ALL ON FUNCTION public.set_wall_post_facebook_featured(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_wall_post_facebook_featured(uuid, boolean) TO authenticated;

-- ============================================================
-- PART 8: PERMISSION MATRIX SEED (reuses existing table)
-- ============================================================

-- The permission-matrix schema lives in a root-level SQL file rather
-- than Supabase's migration directory, so ensure it exists here too.
CREATE TABLE IF NOT EXISTS public.role_permission_matrix (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name   text NOT NULL,
  resource    text NOT NULL,
  permission  text NOT NULL DEFAULT 'allow',
  conditions  jsonb DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_name, resource)
);

CREATE INDEX IF NOT EXISTS idx_permission_role
  ON public.role_permission_matrix (role_name);
CREATE INDEX IF NOT EXISTS idx_permission_resource
  ON public.role_permission_matrix (resource);
CREATE INDEX IF NOT EXISTS idx_permission_role_resource
  ON public.role_permission_matrix (role_name, resource);

ALTER TABLE public.role_permission_matrix ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_permissions" ON public.role_permission_matrix;
CREATE POLICY "anyone_read_permissions" ON public.role_permission_matrix
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin_modify_permissions" ON public.role_permission_matrix;
CREATE POLICY "admin_modify_permissions" ON public.role_permission_matrix
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'superadmin', 'ceo'))
    )
  );

INSERT INTO public.role_permission_matrix (role_name, resource, permission) VALUES
  ('admin',      'page:/admin/integrations/facebook', 'allow'),
  ('admin',      'action:facebook_connect',           'allow'),
  ('admin',      'action:facebook_disconnect',        'allow'),
  ('admin',      'action:facebook_publish',           'allow'),
  ('admin',      'page:/admin/marketing',             'allow'),
  ('ceo',        'page:/admin/integrations/facebook', 'allow'),
  ('ceo',        'action:facebook_connect',           'allow'),
  ('ceo',        'action:facebook_disconnect',        'allow'),
  ('ceo',        'action:facebook_publish',           'allow'),
  ('ceo',        'page:/admin/marketing',             'allow'),
  ('secretary',  'page:/admin/marketing',             'allow'),
  ('secretary',  'action:facebook_publish',           'allow'),
  ('marketing_agent', 'page:/admin/marketing',         'allow'),
  ('marketing_agent', 'action:facebook_publish',      'allow'),
  ('ceo_assistant', 'page:/admin/marketing',           'allow'),
  ('ceo_assistant', 'action:facebook_publish',         'allow'),
  ('noah_assistant', 'page:/admin/marketing',          'allow'),
  ('noah_assistant', 'action:facebook_publish',       'allow')
ON CONFLICT (role_name, resource) DO UPDATE
  SET permission = EXCLUDED.permission;

-- Replace the retired read-only marketing role with the dedicated role.
UPDATE public.user_profiles
   SET role = 'marketing_agent'
 WHERE role = 'marketing_readonly';

UPDATE public.user_profiles
   SET troll_role = 'marketing_agent'
 WHERE troll_role = 'marketing_readonly';

DELETE FROM public.role_permission_matrix
 WHERE role_name = 'marketing_readonly';

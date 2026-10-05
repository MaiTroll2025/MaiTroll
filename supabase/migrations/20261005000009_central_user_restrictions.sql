BEGIN;

CREATE TABLE IF NOT EXISTS public.user_restrictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  restriction_type TEXT NOT NULL CHECK (restriction_type IN ('maipiks', 'chat', 'broadcast', 'podcast', 'hytrogames')),
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_username TEXT,
  actor_role TEXT,
  reason TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'moderation',
  source_report_id UUID REFERENCES public.moderation_reports(id) ON DELETE SET NULL,
  source_page TEXT NOT NULL DEFAULT 'RTCAdminMonitor',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_user_restrictions_target_type_expiry
  ON public.user_restrictions(target_user_id, restriction_type, expires_at DESC)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_user_restrictions_report
  ON public.user_restrictions(source_report_id)
  WHERE source_report_id IS NOT NULL;

ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_restrictions_read_self_or_staff" ON public.user_restrictions;
CREATE POLICY "user_restrictions_read_self_or_staff" ON public.user_restrictions
  FOR SELECT USING (
    auth.uid() = target_user_id
    OR public.can_review_maipiks_reports(auth.uid())
  );

GRANT SELECT ON public.user_restrictions TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.user_is_restricted(
  p_user_id UUID,
  p_restriction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_restrictions r
    WHERE r.target_user_id = p_user_id
      AND r.restriction_type = p_restriction_type
      AND r.status = 'active'
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
  );
$$;

REVOKE ALL ON FUNCTION public.user_is_restricted(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_is_restricted(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_user_restrictions(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  restriction_type TEXT,
  actor_id UUID,
  actor_username TEXT,
  actor_role TEXT,
  reason TEXT,
  source TEXT,
  source_report_id UUID,
  source_page TEXT,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  status TEXT,
  details JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := COALESCE(p_user_id, auth.uid());
BEGIN
  IF auth.uid() IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF v_user_id <> auth.uid() AND NOT public.can_review_maipiks_reports(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to view user restrictions';
  END IF;

  RETURN QUERY
  SELECT r.id, r.restriction_type, r.actor_id, r.actor_username, r.actor_role,
         r.reason, r.source, r.source_report_id, r.source_page, r.created_at,
         r.expires_at, r.status, r.details
  FROM public.user_restrictions r
  WHERE r.target_user_id = v_user_id
    AND r.status = 'active'
    AND (r.expires_at IS NULL OR r.expires_at > NOW())
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_restrictions(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_user_restriction(
  p_target_user_id UUID,
  p_restriction_type TEXT,
  p_reason TEXT,
  p_duration_minutes INTEGER DEFAULT 0,
  p_source_report_id UUID DEFAULT NULL,
  p_source_page TEXT DEFAULT 'RTCAdminMonitor',
  p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_actor_username TEXT;
  v_actor_role TEXT;
  v_target_username TEXT;
  v_expires_at TIMESTAMPTZ;
  v_restriction_id UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.can_review_maipiks_reports(v_actor) THEN
    RAISE EXCEPTION 'Not authorized to restrict users';
  END IF;
  IF p_restriction_type IS NULL OR p_restriction_type NOT IN ('maipiks', 'chat', 'broadcast', 'podcast', 'hytrogames') THEN
    RAISE EXCEPTION 'Invalid restriction type';
  END IF;
  IF p_reason IS NULL OR LENGTH(BTRIM(p_reason)) = 0 OR LENGTH(BTRIM(p_reason)) > 2000 THEN
    RAISE EXCEPTION 'A reason of 1 to 2000 characters is required';
  END IF;
  IF p_duration_minutes IS NULL OR p_duration_minutes < 0 OR p_duration_minutes > 525600 THEN
    RAISE EXCEPTION 'Duration must be zero (indefinite) or no more than one year';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = p_target_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  SELECT username, COALESCE(troll_role, role, 'user')
  INTO v_actor_username, v_actor_role
  FROM public.user_profiles WHERE id = v_actor;
  SELECT username INTO v_target_username
  FROM public.user_profiles WHERE id = p_target_user_id;
  v_expires_at := CASE WHEN p_duration_minutes = 0 THEN NULL
                       ELSE NOW() + make_interval(mins => p_duration_minutes) END;

  INSERT INTO public.user_restrictions (
    target_user_id, restriction_type, actor_id, actor_username, actor_role,
    reason, source, source_report_id, source_page, expires_at, details
  ) VALUES (
    p_target_user_id, p_restriction_type, v_actor, v_actor_username, v_actor_role,
    BTRIM(p_reason), 'moderation', p_source_report_id,
    COALESCE(NULLIF(BTRIM(p_source_page), ''), 'RTCAdminMonitor'), v_expires_at,
    COALESCE(p_details, '{}'::jsonb)
  ) RETURNING id INTO v_restriction_id;

  PERFORM public.modo_audit(
    p_restriction_type || '_restriction',
    INITCAP(p_restriction_type) || ' Restriction',
    v_actor, p_target_user_id, v_target_username, NULL, NULL,
    NULL, NULL, BTRIM(p_reason), p_duration_minutes,
    'allowed', 'restricted', v_expires_at, TRUE, NULL,
    jsonb_build_object('restriction_id', v_restriction_id,
                       'restriction_type', p_restriction_type,
                       'source_report_id', p_source_report_id,
                       'source_page', p_source_page,
                       'details', COALESCE(p_details, '{}'::jsonb))
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'restriction_id', v_restriction_id,
    'restriction_type', p_restriction_type,
    'expires_at', v_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_user_restriction(UUID, TEXT, TEXT, INTEGER, UUID, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_restriction(UUID, TEXT, TEXT, INTEGER, UUID, TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.revoke_user_restriction(
  p_restriction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_restriction public.user_restrictions%ROWTYPE;
  v_target_username TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.can_review_maipiks_reports(v_actor) THEN
    RAISE EXCEPTION 'Not authorized to remove restrictions';
  END IF;

  SELECT * INTO v_restriction
  FROM public.user_restrictions
  WHERE id = p_restriction_id AND status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active restriction not found';
  END IF;

  SELECT username INTO v_target_username FROM public.user_profiles WHERE id = v_restriction.target_user_id;
  UPDATE public.user_restrictions
  SET status = 'revoked', revoked_at = NOW(), revoked_by = v_actor,
      details = details || jsonb_build_object('revocation_reason', NULLIF(BTRIM(COALESCE(p_reason, '')), ''))
  WHERE id = p_restriction_id;

  PERFORM public.modo_audit(
    v_restriction.restriction_type || '_restriction_removed',
    INITCAP(v_restriction.restriction_type) || ' Restriction Removed',
    v_actor, v_restriction.target_user_id, v_target_username, NULL, NULL,
    NULL, NULL, COALESCE(NULLIF(BTRIM(p_reason), ''), 'Restriction removed'), NULL,
    'restricted', 'allowed', NULL, TRUE, NULL,
    jsonb_build_object('restriction_id', p_restriction_id,
                       'source_report_id', v_restriction.source_report_id)
  );

  RETURN jsonb_build_object('success', TRUE, 'restriction_id', p_restriction_id, 'status', 'revoked');
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_user_restriction(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_user_restriction(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_enforce_user_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_story_id UUID;
BEGIN
  IF TG_TABLE_NAME IN ('maipiks_posts', 'maipiks_stories') THEN
    v_user_id := NEW.user_id;
  ELSIF TG_TABLE_NAME = 'maipiks_story_items' THEN
    v_story_id := NEW.story_id;
    SELECT user_id INTO v_user_id FROM public.maipiks_stories WHERE id = v_story_id;
  ELSIF TG_TABLE_NAME = 'maipiks_story_tips' THEN
    v_user_id := NEW.tipper_user_id;
  END IF;

  IF public.user_is_restricted(v_user_id, 'maipiks') THEN
    RAISE EXCEPTION 'MAI Piks access is restricted';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_enforce_user_restriction() FROM PUBLIC;

DROP TRIGGER IF EXISTS maipiks_posts_restriction_guard ON public.maipiks_posts;
CREATE TRIGGER maipiks_posts_restriction_guard
  BEFORE INSERT OR UPDATE ON public.maipiks_posts
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_enforce_user_restriction();

DROP TRIGGER IF EXISTS maipiks_stories_restriction_guard ON public.maipiks_stories;
CREATE TRIGGER maipiks_stories_restriction_guard
  BEFORE INSERT OR UPDATE ON public.maipiks_stories
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_enforce_user_restriction();

DROP TRIGGER IF EXISTS maipiks_story_items_restriction_guard ON public.maipiks_story_items;
CREATE TRIGGER maipiks_story_items_restriction_guard
  BEFORE INSERT OR UPDATE ON public.maipiks_story_items
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_enforce_user_restriction();

DROP TRIGGER IF EXISTS maipiks_story_tips_restriction_guard ON public.maipiks_story_tips;
CREATE TRIGGER maipiks_story_tips_restriction_guard
  BEFORE INSERT ON public.maipiks_story_tips
  FOR EACH ROW EXECUTE FUNCTION public.maipiks_enforce_user_restriction();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.user_restrictions;
EXCEPTION WHEN duplicate_object THEN
  NULL;
WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication is not available; restriction changes will still persist';
END $$;

COMMIT;
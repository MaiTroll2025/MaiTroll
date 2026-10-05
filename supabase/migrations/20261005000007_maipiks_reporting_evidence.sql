BEGIN;

ALTER TABLE public.moderation_reports
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS report_category TEXT,
  ADD COLUMN IF NOT EXISTS maipiks_story_id UUID,
  ADD COLUMN IF NOT EXISTS maipiks_story_item_id UUID,
  ADD COLUMN IF NOT EXISTS maipiks_media_reference TEXT,
  ADD COLUMN IF NOT EXISTS maipiks_evidence_path TEXT,
  ADD COLUMN IF NOT EXISTS reporter_username TEXT,
  ADD COLUMN IF NOT EXISTS target_username TEXT;

CREATE INDEX IF NOT EXISTS idx_moderation_reports_maipiks_status
  ON public.moderation_reports(status, created_at DESC)
  WHERE content_type = 'mai_piks';

CREATE OR REPLACE FUNCTION public.can_review_maipiks_reports(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.is_admin_user(p_user_id), FALSE)
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles p
      WHERE p.id = p_user_id
        AND (
          p.is_lead_officer = TRUE
          OR LOWER(COALESCE(p.role, '')) = 'lead_troll_officer'
          OR LOWER(COALESCE(p.troll_role, '')) = 'lead_troll_officer'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_review_maipiks_reports(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_review_maipiks_reports(UUID) TO authenticated, service_role;

DROP POLICY IF EXISTS "maipiks_moderation_evidence_read" ON storage.objects;
CREATE POLICY "maipiks_moderation_evidence_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'maipiks'
    AND name LIKE 'moderation-evidence/%'
    AND public.can_review_maipiks_reports(auth.uid())
  );

CREATE OR REPLACE FUNCTION public.maipiks_preserve_report_evidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.bucket_id = 'maipiks'
    AND OLD.name LIKE 'moderation-evidence/%'
    AND EXISTS (
      SELECT 1 FROM public.moderation_reports r
      WHERE r.content_type = 'mai_piks'
        AND r.maipiks_evidence_path = OLD.name
    ) THEN
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_preserve_report_evidence() FROM PUBLIC;

DROP TRIGGER IF EXISTS maipiks_preserve_report_evidence ON storage.objects;
CREATE TRIGGER maipiks_preserve_report_evidence
  BEFORE DELETE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.maipiks_preserve_report_evidence();

CREATE OR REPLACE FUNCTION public.submit_maipiks_report(
  p_story_item_id UUID,
  p_category TEXT,
  p_description TEXT,
  p_evidence_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter UUID := auth.uid();
  v_story_id UUID;
  v_owner_id UUID;
  v_owner_username TEXT;
  v_reporter_username TEXT;
  v_storage_path TEXT;
  v_report_id UUID;
  v_existing UUID;
  v_access JSONB;
BEGIN
  IF v_reporter IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('minor_harmful', 'harmful_dangerous', 'weapons', 'other_safety_violation') THEN
    RAISE EXCEPTION 'Invalid Mai Piks report category';
  END IF;
  IF p_description IS NOT NULL AND LENGTH(BTRIM(p_description)) > 2000 THEN
    RAISE EXCEPTION 'Description must be 2000 characters or fewer';
  END IF;

  SELECT i.story_id, s.user_id, i.storage_path
  INTO v_story_id, v_owner_id, v_storage_path
  FROM public.maipiks_story_items i
  JOIN public.maipiks_stories s ON s.id = i.story_id
  WHERE i.id = p_story_item_id
    AND i.deleted_at IS NULL
    AND i.expires_at > NOW()
    AND s.deleted_at IS NULL
    AND s.expires_at > NOW();

  IF v_story_id IS NULL THEN
    RAISE EXCEPTION 'Story media is unavailable';
  END IF;
  IF v_owner_id = v_reporter THEN
    RAISE EXCEPTION 'You cannot report your own story';
  END IF;

  v_access := public.maipiks_story_pricing(v_story_id);
  IF NOT COALESCE((v_access->>'has_access')::BOOLEAN, FALSE) THEN
    RAISE EXCEPTION 'You must have access to report this story';
  END IF;

  IF p_evidence_path IS NULL
    OR LEFT(p_evidence_path, LENGTH('moderation-evidence/' || v_reporter::TEXT || '/'))
      <> 'moderation-evidence/' || v_reporter::TEXT || '/' THEN
    RAISE EXCEPTION 'Invalid evidence reference';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects
    WHERE bucket_id = 'maipiks' AND name = p_evidence_path
  ) THEN
    RAISE EXCEPTION 'Moderation evidence was not preserved';
  END IF;

  SELECT id INTO v_existing
  FROM public.moderation_reports
  WHERE reporter_id = v_reporter
    AND content_type = 'mai_piks'
    AND maipiks_story_item_id = p_story_item_id
    AND status IN ('pending', 'reviewing')
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'You already reported this story item';
  END IF;

  SELECT username INTO v_owner_username FROM public.user_profiles WHERE id = v_owner_id;
  SELECT username INTO v_reporter_username FROM public.user_profiles WHERE id = v_reporter;

  INSERT INTO public.moderation_reports (
    reporter_id, target_user_id, stream_id, report_reason, report_details, status,
    created_at, updated_at, content_type, report_category, maipiks_story_id,
    maipiks_story_item_id, maipiks_media_reference, maipiks_evidence_path,
    reporter_username, target_username
  ) VALUES (
    v_reporter, v_owner_id, NULL, 'MAI Piks safety report: ' || p_category,
    NULLIF(BTRIM(COALESCE(p_description, '')), ''), 'pending', NOW(), NOW(),
    'mai_piks', p_category, v_story_id, p_story_item_id, v_storage_path,
    p_evidence_path, v_reporter_username, v_owner_username
  ) RETURNING id INTO v_report_id;

  RETURN jsonb_build_object('success', TRUE, 'report_id', v_report_id);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_maipiks_report(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_maipiks_report(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_list_reports(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
  report_id UUID,
  reporter_id UUID,
  reporter_username TEXT,
  target_user_id UUID,
  target_username TEXT,
  story_id UUID,
  story_item_id UUID,
  report_category TEXT,
  report_details TEXT,
  evidence_path TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_review_maipiks_reports(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to review Mai Piks reports';
  END IF;

  RETURN QUERY
  SELECT r.id, r.reporter_id, r.reporter_username, r.target_user_id,
         r.target_username, r.maipiks_story_id, r.maipiks_story_item_id,
         r.report_category, r.report_details, r.maipiks_evidence_path,
         r.status, r.created_at, r.resolved_by, r.resolved_at
  FROM public.moderation_reports r
  WHERE r.content_type = 'mai_piks'
    AND (p_status IS NULL OR r.status = p_status)
  ORDER BY r.created_at DESC
  LIMIT 200;
END;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_list_reports(TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.maipiks_resolve_report(
  p_report_id UUID,
  p_decision TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
  v_report public.moderation_reports%ROWTYPE;
  v_next_status TEXT;
  v_previous_status TEXT;
  v_media_path TEXT;
  v_items_left INTEGER;
BEGIN
  IF v_actor IS NULL OR NOT public.can_review_maipiks_reports(v_actor) THEN
    RAISE EXCEPTION 'Not authorized to resolve Mai Piks reports';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('reviewing', 'resolved', 'rejected', 'remove') THEN
    RAISE EXCEPTION 'Invalid report decision';
  END IF;

  SELECT * INTO v_report
  FROM public.moderation_reports
  WHERE id = p_report_id AND content_type = 'mai_piks'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Mai Piks report not found';
  END IF;

  v_previous_status := v_report.status;
  v_next_status := CASE p_decision WHEN 'remove' THEN 'action_taken' ELSE p_decision END;

  IF p_decision = 'remove' THEN
    SELECT storage_path INTO v_media_path
    FROM public.maipiks_story_items
    WHERE id = v_report.maipiks_story_item_id;

    DELETE FROM public.maipiks_story_items
    WHERE id = v_report.maipiks_story_item_id;

    IF v_media_path IS NOT NULL THEN
      DELETE FROM storage.objects
      WHERE bucket_id = 'maipiks' AND name = v_media_path;
    END IF;

    SELECT COUNT(*) INTO v_items_left
    FROM public.maipiks_story_items
    WHERE story_id = v_report.maipiks_story_id;
    IF v_items_left = 0 THEN
      DELETE FROM public.maipiks_stories WHERE id = v_report.maipiks_story_id;
    END IF;
  END IF;

  UPDATE public.moderation_reports
  SET status = v_next_status,
      resolved_by = CASE WHEN v_next_status IN ('resolved', 'rejected', 'action_taken') THEN v_actor ELSE resolved_by END,
      resolved_at = CASE WHEN v_next_status IN ('resolved', 'rejected', 'action_taken') THEN NOW() ELSE resolved_at END,
      updated_at = NOW()
  WHERE id = p_report_id;

  PERFORM public.modo_audit(
    'maipiks_report_' || p_decision,
    CASE p_decision WHEN 'remove' THEN 'Remove Mai Piks Content' ELSE 'Update Mai Piks Report' END,
    v_actor, v_report.target_user_id, v_report.target_username, NULL, NULL,
    NULL, NULL, COALESCE(p_reason, v_report.report_reason), NULL,
    v_previous_status, v_next_status, NULL, TRUE, NULL,
    jsonb_build_object('report_id', p_report_id, 'story_id', v_report.maipiks_story_id,
                       'story_item_id', v_report.maipiks_story_item_id,
                       'evidence_path', v_report.maipiks_evidence_path)
  );

  RETURN jsonb_build_object('success', TRUE, 'report_id', p_report_id, 'status', v_next_status);
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_resolve_report(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.maipiks_resolve_report(UUID, TEXT, TEXT) TO authenticated, service_role;

COMMIT;
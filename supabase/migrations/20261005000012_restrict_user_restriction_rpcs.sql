BEGIN;

CREATE OR REPLACE FUNCTION public.user_is_restricted(
  p_user_id UUID,
  p_restriction_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user ID is required';
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid()
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT COALESCE(public.can_review_maipiks_reports(auth.uid()), FALSE) THEN
    RAISE EXCEPTION 'Not authorized to inspect user restrictions';
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.user_restrictions r
    WHERE r.target_user_id = p_user_id
      AND r.restriction_type = p_restriction_type
      AND r.status = 'active'
      AND (r.expires_at IS NULL OR r.expires_at > NOW())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.user_is_restricted(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_is_restricted(UUID, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_user_chat_restriction(
  p_user_id UUID,
  p_stream_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jail RECORD;
  v_block RECORD;
  v_mute RECORD;
  v_restriction RECORD;
  v_global_restriction RECORD;
  v_result JSONB := jsonb_build_object('restricted', false, 'reasons', ARRAY[]::TEXT[]);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'A user ID is required';
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid()
     AND COALESCE(auth.role(), '') <> 'service_role'
     AND NOT COALESCE(public.can_review_maipiks_reports(auth.uid()), FALSE) THEN
    RAISE EXCEPTION 'Not authorized to inspect user restrictions';
  END IF;

  IF public.user_is_restricted(p_user_id, 'chat') THEN
    SELECT * INTO v_global_restriction
    FROM public.user_restrictions
    WHERE target_user_id = p_user_id
      AND restriction_type = 'chat'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY expires_at DESC NULLS FIRST
    LIMIT 1;

    RETURN jsonb_build_object(
      'restricted', TRUE,
      'reasons', ARRAY['global_chat_restricted'],
      'restriction', jsonb_build_object(
        'id', v_global_restriction.id,
        'reason', v_global_restriction.reason,
        'expires_at', v_global_restriction.expires_at,
        'source_report_id', v_global_restriction.source_report_id
      )
    );
  END IF;

  SELECT * INTO v_jail
  FROM public.jail
  WHERE user_id = p_user_id AND status = 'jailed' AND scheduled_release_at > NOW()
  ORDER BY jailed_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('restricted', TRUE, 'reasons', ARRAY['jailed'],
      'jail', jsonb_build_object('jail_id', v_jail.id, 'discipline_level', v_jail.discipline_level,
        'scheduled_release_at', v_jail.scheduled_release_at, 'bond_amount', v_jail.bond_amount,
        'bond_allowed', v_jail.bond_allowed, 'reason', v_jail.reason));
  END IF;

  IF p_stream_id IS NOT NULL THEN
    SELECT * INTO v_block FROM public.chat_blocks
    WHERE user_id = p_user_id AND (stream_id = p_stream_id OR stream_id IS NULL)
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY stream_id NULLS LAST, created_at DESC LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('restricted', TRUE, 'reasons', ARRAY['chat_blocked'],
        'chat_block', jsonb_build_object('expires_at', v_block.expires_at,
          'is_permanent', v_block.is_permanent, 'reason', v_block.reason));
    END IF;

    SELECT * INTO v_mute FROM public.stream_mutes
    WHERE user_id = p_user_id AND stream_id = p_stream_id
      AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('restricted', TRUE, 'reasons', ARRAY['muted'],
        'mute', jsonb_build_object('expires_at', v_mute.expires_at, 'reason', v_mute.reason));
    END IF;

    SELECT * INTO v_restriction FROM public.broadcast_restrictions
    WHERE user_id = p_user_id AND (stream_id = p_stream_id OR stream_id IS NULL)
      AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('restricted', TRUE, 'reasons', ARRAY['broadcast_restricted'],
        'broadcast_restriction', jsonb_build_object('expires_at', v_restriction.expires_at,
          'chat_disabled', v_restriction.chat_disabled));
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.check_user_chat_restriction(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_user_chat_restriction(UUID, UUID) TO authenticated, service_role;

COMMIT;

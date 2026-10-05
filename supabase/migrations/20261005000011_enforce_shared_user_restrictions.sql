BEGIN;

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

GRANT EXECUTE ON FUNCTION public.check_user_chat_restriction(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.guard_shared_user_restriction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_category TEXT;
  v_stream_is_live BOOLEAN := FALSE;
BEGIN
  IF TG_TABLE_NAME = 'stream_messages' THEN
    v_user_id := NEW.user_id;
    IF public.user_is_restricted(v_user_id, 'chat') THEN
      RAISE EXCEPTION 'Chat is restricted';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'streams' THEN
    v_user_id := COALESCE(NEW.user_id, NEW.broadcaster_id);
    v_category := LOWER(COALESCE(NEW.category, ''));
    v_stream_is_live := COALESCE(NEW.is_live, FALSE) OR LOWER(COALESCE(NEW.status, '')) IN ('live', 'active');
    IF TG_OP = 'UPDATE' AND NOT v_stream_is_live THEN
      RETURN NEW;
    END IF;
    IF v_stream_is_live AND public.user_is_restricted(v_user_id, 'broadcast') THEN
      RAISE EXCEPTION 'Broadcasting is restricted';
    END IF;
    IF v_stream_is_live AND v_category IN ('hytro', 'hytrogames', 'hytro_games')
      AND public.user_is_restricted(v_user_id, 'hytrogames') THEN
      RAISE EXCEPTION 'HytroGames streaming is restricted';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'podcasts' THEN
    v_user_id := NEW.host_user_id;
    IF LOWER(COALESCE(NEW.status, '')) IN ('live', 'active')
      AND public.user_is_restricted(v_user_id, 'podcast') THEN
      RAISE EXCEPTION 'Podcast creation is restricted';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_shared_user_restriction() FROM PUBLIC;

DROP TRIGGER IF EXISTS shared_restriction_stream_messages_guard ON public.stream_messages;
CREATE TRIGGER shared_restriction_stream_messages_guard
  BEFORE INSERT ON public.stream_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_shared_user_restriction();

DROP TRIGGER IF EXISTS shared_restriction_streams_guard ON public.streams;
CREATE TRIGGER shared_restriction_streams_guard
  BEFORE INSERT OR UPDATE OF is_live, status ON public.streams
  FOR EACH ROW EXECUTE FUNCTION public.guard_shared_user_restriction();

DO $$
BEGIN
  IF to_regclass('public.podcasts') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS shared_restriction_podcasts_guard ON public.podcasts;
    CREATE TRIGGER shared_restriction_podcasts_guard
      BEFORE INSERT OR UPDATE OF status ON public.podcasts
      FOR EACH ROW EXECUTE FUNCTION public.guard_shared_user_restriction();
  END IF;
END $$;

COMMIT;
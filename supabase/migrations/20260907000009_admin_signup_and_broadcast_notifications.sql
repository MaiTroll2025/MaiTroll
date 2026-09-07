-- Notify staff through the existing in-app/push notification pipeline.

CREATE OR REPLACE FUNCTION public.trigger_notify_admin_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_staff(
    'user_signup',
    'New User Signup',
    '@' || COALESCE(NULLIF(NEW.username, ''), 'New user') || ' just joined MaiTroll.',
    jsonb_build_object(
      'user_id', NEW.id,
      'username', NEW.username,
      'route', '/admin/users'
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_signup ON public.user_profiles;
CREATE TRIGGER trg_notify_admin_signup
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_signup();

CREATE OR REPLACE FUNCTION public.trigger_notify_admin_broadcast_started()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username text;
BEGIN
  IF (NEW.status = 'live' OR NEW.is_live = true) AND COALESCE(NEW.is_public, true) = true THEN
    SELECT COALESCE(NULLIF(username, ''), 'Broadcaster')
      INTO v_username
      FROM public.user_profiles
      WHERE id = COALESCE(NEW.user_id, NEW.broadcaster_id);

    PERFORM public.notify_staff(
      'broadcast_started',
      'Broadcast Started',
      '@' || COALESCE(v_username, 'Broadcaster') || ' started a public broadcast.',
      jsonb_build_object(
        'stream_id', NEW.id,
        'username', v_username,
        'title', NEW.title,
        'route', '/watch/' || NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_broadcast_started ON public.streams;
DROP TRIGGER IF EXISTS trg_notify_admin_broadcast_started_update ON public.streams;
CREATE TRIGGER trg_notify_admin_broadcast_started
  AFTER INSERT ON public.streams
  FOR EACH ROW
  WHEN (NEW.status = 'live' OR NEW.is_live = true)
  EXECUTE FUNCTION public.trigger_notify_admin_broadcast_started();

CREATE TRIGGER trg_notify_admin_broadcast_started_update
  AFTER UPDATE OF status, is_live ON public.streams
  FOR EACH ROW
  WHEN (
    (NEW.status = 'live' OR NEW.is_live = true)
    AND OLD.status IS DISTINCT FROM 'live'
    AND COALESCE(OLD.is_live, false) IS DISTINCT FROM true
  )
  EXECUTE FUNCTION public.trigger_notify_admin_broadcast_started();
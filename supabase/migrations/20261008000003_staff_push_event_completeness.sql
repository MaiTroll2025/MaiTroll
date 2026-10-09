BEGIN;

CREATE OR REPLACE FUNCTION public.notify_staff_of_job_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username text;
BEGIN
  SELECT NULLIF(username, '')
    INTO v_username
    FROM public.user_profiles
   WHERE id = NEW.user_id;

  PERFORM public.notify_staff(
    'career_application_submitted',
    'New Job Application',
    '@' || COALESCE(v_username, 'A user') || ' submitted a job application.',
    jsonb_build_object(
      'application_id', NEW.id,
      'applicant_id', NEW.user_id,
      'applicant_username', v_username,
      'position_id', NEW.position_id,
      'route', '/admin/applications'
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_staff_of_job_application() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_notify_staff_job_application ON public.job_applications;
CREATE TRIGGER trg_notify_staff_job_application
  AFTER INSERT ON public.job_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_of_job_application();

CREATE OR REPLACE FUNCTION public.notify_staff_of_broadcast_start()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_broadcaster_id uuid;
  v_username text;
BEGIN
  v_broadcaster_id := COALESCE(NEW.user_id, NEW.broadcaster_id);

  SELECT NULLIF(username, '')
    INTO v_username
    FROM public.user_profiles
   WHERE id = v_broadcaster_id;

  PERFORM public.notify_staff(
    'stream_live',
    'Broadcast Started',
    '@' || COALESCE(v_username, 'Broadcaster') || ' started a broadcast: "' ||
      COALESCE(NULLIF(NEW.title, ''), 'Untitled broadcast') || '".',
    jsonb_build_object(
      'stream_id', NEW.id,
      'broadcaster_id', v_broadcaster_id,
      'username', v_username,
      'title', NEW.title,
      'route', '/watch/' || NEW.id
    )
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_staff_of_broadcast_start() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_notify_admin_broadcast_started ON public.streams;
DROP TRIGGER IF EXISTS trg_notify_admin_broadcast_started_update ON public.streams;
DROP TRIGGER IF EXISTS trg_notify_staff_broadcast_started ON public.streams;
DROP TRIGGER IF EXISTS trg_notify_staff_broadcast_started_update ON public.streams;

CREATE TRIGGER trg_notify_staff_broadcast_started
  AFTER INSERT ON public.streams
  FOR EACH ROW
  WHEN (
    (NEW.status = 'live' OR NEW.is_live IS TRUE)
  )
  EXECUTE FUNCTION public.notify_staff_of_broadcast_start();

CREATE TRIGGER trg_notify_staff_broadcast_started_update
  AFTER UPDATE OF status, is_live ON public.streams
  FOR EACH ROW
  WHEN (
    (NEW.status = 'live' OR NEW.is_live IS TRUE)
    AND OLD.status IS DISTINCT FROM 'live'
    AND COALESCE(OLD.is_live, false) IS DISTINCT FROM true
  )
  EXECUTE FUNCTION public.notify_staff_of_broadcast_start();

COMMIT;

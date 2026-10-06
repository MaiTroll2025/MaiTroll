CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.dispatch_notification_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net
AS $$
DECLARE
  v_url text;
  v_token text;
  v_apikey text;
BEGIN
  IF NEW.metadata->>'source' = 'global_ticker' THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
    INTO v_url
    FROM vault.decrypted_secrets
   WHERE name = 'notification_push_dispatch_url'
   LIMIT 1;

  SELECT decrypted_secret
    INTO v_token
    FROM vault.decrypted_secrets
   WHERE name = 'notification_push_dispatch_token'
   LIMIT 1;

  SELECT decrypted_secret
    INTO v_apikey
    FROM vault.decrypted_secrets
   WHERE name = 'notification_push_dispatch_apikey'
   LIMIT 1;

  IF COALESCE(v_url, '') = '' OR COALESCE(v_token, '') = '' OR COALESCE(v_apikey, '') = '' THEN
    RAISE WARNING 'Push dispatch secrets are missing; notification % remains in-app only', NEW.id;
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_token,
      'apikey', v_apikey,
      'x-notification-push-token', v_token
    ),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.dispatch_notification_push() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_dispatch_notification_push ON public.notifications;
CREATE TRIGGER trg_dispatch_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.dispatch_notification_push();

CREATE OR REPLACE FUNCTION public.notify_staff(
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metadata jsonb := COALESCE(p_metadata, '{}'::jsonb);
  v_link text := NULLIF(v_metadata->>'route', '');
  v_admin_only boolean :=
    p_type IN ('coin_purchase_admin_alert', 'new_user_signup', 'user_signup')
    OR (p_type = 'moderation_action' AND v_metadata->>'audience' = 'admin');
BEGIN
  INSERT INTO public.notifications (
    user_id,
    sender_id,
    type,
    title,
    message,
    link,
    metadata,
    is_read,
    read_at,
    created_at,
    updated_at,
    is_dismissed,
    dismissed_at,
    data
  )
  SELECT
    up.id,
    NULL,
    p_type,
    p_title,
    p_message,
    v_link,
    v_metadata,
    false,
    NULL,
    now(),
    now(),
    false,
    NULL,
    v_metadata
  FROM public.user_profiles up
  WHERE
    (
      up.is_admin = true
      OR up.is_super_admin = true
      OR up.is_ceo = true
      OR up.role IN ('admin', 'superadmin', 'owner', 'ceo')
    )
    OR (
      NOT v_admin_only
      AND (
        up.is_staff = true
        OR up.is_troll_officer = true
        OR up.is_lead_officer = true
        OR up.is_secretary = true
        OR up.is_attorney = true
        OR up.is_prosecutor = true
        OR lower(COALESCE(up.role::text, '')) IN (
          'lead_troll_officer', 'troll_officer', 'moderator', 'staff', 'secretary',
          'executive_secretary', 'troll_city_secretary', 'agency_hr', 'agency_hr_manager',
          'agency_leader', 'ceo_assistant', 'noah_assistant', 'hr_admin',
          'marketing_readonly', 'academy_director', 'prosecutor', 'attorney'
        )
        OR EXISTS (
          SELECT 1
          FROM public.employee_records er
          WHERE er.user_id = up.id
            AND er.employment_status = 'active'
        )
      )
    );
END;
$$;
ALTER FUNCTION public.notify_staff(text, text, text, jsonb) OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_notify_admin_broadcast_started ON public.streams;
DROP TRIGGER IF EXISTS trg_notify_admin_broadcast_started_update ON public.streams;

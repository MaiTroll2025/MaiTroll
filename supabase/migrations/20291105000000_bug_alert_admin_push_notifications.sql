CREATE OR REPLACE FUNCTION public.notify_admin_bug_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_message text := left(
    concat_ws(
      ' - ',
      NULLIF(trim(NEW.description), ''),
      NULLIF(trim(NEW.error_message), '')
    ),
    500
  );
BEGIN
  PERFORM public.notify_staff(
    'moderation_action',
    'Bug Catcher: ' || COALESCE(NULLIF(NEW.title, ''), 'New error'),
    COALESCE(NULLIF(v_message, ''), 'A new Bug Catcher alert needs review.'),
    jsonb_build_object(
      'audience', 'admin',
      'tab_key', 'system-errors',
      'entity_id', NEW.id::text,
      'route', '/rtcadminmonitor',
      'source', 'bug_catcher',
      'bug_alert_id', NEW.id,
      'category', NEW.category,
      'severity', COALESCE(NEW.severity, 'info'),
      'priority', CASE
        WHEN NEW.severity IN ('critical', 'high') THEN 'critical'
        ELSE 'normal'
      END
    )
  );

  RETURN NEW;
END;
$$;
ALTER FUNCTION public.notify_admin_bug_alert() OWNER TO postgres;

DROP TRIGGER IF EXISTS trg_notify_admin_bug_alert ON public.bug_alerts;
CREATE TRIGGER trg_notify_admin_bug_alert
  AFTER INSERT ON public.bug_alerts
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION public.notify_admin_bug_alert();

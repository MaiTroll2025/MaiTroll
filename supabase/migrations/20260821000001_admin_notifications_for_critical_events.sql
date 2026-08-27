-- ============================================================================
-- Migration: Admin Notifications for Critical Events
-- Purpose: Ensure admins get in-app + push notifications for:
--   - User arrests
--   - Court cases opened
--   - Stream kicks/bans
--   - Reports filed
--   - Coin purchases (admin alert)
-- ============================================================================

-- 1. Notify staff when a user is arrested (new jail record created)
CREATE OR REPLACE FUNCTION public.trigger_notify_admin_arrest()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_arrested_username TEXT;
  v_arrested_by_username TEXT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'Unknown') INTO v_arrested_username
  FROM public.user_profiles WHERE id = NEW.user_id;

  SELECT COALESCE(NULLIF(username, ''), 'Staff') INTO v_arrested_by_username
  FROM public.user_profiles WHERE id = NEW.arrested_by;

  PERFORM public.notify_staff(
    'user_arrested',
    'User Arrested',
    COALESCE(v_arrested_username, 'User') || ' was arrested by ' || COALESCE(v_arrested_by_username, 'Staff') ||
    '. Reason: ' || COALESCE(NEW.reason, 'No reason provided') || '. Severity: ' || COALESCE(NEW.severity, 'unknown'),
    jsonb_build_object(
      'arrested_user_id', NEW.user_id,
      'arrested_username', v_arrested_username,
      'arrested_by', NEW.arrested_by,
      'reason', NEW.reason,
      'severity', NEW.severity,
      'court_date', NEW.court_date,
      'jail_id', NEW.id,
      'route', '/jail'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_arrest ON public.jail;
CREATE TRIGGER trg_notify_admin_arrest
  AFTER INSERT ON public.jail
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_arrest();


-- 2. Notify staff when a court case is opened
CREATE OR REPLACE FUNCTION public.trigger_notify_admin_court_case()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_defendant_username TEXT;
  v_plaintiff_username TEXT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'Unknown') INTO v_defendant_username
  FROM public.user_profiles WHERE id = NEW.defendant_id;

  SELECT COALESCE(NULLIF(username, ''), 'Staff') INTO v_plaintiff_username
  FROM public.user_profiles WHERE id = NEW.plaintiff_id;

  PERFORM public.notify_staff(
    'court_started',
    'Court Case Opened',
    'Case opened for @' || COALESCE(v_defendant_username, 'Unknown') ||
    '. Plaintiff: @' || COALESCE(v_plaintiff_username, 'Staff') ||
    '. Reason: ' || COALESCE(NEW.reason, 'No reason provided'),
    jsonb_build_object(
      'case_id', NEW.id,
      'docket_id', NEW.docket_id,
      'defendant_id', NEW.defendant_id,
      'defendant_username', v_defendant_username,
      'plaintiff_id', NEW.plaintiff_id,
      'reason', NEW.reason,
      'status', NEW.status,
      'case_type', NEW.case_type,
      'route', '/court'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_court_case ON public.court_cases;
CREATE TRIGGER trg_notify_admin_court_case
  AFTER INSERT ON public.court_cases
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_court_case();


-- 3. Notify staff when a moderation report is filed
CREATE OR REPLACE FUNCTION public.trigger_notify_admin_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reporter_username TEXT;
  v_target_username TEXT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'Unknown') INTO v_reporter_username
  FROM public.user_profiles WHERE id = NEW.reporter_id;

  SELECT COALESCE(NULLIF(username, ''), 'Unknown') INTO v_target_username
  FROM public.user_profiles WHERE id = NEW.target_user_id;

  PERFORM public.notify_staff(
    'report_filed',
    'New Moderation Report',
    '@' || COALESCE(v_reporter_username, 'Unknown') || ' reported @' || COALESCE(v_target_username, 'Unknown') ||
    ': ' || COALESCE(NEW.reason, 'No reason provided'),
    jsonb_build_object(
      'report_id', NEW.id,
      'reporter_id', NEW.reporter_id,
      'reporter_username', v_reporter_username,
      'target_user_id', NEW.target_user_id,
      'target_username', v_target_username,
      'reason', NEW.reason,
      'severity', NEW.severity,
      'stream_id', NEW.stream_id,
      'route', '/admin/reports'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_report ON public.moderation_reports;
CREATE TRIGGER trg_notify_admin_report
  AFTER INSERT ON public.moderation_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_report();


-- 4. Notify staff when a user is kicked from a stream seat
-- (Enhance existing trigger to also send to broader staff)
CREATE OR REPLACE FUNCTION public.trigger_notify_admin_stream_kick()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kicked_username TEXT;
  v_stream_title TEXT;
BEGIN
  IF NEW.status = 'kicked' AND OLD.status != 'kicked' THEN
    SELECT COALESCE(NULLIF(username, ''), 'User') INTO v_kicked_username
    FROM public.user_profiles WHERE id = NEW.user_id;

    SELECT COALESCE(NULLIF(title, ''), 'Untitled Stream') INTO v_stream_title
    FROM public.streams WHERE id = NEW.stream_id;

    PERFORM public.notify_staff(
      'user_kicked',
      'User Kicked from Stream',
      COALESCE(v_kicked_username, 'User') || ' was kicked from "' || v_stream_title || '"',
      jsonb_build_object(
        'stream_id', NEW.stream_id,
        'user_id', NEW.user_id,
        'kicked_username', v_kicked_username,
        'stream_title', v_stream_title,
        'route', '/watch/' || NEW.stream_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_stream_kick ON public.stream_seat_sessions;
CREATE TRIGGER trg_notify_admin_stream_kick
  AFTER UPDATE ON public.stream_seat_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_notify_admin_stream_kick();


-- 5. Notify staff on large coin purchases (from coin store)
CREATE OR REPLACE FUNCTION public.trigger_notify_admin_coin_purchase()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer_username TEXT;
  v_order_id TEXT;
BEGIN
  SELECT COALESCE(NULLIF(username, ''), 'User') INTO v_buyer_username
  FROM public.user_profiles WHERE id = NEW.user_id;

  v_order_id := NEW.metadata->>'order_id';

  PERFORM public.notify_staff(
    'coin_purchase_admin_alert',
    'Coin Purchase Alert',
    COALESCE(v_buyer_username, 'User') || ' purchased coins. Amount: ' || NEW.amount ||
    '. Order: ' || COALESCE(v_order_id, 'N/A'),
    jsonb_build_object(
      'user_id', NEW.user_id,
      'username', v_buyer_username,
      'amount', NEW.amount,
      'order_id', v_order_id,
      'route', '/admin/payments'
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admin_coin_purchase ON public.coin_transactions;
CREATE TRIGGER trg_notify_admin_coin_purchase
  AFTER INSERT ON public.coin_transactions
  FOR EACH ROW
  WHEN (NEW.type = 'coin_purchase' OR NEW.type = 'purchase')
  EXECUTE FUNCTION public.trigger_notify_admin_coin_purchase();

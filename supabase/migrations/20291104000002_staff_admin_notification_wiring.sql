-- Staff/admin notifications are delivered through the existing notifications
-- table. These columns make the event's destination and lifecycle explicit
-- without creating a second notification system.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS tab_key text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'database',
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS is_dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_notifications_staff_unread_tab
  ON public.notifications (user_id, tab_key, created_at DESC)
  WHERE is_read = false;

CREATE OR REPLACE FUNCTION public.staff_notification_tab(p_type text, p_metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    NULLIF(p_metadata->>'tab_key', ''),
    CASE p_type
      WHEN 'report_filed' THEN 'reports-queue'
      WHEN 'moderation_action' THEN 'reports-queue'
      WHEN 'user_arrested' THEN 'jail-management'
      WHEN 'court_started' THEN 'court-dockets'
      WHEN 'user_kicked' THEN 'stream-monitor'
      WHEN 'coin_purchase_admin_alert' THEN 'coin-purchases-ledger'
      WHEN 'payment_received' THEN 'payment-logs'
      WHEN 'payout_update' THEN 'payout-batches'
      WHEN 'support_ticket' THEN 'support-tickets'
      WHEN 'survey_response' THEN 'surveys'
      WHEN 'application_submitted' THEN 'applications'
      WHEN 'career_application_submitted' THEN 'applications'
      WHEN 'executive_intake' THEN 'intake-inbox'
      WHEN 'executive_report' THEN 'exec-reports'
      WHEN 'staff_audit' THEN 'staff-audit'
      WHEN 'weekly_report' THEN 'weekly-reports'
      WHEN 'staff_file' THEN 'employee-files'
      WHEN 'staff_document' THEN 'employee-files'
      WHEN 'review_submitted' THEN 'seller-management'
      WHEN 'seller_review' THEN 'seller-management'
      WHEN 'broadcast_school_review' THEN 'applications'
      WHEN 'system_error' THEN 'system-errors'
      WHEN 'critical_alert' THEN 'critical-alerts'
      WHEN 'database_backup' THEN 'database-backup'
      WHEN 'crown_redemption_submitted' THEN 'crown-redemptions'
      WHEN 'advertisement_submitted' THEN 'advertisements'
      WHEN 'live_stream_review' THEN 'stream-monitor'
      WHEN 'media_review' THEN 'media-library'
      WHEN 'chat_moderation' THEN 'chat-moderation'
      WHEN 'announcement_review' THEN 'announcements'
      WHEN 'referral_activity' THEN 'referral-bonuses'
      WHEN 'officer_alert' THEN 'officer-operations'
      ELSE 'other'
    END
  );
$$;

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
  v_tab_key text := public.staff_notification_tab(p_type, v_metadata);
  v_admin_only boolean :=
    p_type IN ('coin_purchase_admin_alert', 'new_user_signup', 'user_signup')
    OR (p_type = 'moderation_action' AND v_metadata->>'audience' = 'admin');
BEGIN
  INSERT INTO public.notifications (
    user_id, sender_id, type, title, message, link, metadata,
    is_read, read_at, created_at, updated_at, is_dismissed, dismissed_at,
    data, tab_key, entity_id, severity, priority, source
  )
  SELECT
    up.id, NULL, p_type, p_title, p_message,
    NULLIF(v_metadata->>'route', ''), v_metadata,
    false, NULL, now(), now(), false, NULL,
    v_metadata, v_tab_key, NULLIF(v_metadata->>'entity_id', ''),
    COALESCE(NULLIF(v_metadata->>'severity', ''), 'info'),
    COALESCE(NULLIF(v_metadata->>'priority', ''), 'normal'),
    COALESCE(NULLIF(v_metadata->>'source', ''), 'database')
  FROM public.user_profiles up
  WHERE
    (
      up.is_admin = true OR up.is_super_admin = true OR up.is_ceo = true
      OR up.role IN ('admin', 'superadmin', 'owner', 'ceo')
    )
    OR (
      NOT v_admin_only
      AND (
        up.is_staff = true OR up.is_troll_officer = true OR up.is_lead_officer = true
        OR up.is_secretary = true OR up.is_attorney = true OR up.is_prosecutor = true
        OR lower(COALESCE(up.role::text, '')) IN (
          'lead_troll_officer', 'troll_officer', 'moderator', 'staff', 'secretary',
          'executive_secretary', 'troll_city_secretary', 'agency_hr', 'agency_hr_manager',
          'agency_leader', 'ceo_assistant', 'noah_assistant', 'hr_admin',
          'marketing_readonly', 'academy_director', 'prosecutor', 'attorney'
        )
        OR EXISTS (
          SELECT 1 FROM public.employee_records er
          WHERE er.user_id = up.id AND er.employment_status = 'active'
        )
      )
    );
END;
$$;

-- Generic trigger for staff-facing queues. It reads only common fields from
-- the row, so each optional feature table can opt in without coupling schemas.
CREATE OR REPLACE FUNCTION public.notify_staff_review_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_id text := COALESCE(v_row->>'id', v_row->>'uuid');
  v_status text := lower(COALESCE(v_row->>'status', ''));
  v_type text := COALESCE(TG_ARGV[0], 'staff_document');
  v_tab text := COALESCE(TG_ARGV[1], 'other');
  v_title text := COALESCE(TG_ARGV[2], 'New staff activity');
  v_route text := COALESCE(TG_ARGV[3], '/admin');
BEGIN
  IF TG_OP = 'UPDATE' AND COALESCE(to_jsonb(OLD)->>'status', '') = v_status
     AND v_status NOT IN ('pending', 'open', 'submitted', 'in_review', 'needs_review') THEN
    RETURN NEW;
  END IF;

  PERFORM public.notify_staff(
    v_type,
    v_title,
    COALESCE(v_row->>'title', v_row->>'name', v_row->>'subject', 'New staff activity requires review'),
    jsonb_build_object(
      'tab_key', v_tab,
      'entity_id', v_id,
      'route', v_route,
      'source', TG_TABLE_NAME,
      'priority', CASE WHEN v_status IN ('critical', 'urgent') THEN 'critical' ELSE 'normal' END
    )
  );
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('support_tickets', 'support_ticket', 'support-tickets', 'New support ticket', '/admin/support-tickets'),
      ('applications', 'application_submitted', 'applications', 'New application', '/admin/applications'),
      ('career_applications', 'career_application_submitted', 'applications', 'New career application', '/admin/applications'),
      ('moderation_reports', 'report_filed', 'reports-queue', 'New moderation report', '/admin/reports'),
      ('weekly_reports', 'weekly_report', 'weekly-reports', 'New weekly staff report', '/admin/reports/weekly'),
      ('executive_reports', 'executive_report', 'exec-reports', 'New executive report', '/admin/executive-reports'),
      ('executive_intake', 'executive_intake', 'intake-inbox', 'New executive intake', '/admin/executive-intake'),
      ('employee_records', 'staff_audit', 'staff-audit', 'Staff record changed', '/admin/staff-audit'),
      ('documents', 'staff_document', 'employee-files', 'New staff document', '/admin/hr'),
      ('seller_reviews', 'seller_review', 'seller-management', 'New seller review', '/admin/seller-management'),
      ('marketplace_reviews', 'review_submitted', 'seller-management', 'New marketplace review', '/admin/seller-management'),
      ('product_reviews', 'review_submitted', 'seller-management', 'New product review', '/admin/seller-management'),
      ('broadcast_school_reviews', 'broadcast_school_review', 'applications', 'New broadcast review', '/admin/applications')
    ) AS t(table_name, event_type, tab_key, title, route)
  LOOP
    IF to_regclass('public.' || item.table_name) IS NOT NULL THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_staff_notification_%I ON public.%I;
         CREATE TRIGGER trg_staff_notification_%I
         AFTER INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.notify_staff_review_event(%L, %L, %L, %L)',
        item.table_name, item.table_name, item.table_name, item.table_name,
        item.event_type, item.tab_key, item.title, item.route
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_staff_storage_upload()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
BEGIN
  IF NEW.bucket_id IN ('staff-files', 'employee-documents', 'staff-documents', 'documents') THEN
    PERFORM public.notify_staff(
      'staff_file',
      'New staff file uploaded',
      COALESCE(NEW.name, 'A staff file was uploaded and may require review'),
      jsonb_build_object(
        'tab_key', 'employee-files',
        'entity_id', NEW.id,
        'route', '/admin/hr',
        'source', 'storage.objects',
        'bucket_id', NEW.bucket_id,
        'path', NEW.name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_staff_notification_storage_upload ON storage.objects;
    CREATE TRIGGER trg_staff_notification_storage_upload
      AFTER INSERT ON storage.objects
      FOR EACH ROW EXECUTE FUNCTION public.notify_staff_storage_upload();
  END IF;
END;
$$;

BEGIN;

WITH duplicate_signup_notifications AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, COALESCE(metadata->>'signup_user_id', metadata->>'user_id')
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.notifications
  WHERE type IN ('new_user_signup', 'user_signup')
    AND COALESCE(metadata->>'signup_user_id', metadata->>'user_id') IS NOT NULL
)
DELETE FROM public.notifications AS notification
USING duplicate_signup_notifications AS duplicate
WHERE notification.id = duplicate.id
  AND duplicate.duplicate_rank > 1;

WITH duplicate_broadcast_notifications AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id, metadata->>'stream_id'
      ORDER BY created_at, id
    ) AS duplicate_rank
  FROM public.notifications
  WHERE type IN ('stream_live', 'broadcast_started')
    AND metadata->>'stream_id' IS NOT NULL
)
DELETE FROM public.notifications AS notification
USING duplicate_broadcast_notifications AS duplicate
WHERE notification.id = duplicate.id
  AND duplicate.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_signup_event_unique
  ON public.notifications (
    user_id,
    (COALESCE(metadata->>'signup_user_id', metadata->>'user_id'))
  )
  WHERE type IN ('new_user_signup', 'user_signup')
    AND COALESCE(metadata->>'signup_user_id', metadata->>'user_id') IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_broadcast_event_unique
  ON public.notifications (user_id, (metadata->>'stream_id'))
  WHERE type IN ('stream_live', 'broadcast_started')
    AND metadata->>'stream_id' IS NOT NULL;

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
    )
  ON CONFLICT DO NOTHING;
END;
$$;

ALTER FUNCTION public.notify_staff(text, text, text, jsonb) OWNER TO postgres;

COMMIT;

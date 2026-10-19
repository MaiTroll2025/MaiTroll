-- 20261018000001_create_user_rtc_admin_monitor_grants
-- Creates the missing public.user_rtc_admin_monitor_grants table (referenced
-- by can_access_rtc_admin_monitor) plus its RLS policies, grants, and the
-- can_access_rtc_admin_monitor function. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.user_rtc_admin_monitor_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

ALTER TABLE public.user_rtc_admin_monitor_grants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rtc_admin_monitor_grants'
      AND policyname = 'rtc_admin_monitor_grants_select_admin'
  ) THEN
    CREATE POLICY "rtc_admin_monitor_grants_select_admin"
      ON public.user_rtc_admin_monitor_grants FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rtc_admin_monitor_grants'
      AND policyname = 'rtc_admin_monitor_grants_self_select'
  ) THEN
    CREATE POLICY "rtc_admin_monitor_grants_self_select"
      ON public.user_rtc_admin_monitor_grants FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rtc_admin_monitor_grants'
      AND policyname = 'rtc_admin_monitor_grants_insert_admin'
  ) THEN
    CREATE POLICY "rtc_admin_monitor_grants_insert_admin"
      ON public.user_rtc_admin_monitor_grants FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
        )
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rtc_admin_monitor_grants'
      AND policyname = 'rtc_admin_monitor_grants_update_admin'
  ) THEN
    CREATE POLICY "rtc_admin_monitor_grants_update_admin"
      ON public.user_rtc_admin_monitor_grants FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
        )
      ) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_rtc_admin_monitor_grants'
      AND policyname = 'rtc_admin_monitor_grants_delete_admin'
  ) THEN
    CREATE POLICY "rtc_admin_monitor_grants_delete_admin"
      ON public.user_rtc_admin_monitor_grants FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid()
            AND (up.is_admin = true OR up.is_superadmin = true OR up.role IN ('admin','superadmin','ceo','owner'))
        )
      );
  END IF;
END $$;

GRANT ALL ON public.user_rtc_admin_monitor_grants TO service_role;
GRANT SELECT ON public.user_rtc_admin_monitor_grants TO authenticated;

CREATE OR REPLACE FUNCTION public.can_access_rtc_admin_monitor(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_grant_count INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_profile.is_admin = true
     OR v_profile.is_superadmin = true
     OR v_profile.role IN ('admin','superadmin','ceo','owner')
     OR v_profile.troll_role IN ('admin','superadmin','ceo','owner')
  THEN
    RETURN true;
  END IF;

  IF v_profile.role IN ('hr_admin','agency_hr_manager','lead_troll_officer','troll_officer','secretary','ceo','officer','pastor')
     OR v_profile.troll_role IN ('hr_admin','agency_hr_manager','lead_troll_officer','troll_officer','secretary','ceo','officer','pastor')
  THEN
    RETURN true;
  END IF;

  SELECT COUNT(*) INTO v_grant_count
  FROM public.user_rtc_admin_monitor_grants
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > now());

  RETURN v_grant_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_rtc_admin_monitor(UUID) TO authenticated, service_role;

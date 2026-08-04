-- =====================================================================
-- A3: Admin Security page — align server-side authorization with frontend
-- =====================================================================
-- The frontend allows admin, superadmin, owner, ceo to view the Security
-- Command Center. The original RLS policies on the security_* tables only
-- allowed role = 'admin' OR is_admin = true, so superadmin/ceo/owner would
-- hit RLS errors (blank data). This migration adds an additive policy for
-- the elevated roles. Non-privileged users remain denied server-side.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_security_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = p_user_id
          AND (
            COALESCE(up.is_admin, false)
            OR COALESCE(up.is_ceo, false)
            OR up.role IN ('admin','superadmin','ceo','owner')
            OR up.troll_role IN ('admin','superadmin','ceo','owner')
          )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_security_admin(uuid) TO authenticated, service_role;

-- Add an additive elevated-role policy to each security table (if present).
DO $$
DECLARE
    v_tbl text;
    v_tables text[] := ARRAY[
        'security_events',
        'security_user_risk_scores',
        'security_rate_limits',
        'security_admin_audit_log',
        'security_incident_reports',
        'security_ip_reputation'
    ];
BEGIN
    FOREACH v_tbl IN ARRAY v_tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = v_tbl
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tbl);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I',
                'security_elevated_roles_all_' || v_tbl, v_tbl);
            EXECUTE format($f$
                CREATE POLICY %I ON public.%I
                FOR ALL TO authenticated
                USING (public.is_security_admin(auth.uid()))
                WITH CHECK (public.is_security_admin(auth.uid()))
            $f$, 'security_elevated_roles_all_' || v_tbl, v_tbl);
        END IF;
    END LOOP;
END $$;

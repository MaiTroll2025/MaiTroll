BEGIN;

-- Create approved career role assignments table for paid positions
CREATE TABLE IF NOT EXISTS public.career_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    role_key TEXT NOT NULL CHECK (role_key IN (
        'auctioneer',
        'prosecutor',
        'attorney',
        'tcnn_news_caster',
        'secretary',
        'tcnn_chief_news_caster',
        'troll_officer',
        'journalist',
        'lead_troll_officer',
        'troller',
        'agency_hr_manager',
        'agency_hr',
        'agency_leader',
        'troll_family_leader',
        'ceo_assistant',
        'noah_assistant'
    )),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'terminated')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES public.user_profiles(id),
    expires_at TIMESTAMPTZ NULL,
    notes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.career_role_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for career_role_assignments
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'career_role_assignments'
          AND policyname = 'career_role_assignments_read_authenticated'
    ) THEN
        CREATE POLICY career_role_assignments_read_authenticated ON public.career_role_assignments
          FOR SELECT
          TO authenticated
          USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'career_role_assignments'
          AND policyname = 'career_role_assignments_insert_authenticated'
    ) THEN
        CREATE POLICY career_role_assignments_insert_authenticated ON public.career_role_assignments
          FOR INSERT
          TO authenticated
          WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid()
                  AND (
                    role IN ('admin', 'president', 'owner')
                    OR is_admin = true
                    OR role = 'ceo'
                    OR troll_role IN ('admin', 'president', 'owner', 'ceo')
                  )
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'career_role_assignments'
          AND policyname = 'career_role_assignments_update_authenticated'
    ) THEN
        CREATE POLICY career_role_assignments_update_authenticated ON public.career_role_assignments
          FOR UPDATE
          TO authenticated
          USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid()
                  AND (
                    role IN ('admin', 'president', 'owner')
                    OR is_admin = true
                    OR role = 'ceo'
                    OR troll_role IN ('admin', 'president', 'owner', 'ceo')
                  )
            )
          );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'career_role_assignments'
          AND policyname = 'career_role_assignments_delete_authenticated'
    ) THEN
        CREATE POLICY career_role_assignments_delete_authenticated ON public.career_role_assignments
          FOR DELETE
          TO authenticated
          USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid()
                  AND (
                    role IN ('admin', 'president', 'owner')
                    OR is_admin = true
                    OR role = 'ceo'
                    OR troll_role IN ('admin', 'president', 'owner', 'ceo')
                  )
            )
          );
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_career_role_assignments_user_id ON public.career_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_career_role_assignments_role_key ON public.career_role_assignments(role_key);
CREATE INDEX IF NOT EXISTS idx_career_role_assignments_status ON public.career_role_assignments(status);

-- Update treasury_role_allocations with canonical role keys
-- First, clear existing allocations to avoid conflicts
DELETE FROM public.treasury_role_allocations;

-- Insert canonical role allocations with proper keys
INSERT INTO public.treasury_role_allocations (role_key, role_label, weekly_amount_coins, is_active, created_by, updated_by)
VALUES
  ('auctioneer', 'Auctioneer', 0, false, NULL, NULL),
  ('prosecutor', 'Prosecutor', 0, false, NULL, NULL),
  ('attorney', 'Attorney', 0, false, NULL, NULL),
  ('tcnn_news_caster', 'TCNN News Caster', 0, false, NULL, NULL),
  ('secretary', 'Secretary', 0, false, NULL, NULL),
  ('tcnn_chief_news_caster', 'TCNN Chief News Caster', 0, false, NULL, NULL),
  ('troll_officer', 'Troll Officer', 0, false, NULL, NULL),
  ('journalist', 'Journalist', 0, false, NULL, NULL),
  ('lead_troll_officer', 'Lead Troll Officer', 0, false, NULL, NULL),
  ('troller', 'Troller', 0, false, NULL, NULL),
  ('agency_hr_manager', 'Agency HR Manager', 0, false, NULL, NULL),
  ('agency_hr', 'Agency HR', 0, false, NULL, NULL),
  ('agency_leader', 'Agency Leader', 0, false, NULL, NULL),
  ('troll_family_leader', 'Troll Family Leader', 0, false, NULL, NULL),
  ('ceo_assistant', 'CEO Assistant', 0, false, NULL, NULL),
  ('noah_assistant', 'Noah Assistant', 0, false, NULL, NULL)
ON CONFLICT (role_key) DO UPDATE SET
  role_label = EXCLUDED.role_label,
  weekly_amount_coins = EXCLUDED.weekly_amount_coins,
  is_active = EXCLUDED.is_active,
  updated_by = EXCLUDED.updated_by,
  updated_at = NOW();

-- Migration to set null/empty user_profiles.role to 'user'
UPDATE public.user_profiles
SET role = 'user'
WHERE role IS NULL OR trim(role) = '';

-- Alter column to set default
ALTER TABLE public.user_profiles
ALTER COLUMN role SET DEFAULT 'user';

-- Create or replace create_weekly_treasury_payout_run function with fixes
CREATE OR REPLACE FUNCTION public.create_weekly_treasury_payout_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid uuid;
    v_allowed boolean := false;
    v_week_start date;
    v_week_end date;
    v_existing_run_id uuid;
    v_new_run_id uuid;
    v_item_count bigint := 0;
    v_total_amount bigint := 0;
    v_allocation_count bigint := 0;
    v_eligible_user_count bigint := 0;
    v_debug_json jsonb := '{}'::jsonb;
BEGIN
    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Check permissions (admin/president/CEO)
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles
        WHERE id = v_uid
          AND (
            role IN ('admin', 'president', 'owner')
            OR is_admin = true
            OR role = 'ceo'
            OR troll_role IN ('admin', 'president', 'owner', 'ceo')
          )
    ) INTO v_allowed;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'Only admins, CEOs, or the president can create weekly treasury payout runs';
    END IF;

    v_week_start := date_trunc('week', current_date)::date;
    v_week_end := v_week_start + interval '6 days';

    -- Check for existing run
    SELECT id
      INTO v_existing_run_id
      FROM public.treasury_payout_runs
     WHERE run_week_start = v_week_start
       AND status <> 'cancelled'
     LIMIT 1;

    IF FOUND THEN
        RAISE EXCEPTION 'A weekly treasury payout run already exists for %', v_week_start;
    END IF;

    -- Create new payout run
    INSERT INTO public.treasury_payout_runs (
        run_week_start,
        run_week_end,
        status,
        total_amount_coins,
        created_by,
        notes
    )
    VALUES (
        v_week_start,
        v_week_end,
        'draft',
        0,
        v_uid,
        jsonb_build_object('created_from', 'weekly_treasury_run')
    )
    RETURNING id INTO v_new_run_id;

    -- Get active allocations with positive amounts
    WITH active_allocations AS (
        SELECT *
          FROM public.treasury_role_allocations
         WHERE is_active = true
           AND weekly_amount_coins > 0
    ),
    -- Get users with active career assignments for those roles
    eligible_assignments AS (
        SELECT
            cra.user_id,
            cra.role_key
          FROM public.career_role_assignments cra
          JOIN active_allocations aa ON aa.role_key = cra.role_key
         WHERE cra.status = 'active'
           AND (cra.expires_at IS NULL OR cra.expires_at > NOW())
    ),
    -- Fallback to user_profiles.role if no assignment table exists (for backward compatibility)
    fallback_eligible AS (
        SELECT
            up.id AS user_id,
            CASE
                WHEN lower(COALESCE(up.role, '')) IN ('troll_officer', 'lead_troll_officer', 'officer') OR lower(COALESCE(up.troll_role, '')) IN ('troll_officer', 'lead_troll_officer', 'officer') OR up.is_troll_officer = true OR up.is_lead_officer = true THEN 'troll_officer'
                WHEN lower(COALESCE(up.role, '')) IN ('secretary', 'executive_secretary', 'troll_city_secretary') OR lower(COALESCE(up.troll_role, '')) IN ('secretary', 'executive_secretary', 'troll_city_secretary') THEN 'secretary'
                WHEN lower(COALESCE(up.role, '')) = 'president' OR lower(COALESCE(up.troll_role, '')) = 'president' THEN 'president'
                WHEN lower(COALESCE(up.role, '')) IN ('agency_hr_manager', 'hr_admin') OR lower(COALESCE(up.troll_role, '')) IN ('agency_hr_manager', 'hr_admin') THEN 'agency_hr_manager'
                WHEN lower(COALESCE(up.role, '')) = 'assistant' OR lower(COALESCE(up.troll_role, '')) = 'assistant' THEN 'assistant'
                WHEN lower(COALESCE(up.role, '')) = 'city_operations_runner' OR lower(COALESCE(up.troll_role, '')) = 'city_operations_runner' THEN 'city_operations_runner'
                WHEN lower(COALESCE(up.role, '')) = 'creator_support_representative' OR lower(COALESCE(up.troll_role, '')) = 'creator_support_representative' THEN 'creator_support_representative'
                WHEN lower(COALESCE(up.role, '')) = 'auctioneer' OR lower(COALESCE(up.troll_role, '')) = 'auctioneer' THEN 'auctioneer'
                ELSE lower(COALESCE(up.role, up.troll_role, ''))
            END AS effective_role_key
          FROM public.user_profiles up
    ),
    -- Use career assignments if table has data, otherwise fallback
    final_eligible AS (
        SELECT
            ea.user_id,
            ea.role_key
          FROM eligible_assignments ea
        UNION ALL
        SELECT
            fe.user_id,
            fe.effective_role_key
          FROM fallback_eligible fe
          WHERE NOT EXISTS (SELECT 1 FROM public.career_role_assignments WHERE status = 'active' LIMIT 1)
    )
    -- Insert payout items
    INSERT INTO public.treasury_payout_items (payout_run_id, user_id, role_key, amount_coins, status, details)
    SELECT
        v_new_run_id,
        fe.user_id,
        fe.role_key,
        aa.weekly_amount_coins,
        'pending',
        jsonb_build_object(
            'role_label', aa.role_label,
            'assignment_source', CASE WHEN cra.user_id IS NOT NULL THEN 'career_role_assignments' ELSE 'user_profiles.role' END
        )
      FROM final_eligible fe
      JOIN active_allocations aa ON aa.role_key = fe.role_key
      LEFT JOIN public.career_role_assignments cra ON cra.user_id = fe.user_id AND cra.role_key = fe.role_key AND cra.status = 'active'
     WHERE aa.is_active = true
       AND aa.weekly_amount_coins > 0
     ON CONFLICT (payout_run_id, user_id, role_key) DO NOTHING;

    -- Get counts
    SELECT COUNT(*)
      INTO v_allocation_count
      FROM public.treasury_role_allocations
     WHERE is_active = true
       AND weekly_amount_coins > 0;

    SELECT COUNT(DISTINCT fe.user_id)
      INTO v_eligible_user_count
      FROM final_eligible fe
      JOIN active_allocations aa ON aa.role_key = fe.role_key;

    SELECT COUNT(*), COALESCE(SUM(amount_coins), 0)
      INTO v_item_count, v_total_amount
      FROM public.treasury_payout_items
     WHERE payout_run_id = v_new_run_id;

    -- Update run total
    UPDATE public.treasury_payout_runs
       SET total_amount_coins = v_total_amount,
           updated_at = now()
     WHERE id = v_new_run_id;

    -- Build debug info
    v_debug_json := jsonb_build_object(
        'allocation_count', v_allocation_count,
        'eligible_user_count', v_eligible_user_count,
        'item_count', v_item_count,
        'total_amount_coins', v_total_amount,
        'run_id', v_new_run_id::text,
        'week_start', v_week_start::text,
        'week_end', v_week_end::text
    );

    RAISE NOTICE 'Treasury payout run created: %', v_debug_json;

    RETURN jsonb_build_object(
        'run_id', v_new_run_id,
        'run_week_start', v_week_start,
        'run_week_end', v_week_end,
        'item_count', v_item_count,
        'total_amount_coins', v_total_amount,
        'debug', v_debug_json
    );
END;
$$;

-- Update agency approval function to check fee payment
CREATE OR REPLACE FUNCTION public.approve_agency_application(p_application_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_uid uuid;
    v_allowed boolean := false;
    v_application public.agency_applications;
BEGIN
    v_uid := auth.uid();

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Check if user is agency owner or manager
    SELECT EXISTS (
        SELECT 1
        FROM public.agencies a
        JOIN public.agency_members am ON am.agency_id = a.id
        WHERE a.owner_id = v_uid
           OR (am.user_id = v_uid AND am.role IN ('owner', 'manager') AND am.status = 'active')
    ) INTO v_allowed;

    IF NOT v_allowed THEN
        RAISE EXCEPTION 'You do not have permission to approve agency applications';
    END IF;

    -- CHECK APPLICATION FEE PAYMENT - NEW REQUIREMENT
    IF EXISTS (
        SELECT 1
        FROM public.agency_applications
        WHERE id = p_application_id
          AND coalesce(application_fee_paid, false) = false
    ) THEN
        RAISE EXCEPTION 'Agency application fee has not been paid';
    END IF;

    -- Get application
    SELECT *
      INTO v_application
      FROM public.agency_applications
     WHERE id = p_application_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agency application not found';
    END IF;

    -- Update application
    UPDATE public.agency_applications
       SET status = 'approved',
           reviewed_by = v_uid,
           reviewed_at = now()
     WHERE id = p_application_id
       AND status = 'pending'
    RETURNING * INTO v_application;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Only pending agency applications can be approved';
    END IF;

    RETURN jsonb_build_object(
        'application_id', v_application.id,
        'status', v_application.status,
        'reviewed_by', v_application.reviewed_by,
        'reviewed_at', v_application.reviewed_at
    );
END;
$$;

COMMIT;
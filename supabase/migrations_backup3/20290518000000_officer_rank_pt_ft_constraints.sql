-- ============================================================
-- Migration: 20290518000000_officer_rank_pt_ft_constraints
-- Sets Officer rank to part-time by default, adds Officer-PT/Officer-FT
-- employment type constraint, enforces hour limits per employment type
-- ============================================================

-- 1. Add officer_employment_type column if it does not exist
-- Valid values: 'PT' (1-20 hrs/week) | 'FT' (20+ hrs/week)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles' AND column_name = 'officer_employment_type'
    ) THEN
        ALTER TABLE public.user_profiles
            ADD COLUMN officer_employment_type text DEFAULT 'PT';
    END IF;
END;
$$;

-- 2. Apply CHECK constraint on officer_employment_type (idempotent-safe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_officer_employment_type'
          AND conrelid = 'user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles
            ADD CONSTRAINT valid_officer_employment_type
            CHECK (officer_employment_type IN ('PT', 'FT'));
    END IF;
END;
$$;

-- 3. Expand officer_rank CHECK to also accept Officer-PT and Officer-FT
DO $$
BEGIN
    -- Drop old constraint if it exists so we can replace it
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_officer_rank'
          AND conrelid = 'user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles
            DROP CONSTRAINT valid_officer_rank;
    END IF;
END;
$$;

ALTER TABLE public.user_profiles
    ADD CONSTRAINT valid_officer_rank
    CHECK (officer_rank IS NULL OR officer_rank IN (
        'troll_officer',
        'lead_officer',
        'ceo',
        'probationary_officer',
        'senior_officer',
        'Officer-PT',
        'Officer-FT'
    ));

-- 4. Default all existing officers to officer_employment_type = 'PT'
-- and set officer_rank = 'Officer-PT' where it was previously NULL or empty
-- (Existing non-null roles are preserved for internal dashboard compatibility)
UPDATE public.user_profiles
SET
    officer_employment_type = COALESCE(
        NULLIF(LOWER(TRIM(officer_employment_type)), ''),
        'PT'
    )
WHERE is_troll_officer = true OR is_lead_officer = true OR role IN ('troll_officer', 'lead_troll_officer', 'officer');

-- Mark officers with empty/null rank as Officer-PT (default: part-time)
UPDATE public.user_profiles
SET officer_rank = 'Officer-PT'
WHERE (officer_rank IS NULL OR officer_rank = '')
  AND (is_troll_officer = true OR is_lead_officer = true OR role IN ('troll_officer', 'lead_troll_officer', 'officer'));

-- 5. Update admin_set_officer_rank to accept Officer-PT and Officer-FT
CREATE OR REPLACE FUNCTION public.admin_set_officer_rank(
    p_officer_id uuid,
    p_rank text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    IF NOT public.is_admin_user(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin only');
    END IF;

    IF p_rank NOT IN (
        'troll_officer', 'lead_officer', 'ceo',
        'probationary_officer', 'senior_officer',
        'Officer-PT', 'Officer-FT'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid rank');
    END IF;

    UPDATE public.user_profiles
    SET officer_rank = p_rank
    WHERE id = p_officer_id;

    RETURN jsonb_build_object('success', true, 'officer_id', p_officer_id, 'rank', p_rank);
END;
$$;

-- 6. Enforce hour cap: PT officers clocking out must not exceed 20 hrs
-- Warning / log when a PT officer tries to exceed the cap on clock-out
CREATE OR REPLACE FUNCTION public.enforce_pt_hour_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_employment_type text;
    v_hours          numeric;
    v_max_hrs        constant numeric := 20.0;
BEGIN
    -- Only act on clock-out events (when hours_worked is being set and clock_out is being written)
    IF NEW.officer_id IS NULL OR NEW.clock_out IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT officer_employment_type INTO v_employment_type
    FROM public.user_profiles
    WHERE id = NEW.officer_id;

    IF v_employment_type = 'PT' THEN
        -- Clamp hours to the PART-TIME maximum of 20 hours
        IF NEW.hours_worked IS NOT NULL AND NEW.hours_worked > v_max_hrs THEN
            RAISE NOTICE '[PT Hour Cap] Officer % hit % hrs (cap: %). Clamping hours.',
                NEW.officer_id, NEW.hours_worked, v_max_hrs;
            NEW.hours_worked := v_max_hrs;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pt_hour_cap ON public.officer_work_sessions;
CREATE TRIGGER trg_enforce_pt_hour_cap
    BEFORE INSERT OR UPDATE ON public.officer_work_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pt_hour_cap();

-- 7. Summary view: show paid-employment rank (Officer-PT / Officer-FT)
-- overriding internal role-based rank for payroll/reporting purposes
CREATE OR REPLACE VIEW public.officer_payroll_rank_view AS
SELECT
    up.id                             AS officer_id,
    up.username,
    up.full_name,
    -- Prefer payroll-friendly rank; fall back to internal rank
    CASE
        WHEN up.officer_rank IN ('Officer-PT', 'Officer-FT') THEN up.officer_rank
        WHEN up.is_troll_officer = true OR up.role = 'troll_officer'
             OR up.officer_rank IN ('troll_officer', 'probationary_officer', 'senior_officer')
        THEN 'Officer-PT'
        WHEN up.is_lead_officer = true OR up.role = 'lead_troll_officer'
             OR up.officer_rank IN ('lead_officer', 'ceo')
        THEN 'Officer-FT'
        ELSE 'Officer-PT'
    END                              AS payroll_rank,
    COALESCE(up.officer_employment_type, 'PT') AS employment_type,
    up.officer_rank                  AS internal_rank,
    up.is_troll_officer,
    up.is_lead_officer
FROM public.user_profiles up
WHERE up.is_troll_officer = true OR up.is_lead_officer = true;

COMMENT ON TABLE public.officer_payroll_rank_view
    IS 'Maps every officer to a payroll-friendly PT/FT rank. Use this view for PDF reports and payroll calculations instead of reading officer_rank directly.';

-- 8. RLS: allow authenticated users to read their own payroll rank
ALTER VIEW public.officer_payroll_rank_view OWNER TO postgres;
GRANT SELECT ON public.officer_payroll_rank_view TO authenticated;
GRANT SELECT ON public.officer_payroll_rank_view TO anon;
GRANT SELECT ON public.officer_payroll_rank_view TO service_role;

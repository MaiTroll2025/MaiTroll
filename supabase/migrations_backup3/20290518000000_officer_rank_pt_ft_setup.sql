-- ============================================================
-- Migration: 20290518000000_officer_rank_pt_ft_setup
-- Add Officer-PT/Officer-FT employment type, enforce PT hour cap
-- ============================================================

-- ── 1. Add officer_employment_type column if missing ──────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_profiles'
          AND column_name = 'officer_employment_type'
    ) THEN
        ALTER TABLE public.user_profiles
            ADD COLUMN officer_employment_type text DEFAULT 'PT';
    END IF;
END;
$$;

-- ── 2. Drop & replace the CHECK constraint (idempotent) ───────
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'valid_officer_employment_type'
          AND conrelid = 'user_profiles'::regclass
    ) THEN
        ALTER TABLE public.user_profiles
            DROP CONSTRAINT valid_officer_employment_type;
    END IF;
END;
$$;

-- Case-insensitive CHECK: accepts PT, pt, FT, ft, etc.
ALTER TABLE public.user_profiles
    ADD CONSTRAINT valid_officer_employment_type
    CHECK (officer_employment_type IS NULL OR UPPER(TRIM(officer_employment_type)) IN ('PT', 'FT'));

-- ── 3. Normalize all existing values and set defaults ───────────
-- (No-op if the column was just added – it already defaults to 'PT')
UPDATE public.user_profiles
SET officer_employment_type = COALESCE(
    NULLIF(UPPER(TRIM(officer_employment_type)), ''),
    'PT'
);

-- ── 4. Normalize-on-write trigger ───────────────────────────────
CREATE OR REPLACE FUNCTION public.normalize_officer_employment_type()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    IF NEW.officer_employment_type IS NOT NULL THEN
        NEW.officer_employment_type := UPPER(TRIM(NEW.officer_employment_type));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_officer_employment_type ON public.user_profiles;

CREATE TRIGGER trg_normalize_officer_employment_type
    BEFORE INSERT OR UPDATE OF officer_employment_type
    ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.normalize_officer_employment_type();

-- ── 5. Expand officer_rank CHECK to accept Officer-PT / Officer-FT ──
DO $$
BEGIN
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
        'troll_officer', 'lead_officer', 'ceo',
        'probationary_officer', 'senior_officer',
        'Officer-PT', 'Officer-FT'
    ));

-- ── 6. Default NULL officer_rank → Officer-PT on existing officers ──
UPDATE public.user_profiles
SET officer_rank = 'Officer-PT'
WHERE (officer_rank IS NULL OR officer_rank = '')
  AND (is_troll_officer = true
       OR is_lead_officer = true
       OR role IN ('troll_officer', 'lead_troll_officer', 'officer'));

-- ── 7. Update admin_set_officer_rank to accept new values ───────
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

-- ── 8. PT hour-cap trigger on officer_work_sessions ────────────
-- Clamps hours_worked to 20.0 when employment_type is PT
CREATE OR REPLACE FUNCTION public.enforce_pt_hour_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_employment_type text;
    v_max_hrs         constant numeric := 20.0;
BEGIN
    IF NEW.officer_id IS NULL OR NEW.clock_out IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(UPPER(TRIM(officer_employment_type)), 'PT')
    INTO v_employment_type
    FROM public.user_profiles
    WHERE id = NEW.officer_id;

    IF v_employment_type = 'PT'
       AND NEW.hours_worked IS NOT NULL
       AND NEW.hours_worked > v_max_hrs THEN
        RAISE NOTICE '[PT Hour Cap] Officer % hours exceeded % – clamping.',
            NEW.officer_id, v_max_hrs;
        NEW.hours_worked := v_max_hrs;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pt_hour_cap ON public.officer_work_sessions;

CREATE TRIGGER trg_enforce_pt_hour_cap
    BEFORE INSERT OR UPDATE ON public.officer_work_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pt_hour_cap();

-- ── 9. Payroll rank view ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.officer_payroll_rank_view AS
SELECT
    up.id   AS officer_id,
    up.username,
    up.full_name,
    CASE
        WHEN up.officer_rank IN ('Officer-PT', 'Officer-FT')              THEN up.officer_rank
        WHEN up.is_troll_officer = true
             OR up.role IN ('troll_officer', 'lead_troll_officer')
             OR up.officer_rank IN ('troll_officer','probationary_officer','senior_officer')
        THEN 'Officer-PT'
        WHEN up.is_lead_officer = true
             OR up.officer_rank IN ('lead_officer', 'ceo')
        THEN 'Officer-FT'
        ELSE 'Officer-PT'
    END AS payroll_rank
FROM public.user_profiles up
WHERE up.is_troll_officer = true OR up.is_lead_officer = true;

GRANT SELECT ON public.officer_payroll_rank_view TO authenticated;
GRANT SELECT ON public.officer_payroll_rank_view TO anon;
GRANT SELECT ON public.officer_payroll_rank_view TO service_role;

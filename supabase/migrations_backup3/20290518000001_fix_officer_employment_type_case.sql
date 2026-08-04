-- ============================================================
-- Migration: 20290518000001_fix_officer_employment_type_case
-- Normalizes officer_employment_type to uppercase (PT/FT)
-- and makes the constraint case-insensitive via trigger
-- ============================================================

-- 1. Normalize all existing values to uppercase (PT/FT)
UPDATE public.user_profiles
SET officer_employment_type = UPPER(TRIM(officer_employment_type));

-- 2. Drop the old case-sensitive CHECK constraint
ALTER TABLE public.user_profiles
    DROP CONSTRAINT IF EXISTS valid_officer_employment_type;

-- 3. Replace with a case-insensitive CHECK using UPPER()
ALTER TABLE public.user_profiles
    ADD CONSTRAINT valid_officer_employment_type
    CHECK (officer_employment_type IS NULL OR UPPER(TRIM(officer_employment_type)) IN ('PT', 'FT'));

-- 4. Create a BEFORE INSERT/UPDATE trigger to auto-normalize on write
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

-- 5. Also enforce hour cap via trigger on work sessions (case-insensitive check)
-- Drop old cap trigger if it exists
DROP TRIGGER IF EXISTS trg_enforce_pt_hour_cap ON public.officer_work_sessions;
DROP FUNCTION IF EXISTS public.enforce_pt_hour_cap();

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
    IF NEW.officer_id IS NULL OR NEW.clock_out IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT COALESCE(UPPER(TRIM(officer_employment_type)), 'PT') INTO v_employment_type
    FROM public.user_profiles
    WHERE id = NEW.officer_id;

    IF v_employment_type = 'PT' THEN
        IF NEW.hours_worked IS NOT NULL AND NEW.hours_worked > v_max_hrs THEN
            RAISE NOTICE '[PT Hour Cap] Officer % hit % hrs (cap: %). Clamping hours.',
                NEW.officer_id, NEW.hours_worked, v_max_hrs;
            NEW.hours_worked := v_max_hrs;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_pt_hour_cap
    BEFORE INSERT OR UPDATE ON public.officer_work_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_pt_hour_cap();

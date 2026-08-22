-- ============================================================================
-- Fix court docket date generation
-- ============================================================================
-- Bug: get_or_create_next_docket was using MAX(court_date) + 1, which could
-- create dockets in the past (e.g. Aug 17 when today is Aug 20).
-- Fix: use next_court_day() to always land on Tuesday or Thursday.
-- ============================================================================

BEGIN;

-- Drop old helper if it exists with the wrong logic
DROP FUNCTION IF EXISTS public.next_court_day(DATE);

-- Function to calculate the next valid court day (Tuesday / Thursday)
CREATE OR REPLACE FUNCTION public.next_court_day(p_from_date DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_dow INT;
    v_date DATE;
BEGIN
    v_dow := EXTRACT(ISODOW FROM p_from_date)::INT;
    v_date := p_from_date;

    IF v_dow = 1 OR v_dow = 2 THEN      -- Mon / Tue -> Thu
        v_date := p_from_date + (4 - v_dow);
    ELSIF v_dow = 3 THEN                 -- Wed -> Thu
        v_date := p_from_date + 1;
    ELSIF v_dow = 4 THEN                 -- Thu -> today
        v_date := p_from_date;
    ELSIF v_dow = 5 THEN                 -- Fri -> Tue
        v_date := p_from_date + 4;
    ELSIF v_dow = 6 THEN                 -- Sat -> Tue
        v_date := p_from_date + 3;
    ELSE                                 -- Sun -> Tue
        v_date := p_from_date + 2;
    END IF;

    RETURN v_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_court_day(DATE) TO authenticated, service_role;

-- Recreate get_or_create_next_docket with correct date logic
DROP FUNCTION IF EXISTS public.get_or_create_next_docket(DATE);

CREATE OR REPLACE FUNCTION public.get_or_create_next_docket(p_from_date DATE DEFAULT CURRENT_DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_docket_id UUID;
    v_date DATE;
BEGIN
    -- Find the earliest open docket with space on or after p_from_date
    SELECT d.id INTO v_docket_id
    FROM public.court_dockets d
    LEFT JOIN public.court_cases c ON c.docket_id = d.id
    WHERE d.status = 'open' AND d.court_date >= p_from_date
    GROUP BY d.id, d.max_cases
    HAVING COUNT(c.id) < d.max_cases
    ORDER BY d.court_date ASC
    LIMIT 1;

    IF v_docket_id IS NOT NULL THEN
        RETURN v_docket_id;
    END IF;

    -- Otherwise, create a new docket for the next available court day (Tue / Thu)
    SELECT public.next_court_day(GREATEST(COALESCE(MAX(court_date), p_from_date), p_from_date))
    INTO v_date
    FROM public.court_dockets;

    WHILE EXISTS (SELECT 1 FROM public.court_dockets WHERE court_date = v_date) LOOP
        v_date := public.next_court_day(v_date + 1);
    END LOOP;

    INSERT INTO public.court_dockets (court_date, max_cases, status)
    VALUES (v_date, 20, 'open')
    RETURNING id INTO v_docket_id;

    RETURN v_docket_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_next_docket(DATE) TO authenticated, service_role;

COMMIT;

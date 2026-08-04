-- Auto-generate court dockets for Tuesdays and Thursdays

-- Function to get next Tuesday or Thursday
CREATE OR REPLACE FUNCTION public.get_next_court_date()
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_dow INTEGER;
    v_next_date DATE;
BEGIN
    -- 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
    v_dow := EXTRACT(DOW FROM v_today)::INTEGER;
    
    IF v_dow = 0 THEN
        v_next_date := v_today + 2; -- Sunday -> Tuesday
    ELSIF v_dow = 1 THEN
        v_next_date := v_today + 1; -- Monday -> Tuesday
    ELSIF v_dow = 2 THEN
        v_next_date := v_today;    -- Tuesday -> Today
    ELSIF v_dow = 3 THEN
        v_next_date := v_today + 1; -- Wednesday -> Thursday
    ELSIF v_dow = 4 THEN
        v_next_date := v_today;    -- Thursday -> Today
    ELSIF v_dow = 5 THEN
        v_next_date := v_today + 3; -- Friday -> Tuesday
    ELSE
        v_next_date := v_today + 2; -- Saturday -> Tuesday
    END IF;
    
    RETURN v_next_date;
END;
$$;

-- Function to ensure court dockets exist for the next 2 weeks (Tue and Thu)
CREATE OR REPLACE FUNCTION public.ensure_court_dockets()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_next_thu DATE;
    v_next_tue DATE;
    v_exists BOOLEAN;
BEGIN
    -- Get next Tuesday
    v_next_tue := public.get_next_court_date();
    
    -- Get next Thursday (2 days after Tuesday)
    v_next_thu := v_next_tue + 2;
    
    -- Check if Tuesday docket exists
    SELECT EXISTS (
        SELECT 1 FROM public.court_dockets 
        WHERE court_date = v_next_tue
    ) INTO v_exists;
    
    IF NOT v_exists THEN
        INSERT INTO public.court_dockets (court_date, status, max_cases)
        VALUES (v_next_tue, 'open', 20);
    END IF;
    
    -- Check if Thursday docket exists
    SELECT EXISTS (
        SELECT 1 FROM public.court_dockets 
        WHERE court_date = v_next_thu
    ) INTO v_exists;
    
    IF NOT v_exists THEN
        INSERT INTO public.court_dockets (court_date, status, max_cases)
        VALUES (v_next_thu, 'open', 20);
    END IF;
END;
$$;

-- Run on existing dockets to ensure Tue/Thu exist
SELECT public.ensure_court_dockets();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_next_court_date() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_court_dockets() TO authenticated;
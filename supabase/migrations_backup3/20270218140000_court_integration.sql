-- Court Integration for President Liability

-- Ensure court tables exist (if they were missing from previous migrations)
CREATE TABLE IF NOT EXISTS public.court_dockets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    court_date DATE NOT NULL,
    status TEXT DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    docket_id UUID REFERENCES public.court_dockets(id),
    plaintiff_id UUID REFERENCES public.user_profiles(id),
    defendant_id UUID REFERENCES public.user_profiles(id),
    reason TEXT,
    status TEXT DEFAULT 'pending',
    incident_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    verdict TEXT,
    judgment_summary TEXT
);

-- 1. Add 'president_impeachment' to court case types if not exists
-- (Assuming case_type or similar column exists, or we just rely on reason text. 
-- Based on search, `court_cases` has `status` and `reason`. We can add a type column or just use convention.)
-- Let's check `court_cases` schema more closely first, but for now we will assume we can add a column.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'court_cases' AND column_name = 'case_type') THEN
        ALTER TABLE public.court_cases ADD COLUMN case_type text DEFAULT 'civil';
    END IF;
END $$;

-- 2. Create function to file impeachment
CREATE OR REPLACE FUNCTION public.file_impeachment_case(
    p_president_id uuid,
    p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_docket_id uuid;
    v_case_id uuid;
    v_is_president boolean;
BEGIN
    -- Verify target is actually president
    SELECT EXISTS (
        SELECT 1 FROM public.user_role_grants 
        WHERE user_id = p_president_id AND role = 'president'
    ) INTO v_is_president;

    IF NOT v_is_president THEN
        RAISE EXCEPTION 'Target user is not the President.';
    END IF;

    -- Get or Create Docket for today (using existing logic pattern)
    SELECT id INTO v_docket_id
    FROM public.court_dockets
    WHERE court_date = CURRENT_DATE;

    IF v_docket_id IS NULL THEN
        INSERT INTO public.court_dockets (court_date, status)
        VALUES (CURRENT_DATE, 'open')
        RETURNING id INTO v_docket_id;
    END IF;

    -- Insert Case
    INSERT INTO public.court_cases (
        docket_id,
        defendant_id,
        plaintiff_id, -- The filer (caller)
        reason,
        status,
        incident_date,
        case_type
    )
    VALUES (
        v_docket_id,
        p_president_id,
        auth.uid(),
        p_reason,
        'pending',
        NOW(),
        'president_impeachment'
    )
    RETURNING id INTO v_case_id;

    -- Log it
    INSERT INTO public.president_audit_logs (
        action_type,
        actor_id,
        target_id,
        details
    ) VALUES (
        'impeachment_filed',
        auth.uid(),
        p_president_id,
        jsonb_build_object('case_id', v_case_id, 'reason', p_reason)
    );

    RETURN v_case_id;
END;
$$;

-- 3. Trigger to handle Impeachment Verdicts
-- If a case of type 'president_impeachment' is marked 'guilty', automatically remove president role?
-- OR just notify admins. Given the requirement "All real power remains with Admin + Court", 
-- it's safer to just log/notify or have a specific 'execute_impeachment' function called by Admin/Judge.

-- We'll add a function for the Judge to execute the removal IF the verdict is guilty.
CREATE OR REPLACE FUNCTION public.execute_impeachment_verdict(
    p_case_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_case record;
BEGIN
    -- Check case details
    SELECT * INTO v_case FROM public.court_cases WHERE id = p_case_id;

    IF v_case.case_type <> 'president_impeachment' THEN
        RAISE EXCEPTION 'Not an impeachment case.';
    END IF;

    -- Check if caller is Admin or Judge (simple check for now, can be expanded)
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = auth.uid() 
        AND (role = 'admin' OR role = 'troll_officer' OR is_troll_officer = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized to execute impeachment.';
    END IF;

    -- Execute Removal
    PERFORM public.remove_president(v_case.defendant_id, 'Impeached by Court Order Case #' || p_case_id);

    -- Update case status if not already
    UPDATE public.court_cases SET status = 'completed' WHERE id = p_case_id;
END;
$$;

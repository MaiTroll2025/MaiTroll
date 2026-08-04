
-- Update summon_user_to_court to allow selecting a specific docket
CREATE OR REPLACE FUNCTION public.summon_user_to_court(
    p_defendant_id UUID,
    p_reason TEXT,
    p_users_involved TEXT DEFAULT NULL,
    p_docket_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_docket_id UUID;
    v_case_id UUID;
    v_staff_id UUID;
BEGIN
    v_staff_id := auth.uid();
    
    -- Verify staff
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_staff_id AND (role IN ('admin', 'troll_officer', 'lead_troll_officer', 'judge') OR is_admin = true OR is_troll_officer = true)) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Get Docket
    IF p_docket_id IS NOT NULL THEN
        -- Verify docket exists and is open (or maybe full is okay if forced? No, stick to open for now)
        -- Actually, if a docket is 'full', we shouldn't allow adding more unless there's an override. 
        -- But for now, let's enforce 'open' or 'full' if we want to allow overbooking (systematic 20 limit might be strict).
        -- The requirement says "systematic dockets with 20 user limit". 
        -- So if p_docket_id is provided, we should check if it's full.
        
        IF EXISTS (SELECT 1 FROM public.court_dockets WHERE id = p_docket_id AND status = 'full') THEN
             RETURN jsonb_build_object('success', false, 'error', 'Selected docket is full');
        END IF;

        IF NOT EXISTS (SELECT 1 FROM public.court_dockets WHERE id = p_docket_id) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Selected docket not found');
        END IF;
        
        v_docket_id := p_docket_id;
    ELSE
        v_docket_id := public.get_or_create_next_docket();
    END IF;

    -- Create Case
    INSERT INTO public.court_cases (docket_id, defendant_id, plaintiff_id, reason, users_involved)
    VALUES (v_docket_id, p_defendant_id, v_staff_id, p_reason, p_users_involved)
    RETURNING id INTO v_case_id;

    -- Check if docket is now full
    IF (SELECT COUNT(*) FROM public.court_cases WHERE docket_id = v_docket_id) >= 20 THEN
        UPDATE public.court_dockets SET status = 'full' WHERE id = v_docket_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'case_id', v_case_id, 'docket_id', v_docket_id);
END;
$$;

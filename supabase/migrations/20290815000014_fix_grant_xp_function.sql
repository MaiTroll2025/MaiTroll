-- Fix grant_xp to use calculate_level_details and avoid invalid SELECT column references

-- Ensure the robust level calculator exists
DROP FUNCTION IF EXISTS public.calculate_level_details(BIGINT);

CREATE OR REPLACE FUNCTION public.calculate_level_details(current_total_xp BIGINT)
RETURNS TABLE (
    lvl INT,
    xp_for_next_level BIGINT,
    progress FLOAT
) AS $$
DECLARE
    curr_lvl INT := 1;
    xp_accum BIGINT := 0;
    xp_needed BIGINT := 100;
    xp_cap_level INT := 50;
    xp_cap_amount BIGINT := 10000;
BEGIN
    LOOP
        IF curr_lvl < xp_cap_level THEN
            xp_needed := FLOOR(100 * POWER(1.1, curr_lvl - 1));
        ELSE
            xp_needed := xp_cap_amount;
        END IF;

        IF current_total_xp < (xp_accum + xp_needed) THEN
            RETURN QUERY SELECT
                curr_lvl,
                (xp_accum + xp_needed),
                ((current_total_xp - xp_accum)::FLOAT / xp_needed::FLOAT);
            RETURN;
        END IF;

        xp_accum := xp_accum + xp_needed;
        curr_lvl := curr_lvl + 1;

        IF curr_lvl >= 10000 THEN
            RETURN QUERY SELECT curr_lvl, (xp_accum + xp_needed), 1.0::FLOAT;
            RETURN;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

GRANT EXECUTE ON FUNCTION public.calculate_level_details(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_level_details(BIGINT) TO service_role;

-- Fix grant_xp to use calculate_level_details(new_total) instead of calculate_level(new_total)
DROP FUNCTION IF EXISTS public.grant_xp(UUID, BIGINT, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.grant_xp(
    p_user_id UUID,
    p_amount BIGINT,
    p_source TEXT,
    p_source_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    new_total BIGINT;
    new_level INT;
    new_next BIGINT;
    new_prog FLOAT;
BEGIN
    IF EXISTS (SELECT 1 FROM public.xp_ledger WHERE source = p_source AND source_id = p_source_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Duplicate source_id');
    END IF;

    INSERT INTO public.xp_ledger (user_id, source, source_id, xp_amount, metadata)
    VALUES (p_user_id, p_source, p_source_id, p_amount, p_metadata);

    INSERT INTO public.user_stats (user_id, xp_total)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE public.user_stats
    SET xp_total = xp_total + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING xp_total INTO new_total;

    SELECT lvl, xp_for_next_level, progress
    INTO new_level, new_next, new_prog
    FROM public.calculate_level_details(new_total);

    UPDATE public.user_stats
    SET level = new_level,
        xp_to_next_level = new_next,
        xp_progress = new_prog
    WHERE user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'xp_total', new_total,
        'level', new_level,
        'xp_added', p_amount,
        'new_next_xp', new_next
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.grant_xp(UUID, BIGINT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.grant_xp(UUID, BIGINT, TEXT, TEXT, JSONB) TO service_role;

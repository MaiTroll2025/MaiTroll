
-- Fix XP System and Support Level 2000+
-- 1. Replace broken calculate_level with robust calculate_level_details
-- 2. Fix grant_xp RPC to correctly use the new function
-- 3. Implement scalable level formula

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS calculate_level(bigint);
DROP FUNCTION IF EXISTS calculate_level_details(bigint);

-- Function to calculate level, next level XP, and progress from total XP
-- Uses formula: 
-- Levels 1-50: 100 * 1.1^(L-1)
-- Levels 50+: 10000 flat per level
CREATE OR REPLACE FUNCTION calculate_level_details(current_total_xp BIGINT)
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
    -- Optimization: Simple loop is fast enough for 2000 iterations
    LOOP
        -- Calculate XP needed for current level
        IF curr_lvl < xp_cap_level THEN
            xp_needed := FLOOR(100 * POWER(1.1, curr_lvl - 1));
        ELSE
            xp_needed := xp_cap_amount;
        END IF;

        -- Check if we have enough XP to pass this level
        IF current_total_xp < (xp_accum + xp_needed) THEN
            -- We are at this level
            RETURN QUERY SELECT 
                curr_lvl, 
                (xp_accum + xp_needed), -- Total XP needed to reach next level
                ((current_total_xp - xp_accum)::FLOAT / xp_needed::FLOAT); -- Progress %
            RETURN;
        END IF;

        -- Advance to next level
        xp_accum := xp_accum + xp_needed;
        curr_lvl := curr_lvl + 1;

        -- Safety break (though BIGINT limit is the real limit)
        IF curr_lvl >= 10000 THEN
            RETURN QUERY SELECT curr_lvl, (xp_accum + xp_needed), 1.0::FLOAT;
            RETURN;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Fix grant_xp to use the new function
CREATE OR REPLACE FUNCTION grant_xp(
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
    -- Check deduplication
    IF EXISTS (SELECT 1 FROM public.xp_ledger WHERE source = p_source AND source_id = p_source_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Duplicate source_id');
    END IF;

    -- Insert into ledger
    INSERT INTO public.xp_ledger (user_id, source, source_id, xp_amount, metadata)
    VALUES (p_user_id, p_source, p_source_id, p_amount, p_metadata);

    -- Get current stats or init
    INSERT INTO public.user_stats (user_id, xp_total)
    VALUES (p_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;

    -- Update stats atomically
    UPDATE public.user_stats
    SET xp_total = xp_total + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING xp_total INTO new_total;

    -- Recalculate level details
    SELECT lvl, xp_for_next_level, progress 
    INTO new_level, new_next, new_prog
    FROM calculate_level_details(new_total);

    -- Update user stats with new level info
    UPDATE public.user_stats
    SET level = new_level,
        xp_to_next_level = new_next, -- This stores TOTAL XP needed for next level
        xp_progress = new_prog
    WHERE user_id = p_user_id;

    -- Return result
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION grant_xp TO authenticated;
GRANT EXECUTE ON FUNCTION grant_xp TO service_role;
GRANT EXECUTE ON FUNCTION calculate_level_details TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_level_details TO service_role;

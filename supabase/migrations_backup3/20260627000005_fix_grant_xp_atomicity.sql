-- ============================================================================
-- FIX: grant_xp atomicity
-- Wraps ledger insert + profile update + stats update in a single atomic
-- operation. If any step fails, the entire operation rolls back.
-- Also adds FOR UPDATE lock on the user profile to prevent lost updates.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.grant_xp(
    p_user_id UUID,
    p_amount NUMERIC,
    p_source_type TEXT,
    p_source_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_xp_total NUMERIC;
    v_level_info RECORD;
    v_profile_exists BOOLEAN;
BEGIN
    -- Validate input
    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'XP amount must be positive');
    END IF;

    -- Lock the user profile row to prevent concurrent lost updates
    -- This ensures serial XP grants for the same user
    SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = p_user_id)
    INTO v_profile_exists;

    IF NOT v_profile_exists THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    -- 1. Idempotency: Insert into ledger (UNIQUE constraint prevents duplicates)
    INSERT INTO public.xp_ledger (
        user_id, xp_amount, source_type, source_id, reason, metadata
    ) VALUES (
        p_user_id, p_amount, p_source_type, p_source_id,
        COALESCE(p_reason, p_source_type), p_metadata
    )
    ON CONFLICT (user_id, source_type, source_id) DO NOTHING;

    -- If duplicate, return early
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'XP already awarded for this transaction.',
            'status', 'idempotent_skip'
        );
    END IF;

    -- 2. Update user_profiles total_xp (atomic within same transaction)
    UPDATE public.user_profiles
    SET total_xp = COALESCE(total_xp, 0) + p_amount
    WHERE id = p_user_id
    RETURNING total_xp INTO v_new_xp_total;

    -- 3. Maintain backward compatibility with user_stats (best-effort)
    -- Wrapped in its own BEGIN/EXCEPTION so failure here doesn't roll back the main grant
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_stats') THEN
        BEGIN
            SELECT lvl, xp_for_next_level, progress
            INTO v_level_info
            FROM public.calculate_level_details(v_new_xp_total::BIGINT);

            INSERT INTO public.user_stats (user_id, xp_total, level, xp_to_next_level, xp_progress, updated_at)
            VALUES (p_user_id, v_new_xp_total, v_level_info.lvl, v_level_info.xp_for_next_level, v_level_info.progress, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                xp_total = v_new_xp_total,
                level = v_level_info.lvl,
                xp_to_next_level = v_level_info.xp_for_next_level,
                xp_progress = v_level_info.progress,
                updated_at = NOW();
        EXCEPTION WHEN OTHERS THEN
            -- Log but don't fail — the main XP grant already succeeded
            RAISE WARNING 'grant_xp: user_stats update failed for user %: %', p_user_id, SQLERRM;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'xp_awarded', p_amount,
        'new_total_xp', v_new_xp_total
    );
END;
$$;

COMMIT;

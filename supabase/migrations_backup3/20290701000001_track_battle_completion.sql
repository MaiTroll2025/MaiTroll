-- =============================================================================
-- TRACK BATTLE COMPLETION RPC
-- =============================================================================
-- Unified battle event function that:
-- - Finds both users' family memberships from family_members
-- - Finds both users' agency memberships from agency_members
-- - Updates personal battle stats
-- - Updates family goal progress
-- - Updates agency goal progress
-- - Updates family war points if a war is active
-- - Applies penalties when forfeit/disconnect/AFK is true
-- - Inserts audit rows for traceability
-- =============================================================================

BEGIN;

-- =============================================================================
-- TYPE: battle_tracking_result
-- =============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'battle_tracking_result') THEN
        CREATE TYPE public.battle_tracking_result AS (
            success boolean,
            message text,
            winner_family_id uuid,
            loser_family_id uuid,
            winner_agency_id uuid,
            loser_agency_id uuid,
            family_goals_updated integer,
            agency_goals_updated integer,
            war_points_applied integer,
            penalty_applied boolean,
            penalty_type text,
            cooldown_seconds integer
        );
    END IF;
END $$;

-- =============================================================================
-- FUNCTION: track_battle_completion
-- =============================================================================
CREATE OR REPLACE FUNCTION public.track_battle_completion(
    p_battle_id uuid,
    p_stream_id uuid,
    p_winner_user_id uuid,
    p_loser_user_id uuid,
    p_winner_score integer DEFAULT 0,
    p_loser_score integer DEFAULT 0,
    p_forfeit boolean DEFAULT false,
    p_disconnect boolean DEFAULT false,
    p_afk boolean DEFAULT false
)
RETURNS public.battle_tracking_result
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result public.battle_tracking_result;
    v_winner_family_id uuid;
    v_loser_family_id uuid;
    v_winner_agency_id uuid;
    v_loser_agency_id uuid;
    v_war record;
    v_goal record;
    v_penalty_points integer := 0;
    v_cooldown_seconds integer := 0;
    v_penalty_type text := NULL;
    v_war_points integer := 0;
    v_family_goals integer := 0;
    v_agency_goals integer := 0;
    v_minimum_duration constant integer := 30; -- battles under 30s don't count
    v_battle_duration integer;
    v_is_farming boolean := false;
    v_recent_similar integer;
BEGIN
    -- Initialize result
    v_result.success := false;
    v_result.message := '';
    v_result.penalty_applied := false;
    v_result.cooldown_seconds := 0;
    v_result.family_goals_updated := 0;
    v_result.agency_goals_updated := 0;
    v_result.war_points_applied := 0;

    -- Validate inputs
    IF p_battle_id IS NULL OR p_winner_user_id IS NULL OR p_loser_user_id IS NULL THEN
        v_result.message := 'Missing required parameters: battle_id, winner_user_id, loser_user_id';
        RETURN v_result;
    END IF;

    -- Cannot battle yourself
    IF p_winner_user_id = p_loser_user_id THEN
        v_result.message := 'Winner and loser cannot be the same user';
        RETURN v_result;
    END IF;

    -- Calculate battle duration if timestamps exist
    SELECT COALESCE(
        EXTRACT(EPOCH FROM (end_time - start_time))::integer,
        EXTRACT(EPOCH FROM (NOW() - created_at))::integer,
        0
    ) INTO v_battle_duration
    FROM public.troll_battles
    WHERE id = p_battle_id;

    -- Anti-farming: battles under minimum duration don't count
    IF v_battle_duration < v_minimum_duration AND NOT p_forfeit AND NOT p_disconnect THEN
        v_result.message := 'Battle too short — does not count (minimum ' || v_minimum_duration || 's)';
        -- Still record it but don't award points
        INSERT INTO public.battle_audit_log (
            battle_id, event_type, details, created_at
        ) VALUES (
            p_battle_id,
            'battle_too_short',
            jsonb_build_object(
                'duration', v_battle_duration,
                'minimum', v_minimum_duration,
                'winner_id', p_winner_user_id,
                'loser_id', p_loser_user_id
            ),
            NOW()
        );
        v_result.success := true;
        RETURN v_result;
    END IF;

    -- Anti-farming: check for repeated battles between same pair
    SELECT COUNT(*) INTO v_recent_similar
    FROM public.battle_history bh
    WHERE bh.created_at > NOW() - INTERVAL '1 hour'
    AND (
        (bh.user_id = p_winner_user_id AND bh.opponent_id = p_loser_user_id)
        OR (bh.user_id = p_loser_user_id AND bh.opponent_id = p_winner_user_id)
    );

    IF v_recent_similar >= 3 THEN
        v_is_farming := true;
        -- Record farming flag but still process (just don't award bonus)
        INSERT INTO public.battle_audit_log (
            battle_id, event_type, details, created_at
        ) VALUES (
            p_battle_id,
            'farming_detected',
            jsonb_build_object(
                'recent_battles', v_recent_similar,
                'winner_id', p_winner_user_id,
                'loser_id', p_loser_user_id
            ),
            NOW()
        );
    END IF;

    -- =========================================================================
    -- FIND FAMILY MEMBERSHIPS (canonical: family_members)
    -- =========================================================================
    SELECT fm.family_id INTO v_winner_family_id
    FROM public.family_members fm
    WHERE fm.user_id = p_winner_user_id
    AND fm.approval_status = 'approved'
    LIMIT 1;

    SELECT fm.family_id INTO v_loser_family_id
    FROM public.family_members fm
    WHERE fm.user_id = p_loser_user_id
    AND fm.approval_status = 'approved'
    LIMIT 1;

    v_result.winner_family_id := v_winner_family_id;
    v_result.loser_family_id := v_loser_family_id;

    -- =========================================================================
    -- FIND AGENCY MEMBERSHIPS (canonical: agency_members)
    -- =========================================================================
    SELECT am.agency_id INTO v_winner_agency_id
    FROM public.agency_members am
    WHERE am.user_id = p_winner_user_id
    AND am.status = 'active'
    LIMIT 1;

    SELECT am.agency_id INTO v_loser_agency_id
    FROM public.agency_members am
    WHERE am.user_id = p_loser_user_id
    AND am.status = 'active'
    LIMIT 1;

    v_result.winner_agency_id := v_winner_agency_id;
    v_result.loser_agency_id := v_loser_agency_id;

    -- =========================================================================
    -- DETERMINE PENALTIES
    -- =========================================================================
    IF p_forfeit THEN
        v_penalty_type := 'forfeit';
        v_penalty_points := 2;
        v_cooldown_seconds := 300; -- 5 minutes
    ELSIF p_disconnect THEN
        v_penalty_type := 'disconnect';
        v_penalty_points := 3;
        -- Progressive cooldown: check recent disconnects
        SELECT COUNT(*) INTO v_recent_similar
        FROM public.battle_audit_log bal
        WHERE bal.details->>'loser_id' = p_loser_user_id::text
        AND bal.event_type = 'disconnect_penalty'
        AND bal.created_at > NOW() - INTERVAL '24 hours';

        v_cooldown_seconds := CASE
            WHEN v_recent_similar >= 3 THEN 1800  -- 30 min
            WHEN v_recent_similar >= 2 THEN 900   -- 15 min
            ELSE 300                              -- 5 min
        END;
    ELSIF p_afk THEN
        v_penalty_type := 'afk';
        v_penalty_points := 1;
        v_cooldown_seconds := 0;
    END IF;

    v_result.penalty_applied := (v_penalty_type IS NOT NULL);
    v_result.penalty_type := v_penalty_type;
    v_result.cooldown_seconds := v_cooldown_seconds;

    -- =========================================================================
    -- RECORD BATTLE HISTORY (personal stats)
    -- =========================================================================
    -- Winner
    INSERT INTO public.battle_history (
        battle_id, user_id, opponent_id, won,
        paid_coins_received, paid_coins_sent, battle_duration_seconds, created_at
    ) VALUES (
        p_battle_id, p_winner_user_id, p_loser_user_id, true,
        p_winner_score, 0, v_battle_duration, NOW()
    );

    -- Loser
    INSERT INTO public.battle_history (
        battle_id, user_id, opponent_id, won,
        paid_coins_received, paid_coins_sent, battle_duration_seconds, created_at
    ) VALUES (
        p_battle_id, p_loser_user_id, p_winner_user_id, false,
        p_loser_score, 0, v_battle_duration, NOW()
    );

    -- =========================================================================
    -- UPDATE PERSONAL BATTLE STATS (user_profiles)
    -- =========================================================================
    -- Winner: increment wins
    UPDATE public.user_profiles
    SET
        battle_wins = COALESCE(battle_wins, 0) + 1,
        battle_win_streak = COALESCE(battle_win_streak, 0) + 1,
        battle_best_streak = GREATEST(COALESCE(battle_best_streak, 0), COALESCE(battle_win_streak, 0) + 1),
        updated_at = NOW()
    WHERE id = p_winner_user_id;

    -- Loser: increment losses, reset streak (unless AFK penalty — then no stats)
    IF NOT p_afk THEN
        UPDATE public.user_profiles
        SET
            battle_losses = COALESCE(battle_losses, 0) + 1,
            battle_win_streak = 0,
            updated_at = NOW()
        WHERE id = p_loser_user_id;
    END IF;

    -- Apply cooldown if penalty
    IF v_cooldown_seconds > 0 THEN
        UPDATE public.user_profiles
        SET
            battle_cooldown_until = NOW() + (v_cooldown_seconds || ' seconds')::interval,
            updated_at = NOW()
        WHERE id = p_loser_user_id;
    END IF;

    -- =========================================================================
    -- UPDATE FAMILY GOAL PROGRESS (winner only, unless farming)
    -- =========================================================================
    IF v_winner_family_id IS NOT NULL AND NOT v_is_farming THEN
        -- Battle wins goal
        FOR v_goal IN
            SELECT id, target_value, current_value
            FROM public.family_goals
            WHERE family_id = v_winner_family_id
            AND status = 'active'
            AND goal_type IN ('battle', 'competition', 'wars_won')
        LOOP
            INSERT INTO public.family_goal_progress (goal_id, user_id, family_id, contribution_value, last_activity_at)
            VALUES (v_goal.id, p_winner_user_id, v_winner_family_id, 1, NOW())
            ON CONFLICT (goal_id, user_id) DO UPDATE SET
                contribution_value = family_goal_progress.contribution_value + 1,
                last_activity_at = NOW();

            UPDATE public.family_goals
            SET current_value = (
                SELECT COALESCE(SUM(contribution_value), 0)::integer
                FROM public.family_goal_progress
                WHERE goal_id = v_goal.id
            ),
            status = CASE
                WHEN (SELECT COALESCE(SUM(contribution_value), 0) FROM public.family_goal_progress WHERE goal_id = v_goal.id) >= v_goal.target_value
                THEN 'completed'::text
                ELSE status
            END,
            completed_at = CASE
                WHEN (SELECT COALESCE(SUM(contribution_value), 0) FROM public.family_goal_progress WHERE goal_id = v_goal.id) >= v_goal.target_value
                THEN NOW()
                ELSE completed_at
            END,
            updated_at = NOW()
            WHERE id = v_goal.id;

            v_family_goals := v_family_goals + 1;
        END LOOP;

        -- Battle count goal (both families get participation)
        IF v_loser_family_id IS NOT NULL THEN
            FOR v_goal IN
                SELECT id, target_value, current_value
                FROM public.family_goals
                WHERE family_id = v_loser_family_id
                AND status = 'active'
                AND goal_type IN ('battle', 'participation', 'activity')
            LOOP
                INSERT INTO public.family_goal_progress (goal_id, user_id, family_id, contribution_value, last_activity_at)
                VALUES (v_goal.id, p_loser_user_id, v_loser_family_id, 1, NOW())
                ON CONFLICT (goal_id, user_id) DO UPDATE SET
                    contribution_value = family_goal_progress.contribution_value + 1,
                    last_activity_at = NOW();

                UPDATE public.family_goals
                SET current_value = (
                    SELECT COALESCE(SUM(contribution_value), 0)::integer
                    FROM public.family_goal_progress
                    WHERE goal_id = v_goal.id
                ),
                updated_at = NOW()
                WHERE id = v_goal.id;

                v_family_goals := v_family_goals + 1;
            END LOOP;
        END IF;
    END IF;

    -- =========================================================================
    -- UPDATE AGENCY GOAL PROGRESS
    -- =========================================================================
    IF v_winner_agency_id IS NOT NULL AND NOT v_is_farming THEN
        FOR v_goal IN
            SELECT id, target_value, current_value
            FROM public.agency_goals
            WHERE agency_id = v_winner_agency_id
            AND status = 'active'
            AND goal_type IN ('battle_wins', 'battle_count', 'agency_points')
        LOOP
            INSERT INTO public.agency_goal_progress (goal_id, agency_id, creator_id, progress_value, updated_at)
            VALUES (v_goal.id, v_winner_agency_id, p_winner_user_id, 1, NOW())
            ON CONFLICT (goal_id, creator_id) DO UPDATE SET
                progress_value = agency_goal_progress.progress_value + 1,
                updated_at = NOW();

            UPDATE public.agency_goals
            SET updated_at = NOW()
            WHERE id = v_goal.id;

            v_agency_goals := v_agency_goals + 1;
        END LOOP;
    END IF;

    -- =========================================================================
    -- UPDATE FAMILY WAR POINTS
    -- =========================================================================
    IF v_winner_family_id IS NOT NULL THEN
        -- Find active war involving winner's family
        SELECT * INTO v_war
        FROM public.family_wars
        WHERE status = 'active'
        AND (
            challenger_family_id = v_winner_family_id
            OR defender_family_id = v_winner_family_id
            OR family_a_id = v_winner_family_id
            OR family_b_id = v_winner_family_id
        )
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            -- Award war points to winner
            IF v_war.challenger_family_id = v_winner_family_id OR v_war.family_a_id = v_winner_family_id THEN
                UPDATE public.family_wars
                SET challenger_score = challenger_score + 3
                WHERE id = v_war.id;
                v_war_points := 3;
            ELSIF v_war.defender_family_id = v_winner_family_id OR v_war.family_b_id = v_winner_family_id THEN
                UPDATE public.family_wars
                SET defender_score = defender_score + 3
                WHERE id = v_war.id;
                v_war_points := 3;
            END IF;
        END IF;
    END IF;

    -- Apply penalty war points (deduct from loser's family)
    IF v_loser_family_id IS NOT NULL AND v_penalty_points > 0 THEN
        SELECT * INTO v_war
        FROM public.family_wars
        WHERE status = 'active'
        AND (
            challenger_family_id = v_loser_family_id
            OR defender_family_id = v_loser_family_id
            OR family_a_id = v_loser_family_id
            OR family_b_id = v_loser_family_id
        )
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            IF v_war.challenger_family_id = v_loser_family_id OR v_war.family_a_id = v_loser_family_id THEN
                UPDATE public.family_wars
                SET challenger_score = GREATEST(0, challenger_score - v_penalty_points)
                WHERE id = v_war.id;
            ELSIF v_war.defender_family_id = v_loser_family_id OR v_war.family_b_id = v_loser_family_id THEN
                UPDATE public.family_wars
                SET defender_score = GREATEST(0, defender_score - v_penalty_points)
                WHERE id = v_war.id;
            END IF;
        END IF;
    END IF;

    v_result.war_points_applied := v_war_points;
    v_result.family_goals_updated := v_family_goals;
    v_result.agency_goals_updated := v_agency_goals;

    -- =========================================================================
    -- RECORD TO FAMILY ACTIVITY EVENTS (for league standings)
    -- =========================================================================
    IF v_winner_family_id IS NOT NULL AND NOT v_is_farming THEN
        INSERT INTO public.troll_family_activity_events (
            family_id, user_id, event_type, amount, metadata, recorded_at
        ) VALUES (
            v_winner_family_id, p_winner_user_id, 'battle_won', 1,
            jsonb_build_object(
                'battle_id', p_battle_id,
                'opponent_id', p_loser_user_id,
                'score', p_winner_score,
                'stream_id', p_stream_id
            ),
            NOW()
        );
    END IF;

    -- =========================================================================
    -- AUDIT LOG
    -- =========================================================================
    INSERT INTO public.battle_audit_log (
        battle_id, event_type, details, created_at
    ) VALUES (
        p_battle_id,
        CASE
            WHEN v_penalty_type IS NOT NULL THEN v_penalty_type || '_penalty'
            ELSE 'battle_completed'
        END,
        jsonb_build_object(
            'winner_id', p_winner_user_id,
            'loser_id', p_loser_user_id,
            'winner_score', p_winner_score,
            'loser_score', p_loser_score,
            'winner_family_id', v_winner_family_id,
            'loser_family_id', v_loser_family_id,
            'winner_agency_id', v_winner_agency_id,
            'loser_agency_id', v_loser_agency_id,
            'forfeit', p_forfeit,
            'disconnect', p_disconnect,
            'afk', p_afk,
            'penalty_type', v_penalty_type,
            'penalty_points', v_penalty_points,
            'cooldown_seconds', v_cooldown_seconds,
            'war_points', v_war_points,
            'family_goals_updated', v_family_goals,
            'agency_goals_updated', v_agency_goals,
            'farming_detected', v_is_farming,
            'duration', v_battle_duration
        ),
        NOW()
    );

    v_result.success := true;
    v_result.message := 'Battle tracked successfully';

    RETURN v_result;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.track_battle_completion(
    uuid, uuid, uuid, uuid, integer, integer, boolean, boolean, boolean
) TO authenticated;

COMMIT;

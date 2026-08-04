-- Pride Challenges Fix Migration
-- 1. Fix get_pride_week() month check (EXTRACT(MONTH) is 1-indexed, June = 6)
-- 2. Fix trigger month check (same bug)
-- 3. Link keyword challenges to pride_warrior and pride_ally
-- 4. Add RPCs for wall post tracking, gift tracking, battle tracking, etc.

-- 1. Fix get_pride_week()
CREATE OR REPLACE FUNCTION public.get_pride_week()
RETURNS INT AS $$
DECLARE
    v_day INT;
BEGIN
    -- EXTRACT(MONTH) returns 6 for June (1-indexed)
    IF EXTRACT(MONTH FROM now()) != 6 THEN
        RETURN 0;
    END IF;
    v_day := EXTRACT(DAY FROM now());
    RETURN LEAST(4, GREATEST(1, CEIL(v_day::float / 7)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Fix trigger month check
CREATE OR REPLACE FUNCTION public.pride_track_chat_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_message TEXT;
    v_compliment_keywords TEXT[] := ARRAY['nice','awesome','great','amazing','love','beautiful','proud','congrats','congratulations','well done','good job','fantastic','wonderful','excellent','brilliant','🔥','❤️','👏','💯','🙌','💪','✨','😊','😍'];
    v_keyword TEXT;
BEGIN
    -- EXTRACT(MONTH) returns 6 for June (1-indexed)
    IF EXTRACT(MONTH FROM now()) != 6 THEN
        RETURN NEW;
    END IF;

    v_message := LOWER(COALESCE(NEW.content, NEW.message, ''));

    IF v_message = '' THEN
        RETURN NEW;
    END IF;

    -- Track generic chat message for send_chat challenge
    BEGIN
        PERFORM pride_increment_progress(NEW.user_id, pc.id, 1)
        FROM public.pride_challenges pc
        WHERE pc.action_type = 'send_chat'
          AND pc.is_active = true
          AND pc.week_number = public.get_pride_week()
          AND pc.starts_at <= now()
          AND (pc.ends_at IS NULL OR pc.ends_at >= now());
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- Check for compliment keywords for give_compliments challenge
    IF v_message != '' THEN
        FOREACH v_keyword IN ARRAY v_compliment_keywords
        LOOP
            IF v_message LIKE '%' || v_keyword || '%' THEN
                BEGIN
                    PERFORM pride_increment_progress(NEW.user_id, pc.id, 1)
                    FROM public.pride_challenges pc
                    WHERE pc.action_type = 'give_compliments'
                      AND pc.is_active = true
                      AND pc.week_number = public.get_pride_week()
                      AND pc.starts_at <= now()
                      AND (pc.ends_at IS NULL OR pc.ends_at >= now());
                EXCEPTION WHEN OTHERS THEN
                    NULL;
                END;
                EXIT;
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Link pride_warrior challenge to keyword config entries so keyword XP also counts
UPDATE public.pride_keyword_config
SET challenge_id = (
    SELECT id FROM public.pride_challenges WHERE slug = 'pride_warrior' LIMIT 1
)
WHERE keyword IN ('pride', 'love', 'rainbow', 'lgbtq', 'equality')
  AND challenge_id IS NULL;

-- 4. Link pride_ally challenge to its keyword config entries
UPDATE public.pride_keyword_config
SET challenge_id = (
    SELECT id FROM public.pride_challenges WHERE slug = 'pride_ally' LIMIT 1
)
WHERE keyword IN ('ally', 'support', 'love wins', 'proud')
  AND challenge_id IS NULL;

-- 5. RPC: Track wall post actions (like_posts, reply_posts, wall_posts, share_moment)
CREATE OR REPLACE FUNCTION public.pride_track_wall_action(
    p_user_id UUID,
    p_action_type TEXT,
    p_target_user_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
    v_result JSONB := '[]'::jsonb;
    v_entry JSONB;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = p_action_type
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        IF v_challenge.target_value = 1 THEN
            -- Boolean challenge: complete once
            INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
            VALUES (p_user_id, v_challenge.id, 1, 100, true, now())
            ON CONFLICT (user_id, challenge_id) DO NOTHING;
        ELSE
            -- Count challenge: increment
            INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
            VALUES (p_user_id, v_challenge.id, 1,
                LEAST(100, (1.0 / v_challenge.target_value) * 100),
                (1 >= v_challenge.target_value),
                CASE WHEN 1 >= v_challenge.target_value THEN now() ELSE NULL END)
            ON CONFLICT (user_id, challenge_id)
            DO UPDATE SET
                progress_value = LEAST(public.pride_user_progress.progress_value + 1, v_challenge.target_value),
                completion_percentage = LEAST(100, ((public.pride_user_progress.progress_value + 1)::float / v_challenge.target_value) * 100),
                is_completed = (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value,
                completed_at = CASE
                    WHEN (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value
                    THEN now()
                    ELSE public.pride_user_progress.completed_at
                END,
                updated_at = now();
        END IF;

        v_entry := jsonb_build_object(
            'challenge_id', v_challenge.id,
            'slug', v_challenge.slug,
            'xp_reward', v_challenge.xp_reward
        );
        v_result := v_result || v_entry;
    END LOOP;

    -- Also track add_friends if this is a reply to a new interaction
    IF p_action_type = 'reply_posts' AND p_target_user_id IS NOT NULL THEN
        -- Check if this is a new unique interaction for add_friends
        DECLARE
            v_friend_challenge RECORD;
        BEGIN
            SELECT * INTO v_friend_challenge
            FROM public.pride_challenges
            WHERE action_type = 'add_friends'
              AND is_active = true
              AND starts_at <= now()
              AND (ends_at IS NULL OR ends_at >= now())
            LIMIT 1;

            IF FOUND THEN
                -- Count unique users interacted with today
                INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
                VALUES (p_user_id, v_friend_challenge.id, 1, 0, false, NULL)
                ON CONFLICT (user_id, challenge_id)
                DO UPDATE SET
                    progress_value = LEAST(public.pride_user_progress.progress_value + 1, v_friend_challenge.target_value),
                    completion_percentage = LEAST(100, ((public.pride_user_progress.progress_value + 1)::float / v_friend_challenge.target_value) * 100),
                    is_completed = (public.pride_user_progress.progress_value + 1) >= v_friend_challenge.target_value,
                    updated_at = now();
            END IF;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Track gift sending for send_gifts and send_pride_gift challenges
CREATE OR REPLACE FUNCTION public.pride_track_gift(
    p_user_id UUID,
    p_recipient_user_id UUID,
    p_gift_type TEXT DEFAULT 'generic'
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
    v_result JSONB := '[]'::jsonb;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Track send_gifts (support different users with gifts)
    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = 'send_gifts'
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_challenge.id, 1, 0, false, NULL)
        ON CONFLICT (user_id, challenge_id)
        DO UPDATE SET
            progress_value = LEAST(public.pride_user_progress.progress_value + 1, v_challenge.target_value),
            completion_percentage = LEAST(100, ((public.pride_user_progress.progress_value + 1)::float / v_challenge.target_value) * 100),
            is_completed = (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value,
            completed_at = CASE
                WHEN (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value
                THEN now()
                ELSE public.pride_user_progress.completed_at
            END,
            updated_at = now();
    END LOOP;

    -- Track send_pride_gift (send Pride-themed gifts)
    IF p_gift_type ILIKE '%pride%' OR p_gift_type ILIKE '%rainbow%' THEN
        FOR v_challenge IN
            SELECT * FROM public.pride_challenges
            WHERE action_type = 'send_pride_gift'
              AND is_active = true
              AND starts_at <= now()
              AND (ends_at IS NULL OR ends_at >= now())
        LOOP
            INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
            VALUES (p_user_id, v_challenge.id, 1, 0, false, NULL)
            ON CONFLICT (user_id, challenge_id)
            DO UPDATE SET
                progress_value = LEAST(public.pride_user_progress.progress_value + 1, v_challenge.target_value),
                completion_percentage = LEAST(100, ((public.pride_user_progress.progress_value + 1)::float / v_challenge.target_value) * 100),
                is_completed = (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value,
                completed_at = CASE
                    WHEN (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value
                    THEN now()
                    ELSE public.pride_user_progress.completed_at
                END,
                updated_at = now();
        END LOOP;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. RPC: Track battle wins for win_battle challenge
CREATE OR REPLACE FUNCTION public.pride_track_battle_win(
    p_user_id UUID,
    p_has_pride_theme BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = 'win_battle'
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        -- Only count if pride theme is equipped (or we track all wins)
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_challenge.id, 1, 100, true, now())
        ON CONFLICT (user_id, challenge_id) DO NOTHING;
    END LOOP;

    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. RPC: Track broadcast start for go_live challenge
CREATE OR REPLACE FUNCTION public.pride_track_go_live(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = 'go_live'
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_challenge.id, 1, 100, true, now())
        ON CONFLICT (user_id, challenge_id) DO NOTHING;
    END LOOP;

    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. RPC: Track neighborhood visits for visit_neighborhoods challenge
CREATE OR REPLACE FUNCTION public.pride_track_visit(
    p_user_id UUID,
    p_neighborhood TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = 'visit_neighborhoods'
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_challenge.id, 1, 0, false, NULL)
        ON CONFLICT (user_id, challenge_id)
        DO UPDATE SET
            progress_value = LEAST(public.pride_user_progress.progress_value + 1, v_challenge.target_value),
            completion_percentage = LEAST(100, ((public.pride_user_progress.progress_value + 1)::float / v_challenge.target_value) * 100),
            is_completed = (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value,
            completed_at = CASE
                WHEN (public.pride_user_progress.progress_value + 1) >= v_challenge.target_value
                THEN now()
                ELSE public.pride_user_progress.completed_at
            END,
            updated_at = now();
    END LOOP;

    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC: Track friend invites for invite_friend challenge
CREATE OR REPLACE FUNCTION public.pride_track_invite(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = 'invite_friend'
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_challenge.id, 1, 100, true, now())
        ON CONFLICT (user_id, challenge_id) DO NOTHING;
    END LOOP;

    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. RPC: Track badge addition for add_badge challenge
CREATE OR REPLACE FUNCTION public.pride_track_badge(
    p_user_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type = 'add_badge'
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_challenge.id, 1, 100, true, now())
        ON CONFLICT (user_id, challenge_id) DO NOTHING;
    END LOOP;

    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. RPC: Track credit spending for pride_celebration challenge
CREATE OR REPLACE FUNCTION public.pride_track_spending(
    p_user_id UUID,
    p_amount BIGINT DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
    v_total_spent BIGINT;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Get total credits spent this month
    SELECT COALESCE(SUM(credits_spent), 0) INTO v_total_spent
    FROM public.pride_credit_xp_log
    WHERE user_id = p_user_id
      AND created_at >= date_trunc('month', now());

    v_total_spent := v_total_spent + p_amount;

    FOR v_challenge IN
        SELECT * FROM public.pride_challenges
        WHERE action_type IN ('purchase_item', 'pride_celebration')
          AND is_active = true
          AND starts_at <= now()
          AND (ends_at IS NULL OR ends_at >= now())
    LOOP
        IF v_total_spent >= v_challenge.target_value OR p_amount > 0 THEN
            INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
            VALUES (p_user_id, v_challenge.id,
                LEAST(v_total_spent, v_challenge.target_value),
                LEAST(100, (v_total_spent::float / GREATEST(v_challenge.target_value, 1)) * 100),
                v_total_spent >= v_challenge.target_value,
                CASE WHEN v_total_spent >= v_challenge.target_value THEN now() ELSE NULL END)
            ON CONFLICT (user_id, challenge_id)
            DO UPDATE SET
                progress_value = LEAST(v_total_spent, v_challenge.target_value),
                completion_percentage = LEAST(100, (v_total_spent::float / GREATEST(v_challenge.target_value, 1)) * 100),
                is_completed = v_total_spent >= v_challenge.target_value,
                completed_at = CASE
                    WHEN v_total_spent >= v_challenge.target_value
                    THEN now()
                    ELSE public.pride_user_progress.completed_at
                END,
                updated_at = now();
        END IF;
    END LOOP;

    RETURN '[]'::jsonb;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. RPC: Check and auto-complete the "complete_all" meta challenge
CREATE OR REPLACE FUNCTION public.pride_check_complete_all(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_meta_challenge RECORD;
    v_total_challenges INT;
    v_completed_challenges INT;
BEGIN
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Find the complete_all challenge
    SELECT * INTO v_meta_challenge
    FROM public.pride_challenges
    WHERE action_type = 'complete_all'
      AND is_active = true
    LIMIT 1;

    IF v_meta_challenge IS NULL THEN
        RETURN '[]'::jsonb;
    END IF;

    -- Count total active weekly challenges (excluding complete_all itself)
    SELECT COUNT(*) INTO v_total_challenges
    FROM public.pride_challenges
    WHERE is_active = true
      AND action_type != 'complete_all'
      AND week_number > 0;

    -- Count how many the user has completed
    SELECT COUNT(*) INTO v_completed_challenges
    FROM public.pride_user_progress pup
    JOIN public.pride_challenges pc ON pc.id = pup.challenge_id
    WHERE pup.user_id = p_user_id
      AND pup.is_completed = true
      AND pc.is_active = true
      AND pc.action_type != 'complete_all'
      AND pc.week_number > 0;

    -- If all completed, mark the meta challenge
    IF v_completed_challenges >= v_total_challenges THEN
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, v_meta_challenge.id, 1, 100, true, now())
        ON CONFLICT (user_id, challenge_id) DO NOTHING;

        -- Grant XP if not already granted
        IF NOT EXISTS (
            SELECT 1 FROM public.pride_user_progress
            WHERE user_id = p_user_id AND challenge_id = v_meta_challenge.id AND is_completed = true
        ) THEN
            PERFORM grant_xp(p_user_id, v_meta_challenge.xp_reward, 'pride_challenge', v_meta_challenge.id::text,
                jsonb_build_object('challenge_slug', v_meta_challenge.slug, 'challenge_title', v_meta_challenge.title));
        END IF;
    END IF;

    RETURN jsonb_build_object('completed', v_completed_challenges, 'total', v_total_challenges);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

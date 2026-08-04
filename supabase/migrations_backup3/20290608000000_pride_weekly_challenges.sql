-- Pride Weekly Challenges Migration
-- Adds 20 weekly pride challenges (5 per week x 4 weeks) and the pride_complete_challenge RPC

-- 1. Add week_number column to pride_challenges for weekly grouping
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pride_challenges' AND column_name = 'week_number'
  ) THEN
    ALTER TABLE public.pride_challenges ADD COLUMN week_number INT DEFAULT 0;
  END IF;
END $$;

-- 2. Add action_type column for frontend tracking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pride_challenges' AND column_name = 'action_type'
  ) THEN
    ALTER TABLE public.pride_challenges ADD COLUMN action_type TEXT DEFAULT 'generic';
    -- action_type values: 'equip_frame', 'send_chat', 'add_badge', 'like_posts', 'reply_posts',
    -- 'send_gifts', 'go_live', 'wall_posts', 'send_pride_gift', 'visit_neighborhoods',
    -- 'win_battle', 'invite_friend', 'purchase_item', 'voice_room', 'give_compliments',
    -- 'reach_leaderboard', 'active_days', 'add_friends', 'share_moment', 'complete_all'
  END IF;
END $$;

-- 3. Add color column for UI theming
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pride_challenges' AND column_name = 'ui_color'
  ) THEN
    ALTER TABLE public.pride_challenges ADD COLUMN ui_color TEXT DEFAULT 'pink';
  END IF;
END $$;

-- 4. Insert 20 weekly challenges
INSERT INTO public.pride_challenges (slug, title, description, category, xp_reward, target_value, progress_type, action_type, icon, sort_order, week_number, ui_color, starts_at, ends_at)
VALUES
  -- Week 1
  ('show_your_pride', 'Show Your Pride', 'Update your profile frame to a Pride theme', 'engagement', 500, 1, 'boolean', 'equip_frame', '🏳️‍🌈', 1, 1, 'pink', '2026-06-01T00:00:00Z', '2026-06-07T23:59:59Z'),
  ('rainbow_greeting', 'Rainbow Greeting', 'Send 10 positive chat messages today', 'chat', 750, 10, 'count', 'send_chat', '💬', 2, 1, 'red', '2026-06-01T00:00:00Z', '2026-06-07T23:59:59Z'),
  ('pride_profile', 'Pride Profile', 'Add a Pride badge to your profile', 'engagement', 300, 1, 'boolean', 'add_badge', '⭐', 3, 1, 'orange', '2026-06-01T00:00:00Z', '2026-06-07T23:59:59Z'),
  ('spread_love', 'Spread Love', 'Like 20 posts on the Troll Wall', 'social', 400, 20, 'count', 'like_posts', '❤️', 4, 1, 'yellow', '2026-06-01T00:00:00Z', '2026-06-07T23:59:59Z'),
  ('community_spirit', 'Community Spirit', 'Reply to 5 different wall posts', 'social', 600, 5, 'count', 'reply_posts', '🤝', 5, 1, 'green', '2026-06-01T00:00:00Z', '2026-06-07T23:59:59Z'),
  -- Week 2
  ('ally_actions', 'Ally Actions', 'Support 5 different users with gifts', 'social', 1000, 5, 'count', 'send_gifts', '🎁', 6, 2, 'cyan', '2026-06-08T00:00:00Z', '2026-06-14T23:59:59Z'),
  ('pride_stream', 'Pride Stream', 'Go live with a Pride-themed broadcast', 'engagement', 1500, 1, 'boolean', 'go_live', '📡', 7, 2, 'blue', '2026-06-08T00:00:00Z', '2026-06-14T23:59:59Z'),
  ('wall_storyteller', 'Wall Storyteller', 'Post 3 Pride-themed messages on the wall', 'social', 800, 3, 'count', 'wall_posts', '📝', 8, 2, 'purple', '2026-06-08T00:00:00Z', '2026-06-14T23:59:59Z'),
  ('gift_of_pride', 'Gift of Pride', 'Send a Pride gift to 3 friends', 'social', 900, 3, 'count', 'send_pride_gift', '🌈', 9, 2, 'pink', '2026-06-08T00:00:00Z', '2026-06-14T23:59:59Z'),
  ('pride_explorer', 'Pride Explorer', 'Visit 5 different neighborhoods', 'engagement', 600, 5, 'count', 'visit_neighborhoods', '🗺️', 10, 2, 'red', '2026-06-08T00:00:00Z', '2026-06-14T23:59:59Z'),
  -- Week 3
  ('pride_champion', 'Pride Champion', 'Win a battle with a Pride theme equipped', 'engagement', 1200, 1, 'boolean', 'win_battle', '⚔️', 11, 3, 'orange', '2026-06-15T00:00:00Z', '2026-06-21T23:59:59Z'),
  ('family_pride', 'Family Pride', 'Invite a friend to join your Troll Family', 'social', 1000, 1, 'boolean', 'invite_friend', '👨‍👩‍👧‍👦', 12, 3, 'yellow', '2026-06-15T00:00:00Z', '2026-06-21T23:59:59Z'),
  ('pride_collector', 'Pride Collector', 'Purchase a Pride item from the store', 'engagement', 750, 1, 'boolean', 'purchase_item', '🛍️', 13, 3, 'green', '2026-06-15T00:00:00Z', '2026-06-21T23:59:59Z'),
  ('voice_of_pride', 'Voice of Pride', 'Spend 30 minutes in a voice room', 'engagement', 500, 30, 'time', 'voice_room', '🎤', 14, 3, 'cyan', '2026-06-15T00:00:00Z', '2026-06-21T23:59:59Z'),
  ('pride_shoutout', 'Pride Shoutout', 'Give 10 compliments in chat', 'chat', 800, 10, 'count', 'give_compliments', '📣', 15, 3, 'blue', '2026-06-15T00:00:00Z', '2026-06-21T23:59:59Z'),
  -- Week 4
  ('pride_legend', 'Pride Legend', 'Reach top 10 on any leaderboard', 'engagement', 2000, 1, 'boolean', 'reach_leaderboard', '🏆', 16, 4, 'purple', '2026-06-22T00:00:00Z', '2026-06-30T23:59:59Z'),
  ('pride_marathon', 'Pride Marathon', 'Be active for 5 days this week', 'engagement', 1500, 5, 'count', 'active_days', '🔥', 17, 4, 'pink', '2026-06-22T00:00:00Z', '2026-06-30T23:59:59Z'),
  ('pride_connector', 'Pride Connector', 'Add 5 new friends to your list', 'social', 900, 5, 'count', 'add_friends', '👥', 18, 4, 'red', '2026-06-22T00:00:00Z', '2026-06-30T23:59:59Z'),
  ('pride_creator', 'Pride Creator', 'Share a Pride moment on your wall', 'social', 1000, 1, 'boolean', 'share_moment', '✨', 19, 4, 'orange', '2026-06-22T00:00:00Z', '2026-06-30T23:59:59Z'),
  ('ultimate_pride', 'Ultimate Pride', 'Complete all other Pride challenges', 'engagement', 5000, 1, 'boolean', 'complete_all', '👑', 20, 4, 'yellow', '2026-06-22T00:00:00Z', '2026-06-30T23:59:59Z')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  xp_reward = EXCLUDED.xp_reward,
  target_value = EXCLUDED.target_value,
  action_type = EXCLUDED.action_type,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  week_number = EXCLUDED.week_number,
  ui_color = EXCLUDED.ui_color,
  starts_at = EXCLUDED.starts_at,
  ends_at = EXCLUDED.ends_at;

-- 5. RPC: Complete a pride challenge and grant XP
CREATE OR REPLACE FUNCTION public.pride_complete_challenge(
    p_user_id UUID,
    p_challenge_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
    v_progress RECORD;
    v_xp_reward BIGINT;
BEGIN
    -- Skip guest users
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest users cannot complete challenges');
    END IF;

    -- Get challenge details
    SELECT * INTO v_challenge
    FROM public.pride_challenges
    WHERE id = p_challenge_id AND is_active = true;

    IF v_challenge IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
    END IF;

    -- Get or create user progress
    SELECT * INTO v_progress
    FROM public.pride_user_progress
    WHERE user_id = p_user_id AND challenge_id = p_challenge_id;

    IF v_progress IS NULL THEN
        -- Create progress entry
        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, p_challenge_id, v_challenge.target_value, 100, true, now())
        RETURNING * INTO v_progress;
    ELSIF v_progress.is_completed THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge already completed');
    ELSE
        -- Mark as completed
        UPDATE public.pride_user_progress
        SET progress_value = v_challenge.target_value,
            completion_percentage = 100,
            is_completed = true,
            completed_at = now(),
            updated_at = now()
        WHERE user_id = p_user_id AND challenge_id = p_challenge_id
        RETURNING * INTO v_progress;
    END IF;

    -- Grant XP
    v_xp_reward := v_challenge.xp_reward;
    IF v_xp_reward > 0 THEN
        PERFORM grant_xp(p_user_id, v_xp_reward, 'pride_challenge', p_challenge_id::text,
            jsonb_build_object('challenge_slug', v_challenge.slug, 'challenge_title', v_challenge.title));
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'xp_awarded', v_xp_reward,
        'challenge_title', v_challenge.title
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RPC: Increment progress on a pride challenge
CREATE OR REPLACE FUNCTION public.pride_increment_progress(
    p_user_id UUID,
    p_challenge_id UUID,
    p_amount BIGINT DEFAULT 1
)
RETURNS JSONB AS $$
DECLARE
    v_challenge RECORD;
    v_progress RECORD;
    v_new_progress BIGINT;
    v_new_percentage FLOAT;
    v_just_completed BOOLEAN := false;
BEGIN
    -- Skip guest users
    IF p_user_id IS NULL OR p_user_id::text LIKE 'TC-%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Guest users cannot progress challenges');
    END IF;

    -- Get challenge details
    SELECT * INTO v_challenge
    FROM public.pride_challenges
    WHERE id = p_challenge_id AND is_active = true;

    IF v_challenge IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Challenge not found or inactive');
    END IF;

    -- Get or create user progress
    SELECT * INTO v_progress
    FROM public.pride_user_progress
    WHERE user_id = p_user_id AND challenge_id = p_challenge_id;

    IF v_progress IS NULL THEN
        v_new_progress := LEAST(p_amount, v_challenge.target_value);
        v_new_percentage := (v_new_progress::float / v_challenge.target_value) * 100;
        v_just_completed := v_new_progress >= v_challenge.target_value;

        INSERT INTO public.pride_user_progress (user_id, challenge_id, progress_value, completion_percentage, is_completed, completed_at)
        VALUES (p_user_id, p_challenge_id, v_new_progress, v_new_percentage, v_just_completed,
                CASE WHEN v_just_completed THEN now() ELSE NULL END);
    ELSIF v_progress.is_completed THEN
        RETURN jsonb_build_object('success', true, 'message', 'Already completed', 'is_completed', true);
    ELSE
        v_new_progress := LEAST(v_progress.progress_value + p_amount, v_challenge.target_value);
        v_new_percentage := (v_new_progress::float / v_challenge.target_value) * 100;
        v_just_completed := v_new_progress >= v_challenge.target_value AND NOT v_progress.is_completed;

        UPDATE public.pride_user_progress
        SET progress_value = v_new_progress,
            completion_percentage = v_new_percentage,
            is_completed = v_just_completed,
            completed_at = CASE WHEN v_just_completed THEN now() ELSE completed_at END,
            updated_at = now()
        WHERE user_id = p_user_id AND challenge_id = p_challenge_id;
    END IF;

    -- Grant XP if just completed
    IF v_just_completed AND v_challenge.xp_reward > 0 THEN
        PERFORM grant_xp(p_user_id, v_challenge.xp_reward, 'pride_challenge', p_challenge_id::text,
            jsonb_build_object('challenge_slug', v_challenge.slug, 'challenge_title', v_challenge.title));
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'progress', v_new_progress,
        'target', v_challenge.target_value,
        'percentage', v_new_percentage,
        'is_completed', v_just_completed,
        'xp_awarded', CASE WHEN v_just_completed THEN v_challenge.xp_reward ELSE 0 END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Helper: get the current pride week number (1-4) based on current date
CREATE OR REPLACE FUNCTION public.get_pride_week()
RETURNS INT AS $$
DECLARE
    v_day INT;
BEGIN
    -- Only return week number during June (Pride Month)
    IF EXTRACT(MONTH FROM now()) != 5 THEN
        RETURN 0;
    END IF;
    v_day := EXTRACT(DAY FROM now());
    RETURN LEAST(4, GREATEST(1, CEIL(v_day::float / 7)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Trigger: auto-track chat messages for pride challenges
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
    -- Only during June (Pride Month)
    IF EXTRACT(MONTH FROM now()) != 5 THEN
        RETURN NEW;
    END IF;

    -- Get message content from either content or column
    v_message := LOWER(COALESCE(NEW.content, NEW.message, ''));

    IF v_message = '' THEN
        RETURN NEW;
    END IF;

    -- Track generic chat message for send_chat challenge
    BEGIN
        -- Find the send_chat challenge for the current week
        PERFORM pride_increment_progress(NEW.user_id, pc.id, 1)
        FROM public.pride_challenges pc
        WHERE pc.action_type = 'send_chat'
          AND pc.is_active = true
          AND pc.week_number = public.get_pride_week()
          AND pc.starts_at <= now()
          AND (pc.ends_at IS NULL OR pc.ends_at >= now());
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Silent fail
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
                    NULL; -- Silent fail
                END;
                EXIT; -- Only count one compliment per message
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

-- Attach trigger to stream_messages (chat)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_messages') THEN
        DROP TRIGGER IF EXISTS trg_pride_track_chat ON public.stream_messages;
        CREATE TRIGGER trg_pride_track_chat
        AFTER INSERT ON public.stream_messages
        FOR EACH ROW
        WHEN (NEW.message_type = 'chat' OR NEW.message_type IS NULL)
        EXECUTE FUNCTION public.pride_track_chat_message();
    END IF;
END $$;

-- 9. Credit-aware broadcast theme purchase RPC
CREATE OR REPLACE FUNCTION public.purchase_broadcast_theme_with_credit(
    p_user_id UUID,
    p_theme_id UUID,
    p_set_active BOOLEAN DEFAULT false,
    p_use_credit BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_theme record;
    v_cost numeric;
    v_credit_ok boolean;
    v_spend_result jsonb;
BEGIN
    -- 1. Get theme details
    SELECT * INTO v_theme
    FROM public.broadcast_background_themes
    WHERE id = p_theme_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Theme not found');
    END IF;

    v_cost := COALESCE(v_theme.price_coins, 0);

    -- 2. Check if already owned
    IF EXISTS (
        SELECT 1 FROM public.user_broadcast_theme_purchases
        WHERE user_id = p_user_id AND theme_id = p_theme_id
    ) THEN
        IF p_set_active THEN
            INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
            VALUES (p_user_id, p_theme_id, now())
            ON CONFLICT (user_id) DO UPDATE
            SET active_theme_id = EXCLUDED.active_theme_id,
                updated_at = now();
        END IF;
        RETURN jsonb_build_object('success', true, 'message', 'Already owned');
    END IF;

    -- 3. Spend coins or credit
    IF v_cost > 0 THEN
        IF p_use_credit THEN
            v_credit_ok := public.try_pay_with_credit_card(
                p_user_id,
                v_cost,
                'shop_purchase',
                jsonb_build_object('theme_id', p_theme_id, 'theme_name', v_theme.name)
            );
            IF NOT v_credit_ok THEN
                RETURN jsonb_build_object('success', false, 'error', 'Credit card payment failed');
            END IF;
        ELSE
            -- Use regular coin spending
            v_spend_result := public.troll_bank_spend_coins_secure(
                p_user_id,
                v_cost,
                'paid',
                'broadcast_theme_purchase',
                NULL,
                jsonb_build_object('theme_id', p_theme_id, 'theme_name', v_theme.name)
            );
            IF (v_spend_result->>'success')::boolean = false THEN
                RETURN v_spend_result;
            END IF;
        END IF;
    END IF;

    -- 4. Record purchase
    INSERT INTO public.user_broadcast_theme_purchases (user_id, theme_id, purchased_at, cost)
    VALUES (p_user_id, p_theme_id, now(), v_cost);

    -- 5. Activate if requested
    IF p_set_active THEN
        INSERT INTO public.user_broadcast_theme_state (user_id, active_theme_id, updated_at)
        VALUES (p_user_id, p_theme_id, now())
        ON CONFLICT (user_id) DO UPDATE
        SET active_theme_id = EXCLUDED.active_theme_id,
            updated_at = now();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Theme purchased',
        'theme_name', v_theme.name,
        'cost', v_cost,
        'payment_method', CASE WHEN p_use_credit THEN 'credit' ELSE 'coins' END
    );
END;
$$;

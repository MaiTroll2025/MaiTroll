CREATE OR REPLACE FUNCTION public.get_user_monthly_coins_earned(p_user_id UUID, p_month DATE)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_month_start DATE := date_trunc('month', p_month);
    v_month_end DATE := v_month_start + INTERVAL '1 month';
    v_total BIGINT;
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO v_total
    FROM coin_transactions
    WHERE user_id = p_user_id
      AND type = 'earned'
      AND created_at >= v_month_start
      AND created_at < v_month_end;
    RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_stream_seats(p_stream_id UUID)
RETURNS TABLE (
    seat_index INTEGER,
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    joined_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ss.seat_index,
        ss.user_id,
        up.username,
        up.avatar_url,
        ss.joined_at
    FROM stream_seats ss
    JOIN user_profiles up ON up.id = ss.user_id
    WHERE ss.stream_id = p_stream_id
      AND ss.is_active = true
    ORDER BY ss.seat_index;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_profile_statistics(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'total_earned_coins', up.total_earned_coins,
        'total_spent_coins', up.total_spent_coins,
        'total_coins_earned', up.total_coins_earned,
        'total_coins_spent', up.total_coins_spent,
        'battle_wins', COALESCE(ub.battle_wins, 0),
        'battle_losses', COALESCE(ub.battle_losses, 0),
        'troll_wars_wins', COALESCE(twb.total_wins, 0),
        'gifts_sent', COALESCE(gf.total_sent, 0),
        'gifts_received', COALESCE(gfr.total_received, 0),
        'stream_hours', COALESCE(sh.total_hours, 0),
        'profile_views', COALESCE(prv.total_views, 0)
    ) INTO v_result
    FROM user_profiles up
    LEFT JOIN (SELECT user_id, COUNT(*) AS battle_wins FROM battles WHERE winner_id = p_user_id GROUP BY user_id) ub ON ub.user_id = p_user_id
    LEFT JOIN (SELECT user_id, COUNT(*) AS battle_losses FROM battles WHERE opponent_id = p_user_id AND result = 'loss' GROUP BY user_id) ub2 ON ub2.user_id = p_user_id
    LEFT JOIN (SELECT user_id, SUM(wins) AS total_wins FROM trollmers_weekly_leaderboard WHERE user_id = p_user_id GROUP BY user_id) twb ON twb.user_id = p_user_id
    LEFT JOIN (SELECT sender_id, COUNT(*) AS total_sent FROM stream_gifts WHERE sender_id = p_user_id GROUP BY sender_id) gf ON gf.sender_id = p_user_id
    LEFT JOIN (SELECT receiver_id, COUNT(*) AS total_received FROM stream_gifts WHERE receiver_id = p_user_id GROUP BY receiver_id) gfr ON gfr.receiver_id = p_user_id
    LEFT JOIN (SELECT user_id, SUM(duration_seconds) AS total_hours FROM rtc_sessions WHERE user_id = p_user_id GROUP BY user_id) sh ON sh.user_id = p_user_id
    LEFT JOIN (SELECT user_id, COUNT(*) AS total_views FROM profile_views WHERE viewed_user_id = p_user_id GROUP BY user_id) prv ON prv.user_id = p_user_id
    WHERE up.id = p_user_id;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_family_task_counts(p_family_id UUID, p_week_start DATE)
RETURNS TABLE (
    task_count BIGINT,
    completed_count BIGINT,
    pending_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS task_count,
        COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed_count,
        COUNT(*) FILTER (WHERE status != 'completed')::BIGINT AS pending_count
    FROM family_tasks ft
    WHERE ft.family_id = p_family_id
      AND ft.week_start = p_week_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trollmers_week_start(p_user_id UUID)
RETURNS DATE
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_week_start DATE;
BEGIN
    v_week_start := date_trunc('week', NOW())::DATE;
    RETURN v_week_start;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_trollmin_stats(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
    v_result JSON;
BEGIN
    SELECT json_build_object(
        'trollmin_level', COALESCE(tm.level, 1),
        'trollmin_xp', COALESCE(tm.xp, 0),
        'trollmin_coins', COALESCE(tm.coins_earned, 0),
        'trollmin_actions_today', COALESCE(ta.today_count, 0),
        'trollmin_streak', COALESCE(tm.streak, 0)
    ) INTO v_result
    FROM user_profiles up
    LEFT JOIN trollmin_profiles tm ON tm.user_id = up.id
    LEFT JOIN (SELECT user_id, COUNT(*) AS today_count FROM trollmin_actions WHERE user_id = p_user_id AND created_at >= date_trunc('day', NOW()) GROUP BY user_id) ta ON ta.user_id = p_user_id
    WHERE up.id = p_user_id;

    RETURN COALESCE(v_result, '{}'::json);
END;
$$;

ALTER FUNCTION public.get_user_monthly_coins_earned(p_user_id UUID, p_month DATE) OWNER TO postgres;
ALTER FUNCTION public.get_stream_seats(p_stream_id UUID) OWNER TO postgres;
ALTER FUNCTION public.get_profile_statistics(p_user_id UUID) OWNER TO postgres;
ALTER FUNCTION public.get_weekly_family_task_counts(p_family_id UUID, p_week_start DATE) OWNER TO postgres;
ALTER FUNCTION public.get_trollmers_week_start(p_user_id UUID) OWNER TO postgres;
ALTER FUNCTION public.get_trollmin_stats(p_user_id UUID) OWNER TO postgres;

GRANT ALL ON FUNCTION public.get_user_monthly_coins_earned(p_user_id UUID, p_month DATE) TO authenticated;
GRANT ALL ON FUNCTION public.get_stream_seats(p_stream_id UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_profile_statistics(p_user_id UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_weekly_family_task_counts(p_family_id UUID, p_week_start DATE) TO authenticated;
GRANT ALL ON FUNCTION public.get_trollmers_week_start(p_user_id UUID) TO authenticated;
GRANT ALL ON FUNCTION public.get_trollmin_stats(p_user_id UUID) TO authenticated;
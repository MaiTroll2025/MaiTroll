-- Seed new goal metrics and update eligibility logic
-- This is split to avoid using new enum values before the enum transaction commits.

CREATE OR REPLACE FUNCTION public.check_creator_weekly_eligibility(
    p_user_id UUID,
    p_batch_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_season RECORD;
    v_task RECORD;
    v_stats RECORD;
    v_is_eligible BOOLEAN := true;
    v_details JSONB := '{}'::jsonb;
    v_metric_val INTEGER;
    v_task_met BOOLEAN;
    v_effective_threshold INTEGER;
    v_user_role TEXT;
    v_is_admin BOOLEAN;
    v_is_troll_officer BOOLEAN;
    v_is_lead_officer BOOLEAN;
    v_is_staff BOOLEAN := false;
BEGIN
    -- Get batch info
    SELECT * INTO v_batch FROM public.payout_batches WHERE id = p_batch_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'Batch not found'); END IF;

    -- Get active season
    SELECT * INTO v_season FROM public.task_seasons 
    WHERE is_active = true 
    AND start_date <= v_batch.week_start 
    AND end_date >= v_batch.week_end;
    
    IF NOT FOUND THEN RETURN jsonb_build_object('eligible', false, 'reason', 'No active season for this period'); END IF;

    -- Check staff bypass
    SELECT role, is_admin, is_troll_officer, is_lead_officer
    INTO v_user_role, v_is_admin, v_is_troll_officer, v_is_lead_officer
    FROM public.user_profiles
    WHERE id = p_user_id;

    v_is_staff := COALESCE(v_is_admin, false)
        OR COALESCE(v_is_troll_officer, false)
        OR COALESCE(v_is_lead_officer, false)
        OR v_user_role IN ('admin', 'troll_officer', 'lead_troll_officer');

    IF v_is_staff THEN
        RETURN jsonb_build_object(
            'eligible', false,
            'bonus_eligible', false,
            'bypass', true,
            'reason', 'staff_bypass',
            'season_name', v_season.name,
            'metrics', '{}'::jsonb
        );
    END IF;

    -- Aggregated stats for the week
    SELECT 
        SUM(live_minutes) as live_minutes,
        SUM(live_sessions) as live_sessions,
        SUM(chat_messages) as chat_messages,
        SUM(gifts_sent) as gifts_sent,
        SUM(gifts_received) as gifts_received,
        SUM(posts_made) as posts_made,
        SUM(shares) as shares,
        SUM(battles_won) as battles_won,
        MAX(has_strikes::int)::boolean as has_strikes,
        MAX(has_fraud::int)::boolean as has_fraud
    INTO v_stats
    FROM public.creator_daily_stats
    WHERE user_id = p_user_id 
    AND stat_date >= v_batch.week_start 
    AND stat_date <= v_batch.week_end;

    -- Gifter stats (calculated on demand for accuracy)
    v_stats.unique_gifters := public.get_unique_gifters_count(p_user_id, v_batch.week_start, v_batch.week_end);
    v_stats.returning_gifters := public.get_returning_gifters_count(p_user_id, v_batch.week_start, v_batch.week_end);

    -- Check each task in the season
    FOR v_task IN 
        SELECT st.*, tt.metric, tt.cadence 
        FROM public.season_tasks st
        JOIN public.task_templates tt ON st.template_id = tt.id
        WHERE st.season_id = v_season.id
    LOOP
        v_effective_threshold := public.compute_task_threshold(p_user_id, v_task.threshold, v_batch.week_start, v_task.metric::text);

        -- Map metric to stat
        CASE v_task.metric
            WHEN 'live_minutes' THEN v_metric_val := COALESCE(v_stats.live_minutes, 0);
            WHEN 'live_sessions' THEN v_metric_val := COALESCE(v_stats.live_sessions, 0);
            WHEN 'chat_messages' THEN v_metric_val := COALESCE(v_stats.chat_messages, 0);
            WHEN 'unique_gifters' THEN v_metric_val := COALESCE(v_stats.unique_gifters, 0);
            WHEN 'returning_gifters' THEN v_metric_val := COALESCE(v_stats.returning_gifters, 0);
            WHEN 'gifts_sent' THEN v_metric_val := COALESCE(v_stats.gifts_sent, 0);
            WHEN 'gifts_received' THEN v_metric_val := COALESCE(v_stats.gifts_received, 0);
            WHEN 'posts_made' THEN v_metric_val := COALESCE(v_stats.posts_made, 0);
            WHEN 'shares' THEN v_metric_val := COALESCE(v_stats.shares, 0);
            WHEN 'battles_won' THEN v_metric_val := COALESCE(v_stats.battles_won, 0);
            WHEN 'no_strikes' THEN v_metric_val := CASE WHEN v_stats.has_strikes THEN 0 ELSE 1 END;
            WHEN 'no_fraud' THEN v_metric_val := CASE WHEN v_stats.has_fraud THEN 0 ELSE 1 END;
            ELSE v_metric_val := 0;
        END CASE;

        v_task_met := v_metric_val >= v_effective_threshold;
        
        IF NOT v_task_met THEN
            v_is_eligible := false;
        END IF;

        v_details := v_details || jsonb_build_object(
            v_task.metric::text, 
            jsonb_build_object(
                'current', v_metric_val, 
                'threshold', v_effective_threshold, 
                'met', v_task_met
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'eligible', v_is_eligible,
        'bonus_eligible', v_is_eligible,
        'bypass', false,
        'season_name', v_season.name,
        'metrics', v_details
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'gifts_sent', 'daily', 5, 'Send gifts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'gifts_sent' AND cadence = 'daily'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'gifts_sent', 'weekly', 50, 'Send gifts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'gifts_sent' AND cadence = 'weekly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'gifts_sent', 'monthly', 200, 'Send gifts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'gifts_sent' AND cadence = 'monthly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'gifts_received', 'daily', 3, 'Receive gifts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'gifts_received' AND cadence = 'daily'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'gifts_received', 'weekly', 30, 'Receive gifts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'gifts_received' AND cadence = 'weekly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'gifts_received', 'monthly', 120, 'Receive gifts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'gifts_received' AND cadence = 'monthly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'posts_made', 'daily', 1, 'Create posts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'posts_made' AND cadence = 'daily'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'posts_made', 'weekly', 5, 'Create posts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'posts_made' AND cadence = 'weekly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'posts_made', 'monthly', 20, 'Create posts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'posts_made' AND cadence = 'monthly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'shares', 'daily', 2, 'Share posts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'shares' AND cadence = 'daily'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'shares', 'weekly', 10, 'Share posts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'shares' AND cadence = 'weekly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'shares', 'monthly', 40, 'Share posts'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'shares' AND cadence = 'monthly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'battles_won', 'daily', 1, 'Win battles'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'battles_won' AND cadence = 'daily'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'battles_won', 'weekly', 3, 'Win battles'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'battles_won' AND cadence = 'weekly'
);

INSERT INTO public.task_templates (metric, cadence, default_threshold, description)
SELECT 'battles_won', 'monthly', 10, 'Win battles'
WHERE NOT EXISTS (
    SELECT 1 FROM public.task_templates WHERE metric = 'battles_won' AND cadence = 'monthly'
);

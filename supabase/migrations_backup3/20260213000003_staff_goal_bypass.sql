-- Staff bypass for creator seasonal goals (no 2.5% bonus)

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
        -- Map metric to stat
        CASE v_task.metric
            WHEN 'live_minutes' THEN v_metric_val := COALESCE(v_stats.live_minutes, 0);
            WHEN 'live_sessions' THEN v_metric_val := COALESCE(v_stats.live_sessions, 0);
            WHEN 'chat_messages' THEN v_metric_val := COALESCE(v_stats.chat_messages, 0);
            WHEN 'unique_gifters' THEN v_metric_val := COALESCE(v_stats.unique_gifters, 0);
            WHEN 'returning_gifters' THEN v_metric_val := COALESCE(v_stats.returning_gifters, 0);
            WHEN 'no_strikes' THEN v_metric_val := CASE WHEN v_stats.has_strikes THEN 0 ELSE 1 END;
            WHEN 'no_fraud' THEN v_metric_val := CASE WHEN v_stats.has_fraud THEN 0 ELSE 1 END;
            ELSE v_metric_val := 0;
        END CASE;

        v_task_met := v_metric_val >= v_task.threshold;
        
        IF NOT v_task_met THEN
            v_is_eligible := false;
        END IF;

        v_details := v_details || jsonb_build_object(
            v_task.metric::text, 
            jsonb_build_object(
                'current', v_metric_val, 
                'threshold', v_task.threshold, 
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

CREATE OR REPLACE FUNCTION public.request_payout(
    p_tier_id UUID,
    p_coin_amount BIGINT,
    p_cash_amount NUMERIC,
    p_currency TEXT DEFAULT 'USD'
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_batch_id UUID;
    v_eligibility JSONB;
    v_bonus_amount BIGINT := 0;
    v_bonus_applied BOOLEAN := false;
    v_payout_id UUID;
    v_user_balance BIGINT;
    v_user_reserved BIGINT;
    v_paypal_email TEXT;
    v_user_role TEXT;
    v_is_admin BOOLEAN;
    v_is_troll_officer BOOLEAN;
    v_is_lead_officer BOOLEAN;
    v_is_staff BOOLEAN := false;
BEGIN
    -- Get current batch
    v_batch_id := public.get_current_payout_batch();

    -- Check balance and payout method
    SELECT troll_coins, COALESCE(reserved_troll_coins, 0), payout_paypal_email, role, is_admin, is_troll_officer, is_lead_officer
    INTO v_user_balance, v_user_reserved, v_paypal_email, v_user_role, v_is_admin, v_is_troll_officer, v_is_lead_officer
    FROM public.user_profiles 
    WHERE id = v_user_id;

    IF v_paypal_email IS NULL OR v_paypal_email = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Please set your PayPal email in settings first');
    END IF;

    IF v_user_balance - v_user_reserved < p_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    v_is_staff := COALESCE(v_is_admin, false)
        OR COALESCE(v_is_troll_officer, false)
        OR COALESCE(v_is_lead_officer, false)
        OR v_user_role IN ('admin', 'troll_officer', 'lead_troll_officer');

    -- Check weekly eligibility for bonus
    v_eligibility := public.check_creator_weekly_eligibility(v_user_id, v_batch_id);

    IF NOT v_is_staff AND (v_eligibility->>'eligible')::BOOLEAN THEN
        v_bonus_applied := true;
        v_bonus_amount := FLOOR(p_cash_amount * 0.025 * 100); -- 2.5% bonus in cents
    END IF;

    -- Insert payout request
    INSERT INTO public.payout_requests (
        user_id,
        coin_amount,
        cash_amount,
        currency,
        status,
        batch_id,
        bonus_applied,
        bonus_amount,
        eligibility_snapshot,
        net_amount
    ) VALUES (
        v_user_id,
        p_coin_amount,
        p_cash_amount,
        p_currency,
        'pending',
        v_batch_id,
        v_bonus_applied,
        v_bonus_amount / 100.0, -- Store in dollars
        v_eligibility,
        p_cash_amount + (v_bonus_amount / 100.0)
    ) RETURNING id INTO v_payout_id;

    -- Reserve coins
    UPDATE public.user_profiles 
    SET reserved_troll_coins = v_user_reserved + p_coin_amount
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'payout_id', v_payout_id, 
        'bonus_applied', v_bonus_applied,
        'bonus_amount', v_bonus_amount / 100.0
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

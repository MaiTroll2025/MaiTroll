-- Dynamic goal metrics + balance-based thresholds

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_metric_type') THEN
        CREATE TYPE public.task_metric_type AS ENUM (
            'live_minutes',
            'live_sessions',
            'chat_messages',
            'unique_gifters',
            'returning_gifters',
            'no_strikes',
            'no_fraud',
            'gifts_sent',
            'gifts_received',
            'posts_made',
            'shares',
            'battles_won'
        );
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_cadence') THEN
        CREATE TYPE public.task_cadence AS ENUM ('daily', 'weekly', 'monthly');
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_metric_type') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gifts_sent' AND enumtypid = 'task_metric_type'::regtype) THEN
            ALTER TYPE public.task_metric_type ADD VALUE 'gifts_sent';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gifts_received' AND enumtypid = 'task_metric_type'::regtype) THEN
            ALTER TYPE public.task_metric_type ADD VALUE 'gifts_received';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'posts_made' AND enumtypid = 'task_metric_type'::regtype) THEN
            ALTER TYPE public.task_metric_type ADD VALUE 'posts_made';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'shares' AND enumtypid = 'task_metric_type'::regtype) THEN
            ALTER TYPE public.task_metric_type ADD VALUE 'shares';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'battles_won' AND enumtypid = 'task_metric_type'::regtype) THEN
            ALTER TYPE public.task_metric_type ADD VALUE 'battles_won';
        END IF;
    END IF;
END $$;

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_templates') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'metric'
        ) THEN
            ALTER TABLE public.task_templates ADD COLUMN metric task_metric_type;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'cadence'
        ) THEN
            ALTER TABLE public.task_templates ADD COLUMN cadence task_cadence;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'default_threshold'
        ) THEN
            ALTER TABLE public.task_templates ADD COLUMN default_threshold INTEGER;
        END IF;

        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'task_templates' AND column_name = 'description'
        ) THEN
            ALTER TABLE public.task_templates ADD COLUMN description TEXT;
        END IF;
    END IF;
END $$;

ALTER TABLE public.creator_daily_stats
    ADD COLUMN IF NOT EXISTS gifts_sent INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS gifts_received INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS posts_made INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS battles_won INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.troll_wall_post_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.troll_wall_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.troll_wall_post_shares ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'troll_wall_post_shares' AND policyname = 'Users can insert own shares'
  ) THEN
    CREATE POLICY "Users can insert own shares" ON public.troll_wall_post_shares
      FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'troll_wall_post_shares' AND policyname = 'Users can view own shares'
  ) THEN
    CREATE POLICY "Users can view own shares" ON public.troll_wall_post_shares
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_gifts_sent_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    SELECT (
        COALESCE((SELECT COUNT(*) FROM public.stream_gifts WHERE sender_id = p_user_id AND created_at::DATE >= p_start_date AND created_at::DATE <= p_end_date), 0)
      + COALESCE((SELECT COUNT(*) FROM public.troll_wall_gifts WHERE sender_id = p_user_id AND created_at::DATE >= p_start_date AND created_at::DATE <= p_end_date), 0)
    )::INTEGER;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_gifts_received_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    SELECT (
                COALESCE((
                        SELECT COUNT(*)
                        FROM public.stream_gifts
                        WHERE (recipient_id = p_user_id OR receiver_id = p_user_id)
                            AND created_at::DATE >= p_start_date
                            AND created_at::DATE <= p_end_date
                ), 0)
      + COALESCE((
            SELECT COUNT(*)
            FROM public.troll_wall_gifts twg
            JOIN public.troll_wall_posts twp ON twp.id = twg.post_id
            WHERE twp.user_id = p_user_id
              AND twg.created_at::DATE >= p_start_date
              AND twg.created_at::DATE <= p_end_date
        ), 0)
    )::INTEGER;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_posts_made_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    SELECT (
        COALESCE((SELECT COUNT(*) FROM public.troll_wall_posts WHERE user_id = p_user_id AND created_at::DATE >= p_start_date AND created_at::DATE <= p_end_date), 0)
      + COALESCE((SELECT COUNT(*) FROM public.troll_posts WHERE user_id = p_user_id AND created_at::DATE >= p_start_date AND created_at::DATE <= p_end_date), 0)
    )::INTEGER;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_shares_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    SELECT COALESCE((
        SELECT COUNT(*) FROM public.troll_wall_post_shares
        WHERE user_id = p_user_id
          AND created_at::DATE >= p_start_date
          AND created_at::DATE <= p_end_date
    ), 0)::INTEGER;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_battles_won_count(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
) RETURNS INTEGER AS $$
    SELECT (
        COALESCE((
            SELECT COUNT(*)
            FROM public.battles b
            JOIN public.streams s ON s.id = b.winner_stream_id
            WHERE s.user_id = p_user_id
              AND b.ended_at IS NOT NULL
              AND b.ended_at::DATE >= p_start_date
              AND b.ended_at::DATE <= p_end_date
        ), 0)
      + COALESCE((
            SELECT COUNT(*)
            FROM public.troll_battles tb
            WHERE tb.winner_id = p_user_id
              AND tb.end_time IS NOT NULL
              AND tb.end_time::DATE >= p_start_date
              AND tb.end_time::DATE <= p_end_date
        ), 0)
    )::INTEGER;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.compute_task_threshold(
    p_user_id UUID,
    p_base_threshold INTEGER,
    p_week_start DATE,
    p_metric TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_balance BIGINT := 0;
    v_scale NUMERIC := 1.0;
    v_jitter NUMERIC := 0.0;
    v_hash BIGINT;
BEGIN
    SELECT COALESCE(troll_coins, 0) + COALESCE(paid_coins, 0)
    INTO v_balance
    FROM public.user_profiles
    WHERE id = p_user_id;

    IF NOT FOUND THEN
        v_balance := 0;
    END IF;

    IF v_balance < 10000 THEN
        v_scale := 0.6;
    ELSIF v_balance < 100000 THEN
        v_scale := 0.8;
    ELSE
        v_scale := 1.0;
    END IF;

    v_hash := ('x' || substr(md5(p_user_id::text || p_week_start::text || p_metric), 1, 8))::bit(32)::int;
    v_jitter := ((v_hash % 21) - 10) / 100.0; -- -0.10..+0.10
    v_scale := v_scale + v_jitter;

    IF v_scale < 0.5 THEN v_scale := 0.5; END IF;
    IF v_scale > 1.0 THEN v_scale := 1.0; END IF;

    RETURN GREATEST(1, FLOOR(p_base_threshold * v_scale));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.refresh_my_daily_stats(p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    INSERT INTO public.creator_daily_stats (
        user_id,
        stat_date,
        live_minutes,
        live_sessions,
        chat_messages,
        unique_gifters,
        returning_gifters,
        gifts_sent,
        gifts_received,
        posts_made,
        shares,
        battles_won
    )
    SELECT 
        v_user_id,
        p_date,
        (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (updated_at - created_at))/60), 0) FROM public.live_sessions WHERE user_id = v_user_id AND created_at::DATE = p_date),
        (SELECT COUNT(*) FROM public.live_sessions WHERE user_id = v_user_id AND created_at::DATE = p_date),
        (SELECT COUNT(*) FROM public.chat_messages WHERE user_id = v_user_id AND created_at::DATE = p_date),
        public.get_unique_gifters_count(v_user_id, p_date, p_date),
        public.get_returning_gifters_count(v_user_id, p_date, p_date),
        public.get_gifts_sent_count(v_user_id, p_date, p_date),
        public.get_gifts_received_count(v_user_id, p_date, p_date),
        public.get_posts_made_count(v_user_id, p_date, p_date),
        public.get_shares_count(v_user_id, p_date, p_date),
        public.get_battles_won_count(v_user_id, p_date, p_date)
    ON CONFLICT (user_id, stat_date) DO UPDATE SET
        live_minutes = EXCLUDED.live_minutes,
        live_sessions = EXCLUDED.live_sessions,
        chat_messages = EXCLUDED.chat_messages,
        unique_gifters = EXCLUDED.unique_gifters,
        returning_gifters = EXCLUDED.returning_gifters,
        gifts_sent = EXCLUDED.gifts_sent,
        gifts_received = EXCLUDED.gifts_received,
        posts_made = EXCLUDED.posts_made,
        shares = EXCLUDED.shares,
        battles_won = EXCLUDED.battles_won,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- Expanded Mai Troll League System
-- Adds long-term league progression, mission generation, and real leaderboard snapshots.

-- 1. Upgrade existing league_events schema to support system-generated Mai Troll events
ALTER TABLE IF EXISTS public.league_events
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS theme_key TEXT NOT NULL DEFAULT 'troll_city',
  ADD COLUMN IF NOT EXISTS points_multiplier NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS public.league_events DROP CONSTRAINT IF EXISTS league_events_type_check;
ALTER TABLE IF EXISTS public.league_events DROP CONSTRAINT IF EXISTS league_events_status_check;
ALTER TABLE IF EXISTS public.league_events ADD CONSTRAINT league_events_type_check CHECK (type IN (
    'daily',
    'weekly',
    'hourly',
    'thirty_min_heat',
    'battle',
    'creator',
    'weekly_clash',
    'daily_sprint',
    'gift_rush',
    'battle_frenzy',
    'viewer_grind',
    'broadcaster_boost',
    'neighborhood_war',
    'court_showdown',
    'auction_rush',
    'friday_battle_day',
    'paid_chat_push',
    'city_pulse_frenzy',
    'troll_wheel_weekend',
    'midnight_troll_rush',
    'neon_crown_chase',
    'tcnn_breaking_league'
));
ALTER TABLE IF EXISTS public.league_events ADD CONSTRAINT league_events_status_check CHECK (status IN ('scheduled', 'active', 'ended', 'archived'));

-- 2. Core league point events
CREATE TABLE IF NOT EXISTS public.league_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    league_event_id UUID REFERENCES public.league_events(id) ON DELETE CASCADE,
    stream_id UUID NULL,
    event_type TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Fast leaderboard snapshot table for LeaguesTab
CREATE TABLE IF NOT EXISTS public.league_leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_event_id UUID NOT NULL REFERENCES public.league_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    username TEXT NULL,
    display_name TEXT NULL,
    avatar_url TEXT NULL,
    rank INTEGER NOT NULL,
    score INTEGER NOT NULL DEFAULT 0,
    total_gifts INTEGER NOT NULL DEFAULT 0,
    stream_count INTEGER NOT NULL DEFAULT 0,
    battle_count INTEGER NOT NULL DEFAULT 0,
    mission_count INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(league_event_id, user_id)
);

-- 4. User league missions
CREATE TABLE IF NOT EXISTS public.user_league_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    league_event_id UUID REFERENCES public.league_events(id) ON DELETE CASCADE,
    mission_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    current_value INTEGER NOT NULL DEFAULT 0,
    reward_points INTEGER NOT NULL DEFAULT 0,
    reward_xp INTEGER NOT NULL DEFAULT 0,
    reward_coins INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    generated_by TEXT NOT NULL DEFAULT 'system',
    completed_at TIMESTAMPTZ NULL,
    claimed_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_league_missions_status_check CHECK (status IN ('active', 'completed', 'claimed', 'expired'))
);

-- 5. Event templates for system-created themed leagues
CREATE TABLE IF NOT EXISTS public.league_event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT UNIQUE NOT NULL,
    name_template TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    duration_hours INTEGER NOT NULL DEFAULT 24,
    points_multiplier NUMERIC NOT NULL DEFAULT 1,
    theme_key TEXT NOT NULL DEFAULT 'troll_city',
    weight INTEGER NOT NULL DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Mission templates for auto-generated user missions
CREATE TABLE IF NOT EXISTS public.mission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_key TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    title_template TEXT NOT NULL,
    description_template TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_min INTEGER NOT NULL,
    target_max INTEGER NOT NULL,
    reward_points INTEGER NOT NULL DEFAULT 0,
    reward_xp INTEGER NOT NULL DEFAULT 0,
    reward_coins INTEGER NOT NULL DEFAULT 0,
    difficulty TEXT NOT NULL DEFAULT 'normal',
    weight INTEGER NOT NULL DEFAULT 1,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT mission_templates_difficulty_check CHECK (difficulty IN ('easy', 'normal', 'hard', 'elite'))
);

ALTER TABLE IF EXISTS public.mission_templates
  ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE public.mission_templates
SET slug = mission_key
WHERE slug IS NULL OR slug = '';

ALTER TABLE IF EXISTS public.mission_templates
  ALTER COLUMN slug SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_templates_slug ON public.mission_templates(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_mission_templates_mission_key ON public.mission_templates(mission_key);

-- Legacy mission_templates compatibility
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mission_templates' AND column_name = 'name'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates ALTER COLUMN name DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mission_templates' AND column_name = 'description'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates ALTER COLUMN description DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mission_templates' AND column_name = 'mission_type'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates ALTER COLUMN mission_type DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mission_templates' AND column_name = 'target_metric'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates ALTER COLUMN target_metric DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mission_templates' AND column_name = 'target_value'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates ALTER COLUMN target_value DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mission_templates' AND column_name = 'difficulty'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates ALTER COLUMN difficulty DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'mission_templates' AND constraint_name = 'mission_templates_mission_type_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates DROP CONSTRAINT mission_templates_mission_type_check';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'public' AND table_name = 'mission_templates' AND constraint_name = 'mission_templates_difficulty_check'
  ) THEN
    EXECUTE 'ALTER TABLE public.mission_templates DROP CONSTRAINT mission_templates_difficulty_check';
  END IF;
END;
$$;

ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS mission_key TEXT;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS title_template TEXT;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS description_template TEXT;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS target_min INTEGER;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS target_max INTEGER;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS reward_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS reward_xp INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS reward_coins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS weight INTEGER NOT NULL DEFAULT 1;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS public.mission_templates ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.mission_templates
SET mission_key = COALESCE(mission_key, slug)
WHERE mission_key IS NULL;

UPDATE public.mission_templates
SET title_template = COALESCE(title_template, name)
WHERE title_template IS NULL;

UPDATE public.mission_templates
SET description_template = COALESCE(description_template, description)
WHERE description_template IS NULL;

UPDATE public.mission_templates
SET event_type = COALESCE(event_type, mission_type, target_metric)
WHERE event_type IS NULL;

UPDATE public.mission_templates
SET target_min = COALESCE(target_min, target_value)
WHERE target_min IS NULL;

UPDATE public.mission_templates
SET target_max = COALESCE(target_max, target_value, target_min)
WHERE target_max IS NULL;

UPDATE public.mission_templates
SET reward_xp = COALESCE(reward_xp, xp_reward, 0)
WHERE reward_xp IS NULL;

UPDATE public.mission_templates
SET reward_coins = COALESCE(reward_coins, coin_reward, 0)
WHERE reward_coins IS NULL;

UPDATE public.mission_templates
SET weight = COALESCE(weight, 1)
WHERE weight IS NULL;

UPDATE public.mission_templates
SET is_enabled = COALESCE(is_enabled, is_active, TRUE)
WHERE is_enabled IS NULL;

UPDATE public.mission_templates
SET metadata = COALESCE(metadata, jsonb_build_object(
    'category', category,
    'target_metric', target_metric,
    'duration_minutes', duration_minutes,
    'badge_reward', badge_reward,
    'icon', icon
))
WHERE metadata IS NULL;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_league_points_user_id ON public.league_points(user_id);
CREATE INDEX IF NOT EXISTS idx_league_points_event_id ON public.league_points(league_event_id);
CREATE INDEX IF NOT EXISTS idx_league_points_event_type ON public.league_points(event_type);
CREATE INDEX IF NOT EXISTS idx_league_leaderboard_snapshots_event_id ON public.league_leaderboard_snapshots(league_event_id);
CREATE INDEX IF NOT EXISTS idx_league_leaderboard_snapshots_user_id ON public.league_leaderboard_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_league_missions_user_id ON public.user_league_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_league_missions_event_id ON public.user_league_missions(league_event_id);
CREATE INDEX IF NOT EXISTS idx_mission_templates_event_type ON public.mission_templates(event_type);
CREATE INDEX IF NOT EXISTS idx_league_event_templates_type ON public.league_event_templates(type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_league_event_templates_template_key ON public.league_event_templates(template_key);

-- 8. Seed league event templates
INSERT INTO public.league_event_templates (template_key, name_template, type, description, duration_hours, points_multiplier, theme_key, weight, metadata)
VALUES
  ('friday_battle_day', 'Friday Battle Day', 'friday_battle_day', 'The city goes wild with weekend battle energy.', 24, 1.2, 'troll_city', 15, '{"emoji":"🔥"}'),
  ('crown_rush', 'Crown Rush', 'weekly_clash', 'Stack points fast and claim the crown.', 168, 1.1, 'troll_city', 12, '{"emoji":"👑"}'),
  ('gift_storm', 'Gift Storm', 'gift_rush', 'Send gifts and push your favorite creators up the leaderboard.', 24, 1.25, 'troll_city', 14, '{"emoji":"🎁"}'),
  ('courtroom_clash', 'Courtroom Clash', 'court_showdown', 'A dramatic league with courtroom-style leaderboard stakes.', 24, 1.15, 'troll_city', 8, '{"emoji":"⚖️"}'),
  ('neighborhood_takeover', 'Neighborhood Takeover', 'neighborhood_war', 'Rally your corner of Mai Troll for fame and prizes.', 48, 1.1, 'troll_city', 10, '{"emoji":"🌆"}'),
  ('auction_heat', 'Auction Heat', 'auction_rush', 'High bids and fast action keep points blazing.', 24, 1.2, 'troll_city', 9, '{"emoji":"💸"}'),
  ('broadcaster_boost', 'Broadcaster Boost', 'broadcaster_boost', 'Support your host and lock in elite rewards.', 24, 1.1, 'troll_city', 8, '{"emoji":"📣"}'),
  ('viewer_sprint', 'Viewer Sprint', 'viewer_grind', 'Stay live and earn points while the city pulses.', 12, 1.05, 'troll_city', 7, '{"emoji":"⚡"}'),
  ('paid_chat_push', 'Paid Chat Push', 'paid_chat_push', 'Paid Chats get a league surge for top earners.', 24, 1.3, 'troll_city', 6, '{"emoji":"💬"}'),
  ('city_pulse_frenzy', 'City Pulse Frenzy', 'city_pulse_frenzy', 'A neon-fueled rush across Mai Troll.', 18, 1.2, 'troll_city', 8, '{"emoji":"🌐"}')
ON CONFLICT (template_key) DO NOTHING;

-- 9. Seed mission templates
INSERT INTO public.mission_templates (mission_key, slug, title_template, description_template, event_type, target_min, target_max, reward_points, reward_xp, reward_coins, difficulty, weight)
VALUES
  ('send_3_gifts', 'send_3_gifts', 'Send 3 gift powers', 'Send 3 gifts during live broadcasts to climb the leaderboard.', 'send_gift', 3, 5, 100, 50, 10, 'easy', 12),
  ('watch_15_minutes', 'watch_15_minutes', 'Watch 15 minutes live', 'Stay in the stream for 15 minutes and keep the city pulse moving.', 'watch_live_10_min', 15, 20, 125, 60, 10, 'easy', 10),
  ('join_1_seat', 'join_1_seat', 'Enter the Seat', 'Join 1 broadcast seat and stake your presence in the league.', 'join_broadcast_seat', 1, 1, 100, 50, 10, 'easy', 11),
  ('send_10_messages', 'send_10_messages', 'Send 10 chat messages', 'Send 10 live messages and build your Mai Troll momentum.', 'send_chat_message', 10, 15, 90, 40, 10, 'easy', 10),
  ('participate_battle', 'participate_battle', 'Join a Battle', 'Participate in 1 live battle to earn league progression.', 'participate_battle', 1, 1, 150, 90, 10, 'normal', 9),
  ('win_1_battle', 'win_1_battle', 'Win a Battle', 'Win 1 live battle and prove you rule Mai Troll.', 'win_battle', 1, 1, 500, 200, 10, 'hard', 6),
  ('visit_coin_store', 'visit_coin_store', 'Visit the Coin Store', 'Open the coin store and keep your economy strong.', 'visit_coin_store', 1, 1, 75, 30, 10, 'easy', 7),
  ('follow_1_broadcaster', 'follow_1_broadcaster', 'Support the Broadcaster', 'Follow 1 broadcaster and strengthen your city crew.', 'follow_broadcaster', 1, 2, 80, 40, 10, 'easy', 8),
  ('complete_3_missions', 'complete_3_missions', 'Complete 3 missions', 'Finish 3 league missions to unlock extra progress.', 'mission_progress', 3, 3, 200, 120, 10, 'normal', 7),
  ('earn_500_points', 'earn_500_points', 'Earn 500 league points', 'Collect 500 league points during the event to rank up.', 'send_gift', 500, 700, 300, 150, 10, 'hard', 5)
ON CONFLICT (mission_key) DO NOTHING;

-- 10. System functions for league lifecycle
CREATE OR REPLACE FUNCTION public.get_active_league_event()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    type TEXT,
    status TEXT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by TEXT,
    theme_key TEXT,
    points_multiplier NUMERIC,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
SELECT id, name, slug, type, status, starts_at, ends_at, created_by, theme_key, points_multiplier,
       CASE WHEN pg_typeof(metadata)::text = 'text' THEN to_jsonb(metadata) ELSE metadata END AS metadata,
       created_at, updated_at
FROM public.league_events
WHERE status = 'active'
  AND now() BETWEEN starts_at AND ends_at
ORDER BY starts_at DESC
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.close_expired_league_events()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.league_events
  SET status = 'ended', updated_at = now()
  WHERE status IN ('active', 'scheduled') AND ends_at <= now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_system_league_event()
RETURNS TABLE (
    id UUID,
    name TEXT,
    slug TEXT,
    type TEXT,
    status TEXT,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_by TEXT,
    theme_key TEXT,
    points_multiplier NUMERIC,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_slug TEXT;
  v_event_name TEXT;
  v_duration INTERVAL;
BEGIN
  PERFORM public.close_expired_league_events();
  SELECT * INTO v_template
  FROM public.league_event_templates
  WHERE is_enabled
  ORDER BY random() * weight DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_template := ROW(
      'default_rush',
      'Mai Troll Rush',
      'weekly_clash',
      'A fast city competition to keep the pulse beating.',
      168,
      1,
      'troll_city',
      1,
      TRUE,
      '{}'::jsonb
    );
  END IF;

  v_event_name := v_template.name_template;
  v_slug := lower(regexp_replace(v_event_name || '-' || substring(md5(random()::text) FROM 1 FOR 6), '[^a-z0-9]+', '-', 'g'));
  v_duration := (v_template.duration_hours || ' hours')::interval;

  RETURN QUERY INSERT INTO public.league_events (
      name,
      slug,
      type,
      status,
      starts_at,
      ends_at,
      created_by,
      theme_key,
      points_multiplier,
      metadata
  ) VALUES (
      v_event_name,
      v_slug,
      v_template.type,
      'active',
      now(),
      now() + v_duration,
      'system',
      v_template.theme_key,
      v_template.points_multiplier,
      jsonb_build_object('template_key', v_template.template_key, 'auto_created', true)
  )
  RETURNING id, name, slug, type, status, starts_at, ends_at, created_by, theme_key, points_multiplier, metadata, created_at, updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_league_leaderboard(p_league_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.league_leaderboard_snapshots (
      league_event_id,
      user_id,
      username,
      display_name,
      avatar_url,
      rank,
      score,
      total_gifts,
      stream_count,
      battle_count,
      mission_count,
      updated_at
  )
  SELECT
      summary.league_event_id,
      summary.user_id,
      up.username,
      up.display_name,
      up.avatar_url,
      0,
      summary.score,
      summary.total_gifts,
      summary.stream_count,
      summary.battle_count,
      summary.mission_count,
      now()
  FROM (
      SELECT
          lp.league_event_id,
          lp.user_id,
          MAX(lp.stream_id) AS stream_id,
          SUM(lp.points) AS score,
          SUM(CASE WHEN lp.event_type LIKE '%gift%' THEN 1 ELSE 0 END) AS total_gifts,
          SUM(CASE WHEN lp.event_type = 'participate_battle' THEN 1 ELSE 0 END) AS battle_count,
          COUNT(DISTINCT lp.stream_id) FILTER (WHERE lp.stream_id IS NOT NULL) AS stream_count,
          SUM(CASE WHEN lp.event_type LIKE '%mission%' THEN 1 ELSE 0 END) AS mission_count
      FROM public.league_points lp
      WHERE lp.league_event_id = p_league_event_id
      GROUP BY lp.league_event_id, lp.user_id
  ) summary
  LEFT JOIN public.user_profiles up ON up.id = summary.user_id
  ON CONFLICT (league_event_id, user_id) DO UPDATE
  SET
      username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      score = EXCLUDED.score,
      total_gifts = EXCLUDED.total_gifts,
      stream_count = EXCLUDED.stream_count,
      battle_count = EXCLUDED.battle_count,
      mission_count = EXCLUDED.mission_count,
      updated_at = EXCLUDED.updated_at;

  WITH ranked AS (
      SELECT id, rank() OVER (ORDER BY score DESC, total_gifts DESC, updated_at ASC) AS new_rank
      FROM public.league_leaderboard_snapshots
      WHERE league_event_id = p_league_event_id
  )
  UPDATE public.league_leaderboard_snapshots l
  SET rank = ranked.new_rank
  FROM ranked
  WHERE l.id = ranked.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_user_league_missions(
    p_user_id UUID,
    p_league_event_id UUID DEFAULT NULL,
    p_count INTEGER DEFAULT 3
)
RETURNS SETOF public.user_league_missions
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.league_events%ROWTYPE;
  v_existing_active INTEGER;
  v_needed INTEGER;
  v_template RECORD;
  v_target INTEGER;
  v_query TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  IF p_league_event_id IS NULL THEN
    SELECT * INTO v_event FROM public.get_active_league_event();
  ELSE
    SELECT * INTO v_event FROM public.league_events WHERE id = p_league_event_id;
  END IF;

  IF NOT FOUND THEN
    SELECT * INTO v_event FROM public.create_system_league_event();
  END IF;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_existing_active
  FROM public.user_league_missions
  WHERE user_id = p_user_id
    AND league_event_id = v_event.id
    AND status = 'active';

  v_needed := GREATEST(0, p_count - v_existing_active);
  IF v_needed <= 0 THEN
    RETURN;
  END IF;

  FOR v_template IN
    SELECT *
    FROM public.mission_templates
    WHERE is_enabled
      AND mission_key NOT IN (
          SELECT mission_key
          FROM public.user_league_missions
          WHERE user_id = p_user_id
            AND league_event_id = v_event.id
            AND status = 'active'
      )
    ORDER BY random() * weight DESC
    LIMIT v_needed
  LOOP
    v_target := (v_template.target_min + floor(random() * (v_template.target_max - v_template.target_min + 1)))::INT;

    RETURN QUERY INSERT INTO public.user_league_missions (
        user_id,
        league_event_id,
        mission_key,
        title,
        description,
        event_type,
        target_value,
        current_value,
        reward_points,
        reward_xp,
        reward_coins,
        status,
        generated_by,
        expires_at,
        metadata
    ) VALUES (
        p_user_id,
        v_event.id,
        v_template.mission_key,
        replace(v_template.title_template, '{{target}}', v_target::text),
        replace(v_template.description_template, '{{target}}', v_target::text),
        v_template.event_type,
        v_target,
        0,
        v_template.reward_points,
        v_template.reward_xp,
        v_template.reward_coins,
        'active',
        'system',
        v_event.ends_at,
        v_template.metadata
    )
    RETURNING *;
  END LOOP;

  IF v_needed > 0 THEN
    FOR v_template IN
      SELECT *
      FROM public.mission_templates
      WHERE is_enabled
      ORDER BY random() * weight DESC
      LIMIT v_needed
    LOOP
      v_target := (v_template.target_min + floor(random() * (v_template.target_max - v_template.target_min + 1)))::INT;

      RETURN QUERY INSERT INTO public.user_league_missions (
          user_id,
          league_event_id,
          mission_key,
          title,
          description,
          event_type,
          target_value,
          current_value,
          reward_points,
          reward_xp,
          reward_coins,
          status,
          generated_by,
          expires_at,
          metadata
      ) VALUES (
          p_user_id,
          v_event.id,
          v_template.mission_key,
          replace(v_template.title_template, '{{target}}', v_target::text),
          replace(v_template.description_template, '{{target}}', v_target::text),
          v_template.event_type,
          v_target,
          0,
          v_template.reward_points,
          v_template.reward_xp,
          LEAST(v_template.reward_coins, 10),
          'active',
          'system',
          v_event.ends_at,
          v_template.metadata
      ) RETURNING *;
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_mission_progress(
    p_user_id UUID,
    p_event_type TEXT,
    p_increment INTEGER DEFAULT 1,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.league_events%ROWTYPE;
  v_completed BOOLEAN := FALSE;
  v_mission public.user_league_missions%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_event_type IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_event FROM public.get_active_league_event();
  IF NOT FOUND THEN
    RETURN;
  END IF;

  FOR v_mission IN
    SELECT *
    FROM public.user_league_missions
    WHERE user_id = p_user_id
      AND league_event_id = v_event.id
      AND event_type = p_event_type
      AND status = 'active'
  LOOP
    UPDATE public.user_league_missions
    SET current_value = LEAST(target_value, current_value + p_increment),
        status = CASE WHEN current_value + p_increment >= target_value THEN 'completed' ELSE status END,
        completed_at = CASE WHEN current_value + p_increment >= target_value THEN now() ELSE completed_at END,
        updated_at = now()
    WHERE id = v_mission.id;

    IF v_mission.current_value + p_increment >= v_mission.target_value THEN
      v_completed := TRUE;
    END IF;
  END LOOP;

  IF v_completed THEN
    PERFORM public.generate_user_league_missions(p_user_id, v_event.id, 3);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_league_points(
    p_user_id UUID,
    p_event_type TEXT,
    p_points INTEGER,
    p_stream_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.league_events%ROWTYPE;
  v_award INTEGER := GREATEST(COALESCE(p_points, 0), 0);
  v_multiplier NUMERIC := 1;
  v_increment INTEGER := COALESCE((p_metadata->>'increment')::INTEGER, 1);
  v_xp BIGINT := COALESCE((p_metadata->>'xp')::BIGINT, 0);
BEGIN
  IF p_user_id IS NULL OR p_event_type IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing user or event type');
  END IF;

  SELECT * INTO v_event FROM public.get_active_league_event();
  IF NOT FOUND THEN
    SELECT * INTO v_event FROM public.create_system_league_event();
  END IF;

  IF v_event.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active league event');
  END IF;

  v_multiplier := COALESCE(v_event.points_multiplier, 1);
  v_award := CEIL(v_award * v_multiplier)::INTEGER;

  INSERT INTO public.league_points (user_id, league_event_id, stream_id, event_type, points, metadata)
  VALUES (p_user_id, v_event.id, p_stream_id, p_event_type, v_award, p_metadata);

  PERFORM public.refresh_league_leaderboard(v_event.id);
  PERFORM public.update_user_mission_progress(p_user_id, p_event_type, v_increment, p_metadata);

  IF v_xp > 0 AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_xp') THEN
    PERFORM public.grant_xp(p_user_id, v_xp, 'league_points', v_event.id::text, p_metadata);
  END IF;

  RETURN jsonb_build_object(
      'success', true,
      'user_id', p_user_id,
      'league_event_id', v_event.id,
      'awarded_points', v_award,
      'event_type', p_event_type
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'award_league_points failed: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_user_league_mission(
    p_user_id UUID,
    p_mission_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mission public.user_league_missions%ROWTYPE;
BEGIN
  SELECT * INTO v_mission
  FROM public.user_league_missions
  WHERE id = p_mission_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mission not found');
  END IF;

  IF v_mission.status = 'claimed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mission already claimed');
  END IF;

  IF v_mission.status <> 'completed' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Mission must be completed before claiming');
  END IF;

  UPDATE public.user_league_missions
  SET status = 'claimed',
      claimed_at = now(),
      updated_at = now()
  WHERE id = p_mission_id;

  PERFORM public.award_league_points(
      p_user_id,
      'mission_claimed',
      v_mission.reward_points,
      NULL,
      jsonb_build_object('mission_id', p_mission_id, 'mission_key', v_mission.mission_key)
  );

  IF v_mission.reward_xp > 0 AND EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_xp') THEN
    PERFORM public.grant_xp(
      p_user_id,
      v_mission.reward_xp,
      'mission_claim',
      p_mission_id::text,
      jsonb_build_object('mission_key', v_mission.mission_key)
    );
  END IF;

  v_mission.reward_coins := LEAST(v_mission.reward_coins, 10);

  IF v_mission.reward_coins > 0 THEN
    BEGIN
      UPDATE public.user_profiles
      SET trollmonds = COALESCE(trollmonds, 0) + v_mission.reward_coins
      WHERE id = p_user_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Unable to award mission trollmonds: %', SQLERRM;
    END;
  END IF;

  RETURN jsonb_build_object(
      'success', true,
      'claimed', true,
      'reward_points', v_mission.reward_points,
      'reward_xp', v_mission.reward_xp,
      'reward_coins', v_mission.reward_coins
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'claim_user_league_mission failed: %', SQLERRM;
  RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_league_system_ready()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event public.league_events%ROWTYPE;
BEGIN
  PERFORM public.close_expired_league_events();

  SELECT
      id,
      name,
      slug,
      type,
      status,
      starts_at,
      ends_at,
      created_by,
      theme_key,
      points_multiplier,
      CASE WHEN pg_typeof(metadata)::text = 'text' THEN to_jsonb(metadata) ELSE metadata END AS metadata,
      created_at,
      updated_at
  INTO v_event
  FROM public.league_events
  WHERE status = 'active'
    AND now() BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    SELECT
        id,
        name,
        slug,
        type,
        status,
        starts_at,
        ends_at,
        created_by,
        theme_key,
        points_multiplier,
        CASE WHEN pg_typeof(metadata)::text = 'text' THEN to_jsonb(metadata) ELSE metadata END AS metadata,
        created_at,
        updated_at
    INTO v_event
    FROM public.create_system_league_event();
  END IF;

  IF v_event.id IS NOT NULL THEN
    PERFORM public.refresh_league_leaderboard(v_event.id);
  END IF;
  RETURN to_jsonb(v_event);
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_active_league_leaderboard()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT id INTO v_event_id FROM public.get_active_league_event();
  IF v_event_id IS NOT NULL THEN
    PERFORM public.refresh_league_leaderboard(v_event_id);
  END IF;
END;
$$;

-- 11. Grant access to authenticated clients for tables and functions
GRANT SELECT ON public.league_events TO authenticated;
GRANT SELECT ON public.league_points TO authenticated;
GRANT SELECT ON public.league_leaderboard_snapshots TO authenticated;
GRANT SELECT ON public.user_league_missions TO authenticated;
GRANT SELECT ON public.league_event_templates TO authenticated;
GRANT SELECT ON public.mission_templates TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_league_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_system_league_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_league_system_ready() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_league_leaderboard(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_active_league_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_user_league_missions(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_mission_progress(UUID, TEXT, INTEGER, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_user_league_mission(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_league_points(UUID, TEXT, INTEGER, UUID, JSONB) TO authenticated;

-- 12. Optional cron jobs if pg_cron is enabled
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron' AND installed_version IS NOT NULL) THEN
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND tablename = 'cron_job') THEN
      PERFORM cron.schedule('troll_city_ensure_league', '*/5 * * * *', 'SELECT public.ensure_league_system_ready()');
      PERFORM cron.schedule('troll_city_refresh_leaderboard', '*/2 * * * *', 'SELECT public.refresh_active_league_leaderboard()');
    END IF;
  END IF;
EXCEPTION WHEN undefined_function OR undefined_table THEN
  NULL;
END;
$$;

SELECT '✅ Expanded Mai Troll league system installed' AS status;

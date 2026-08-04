-- ============================================================
-- Apply League System (2026-05-31)
-- ============================================================
-- Run this to set up the complete league system including:
-- - league_events table
-- - league_leaderboard_snapshots table
-- - user_league_missions table
-- - league_points table
-- - league_event_templates table
-- - mission_templates table
-- - All RLS policies
-- - All RPC functions
-- - Seed data (templates, missions, active event)
-- ============================================================

-- 1. League Events Table
CREATE TABLE IF NOT EXISTS public.league_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'system',
    theme_key TEXT NOT NULL DEFAULT 'troll_city',
    points_multiplier NUMERIC NOT NULL DEFAULT 1,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.league_events ADD CONSTRAINT IF NOT EXISTS league_events_type_check
  CHECK (type IN (
    'daily','weekly','hourly','thirty_min_heat','battle','creator',
    'weekly_clash','daily_sprint','gift_rush','battle_frenzy','viewer_grind',
    'broadcaster_boost','neighborhood_war','court_showdown','auction_rush',
    'friday_battle_day','paid_chat_push','city_pulse_frenzy',
    'troll_wheel_weekend','midnight_troll_rush','neon_crown_chase','tcnn_breaking_league'
  ));
ALTER TABLE public.league_events ADD CONSTRAINT IF NOT EXISTS league_events_status_check
  CHECK (status IN ('scheduled','active','ended','archived'));

-- 2. League Leaderboard Snapshots
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

-- 3. User League Missions
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
    CONSTRAINT user_league_missions_status_check CHECK (status IN ('active','completed','claimed','expired'))
);

-- 4. League Points
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

-- 5. League Event Templates
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

-- 6. Mission Templates
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Enable RLS
ALTER TABLE public.league_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_league_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies
DROP POLICY IF EXISTS "Anyone can read league events" ON public.league_events;
CREATE POLICY "Anyone can read league events" ON public.league_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read league leaderboard" ON public.league_leaderboard_snapshots;
CREATE POLICY "Anyone can read league leaderboard" ON public.league_leaderboard_snapshots FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can read own missions" ON public.user_league_missions;
CREATE POLICY "Users can read own missions" ON public.user_league_missions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own missions" ON public.user_league_missions;
CREATE POLICY "Users can insert own missions" ON public.user_league_missions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own missions" ON public.user_league_missions;
CREATE POLICY "Users can update own missions" ON public.user_league_missions
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can read league points" ON public.league_points;
CREATE POLICY "Anyone can read league points" ON public.league_points FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read league event templates" ON public.league_event_templates;
CREATE POLICY "Anyone can read league event templates" ON public.league_event_templates FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can read mission templates" ON public.mission_templates;
CREATE POLICY "Anyone can read mission templates" ON public.mission_templates FOR SELECT USING (true);

-- 9. Grant permissions
GRANT SELECT ON public.league_events TO authenticated, anon;
GRANT SELECT ON public.league_leaderboard_snapshots TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.user_league_missions TO authenticated;
GRANT SELECT ON public.league_points TO authenticated, anon;
GRANT SELECT ON public.league_event_templates TO authenticated, anon;
GRANT SELECT ON public.mission_templates TO authenticated, anon;

-- 10. Indexes
CREATE INDEX IF NOT EXISTS idx_league_events_status ON public.league_events(status);
CREATE INDEX IF NOT EXISTS idx_league_leaderboard_event_id ON public.league_leaderboard_snapshots(league_event_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_user_id ON public.league_leaderboard_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_league_missions_user_id ON public.user_league_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_league_points_user_id ON public.league_points(user_id);

-- 11. RPC: get_active_league_event
CREATE OR REPLACE FUNCTION public.get_active_league_event()
RETURNS TABLE (id UUID, name TEXT, slug TEXT, type TEXT, status TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, created_by TEXT, theme_key TEXT, points_multiplier NUMERIC, metadata JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE SQL STABLE
AS $$
  SELECT id, name, slug, type, status, starts_at, ends_at, created_by, theme_key, points_multiplier,
         CASE WHEN pg_typeof(metadata)::text = 'text' THEN to_jsonb(metadata) ELSE metadata END AS metadata,
         created_at, updated_at
  FROM public.league_events
  WHERE status = 'active' AND now() BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC LIMIT 1;
$$;

-- 12. RPC: close_expired_league_events
CREATE OR REPLACE FUNCTION public.close_expired_league_events()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.league_events SET status = 'ended', updated_at = now()
  WHERE status IN ('active', 'scheduled') AND ends_at <= now();
END;
$$;

-- 13. RPC: create_system_league_event
CREATE OR REPLACE FUNCTION public.create_system_league_event()
RETURNS TABLE (id UUID, name TEXT, slug TEXT, type TEXT, status TEXT, starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ, created_by TEXT, theme_key TEXT, points_multiplier NUMERIC, metadata JSONB, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_template RECORD;
  v_slug TEXT;
  v_duration INTERVAL;
BEGIN
  PERFORM public.close_expired_league_events();

  SELECT * INTO v_template
  FROM public.league_event_templates
  WHERE is_enabled
  ORDER BY random() * weight DESC LIMIT 1;

  IF NOT FOUND THEN
    v_template := ROW('default_rush','Mai Troll Rush','weekly_clash','A fast city competition.',168,1,'troll_city',1,TRUE,'{}'::jsonb);
  END IF;

  v_slug := lower(regexp_replace(v_template.name_template || '-' || substring(md5(random()::text) FROM 1 FOR 6), '[^a-z0-9]+', '-', 'g'));
  v_duration := (v_template.duration_hours || ' hours')::interval;

  RETURN QUERY INSERT INTO public.league_events (name, slug, type, status, starts_at, ends_at, created_by, theme_key, points_multiplier, metadata)
  VALUES (v_template.name_template, v_slug, v_template.type, 'active', now(), now() + v_duration, 'system', v_template.theme_key, v_template.points_multiplier,
          jsonb_build_object('template_key', v_template.template_key, 'auto_created', true))
  RETURNING league_events.id, league_events.name, league_events.slug, league_events.type, league_events.status, league_events.starts_at, league_events.ends_at, league_events.created_by, league_events.theme_key, league_events.points_multiplier, league_events.metadata, league_events.created_at, league_events.updated_at;
END;
$$;

-- 14. RPC: ensure_league_system_ready
CREATE OR REPLACE FUNCTION public.ensure_league_system_ready()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
BEGIN
  PERFORM public.close_expired_league_events();

  SELECT id, name, slug, type, status, starts_at, ends_at, created_by, theme_key, points_multiplier,
         CASE WHEN pg_typeof(metadata)::text = 'text' THEN to_jsonb(metadata) ELSE metadata END AS metadata,
         created_at, updated_at
  INTO v_event
  FROM public.league_events
  WHERE status = 'active' AND now() BETWEEN starts_at AND ends_at
  ORDER BY starts_at DESC LIMIT 1;

  IF NOT FOUND THEN
    SELECT id, name, slug, type, status, starts_at, ends_at, created_by, theme_key, points_multiplier,
           CASE WHEN pg_typeof(metadata)::text = 'text' THEN to_jsonb(metadata) ELSE metadata END AS metadata,
           created_at, updated_at
    INTO v_event
    FROM public.create_system_league_event();
  END IF;

  IF v_event.id IS NOT NULL THEN
    PERFORM public.refresh_league_leaderboard(v_event.id);
  END IF;

  RETURN jsonb_build_object(
    'id', v_event.id, 'name', v_event.name, 'slug', v_event.slug,
    'type', v_event.type, 'status', v_event.status,
    'starts_at', v_event.starts_at, 'ends_at', v_event.ends_at
  );
END;
$$;

-- 15. RPC: refresh_league_leaderboard
CREATE OR REPLACE FUNCTION public.refresh_league_leaderboard(p_league_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.league_leaderboard_snapshots (league_event_id, user_id, username, display_name, avatar_url, rank, score, total_gifts, stream_count, battle_count, mission_count, updated_at)
  SELECT lp.league_event_id, lp.user_id, up.username, up.display_name, up.avatar_url, 0,
         SUM(lp.points), SUM(CASE WHEN lp.event_type LIKE '%gift%' THEN 1 ELSE 0 END),
         COUNT(DISTINCT lp.stream_id) FILTER (WHERE lp.stream_id IS NOT NULL),
         SUM(CASE WHEN lp.event_type = 'participate_battle' THEN 1 ELSE 0 END),
         SUM(CASE WHEN lp.event_type LIKE '%mission%' THEN 1 ELSE 0 END), now()
  FROM public.league_points lp
  LEFT JOIN public.user_profiles up ON up.id = lp.user_id
  WHERE lp.league_event_id = p_league_event_id
  GROUP BY lp.league_event_id, lp.user_id, up.username, up.display_name, up.avatar_url
  ON CONFLICT (league_event_id, user_id) DO UPDATE
    SET username = EXCLUDED.username, display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url, score = EXCLUDED.score,
        total_gifts = EXCLUDED.total_gifts, stream_count = EXCLUDED.stream_count,
        battle_count = EXCLUDED.battle_count, mission_count = EXCLUDED.mission_count,
        updated_at = EXCLUDED.updated_at;

  WITH ranked AS (
    SELECT id, rank() OVER (ORDER BY score DESC, total_gifts DESC, updated_at ASC) AS new_rank
    FROM public.league_leaderboard_snapshots WHERE league_event_id = p_league_event_id
  )
  UPDATE public.league_leaderboard_snapshots l SET rank = ranked.new_rank FROM ranked WHERE l.id = ranked.id;
END;
$$;

-- 16. RPC: generate_user_league_missions
CREATE OR REPLACE FUNCTION public.generate_user_league_missions(
    p_user_id UUID,
    p_league_event_id UUID DEFAULT NULL,
    p_count INTEGER DEFAULT 3
)
RETURNS SETOF public.user_league_missions
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_existing_active INTEGER;
  v_needed INTEGER;
  v_template RECORD;
  v_target INTEGER;
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;

  IF p_league_event_id IS NULL THEN
    SELECT * INTO v_event FROM public.get_active_league_event();
  ELSE
    SELECT * INTO v_event FROM public.league_events WHERE id = p_league_event_id;
  END IF;

  IF NOT FOUND THEN
    SELECT * INTO v_event FROM public.create_system_league_event();
  END IF;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT COUNT(*) INTO v_existing_active
  FROM public.user_league_missions
  WHERE user_id = p_user_id AND league_event_id = v_event.id AND status = 'active';

  v_needed := GREATEST(0, p_count - v_existing_active);
  IF v_needed <= 0 THEN RETURN; END IF;

  FOR v_template IN
    SELECT * FROM public.mission_templates
    WHERE is_enabled
      AND mission_key NOT IN (
        SELECT mission_key FROM public.user_league_missions
        WHERE user_id = p_user_id AND league_event_id = v_event.id AND status = 'active'
      )
    ORDER BY random() * weight DESC LIMIT v_needed
  LOOP
    v_target := (v_template.target_min + floor(random() * (v_template.target_max - v_template.target_min + 1)))::INT;

    RETURN QUERY INSERT INTO public.user_league_missions (
      user_id, league_event_id, mission_key, title, description, event_type,
      target_value, current_value, reward_points, reward_xp, reward_coins,
      status, generated_by, expires_at, metadata
    ) VALUES (
      p_user_id, v_event.id, v_template.mission_key,
      replace(v_template.title_template, '{{target}}', v_target::text),
      replace(v_template.description_template, '{{target}}', v_target::text),
      v_template.event_type, v_target, 0,
      v_template.reward_points, v_template.reward_xp, v_template.reward_coins,
      'active', 'system', v_event.ends_at, v_template.metadata
    ) RETURNING *;
  END LOOP;
END;
$$;

-- 17. RPC: claim_user_league_mission
CREATE OR REPLACE FUNCTION public.claim_user_league_mission(p_user_id UUID, p_mission_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_mission RECORD;
BEGIN
  SELECT * INTO v_mission FROM public.user_league_missions
  WHERE id = p_mission_id AND user_id = p_user_id;

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
  SET status = 'claimed', claimed_at = now(), updated_at = now()
  WHERE id = p_mission_id;

  -- Award points
  INSERT INTO public.league_points (user_id, league_event_id, event_type, points, metadata)
  VALUES (p_user_id, v_mission.league_event_id, 'mission_claimed', v_mission.reward_points,
          jsonb_build_object('mission_id', p_mission_id, 'mission_key', v_mission.mission_key));

  RETURN jsonb_build_object('success', true, 'message', 'Mission claimed successfully');
END;
$$;

-- 18. RPC: update_user_mission_progress
CREATE OR REPLACE FUNCTION public.update_user_mission_progress(
    p_user_id UUID, p_event_type TEXT, p_increment INTEGER DEFAULT 1, p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_event RECORD;
  v_completed BOOLEAN := FALSE;
  v_mission RECORD;
BEGIN
  IF p_user_id IS NULL OR p_event_type IS NULL THEN RETURN; END IF;

  SELECT * INTO v_event FROM public.get_active_league_event();
  IF NOT FOUND THEN RETURN; END IF;

  FOR v_mission IN
    SELECT * FROM public.user_league_missions
    WHERE user_id = p_user_id AND league_event_id = v_event.id AND event_type = p_event_type AND status = 'active'
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

-- 19. Grant execute on all RPCs
GRANT EXECUTE ON FUNCTION public.get_active_league_event() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.close_expired_league_events() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.create_system_league_event() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_league_system_ready() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.refresh_league_leaderboard(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.generate_user_league_missions(UUID, UUID, INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_user_league_mission(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_user_mission_progress(UUID, TEXT, INTEGER, JSONB) TO authenticated, anon;

-- 20. Seed league event templates
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

-- 21. Seed mission templates
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

-- 22. Create initial active league event
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.league_events WHERE status = 'active';
  IF v_count = 0 THEN
    PERFORM public.create_system_league_event();
  END IF;
END;
$$;

SELECT '✅ League system fully applied — tables, RPCs, RLS, templates, and active event ready' as status;

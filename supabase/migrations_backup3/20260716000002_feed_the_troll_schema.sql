-- ============================================================================
-- FEED THE TROLL — persistent animated companion system
-- ============================================================================
-- Extends the existing gifting flow (send_gift_in_stream) with an atomic,
-- server-side 1% troll allocation. The browser NEVER calculates or trusts the
-- allocation: it is computed inside the gift RPC in the same transaction that
-- credits the broadcaster, so duplication / race conditions / rounding drift
-- are impossible.
--
-- Safe to re-run (idempotent). Only adds new objects.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configuration tables (config-driven thresholds — never hardcode in FE)
-- ----------------------------------------------------------------------------

-- Evolution stages and their lifetime-fed thresholds (coins).
CREATE TABLE IF NOT EXISTS public.troll_feed_evolution_config (
  stage        text PRIMARY KEY,
  display_name text NOT NULL,
  min_lifetime_fed_coins bigint NOT NULL,
  sort_order   integer NOT NULL,
  badge_label  text,
  theme_key    text,
  is_active    boolean DEFAULT true
);

INSERT INTO public.troll_feed_evolution_config (stage, display_name, min_lifetime_fed_coins, sort_order, badge_label, theme_key)
VALUES
  ('baby',    'Baby Troll',    0,       1, 'Hatchling', 'baby'),
  ('young',   'Young Troll',   10000,   2, 'Sprout',    'young'),
  ('warrior', 'Warrior Troll', 100000,  3, 'Warrior',   'warrior'),
  ('king',    'King Troll',    1000000, 4, 'Royal',     'king')
ON CONFLICT (stage) DO NOTHING;

-- Gift-size reaction tiers (driven by eligible gift value).
CREATE TABLE IF NOT EXISTS public.troll_feed_gift_size_config (
  size        text PRIMARY KEY,
  min_value   integer NOT NULL,
  max_value   integer,          -- NULL = unbounded
  sort_order  integer NOT NULL,
  is_active   boolean DEFAULT true
);

INSERT INTO public.troll_feed_gift_size_config (size, min_value, max_value, sort_order)
VALUES
  ('small',    1,    99,     1),
  ('medium',   100,  999,    2),
  ('large',    1000, 9999,   3),
  ('legendary',10000, NULL,  4)
ON CONFLICT (size) DO NOTHING;

-- Per-broadcaster troll settings: cashout threshold + sleep timing.
CREATE TABLE IF NOT EXISTS public.troll_feed_settings (
  broadcaster_id      uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  cashout_threshold   bigint NOT NULL DEFAULT 50000,
  sleep_after_idle_ms bigint NOT NULL DEFAULT 300000,  -- 5 minutes -> asleep
  sleepy_after_idle_ms bigint NOT NULL DEFAULT 180000, -- 3 minutes -> sleepy
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Seasonal / event outfits. Layered over the current evolution stage.
CREATE TABLE IF NOT EXISTS public.troll_feed_seasonal_themes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  asset_key     text NOT NULL,
  minimum_stage text REFERENCES public.troll_feed_evolution_config(stage),
  maximum_stage text REFERENCES public.troll_feed_evolution_config(stage),
  is_active     boolean DEFAULT true,
  priority      integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

-- Milestone definitions (configurable).
CREATE TABLE IF NOT EXISTS public.troll_feed_milestone_config (
  id           text PRIMARY KEY,
  category     text NOT NULL CHECK (category IN ('feeding_count','lifetime_coins','cashout_count','unique_feeders','gift_train','evolution','battle_wins')),
  name         text NOT NULL,
  description  text,
  icon         text,
  requirement  bigint NOT NULL,
  tier         text NOT NULL DEFAULT 'Bronze' CHECK (tier IN ('Bronze','Silver','Gold','Diamond','Royal Troll')),
  is_active    boolean DEFAULT true
);

INSERT INTO public.troll_feed_milestone_config (id, category, name, description, icon, requirement, tier)
VALUES
  ('fed_1000_times',     'feeding_count',  'Well Fed',         'Fed 1,000 times',               '🍖', 1000,    'Bronze'),
  ('ate_100k_coins',     'lifetime_coins', 'Coin Connoisseur', 'Ate 100,000 coins',             '🪙', 100000,  'Silver'),
  ('reached_10_cashouts','cashout_count',  'Cashout King',     'Reached 10 cashouts',           '💰', 10,      'Gold'),
  ('fed_5000_viewers',   'unique_feeders', 'Crowd Favorite',   'Fed by 5,000 unique viewers',   '🌟', 5000,    'Diamond')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Core data tables
-- ----------------------------------------------------------------------------

-- One row per broadcaster: troll balance, lifetime totals, cycle, evolution.
CREATE TABLE IF NOT EXISTS public.troll_feed_state (
  broadcaster_id          uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  current_cycle_balance   bigint NOT NULL DEFAULT 0,
  lifetime_fed_coins      bigint NOT NULL DEFAULT 0,
  total_feedings          bigint NOT NULL DEFAULT 0,
  unique_feeders          bigint NOT NULL DEFAULT 0,
  cashout_count           bigint NOT NULL DEFAULT 0,
  current_cycle_index     integer NOT NULL DEFAULT 1,
  evolution_stage         text NOT NULL DEFAULT 'baby' REFERENCES public.troll_feed_evolution_config(stage),
  current_seasonal_theme  text,
  personality_state       text NOT NULL DEFAULT 'idle',
  last_fed_at             timestamptz,
  last_interaction_at     timestamptz DEFAULT now(),
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now()
);

-- Per-feeding transaction records (the single source of truth for credits).
CREATE TABLE IF NOT EXISTS public.troll_feed_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_id         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id         uuid REFERENCES public.streams(id) ON DELETE SET NULL,
  battle_id         uuid REFERENCES public.battles(id) ON DELETE SET NULL,
  gift_id           text,
  gift_name         text,
  eligible_gift_value integer NOT NULL,
  troll_allocation  integer NOT NULL,   -- exact 1% (server computed)
  size_category     text NOT NULL DEFAULT 'small',
  cycle_index       integer NOT NULL DEFAULT 1,
  idempotency_key   text,
  created_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_troll_feed_tx_broadcaster ON public.troll_feed_transactions(broadcaster_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_troll_feed_tx_sender ON public.troll_feed_transactions(sender_id);

-- Sender leaderboard totals (per broadcaster).
CREATE TABLE IF NOT EXISTS public.troll_feed_leaderboard (
  broadcaster_id        uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  sender_id             uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  total_eligible_value  bigint NOT NULL DEFAULT 0,
  total_troll_allocated bigint NOT NULL DEFAULT 0,
  feeding_count         bigint NOT NULL DEFAULT 0,
  largest_single_feed   integer NOT NULL DEFAULT 0,
  updated_at            timestamptz DEFAULT now(),
  PRIMARY KEY (broadcaster_id, sender_id)
);

-- Completed cashout-cycle history (never erased).
CREATE TABLE IF NOT EXISTS public.troll_feed_cashouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id      uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  cycle_index         integer NOT NULL,
  amount_cashed_out   bigint NOT NULL,
  created_at          timestamptz DEFAULT now()
);

-- Evolution history (permanent record of every evolution).
CREATE TABLE IF NOT EXISTS public.troll_feed_evolution_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  from_stage      text,
  to_stage        text NOT NULL REFERENCES public.troll_feed_evolution_config(stage),
  lifetime_fed_at_transition bigint NOT NULL DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Completed milestone records (per broadcaster + milestone).
CREATE TABLE IF NOT EXISTS public.troll_feed_milestones (
  broadcaster_id  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  milestone_id    text NOT NULL REFERENCES public.troll_feed_milestone_config(id),
  completed_at    timestamptz DEFAULT now(),
  progress        bigint NOT NULL DEFAULT 0,
  claimed         boolean DEFAULT false,
  PRIMARY KEY (broadcaster_id, milestone_id)
);

-- Gift-train snapshots (current & largest per live + lifetime).
CREATE TABLE IF NOT EXISTS public.troll_feed_gift_trains (
  broadcaster_id        uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  current_train_count   integer NOT NULL DEFAULT 0,
  current_train_started_at timestamptz,
  largest_train_this_live integer NOT NULL DEFAULT 0,
  largest_train_lifetime  integer NOT NULL DEFAULT 0,
  top_contributor_id    uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  top_contributor_count integer NOT NULL DEFAULT 0,
  updated_at            timestamptz DEFAULT now()
);

-- Historical ranking snapshots before periodic Hall-of-Fame resets.
CREATE TABLE IF NOT EXISTS public.troll_feed_ranking_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id  uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  rank_window     text NOT NULL CHECK (rank_window IN ('weekly','monthly')),
  snapshot_at     timestamptz DEFAULT now(),
  rankings        jsonb NOT NULL DEFAULT '[]'::jsonb
);

-- ----------------------------------------------------------------------------
-- 3. Enable RLS + publication
-- ----------------------------------------------------------------------------

ALTER TABLE public.troll_feed_state                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_transactions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_leaderboard           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_cashouts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_evolution_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_milestones            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_gift_trains           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_ranking_snapshots     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_settings              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_seasonal_themes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_milestone_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_evolution_config      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.troll_feed_gift_size_config      ENABLE ROW LEVEL SECURITY;

-- Public read: anyone watching a live can see a troll + leaderboard + history.
-- (No private payment data is exposed — only public leaderboard/fed totals.)
CREATE POLICY "troll_feed_state_public_read" ON public.troll_feed_state
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_tx_public_read" ON public.troll_feed_transactions
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_leaderboard_public_read" ON public.troll_feed_leaderboard
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_cashouts_public_read" ON public.troll_feed_cashouts
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_evolution_history_public_read" ON public.troll_feed_evolution_history
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_milestones_public_read" ON public.troll_feed_milestones
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_gift_trains_public_read" ON public.troll_feed_gift_trains
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_ranking_snapshots_public_read" ON public.troll_feed_ranking_snapshots
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_settings_public_read" ON public.troll_feed_settings
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_seasonal_public_read" ON public.troll_feed_seasonal_themes
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_milestone_config_public_read" ON public.troll_feed_milestone_config
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_evolution_config_public_read" ON public.troll_feed_evolution_config
  FOR SELECT USING (true);

CREATE POLICY "troll_feed_gift_size_public_read" ON public.troll_feed_gift_size_config
  FOR SELECT USING (true);

-- Write access: only the SERVICE ROLE (the gift RPC runs SECURITY DEFINER) may
-- insert/update troll_feed data. End users cannot write directly, preventing
-- manipulation of balances, allocations, or leaderboards from the browser.
-- We still allow a broadcaster to update their own settings row.
CREATE POLICY "troll_feed_settings_owner_write" ON public.troll_feed_settings
  FOR UPDATE USING (auth.uid() = broadcaster_id)
  WITH CHECK (auth.uid() = broadcaster_id);

-- Realtime: the live companion reads everything via a per-stream broadcast
-- channel driven by the RPC, plus postgres_changes on the transaction table
-- for guaranteed consistency after reconnect.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'troll_feed_transactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.troll_feed_transactions;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'troll_feed_state'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.troll_feed_state;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'troll_feed_leaderboard'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.troll_feed_leaderboard;
  END IF;
END $$;

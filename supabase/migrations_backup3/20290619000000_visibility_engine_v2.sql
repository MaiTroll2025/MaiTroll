-- ============================================================================
-- Mai Troll VISIBILITY ENGINE v2
-- Complete overhaul of content discovery, ranking, and anti-abuse systems
-- ============================================================================
-- This migration replaces the legacy ranking system (broadcast_rankings,
-- stream_ranking, broadcast_cycle_stats) with a unified Visibility Engine
-- that powers: Homepage, Explore, Live Streams, Auctions, Battles, Trending,
-- and Recommendations.

-- ============================================================================
-- PART 1: CONFIGURATION TABLE
-- ============================================================================
-- Admin-configurable weights for all scoring algorithms

CREATE TABLE IF NOT EXISTS visibility_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT UNIQUE NOT NULL,
  config_value NUMERIC NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default weights (sum to 100 for each content type)
INSERT INTO visibility_config (config_key, config_value, description) VALUES
  -- Stream discovery weights
  ('stream_weight_viewer_count', 25, 'Stream: viewer count weight (%)'),
  ('stream_weight_chat_activity', 20, 'Stream: chat activity weight (%)'),
  ('stream_weight_reactions', 15, 'Stream: reactions weight (%)'),
  ('stream_weight_shares', 15, 'Stream: shares weight (%)'),
  ('stream_weight_watch_time', 15, 'Stream: watch time weight (%)'),
  ('stream_weight_recent_activity', 10, 'Stream: recent activity weight (%)'),
  -- Auction discovery weights
  ('auction_weight_active_bidders', 25, 'Auction: active bidders weight (%)'),
  ('auction_weight_total_bids', 20, 'Auction: total bids weight (%)'),
  ('auction_weight_bid_frequency', 20, 'Auction: bid frequency weight (%)'),
  ('auction_weight_unique_viewers', 15, 'Auction: unique viewers weight (%)'),
  ('auction_weight_watch_time', 10, 'Auction: watch time weight (%)'),
  ('auction_weight_completion_rate', 10, 'Auction: completion rate weight (%)'),
  -- Battle discovery weights
  ('battle_weight_unique_supporters', 25, 'Battle: unique supporters weight (%)'),
  ('battle_weight_crowns', 20, 'Battle: crowns received weight (%)'),
  ('battle_weight_viewer_participation', 20, 'Battle: viewer participation weight (%)'),
  ('battle_weight_win_streaks', 15, 'Battle: win streaks weight (%)'),
  ('battle_weight_completion_rate', 10, 'Battle: completion rate weight (%)'),
  ('battle_weight_engagement_rate', 10, 'Battle: engagement rate weight (%)'),
  -- Hot score decay
  ('hot_score_half_life_minutes', 30, 'Hot score: half-life in minutes'),
  ('hot_score_time_decay_factor', 0.5, 'Hot score: time decay multiplier'),
  -- Momentum thresholds
  ('momentum_viewer_threshold', 50, 'Momentum: new viewers in 2 min to trigger boost'),
  ('momentum_bid_threshold', 20, 'Momentum: bids in 60 sec to trigger boost'),
  ('momentum_chat_threshold', 100, 'Momentum: chat messages in 2 min for spike'),
  ('momentum_boost_duration_minutes', 15, 'Momentum: boost duration in minutes'),
  ('momentum_boost_multiplier', 1.5, 'Momentum: score multiplier during boost'),
  -- New user boost
  ('new_user_boost_days', 30, 'New user: boost period in days'),
  ('new_user_boost_multiplier', 1.3, 'New user: visibility multiplier'),
  -- Reputation
  ('reputation_decay_days', 90, 'Reputation: days before negative signals decay'),
  ('reputation_minimum_threshold', 30, 'Reputation: minimum score before heavy penalties'),
  -- Anti-abuse
  ('abuse_viewbot_threshold', 0.8, 'Abuse: ratio of suspicious/total views to flag'),
  ('abuse_auto_penalty_multiplier', 0.1, 'Abuse: score multiplier for flagged content')
ON CONFLICT (config_key) DO NOTHING;

ALTER TABLE visibility_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read visibility config" ON visibility_config FOR SELECT USING (true);
CREATE POLICY "Admins can manage visibility config" ON visibility_config FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- ============================================================================
-- PART 2: CORE VISIBILITY SCORES TABLE
-- ============================================================================
-- Unified table storing the master visibility score for all content types

CREATE TABLE IF NOT EXISTS visibility_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event')),
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Component scores (0-100 each)
  viewer_score NUMERIC(8,2) DEFAULT 0,
  chat_score NUMERIC(8,2) DEFAULT 0,
  reaction_score NUMERIC(8,2) DEFAULT 0,
  share_score NUMERIC(8,2) DEFAULT 0,
  watch_time_score NUMERIC(8,2) DEFAULT 0,
  recent_activity_score NUMERIC(8,2) DEFAULT 0,
  reputation_modifier NUMERIC(8,2) DEFAULT 1.0,
  momentum_boost NUMERIC(8,2) DEFAULT 1.0,
  new_user_boost NUMERIC(8,2) DEFAULT 1.0,
  abuse_penalty NUMERIC(8,2) DEFAULT 1.0,

  -- Computed scores
  base_score NUMERIC(10,2) DEFAULT 0,
  hot_score NUMERIC(10,2) DEFAULT 0,
  final_visibility_score NUMERIC(10,2) DEFAULT 0,

  -- Metadata
  is_rising BOOLEAN DEFAULT FALSE,
  is_trending BOOLEAN DEFAULT FALSE,
  last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(content_id, content_type)
);

CREATE INDEX idx_visibility_scores_final ON visibility_scores(final_visibility_score DESC);
CREATE INDEX idx_visibility_scores_hot ON visibility_scores(hot_score DESC);
CREATE INDEX idx_visibility_scores_rising ON visibility_scores(is_rising) WHERE is_rising = true;
CREATE INDEX idx_visibility_scores_trending ON visibility_scores(is_trending) WHERE is_trending = true;
CREATE INDEX idx_visibility_scores_type ON visibility_scores(content_type, final_visibility_score DESC);
CREATE INDEX idx_visibility_scores_user ON visibility_scores(user_id);

ALTER TABLE visibility_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read visibility scores" ON visibility_scores FOR SELECT USING (true);
CREATE POLICY "System can manage visibility scores" ON visibility_scores FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);


-- ============================================================================
-- PART 3: MOMENTUM TRACKING TABLE
-- ============================================================================
-- Tracks real-time engagement velocity for momentum detection

CREATE TABLE IF NOT EXISTS momentum_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event')),

  -- Velocity windows (counts per time window)
  viewers_1min INTEGER DEFAULT 0,
  viewers_2min INTEGER DEFAULT 0,
  viewers_5min INTEGER DEFAULT 0,
  chat_1min INTEGER DEFAULT 0,
  chat_2min INTEGER DEFAULT 0,
  reactions_1min INTEGER DEFAULT 0,
  reactions_2min INTEGER DEFAULT 0,
  bids_1min INTEGER DEFAULT 0,
  bids_5min INTEGER DEFAULT 0,
  crowns_1min INTEGER DEFAULT 0,
  crowns_5min INTEGER DEFAULT 0,
  shares_5min INTEGER DEFAULT 0,

  -- Momentum state
  momentum_level NUMERIC(5,2) DEFAULT 0,  -- 0-100
  is_boosted BOOLEAN DEFAULT FALSE,
  boost_expires_at TIMESTAMPTZ,
  boost_multiplier NUMERIC(5,2) DEFAULT 1.0,
  velocity_trend TEXT DEFAULT 'stable' CHECK (velocity_trend IN ('accelerating', 'stable', 'decelerating')),

  -- Timestamps
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  last_decay_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(content_id, content_type)
);

CREATE INDEX idx_momentum_boosted ON momentum_tracking(is_boosted) WHERE is_boosted = true;
CREATE INDEX idx_momentum_velocity ON momentum_tracking(velocity_trend);
CREATE INDEX idx_momentum_level ON momentum_tracking(momentum_level DESC);

ALTER TABLE momentum_tracking ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read momentum tracking" ON momentum_tracking FOR SELECT USING (true);
CREATE POLICY "System can manage momentum tracking" ON momentum_tracking FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);


-- ============================================================================
-- PART 4: ENGAGEMENT SNAPSHOTS (for time-decay calculations)
-- ============================================================================
-- Append-only table recording engagement events with timestamps
-- Used for hot score time-decay and momentum velocity windows

CREATE TABLE IF NOT EXISTS engagement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event')),
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'chat', 'reaction', 'share', 'bid', 'crown', 'watch_time')),
  event_value INTEGER DEFAULT 1,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_engagement_content ON engagement_snapshots(content_id, content_type, created_at DESC);
CREATE INDEX idx_engagement_time ON engagement_snapshots(created_at DESC);
CREATE INDEX idx_engagement_type ON engagement_snapshots(event_type, created_at DESC);

-- Partition cleanup: auto-delete snapshots older than 24 hours
-- (Hot score only cares about recent engagement)
-- This should be called periodically via cron
CREATE OR REPLACE FUNCTION cleanup_old_engagement_snapshots()
RETURNS VOID AS $$
BEGIN
  DELETE FROM engagement_snapshots WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

ALTER TABLE engagement_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage engagement snapshots" ON engagement_snapshots FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);


-- ============================================================================
-- PART 5: USER REPUTATION V2
-- ============================================================================
-- Enhanced reputation system with positive/negative signals

CREATE TABLE IF NOT EXISTS user_reputation_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,

  -- Core scores
  current_score INTEGER DEFAULT 100,  -- 0-200 scale
  lifetime_score INTEGER DEFAULT 100,
  reputation_tier TEXT DEFAULT 'standard' CHECK (reputation_tier IN ('legendary', 'excellent', 'good', 'standard', 'warning', 'poor', 'restricted')),

  -- Positive signals
  account_age_days INTEGER DEFAULT 0,
  completed_auctions INTEGER DEFAULT 0,
  successful_battles INTEGER DEFAULT 0,
  total_streams INTEGER DEFAULT 0,
  positive_engagement_count INTEGER DEFAULT 0,
  community_participation_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,

  -- Negative signals
  spam_reports INTEGER DEFAULT 0,
  excessive_reports INTEGER DEFAULT 0,
  auction_abuse_count INTEGER DEFAULT 0,
  fraud_attempts INTEGER DEFAULT 0,
  chargebacks INTEGER DEFAULT 0,
  rule_violations INTEGER DEFAULT 0,
  viewbot_flags INTEGER DEFAULT 0,

  -- Computed
  positive_signal_score NUMERIC(8,2) DEFAULT 0,
  negative_signal_score NUMERIC(8,2) DEFAULT 0,
  reputation_modifier NUMERIC(5,2) DEFAULT 1.0,  -- Multiplier applied to visibility

  -- Timestamps
  last_positive_at TIMESTAMPTZ,
  last_negative_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reputation_v2_score ON user_reputation_v2(current_score DESC);
CREATE INDEX idx_reputation_v2_tier ON user_reputation_v2(reputation_tier);
CREATE INDEX idx_reputation_v2_modifier ON user_reputation_v2(reputation_modifier);

ALTER TABLE user_reputation_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own reputation" ON user_reputation_v2 FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all reputation" ON user_reputation_v2 FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);
CREATE POLICY "System can manage reputation" ON user_reputation_v2 FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- Auto-create reputation record on user signup
CREATE OR REPLACE FUNCTION create_user_reputation_v2()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_reputation_v2 (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_user_reputation_v2 ON user_profiles;
CREATE TRIGGER trg_create_user_reputation_v2
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION create_user_reputation_v2();


-- ============================================================================
-- PART 6: NEW USER BOOST TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS new_user_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  boost_multiplier NUMERIC(5,2) DEFAULT 1.3,
  boost_started_at TIMESTAMPTZ DEFAULT NOW(),
  boost_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  is_active BOOLEAN DEFAULT TRUE,
  abuse_flags INTEGER DEFAULT 0,  -- Track if this boost is being abused
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_new_user_boosts_active ON new_user_boosts(is_active) WHERE is_active = true;

ALTER TABLE new_user_boosts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System can manage new user boosts" ON new_user_boosts FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- Auto-create boost on user signup
CREATE OR REPLACE FUNCTION create_new_user_boost()
RETURNS TRIGGER AS $$
DECLARE
  v_boost_days INTEGER;
  v_boost_mult NUMERIC;
BEGIN
  SELECT config_value INTO v_boost_days FROM visibility_config WHERE config_key = 'new_user_boost_days';
  SELECT config_value INTO v_boost_mult FROM visibility_config WHERE config_key = 'new_user_boost_multiplier';

  INSERT INTO new_user_boosts (user_id, boost_multiplier, boost_expires_at)
  VALUES (
    NEW.id,
    COALESCE(v_boost_mult, 1.3),
    NOW() + (COALESCE(v_boost_days, 30) || ' days')::INTERVAL
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_new_user_boost ON user_profiles;
CREATE TRIGGER trg_create_new_user_boost
  AFTER INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION create_new_user_boost();


-- ============================================================================
-- PART 7: FEATURED SECTIONS CONFIGURATION
-- ============================================================================
-- Controls what appears in each homepage section

CREATE TABLE IF NOT EXISTS featured_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT UNIQUE NOT NULL CHECK (section_key IN (
    'featured',      -- Manually selected by staff
    'trending',      -- Highest current momentum
    'rising',        -- Fastest-growing content
    'new_creators',  -- Recently joined creators
    'auction_frenzy',-- Most active auctions
    'battle_royale', -- Most active battles
    'staff_picks'    -- Administrator-selected
  )),
  display_name TEXT NOT NULL,
  content_type TEXT CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event', 'mixed')),
  max_items INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  custom_weights JSONB DEFAULT '{}'::jsonb,  -- Section-specific weight overrides
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO featured_sections (section_key, display_name, content_type, max_items, sort_order) VALUES
  ('featured', 'Featured', 'mixed', 10, 1),
  ('trending', 'Trending Now', 'mixed', 20, 2),
  ('rising', 'Rising', 'mixed', 15, 3),
  ('new_creators', 'New Creators', 'stream', 10, 4),
  ('auction_frenzy', 'Auction Frenzy', 'auction', 10, 5),
  ('battle_royale', 'Battle Royale', 'battle', 10, 6),
  ('staff_picks', 'Staff Picks', 'mixed', 10, 7)
ON CONFLICT (section_key) DO NOTHING;

ALTER TABLE featured_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read featured sections" ON featured_sections FOR SELECT USING (true);
CREATE POLICY "Admins can manage featured sections" ON featured_sections FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);

-- Staff picks table (manual curation)
CREATE TABLE IF NOT EXISTS staff_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event')),
  picked_by UUID NOT NULL REFERENCES auth.users(id),
  section_key TEXT DEFAULT 'staff_picks',
  priority INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(content_id, content_type, section_key)
);

CREATE INDEX idx_staff_picks_section ON staff_picks(section_key, priority DESC);

ALTER TABLE staff_picks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read staff picks" ON staff_picks FOR SELECT USING (true);
CREATE POLICY "Admins can manage staff picks" ON staff_picks FOR ALL USING (
  auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);


-- ============================================================================
-- PART 8: ANTI-ABUSE DETECTION TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS anti_abuse_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID,
  content_type TEXT CHECK (content_type IN ('stream', 'auction', 'battle', 'post', 'event', 'user')),
  user_id UUID REFERENCES auth.users(id),
  flag_type TEXT NOT NULL CHECK (flag_type IN (
    'viewbot_suspected',
    'fake_engagement',
    'artificial_bidding',
    'multi_account',
    'automated_interaction',
    'spam_activity',
    'chargeback_abuse',
    'auction_manipulation'
  )),
  severity TEXT DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence NUMERIC(5,2) DEFAULT 0,  -- 0-100, how confident the system is
  evidence JSONB DEFAULT '{}'::jsonb,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_anti_abuse_unresolved ON anti_abuse_flags(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_anti_abuse_user ON anti_abuse_flags(user_id);
CREATE INDEX idx_anti_abuse_content ON anti_abuse_flags(content_id, content_type);
CREATE INDEX idx_anti_abuse_severity ON anti_abuse_flags(severity);

ALTER TABLE anti_abuse_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read abuse flags" ON anti_abuse_flags FOR SELECT USING (
  auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);
CREATE POLICY "System can manage abuse flags" ON anti_abuse_flags FOR ALL USING (
  auth.uid() IN (SELECT id FROM auth.users WHERE email LIKE '%@system%')
  OR auth.uid() IN (SELECT user_id FROM user_roles WHERE role = 'admin')
);


-- ============================================================================
-- PART 9: HELPER FUNCTIONS
-- ============================================================================

-- Get config value with default
CREATE OR REPLACE FUNCTION get_visibility_config(p_key TEXT, p_default NUMERIC DEFAULT 0)
RETURNS NUMERIC AS $$
DECLARE
  v_val NUMERIC;
BEGIN
  SELECT config_value INTO v_val FROM visibility_config WHERE config_key = p_key;
  RETURN COALESCE(v_val, p_default);
END;
$$ LANGUAGE plpgsql STABLE;

-- Record engagement event (called by triggers and application)
CREATE OR REPLACE FUNCTION record_engagement(
  p_content_id UUID,
  p_content_type TEXT,
  p_event_type TEXT,
  p_event_value INTEGER DEFAULT 1,
  p_user_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO engagement_snapshots (content_id, content_type, event_type, event_value, user_id)
  VALUES (p_content_id, p_content_type, p_event_type, p_event_value, p_user_id);

  -- Also update the momentum tracking velocity counters
  PERFORM update_momentum_velocity(p_content_id, p_content_type, p_event_type, p_event_value);
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 10: MOMENTUM VELOCITY UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_momentum_velocity(
  p_content_id UUID,
  p_content_type TEXT,
  p_event_type TEXT,
  p_event_value INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO momentum_tracking (content_id, content_type)
  VALUES (p_content_id, p_content_type)
  ON CONFLICT (content_id, content_type)
  DO UPDATE SET
    viewers_1min = CASE
      WHEN p_event_type = 'view' THEN momentum_tracking.viewers_1min + p_event_value
      ELSE momentum_tracking.viewers_1min
    END,
    viewers_2min = CASE
      WHEN p_event_type = 'view' THEN momentum_tracking.viewers_2min + p_event_value
      ELSE momentum_tracking.viewers_2min
    END,
    chat_1min = CASE
      WHEN p_event_type = 'chat' THEN momentum_tracking.chat_1min + p_event_value
      ELSE momentum_tracking.chat_1min
    END,
    chat_2min = CASE
      WHEN p_event_type = 'chat' THEN momentum_tracking.chat_2min + p_event_value
      ELSE momentum_tracking.chat_2min
    END,
    reactions_1min = CASE
      WHEN p_event_type = 'reaction' THEN momentum_tracking.reactions_1min + p_event_value
      ELSE momentum_tracking.reactions_1min
    END,
    reactions_2min = CASE
      WHEN p_event_type = 'reaction' THEN momentum_tracking.reactions_2min + p_event_value
      ELSE momentum_tracking.reactions_2min
    END,
    bids_1min = CASE
      WHEN p_event_type = 'bid' THEN momentum_tracking.bids_1min + p_event_value
      ELSE momentum_tracking.bids_1min
    END,
    bids_5min = CASE
      WHEN p_event_type = 'bid' THEN momentum_tracking.bids_5min + p_event_value
      ELSE momentum_tracking.bids_5min
    END,
    crowns_1min = CASE
      WHEN p_event_type = 'crown' THEN momentum_tracking.crowns_1min + p_event_value
      ELSE momentum_tracking.crowns_1min
    END,
    crowns_5min = CASE
      WHEN p_event_type = 'crown' THEN momentum_tracking.crowns_5min + p_event_value
      ELSE momentum_tracking.crowns_5min
    END,
    shares_5min = CASE
      WHEN p_event_type = 'share' THEN momentum_tracking.shares_5min + p_event_value
      ELSE momentum_tracking.shares_5min
    END,
    last_activity_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 11: STREAM DISCOVERY SCORE CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_stream_discovery_score(p_stream_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_stream RECORD;
  v_reputation RECORD;
  v_momentum RECORD;
  v_boost RECORD;

  -- Weights from config
  w_viewer NUMERIC;
  w_chat NUMERIC;
  w_reaction NUMERIC;
  w_share NUMERIC;
  w_watch_time NUMERIC;
  w_recent NUMERIC;

  -- Raw metrics
  v_unique_viewers INTEGER;
  v_avg_watch_time NUMERIC;
  v_viewer_retention NUMERIC;
  v_chat_messages INTEGER;
  v_reactions_count INTEGER;
  v_shares_count INTEGER;
  v_crown_activity INTEGER;
  v_follower_growth INTEGER;
  v_recent_engagement NUMERIC;

  -- Penalty flags
  v_is_afk BOOLEAN;
  v_viewbot_ratio NUMERIC;
  v_has_spam BOOLEAN;

  -- Computed component scores (0-100 each)
  v_viewer_score NUMERIC;
  v_chat_score NUMERIC;
  v_reaction_score NUMERIC;
  v_share_score NUMERIC;
  v_watch_time_score NUMERIC;
  v_recent_score NUMERIC;

  v_base_score NUMERIC;
  v_reputation_mod NUMERIC;
  v_momentum_boost NUMERIC;
  v_new_user_boost NUMERIC;
  v_abuse_penalty NUMERIC;
  v_final_score NUMERIC;
BEGIN
  -- Load config weights
  w_viewer := get_visibility_config('stream_weight_viewer_count', 25);
  w_chat := get_visibility_config('stream_weight_chat_activity', 20);
  w_reaction := get_visibility_config('stream_weight_reactions', 15);
  w_share := get_visibility_config('stream_weight_shares', 15);
  w_watch_time := get_visibility_config('stream_weight_watch_time', 15);
  w_recent := get_visibility_config('stream_weight_recent_activity', 10);

  -- Get stream data
  SELECT * INTO v_stream FROM streams WHERE id = p_stream_id;
  IF v_stream IS NULL OR v_stream.is_live = false THEN RETURN 0; END IF;

  -- Get unique viewers (distinct users who viewed in last 30 min)
  SELECT COUNT(DISTINCT user_id) INTO v_unique_viewers
  FROM engagement_snapshots
  WHERE content_id = p_stream_id
    AND content_type = 'stream'
    AND event_type = 'view'
    AND created_at > NOW() - INTERVAL '30 minutes';

  -- Get chat messages in last 5 minutes
  SELECT COUNT(*) INTO v_chat_messages
  FROM stream_messages
  WHERE stream_id = p_stream_id
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Get reactions count (from engagement snapshots, last 5 min)
  SELECT COALESCE(SUM(event_value), 0) INTO v_reactions_count
  FROM engagement_snapshots
  WHERE content_id = p_stream_id
    AND content_type = 'stream'
    AND event_type = 'reaction'
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Get shares count (last 5 min)
  SELECT COALESCE(SUM(event_value), 0) INTO v_shares_count
  FROM engagement_snapshots
  WHERE content_id = p_stream_id
    AND content_type = 'stream'
    AND event_type = 'share'
    AND created_at > NOW() - INTERVAL '5 minutes';

  -- Get crown/gift activity (last 10 min)
  SELECT COALESCE(SUM(coins_spent), 0) INTO v_crown_activity
  FROM stream_gifts
  WHERE stream_id = p_stream_id
    AND created_at > NOW() - INTERVAL '10 minutes';

  -- Calculate viewer retention (avg watch time proxy)
  -- estimate: ratio of viewers still present vs peak in last 10 min
  SELECT COALESCE(
    (SELECT COUNT(DISTINCT user_id) FROM engagement_snapshots
     WHERE content_id = p_stream_id AND content_type = 'stream'
       AND event_type = 'view'
       AND created_at > NOW() - INTERVAL '10 minutes')::NUMERIC
    / NULLIF(GREATEST(v_stream.current_viewers, 1), 0)
  , 0) INTO v_viewer_retention;

  -- Anti-abuse: detect viewbot behavior
  -- Check for suspicious patterns: very high view count but low engagement ratio
  v_viewbot_ratio := CASE
    WHEN v_stream.current_viewers > 50 AND v_chat_messages = 0 AND v_reactions_count = 0
    THEN 0.9
    WHEN v_stream.current_viewers > 100 AND v_chat_messages < 5
    THEN 0.6
    ELSE 0.0
  END;

  -- Check AFK: no chat, no gifts in last 15 minutes
  v_is_afk := NOT EXISTS (
    SELECT 1 FROM stream_messages
    WHERE stream_id = p_stream_id AND created_at > NOW() - INTERVAL '15 minutes'
  ) AND NOT EXISTS (
    SELECT 1 FROM stream_gifts
    WHERE stream_id = p_stream_id AND created_at > NOW() - INTERVAL '15 minutes'
  );

  -- Compute component scores (normalized to 0-100)
  -- Viewer score: logarithmic scale to prevent raw count dominance
  v_viewer_score := LEAST(LN(GREATEST(v_stream.current_viewers, 1) + 1) / LN(10000) * 100, 100);

  -- Chat score: messages per minute normalized
  v_chat_score := LEAST(v_chat_messages::NUMERIC / 5.0 * 20, 100);

  -- Reaction score
  v_reaction_score := LEAST(v_reactions_count::NUMERIC / 10.0 * 20, 100);

  -- Share score
  v_share_score := LEAST(v_shares_count::NUMERIC * 10, 100);

  -- Watch time score (proxy via viewer retention)
  v_watch_time_score := LEAST(v_viewer_retention * 100, 100);

  -- Recent activity score (engagement in last 2 minutes)
  SELECT COALESCE(SUM(event_value), 0) INTO v_recent_engagement
  FROM engagement_snapshots
  WHERE content_id = p_stream_id
    AND content_type = 'stream'
    AND created_at > NOW() - INTERVAL '2 minutes';
  v_recent_score := LEAST(v_recent_engagement::NUMERIC / 20.0 * 100, 100);

  -- Weighted base score
  v_base_score := (
    v_viewer_score * w_viewer +
    v_chat_score * w_chat +
    v_reaction_score * w_reaction +
    v_share_score * w_share +
    v_watch_time_score * w_watch_time +
    v_recent_score * w_recent
  ) / 100.0;

  -- AFK penalty
  IF v_is_afk THEN
    v_base_score := v_base_score * 0.5;
  END IF;

  -- Get reputation modifier
  SELECT reputation_modifier INTO v_reputation_mod
  FROM user_reputation_v2 WHERE user_id = v_stream.broadcaster_id;
  v_reputation_mod := COALESCE(v_reputation_mod, 1.0);

  -- Get momentum boost
  SELECT COALESCE(boost_multiplier, 1.0) INTO v_momentum_boost
  FROM momentum_tracking
  WHERE content_id = p_stream_id AND content_type = 'stream' AND is_boosted = true
    AND boost_expires_at > NOW();
  v_momentum_boost := COALESCE(v_momentum_boost, 1.0);

  -- Get new user boost
  SELECT boost_multiplier INTO v_new_user_boost
  FROM new_user_boosts
  WHERE user_id = v_stream.broadcaster_id AND is_active = true AND boost_expires_at > NOW();
  v_new_user_boost := COALESCE(v_new_user_boost, 1.0);

  -- Abuse penalty
  v_abuse_penalty := 1.0;
  IF v_viewbot_ratio > get_visibility_config('abuse_viewbot_threshold', 0.8) THEN
    v_abuse_penalty := get_visibility_config('abuse_auto_penalty_multiplier', 0.1);

    -- Auto-flag for review
    INSERT INTO anti_abuse_flags (content_id, content_type, user_id, flag_type, severity, confidence, evidence)
    VALUES (p_stream_id, 'stream', v_stream.broadcaster_id, 'viewbot_suspected',
            CASE WHEN v_viewbot_ratio > 0.9 THEN 'high' ELSE 'medium' END,
            v_viewbot_ratio * 100,
            jsonb_build_object('viewer_count', v_stream.current_viewers, 'chat_messages', v_chat_messages))
    ON CONFLICT DO NOTHING;
  END IF;

  -- Final visibility score
  v_final_score := v_base_score * v_reputation_mod * v_momentum_boost * v_new_user_boost * v_abuse_penalty;

  -- Upsert into visibility_scores
  INSERT INTO visibility_scores (
    content_id, content_type, user_id,
    viewer_score, chat_score, reaction_score, share_score, watch_time_score, recent_activity_score,
    reputation_modifier, momentum_boost, new_user_boost, abuse_penalty,
    base_score, final_visibility_score, last_calculated_at
  ) VALUES (
    p_stream_id, 'stream', v_stream.broadcaster_id,
    v_viewer_score, v_chat_score, v_reaction_score, v_share_score, v_watch_time_score, v_recent_score,
    v_reputation_mod, v_momentum_boost, v_new_user_boost, v_abuse_penalty,
    v_base_score, v_final_score, NOW()
  )
  ON CONFLICT (content_id, content_type)
  DO UPDATE SET
    viewer_score = EXCLUDED.viewer_score,
    chat_score = EXCLUDED.chat_score,
    reaction_score = EXCLUDED.reaction_score,
    share_score = EXCLUDED.share_score,
    watch_time_score = EXCLUDED.watch_time_score,
    recent_activity_score = EXCLUDED.recent_activity_score,
    reputation_modifier = EXCLUDED.reputation_modifier,
    momentum_boost = EXCLUDED.momentum_boost,
    new_user_boost = EXCLUDED.new_user_boost,
    abuse_penalty = EXCLUDED.abuse_penalty,
    base_score = EXCLUDED.base_score,
    final_visibility_score = EXCLUDED.final_visibility_score,
    last_calculated_at = NOW(),
    updated_at = NOW();

  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 12: AUCTION DISCOVERY SCORE CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_auction_discovery_score(p_auction_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_auction RECORD;
  v_reputation RECORD;
  v_momentum RECORD;

  -- Weights from config
  w_bidders NUMERIC;
  w_total_bids NUMERIC;
  w_bid_freq NUMERIC;
  w_viewers NUMERIC;
  w_watch_time NUMERIC;
  w_completion NUMERIC;

  -- Raw metrics
  v_active_bidders INTEGER;
  v_total_bids INTEGER;
  v_bid_frequency NUMERIC;  -- bids per minute
  v_unique_viewers INTEGER;
  v_completion_rate NUMERIC;
  v_bidder_retention NUMERIC;

  -- Computed scores
  v_bidders_score NUMERIC;
  v_total_bids_score NUMERIC;
  v_bid_freq_score NUMERIC;
  v_viewers_score NUMERIC;
  v_watch_time_score NUMERIC;
  v_completion_score NUMERIC;

  v_base_score NUMERIC;
  v_reputation_mod NUMERIC;
  v_momentum_boost NUMERIC;
  v_new_user_boost NUMERIC;
  v_abuse_penalty NUMERIC;
  v_final_score NUMERIC;

  v_competitive_boost BOOLEAN;
  v_is_cancelled BOOLEAN;
  v_is_inactive BOOLEAN;
BEGIN
  -- Load config weights
  w_bidders := get_visibility_config('auction_weight_active_bidders', 25);
  w_total_bids := get_visibility_config('auction_weight_total_bids', 20);
  w_bid_freq := get_visibility_config('auction_weight_bid_frequency', 20);
  w_viewers := get_visibility_config('auction_weight_unique_viewers', 15);
  w_watch_time := get_visibility_config('auction_weight_watch_time', 10);
  w_completion := get_visibility_config('auction_weight_completion_rate', 10);

  -- Get auction data
  SELECT * INTO v_auction FROM auction_shows WHERE id = p_auction_id;
  IF v_auction IS NULL OR v_auction.status NOT IN ('live', 'scheduled') THEN RETURN 0; END IF;

  -- Active bidders (unique users who bid in last 30 min)
  SELECT COUNT(DISTINCT user_id) INTO v_active_bidders
  FROM auction_bids
  WHERE auction_id = p_auction_id
    AND created_at > NOW() - INTERVAL '30 minutes';

  -- Total bids
  SELECT COUNT(*) INTO v_total_bids
  FROM auction_bids
  WHERE auction_id = p_auction_id;

  -- Bid frequency (bids per minute since start)
  v_bid_frequency := CASE
    WHEN v_auction.live_started_at IS NOT NULL THEN
      v_total_bids::NUMERIC / GREATEST(EXTRACT(EPOCH FROM (NOW() - v_auction.live_started_at)) / 60, 1)
    ELSE 0
  END;

  -- Unique viewers
  SELECT COUNT(DISTINCT user_id) INTO v_unique_viewers
  FROM engagement_snapshots
  WHERE content_id = p_auction_id
    AND content_type = 'auction'
    AND event_type = 'view'
    AND created_at > NOW() - INTERVAL '30 minutes';

  -- Completion rate (historical for this auctioneer)
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'ended')::NUMERIC /
    NULLIF(COUNT(*), 0)
  , 0) INTO v_completion_rate
  FROM auction_shows
  WHERE auctioneer_id = v_auction.auctioneer_id;

  -- Competitive bidding war boost: 3+ bidders in last 5 min
  v_competitive_boost := v_active_bidders >= 3;

  -- Penalty flags
  v_is_cancelled := v_auction.status = 'cancelled';
  v_is_inactive := v_total_bids = 0 AND v_auction.live_started_at < NOW() - INTERVAL '30 minutes';

  -- Compute component scores
  v_bidders_score := LEAST(v_active_bidders::NUMERIC / 10.0 * 100, 100);
  v_total_bids_score := LEAST(v_total_bids::NUMERIC / 50.0 * 100, 100);
  v_bid_freq_score := LEAST(v_bid_frequency * 10, 100);
  v_viewers_score := LEAST(LN(GREATEST(v_unique_viewers, 1) + 1) / LN(1000) * 100, 100);
  v_watch_time_score := 50;  -- Default without tracking data
  v_completion_score := v_completion_rate * 100;

  -- Weighted base score
  v_base_score := (
    v_bidders_score * w_bidders +
    v_total_bids_score * w_total_bids +
    v_bid_freq_score * w_bid_freq +
    v_viewers_score * w_viewers +
    v_watch_time_score * w_watch_time +
    v_completion_score * w_completion
  ) / 100.0;

  -- Competitive boost
  IF v_competitive_boost THEN
    v_base_score := v_base_score * 1.2;
  END IF;

  -- Penalties
  IF v_is_cancelled THEN v_base_score := v_base_score * 0.1; END IF;
  IF v_is_inactive THEN v_base_score := v_base_score * 0.3; END IF;

  -- Get reputation modifier (auctioneer)
  SELECT reputation_modifier INTO v_reputation_mod
  FROM user_reputation_v2 WHERE user_id = v_auction.auctioneer_id;
  v_reputation_mod := COALESCE(v_reputation_mod, 1.0);

  -- Get momentum boost
  SELECT COALESCE(boost_multiplier, 1.0) INTO v_momentum_boost
  FROM momentum_tracking
  WHERE content_id = p_auction_id AND content_type = 'auction' AND is_boosted = true
    AND boost_expires_at > NOW();
  v_momentum_boost := COALESCE(v_momentum_boost, 1.0);

  -- Get new user boost
  SELECT boost_multiplier INTO v_new_user_boost
  FROM new_user_boosts
  WHERE user_id = v_auction.auctioneer_id AND is_active = true AND boost_expires_at > NOW();
  v_new_user_boost := COALESCE(v_new_user_boost, 1.0);

  -- Abuse penalty
  v_abuse_penalty := 1.0;

  -- Final score
  v_final_score := v_base_score * v_reputation_mod * v_momentum_boost * v_new_user_boost * v_abuse_penalty;

  -- Upsert
  INSERT INTO visibility_scores (
    content_id, content_type, user_id,
    viewer_score, chat_score, reaction_score, share_score, watch_time_score, recent_activity_score,
    reputation_modifier, momentum_boost, new_user_boost, abuse_penalty,
    base_score, final_visibility_score, last_calculated_at
  ) VALUES (
    p_auction_id, 'auction', v_auction.auctioneer_id,
    v_bidders_score, v_total_bids_score, v_bid_freq_score, v_viewers_score, v_watch_time_score, v_completion_score,
    v_reputation_mod, v_momentum_boost, v_new_user_boost, v_abuse_penalty,
    v_base_score, v_final_score, NOW()
  )
  ON CONFLICT (content_id, content_type)
  DO UPDATE SET
    viewer_score = EXCLUDED.viewer_score,
    chat_score = EXCLUDED.chat_score,
    reaction_score = EXCLUDED.reaction_score,
    share_score = EXCLUDED.share_score,
    watch_time_score = EXCLUDED.watch_time_score,
    recent_activity_score = EXCLUDED.recent_activity_score,
    reputation_modifier = EXCLUDED.reputation_modifier,
    momentum_boost = EXCLUDED.momentum_boost,
    new_user_boost = EXCLUDED.new_user_boost,
    abuse_penalty = EXCLUDED.abuse_penalty,
    base_score = EXCLUDED.base_score,
    final_visibility_score = EXCLUDED.final_visibility_score,
    last_calculated_at = NOW(),
    updated_at = NOW();

  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 13: BATTLE DISCOVERY SCORE CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_battle_discovery_score(p_battle_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_battle RECORD;
  v_challenger_stream RECORD;
  v_opponent_stream RECORD;

  -- Weights from config
  w_supporters NUMERIC;
  w_crowns NUMERIC;
  w_participation NUMERIC;
  w_streaks NUMERIC;
  w_completion NUMERIC;
  w_engagement NUMERIC;

  -- Raw metrics
  v_crowns_challenger INTEGER;
  v_crowns_opponent INTEGER;
  v_unique_supporters INTEGER;
  v_viewer_participation NUMERIC;
  v_win_streaks INTEGER;
  v_completion_rate NUMERIC;
  v_engagement_rate NUMERIC;

  -- Computed scores
  v_supporters_score NUMERIC;
  v_crowns_score NUMERIC;
  v_participation_score NUMERIC;
  v_streaks_score NUMERIC;
  v_completion_score NUMERIC;
  v_engagement_score NUMERIC;

  v_base_score NUMERIC;
  v_reputation_mod NUMERIC;
  v_momentum_boost NUMERIC;
  v_new_user_boost NUMERIC;
  v_abuse_penalty NUMERIC;
  v_final_score NUMERIC;

  v_primary_user_id UUID;
BEGIN
  -- Load config weights
  w_supporters := get_visibility_config('battle_weight_unique_supporters', 25);
  w_crowns := get_visibility_config('battle_weight_crowns', 20);
  w_participation := get_visibility_config('battle_weight_viewer_participation', 20);
  w_streaks := get_visibility_config('battle_weight_win_streaks', 15);
  w_completion := get_visibility_config('battle_weight_completion_rate', 10);
  w_engagement := get_visibility_config('battle_weight_engagement_rate', 10);

  -- Get battle data
  SELECT * INTO v_battle FROM battles WHERE id = p_battle_id;
  IF v_battle IS NULL OR v_battle.status NOT IN ('active', 'pending') THEN RETURN 0; END IF;

  -- Crown totals
  v_crowns_challenger := COALESCE(v_battle.score_challenger, 0);
  v_crowns_opponent := COALESCE(v_battle.score_opponent, 0);

  -- Unique supporters (distinct users who sent gifts to either side)
  SELECT COUNT(DISTINCT sender_id) INTO v_unique_supporters
  FROM stream_gifts sg
  JOIN streams s ON sg.stream_id = s.id
  WHERE s.battle_id = p_battle_id
    AND sg.created_at > NOW() - INTERVAL '30 minutes';

  -- Viewer participation ratio
  SELECT COALESCE(
    v_unique_supporters::NUMERIC /
    NULLIF(GREATEST(
      (SELECT current_viewers FROM streams WHERE id = v_battle.challenger_stream_id), 1
    ), 0)
  , 0) INTO v_viewer_participation;

  -- Win streaks for both participants
  SELECT COUNT(*) INTO v_win_streaks
  FROM battles
  WHERE status = 'ended'
    AND winner_stream_id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id)
    AND ended_at > NOW() - INTERVAL '7 days';

  -- Battle completion rate (for both streamers)
  SELECT COALESCE(
    COUNT(*) FILTER (WHERE status = 'ended')::NUMERIC /
    NULLIF(COUNT(*), 0)
  , 0) INTO v_completion_rate
  FROM battles
  WHERE challenger_stream_id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id)
     OR opponent_stream_id IN (v_battle.challenger_stream_id, v_battle.opponent_stream_id);

  -- Engagement rate: total engagement events / total viewers
  SELECT COALESCE(
    COUNT(*)::NUMERIC /
    NULLIF(GREATEST(
      (SELECT current_viewers FROM streams WHERE id = v_battle.challenger_stream_id), 1
    ), 0)
  , 0) INTO v_engagement_rate
  FROM engagement_snapshots
  WHERE content_id = p_battle_id
    AND content_type = 'battle'
    AND created_at > NOW() - INTERVAL '30 minutes';

  -- Compute component scores
  -- Unique supporters (diversity matters more than raw crowns)
  v_supporters_score := LEAST(v_unique_supporters::NUMERIC / 20.0 * 100, 100);

  -- Crowns score (logarithmic to prevent pay-to-win dominance)
  v_crowns_score := LEAST(LN(GREATEST(v_crowns_challenger + v_crowns_opponent, 1) + 1) / LN(100000) * 100, 100);

  -- Participation score
  v_participation_score := LEAST(v_viewer_participation * 200, 100);

  -- Win streaks score
  v_streaks_score := LEAST(v_win_streaks::NUMERIC * 20, 100);

  -- Completion score
  v_completion_score := v_completion_rate * 100;

  -- Engagement score
  v_engagement_score := LEAST(v_engagement_rate * 100, 100);

  -- Weighted base score
  v_base_score := (
    v_supporters_score * w_supporters +
    v_crowns_score * w_crowns +
    v_participation_score * w_participation +
    v_streaks_score * w_streaks +
    v_completion_score * w_completion +
    v_engagement_score * w_engagement
  ) / 100.0;

  -- Use challenger streamer as primary user for boost lookups
  SELECT broadcaster_id INTO v_primary_user_id
  FROM streams WHERE id = v_battle.challenger_stream_id;

  -- Get reputation modifier
  SELECT reputation_modifier INTO v_reputation_mod
  FROM user_reputation_v2 WHERE user_id = v_primary_user_id;
  v_reputation_mod := COALESCE(v_reputation_mod, 1.0);

  -- Get momentum boost
  SELECT COALESCE(boost_multiplier, 1.0) INTO v_momentum_boost
  FROM momentum_tracking
  WHERE content_id = p_battle_id AND content_type = 'battle' AND is_boosted = true
    AND boost_expires_at > NOW();
  v_momentum_boost := COALESCE(v_momentum_boost, 1.0);

  -- Get new user boost
  SELECT boost_multiplier INTO v_new_user_boost
  FROM new_user_boosts
  WHERE user_id = v_primary_user_id AND is_active = true AND boost_expires_at > NOW();
  v_new_user_boost := COALESCE(v_new_user_boost, 1.0);

  -- Abuse penalty
  v_abuse_penalty := 1.0;

  -- Final score
  v_final_score := v_base_score * v_reputation_mod * v_momentum_boost * v_new_user_boost * v_abuse_penalty;

  -- Upsert
  INSERT INTO visibility_scores (
    content_id, content_type, user_id,
    viewer_score, chat_score, reaction_score, share_score, watch_time_score, recent_activity_score,
    reputation_modifier, momentum_boost, new_user_boost, abuse_penalty,
    base_score, final_visibility_score, last_calculated_at
  ) VALUES (
    p_battle_id, 'battle', v_primary_user_id,
    v_supporters_score, v_crowns_score, v_participation_score, v_streaks_score, v_completion_score, v_engagement_score,
    v_reputation_mod, v_momentum_boost, v_new_user_boost, v_abuse_penalty,
    v_base_score, v_final_score, NOW()
  )
  ON CONFLICT (content_id, content_type)
  DO UPDATE SET
    viewer_score = EXCLUDED.viewer_score,
    chat_score = EXCLUDED.chat_score,
    reaction_score = EXCLUDED.reaction_score,
    share_score = EXCLUDED.share_score,
    watch_time_score = EXCLUDED.watch_time_score,
    recent_activity_score = EXCLUDED.recent_activity_score,
    reputation_modifier = EXCLUDED.reputation_modifier,
    momentum_boost = EXCLUDED.momentum_boost,
    new_user_boost = EXCLUDED.new_user_boost,
    abuse_penalty = EXCLUDED.abuse_penalty,
    base_score = EXCLUDED.base_score,
    final_visibility_score = EXCLUDED.final_visibility_score,
    last_calculated_at = NOW(),
    updated_at = NOW();

  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 14: HOT SCORE CALCULATION (TIME-DECAY)
-- ============================================================================
-- Recent engagement matters more than older engagement
-- Uses exponential decay: score * e^(-lambda * age_minutes)

CREATE OR REPLACE FUNCTION calculate_hot_score(p_content_id UUID, p_content_type TEXT)
RETURNS NUMERIC AS $$
DECLARE
  v_half_life NUMERIC;
  v_lambda NUMERIC;
  v_hot_score NUMERIC := 0;
  v_snapshot RECORD;
  v_age_minutes NUMERIC;
  v_decay_weight NUMERIC;
  v_base_score NUMERIC;
BEGIN
  -- Get config
  v_half_life := get_visibility_config('hot_score_half_life_minutes', 30);

  -- Lambda = ln(2) / half_life
  v_lambda := LN(2) / GREATEST(v_half_life, 1);

  -- Calculate time-decayed engagement sum
  FOR v_snapshot IN
    SELECT event_type, event_value, created_at
    FROM engagement_snapshots
    WHERE content_id = p_content_id
      AND content_type = p_content_type
      AND created_at > NOW() - INTERVAL '4 hours'
  LOOP
    v_age_minutes := EXTRACT(EPOCH FROM (NOW() - v_snapshot.created_at)) / 60;
    v_decay_weight := EXP(-v_lambda * GREATEST(v_age_minutes, 0));

    -- Weight different event types
    v_hot_score := v_hot_score + (v_snapshot.event_value * v_decay_weight *
      CASE v_snapshot.event_type
        WHEN 'crown' THEN 5.0
        WHEN 'bid' THEN 4.0
        WHEN 'share' THEN 3.0
        WHEN 'reaction' THEN 2.0
        WHEN 'chat' THEN 1.0
        WHEN 'view' THEN 0.5
        WHEN 'watch_time' THEN 1.5
        ELSE 1.0
      END
    );
  END LOOP;

  -- Normalize to 0-100 scale using log scaling
  v_hot_score := LEAST(LN(GREATEST(v_hot_score, 0) + 1) / LN(10000) * 100, 100);

  -- Incorporate base score from visibility_scores
  SELECT base_score INTO v_base_score
  FROM visibility_scores
  WHERE content_id = p_content_id AND content_type = p_content_type;
  v_base_score := COALESCE(v_base_score, 0);

  -- Final hot score is weighted: 70% time-decayed engagement + 30% base score
  v_hot_score := (v_hot_score * 0.7) + (v_base_score * 0.3);

  -- Update the visibility_scores record
  UPDATE visibility_scores
  SET hot_score = v_hot_score,
      last_calculated_at = NOW(),
      updated_at = NOW()
  WHERE content_id = p_content_id AND content_type = p_content_type;

  RETURN v_hot_score;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 15: MOMENTUM BOOST DETECTION
-- ============================================================================
-- Detects rapid engagement spikes and applies temporary ranking boosts

CREATE OR REPLACE FUNCTION detect_momentum_boost(p_content_id UUID, p_content_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_momentum RECORD;
  v_viewer_threshold INTEGER;
  v_bid_threshold INTEGER;
  v_chat_threshold INTEGER;
  v_boost_duration INTEGER;
  v_boost_mult NUMERIC;
  v_should_boost BOOLEAN := FALSE;
  v_velocity_trend TEXT := 'stable';
BEGIN
  -- Get thresholds from config
  v_viewer_threshold := get_visibility_config('momentum_viewer_threshold', 50)::INTEGER;
  v_bid_threshold := get_visibility_config('momentum_bid_threshold', 20)::INTEGER;
  v_chat_threshold := get_visibility_config('momentum_chat_threshold', 100)::INTEGER;
  v_boost_duration := get_visibility_config('momentum_boost_duration_minutes', 15)::INTEGER;
  v_boost_mult := get_visibility_config('momentum_boost_multiplier', 1.5);

  -- Get current momentum data
  SELECT * INTO v_momentum
  FROM momentum_tracking
  WHERE content_id = p_content_id AND content_type = p_content_type;

  IF v_momentum IS NULL THEN RETURN FALSE; END IF;

  -- Determine velocity trend
  IF v_momentum.viewers_2min > v_momentum.viewers_5min * 0.5 THEN
    v_velocity_trend := 'accelerating';
  ELSIF v_momentum.viewers_2min < v_momentum.viewers_5min * 0.2 THEN
    v_velocity_trend := 'decelerating';
  ELSE
    v_velocity_trend := 'stable';
  END IF;

  -- Check momentum thresholds based on content type
  IF p_content_type = 'stream' THEN
    -- 50+ new viewers in 2 minutes
    IF v_momentum.viewers_2min >= v_viewer_threshold THEN
      v_should_boost := TRUE;
    END IF;
    -- Rapid chat growth: 100+ messages in 2 minutes
    IF v_momentum.chat_2min >= v_chat_threshold THEN
      v_should_boost := TRUE;
    END IF;
    -- Sudden reaction spike: 50+ reactions in 1 minute
    IF v_momentum.reactions_1min >= 50 THEN
      v_should_boost := TRUE;
    END IF;
    -- High crown activity: 20+ crowns in 1 minute
    IF v_momentum.crowns_1min >= 20 THEN
      v_should_boost := TRUE;
    END IF;

  ELSIF p_content_type = 'auction' THEN
    -- 20+ bids in 60 seconds
    IF v_momentum.bids_1min >= v_bid_threshold THEN
      v_should_boost := TRUE;
    END IF;

  ELSIF p_content_type = 'battle' THEN
    -- Rapid crown activity on either side
    IF v_momentum.crowns_1min >= 15 THEN
      v_should_boost := TRUE;
    END IF;
  END IF;

  -- Update momentum tracking
  UPDATE momentum_tracking SET
    is_boosted = v_should_boost,
    boost_expires_at = CASE WHEN v_should_boost THEN NOW() + (v_boost_duration || ' minutes')::INTERVAL
                            ELSE boost_expires_at END,
    boost_multiplier = CASE WHEN v_should_boost THEN v_boost_mult ELSE boost_multiplier END,
    momentum_level = CASE
      WHEN v_should_boost THEN LEAST(COALESCE(momentum_level, 0) + 30, 100)
      ELSE GREATEST(COALESCE(momentum_level, 0) - 5, 0)
    END,
    velocity_trend = v_velocity_trend,
    updated_at = NOW()
  WHERE content_id = p_content_id AND content_type = p_content_type;

  -- If boosting, update the visibility score
  IF v_should_boost THEN
    UPDATE visibility_scores SET
      momentum_boost = v_boost_mult,
      is_rising = TRUE,
      updated_at = NOW()
    WHERE content_id = p_content_id AND content_type = p_content_type;
  END IF;

  RETURN v_should_boost;
END;
$$ LANGUAGE plpgsql;

-- Momentum decay function (should be called periodically)
CREATE OR REPLACE FUNCTION decay_momentum_boosts()
RETURNS VOID AS $$
DECLARE
  v_expired RECORD;
BEGIN
  FOR v_expired IN
    SELECT content_id, content_type
    FROM momentum_tracking
    WHERE is_boosted = true AND boost_expires_at < NOW()
  LOOP
    UPDATE momentum_tracking SET
      is_boosted = false,
      boost_multiplier = 1.0,
      momentum_level = GREATEST(COALESCE(momentum_level, 0) - 20, 0),
      updated_at = NOW()
    WHERE content_id = v_expired.content_id AND content_type = v_expired.content_type;

    UPDATE visibility_scores SET
      momentum_boost = 1.0,
      is_rising = false,
      updated_at = NOW()
    WHERE content_id = v_expired.content_id AND content_type = v_expired.content_type;
  END LOOP;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 16: USER REPUTATION V2 CALCULATION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_user_reputation_v2(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_reputation RECORD;
  v_positive_score NUMERIC := 0;
  v_negative_score NUMERIC := 0;
  v_new_score INTEGER;
  v_new_tier TEXT;
  v_new_modifier NUMERIC;
  v_decay_days INTEGER;
BEGIN
  -- Get current reputation
  SELECT * INTO v_reputation FROM user_reputation_v2 WHERE user_id = p_user_id;
  IF v_reputation IS NULL THEN
    INSERT INTO user_reputation_v2 (user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
    SELECT * INTO v_reputation FROM user_reputation_v2 WHERE user_id = p_user_id;
  END IF;

  -- Update account age
  UPDATE user_reputation_v2 SET
    account_age_days = EXTRACT(DAY FROM (NOW() - u.created_at))::INTEGER
  FROM user_profiles u
  WHERE user_reputation_v2.user_id = p_user_id AND u.id = p_user_id;

  -- Calculate positive signals
  v_positive_score := 0;

  -- Account age: up to 20 points (1 point per 18 days, max 360 days)
  v_positive_score := v_positive_score + LEAST(v_reputation.account_age_days::NUMERIC / 18.0, 20);

  -- Completed auctions: up to 15 points
  v_positive_score := v_positive_score + LEAST(v_reputation.completed_auctions::NUMERIC * 3, 15);

  -- Successful battles: up to 10 points
  v_positive_score := v_positive_score + LEAST(v_reputation.successful_battles::NUMERIC * 2, 10);

  -- Total streams: up to 10 points
  v_positive_score := v_positive_score + LEAST(v_reputation.total_streams::NUMERIC * 0.5, 10);

  -- Positive engagement: up to 20 points
  v_positive_score := v_positive_score + LEAST(v_reputation.positive_engagement_count::NUMERIC * 0.2, 20);

  -- Community participation: up to 10 points
  v_positive_score := v_positive_score + LEAST(v_reputation.community_participation_score::NUMERIC * 0.1, 10);

  -- Verified status: 15 points
  IF v_reputation.is_verified THEN
    v_positive_score := v_positive_score + 15;
  END IF;

  -- Calculate negative signals (with time decay)
  v_negative_score := 0;

  v_decay_days := get_visibility_config('reputation_decay_days', 90)::INTEGER;

  -- Spam reports (decays over time)
  v_negative_score := v_negative_score + LEAST(v_reputation.spam_reports::NUMERIC *
    GREATEST(1.0 - (EXTRACT(DAY FROM (NOW() - COALESCE(v_reputation.last_negative_at, NOW()))) / v_decay_days), 0), 20);

  -- Excessive reports
  v_negative_score := v_negative_score + LEAST(v_reputation.excessive_reports::NUMERIC * 2, 20);

  -- Auction abuse
  v_negative_score := v_negative_score + LEAST(v_reputation.auction_abuse_count::NUMERIC * 5, 25);

  -- Fraud attempts
  v_negative_score := v_negative_score + LEAST(v_reputation.fraud_attempts::NUMERIC * 10, 30);

  -- Chargebacks
  v_negative_score := v_negative_score + LEAST(v_reputation.chargebacks::NUMERIC * 8, 25);

  -- Rule violations
  v_negative_score := v_negative_score + LEAST(v_reputation.rule_violations::NUMERIC * 3, 20);

  -- Viewbot flags
  v_negative_score := v_negative_score + LEAST(v_reputation.viewbot_flags::NUMERIC * 5, 25);

  -- Calculate new score (base 100 + positive - negative, clamped to 0-200)
  v_new_score := GREATEST(0, LEAST(200, 100 + ROUND(v_positive_score - v_negative_score)));

  -- Determine tier
  v_new_tier := CASE
    WHEN v_new_score >= 180 THEN 'legendary'
    WHEN v_new_score >= 150 THEN 'excellent'
    WHEN v_new_score >= 120 THEN 'good'
    WHEN v_new_score >= 80 THEN 'standard'
    WHEN v_new_score >= 50 THEN 'warning'
    WHEN v_new_score >= get_visibility_config('reputation_minimum_threshold', 30) THEN 'poor'
    ELSE 'restricted'
  END;

  -- Calculate reputation modifier (multiplier for visibility scores)
  -- Ranges from 0.1 (restricted) to 1.5 (legendary)
  v_new_modifier := CASE v_new_tier
    WHEN 'legendary' THEN 1.5
    WHEN 'excellent' THEN 1.3
    WHEN 'good' THEN 1.15
    WHEN 'standard' THEN 1.0
    WHEN 'warning' THEN 0.8
    WHEN 'poor' THEN 0.5
    WHEN 'restricted' THEN 0.1
    ELSE 1.0
  END;

  -- Update record
  UPDATE user_reputation_v2 SET
    current_score = v_new_score,
    lifetime_score = CASE WHEN v_new_score > lifetime_score THEN v_new_score ELSE lifetime_score END,
    reputation_tier = v_new_tier,
    positive_signal_score = v_positive_score,
    negative_signal_score = v_negative_score,
    reputation_modifier = v_new_modifier,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log the reputation change
  IF v_new_score != COALESCE(v_reputation.current_score, 100) THEN
    INSERT INTO reputation_events (reputation_type, event_type, user_id, score_change, previous_score, new_score, reason)
    VALUES ('user', 'reputation_recalc', p_user_id, v_new_score - COALESCE(v_reputation.current_score, 100),
            v_reputation.current_score, v_new_score, 'Automated reputation recalculation');
  END IF;

  RETURN v_new_score;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 17: MASTER RECALCULATION FUNCTION
-- ============================================================================
-- Recalculates all scores for a piece of content (discovery + hot + momentum)

CREATE OR REPLACE FUNCTION recalculate_visibility(p_content_id UUID, p_content_type TEXT)
RETURNS JSONB AS $$
DECLARE
  v_discovery_score NUMERIC;
  v_hot_score NUMERIC;
  v_momentum_triggered BOOLEAN;
  v_final_score NUMERIC;
BEGIN
  -- Step 1: Calculate discovery score based on content type
  IF p_content_type = 'stream' THEN
    v_discovery_score := calculate_stream_discovery_score(p_content_id);
  ELSIF p_content_type = 'auction' THEN
    v_discovery_score := calculate_auction_discovery_score(p_content_id);
  ELSIF p_content_type = 'battle' THEN
    v_discovery_score := calculate_battle_discovery_score(p_content_id);
  ELSE
    v_discovery_score := 0;
  END IF;

  -- Step 2: Calculate hot score (time-decayed engagement)
  v_hot_score := calculate_hot_score(p_content_id, p_content_type);

  -- Step 3: Detect momentum boosts
  v_momentum_triggered := detect_momentum_boost(p_content_id, p_content_type);

  -- Step 4: Update final visibility score
  -- Final = (discovery * 0.6 + hot * 0.4) * momentum_boost * new_user_boost * reputation_mod * abuse_penalty
  -- The momentum/reputation/abuse multipliers are already baked into discovery score
  -- So we blend discovery and hot
  UPDATE visibility_scores SET
    final_visibility_score = (base_score * 0.6 + v_hot_score * 0.4) *
      COALESCE(momentum_boost, 1.0) * COALESCE(new_user_boost, 1.0) * COALESCE(abuse_penalty, 1.0),
    is_trending = (v_hot_score > 70),
    last_calculated_at = NOW(),
    updated_at = NOW()
  WHERE content_id = p_content_id AND content_type = p_content_type
  RETURNING final_visibility_score INTO v_final_score;

  RETURN jsonb_build_object(
    'content_id', p_content_id,
    'content_type', p_content_type,
    'discovery_score', v_discovery_score,
    'hot_score', v_hot_score,
    'momentum_triggered', v_momentum_triggered,
    'final_score', v_final_score
  );
END;
$$ LANGUAGE plpgsql;

-- Batch recalculation for all live content
CREATE OR REPLACE FUNCTION recalculate_all_visibility()
RETURNS JSONB AS $$
DECLARE
  v_stream RECORD;
  v_auction RECORD;
  v_battle RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Recalculate all live streams
  FOR v_stream IN SELECT id FROM streams WHERE is_live = true LOOP
    PERFORM recalculate_visibility(v_stream.id, 'stream');
    v_count := v_count + 1;
  END LOOP;

  -- Recalculate all live auctions
  FOR v_auction IN SELECT id FROM auction_shows WHERE status = 'live' LOOP
    PERFORM recalculate_visibility(v_auction.id, 'auction');
    v_count := v_count + 1;
  END LOOP;

  -- Recalculate all active battles
  FOR v_battle IN SELECT id FROM battles WHERE status = 'active' LOOP
    PERFORM recalculate_visibility(v_battle.id, 'battle');
    v_count := v_count + 1;
  END LOOP;

  -- Decay expired momentum boosts
  PERFORM decay_momentum_boosts();

  -- Clean old engagement snapshots
  PERFORM cleanup_old_engagement_snapshots();

  RETURN jsonb_build_object('recalculated_count', v_count, 'timestamp', NOW());
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 18: FEATURED SECTION QUERY FUNCTIONS
-- ============================================================================

-- Get trending content (highest current momentum / hot score)
CREATE OR REPLACE FUNCTION get_trending_content(
  p_limit INTEGER DEFAULT 20,
  p_content_type TEXT DEFAULT NULL  -- NULL means all types
)
RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  user_id UUID,
  final_visibility_score NUMERIC,
  hot_score NUMERIC,
  is_rising BOOLEAN,
  is_trending BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.content_id,
    vs.content_type,
    vs.user_id,
    vs.final_visibility_score,
    vs.hot_score,
    vs.is_rising,
    vs.is_trending
  FROM visibility_scores vs
  WHERE vs.is_trending = true
    AND (p_content_type IS NULL OR vs.content_type = p_content_type)
  ORDER BY vs.hot_score DESC, vs.final_visibility_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get rising content (fastest-growing, momentum-boosted)
CREATE OR REPLACE FUNCTION get_rising_content(
  p_limit INTEGER DEFAULT 15,
  p_content_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  user_id UUID,
  final_visibility_score NUMERIC,
  hot_score NUMERIC,
  is_rising BOOLEAN,
  momentum_level NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.content_id,
    vs.content_type,
    vs.user_id,
    vs.final_visibility_score,
    vs.hot_score,
    vs.is_rising,
    mt.momentum_level
  FROM visibility_scores vs
  JOIN momentum_tracking mt ON vs.content_id = mt.content_id AND vs.content_type = mt.content_type
  WHERE vs.is_rising = true
    AND (p_content_type IS NULL OR vs.content_type = p_content_type)
  ORDER BY mt.momentum_level DESC, vs.hot_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get new creators content (new user boost active)
CREATE OR REPLACE FUNCTION get_new_creators_content(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  user_id UUID,
  final_visibility_score NUMERIC,
  hot_score NUMERIC,
  is_rising BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.content_id,
    vs.content_type,
    vs.user_id,
    vs.final_visibility_score,
    vs.hot_score,
    vs.new_user_boost
  FROM visibility_scores vs
  WHERE vs.new_user_boost > 1.0
    AND vs.content_type = 'stream'
  ORDER BY vs.final_visibility_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get auction frenzy (most active auctions)
CREATE OR REPLACE FUNCTION get_auction_frenzy(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  user_id UUID,
  final_visibility_score NUMERIC,
  hot_score NUMERIC,
  is_rising BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.content_id,
    vs.content_type,
    vs.user_id,
    vs.final_visibility_score,
    vs.hot_score,
    vs.is_rising
  FROM visibility_scores vs
  WHERE vs.content_type = 'auction'
  ORDER BY vs.final_visibility_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get battle royale (most active battles)
CREATE OR REPLACE FUNCTION get_battle_royale(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  content_id UUID,
  content_type TEXT,
  user_id UUID,
  final_visibility_score NUMERIC,
  hot_score NUMERIC,
  is_rising BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.content_id,
    vs.content_type,
    vs.user_id,
    vs.final_visibility_score,
    vs.hot_score,
    vs.is_rising
  FROM visibility_scores vs
  WHERE vs.content_type = 'battle'
  ORDER BY vs.final_visibility_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 19: ADMIN ANALYTICS DASHBOARD FUNCTIONS
-- ============================================================================

-- Get visibility score breakdown for a piece of content
CREATE OR REPLACE FUNCTION get_visibility_breakdown(p_content_id UUID, p_content_type TEXT)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'content_id', vs.content_id,
    'content_type', vs.content_type,
    'base_score', vs.base_score,
    'hot_score', vs.hot_score,
    'final_visibility_score', vs.final_visibility_score,
    'component_scores', jsonb_build_object(
      'viewer_score', vs.viewer_score,
      'chat_score', vs.chat_score,
      'reaction_score', vs.reaction_score,
      'share_score', vs.share_score,
      'watch_time_score', vs.watch_time_score,
      'recent_activity_score', vs.recent_activity_score
    ),
    'modifiers', jsonb_build_object(
      'reputation_modifier', vs.reputation_modifier,
      'momentum_boost', vs.momentum_boost,
      'new_user_boost', vs.new_user_boost,
      'abuse_penalty', vs.abuse_penalty
    ),
    'status', jsonb_build_object(
      'is_rising', vs.is_rising,
      'is_trending', vs.is_trending
    ),
    'last_calculated_at', vs.last_calculated_at,
    'momentum_data', (
      SELECT jsonb_build_object(
        'viewers_2min', mt.viewers_2min,
        'chat_2min', mt.chat_2min,
        'reactions_1min', mt.reactions_1min,
        'is_boosted', mt.is_boosted,
        'velocity_trend', mt.velocity_trend
      )
      FROM momentum_tracking mt
      WHERE mt.content_id = p_content_id AND mt.content_type = p_content_type
    ),
    'abuse_flags', (
      SELECT jsonb_agg(jsonb_build_object(
        'flag_type', aaf.flag_type,
        'severity', aaf.severity,
        'confidence', aaf.confidence,
        'created_at', aaf.created_at
      ))
      FROM anti_abuse_flags aaf
      WHERE aaf.content_id = p_content_id AND aaf.content_type = p_content_type AND aaf.is_resolved = false
    )
  ) INTO v_result
  FROM visibility_scores vs
  WHERE vs.content_id = p_content_id AND vs.content_type = p_content_type;

  RETURN COALESCE(v_result, jsonb_build_object('error', 'No visibility score found'));
END;
$$ LANGUAGE plpgsql;

-- Get trending report (top content across all types)
CREATE OR REPLACE FUNCTION get_trending_report(p_limit INTEGER DEFAULT 50)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'generated_at', NOW(),
      'total_live_streams', (SELECT COUNT(*) FROM streams WHERE is_live = true),
      'total_live_auctions', (SELECT COUNT(*) FROM auction_shows WHERE status = 'live'),
      'total_active_battles', (SELECT COUNT(*) FROM battles WHERE status = 'active'),
      'total_rising', (SELECT COUNT(*) FROM visibility_scores WHERE is_rising = true),
      'total_trending', (SELECT COUNT(*) FROM visibility_scores WHERE is_trending = true),
      'unresolved_abuse_flags', (SELECT COUNT(*) FROM anti_abuse_flags WHERE is_resolved = false),
      'top_content', (
        SELECT jsonb_agg(jsonb_build_object(
          'rank', row_number() OVER (ORDER BY final_visibility_score DESC),
          'content_id', content_id,
          'content_type', content_type,
          'final_score', final_visibility_score,
          'hot_score', hot_score,
          'is_rising', is_rising,
          'is_trending', is_trending
        ))
        FROM visibility_scores
        ORDER BY final_visibility_score DESC
        LIMIT p_limit
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Get anti-abuse monitoring report
CREATE OR REPLACE FUNCTION get_abuse_monitoring_report()
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'generated_at', NOW(),
      'total_unresolved_flags', (SELECT COUNT(*) FROM anti_abuse_flags WHERE is_resolved = false),
      'flags_by_type', (
        SELECT jsonb_object_agg(flag_type, cnt)
        FROM (SELECT flag_type, COUNT(*) as cnt FROM anti_abuse_flags WHERE is_resolved = false GROUP BY flag_type) sub
      ),
      'flags_by_severity', (
        SELECT jsonb_object_agg(severity, cnt)
        FROM (SELECT severity, COUNT(*) as cnt FROM anti_abuse_flags WHERE is_resolved = false GROUP BY severity) sub
      ),
      'recent_flags', (
        SELECT jsonb_agg(jsonb_build_object(
          'id', id,
          'content_id', content_id,
          'user_id', user_id,
          'flag_type', flag_type,
          'severity', severity,
          'confidence', confidence,
          'created_at', created_at
        ))
        FROM anti_abuse_flags
        WHERE is_resolved = false
        ORDER BY created_at DESC
        LIMIT 50
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Get discovery performance metrics
CREATE OR REPLACE FUNCTION get_discovery_metrics()
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'generated_at', NOW(),
      'active_new_user_boosts', (SELECT COUNT(*) FROM new_user_boosts WHERE is_active = true),
      'reputation_distribution', (
        SELECT jsonb_object_agg(reputation_tier, cnt)
        FROM (SELECT reputation_tier, COUNT(*) as cnt FROM user_reputation_v2 GROUP BY reputation_tier) sub
      ),
      'avg_visibility_score', (SELECT AVG(final_visibility_score) FROM visibility_scores),
      'score_percentiles', jsonb_build_object(
        'p50', (SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_visibility_score) FROM visibility_scores),
        'p90', (SELECT PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY final_visibility_score) FROM visibility_scores),
        'p99', (SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY final_visibility_score) FROM visibility_scores)
      ),
      'oldest_stale_score', (
        SELECT MIN(last_calculated_at) FROM visibility_scores
        WHERE last_calculated_at < NOW() - INTERVAL '5 minutes'
      )
    )
  );
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- PART 20: REAL-TIME UPDATE TRIGGERS
-- ============================================================================

-- Trigger: When a gift is sent, record engagement
CREATE OR REPLACE FUNCTION trg_gift_engagement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM record_engagement(
    COALESCE(NEW.stream_id, NEW.id::text::uuid),
    CASE WHEN NEW.stream_id IS NOT NULL THEN 'stream' ELSE 'auction' END,
    'crown',
    COALESCE(NEW.coins_spent, NEW.amount, 1),
    NEW.sender_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_gift_engagement ON stream_gifts;
CREATE TRIGGER trg_stream_gift_engagement
  AFTER INSERT ON stream_gifts
  FOR EACH ROW EXECUTE FUNCTION trg_gift_engagement();

-- Trigger: When a chat message is sent, record engagement
CREATE OR REPLACE FUNCTION trg_chat_engagement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM record_engagement(NEW.stream_id, 'stream', 'chat', 1, NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_message_engagement ON stream_messages;
CREATE TRIGGER trg_stream_message_engagement
  AFTER INSERT ON stream_messages
  FOR EACH ROW EXECUTE FUNCTION trg_chat_engagement();

-- Trigger: When a bid is placed, record engagement
CREATE OR REPLACE FUNCTION trg_bid_engagement()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM record_engagement(NEW.auction_id, 'auction', 'bid', 1, NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auction_bid_engagement ON auction_bids;
CREATE TRIGGER trg_auction_bid_engagement
  AFTER INSERT ON auction_bids
  FOR EACH ROW EXECUTE FUNCTION trg_bid_engagement();

-- Trigger: When stream goes live, initialize visibility tracking
CREATE OR REPLACE FUNCTION trg_stream_visibility_init()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_live = true AND (OLD IS NULL OR OLD.is_live = false) THEN
    -- Initialize visibility score
    INSERT INTO visibility_scores (content_id, content_type, user_id)
    VALUES (NEW.id, 'stream', NEW.broadcaster_id)
    ON CONFLICT DO NOTHING;

    -- Initialize momentum tracking
    INSERT INTO momentum_tracking (content_id, content_type)
    VALUES (NEW.id, 'stream')
    ON CONFLICT DO NOTHING;
  END IF;

  -- When stream ends, clean up
  IF NEW.is_live = false AND OLD.is_live = true THEN
    UPDATE visibility_scores SET
      final_visibility_score = 0,
      is_trending = false,
      is_rising = false,
      updated_at = NOW()
    WHERE content_id = NEW.id AND content_type = 'stream';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stream_visibility ON streams;
CREATE TRIGGER trg_stream_visibility
  AFTER UPDATE OF is_live ON streams
  FOR EACH ROW EXECUTE FUNCTION trg_stream_visibility_init();


-- ============================================================================
-- PART 21: ENHANCED STREAM FETCHING WITH VISIBILITY SCORES
-- ============================================================================

-- Updated get_active_streams_paged to include visibility score data
CREATE OR REPLACE FUNCTION get_active_streams_v2(
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_sort_by TEXT DEFAULT 'visibility'  -- 'visibility', 'hot', 'rising', 'viewers'
)
RETURNS TABLE (
  id UUID,
  broadcaster_id UUID,
  title TEXT,
  category TEXT,
  current_viewers INTEGER,
  start_time TIMESTAMPTZ,
  thumbnail_url TEXT,
  broadcaster_username TEXT,
  broadcaster_avatar TEXT,
  broadcaster_dob TEXT,
  visibility_score NUMERIC,
  hot_score NUMERIC,
  is_rising BOOLEAN,
  is_trending BOOLEAN,
  momentum_level NUMERIC,
  stream_momentum JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.broadcaster_id,
    s.title,
    s.category,
    s.current_viewers,
    s.start_time,
    s.thumbnail_url,
    u.username,
    u.avatar_url,
    u.date_of_birth::TEXT,
    COALESCE(vs.final_visibility_score, 0),
    COALESCE(vs.hot_score, 0),
    COALESCE(vs.is_rising, false),
    COALESCE(vs.is_trending, false),
    COALESCE(mt.momentum_level, 0),
    jsonb_build_object(
      'momentum', COALESCE(mt.momentum_level, 0),
      'is_boosted', COALESCE(mt.is_boosted, false),
      'velocity_trend', COALESCE(mt.velocity_trend, 'stable'),
      'viewers_2min', COALESCE(mt.viewers_2min, 0),
      'chat_2min', COALESCE(mt.chat_2min, 0)
    )
  FROM streams s
  JOIN user_profiles u ON s.broadcaster_id = u.id
  LEFT JOIN visibility_scores vs ON s.id = vs.content_id AND vs.content_type = 'stream'
  LEFT JOIN momentum_tracking mt ON s.id = mt.content_id AND mt.content_type = 'stream'
  WHERE s.is_live = true
  ORDER BY
    CASE p_sort_by
      WHEN 'visibility' THEN COALESCE(vs.final_visibility_score, 0)
      WHEN 'hot' THEN COALESCE(vs.hot_score, 0)
      WHEN 'rising' THEN CASE WHEN vs.is_rising = true THEN COALESCE(mt.momentum_level, 0) ELSE 0 END
      WHEN 'viewers' THEN s.current_viewers
      ELSE COALESCE(vs.final_visibility_score, 0)
    END DESC,
    s.start_time DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;


-- ============================================================================
-- PART 22: MOMENTUM VELOCITY WINDOW RESET
-- ============================================================================
-- Reset velocity counters on a periodic basis (should be called every 1-2 minutes)
-- This keeps the 1min/2min/5min windows accurate

CREATE OR REPLACE FUNCTION reset_momentum_velocity_windows()
RETURNS VOID AS $$
BEGIN
  -- Age the velocity windows: 1min -> 2min -> 5min -> discard
  -- We implement this by shifting values and letting new events repopulate
  -- the shorter windows. The key insight is that engagement_snapshots
  -- is the source of truth; momentum_tracking is a rolling summary.

  -- Simply let the windows be recalculated on each engagement event
  -- This function handles decay of stale windows
  UPDATE momentum_tracking SET
    viewers_1min = 0,
    chat_1min = 0,
    reactions_1min = 0,
    bids_1min = 0,
    crowns_1min = 0,
    viewers_2min = viewers_1min,  -- shift 1min into 2min window (approximate)
    chat_2min = chat_1min,
    reactions_2min = reactions_1min,
    viewers_5min = viewers_2min,
    bids_5min = bids_5min + bids_1min,
    crowns_5min = crowns_5min + crowns_1min,
    shares_5min = shares_5min,
    last_decay_at = NOW(),
    updated_at = NOW()
  WHERE last_activity_at < NOW() - INTERVAL '2 minutes';

  -- Recalculate accurate windows from engagement_snapshots for active content
  -- This is more expensive but runs less frequently
  -- The real-time path handles correctness between resets
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration creates the complete Visibility Engine v2 system.
-- To activate:
-- 1. Run this migration
-- 2. Call recalculate_all_visibility() to initialize scores for all live content
-- 3. Schedule cleanup_old_engagement_snapshots() to run every hour via pg_cron
-- 4. Schedule recalculate_all_visibility() to run every 1-5 minutes
-- 5. Schedule reset_momentum_velocity_windows() to run every 2 minutes
--
-- The new system replaces:
-- - broadcast_rankings table (hourly rankings) -> visibility_scores with hot_score
-- - stream_ranking table (legacy) -> visibility_scores with component breakdown
-- - broadcast_cycle_stats (30-min cycles) -> engagement_snapshots with time-decay
-- - stream_momentum (0-100 gift-based) -> momentum_tracking (velocity-based)
--
-- The user_reputation system is extended with user_reputation_v2 (additive, not replacing)
-- The is_featured column on streams still works alongside the new system
-- ============================================================================

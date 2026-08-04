-- Missing Tables
-- These tables were in frontend_schema.sql but not in the 6-part split

-- Table: profile_tab_visibility
CREATE TABLE IF NOT EXISTS public.profile_tab_visibility (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    tab_key TEXT NOT NULL CHECK (tab_key IN (
        'social', 'broadcasts', 'marketplace', 'auctions', 'court',
        'agency', 'church', 'subscriptions', 'badges', 'inventory',
        'purchases', 'settings'
    )),
    is_visible BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    UNIQUE(user_id, tab_key)
);

-- Table: installment_milestone_events
CREATE TABLE IF NOT EXISTS public.installment_milestone_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id       UUID NOT NULL REFERENCES public.small_installment_purchases(id) ON DELETE CASCADE,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    milestone_level   SMALLINT NOT NULL,
    credit_points_awarded INTEGER NOT NULL,
    payment_amount    BIGINT NOT NULL,
    event_key         TEXT UNIQUE,          -- idempotency: duplicate event_key = skip
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ux_installment_milestone_purchase_level UNIQUE (purchase_id, milestone_level)
);

-- Table: trollmers_monthly_tournaments
CREATE TABLE IF NOT EXISTS public.trollmers_monthly_tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_start DATE NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    qualifier_cutoff INTEGER NOT NULL DEFAULT 16,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    winner_user_id UUID REFERENCES public.user_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: system_backup_requests
CREATE TABLE IF NOT EXISTS system_backup_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by UUID REFERENCES user_profiles(id),
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  details JSONB
);

-- Table: vehicle_auction_bids
CREATE TABLE IF NOT EXISTS vehicle_auction_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES vehicle_listings(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES user_profiles(id),
  bid_amount INTEGER NOT NULL CHECK (bid_amount >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: featured_broadcasts
CREATE TABLE IF NOT EXISTS featured_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  likes_count INTEGER DEFAULT 0,
  gifts_value INTEGER DEFAULT 0,
  featured_at TIMESTAMPTZ DEFAULT NOW(),
  is_featured BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: broadcast_rankings
CREATE TABLE IF NOT EXISTS broadcast_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  rank_position INTEGER NOT NULL,
  likes_count INTEGER DEFAULT 0,
  gifts_value INTEGER DEFAULT 0,
  viewer_count INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  ranking_hour TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: weekly_top_broadcasters
CREATE TABLE IF NOT EXISTS weekly_top_broadcasters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  rank_position INTEGER NOT NULL,
  total_likes INTEGER DEFAULT 0,
  total_gifts INTEGER DEFAULT 0,
  total_viewers INTEGER DEFAULT 0,
  avg_viewers INTEGER DEFAULT 0,
  is_universe_invited BOOLEAN DEFAULT FALSE,
  universe_event_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start_date)
);

-- Table: dealership_inventory
CREATE TABLE IF NOT EXISTS public.dealership_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dealership TEXT NOT NULL DEFAULT 'KTAuto',
    catalog_id INTEGER NOT NULL REFERENCES public.vehicles_catalog(id),
    quantity INTEGER NOT NULL DEFAULT 50,
    max_quantity INTEGER NOT NULL DEFAULT 50,
    status TEXT NOT NULL DEFAULT 'active', -- active, retired
    created_at TIMESTAMPTZ DEFAULT now(),
    retired_at TIMESTAMPTZ,
    CONSTRAINT dealership_inventory_qty_check CHECK (quantity >= 0),
    CONSTRAINT dealership_inventory_max_check CHECK (max_quantity > 0)
);

-- Table: dealership_vehicle_pool
CREATE TABLE IF NOT EXISTS public.dealership_vehicle_pool (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    style TEXT,
    price INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    armor INTEGER NOT NULL,
    color_from TEXT,
    color_to TEXT,
    image TEXT,
    model_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    used_at TIMESTAMPTZ
);

-- Table: agora_stream_sessions
CREATE TABLE IF NOT EXISTS public.agora_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  streamer_id UUID NOT NULL,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,

  -- Agora streaming credentials
  agora_channel TEXT NOT NULL UNIQUE,
  stream_key TEXT NOT NULL,
  host_uid INTEGER NOT NULL DEFAULT 0,

  -- Stream status: starting | waiting | signal_detected | ready | live | ended | error
  status TEXT NOT NULL DEFAULT 'starting',

  -- Viewer tracking
  viewer_count INTEGER NOT NULL DEFAULT 0,
  peak_viewers INTEGER NOT NULL DEFAULT 0,

  -- Timestamps
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Agora session metadata (for future co-hosting, PK battles, multi-guest, voice chats, live events)
  session_metadata JSONB DEFAULT '{}'::jsonb,

  -- Recording
  recording_url TEXT,
  is_recording BOOLEAN NOT NULL DEFAULT false
);

-- Table: troll_drop_claims
CREATE TABLE IF NOT EXISTS public.troll_drop_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troll_drop_id uuid NOT NULL REFERENCES public.troll_drops(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  bill_index integer NOT NULL,
  coin_value integer NOT NULL,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(troll_drop_id, bill_index)
);

-- Table: stream_raffle_tickets
CREATE TABLE IF NOT EXISTS public.stream_raffle_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.stream_raffles(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  ticket_number bigint GENERATED ALWAYS AS IDENTITY,
  cost integer DEFAULT 500,
  purchased_at timestamptz DEFAULT now()
);

-- Table: stream_raffle_winners
CREATE TABLE IF NOT EXISTS public.stream_raffle_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id uuid NOT NULL REFERENCES public.stream_raffles(id) ON DELETE CASCADE,
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  round_number integer NOT NULL,
  place integer NOT NULL CHECK (place IN (1, 2, 3)),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  prize_usd numeric(12,2) NOT NULL,
  selected_at timestamptz DEFAULT now(),
  payout_status text DEFAULT 'pending' CHECK (payout_status IN ('pending', 'approved', 'paid', 'void')),
  UNIQUE(raffle_id, round_number, place)
);

-- Table: court_summons_log
CREATE TABLE IF NOT EXISTS public.court_summons_log (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            defendant_id UUID NOT NULL,
            docket_id UUID NOT NULL,
            officer_id UUID NOT NULL,
            users_involved TEXT[],
            created_at TIMESTAMPTZ DEFAULT now()
        );

-- Table: profile_frame_tiers
CREATE TABLE IF NOT EXISTS profile_frame_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  frame_style TEXT NOT NULL DEFAULT 'flat', -- flat, beveled, glowing, animated, premium
  border_color TEXT DEFAULT '#666666',
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL DEFAULT 0,
  animation_type TEXT, -- pulse, rotate, shimmer, fire, electric, cosmic
  animation_speed TEXT DEFAULT 'normal', -- slow, normal, fast
  has_particles BOOLEAN DEFAULT false,
  particle_color TEXT,
  css_class TEXT,
  rarity TEXT DEFAULT 'common',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: diamond_avatar_tiers
CREATE TABLE IF NOT EXISTS diamond_avatar_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL,
  min_level INTEGER NOT NULL,
  max_level INTEGER NOT NULL,
  diamond_style TEXT NOT NULL DEFAULT 'flat', -- flat, beveled, glowing, crystal, artifact
  border_color TEXT DEFAULT '#666666',
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL DEFAULT 0,
  has_sparkle BOOLEAN DEFAULT false,
  sparkle_color TEXT,
  animation TEXT, -- pulse, rotate, shimmer, fire, crystal_glow, artifact_pulse
  animation_speed TEXT DEFAULT 'normal',
  css_class TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: diamond_special_styles
CREATE TABLE IF NOT EXISTS diamond_special_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  css_class TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('top_buyer', 'top_broadcaster', 'mvp', 'custom')),
  border_gradient TEXT,
  glow_color TEXT,
  glow_intensity REAL DEFAULT 1.0,
  animation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: voice_announcement_styles
CREATE TABLE IF NOT EXISTS voice_announcement_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  voice_type TEXT NOT NULL, -- hype, premium, futuristic, branded
  sample_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: audio_queue
CREATE TABLE IF NOT EXISTS audio_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  audio_type TEXT NOT NULL CHECK (audio_type IN ('custom', 'voice_over', 'system')),
  audio_url TEXT,
  voice_text TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played', 'skipped', 'dropped')),
  created_at TIMESTAMPTZ DEFAULT now(),
  played_at TIMESTAMPTZ
);

-- Table: fan_memory
CREATE TABLE IF NOT EXISTS fan_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fan_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_streams_watched INTEGER DEFAULT 0,
  total_coins_gifted INTEGER DEFAULT 0,
  total_messages_sent INTEGER DEFAULT 0,
  first_seen_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  loyalty_score INTEGER DEFAULT 0,
  best_tier TEXT DEFAULT 'viewer',
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(broadcaster_id, fan_id)
);

-- Table: broadcast_command_modules
CREATE TABLE IF NOT EXISTS broadcast_command_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES streams(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL CHECK (module_type IN (
    'identity', 'goals', 'missions', 'top_fans',
    'milestones', 'polls', 'interactions', 'recognition',
    'energy_meter', 'ticker'
  )),
  is_enabled BOOLEAN DEFAULT true,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  width INTEGER DEFAULT 300,
  height INTEGER DEFAULT 200,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: user_badge_progress
CREATE TABLE IF NOT EXISTS user_badge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  current_tier INTEGER DEFAULT 1,
  progress_value INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, badge_slug)
);

-- Table: marketplace_payout_holds
CREATE TABLE IF NOT EXISTS marketplace_payout_holds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid REFERENCES marketplace_purchases(id) ON DELETE CASCADE NOT NULL,
  
  -- Amount being held
  amount bigint NOT NULL,
  
  -- Hold status
  status text DEFAULT 'active' CHECK (status IN ('active', 'released', 'refunded', 'cancelled', 'expired')),
  
  -- Release tracking
  released_at timestamptz,
  release_transaction_id uuid,
  released_by uuid REFERENCES user_profiles(id),
  
  -- Refund tracking
  refunded_at timestamptz,
  refund_transaction_id uuid,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Reason for hold/release
  hold_reason text DEFAULT 'awaiting_delivery',
  release_reason text,
  
  UNIQUE(order_id)
);


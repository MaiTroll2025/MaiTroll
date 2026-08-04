-- Initial Schema Part 02
-- Tables 65 to 128
-- Dependency-ordered: tables are created after their dependencies
-- Note: Foreign key constraints are defined in per-page migrations

-- Table: family_calls
CREATE TABLE IF NOT EXISTS public.family_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'voice' CHECK (type IN ('voice', 'video')),
    created_by UUID NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    max_participants INTEGER DEFAULT 8,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- Table: family_call_members
CREATE TABLE IF NOT EXISTS public.family_call_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    is_speaking BOOLEAN DEFAULT false,
    is_muted BOOLEAN DEFAULT false,
    is_video_on BOOLEAN DEFAULT false,
    
    -- Unique constraint: user can only be in one active call at a time per family
    UNIQUE(call_id, user_id)
);

-- Table: rtc_sessions
CREATE TABLE IF NOT EXISTS rtc_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  room_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stream_missions
CREATE TABLE IF NOT EXISTS stream_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  mission_template_id UUID,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('solo', 'community', 'competitive', 'timed')),
  target_metric TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed', 'expired', 'chained')),
  chain_group TEXT,
  chain_order INTEGER DEFAULT 0,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  xp_reward INTEGER DEFAULT 0,
  coin_reward INTEGER DEFAULT 0,
  icon TEXT DEFAULT '🎯',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: user_entrance_audio
CREATE TABLE IF NOT EXISTS user_entrance_audio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  audio_url TEXT NOT NULL,
  audio_name TEXT DEFAULT 'My Entrance',
  duration_seconds REAL NOT NULL CHECK (duration_seconds >= 1 AND duration_seconds <= 6),
  file_size_bytes INTEGER,
  is_active BOOLEAN DEFAULT false,
  is_approved BOOLEAN DEFAULT true, -- moderation
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: broadcast_audio_settings
CREATE TABLE IF NOT EXISTS broadcast_audio_settings (
  stream_id UUID PRIMARY KEY,
  voice_enabled BOOLEAN DEFAULT true,
  custom_audio_enabled BOOLEAN DEFAULT true,
  min_level_for_voice INTEGER DEFAULT 200,
  min_level_for_custom INTEGER DEFAULT 200,
  cooldown_seconds INTEGER DEFAULT 5,
  max_queue_size INTEGER DEFAULT 10,
  stream_mode TEXT DEFAULT 'standard' CHECK (stream_mode IN ('silent', 'standard', 'premium', 'hype')),
  muted_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: stream_fan_tiers
CREATE TABLE IF NOT EXISTS stream_fan_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  tier TEXT NOT NULL DEFAULT 'viewer' CHECK (tier IN ('viewer', 'supporter', 'fan', 'superfan', 'legend', 'icon')),
  total_coins_gifted INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  watch_minutes INTEGER DEFAULT 0,
  hype_score INTEGER DEFAULT 0,
  role TEXT DEFAULT NULL, -- hype_leader, judge, co_host, etc.
  contract_active BOOLEAN DEFAULT false,
  contract_started_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

-- Table: stream_energy_meter
CREATE TABLE IF NOT EXISTS stream_energy_meter (
  stream_id UUID PRIMARY KEY,
  energy_level INTEGER DEFAULT 0 CHECK (energy_level >= 0 AND energy_level <= 100),
  hype_multiplier REAL DEFAULT 1.0,
  last_boost_at TIMESTAMPTZ,
  total_boosts INTEGER DEFAULT 0,
  peak_energy INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: stream_awards
CREATE TABLE IF NOT EXISTS stream_awards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  award_type TEXT NOT NULL, -- mvp, top_gifter, most_active, hype_king, loyal_viewer, rising_star
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  xp_reward INTEGER DEFAULT 0,
  coin_reward INTEGER DEFAULT 0,
  badge_awarded TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: fan_contracts
CREATE TABLE IF NOT EXISTS fan_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL,
  fan_id UUID NOT NULL,
  stream_id UUID,
  contract_type TEXT NOT NULL DEFAULT 'standard', -- standard, premium, exclusive
  perks JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: stream_goals
CREATE TABLE IF NOT EXISTS stream_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('coins', 'followers', 'shares', 'subscriptions', 'gifts', 'viewers')),
  title TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  current_value INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  completed_at TIMESTAMPTZ,
  reward_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: stream_milestones
CREATE TABLE IF NOT EXISTS stream_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  milestone_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  threshold INTEGER NOT NULL,
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  icon TEXT DEFAULT '🏆',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: stream_polls
CREATE TABLE IF NOT EXISTS stream_polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- [{label: 'A', votes: 0}, {label: 'B', votes: 0}]
  is_active BOOLEAN DEFAULT true,
  total_votes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID
);

-- Table: order_shipments
CREATE TABLE IF NOT EXISTS order_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid NOT NULL,
  
  -- Carrier info
  carrier text NOT NULL CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
  tracking_number text NOT NULL,
  tracking_url text,
  
  -- Internal status tracking
  tracking_status text DEFAULT 'pending' 
    CHECK (tracking_status IN ('pending', 'label_created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned')),
  
  -- Carrier's raw status
  carrier_status text,
  carrier_error text,
  
  -- Timestamps
  shipped_date timestamptz,
  delivered_at timestamptz,
  tracking_last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Optional: reference to external tracking API response
  external_tracking_data jsonb,
  
  UNIQUE(order_id)
);

-- Table: tracking_events
CREATE TABLE IF NOT EXISTS tracking_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid NOT NULL,
  
  -- External event ID from carrier
  external_event_id text,
  
  -- Normalized status
  status text NOT NULL 
    CHECK (status IN ('label_created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned')),
  
  -- Event details
  description text,
  location text,
  city text,
  state text,
  country text,
  zip_code text,
  
  -- Timestamps
  event_time timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  
  -- Raw carrier data for debugging
  raw_data jsonb
);

-- Table: stream_seats
CREATE TABLE IF NOT EXISTS public.stream_seats (
  stream_id TEXT,
  seat_index SMALLINT NOT NULL,
  user_id UUID,
  is_active BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (stream_id, seat_index)
);

-- Table: games
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL DEFAULT 'troll_us',
    status VARCHAR(50) NOT NULL DEFAULT 'lobby', -- lobby, live, ended
    host_id UUID NOT NULL,
    stream_id UUID,
    current_round INTEGER DEFAULT 0,
    prize_pool INTEGER DEFAULT 2000,
    winner_team VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ
);

-- Table: game_players
CREATE TABLE IF NOT EXISTS game_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL,
    user_id UUID NOT NULL,
    seat_index INTEGER,
    role VARCHAR(20), -- troll, hunter (hidden from other players)
    is_eliminated BOOLEAN DEFAULT FALSE,
    is_seated BOOLEAN DEFAULT FALSE,
    is_muted BOOLEAN DEFAULT FALSE,
    is_alive BOOLEAN DEFAULT TRUE,
    has_voted BOOLEAN DEFAULT FALSE,
    votes_received INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(game_id, user_id)
);

-- Table: connected_social_accounts
CREATE TABLE IF NOT EXISTS connected_social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('x', 'instagram')),
  platform_user_id VARCHAR(255) NOT NULL,
  platform_username VARCHAR(255),
  platform_display_name VARCHAR(255),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  account_status VARCHAR(20) DEFAULT 'active' CHECK (account_status IN ('active', 'disconnected', 'expired', 'error')),
  last_synced_at TIMESTAMPTZ,
  permissions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, platform)
);

-- Table: source_content_refs
CREATE TABLE IF NOT EXISTS source_content_refs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50) NOT NULL,
  content_id VARCHAR(255),
  title VARCHAR(500),
  description TEXT,
  url TEXT,
  screenshot_url TEXT,
  thumbnail_url TEXT,
  stats JSONB DEFAULT '{}',
  cta_text VARCHAR(255),
  captured_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

-- Table: ad_generation_jobs
CREATE TABLE IF NOT EXISTS ad_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_content_id UUID,
  job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('image_ad', 'video_promo', 'caption_only', 'full_campaign')),
  job_status VARCHAR(20) DEFAULT 'pending' CHECK (job_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  template_type VARCHAR(50),
  requested_by UUID,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: ad_assets
CREATE TABLE IF NOT EXISTS ad_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  asset_type VARCHAR(30) NOT NULL CHECK (asset_type IN ('square_post', 'portrait_story', 'landscape_promo', 'fallback_graphic')),
  file_path TEXT,
  public_url TEXT,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  format VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: ad_videos
CREATE TABLE IF NOT EXISTS ad_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  template_type VARCHAR(50) CHECK (template_type IN ('feature_promo', 'live_now_promo', 'event_promo', 'government_promo', 'careers_promo', 'wallet_promo', '3_scene', 'slideshow', 'feature_reveal', 'vertical_reel')),
  file_path TEXT,
  public_url TEXT,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  format VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  has_audio BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: caption_variants
CREATE TABLE IF NOT EXISTS caption_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID,
  caption_style VARCHAR(30) NOT NULL CHECK (caption_style IN ('aggressive', 'clean', 'hype', 'founder', 'short_promo')),
  caption_text TEXT NOT NULL,
  hashtags TEXT,
  mentions TEXT,
  cta_text VARCHAR(255),
  cta_url TEXT,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: social_publish_queue
CREATE TABLE IF NOT EXISTS social_publish_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID,
  video_id UUID,
  caption_id UUID,
  platform VARCHAR(20) NOT NULL CHECK (platform IN ('x', 'instagram')),
  account_id UUID,
  publish_status VARCHAR(20) DEFAULT 'draft' CHECK (publish_status IN ('draft', 'scheduled', 'publishing', 'published', 'failed', 'archived')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  platform_post_id TEXT,
  platform_post_url TEXT,
  utm_params JSONB DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: chat_blocks
CREATE TABLE IF NOT EXISTS public.chat_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  user_id uuid NOT NULL,
  blocked_by uuid,
  expires_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Table: stream_kicks
CREATE TABLE IF NOT EXISTS public.stream_kicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kicked_by uuid,
  created_by uuid,
  reason text,
  created_at timestamptz DEFAULT now()
);

-- Table: broadcast_restrictions
CREATE TABLE IF NOT EXISTS broadcast_restrictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    restricted_by UUID,
    reason TEXT,
    duration_minutes INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: court_participants
CREATE TABLE IF NOT EXISTS public.court_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_session_id UUID,
    user_id UUID,
    role TEXT DEFAULT 'observer' CHECK (role IN ('judge', 'prosecutor', 'defendant', 'attorney', 'witness', 'observer', 'bailiff', 'clerk')),
    box_number INTEGER, -- Which box they're in (null = not in a box)
    queue_position INTEGER, -- Position in queue (null = not in queue)
    is_hand_raised BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: outbound_clicks
CREATE TABLE IF NOT EXISTS public.outbound_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    url TEXT NOT NULL,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT
);

-- Table: neighborhoods
CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  zip_code TEXT NOT NULL DEFAULT '00001',
  officer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Table: houses
CREATE TABLE IF NOT EXISTS public.houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID,
  owner_user_id UUID NOT NULL,
  upgrade_level INTEGER DEFAULT 1,
  condition INTEGER DEFAULT 100 CHECK (condition >= 0 AND condition <= 100),
  is_reposessed BOOLEAN DEFAULT FALSE,
  electric_on BOOLEAN DEFAULT FALSE,
  water_on BOOLEAN DEFAULT FALSE,
  internet_on BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: app_bug_reports
CREATE TABLE IF NOT EXISTS public.app_bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  status text DEFAULT 'open',
  severity text DEFAULT 'medium',
  source text NOT NULL,
  page_url text,
  route_path text,
  user_id uuid NULL,
  user_email text NULL,
  user_role text NULL,
  stream_id uuid NULL,
  function_name text NULL,
  table_name text NULL,
  error_code text NULL,
  error_message text NOT NULL,
  error_details text NULL,
  error_hint text NULL,
  stack_trace text NULL,
  request_payload jsonb NULL,
  response_payload jsonb NULL,
  browser_info jsonb NULL,
  app_context jsonb NULL,
  fixed_note text NULL,
  fixed_by uuid NULL,
  fixed_at timestamptz NULL,
  occurrence_count integer DEFAULT 1,
  last_seen_at timestamptz DEFAULT now()
);

-- Table: subscription_tiers
CREATE TABLE IF NOT EXISTS subscription_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL CHECK (LENGTH(name) <= 50),
    price_coins INTEGER NOT NULL CHECK (price_coins >= 0),
    benefits TEXT[] DEFAULT '{}',
    color_hex TEXT DEFAULT '#6B7280',
    icon_name TEXT DEFAULT 'Heart',
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT subscription_tiers_name_unique UNIQUE(name)
);

-- Table: user_subscriptions
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL,
    broadcaster_id UUID NOT NULL,
    tier_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    auto_renew BOOLEAN DEFAULT true,
    total_paid_coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT one_subscription_per_pair UNIQUE(subscriber_id, broadcaster_id),
    CONSTRAINT no_self_subscription CHECK (subscriber_id != broadcaster_id)
);

-- Table: subscription_revenue_log
CREATE TABLE IF NOT EXISTS subscription_revenue_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    amount_coins INTEGER NOT NULL,
    transaction_type TEXT NOT NULL CHECK (
        transaction_type IN ('monthly_fee', 'refund', 'chargeback', 'upgrade')
    ),
    payment_gateway TEXT DEFAULT 'internal',
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: support_goal_reminder_dismissals
CREATE TABLE IF NOT EXISTS public.support_goal_reminder_dismissals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_user_id UUID NOT NULL,
    broadcaster_user_id UUID NOT NULL,
    stream_id UUID NULL,
    cashout_tier INTEGER NOT NULL,
    dismissed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: troll_family_league_seasons
CREATE TABLE IF NOT EXISTS public.troll_family_league_seasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Season identity
    season_number integer NOT NULL,
    season_start_date date NOT NULL,
    season_end_date date NOT NULL,
    
    -- Status
    is_active boolean DEFAULT true,
    is_completed boolean DEFAULT false,
    
    -- Season metadata
    name text,
    description text,
    theme text,  -- e.g., 'spring', 'summer', 'autumn', 'winter'
    
    -- Timestamps
    created_at timestamp with time zone DEFAULT NOW(),
    ended_at timestamp with time zone,
    
    UNIQUE(season_number),
    UNIQUE(season_start_date, season_end_date)
);

-- Table: troll_family_league_standings
CREATE TABLE IF NOT EXISTS public.troll_family_league_standings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id uuid NOT NULL,
    family_id uuid NOT NULL,
    
    -- Rankings and points
    rank integer,
    points integer DEFAULT 0,
    wins integer DEFAULT 0,
    losses integer DEFAULT 0,
    goals_completed integer DEFAULT 0,
    goals_failed integer DEFAULT 0,
    
    -- Activity tracking
    members_active integer DEFAULT 0,
    total_member_activity numeric DEFAULT 0,
    participation_rate numeric DEFAULT 0,  -- 0.0 to 1.0
    
    -- Rewards earned
    coins_earned integer DEFAULT 0,
    xp_earned integer DEFAULT 0,
    bonus_coins integer DEFAULT 0,
    
    -- Metadata
    metadata jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),
    
    UNIQUE(season_id, family_id)
);

-- Table: security_events
CREATE TABLE IF NOT EXISTS public.security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored', 'false_positive')),
    user_id uuid NULL,
    actor_id uuid NULL,
    target_user_id uuid NULL,
    stream_id uuid NULL,
    agency_id uuid NULL,
    cashout_id uuid NULL,
    ip_address text NULL,
    user_agent text NULL,
    device_fingerprint text NULL,
    route text NULL,
    source text NOT NULL DEFAULT 'frontend',
    title text NOT NULL,
    description text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    risk_score integer NOT NULL DEFAULT 0,
    reviewed_by uuid NULL,
    reviewed_at timestamptz NULL,
    resolved_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: security_user_risk_scores
CREATE TABLE IF NOT EXISTS public.security_user_risk_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    risk_score integer NOT NULL DEFAULT 0,
    risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    failed_login_count integer NOT NULL DEFAULT 0,
    suspicious_action_count integer NOT NULL DEFAULT 0,
    last_event_at timestamptz NULL,
    last_ip_address text NULL,
    notes text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: security_rate_limits
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket text NOT NULL,
    identifier text NOT NULL,
    user_id uuid NULL,
    ip_address text NULL,
    action text NOT NULL,
    hit_count integer NOT NULL DEFAULT 1,
    window_start timestamptz NOT NULL DEFAULT now(),
    window_end timestamptz NOT NULL,
    blocked_until timestamptz NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: security_incident_reports
CREATE TABLE IF NOT EXISTS public.security_incident_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
    created_by uuid NULL,
    assigned_to uuid NULL,
    summary text NULL,
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
    actions_taken jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: church_live_sessions
CREATE TABLE IF NOT EXISTS public.church_live_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pastor_id UUID NOT NULL,
    room_name TEXT NOT NULL,
    livekit_room_id TEXT,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
    sermon_title TEXT,
    scripture_reference TEXT,
    is_private BOOLEAN DEFAULT false,
    viewer_count INTEGER DEFAULT 0,
    attendee_count INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: church_prayers
CREATE TABLE IF NOT EXISTS public.church_prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    likes_count INTEGER DEFAULT 0
);

-- Table: church_prayer_replies
CREATE TABLE IF NOT EXISTS public.church_prayer_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: business_profiles
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL,
    business_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    address TEXT,
    logo_url TEXT,
    banner_url TEXT,
    verified BOOLEAN DEFAULT false,
    rating NUMERIC DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'paused', 'suspended')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: admin_reports
CREATE TABLE IF NOT EXISTS public.admin_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    details JSONB,
    category VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    submitted_by UUID,
    assigned_to UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Table: agency_admin_reports
CREATE TABLE IF NOT EXISTS public.agency_admin_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    details JSONB,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    submitted_by UUID,
    assigned_to UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Table: ghost_stream_sessions
CREATE TABLE IF NOT EXISTS ghost_stream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  microphone_enabled BOOLEAN NOT NULL DEFAULT true,
  camera_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Table: admin_pool_transactions
CREATE TABLE IF NOT EXISTS public.admin_pool_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID,
  user_id UUID,
  cashout_amount NUMERIC(12,2) NOT NULL,
  admin_fee NUMERIC(12,2) NOT NULL,
  admin_profit NUMERIC(12,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('cashout', 'other_fee')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  source_details JSONB DEFAULT '{}'
);

-- Table: admin_pool
CREATE TABLE IF NOT EXISTS public.admin_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  trollcoins_balance NUMERIC(18,2) DEFAULT 0, -- Existing fee accumulator
  total_liability_coins BIGINT DEFAULT 0,     -- Unpaid user earnings
  total_liability_usd NUMERIC(18,2) DEFAULT 0, -- USD value of unpaid earnings
  total_paid_usd NUMERIC(18,2) DEFAULT 0,      -- Total cash successfully paid out
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: telemetry_events
CREATE TABLE IF NOT EXISTS public.telemetry_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    env TEXT,
    app_version TEXT,
    event_type TEXT NOT NULL,
    message TEXT,
    stack TEXT,
    fingerprint TEXT,
    url TEXT,
    user_id_hash TEXT,
    session_id TEXT,
    device TEXT,
    browser TEXT,
    os TEXT,
    severity TEXT,
    tags JSONB DEFAULT '{}'::jsonb,
    breadcrumbs JSONB DEFAULT '[]'::jsonb,
    request_info JSONB DEFAULT '{}'::jsonb,
    extra JSONB DEFAULT '{}'::jsonb
);

-- Table: agency_applications
CREATE TABLE IF NOT EXISTS public.agency_applications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    display_name TEXT NOT NULL,
    primary_platform TEXT NOT NULL DEFAULT 'twitch',
    channel_url TEXT,
    avg_weekly_hours NUMERIC(6,2) DEFAULT 0,
    avg_weekly_viewers INTEGER DEFAULT 0,
    content_category TEXT[] DEFAULT '{}',
    motivation TEXT,
    experience TEXT,
    referral_code TEXT,
    status public.agency_application_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: agency_members
CREATE TABLE IF NOT EXISTS public.agency_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    application_id UUID,
    role public.agency_member_role NOT NULL DEFAULT 'creator',
    current_tier public.agency_tier NOT NULL DEFAULT 'none',
    total_points INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    notified_tier_change BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: agency_point_transactions
CREATE TABLE IF NOT EXISTS public.agency_point_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    transaction_type public.agency_transaction_type NOT NULL,
    points INTEGER NOT NULL,
    description TEXT,
    source_id TEXT,
    source_table TEXT,
    verified BOOLEAN NOT NULL DEFAULT false,
    verification_data JSONB DEFAULT '{}'::jsonb,
    week_start DATE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: agency_weekly_stats
CREATE TABLE IF NOT EXISTS public.agency_weekly_stats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    stream_hours_points INTEGER NOT NULL DEFAULT 0,
    platform_share_points INTEGER NOT NULL DEFAULT 0,
    viewer_points INTEGER NOT NULL DEFAULT 0,
    registration_points INTEGER NOT NULL DEFAULT 0,
    tier_bonus_points INTEGER NOT NULL DEFAULT 0,
    admin_adjustment_points INTEGER NOT NULL DEFAULT 0,
    total_points INTEGER NOT NULL DEFAULT 0,
    hours_streamed NUMERIC(6,2) DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    verified_viewers INTEGER DEFAULT 0,
    verified_registrations INTEGER DEFAULT 0,
    tier_at_end public.agency_tier NOT NULL DEFAULT 'none',
    calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, week_start)
);

-- Table: agency_rewards
CREATE TABLE IF NOT EXISTS public.agency_rewards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    reward_type public.agency_reward_type NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    points_cost INTEGER DEFAULT 0,
    tier_requirement public.agency_tier DEFAULT 'none',
    coin_value INTEGER DEFAULT 0,
    status public.agency_reward_status NOT NULL DEFAULT 'pending',
    available_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID,
    revoke_reason TEXT,
    fulfillment_data JSONB DEFAULT '{}'::jsonb,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: agency_audit_log
CREATE TABLE IF NOT EXISTS public.agency_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id UUID,
    target_user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    previous_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: agency_settings
CREATE TABLE IF NOT EXISTS public.agency_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    description TEXT,
    updated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: page_visibility
CREATE TABLE IF NOT EXISTS public.page_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  is_under_construction BOOLEAN NOT NULL DEFAULT false,
  uc_message TEXT DEFAULT 'This page is currently under construction.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: document_types
CREATE TABLE IF NOT EXISTS public.document_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_content TEXT,
  required_roles TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: documents
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type_id UUID,
  document_type_slug TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  submitted_by UUID,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  assigned_to UUID,
  assigned_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  parent_document_id UUID,
  is_template BOOLEAN DEFAULT false,
  template_id UUID,
  version INTEGER DEFAULT 1,
  storage_path TEXT,
  pdf_path TEXT,
  checksum TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: document_signatures
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  typed_signature TEXT NOT NULL,
  ip_address INET,
  browser_user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  agreement_version INTEGER NOT NULL DEFAULT 1,
  signature_hash TEXT NOT NULL,
  document_type TEXT NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: document_approvals
CREATE TABLE IF NOT EXISTS public.document_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  approver_id UUID NOT NULL,
  approver_username TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('initial', 'secondary', 'final', 'override')),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'returned')),
  comments TEXT,
  required_role TEXT,
  approval_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

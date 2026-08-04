-- Initial Schema Part 04
-- Tables 193 to 256
-- Dependency-ordered: tables are created after their dependencies
-- Note: Foreign key constraints are defined in per-page migrations

-- Table: universe_rounds
CREATE TABLE IF NOT EXISTS public.universe_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  round_number INTEGER NOT NULL,
  match_id UUID,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','finalizing','completed','cancelled')),
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  server_end_at TIMESTAMPTZ,
  winner_side TEXT CHECK (winner_side IN ('A','B')),
  winning_captain_id UUID,
  losing_captain_id UUID,
  actual_duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_round_event_number UNIQUE (event_id, round_number)
);

-- Table: universe_round_teams
CREATE TABLE IF NOT EXISTS public.universe_round_teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL,
  event_id UUID NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('A','B')),
  captain_user_id UUID NOT NULL,
  seat_one_user_id UUID,
  seat_two_user_id UUID,
  seat_three_user_id UUID,
  team_status TEXT NOT NULL DEFAULT 'active'
    CHECK (team_status IN ('active','disconnected','eliminated','forfeited','no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_round_team_side UNIQUE (round_id, side)
);

-- Table: universe_round_scores
CREATE TABLE IF NOT EXISTS public.universe_round_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL,
  team_id UUID NOT NULL,
  captain_user_id UUID NOT NULL,
  actual_score BIGINT NOT NULL DEFAULT 0,
  displayed_score BIGINT NOT NULL DEFAULT 0,
  captain_score_contribution BIGINT NOT NULL DEFAULT 0,
  seat_one_score_contribution BIGINT NOT NULL DEFAULT 0,
  seat_two_score_contribution BIGINT NOT NULL DEFAULT 0,
  seat_three_score_contribution BIGINT NOT NULL DEFAULT 0,
  unique_gifters INTEGER NOT NULL DEFAULT 0,
  highest_single_gift BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_round_score_team UNIQUE (round_id, team_id),
  CONSTRAINT chk_universe_round_score_nonneg CHECK (actual_score >= 0 AND displayed_score >= 0)
);

-- Table: universe_abilities
CREATE TABLE IF NOT EXISTS public.universe_abilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  match_id UUID,
  round_id UUID,
  awarded_to_user_id UUID NOT NULL,
  awarded_to_team_id UUID,
  ability_type TEXT NOT NULL
    CHECK (ability_type IN ('triple_gifts','timer_troll','hidden_challenger_score','turtle_mode','troll_mode','officer_fee','scramble_score')),
  target_team_id UUID,
  status TEXT NOT NULL DEFAULT 'awarded'
    CHECK (status IN ('awarded','available','activating','active','revealing','expired','consumed','cancelled','invalidated')),
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  activated_at TIMESTAMPTZ,
  reveal_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  effect_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: universe_event_results
CREATE TABLE IF NOT EXISTS public.universe_event_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  champion_user_id UUID NOT NULL,
  champion_seat_one UUID,
  champion_seat_two UUID,
  champion_seat_three UUID,
  total_rounds_won INTEGER NOT NULL DEFAULT 0,
  total_actual_score BIGINT NOT NULL DEFAULT 0,
  team_gift_total BIGINT NOT NULL DEFAULT 0,
  captain_contribution BIGINT NOT NULL DEFAULT 0,
  seat_one_contribution BIGINT NOT NULL DEFAULT 0,
  seat_two_contribution BIGINT NOT NULL DEFAULT 0,
  seat_three_contribution BIGINT NOT NULL DEFAULT 0,
  unique_supporters INTEGER NOT NULL DEFAULT 0,
  highest_single_gift BIGINT NOT NULL DEFAULT 0,
  longest_winning_streak INTEGER NOT NULL DEFAULT 0,
  final_battle_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: universe_showdown_battles
CREATE TABLE IF NOT EXISTS public.universe_showdown_battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  capacity INTEGER NOT NULL DEFAULT 30,
  registered_count INTEGER NOT NULL DEFAULT 0,
  guest_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','full','sealed','active','completed','cancelled')),
  is_overflow BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_date UNIQUE (event_date),
  CONSTRAINT chk_universe_showdown_mountain_time CHECK (timezone = 'America/Denver'),
  CONSTRAINT chk_universe_showdown_capacity CHECK (capacity > 0 AND capacity <= 30)
);

-- Table: universe_showdown_signups
CREATE TABLE IF NOT EXISTS public.universe_showdown_signups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL,
  user_id UUID NOT NULL,
  battle_name TEXT NOT NULL,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID,
  seat_index INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','withdrawn','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_signup_battle_user UNIQUE (battle_id, user_id),
  CONSTRAINT chk_universe_showdown_seat CHECK (seat_index >= 0 AND seat_index <= 30)
);

-- Table: universe_showdown_invites
CREATE TABLE IF NOT EXISTS public.universe_showdown_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  battle_id UUID NOT NULL,
  inviter_user_id UUID NOT NULL,
  invited_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined','removed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_invite UNIQUE (battle_id, inviter_user_id, invited_user_id)
);

-- Table: universe_showdown_dates
CREATE TABLE IF NOT EXISTS public.universe_showdown_dates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  is_overflow BOOLEAN NOT NULL DEFAULT false,
  capacity INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_showdown_date_cfg UNIQUE (event_date),
  CONSTRAINT chk_universe_showdown_cfg_mountain CHECK (timezone = 'America/Denver')
);

-- Table: stream_capacity_queue
CREATE TABLE IF NOT EXISTS stream_capacity_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL,
    user_id UUID,
    guest_id TEXT, -- For guest users (TC-* format)
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'cancelled', 'expired')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one active queue entry per user per stream
    UNIQUE(stream_id, user_id, status) DEFERRABLE INITIALLY DEFERRED,
    UNIQUE(stream_id, guest_id, status) DEFERRABLE INITIALLY DEFERRED,

    -- At least one of user_id or guest_id must be provided
    CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

-- Table: saved_cards
create table if not exists public.saved_cards (
  id uuid primary key default gen_random_uuid(),

  -- User relationship
  user_id uuid not null,

  -- Square integration (required for charging)
  square_customer_id text not null,  -- Square customer ID
  square_card_id text not null,      -- Square card-on-file ID (starts with 'ccof:')

  -- Card metadata (for display/UI)
  brand text not null,               -- 'Visa', 'Mastercard', 'American Express', etc.
  last_4 text not null,              -- Last 4 digits for display
  exp_month integer not null,        -- Expiration month (1-12)
  exp_year integer not null,         -- Expiration year (4 digits)

  -- Status and preferences
  status text not null default 'active',  -- 'active', 'expired', 'disabled'
  is_default boolean not null default false,

  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: admin_app_settings
CREATE TABLE IF NOT EXISTS public.admin_app_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID
);

-- Table: broadcast_officers
CREATE TABLE IF NOT EXISTS broadcast_officers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL,
  officer_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(broadcaster_id, officer_id)
);

-- Table: pitch_contests
CREATE TABLE IF NOT EXISTS public.pitch_contests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    description TEXT,
    status TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: creator_migration_claims
CREATE TABLE IF NOT EXISTS public.creator_migration_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    platform_name TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    platform_profile_url TEXT,
    proof_screenshot_url TEXT,
    verification_status TEXT DEFAULT 'pending', -- pending, approved, rejected
    rejection_reason TEXT,
    reviewed_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: user_credit
CREATE TABLE IF NOT EXISTS public.user_credit (
  user_id UUID PRIMARY KEY,
  score INTEGER NOT NULL DEFAULT 400 CHECK (score >= 0 AND score <= 800),
  tier TEXT NOT NULL DEFAULT 'Building',
  trend_7d SMALLINT NOT NULL DEFAULT 0, -- -1, 0, +1
  loan_reliability NUMERIC(5,2) NOT NULL DEFAULT 0, -- explanatory submetric (0-100)
  components JSONB, -- optional debug/admin detail
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_event_at TIMESTAMPTZ
);

-- Table: credit_events
CREATE TABLE IF NOT EXISTS public.credit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  event_key TEXT, -- idempotency key
  source_table TEXT, -- e.g., loan_payments, moderation_actions
  source_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: badge_catalog
create table if not exists badge_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null,
  category text not null,
  icon_url text null,
  rarity text not null default 'common',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Table: user_badges
create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  badge_id uuid not null,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique(user_id, badge_id)
);

-- Table: daily_login_posts
CREATE TABLE IF NOT EXISTS public.daily_login_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  coins_earned INTEGER NOT NULL DEFAULT 0 CHECK (coins_earned >= 0 AND coins_earned <= 100),
  posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: admin_settings
CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT NOT NULL UNIQUE,
    setting_value JSONB DEFAULT '{}',
    description TEXT,
    updated_by UUID,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: pool_donations
CREATE TABLE IF NOT EXISTS public.pool_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: coin_audit_log
CREATE TABLE IF NOT EXISTS public.coin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    action text NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Table: sidebar_updates
CREATE TABLE IF NOT EXISTS public.sidebar_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    path TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN DEFAULT TRUE
);

-- Table: user_sidebar_views
CREATE TABLE IF NOT EXISTS public.user_sidebar_views (
    user_id UUID,
    path TEXT NOT NULL,
    last_viewed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, path)
);

-- Table: service_listings
CREATE TABLE IF NOT EXISTS public.service_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price_type TEXT CHECK (price_type IN ('fixed', 'hourly', 'quote', 'free')) DEFAULT 'quote',
    price_coins INTEGER,
    price_usd NUMERIC,
    category TEXT,
    subcategory TEXT,
    is_remote BOOLEAN DEFAULT false,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    duration_minutes INTEGER,
    images JSONB DEFAULT '[]',
    status TEXT CHECK (status IN ('active', 'paused', 'flagged')) DEFAULT 'active',
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: paypal_transactions
CREATE TABLE IF NOT EXISTS public.paypal_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    paypal_order_id TEXT NOT NULL UNIQUE,
    paypal_capture_id TEXT,
    amount NUMERIC,
    currency TEXT,
    coins BIGINT,
    status TEXT NOT NULL, -- 'completed', 'credited'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: marketplace_reviews
CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    buyer_id UUID NOT NULL,
    listing_id UUID,
    listing_type TEXT CHECK (listing_type IN ('marketplace', 'vehicle', 'service')) DEFAULT 'marketplace',
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images JSONB DEFAULT '[]',
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    item_as_described BOOLEAN DEFAULT true,
    would_recommend BOOLEAN DEFAULT true,
    is_verified_purchase BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_order_seller_review UNIQUE (order_id, seller_id)
);

-- Table: pitches
CREATE TABLE IF NOT EXISTS public.pitches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contest_id UUID NOT NULL,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: revenue_splits
CREATE TABLE IF NOT EXISTS public.revenue_splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pitch_id UUID NOT NULL,
    recipient_id UUID NOT NULL,
    percentage NUMERIC NOT NULL CHECK (percentage > 0 AND percentage <= 100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: church_passages
CREATE TABLE IF NOT EXISTS public.church_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: church_prayer_likes
CREATE TABLE IF NOT EXISTS public.church_prayer_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(prayer_id, user_id)
);

-- Table: church_sermon_notes
CREATE TABLE IF NOT EXISTS public.church_sermon_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pastor_id UUID NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(pastor_id, date)
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action text NOT NULL,
    user_id uuid,
    target_id uuid,
    details jsonb,
    created_at timestamptz DEFAULT now(),
    ip_address text
);

-- Table: officer_shift_slots
CREATE TABLE IF NOT EXISTS public.officer_shift_slots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    officer_id uuid,
    shift_date date NOT NULL,
    shift_start_time time NOT NULL,
    shift_end_time time NOT NULL,
    status text CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')) DEFAULT 'scheduled',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table: officer_chat_messages
CREATE TABLE IF NOT EXISTS officer_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'chat', -- chat, alert, command
  priority TEXT DEFAULT 'normal', -- normal, high, urgent
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stream_reports
CREATE TABLE IF NOT EXISTS stream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL, -- Can reference streams(id) but sometimes we might keep reports for deleted streams
  reporter_id UUID,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, resolved, dismissed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);

-- Table: admin_for_week_queue
CREATE TABLE IF NOT EXISTS public.admin_for_week_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'pending', -- pending, active, completed
    amount_paid INTEGER DEFAULT 100000
);

-- Table: properties
CREATE TABLE IF NOT EXISTS public.properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID, -- Null means System/Bank owned
    type_id TEXT DEFAULT 'apartment',
    name TEXT NOT NULL,
    address TEXT,
    rent_amount INTEGER NOT NULL,
    utility_cost INTEGER NOT NULL,
    is_for_rent BOOLEAN DEFAULT true,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: leases
CREATE TABLE IF NOT EXISTS public.leases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID,
    tenant_id UUID,
    start_date TIMESTAMPTZ DEFAULT NOW(),
    end_date TIMESTAMPTZ,
    rent_due_day INTEGER DEFAULT 1,
    last_rent_paid_at TIMESTAMPTZ,
    last_utility_paid_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'evicted')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(property_id, tenant_id, status)
);

-- Table: rent_payment_log
CREATE TABLE IF NOT EXISTS public.rent_payment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lease_id UUID,
    tenant_id UUID,
    amount_paid INTEGER NOT NULL,
    rent_portion INTEGER NOT NULL,
    utility_portion INTEGER NOT NULL,
    tax_portion INTEGER NOT NULL, -- 10% of rent
    landlord_portion INTEGER NOT NULL, -- 90% of rent
    paid_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: apartment_applications
CREATE TABLE IF NOT EXISTS public.apartment_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID,
    applicant_id UUID,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: bank_loans
CREATE TABLE IF NOT EXISTS public.bank_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    loan_type TEXT NOT NULL CHECK (loan_type IN ('rent_loan', 'deposit_loan')),
    amount INTEGER NOT NULL,
    remaining_balance INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_purchases
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_type VARCHAR(50) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  item_name VARCHAR(255),
  purchase_price INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT false,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_active_items
CREATE TABLE IF NOT EXISTS user_active_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_category VARCHAR(50) NOT NULL,
  item_id VARCHAR(255) NOT NULL,
  activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_category)
);

-- Table: user_avatar_customization
CREATE TABLE IF NOT EXISTS user_avatar_customization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  head_item_id VARCHAR(50),
  face_item_id VARCHAR(50),
  body_item_id VARCHAR(50),
  legs_item_id VARCHAR(50),
  feet_item_id VARCHAR(50),
  accessories_ids TEXT[],
  skin_tone VARCHAR(50),
  hair_color VARCHAR(50),
  beard_style VARCHAR(50),
  avatar_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id)
);

-- Table: troll_mart_clothing
CREATE TABLE IF NOT EXISTS troll_mart_clothing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  item_code VARCHAR(50) UNIQUE NOT NULL,
  price_coins INTEGER NOT NULL,
  image_url TEXT,
  model_url TEXT,
  description TEXT,
  rarity VARCHAR(50) DEFAULT 'common',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: user_troll_mart_purchases
CREATE TABLE IF NOT EXISTS user_troll_mart_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  clothing_id UUID NOT NULL,
  purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, clothing_id)
);

-- Table: troll_wars_tasks
CREATE TABLE IF NOT EXISTS public.troll_wars_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    tier TEXT DEFAULT 'easy',
    category TEXT DEFAULT 'general',
    progress_type TEXT DEFAULT 'count',
    target_value INTEGER DEFAULT 1,
    is_repeatable BOOLEAN DEFAULT false,
    reset_cycle TEXT DEFAULT 'weekly',
    is_active BOOLEAN DEFAULT true,
    reward_schema JSONB DEFAULT '{}',
    completion_conditions JSONB DEFAULT '{}',
    dependencies TEXT[] DEFAULT '{}',
    failure_conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: troll_posts
CREATE TABLE IF NOT EXISTS public.troll_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    content TEXT,
    post_type TEXT DEFAULT 'text',
    image_url TEXT,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: troll_post_reactions
CREATE TABLE IF NOT EXISTS public.troll_post_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID,
    user_id UUID,
    reaction_type TEXT DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id, reaction_type)
);

-- Table: president_elections
create table if not exists president_elections (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('draft', 'open', 'closed', 'finalized', 'void')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  winner_candidate_id uuid,
  metadata jsonb default '{}'::jsonb
);

-- Table: president_votes
create table if not exists president_votes (
  id uuid primary key default gen_random_uuid(),
  election_id uuid,
  candidate_id uuid,
  voter_id uuid,
  created_at timestamptz default now()
);

-- Table: president_appointments
create table if not exists president_appointments (
  id uuid primary key default gen_random_uuid(),
  president_user_id uuid not null,
  vice_president_user_id uuid not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'removed', 'expired')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  removed_by uuid,
  metadata jsonb default '{}'::jsonb
);

-- Table: user_vehicle_upgrades
CREATE TABLE IF NOT EXISTS public.user_vehicle_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID,
    upgrade_id UUID,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_vehicle_id, upgrade_id)
);

-- Table: stream_seat_sessions
CREATE TABLE IF NOT EXISTS public.stream_seat_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL,
    user_id UUID NOT NULL,
    seat_index INTEGER NOT NULL,
    price_paid INTEGER DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT now(),
    left_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('active', 'left', 'kicked', 'disconnected')),
    kick_reason TEXT
);

-- Table: stream_viewers
CREATE TABLE IF NOT EXISTS public.stream_viewers (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    stream_id UUID,
    user_id UUID,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (stream_id, user_id)
);

-- Table: court_sessions
CREATE TABLE IF NOT EXISTS public.court_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL,
    status TEXT DEFAULT 'waiting',
    started_by UUID,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: court_session_state
CREATE TABLE IF NOT EXISTS public.court_session_state (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    case_id UUID NOT NULL UNIQUE,
    phase TEXT DEFAULT 'waiting',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: court_cases
CREATE TABLE IF NOT EXISTS public.court_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaintiff_id UUID, -- Landlord or System
    defendant_id UUID, -- Tenant
    lease_id UUID,
    case_type TEXT NOT NULL CHECK (case_type IN ('non_payment', 'eviction', 'lease_violation')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'ruled', 'dismissed')),
    details TEXT,
    ruling TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: court_summons
CREATE TABLE IF NOT EXISTS public.court_summons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID,
    served_to UUID,
    served_at TIMESTAMPTZ DEFAULT NOW(),
    served_by UUID,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'served', 'accepted', 'rejected', 'expired')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_follows
CREATE TABLE IF NOT EXISTS public.user_follows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    follower_id UUID NOT NULL,
    following_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Table: user_abilities
CREATE TABLE IF NOT EXISTS public.user_abilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  ability_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  cooldown_until TIMESTAMPTZ,
  won_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, ability_id)
);

-- Table: broadcast_active_effects
CREATE TABLE IF NOT EXISTS public.broadcast_active_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  ability_id TEXT NOT NULL,
  activator_id UUID NOT NULL,
  activator_username TEXT NOT NULL,
  target_user_id UUID,
  target_username TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: broadcast_ability_logs
CREATE TABLE IF NOT EXISTS public.broadcast_ability_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id TEXT NOT NULL,
  ability_id TEXT NOT NULL,
  activator_id UUID NOT NULL,
  activator_username TEXT NOT NULL,
  target_user_id UUID,
  target_username TEXT,
  amount INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

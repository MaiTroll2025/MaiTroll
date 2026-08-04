-- Initial Schema Part 05
-- Tables 257 to 320
-- Dependency-ordered: tables are created after their dependencies
-- Note: Foreign key constraints are defined in per-page migrations

-- Table: daily_free_spins
CREATE TABLE IF NOT EXISTS public.daily_free_spins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  spins_date DATE NOT NULL DEFAULT CURRENT_DATE,
  spins_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, spins_date)
);

-- Table: trollmers_tournament_participants
CREATE TABLE IF NOT EXISTS public.trollmers_tournament_participants (
    tournament_id UUID NOT NULL,
    user_id UUID NOT NULL,
    seed INTEGER,
    status TEXT NOT NULL DEFAULT 'qualified' CHECK (status IN ('qualified', 'active', 'eliminated', 'winner')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tournament_id, user_id)
);

-- Table: trollmers_tournament_battles
CREATE TABLE IF NOT EXISTS public.trollmers_tournament_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL,
    battle_id UUID,
    round INTEGER NOT NULL CHECK (round > 0),
    bracket_position INTEGER NOT NULL,
    participant1_id UUID,
    participant2_id UUID,
    winner_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: trollmers_weekly_leaderboard
CREATE TABLE IF NOT EXISTS public.trollmers_weekly_leaderboard (
    week_start DATE NOT NULL,
    user_id UUID NOT NULL,
    battles_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    coins_earned BIGINT NOT NULL DEFAULT 0,
    score BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (week_start, user_id)
);

-- Table: trollmers_weekly_payouts
CREATE TABLE IF NOT EXISTS public.trollmers_weekly_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL,
    user_id UUID NOT NULL,
    rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
    payout_coins BIGINT NOT NULL CHECK (payout_coins >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (week_start, rank)
);

-- Table: officer_performance
CREATE TABLE IF NOT EXISTS public.officer_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id uuid,
    zip_code_id uuid,
    warnings_issued integer DEFAULT 0,
    temp_bans integer DEFAULT 0,
    perm_bans integer DEFAULT 0,
    resolved_cases integer DEFAULT 0,
    escalations_to_lead integer DEFAULT 0,
    false_reports integer DEFAULT 0,
    abuse_flags integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table: officer_corruption_flags
CREATE TABLE IF NOT EXISTS public.officer_corruption_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id uuid,
    reason text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    resolved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- Table: officer_payroll_logs
CREATE TABLE IF NOT EXISTS public.officer_payroll_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id uuid NOT NULL,
    role text NOT NULL,
    pay_period_start date NOT NULL,
    pay_period_end date NOT NULL,
    base_pay bigint NOT NULL DEFAULT 0,
    bonus_pay bigint NOT NULL DEFAULT 0,
    total_paid bigint NOT NULL DEFAULT 0,
    status text NOT NULL CHECK (status IN ('paid', 'prorated', 'skipped', 'frozen')),
    reason text,
    pool_balance_before bigint,
    pool_balance_after bigint,
    created_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Table: stock_transactions
CREATE TABLE IF NOT EXISTS stock_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID,
            stock_id UUID,
            transaction_type VARCHAR(10) CHECK (transaction_type IN ('buy', 'sell')),
            shares DECIMAL(20,8),
            price_per_share DECIMAL(15,2),
            total_amount DECIMAL(20,2),
            coins_before DECIMAL(20,2),
            coins_after DECIMAL(20,2),
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

-- Table: user_advertisements
CREATE TABLE IF NOT EXISTS public.user_advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    subtitle TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, expired
    cost_paid BIGINT NOT NULL DEFAULT 1000,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    denied_at TIMESTAMP WITH TIME ZONE,
    denied_reason TEXT,
    approved_by UUID,
    clicks_count INTEGER DEFAULT 0,
    impressions_count INTEGER DEFAULT 0,
    placement TEXT NOT NULL DEFAULT 'any' -- any, sidebar, banner
);

-- Table: stream_settings
CREATE TABLE IF NOT EXISTS public.stream_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL,
  paid_chat_enabled BOOLEAN DEFAULT false,
  paid_chat_type TEXT DEFAULT 'per_user',
  paid_chat_price INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(stream_id)
);

-- Table: tcps_messages
CREATE TABLE IF NOT EXISTS public.tcps_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sender_profile JSONB,
  read_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE
);

-- Table: small_installment_purchases
CREATE TABLE IF NOT EXISTS public.small_installment_purchases (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL,
    -- Purchase details
    original_price      BIGINT NOT NULL,          -- ⚠  must be < 100 troll coins
    purchase_context    TEXT NOT NULL,             -- 'shop_purchase' | 'insurance_purchase' | …
    item_type           TEXT,                      -- coinTransactions type
    item_id             TEXT,
    item_name           TEXT,
    -- Payment progress
    total_paid          BIGINT NOT NULL DEFAULT 0,
    remaining_balance   BIGINT GENERATED ALWAYS AS (GREATEST(0, original_price - total_paid)) STORED,
    milestone_level     SMALLINT NOT NULL DEFAULT 0,   -- 0=0%,1=25%,2=50%,3=75%,4=100%
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    fully_paid_at       TIMESTAMPTZ,
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at          TIMESTAMPTZ               -- 30-day inactivity grace period
);

-- Table: stream_audience_presence
CREATE TABLE IF NOT EXISTS public.stream_audience_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stream_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  gift_total INTEGER NOT NULL DEFAULT 0,
  seat_id INTEGER, -- (integer)
  role TEXT NOT NULL DEFAULT 'audience' CHECK (role IN ('audience', 'seat', 'broadcaster')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_id, user_id)
);

-- Table: admin_actions_log
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_user_id UUID NOT NULL,
    target_user_id UUID,
    action_type TEXT NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: city_events
CREATE TABLE IF NOT EXISTS public.city_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'double_xp', 'themed_night', etc.
    label TEXT NOT NULL,
    active_until TIMESTAMPTZ NOT NULL,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Table: user_presence
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id UUID PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_online BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: bug_alerts
CREATE TABLE IF NOT EXISTS bug_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Core fields
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity bug_alert_severity DEFAULT 'medium',
  category bug_alert_category DEFAULT 'other',
  status bug_alert_status DEFAULT 'active',
  
  -- Reporter info
  reported_by UUID,
  reported_by_username TEXT,
  
  -- Affected entities
  affected_users TEXT[] DEFAULT '{}',
  affected_components TEXT[] DEFAULT '{}',
  
  -- Error details
  error_message TEXT,
  stack_trace TEXT,
  user_agent TEXT,
  page_url TEXT,
  
  -- Additional metadata (JSON for flexibility)
  metadata JSONB DEFAULT '{}',
  
  -- Resolution tracking
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID,
  resolved_at TIMESTAMPTZ,
  admin_notes TEXT
);

-- Table: neighbors_events
CREATE TABLE IF NOT EXISTS neighbors_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_participants INTEGER,
  reward_coins INTEGER DEFAULT 0,
  created_by_user_id UUID NOT NULL,
  business_id UUID,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: neighbors_participants
CREATE TABLE IF NOT EXISTS neighbors_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'joined',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,
  UNIQUE(event_id, user_id)
);

-- Table: neighbors_businesses
CREATE TABLE IF NOT EXISTS neighbors_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL,
  business_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  logo_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: wheel_inventory
CREATE TABLE IF NOT EXISTS public.wheel_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL, -- 'free_perk', 'free_insurance', 'free_entrance', 'ghost_mode', 'featured_broadcaster'
  item_name TEXT NOT NULL,
  item_description TEXT,
  is_active BOOLEAN DEFAULT false,
  won_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ
);

-- Table: government_laws
CREATE TABLE IF NOT EXISTS public.government_laws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'general',
    effect_type TEXT NOT NULL DEFAULT 'none',
    effect_value JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'voting', 'active', 'expired', 'rejected')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    voting_starts_at TIMESTAMPTZ,
    voting_ends_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    required_votes INTEGER DEFAULT 10,
    yes_votes INTEGER DEFAULT 0,
    no_votes INTEGER DEFAULT 0,
    is_emergency BOOLEAN DEFAULT FALSE,
    overridden_by UUID,
    overridden_at TIMESTAMPTZ,
    overridden_reason TEXT
);

-- Table: law_votes
CREATE TABLE IF NOT EXISTS public.law_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    law_id UUID NOT NULL,
    user_id UUID NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
    weight INTEGER DEFAULT 1,
    voted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(law_id, user_id)
);

-- Table: bribe_logs
CREATE TABLE IF NOT EXISTS public.bribe_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briber_id UUID NOT NULL,
    bribee_id UUID,
    amount BIGINT NOT NULL,
    purpose TEXT,
    is_exposed BOOLEAN DEFAULT FALSE,
    exposed_at TIMESTAMPTZ,
    exposed_by UUID,
    exposure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'secret' CHECK (status IN ('secret', 'exposed', 'investigated'))
);

-- Table: protests
CREATE TABLE IF NOT EXISTS public.protests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    organizer_id UUID NOT NULL,
    target_law_id UUID,
    intensity INTEGER DEFAULT 1 CHECK (intensity BETWEEN 1 AND 10),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'growing', 'crisis', 'resolved', 'dispersed')),
    participant_count INTEGER DEFAULT 1,
    max_participants INTEGER DEFAULT 100,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    effect_on_law DOUBLE PRECISION DEFAULT 0,
    effect_on_reputation DOUBLE PRECISION DEFAULT 0,
    location TEXT
);

-- Table: protest_participants
CREATE TABLE IF NOT EXISTS public.protest_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protest_id UUID NOT NULL,
    user_id UUID NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    contribution INTEGER DEFAULT 1,
    UNIQUE(protest_id, user_id)
);

-- Table: emergency_powers_log
CREATE TABLE IF NOT EXISTS public.emergency_powers_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    president_id UUID NOT NULL,
    action_type TEXT NOT NULL,
    target_user_id UUID,
    target_law_id UUID,
    target_protest_id UUID,
    reason TEXT,
    backlash_score INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cooldown_ends_at TIMESTAMPTZ,
    CHECK (action_type IN ('override_vote', 'force_law', 'end_protest', 'jail_user', 'emergency_declaration'))
);

-- Table: city_reputation
CREATE TABLE IF NOT EXISTS public.city_reputation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_laws_passed INTEGER DEFAULT 0,
    active_laws INTEGER DEFAULT 0,
    average_trust DOUBLE PRECISION DEFAULT 50.0,
    protest_count INTEGER DEFAULT 0,
    corruption_exposed_count INTEGER DEFAULT 0,
    emergency_declarations INTEGER DEFAULT 0,
    last_election_date TIMESTAMPTZ,
    election_participation_rate DOUBLE PRECISION DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: government_history
CREATE TABLE IF NOT EXISTS public.government_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    actor_id UUID,
    target_id UUID,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stream_likes
CREATE TABLE IF NOT EXISTS public.stream_likes (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    stream_id UUID,
    user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (stream_id, user_id)
);

-- Table: league_events
CREATE TABLE IF NOT EXISTS public.league_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'hourly', 'thirty_min_heat', 'battle', 'creator')),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'ended')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website VARCHAR(500),
  country VARCHAR(100),
  admin_user_id UUID NOT NULL,
  business_email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verified_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'archived')),
  logo_url TEXT,
  student_limit INT DEFAULT 20,
  current_student_count INT DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: organization_members
CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'staff' CHECK (role IN ('org_admin', 'staff', 'viewer')),
  status text DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  invited_by uuid,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

-- Table: organization_messages
CREATE TABLE IF NOT EXISTS public.organization_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  sender_id uuid,
  content text,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'announcement', 'file', 'system')),
  is_urgent boolean DEFAULT false,
  pinned boolean DEFAULT false,
  file_id uuid,
  read_by jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table: organization_files
CREATE TABLE IF NOT EXISTS public.organization_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  uploaded_by uuid,
  folder text DEFAULT 'General',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  access_level text DEFAULT 'org_staff' CHECK (access_level IN ('admin_only', 'org_admin', 'org_staff')),
  version integer DEFAULT 1,
  description text,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Table: organization_audit_logs
CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table: stream_analytics_daily
CREATE TABLE IF NOT EXISTS public.stream_analytics_daily (
  date date PRIMARY KEY,
  total_viewer_minutes bigint NOT NULL DEFAULT 0,
  total_stream_minutes bigint NOT NULL DEFAULT 0,
  total_gifts_count bigint NOT NULL DEFAULT 0,
  total_gift_coins bigint NOT NULL DEFAULT 0,
  unique_viewers bigint NOT NULL DEFAULT 0,
  unique_streams bigint NOT NULL DEFAULT 0,
  avg_watch_time_per_user numeric NOT NULL DEFAULT 0,
  avg_stream_duration numeric NOT NULL DEFAULT 0,
  avg_gifts_per_user numeric NOT NULL DEFAULT 0,
  peak_concurrent_viewers bigint NOT NULL DEFAULT 0
);

-- Table: troll_city_treasury
CREATE TABLE IF NOT EXISTS public.troll_city_treasury (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_name text NOT NULL DEFAULT 'maitroll Treasury',
  balance_coins bigint NOT NULL DEFAULT 0,
  total_earned_coins bigint NOT NULL DEFAULT 0,
  total_distributed_coins bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: treasury_transactions
CREATE TABLE IF NOT EXISTS public.treasury_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treasury_id uuid NOT NULL,
  user_id uuid,
  transaction_type text NOT NULL CHECK (
    transaction_type IN ('revenue_credit', 'manual_credit', 'role_distribution', 'correction')
  ),
  source_type text,
  source_id uuid,
  direction text NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount_coins bigint NOT NULL CHECK (amount_coins > 0),
  balance_before bigint NOT NULL DEFAULT 0,
  balance_after bigint NOT NULL DEFAULT 0,
  created_by uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: treasury_role_allocations
CREATE TABLE IF NOT EXISTS public.treasury_role_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  role_label text NOT NULL,
  weekly_amount_coins bigint NOT NULL DEFAULT 0 CHECK (weekly_amount_coins >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: treasury_payout_runs
CREATE TABLE IF NOT EXISTS public.treasury_payout_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_week_start date NOT NULL,
  run_week_end date NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'approved', 'paid', 'cancelled')),
  total_amount_coins bigint NOT NULL DEFAULT 0,
  created_by uuid,
  approved_by uuid,
  processed_by uuid,
  approved_at timestamptz,
  processed_at timestamptz,
  notes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: treasury_payout_items
CREATE TABLE IF NOT EXISTS public.treasury_payout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role_key text NOT NULL,
  amount_coins bigint NOT NULL CHECK (amount_coins > 0),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'skipped', 'failed')) DEFAULT 'pending',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

-- Table: organization_admins
CREATE TABLE IF NOT EXISTS organization_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'manager')),
  added_by UUID NOT NULL,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  permissions JSONB DEFAULT '{}'::jsonb
);

-- Table: organization_students
CREATE TABLE IF NOT EXISTS organization_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'removed')),
  date_of_birth DATE,
  age_at_enrollment INT,
  is_verified_18_plus BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Table: mai_classes
CREATE TABLE IF NOT EXISTS mai_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instructor_id UUID NOT NULL,
  organization_id UUID,
  status TEXT DEFAULT 'active',
  max_students_per_org INT DEFAULT 20,
  class_schedule TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Table: mai_class_enrollments
CREATE TABLE IF NOT EXISTS mai_class_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL,
  student_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  status TEXT DEFAULT 'enrolled',
  enrollment_date TIMESTAMP DEFAULT now(),
  withdrawn_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(class_id, student_id)
);

-- Table: league_leaderboard_snapshots
CREATE TABLE IF NOT EXISTS public.league_leaderboard_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_event_id UUID NOT NULL,
    user_id UUID NOT NULL,
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

-- Table: user_league_missions
CREATE TABLE IF NOT EXISTS public.user_league_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id UUID NOT NULL,
    mission_key TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT NOT NULL,
    target_value INT NOT NULL DEFAULT 1,
    current_value INT NOT NULL DEFAULT 0,
    reward_points INT DEFAULT 0,
    reward_xp INT DEFAULT 0,
    reward_coins INT DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'claimed', 'expired', 'failed')),
    generated_by TEXT DEFAULT 'system',
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: tromail_accounts
CREATE TABLE IF NOT EXISTS tromail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE,
  username TEXT NOT NULL,
  role TEXT NOT NULL,
  display_name TEXT,
  tromail_address TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: tromail_messages
CREATE TABLE IF NOT EXISTS tromail_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID,
  sender_role TEXT NOT NULL,
  sender_tromail_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  is_admin_email BOOLEAN DEFAULT false,
  is_important BOOLEAN DEFAULT false,
  related_meeting_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: tromail_recipients
CREATE TABLE IF NOT EXISTS tromail_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  recipient_user_id UUID,
  recipient_role TEXT NOT NULL,
  recipient_tromail_address TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  is_starred BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: tromail_calendar_events
CREATE TABLE IF NOT EXISTS tromail_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_user_id UUID,
  created_by_role TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'meeting',
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  meeting_id UUID,
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: tromail_calendar_event_recipients
CREATE TABLE IF NOT EXISTS tromail_calendar_event_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_event_id UUID,
  recipient_user_id UUID,
  recipient_role TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: user_earning_events
CREATE TABLE IF NOT EXISTS public.user_earning_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role_key text NOT NULL,
    role_label text NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    amount_coins integer NOT NULL DEFAULT 0,
    percent_rate numeric NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'pending',
    paid_at timestamptz,
    payout_run_id uuid,
    details jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: role_earning_rules
CREATE TABLE IF NOT EXISTS public.role_earning_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key text NOT NULL UNIQUE,
    role_label text NOT NULL,
    earning_type text NOT NULL,
    amount_coins integer NOT NULL DEFAULT 0,
    percent_rate numeric NOT NULL DEFAULT 0,
    source_type text,
    requirement_text text,
    application_route text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: broadcast_league_stats
CREATE TABLE IF NOT EXISTS public.broadcast_league_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcaster_id UUID NOT NULL,
    season_key TEXT NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
    league_tier TEXT NOT NULL DEFAULT 'T0' CHECK (league_tier IN ('T0','T1','T2','T3','T4','T5','T6','T7','T8','T9','T10')),
    league_score NUMERIC NOT NULL DEFAULT 0,
    gift_coins_received NUMERIC NOT NULL DEFAULT 0,
    total_live_minutes NUMERIC NOT NULL DEFAULT 0,
    gift_count INTEGER NOT NULL DEFAULT 0,
    stream_count INTEGER NOT NULL DEFAULT 0,
    best_stream_score NUMERIC NOT NULL DEFAULT 0,
    last_stream_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(broadcaster_id, season_key)
);

-- Table: customer_service_audit_logs
CREATE TABLE IF NOT EXISTS public.customer_service_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL,
  target_user_id UUID,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: admin_password_resets
CREATE TABLE IF NOT EXISTS public.admin_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  reset_method TEXT NOT NULL DEFAULT 'email_reset_link',
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: user_presence_routes
CREATE TABLE IF NOT EXISTS public.user_presence_routes (
  user_id UUID PRIMARY KEY,
  current_path TEXT,
  current_title TEXT,
  session_id TEXT,
  user_agent TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: support_screen_sessions
CREATE TABLE IF NOT EXISTS public.support_screen_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','accepted','active','ended','declined','expired')),
  livekit_room_name TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Table: user_league_members
CREATE TABLE IF NOT EXISTS public.user_league_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    league_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'moderator', 'member')),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'kicked', 'banned', 'left')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    contribution_score BIGINT DEFAULT 0,
    last_active_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(league_id, user_id)
);

-- Table: jail_notifications
CREATE TABLE IF NOT EXISTS public.jail_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: pride_challenges
CREATE TABLE IF NOT EXISTS public.pride_challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'chat', 'engagement', 'social', 'general'
    xp_reward BIGINT NOT NULL DEFAULT 0,
    target_value BIGINT NOT NULL DEFAULT 1, -- how many times/action needed
    progress_type TEXT DEFAULT 'count', -- 'count', 'boolean', 'time'
    keyword_triggers TEXT[] DEFAULT '{}', -- keywords that count toward this challenge
    icon TEXT DEFAULT '🏳️‍🌈',
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    starts_at TIMESTAMPTZ DEFAULT now(),
    ends_at TIMESTAMPTZ, -- NULL = no end date
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: pride_user_progress
CREATE TABLE IF NOT EXISTS public.pride_user_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    challenge_id UUID NOT NULL,
    progress_value BIGINT DEFAULT 0,
    completion_percentage FLOAT DEFAULT 0,
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, challenge_id)
);

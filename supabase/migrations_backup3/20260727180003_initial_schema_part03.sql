-- Initial Schema Part 03
-- Tables 129 to 192
-- Dependency-ordered: tables are created after their dependencies
-- Note: Foreign key constraints are defined in per-page migrations

-- Table: document_stamps
CREATE TABLE IF NOT EXISTS public.document_stamps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  approval_id UUID,
  stamp_id TEXT NOT NULL UNIQUE,
  seal_text TEXT NOT NULL DEFAULT 'maitroll OFFICIAL',
  approver_id UUID NOT NULL,
  approver_username TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  approval_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE,
  stamp_hash TEXT NOT NULL,
  verification_code TEXT NOT NULL UNIQUE,
  ip_address INET,
  is_valid BOOLEAN DEFAULT true,
  document_checksum TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: document_audit_logs
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL,
  actor_id UUID,
  actor_username TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'document_created', 'document_updated', 'document_signed',
    'document_submitted', 'document_reviewed', 'document_approved',
    'document_rejected', 'document_stamped', 'document_downloaded',
    'document_archived', 'document_assigned', 'document_unassigned',
    'signature_added', 'signature_revoked', 'stamp_applied',
    'version_created', 'document_locked', 'document_unlocked',
    'pdf_generated', 'document_shared', 'approval_override'
  )),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: officer_vote_cycles
create table if not exists officer_vote_cycles (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  created_at timestamptz not null default now()
);

-- Table: officer_votes
create table if not exists officer_votes (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null,
  voter_id uuid not null,
  broadcaster_id uuid not null,
  created_at timestamptz not null default now()
);

-- Table: events
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID,
  category_slug TEXT NOT NULL DEFAULT 'custom_event',

  -- Event timing
  event_date DATE NOT NULL,
  start_time TIME WITH TIME ZONE,
  end_time TIME WITH TIME ZONE,
  timezone TEXT DEFAULT 'UTC',

  -- Media
  banner_image_url TEXT,
  thumbnail_url TEXT,
  event_color TEXT DEFAULT '#8B5CF6',

  -- Creator & ownership
  creator_id UUID NOT NULL,
  creator_username TEXT NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled', 'archived')),

  -- Participation
  max_participants INTEGER,
  registration_locked BOOLEAN DEFAULT false,
  registration_opens_at TIMESTAMP WITH TIME ZONE,
  registration_closes_at TIMESTAMP WITH TIME ZONE,

  -- Visibility & access
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'invite_only')),
  access_level TEXT DEFAULT 'everyone' CHECK (access_level IN (
    'everyone', 'verified_users', 'founding_officers', 'staff', 'creators', 'agencies',
    'specific_levels', 'specific_users', 'invite_only'
  )),
  min_level INTEGER DEFAULT 1,

  -- Requirements & rules
  requirements TEXT[] DEFAULT '{}',
  rules TEXT,

  -- Location (optional - for virtual/physical events)
  location_type TEXT DEFAULT 'virtual' CHECK (location_type IN ('virtual', 'physical', 'hybrid')),
  location_details TEXT,
  stream_id UUID,

  -- Notification settings
  notifications_enabled BOOLEAN DEFAULT true,
  reminder_7d_sent BOOLEAN DEFAULT false,
  reminder_3d_sent BOOLEAN DEFAULT false,
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  started_notification_sent BOOLEAN DEFAULT false,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Table: event_participants
CREATE TABLE IF NOT EXISTS public.event_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  user_id UUID NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,

  -- Participation status
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN (
    'registered', 'confirmed', 'waitlisted', 'attended', 'no_show', 'cancelled', 'banned'
  )),

  -- Registration details
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  attended_at TIMESTAMP WITH TIME ZONE,

  -- Additional info
  notes TEXT,
  metadata JSONB DEFAULT '{}',

  UNIQUE(event_id, user_id)
);

-- Table: auction_prediction_settings
CREATE TABLE IF NOT EXISTS auction_prediction_settings (
  id int PRIMARY KEY DEFAULT 1,
  enabled boolean NOT NULL DEFAULT true,
  enabled_global boolean NOT NULL DEFAULT true,
  lock_before_end_seconds int NOT NULL DEFAULT 30,
  reward_crowns_correct_winner int NOT NULL DEFAULT 10,
  reward_crowns_correct_price int NOT NULL DEFAULT 25,
  reward_crowns_combined int NOT NULL DEFAULT 50,
  reward_xp_correct_winner int NOT NULL DEFAULT 100,
  reward_xp_correct_price int NOT NULL DEFAULT 250,
  reward_xp_combined int NOT NULL DEFAULT 500,
  reward_event_points_correct_winner int NOT NULL DEFAULT 5,
  reward_event_points_correct_price int NOT NULL DEFAULT 10,
  reward_event_points_combined int NOT NULL DEFAULT 20,
  min_entries_for_leaderboard int NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: auction_predictions
CREATE TABLE IF NOT EXISTS auction_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  auction_show_id uuid NOT NULL,
  predicted_winner_id uuid,
  predicted_price int,
  prediction_type text NOT NULL DEFAULT 'combined' CHECK (prediction_type IN ('winner', 'price', 'combined')),
  is_locked boolean NOT NULL DEFAULT false,
  locked_at timestamptz,
  is_correct_winner boolean,
  is_correct_price boolean,
  price_accuracy int,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, auction_show_id)
);

-- Table: crown_redemptions
CREATE TABLE IF NOT EXISTS public.crown_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('troll_coins', 'gift_card')),
  crowns_redeemed INTEGER NOT NULL CHECK (crowns_redeemed > 0),
  reward_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected', 'cancelled')),
  email_sent BOOLEAN DEFAULT FALSE,
  fulfilled_by UUID,
  fulfilled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: office_folders
CREATE TABLE IF NOT EXISTS office_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: office_documents
CREATE TABLE IF NOT EXISTS office_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  folder_id UUID,
  is_admin_document BOOLEAN DEFAULT false,
  is_read_only BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: office_document_versions
CREATE TABLE IF NOT EXISTS office_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: office_spreadsheets
CREATE TABLE IF NOT EXISTS office_spreadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: office_spreadsheet_cells
CREATE TABLE IF NOT EXISTS office_spreadsheet_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id UUID NOT NULL,
  sheet_name TEXT NOT NULL,
  cell_reference TEXT NOT NULL,
  row_index INTEGER NOT NULL DEFAULT 0,
  col_index INTEGER NOT NULL DEFAULT 0,
  value TEXT,
  formula TEXT,
  style_json JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: office_shared_files
CREATE TABLE IF NOT EXISTS office_shared_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('document', 'spreadsheet')),
  owner_id UUID NOT NULL,
  shared_with_user_id UUID NOT NULL,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: office_templates
CREATE TABLE IF NOT EXISTS office_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('document', 'spreadsheet')),
  description TEXT,
  content_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: treelz_posts
CREATE TABLE IF NOT EXISTS treelz_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT DEFAULT '',
  video_duration_seconds INTEGER DEFAULT 0,
  video_size_bytes BIGINT DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  watch_time_seconds BIGINT DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  gifts_received INTEGER DEFAULT 0,
  coins_received BIGINT DEFAULT 0,
  is_ai_flagged BOOLEAN DEFAULT false,
  ai_detection_score NUMERIC(5,2) DEFAULT 0,
  ai_review_status TEXT DEFAULT 'pending' CHECK (ai_review_status IN ('pending', 'reviewed', 'cleared', 'actioned')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed', 'age_restricted')),
  is_featured BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_boosted BOOLEAN DEFAULT false,
  boost_expires_at TIMESTAMP WITH TIME ZONE,
  is_live_promotion BOOLEAN DEFAULT false,
  live_stream_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: treelz_likes
CREATE TABLE IF NOT EXISTS treelz_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Table: treelz_comments
CREATE TABLE IF NOT EXISTS treelz_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: treelz_saves
CREATE TABLE IF NOT EXISTS treelz_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Table: treelz_shares
CREATE TABLE IF NOT EXISTS treelz_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  post_id UUID NOT NULL,
  platform TEXT DEFAULT 'copy_link',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: treelz_ai_flags
CREATE TABLE IF NOT EXISTS treelz_ai_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confidence NUMERIC(5,2) NOT NULL,
  action_taken TEXT DEFAULT 'pending' CHECK (action_taken IN ('pending', 'cleared', 'removed', 'age_restricted')),
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Table: treelz_upload_bans
CREATE TABLE IF NOT EXISTS treelz_upload_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reason TEXT NOT NULL,
  banned_until TIMESTAMP WITH TIME ZONE,
  strike_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: states
CREATE TABLE IF NOT EXISTS public.states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state_code TEXT UNIQUE NOT NULL,
    state_name TEXT NOT NULL,
    battle_points BIGINT DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    representative_user_id UUID,
    monthly_points BIGINT DEFAULT 0,
    monthly_wins INTEGER DEFAULT 0,
    monthly_losses INTEGER DEFAULT 0,
    last_month_reset TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: state_members
CREATE TABLE IF NOT EXISTS public.state_members (
    user_id UUID PRIMARY KEY,
    state_code TEXT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    battle_points_earned BIGINT DEFAULT 0,
    battles_participated INTEGER DEFAULT 0,
    battles_won INTEGER DEFAULT 0
);

-- Table: troll_battles
CREATE TABLE IF NOT EXISTS public.troll_battles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player1_id UUID NOT NULL,
    player2_id UUID NOT NULL,
    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('pending', 'active', 'completed', 'cancelled')) DEFAULT 'pending',
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    winner_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: state_battles
CREATE TABLE IF NOT EXISTS public.state_battles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    battle_id UUID,
    state_a TEXT NOT NULL,
    state_b TEXT NOT NULL,
    winner_state TEXT,
    points_awarded INTEGER DEFAULT 0,
    host_user_id UUID,
    challenger_user_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: marketplace_payout_release_requests
CREATE TABLE IF NOT EXISTS marketplace_payout_release_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid NOT NULL,
  seller_id uuid NOT NULL,

  -- Request details
  tracking_number text NOT NULL,
  tracking_url text,
  carrier text CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
  seller_notes text,

  -- Gate info
  completed_sales_count int DEFAULT 0,
  has_open_appeals boolean DEFAULT false,

  -- Status flow: pending -> approved -> rejected -> completed | expired
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired')),

  -- Admin fields
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  rejection_reason text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(order_id)
);

-- Table: fast_pay_applications
CREATE TABLE IF NOT EXISTS public.fast_pay_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  -- Application details
  payout_method text NOT NULL CHECK (payout_method IN ('cash_app', 'paypal', 'venmo')),
  payout_username text NOT NULL,
  payout_email text,
  cashtag text,
  venmo_handle text,

  -- Terms acceptance
  accepted_terms boolean NOT NULL DEFAULT false,
  accepted_fees boolean NOT NULL DEFAULT false,
  accepted_identity_verification boolean NOT NULL DEFAULT false,

  -- Eligibility snapshot at time of application
  user_level int NOT NULL,
  account_age_days int NOT NULL,
  has_verified_identity boolean NOT NULL DEFAULT false,
  has_violations boolean NOT NULL DEFAULT false,
  has_fraud_history boolean NOT NULL DEFAULT false,

  -- Status flow: pending -> under_review -> approved -> rejected
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'under_review', 'approved', 'rejected')),

  -- Admin review
  reviewed_by uuid,
  reviewed_at timestamptz,
  admin_notes text,
  rejection_reason text,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

-- Table: stream_smoke_events
CREATE TABLE IF NOT EXISTS public.stream_smoke_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  created_by uuid NOT NULL,
  is_active boolean DEFAULT true,
  seat_count integer DEFAULT 6 CHECK (seat_count >= 1 AND seat_count <= 12),
  raffle_enabled boolean DEFAULT true,
  troll_drop_enabled boolean DEFAULT true,
  song_queue_enabled boolean DEFAULT true,
  dj_user_id uuid,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: troll_drops
CREATE TABLE IF NOT EXISTS public.troll_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  created_by uuid NOT NULL,
  coin_value integer NOT NULL CHECK (coin_value > 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds IN (3, 10, 30)),
  total_bills integer NOT NULL DEFAULT 25 CHECK (total_bills > 0 AND total_bills <= 500),
  status text DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
  started_at timestamptz DEFAULT now(),
  ends_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table: stream_song_requests
CREATE TABLE IF NOT EXISTS public.stream_song_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  requested_by uuid NOT NULL,
  dj_user_id uuid,
  song_title text NOT NULL,
  artist text,
  song_link text,
  total_cost integer DEFAULT 10,
  dj_share integer DEFAULT 5,
  admin_share integer DEFAULT 5,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'playing', 'played', 'skipped', 'refunded')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: stream_raffles
CREATE TABLE IF NOT EXISTS public.stream_raffles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL,
  smoke_event_id uuid,
  created_by uuid NOT NULL,
  ticket_cost integer DEFAULT 500,
  status text DEFAULT 'active' CHECK (status IN ('active', 'drawing', 'completed', 'cancelled')),
  draw_interval_minutes integer DEFAULT 30,
  current_round integer DEFAULT 1,
  next_draw_at timestamptz NOT NULL,
  started_at timestamptz DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: cashout_tiers
CREATE TABLE IF NOT EXISTS public.cashout_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coin_amount BIGINT NOT NULL,
    cash_amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    processing_fee_percentage NUMERIC(6,2) DEFAULT 2.9,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: broadcast_mod_actions
CREATE TABLE IF NOT EXISTS public.broadcast_mod_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Who performed the action
    actor_id UUID NOT NULL,
    actor_role TEXT DEFAULT 'unknown',
    
    -- Who was targeted
    target_user_id UUID NOT NULL,
    
    -- Action details (NO 'ban' - only arrest, warn, mute, disable, etc.)
    action_type TEXT NOT NULL CHECK (action_type IN (
        'disable_chat', 'enable_chat', 'kick', 'arrest',
        'disable_broadcast', 'enable_broadcast',
        'disable_hytrogame', 'enable_hytrogame',
        'disable_seat_joining', 'enable_seat_joining',
        'report', 'mute', 'unmute', 'warn',
        'warning', 'platform_review', 'fine'
    )),
    
    -- Context
    stream_id UUID,
    
    -- Action parameters
    duration_minutes INTEGER,
    reason TEXT,
    severity TEXT,
    bail_amount NUMERIC(12,2),
    
    -- Fine system
    fine_amount NUMERIC(12,2) DEFAULT 0,
    fine_paid BOOLEAN DEFAULT false,
    fine_paid_at TIMESTAMPTZ,
    fine_payment_method TEXT CHECK (fine_payment_method IN ('troll_coins', 'manual', 'waived')),
    fine_waived_by UUID,
    fine_waived_at TIMESTAMPTZ,
    
    -- Evidence fields
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    evidence_type TEXT CHECK (evidence_type IN ('screenshot', 'video', 'clip', 'chat_logs', 'system_log', 'other')),
    evidence_notes TEXT,
    
    -- Internal moderator notes (staff only, never shown to users)
    internal_notes TEXT,
    
    -- For arrest: whether broadcast was being recorded
    broadcast_recorded BOOLEAN DEFAULT false,
    
    -- Expiration (for timed actions)
    expires_at TIMESTAMPTZ,
    
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'completed')),
    
    -- If action was revoked
    revoked_by UUID,
    revoked_at TIMESTAMPTZ,
    revoke_reason TEXT,
    
    -- Audit fields
    edited_by UUID,
    edited_at TIMESTAMPTZ,
    edit_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_broadcast_restrictions
CREATE TABLE IF NOT EXISTS public.user_broadcast_restrictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    broadcast_disabled BOOLEAN DEFAULT false,
    hytrogame_disabled BOOLEAN DEFAULT false,
    seat_joining_disabled BOOLEAN DEFAULT false,
    chat_disabled BOOLEAN DEFAULT false,
    restricted_by UUID,
    reason TEXT,
    duration_minutes INTEGER,
    expires_at TIMESTAMPTZ,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Table: user_profile_badges
CREATE TABLE IF NOT EXISTS public.user_profile_badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    badge_id UUID NOT NULL,
    earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_featured BOOLEAN NOT NULL DEFAULT false,
    featured_order INT,
    UNIQUE(user_id, badge_id)
);

-- Table: user_profile_roles
CREATE TABLE IF NOT EXISTS public.user_profile_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_type TEXT NOT NULL CHECK (role_type IN (
        'auctioneer', 'attorney', 'prosecutor', 'journalist', 'news_caster',
        'chief_news_caster', 'troll_officer', 'lead_troll_officer', 'pastor',
        'agency_leader', 'agency_hr', 'agency_hr_manager', 'secretary',
        'ceo_assistant', 'noah_assistant', 'troller', 'seller', 'broadcaster'
    )),
    is_active BOOLEAN NOT NULL DEFAULT true,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    UNIQUE(user_id, role_type)
);

-- Table: jail
CREATE TABLE IF NOT EXISTS public.jail (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    release_time timestamptz NOT NULL,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- Table: jail_transactions
CREATE TABLE IF NOT EXISTS public.jail_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            jail_id UUID,
            user_id UUID,
            transaction_type TEXT NOT NULL CHECK (transaction_type IN ('message_fee', 'bond', 'appeal_fee', 'refund', 'attorney_fee')),
            amount INTEGER NOT NULL,
            recipient_id UUID,
            recipient_type TEXT CHECK (recipient_type IN ('public_pool', 'admin', 'attorney')),
            status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );

-- Table: promo_cards
CREATE TABLE IF NOT EXISTS promo_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    token_amount numeric(12,2) NOT NULL,
    user_id uuid NOT NULL,
    source_type text NOT NULL CHECK (source_type IN ('broadcast_start', 'broadcast_watch', 'share_link')),
    issued_at timestamp with time zone NOT NULL DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    redeemed_at timestamp with time zone NULL,
    redeemed_by uuid NULL,
    status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed', 'expired')),
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT promo_cards_pkey PRIMARY KEY (id),
    CONSTRAINT promo_cards_code_key UNIQUE (code),
    CONSTRAINT promo_cards_token_amount_nonnegative CHECK (token_amount >= 0)
);

-- Table: employee_audit_log
create table if not exists public.employee_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  target_id uuid,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  department text,
  related_record text,
  created_at timestamptz not null default now()
);

-- Table: employee_records
create table if not exists public.employee_records (
  user_id uuid primary key,
  employment_status text not null default 'active'
    check (employment_status in ('active','inactive','suspended','terminated')),
  department text,
  job_title text,
  supervisor_id uuid,
  hire_date timestamptz,
  location_city text,
  location_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: employee_announcements
create table if not exists public.employee_announcements (
  id uuid primary key default gen_random_uuid(),
  author_id uuid,
  title text not null,
  body text not null,
  level text not null default 'normal' check (level in ('normal','important','urgent')),
  department text,
  created_at timestamptz not null default now()
);

-- Table: employee_announcement_acks
create table if not exists public.employee_announcement_acks (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null,
  user_id uuid not null,
  acked_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

-- Table: employee_tasks
create table if not exists public.employee_tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  assigned_by uuid,
  assigned_to uuid,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  due_date timestamptz,
  status text not null default 'assigned'
    check (status in ('assigned','in_progress','blocked','awaiting_review','completed','cancelled')),
  department text,
  comments jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  completion_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: employee_reports
create table if not exists public.employee_reports (
  id uuid primary key default gen_random_uuid(),
  report_type text,
  subject text not null,
  description text,
  submitted_by uuid,
  related_user uuid,
  related_employee uuid,
  related_broadcast uuid,
  related_incident uuid,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  confidential boolean not null default false,
  status text not null default 'submitted'
    check (status in ('submitted','received','under_review','more_info_needed','action_taken','closed','escalated')),
  supervisor_id uuid,
  responses jsonb default '[]'::jsonb,
  evidence jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: employee_change_requests
create table if not exists public.employee_change_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  type text not null default 'platform_change' check (type in ('platform_change','workflow','employee_tool')),
  author_id uuid,
  status text not null default 'open' check (status in ('open','under_review','approved','rejected','implemented')),
  votes integer not null default 0,
  comments jsonb default '[]'::jsonb,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Table: employee_change_request_votes
create table if not exists public.employee_change_request_votes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (request_id, user_id)
);

-- Table: employee_chat_channels
create table if not exists public.employee_chat_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'general' check (kind in ('general','department','role','direct')),
  role_scope text[] not null default '{}', -- empty = all employees
  created_at timestamptz not null default now()
);

-- Table: employee_chat_messages
create table if not exists public.employee_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  sender_id uuid,
  body text not null,
  parent_id uuid,
  reactions jsonb default '{}'::jsonb,
  attachments jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Table: frontend_studio_drafts
create table if not exists public.frontend_studio_drafts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','approved','published','rolled_back')),
  author_id uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- Table: employee_payroll_runs
create table if not exists public.employee_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  period_start date not null,
  period_end date not null,
  status text not null default 'draft' check (status in ('draft','approved','paid')),
  created_by uuid,
  created_at timestamptz not null default now()
);

-- Table: employee_paystubs
create table if not exists public.employee_paystubs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid,
  user_id uuid not null,
  pay_period_start date not null,
  pay_period_end date not null,
  pay_date date not null,
  hours numeric not null default 0,
  rate numeric not null default 0,
  gross_pay numeric not null default 0,
  federal_tax numeric not null default 0,
  state_tax numeric not null default 0,
  fica numeric not null default 0,
  medicare numeric not null default 0,
  net_pay numeric not null default 0,
  location_city text,
  location_state text,
  created_at timestamptz not null default now()
);

-- Table: employee_perk_pay
create table if not exists public.employee_perk_pay (
  id uuid primary key default gen_random_uuid(),
  role text not null unique,
  amount numeric not null default 0,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- Table: employee_disciplinary_actions
create table if not exists public.employee_disciplinary_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  action_type text not null,
  reason text not null,
  issued_by uuid,
  created_at timestamptz not null default now()
);

-- Table: beta_feedback
CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL DEFAULT 'TC-BETA-' || nextval('public.beta_feedback_public_seq')::text,
  user_id uuid NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  affected_feature text,
  affected_route text,
  device_type text,
  browser_name text,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  is_pwa boolean DEFAULT false,
  app_version text,
  screenshot_url text,
  severity text,
  priority text DEFAULT 'normal',
  status text DEFAULT 'submitted',
  assigned_to uuid,
  duplicate_of uuid,
  moderator_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  archived_at timestamptz
);

-- Table: beta_feedback_internal_notes
CREATE TABLE IF NOT EXISTS public.beta_feedback_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL,
  moderator_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table: beta_feedback_audit_log
CREATE TABLE IF NOT EXISTS public.beta_feedback_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- Table: beta_feedback_replies
CREATE TABLE IF NOT EXISTS public.beta_feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL,
  author_id uuid NOT NULL,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'user_visible',
  created_at timestamptz DEFAULT now()
);

-- Table: hr_onboarding_items
CREATE TABLE IF NOT EXISTS public.hr_onboarding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL,
  document_key text NOT NULL,
  document_name text NOT NULL,
  category text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'not_sent'
    CHECK (status IN ('not_sent','sent','submitted','approved','rejected','waived')),
  due_date date,
  sent_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  file_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, document_key)
);

-- Table: interviews
CREATE TABLE IF NOT EXISTS public.interviews (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      job_application_id uuid,
      applicant_id uuid NOT NULL,
      position_id text,
      scheduled_date date NOT NULL,
      scheduled_time time without time zone NOT NULL,
      duration_minutes integer DEFAULT 30 NOT NULL,
      interviewer_id uuid,
      instructions text,
      internal_notes text,
      call_room_id uuid,
      status text DEFAULT 'scheduled'::text NOT NULL,
      created_by uuid,
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,
      CONSTRAINT interviews_pkey PRIMARY KEY (id),
      CONSTRAINT interviews_status_check
        CHECK (status = ANY (ARRAY[
          'scheduled'::text, 'in_progress'::text, 'completed'::text,
          'cancelled'::text, 'no_show'::text
        ]))
    );

-- Table: employee_document_templates
CREATE TABLE IF NOT EXISTS public.employee_document_templates (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  document_key text NOT NULL,
  document_name text NOT NULL,
  category text NOT NULL,
  description text,
  required boolean DEFAULT true,
  applies_to_roles text[],
  applies_to_categories text[],
  sort_order integer DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT employee_document_templates_pkey PRIMARY KEY (id),
  CONSTRAINT employee_document_templates_key_unique UNIQUE (document_key)
);

-- Table: universe_events
CREATE TABLE IF NOT EXISTS public.universe_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_date DATE NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  registration_opens_at TIMESTAMPTZ,
  registration_closes_at TIMESTAMPTZ,
  seat_lock_at TIMESTAMPTZ,
  check_in_opens_at TIMESTAMPTZ,
  room_opens_at TIMESTAMPTZ,
  opponent_reveal_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','registration_open','registration_closed','seat_locked','check_in','room_open','active','paused','completed','cancelled','rescheduled')),
  current_round_id UUID,
  champion_user_id UUID,
  default_round_duration_seconds INTEGER NOT NULL DEFAULT 600,
  ability_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_universe_event_mountain_time CHECK (timezone = 'America/Denver')
);

-- Table: universe_registrations
CREATE TABLE IF NOT EXISTS public.universe_registrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  captain_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','confirmed','matched','scheduled','checked_in','active','completed','withdrawn','cancelled','disqualified','no_show')),
  registered_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  matched_at TIMESTAMPTZ,
  scheduled_battle_at TIMESTAMPTZ,
  attendance_confirmed BOOLEAN NOT NULL DEFAULT false,
  rules_accepted BOOLEAN NOT NULL DEFAULT false,
  withdrawn_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_registration_event_captain UNIQUE (event_id, captain_user_id)
);

-- Table: universe_calendar_entries
CREATE TABLE IF NOT EXISTS public.universe_calendar_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID,
  match_id UUID,
  user_id UUID,
  entry_type TEXT NOT NULL
    CHECK (entry_type IN ('event','registration','match','reminder','check_in','reveal','completed','cancelled')),
  title TEXT NOT NULL,
  scheduled_start TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'America/Denver',
  opponent_visible BOOLEAN NOT NULL DEFAULT false,
  public_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  private_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_universe_calendar_mountain_time CHECK (timezone = 'America/Denver')
);

-- Table: universe_team_seats
CREATE TABLE IF NOT EXISTS public.universe_team_seats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  registration_id UUID NOT NULL,
  match_id UUID,
  captain_user_id UUID NOT NULL,
  seat_number INTEGER NOT NULL CHECK (seat_number IN (1,2,3)),
  invited_user_id UUID,
  status TEXT NOT NULL DEFAULT 'empty'
    CHECK (status IN ('empty','invited','accepted','declined','removed','expired','checked_in','connected','disconnected','locked')),
  invited_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One seat number per registration (max 3 seats per captain)
  CONSTRAINT uq_universe_seat_registration_number UNIQUE (registration_id, seat_number),
  -- One invited user per event-team (captain + event). A user cannot occupy
  -- two seat slots on the same captain's team.
  CONSTRAINT uq_universe_seat_invited_event UNIQUE (event_id, captain_user_id, invited_user_id)
);

-- Table: universe_queue
CREATE TABLE IF NOT EXISTS public.universe_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL,
  registration_id UUID NOT NULL,
  captain_user_id UUID NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered','confirmed','matched','scheduled','waiting','next','battling','eliminated','withdrawn','disqualified','winner')),
  accepted_seat_one UUID,
  accepted_seat_two UUID,
  accepted_seat_three UUID,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_universe_queue_event_registration UNIQUE (event_id, registration_id)
);

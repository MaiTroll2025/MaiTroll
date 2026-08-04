CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" DEFAULT ('user'::"text" || "substr"(("gen_random_uuid"())::"text", 1, 8)) NOT NULL,
    "avatar_url" "text",
    "bio" "text",
    "role" "text" DEFAULT 'user'::"text",
    "tier" "text" DEFAULT 'Bronze'::"text",
    "total_earned_coins" bigint DEFAULT 0 NOT NULL,
    "total_spent_coins" bigint DEFAULT 0 NOT NULL,
    "insurance_level" "text",
    "insurance_expires_at" timestamp with time zone,
    "no_kick_until" timestamp with time zone,
    "no_ban_until" timestamp with time zone,
    "platform_fee_last_charged" timestamp with time zone,
    "sav_bonus_coins" integer DEFAULT 0 NOT NULL,
    "has_crown_badge" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "insurance_type" "text",
    "badge" "text",
    "has_insurance" boolean DEFAULT false,
    "multiplier_active" boolean DEFAULT false,
    "multiplier_value" numeric DEFAULT 1,
    "multiplier_expires" timestamp with time zone,
    "terms_accepted" boolean DEFAULT false,
    "payout_method" "text",
    "payout_details" "text",
    "legal_first_name" "text",
    "legal_last_name" "text",
    "date_of_birth" "date",
    "country" "text",
    "street_address" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "phone_number" "text",
    "payout_handle" "text",
    "tax_status" "text",
    "is_creator_onboarded" boolean DEFAULT false NOT NULL,
    "onboarded_at" timestamp with time zone,
    "total_earned_usd" numeric(10,2) DEFAULT 0,
    "last_payout_at" timestamp with time zone,
    "lifetime_payout_total" numeric(10,2) DEFAULT 0,
    "is_troll_officer" boolean DEFAULT false,
    "officer_level" integer DEFAULT 1,
    "is_og_user" boolean DEFAULT false,
    "is_admin" boolean DEFAULT false,
    "is_troller" boolean DEFAULT false,
    "troller_level" integer DEFAULT 1,
    "is_banned" boolean DEFAULT false,
    "banned_until" timestamp with time zone,
    "last_known_ip" "inet",
    "ip_address_history" "jsonb" DEFAULT '[]'::"jsonb",
    "is_broadcaster" boolean DEFAULT true NOT NULL,
    "preferred_payout_method" "text",
    "payout_destination_masked" "text",
    "is_empire_partner" boolean DEFAULT false,
    "is_og" boolean DEFAULT false,
    "is_officer" boolean DEFAULT false,
    "is_recruiter" boolean DEFAULT false,
    "address_line1" "text",
    "legal_full_name" "text",
    "state_region" "text",
    "tax_id_last4" "text",
    "tax_classification" "text" DEFAULT 'individual'::"text",
    "w9_status" "text" DEFAULT 'not_submitted'::"text",
    "w9_verified_at" timestamp with time zone,
    "address_line2" "text",
    "profile_view_price" integer DEFAULT 0,
    "is_lead_officer" boolean DEFAULT false,
    "payout_paypal_email" "text",
    "officer_reputation_score" integer DEFAULT 100,
    "is_ghost_mode" boolean DEFAULT false,
    "is_verified" boolean DEFAULT false,
    "verification_date" timestamp with time zone,
    "verification_paid_amount" numeric(6,2),
    "verification_payment_method" "text",
    "ban_expires_at" timestamp with time zone,
    "influencer_tier" "text",
    "profile_banner_url" "text",
    "profile_theme" "text",
    "officer_tier_badge" "text" DEFAULT 'blue'::"text",
    "owc_balance" bigint DEFAULT 0,
    "total_owc_earned" bigint DEFAULT 0,
    "officer_role" "text" DEFAULT 'officer'::"text",
    "is_officer_active" boolean DEFAULT false NOT NULL,
    "email" "text",
    "ban_reason" "text",
    "total_coins_earned" bigint DEFAULT 0,
    "total_coins_spent" bigint DEFAULT 0,
    "empire_role" "text",
    "level" integer DEFAULT 1,
    "xp" bigint DEFAULT 0,
    "is_test_user" boolean DEFAULT false,
    "active_entrance_effect" "text",
    "application_status" "text" DEFAULT 'pending'::"text",
    "app_access_enabled" boolean DEFAULT false,
    "bonus_coin_balance" bigint DEFAULT 0 NOT NULL,
    "troll_pass_expires_at" timestamp with time zone,
    "troll_pass_last_purchased_at" timestamp with time zone,
    "has_troll_pass" boolean DEFAULT false,
    "account_state" "text" DEFAULT 'normal'::"text" NOT NULL,
    "payout_frozen" boolean DEFAULT false NOT NULL,
    "payout_freeze_reason" "text",
    "payout_freeze_at" timestamp with time zone,
    "creator_trust_score" integer DEFAULT 100 NOT NULL,
    "birthday_coins_awarded_date" "date",
    "ghost_mode_expires_at" timestamp with time zone,
    "message_price" integer DEFAULT 0 NOT NULL,
    "message_requests_enabled" boolean DEFAULT false,
    "court_recording_consent" boolean DEFAULT false,
    "court_recording_consent_at" timestamp with time zone,
    "application_required" boolean DEFAULT false,
    "application_submitted" boolean DEFAULT false,
    "is_employee" boolean DEFAULT false,
    "employee_role" "text",
    "hire_date" "date",
    "verified_birthday" boolean DEFAULT false,
    "last_birthday_award" "date",
    "kick_count" integer DEFAULT 0,
    "last_kicked_at" timestamp with time zone,
    "is_kicked" boolean DEFAULT false,
    "kicked_until" timestamp with time zone,
    "account_deleted_at" timestamp with time zone,
    "account_deletion_cooldown_until" timestamp with time zone,
    "account_reset_after_ban" boolean DEFAULT false,
    "empire_partner" boolean DEFAULT false NOT NULL,
    "partner_status" "text",
    "entrance_effect_key" "text",
    "earned_coins" integer DEFAULT 0,
    "last_birthday_coins_awarded" timestamp with time zone,
    "coin_balance" bigint DEFAULT 0 NOT NULL,
    "free_coin_balance" bigint DEFAULT 0 NOT NULL,
    "troll_role" "text",
    "user_id" "uuid",
    "rgb_username_expires_at" timestamp with time zone,
    "rgb_username_enabled" boolean DEFAULT false,
    "entrance_effects" "jsonb" DEFAULT '[]'::"jsonb",
    "reserved_paid_coins" bigint DEFAULT 0,
    "reserved_troll_coins" bigint DEFAULT 0,
    "id_document_url" "text",
    "id_uploaded_at" timestamp with time zone,
    "id_verification_status" "text" DEFAULT 'not_submitted'::"text",
    "full_name" "text",
    "founder_badge" boolean DEFAULT false,
    "boosted_until" timestamp with time zone,
    "reduced_fees_until" timestamp with time zone,
    "verified_creator" boolean DEFAULT false,
    "onboarding_completed" boolean DEFAULT false NOT NULL,
    "total_xp" bigint DEFAULT 0,
    "prestige" integer DEFAULT 0,
    "xp_multiplier" numeric DEFAULT 1.0,
    "coin_multiplier" numeric(4,2) DEFAULT 1.0,
    "rank" character varying(50) DEFAULT NULL::character varying,
    "vived_bonus_coins" integer DEFAULT 0 NOT NULL,
    "og_badge" boolean DEFAULT false,
    "preferred_language" "text" DEFAULT 'en'::"text",
    "seller_verified" boolean DEFAULT false,
    "gender" character varying(10),
    "court_reputation_score" integer DEFAULT 100,
    "muted_until" timestamp with time zone,
    "trollmonds" bigint DEFAULT 0 NOT NULL,
    "troll_coins" integer DEFAULT 0,
    "username_effect" "text",
    "username_effect_expires_at" timestamp with time zone,
    "active_entrance_effect_id" "text",
    "paid_coins" integer DEFAULT 0,
    "has_paid" boolean DEFAULT false NOT NULL,
    "first_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mic_muted_until" timestamp with time zone,
    "live_restricted_until" timestamp with time zone,
    "banner_url" "text",
    CONSTRAINT "check_empire_role" CHECK ((("empire_role" IS NULL) OR ("empire_role" = 'partner'::"text"))),
    CONSTRAINT "user_profiles_account_state_check" CHECK (("account_state" = ANY (ARRAY['normal'::"text", 'warned'::"text", 'restricted'::"text", 'jailed'::"text", 'banned'::"text", 'exiled'::"text"]))),
    CONSTRAINT "user_profiles_application_status_check" CHECK (("application_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "user_profiles_bonus_coin_balance_check" CHECK (("bonus_coin_balance" >= 0)),
    CONSTRAINT "user_profiles_court_reputation_score_check" CHECK (("court_reputation_score" >= 0)),
    CONSTRAINT "user_profiles_creator_trust_score_check" CHECK ((("creator_trust_score" >= 0) AND ("creator_trust_score" <= 100))),
    CONSTRAINT "user_profiles_gender_check" CHECK ((("gender")::"text" = ANY ((ARRAY['male'::character varying, 'female'::character varying])::"text"[]))),
    CONSTRAINT "user_profiles_id_verification_status_check" CHECK (("id_verification_status" = ANY (ARRAY['not_submitted'::"text", 'pending'::"text", 'approved'::"text", 'rejected'::"text"]))),
    CONSTRAINT "user_profiles_influencer_tier_check" CHECK (("influencer_tier" = ANY (ARRAY['basic'::"text", 'gold'::"text", 'platinum'::"text"]))),
    CONSTRAINT "user_profiles_officer_level_check" CHECK ((("officer_level" >= 1) AND ("officer_level" <= 5))),
    CONSTRAINT "user_profiles_officer_tier_badge_check" CHECK (("officer_tier_badge" = ANY (ARRAY['blue'::"text", 'orange'::"text", 'red'::"text"]))),
    CONSTRAINT "user_profiles_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'moderator'::"text", 'admin'::"text", 'hr_admin'::"text", 'lead_troll_officer'::"text", 'troll_officer'::"text", 'troll_family'::"text", 'troller'::"text", 'empire_partner'::"text", 'secretary'::"text", 'broadcaster'::"text", 'family_leader'::"text", 'member'::"text", 'guest'::"text"]))),
    CONSTRAINT "user_profiles_sav_bonus_coins_check" CHECK (("sav_bonus_coins" >= 0)),
    CONSTRAINT "user_profiles_troll_coins_check" CHECK (("troll_coins" >= 0)),
    CONSTRAINT "user_profiles_vived_bonus_coins_check" CHECK (("vived_bonus_coins" >= 0))
);

-- Initial Schema Part 01
-- Tables 1 to 64
-- Dependency-ordered: tables are created after their dependencies
-- Note: Foreign key constraints are defined in per-page migrations

-- Table: user_stats
CREATE TABLE IF NOT EXISTS public.user_stats (
    user_id UUID PRIMARY KEY,
    xp_total BIGINT DEFAULT 0,
    level INT DEFAULT 1,
    xp_to_next_level BIGINT DEFAULT 100,
    xp_progress FLOAT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: support_tickets
CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    username text,
    email text,
    category text NOT NULL DEFAULT 'general',
    subject text NOT NULL,
    message text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    priority text DEFAULT 'normal',
    created_at timestamptz NOT NULL DEFAULT now(),
    admin_response text,
    admin_id uuid,
    response_at timestamptz,
    resolved_at timestamptz,
    closed_at timestamptz
);

-- Table: mobile_error_logs
CREATE TABLE IF NOT EXISTS public.mobile_error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    page_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: tournaments
CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'upcoming', 'open', 'live', 'ended')),
  season INTEGER DEFAULT 1,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  prize_pool TEXT,
  rules TEXT,
  description TEXT,
  max_participants INTEGER,
  entry_fee INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: tournament_participants
CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tournament_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'eliminated', 'withdrawn', 'winner')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  points INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  rank INTEGER,
  stats JSONB DEFAULT '{}'::jsonb,
  UNIQUE(tournament_id, user_id)
);

-- Table: streams
CREATE TABLE IF NOT EXISTS public.streams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT,
  status TEXT DEFAULT 'pending', -- pending, live, ended
  box_count INTEGER DEFAULT 1,
  seat_price INTEGER DEFAULT 0,
  are_seats_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

-- Table: stream_messages
CREATE TABLE IF NOT EXISTS public.stream_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: gifts
CREATE TABLE IF NOT EXISTS public.gifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    icon_url TEXT DEFAULT 'ðŸŽ',
    animation_url TEXT,
    cost INTEGER DEFAULT 0 NOT NULL,
    category TEXT NOT NULL,
    rarity TEXT DEFAULT 'common',
    class TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: stream_gifts
CREATE TABLE IF NOT EXISTS public.stream_gifts (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    stream_id UUID,
    sender_id UUID,
    receiver_id UUID,
    gift_id TEXT,
    quantity INTEGER,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: stream_moderators
CREATE TABLE IF NOT EXISTS public.stream_moderators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcaster_id UUID, -- The broadcaster who appointed them
  user_id UUID, -- The moderator
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(broadcaster_id, user_id)
);

-- Table: stream_bans
CREATE TABLE IF NOT EXISTS public.stream_bans (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    stream_id UUID,
    user_id UUID,
    banned_by UUID,
    reason TEXT,
    banned_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- Table: stream_mutes
CREATE TABLE IF NOT EXISTS public.stream_mutes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id UUID,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stream_id, user_id)
);

-- Table: battles
CREATE TABLE IF NOT EXISTS public.battles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_stream_id UUID NOT NULL,
  opponent_stream_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended')),
  winner_stream_id UUID,
  score_challenger INTEGER DEFAULT 0,
  score_opponent INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ
);

-- Table: conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID
);

-- Table: conversation_members
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID,
    user_id UUID,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

-- Table: conversation_messages
CREATE TABLE IF NOT EXISTS public.conversation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID,
    sender_id UUID,
    body TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ
);

-- Table: saved_streams
CREATE TABLE IF NOT EXISTS public.saved_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    stream_id UUID NOT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT DEFAULT 'manual', -- 'manual' | 'auto_stream_end' | 'auto_summary'
    UNIQUE(user_id, stream_id)
);

-- Table: troll_court_evidence
CREATE TABLE IF NOT EXISTS public.troll_court_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stream_id UUID NOT NULL,
    saved_by UUID NOT NULL,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    case_title TEXT,
    case_description TEXT,
    evidence_type TEXT DEFAULT 'broadcast', -- 'broadcast', 'chat', 'gift', 'stream_messages'
    video_url TEXT, -- direct recording URL (from streams.recording_url)
    metadata JSONB DEFAULT '{}', -- additional data (duration, viewer_count, category, etc.)
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_stream_evidence UNIQUE (stream_id, saved_by)
);

-- Table: auction_watchlist
CREATE TABLE IF NOT EXISTS public.auction_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    auction_show_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, auction_show_id)
);

-- Table: coin_orders
CREATE TABLE IF NOT EXISTS public.coin_orders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      package_id uuid,
      coins integer not null,
      amount_cents integer not null,
      status text not null default 'created',
      stripe_checkout_session_id text not null,
      stripe_payment_intent_id text,
      paid_at timestamp with time zone,
      fulfilled_at timestamp with time zone,
      created_at timestamp with time zone not null default now(),
      updated_at timestamp with time zone not null default now(),
      constraint coin_orders_status_check check (status in ('created', 'paid', 'fulfilled', 'canceled', 'failed'))
    );

-- Table: stripe_customers
create table if not exists public.stripe_customers (
  user_id uuid primary key,
  stripe_customer_id text not null,
  created_at timestamp with time zone not null default now()
);

-- Table: manual_coin_orders
CREATE TABLE IF NOT EXISTS public.manual_coin_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    package_id text NOT NULL,
    amount int NOT NULL,
    price text NOT NULL,
    payment_method text NOT NULL, -- 'cashapp'
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz,
    processed_by uuid
);

-- Table: coin_ledger
CREATE TABLE IF NOT EXISTS public.coin_ledger (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    delta bigint NOT NULL, -- can be positive or negative
    bucket text NOT NULL, -- 'paid', 'gifted', 'promo', 'loan', 'repayment'
    source text NOT NULL, -- 'coin_purchase', 'gift', 'admin_grant', 'loan_disbursement', 'auto_repay'
    ref_id text, -- external reference ID (e.g. stripe payment id)
    created_at timestamptz DEFAULT now()
);

-- Table: admin_pool_ledger
CREATE TABLE IF NOT EXISTS public.admin_pool_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(18,3) NOT NULL,
  reason TEXT NOT NULL,
  ref_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: user_event_dismissals
create table if not exists user_event_dismissals (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- Table: officer_time_off_requests
create table if not exists officer_time_off_requests (
  id uuid primary key default gen_random_uuid(),
  officer_id uuid not null,
  date date not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Table: loans
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  principal numeric NOT NULL,
  balance numeric NOT NULL,
  interest_rate numeric DEFAULT 0,
  status text CHECK (status IN ('active','paid','late','defaulted')),
  created_at timestamptz DEFAULT now(),
  due_date timestamptz
);

-- Table: loan_applications
CREATE TABLE IF NOT EXISTS public.loan_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    requested_coins bigint NOT NULL,
    status text NOT NULL DEFAULT 'pending', -- 'approved', 'denied', 'pending'
    auto_approved boolean DEFAULT false,
    reason text,
    created_at timestamptz DEFAULT now()
);

-- Table: bank_tiers
CREATE TABLE IF NOT EXISTS public.bank_tiers (
    id serial PRIMARY KEY,
    tier_name text NOT NULL,
    min_tenure_days int NOT NULL DEFAULT 0,
    max_loan_coins bigint NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Table: family_tasks
CREATE TABLE IF NOT EXISTS public.family_tasks (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    family_id uuid NOT NULL,
    task_title text NOT NULL,
    task_description text,
    reward_family_coins integer DEFAULT 0,
    reward_family_xp integer DEFAULT 0,
    goal_value integer DEFAULT 1,
    current_value integer DEFAULT 0,
    metric text NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Table: gift_ledger
CREATE TABLE IF NOT EXISTS public.gift_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    stream_id UUID, -- Optional, if associated with a stream
    gift_id TEXT NOT NULL, -- ID or Slug
    amount INTEGER NOT NULL, -- Cost in Coins
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, failed
    idempotency_key TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    error_message TEXT
);

-- Table: broadcaster_stats
CREATE TABLE IF NOT EXISTS public.broadcaster_stats (
    user_id UUID PRIMARY KEY,
    total_gifts_24h INTEGER DEFAULT 0,
    total_gifts_all_time INTEGER DEFAULT 0,
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: vehicles_catalog
CREATE TABLE IF NOT EXISTS public.vehicles_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL,
    model_url TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    tier TEXT,
    style TEXT,
    speed INTEGER,
    armor INTEGER,
    color_from TEXT,
    color_to TEXT,
    image_url TEXT,
    overlay_video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT vehicles_catalog_name_key UNIQUE(name),
    CONSTRAINT vehicles_catalog_model_url_key UNIQUE(model_url)
);

-- Table: user_vehicles
CREATE TABLE IF NOT EXISTS public.user_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    catalog_id INTEGER NOT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    condition INTEGER DEFAULT 100, -- 0-100%
    mods JSONB DEFAULT '{}'::jsonb, -- Engine, Handling, Cosmetic upgrades
    is_impounded BOOLEAN DEFAULT FALSE,
    impounded_at TIMESTAMPTZ,
    impound_reason TEXT,
    CONSTRAINT condition_check CHECK (condition >= 0 AND condition <= 100)
);

-- Table: vehicle_loans
CREATE TABLE IF NOT EXISTS public.vehicle_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    vehicle_id UUID NOT NULL,
    total_amount INTEGER NOT NULL,
    remaining_amount INTEGER NOT NULL,
    monthly_payment INTEGER NOT NULL,
    interest_rate NUMERIC DEFAULT 0.05,
    next_payment_due_at TIMESTAMPTZ,
    last_payment_at TIMESTAMPTZ,
    missed_payments INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'defaulted', 'repo')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_driver_licenses
CREATE TABLE IF NOT EXISTS public.user_driver_licenses (
    user_id UUID PRIMARY KEY,
    status TEXT DEFAULT 'none',
    suspended_until TIMESTAMPTZ,
    points INTEGER DEFAULT 0,
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: vehicle_listings
CREATE TABLE IF NOT EXISTS vehicle_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL,
  vehicle_id INTEGER NOT NULL,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('sale', 'auction')),
  price INTEGER NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'sold', 'cancelled', 'expired')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: system_roles
create table if not exists system_roles (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  hierarchy_rank int not null default 0,
  is_staff boolean default false,
  is_admin boolean default false,
  description text,
  created_at timestamptz default now()
);

-- Table: user_role_grants
create table if not exists user_role_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  role_id uuid,
  granted_by uuid,
  created_at timestamptz default now(),
  expires_at timestamptz,
  unique(user_id, role_id)
);

-- Table: president_proposals
create table if not exists president_proposals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  type text not null check (type in ('tax', 'event', 'challenge', 'giveaway', 'other')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  created_by uuid,
  created_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  metadata jsonb default '{}'::jsonb
);

-- Table: president_audit_logs
create table if not exists president_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_id uuid, -- Optional target (user, proposal, etc.)
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Table: houses_catalog
CREATE TABLE IF NOT EXISTS public.houses_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tier INT NOT NULL CHECK (tier BETWEEN 1 AND 5),
    base_price BIGINT NOT NULL,
    rent_slots INT NOT NULL DEFAULT 0,
    power_band TEXT NOT NULL, -- apartment/condo/estate/mansion/landmark
    daily_tax_rate_bps INT NOT NULL DEFAULT 0,
    maintenance_rate_bps INT NOT NULL DEFAULT 0,
    influence_points INT NOT NULL DEFAULT 0,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: user_houses
CREATE TABLE IF NOT EXISTS public.user_houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    house_catalog_id UUID NOT NULL,
    purchase_price BIGINT NOT NULL DEFAULT 0,
    condition INT DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
    is_primary BOOL DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'delinquent', 'foreclosed', 'auctioned')),
    last_tax_paid_at TIMESTAMPTZ,
    last_maintenance_paid_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    influence_active BOOL DEFAULT true,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: house_upgrades
CREATE TABLE IF NOT EXISTS public.house_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_catalog_id UUID,
    name TEXT NOT NULL,
    price BIGINT NOT NULL,
    effects JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: house_rentals
CREATE TABLE IF NOT EXISTS public.house_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_user_id UUID NOT NULL,
    tenant_user_id UUID NOT NULL,
    user_house_id UUID NOT NULL,
    rent_amount BIGINT NOT NULL,
    platform_fee_bps INT DEFAULT 1000,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'late', 'ended', 'evicted')),
    last_paid_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: car_upgrades
CREATE TABLE IF NOT EXISTS public.car_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    cost_coins INTEGER NOT NULL,
    value_increase_amount INTEGER NOT NULL, -- How much it adds to car value
    category TEXT NOT NULL, -- 'engine', 'body', 'paint', etc.
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: auction_bids
CREATE TABLE IF NOT EXISTS public.auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL,
    bidder_user_id UUID NOT NULL,
    amount BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: house_upgrades_catalog
CREATE TABLE IF NOT EXISTS house_upgrades_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  base_price BIGINT NOT NULL,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb, -- e.g. {"rent_slots_add": 2, "tax_discount_bps": 500}
  icon_name TEXT DEFAULT 'Wrench',
  max_per_house INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: house_installations
CREATE TABLE IF NOT EXISTS house_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_house_id UUID NOT NULL,
  upgrade_id UUID NOT NULL,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent exceeding max_per_house
  -- (This is complex to enforce strictly in pure SQL constraint without a trigger, 
  --  so we'll rely on the purchase RPC for enforcement, but add a unique constraint for the common case of max=1)
  CONSTRAINT unique_upgrade_per_house UNIQUE (user_house_id, upgrade_id)
);

-- Table: battle_participants
CREATE TABLE IF NOT EXISTS public.battle_participants (
    battle_id UUID NOT NULL,
    user_id UUID NOT NULL,
    team TEXT NOT NULL CHECK (team IN ('challenger', 'opponent')),
    role TEXT NOT NULL CHECK (role IN ('host', 'stage', 'viewer')),
    source_stream_id UUID NOT NULL,
    seat_index INTEGER,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (battle_id, user_id)
);

-- Table: signup_queue
CREATE TABLE IF NOT EXISTS public.signup_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT false
);

-- Table: task_seasons
CREATE TABLE IF NOT EXISTS public.task_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_dates CHECK (end_date > start_date)
);

-- Table: task_templates
CREATE TABLE IF NOT EXISTS public.task_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric task_metric_type NOT NULL,
    cadence task_cadence NOT NULL,
    default_threshold INTEGER NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: season_tasks
CREATE TABLE IF NOT EXISTS public.season_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    season_id UUID NOT NULL,
    template_id UUID NOT NULL,
    threshold INTEGER NOT NULL,
    bonus_points INTEGER DEFAULT 0, -- Extra weight if we want multi-level bonuses later
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: payout_batches
CREATE TABLE IF NOT EXISTS public.payout_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE NOT NULL, -- Usually Monday
    week_end DATE NOT NULL,   -- Usually Sunday
    payout_date DATE NOT NULL, -- The Friday of that week
    status payout_batch_status DEFAULT 'open',
    total_amount BIGINT DEFAULT 0,
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: creator_goal_boost
CREATE TABLE IF NOT EXISTS public.creator_goal_boost (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    batch_id UUID,
    help_text TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: troll_wall_post_shares
CREATE TABLE IF NOT EXISTS public.troll_wall_post_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL,
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Table: broadcast_pinned_products
CREATE TABLE IF NOT EXISTS public.broadcast_pinned_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL,
    product_id UUID NOT NULL,
    pinned_by UUID,
    pinned_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 1
);

-- Table: shop_orders
CREATE TABLE IF NOT EXISTS public.shop_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    buyer_id UUID NOT NULL,
    seller_id UUID NOT NULL,
    shop_id UUID NOT NULL,
    
    -- Order Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
    )),
    
    -- Pricing
    subtotal INTEGER NOT NULL, -- in coins
    shipping_cost INTEGER DEFAULT 0,
    total_coins INTEGER NOT NULL,
    
    -- Escrow Status
    escrow_status TEXT NOT NULL DEFAULT 'pending' CHECK (escrow_status IN (
        'pending', 'held', 'released', 'refunded'
    )),
    escrow_released_at TIMESTAMPTZ,
    
    -- Shipping
    shipping_name TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_zip TEXT,
    shipping_country TEXT DEFAULT 'US',
    tracking_number TEXT,
    carrier TEXT CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
    tracking_url TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    estimated_delivery DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Table: transaction_appeals
CREATE TABLE IF NOT EXISTS public.transaction_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Appeal Reference
    appeal_number SERIAL,
    appeal_token UUID DEFAULT gen_random_uuid(),
    
    -- User who filed the appeal
    user_id UUID NOT NULL,
    
    -- Related Transaction/Order
    order_id UUID,
    transaction_id UUID,
    shop_id UUID,
    
    -- Appeal Details
    category appeal_category NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[], -- Array of image URLs or document links
    desired_resolution TEXT, -- What the appellant wants (refund, replacement, etc.)
    
    -- Status Tracking
    status appeal_status DEFAULT 'pending' NOT NULL,
    
    -- Reviewer Info (Admin or Secretary)
    reviewer_id UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Related User (the other party in the transaction)
    related_user_id UUID,
    
    -- Coin amounts involved
    amount_in_dispute BIGINT DEFAULT 0,
    escrow_release_status TEXT DEFAULT 'pending', -- pending, released, refunded, held
    
    -- Constraint
    CONSTRAINT transaction_appeals_status_check CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'escalated', 'withdrawn'))
);

-- Table: appeal_weekly_limits
CREATE TABLE IF NOT EXISTS public.appeal_weekly_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    week_start_date DATE NOT NULL, -- Monday of the week
    appeals_filed INTEGER DEFAULT 0,
    max_appeals INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, week_start_date)
);

-- Table: appeal_actions
CREATE TABLE IF NOT EXISTS public.appeal_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appeal_id UUID NOT NULL,
    user_id UUID, -- Who took the action
    action_type TEXT NOT NULL, -- created, status_changed, evidence_added, note_added, etc.
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: global_events
CREATE TABLE IF NOT EXISTS public.global_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    icon TEXT,
    priority INTEGER DEFAULT 1,
    metadata JSONB,
    created_at timestamptz DEFAULT now()
);

-- Table: gifts_catalog
CREATE TABLE IF NOT EXISTS gifts_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 10,
    model_url TEXT,
    thumbnail_url TEXT,
    rarity TEXT NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic')),
    animation_type TEXT NOT NULL DEFAULT 'float' CHECK (animation_type IN ('float', 'spin', 'burst', 'drop', 'orbit', 'spotlight', 'fireworks')),
    duration INTEGER NOT NULL DEFAULT 3000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Table: gift_transactions
CREATE TABLE IF NOT EXISTS gift_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL,
    receiver_id UUID NOT NULL,
    gift_id UUID NOT NULL,
    session_id UUID,
    coins_spent INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: stream_audio_monitoring
CREATE TABLE IF NOT EXISTS stream_audio_monitoring (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID,
    user_id UUID,
    is_monitored BOOLEAN DEFAULT true,
    monitoring_started_at TIMESTAMP DEFAULT NOW(),
    monitoring_ended_at TIMESTAMP,
    total_triggers INTEGER DEFAULT 0,
    last_trigger_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Table: family_chat_messages
CREATE TABLE IF NOT EXISTS public.family_chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL,
    user_id UUID NOT NULL,
    message TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'system', 'call')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);



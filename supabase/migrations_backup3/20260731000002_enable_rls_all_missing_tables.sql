-- PART 2: Add any missing columns discovered from migration files
-- ============================================================================

-- From migration files: user_ip_tracking
ALTER TABLE public.user_ip_tracking
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS country_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS isp TEXT,
  ADD COLUMN IF NOT EXISTS organization TEXT,
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS geolocation_source TEXT;

-- From migration files: broadcaster_applications
ALTER TABLE public.broadcaster_applications
  ADD COLUMN IF NOT EXISTS bank_account_last_four TEXT,
  ADD COLUMN IF NOT EXISTS id_verification_url TEXT,
  ADD COLUMN IF NOT EXISTS tax_form_url TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- From migration files: cashout_requests
ALTER TABLE public.cashout_requests
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT;

-- From migration files: profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tax_status TEXT,
  ADD COLUMN IF NOT EXISTS tax_last_updated TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS troll_role TEXT DEFAULT 'user'
  CHECK (troll_role in ('user','troll_officer','lead_troll_officer','admin'));

-- From migration files: user_levels
ALTER TABLE public.user_levels
  ADD COLUMN IF NOT EXISTS buyer_xp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_level INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS stream_xp BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stream_level INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- From migration files: broadcast_seats
ALTER TABLE public.broadcast_seats
  ADD COLUMN IF NOT EXISTS last_interaction TIMESTAMPTZ;

-- From migration files: officer_live_assignments
ALTER TABLE officer_live_assignments
  ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS auto_clocked_out BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ghost_mode_active BOOLEAN DEFAULT FALSE;

-- From migration files: secretary_assignments
-- Secretary assignments FK references (from fix_secretary_assignments_fk.sql)
-- These FKs reference user_profiles(id)
-- Will be handled when the table structure is confirmed

-- From migration files: scheduled_announcements
ALTER TABLE scheduled_announcements
  ADD COLUMN IF NOT EXISTS is_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ;

-- From migration files: car_insurance_policies
ALTER TABLE public.car_insurance_policies
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS coverage_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS premium_amount NUMERIC(10,2);

-- From migration files: property_insurance_policies
ALTER TABLE public.property_insurance_policies
  ADD COLUMN IF NOT EXISTS plan_id TEXT,
  ADD COLUMN IF NOT EXISTS plan_name TEXT,
  ADD COLUMN IF NOT EXISTS coverage_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS premium_amount NUMERIC(10,2);

-- From migration files: broadcast_background_themes
ALTER TABLE public.broadcast_background_themes
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_exclusive BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS is_system_locked BOOLEAN DEFAULT false NOT NULL;

-- From migration files: gift_items
ALTER TABLE public.gift_items
  ADD COLUMN IF NOT EXISTS animation_url TEXT,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS cost INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS rarity TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- From migration files: family_wars
ALTER TABLE public.family_wars
  ADD COLUMN IF NOT EXISTS challenger_family_id UUID,
  ADD COLUMN IF NOT EXISTS defender_family_id UUID,
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS winner_family_id UUID;


-- ============================================================================
-- PART 3: Enable Row Level Security (RLS)
-- Note: This is idempotent - safe to run even if RLS is already enabled
-- ============================================================================

ALTER TABLE IF EXISTS public.abuse_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_allocation_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_coin_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_coin_revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_gift_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_pool_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_tax_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_top_buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ai_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.app_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.balance_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bank_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.battle_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.battle_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.battle_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.battle_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.battle_skips ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.blocked_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_background_themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_cycle_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_seat_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_theme_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcast_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcaster_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcaster_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.broadcaster_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.call_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.car_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.car_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cashout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.city_districts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clan_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clan_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_pool_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coin_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.coinback_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.content ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.court_ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.court_box_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.court_docket ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.court_rulings_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.court_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.creator_panic_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.creators_over_600 ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.critical_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_giveaways ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_login_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.declined_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deed_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.deeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.district_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.district_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.economy_abuse_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.empire_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.empire_partner_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.empire_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.empire_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.empire_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.entrance_effect_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.escalation_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.escalation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.executive_intake ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.executive_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_badges_earned ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_lounge_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_shop_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_shop_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_tasks_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_war_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.family_wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gas_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ghost_presence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_bonus_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_leaderboard_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gift_leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.giftcard_fulfillments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.gifts_owned ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.group_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hire_fire_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hire_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.home_feature_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.home_feature_spend ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.honorary_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hr_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hr_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.hr_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.identity_reward_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insurance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insurance_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insurance_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.kick_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.lucky_coin_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mai_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mai_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mai_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mai_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.mai_user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.matchmaking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.message_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.millionaire_hall_of_fame ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_actions_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_fee_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.observer_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_chat ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_live_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_mission_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_orientation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_orientations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_patrols ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.officer_work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.owc_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.perk_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pitch_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.platform_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pod_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pod_episodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.post_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_code_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.property_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.provider_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.punishment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recent_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referral_monthly_bonus ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.report_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reputation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.revenue_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.revenue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.risk_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.role_privileges ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.royal_family_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.royal_family_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.royal_family_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.secretary_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.seller_reliability ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shadow_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shop_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shop_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.special_gift_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.square_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_discovery_prefs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_entrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_momentum ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_mute_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_ranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_snack_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.stream_vods ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tax_report_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.town_player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.training_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_ai_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_battle_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_battle_weekly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_dna_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_dna_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_dna_traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_drops_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_event_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_family_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_family_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_family_wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_gift_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_officer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_post_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_stream_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_wall_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_wall_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.troll_wall_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.Mai Troll_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.Mai Troll_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollmond_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollmond_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollmond_store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollmonds_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trolls_night_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollstown_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollstown_property_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trollstown_upgrade_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trolltract_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trolltract_weekly_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tromody_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tromody_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tromody_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tromody_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tromody_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.trophies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.typing_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_active_entrance_effect ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_badges_earned ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_bans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_broadcast_theme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_broadcast_theme_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_car_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_district_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_entrances ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_garage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_insurance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_ip_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_level_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_payout_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_risk_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_streamer_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_tax_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicle_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendor_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.verification_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.visa_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wall_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wall_gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wall_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wall_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.war_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.wars ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_officer_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.xp_ledger ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 4: Create indexes for performance
-- ============================================================================

-- Index for user_ip_tracking
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_city ON user_ip_tracking(city);
-- Index for user_ip_tracking
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_country ON user_ip_tracking(country);
-- Index for gift_items
CREATE INDEX IF NOT EXISTS idx_gift_items_animation_url ON public.gift_items(animation_url) WHERE animation_url IS NOT NULL;
-- Index for family_wars
CREATE INDEX IF NOT EXISTS idx_family_wars_challenger ON public.family_wars(challenger_family_id);
-- Index for family_wars
CREATE INDEX IF NOT EXISTS idx_family_wars_defender ON public.family_wars(defender_family_id);
-- Index for family_wars
CREATE INDEX IF NOT EXISTS idx_family_wars_status ON public.family_wars(status);

-- Generic indexes for user_id columns on user-scoped tables
CREATE INDEX IF NOT EXISTS idx_action_logs_user_id ON public.action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_adjustments_user_id ON public.admin_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_allocation_buckets_user_id ON public.admin_allocation_buckets(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_coin_pool_user_id ON public.admin_coin_pool(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_coin_revenue_user_id ON public.admin_coin_revenue(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_flags_user_id ON public.admin_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_gift_totals_user_id ON public.admin_gift_totals(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_pool_buckets_user_id ON public.admin_pool_buckets(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_tax_reviews_user_id ON public.admin_tax_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_top_buyers_user_id ON public.admin_top_buyers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_user_id ON public.ai_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_balance_ledger_user_id ON public.balance_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_audit_log_user_id ON public.bank_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_history_user_id ON public.battle_history(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_queue_user_id ON public.battle_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_rewards_user_id ON public.battle_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_battle_skips_user_id ON public.battle_skips(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON public.blocked_users(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_cycle_stats_user_id ON public.broadcast_cycle_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_seat_bans_user_id ON public.broadcast_seat_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_seats_user_id ON public.broadcast_seats(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_tokens_user_id ON public.broadcast_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_applications_user_id ON public.broadcaster_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcaster_metrics_user_id ON public.broadcaster_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_call_history_user_id ON public.call_history(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id ON public.call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_call_transactions_user_id ON public.call_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_car_insurance_policies_user_id ON public.car_insurance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_car_models_user_id ON public.car_models(user_id);
CREATE INDEX IF NOT EXISTS idx_case_audit_logs_user_id ON public.case_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_case_evidence_user_id ON public.case_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_case_participants_user_id ON public.case_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_case_templates_user_id ON public.case_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_cashout_requests_user_id ON public.cashout_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_city_districts_user_id ON public.city_districts(user_id);
CREATE INDEX IF NOT EXISTS idx_clan_rewards_user_id ON public.clan_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_clan_vault_user_id ON public.clan_vault(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_pool_contributions_user_id ON public.coin_pool_contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_purchases_user_id ON public.coin_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_reward_pool_user_id ON public.coin_reward_pool(user_id);
CREATE INDEX IF NOT EXISTS idx_coinback_log_user_id ON public.coinback_log(user_id);
CREATE INDEX IF NOT EXISTS idx_court_ai_messages_user_id ON public.court_ai_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_court_box_members_user_id ON public.court_box_members(user_id);
CREATE INDEX IF NOT EXISTS idx_court_docket_user_id ON public.court_docket(user_id);
CREATE INDEX IF NOT EXISTS idx_court_rulings_archive_user_id ON public.court_rulings_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_court_schedules_user_id ON public.court_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_creator_panic_alerts_user_id ON public.creator_panic_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_creators_over_600_user_id ON public.creators_over_600(user_id);
CREATE INDEX IF NOT EXISTS idx_critical_alerts_user_id ON public.critical_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_giveaways_user_id ON public.daily_giveaways(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_login_claims_user_id ON public.daily_login_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_logins_user_id ON public.daily_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_rewards_user_id ON public.daily_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_declined_transactions_user_id ON public.declined_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_deed_transfers_user_id ON public.deed_transfers(user_id);
CREATE INDEX IF NOT EXISTS idx_deeds_user_id ON public.deeds(user_id);
CREATE INDEX IF NOT EXISTS idx_district_announcements_user_id ON public.district_announcements(user_id);
CREATE INDEX IF NOT EXISTS idx_earnings_user_id ON public.earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_economy_abuse_flags_user_id ON public.economy_abuse_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_empire_applications_user_id ON public.empire_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_empire_partners_user_id ON public.empire_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_empire_referrals_user_id ON public.empire_referrals(user_id);
CREATE INDEX IF NOT EXISTS idx_empire_rewards_user_id ON public.empire_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_matrix_user_id ON public.escalation_matrix(user_id);
CREATE INDEX IF NOT EXISTS idx_escalation_reports_user_id ON public.escalation_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_executive_intake_user_id ON public.executive_intake(user_id);
CREATE INDEX IF NOT EXISTS idx_executive_reports_user_id ON public.executive_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_family_activity_log_user_id ON public.family_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_family_badges_earned_user_id ON public.family_badges_earned(user_id);
CREATE INDEX IF NOT EXISTS idx_family_lounge_messages_user_id ON public.family_lounge_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_family_seasons_user_id ON public.family_seasons(user_id);
CREATE INDEX IF NOT EXISTS idx_family_shop_items_user_id ON public.family_shop_items(user_id);
CREATE INDEX IF NOT EXISTS idx_family_shop_purchases_user_id ON public.family_shop_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_family_stats_user_id ON public.family_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_family_tasks_new_user_id ON public.family_tasks_new(user_id);
CREATE INDEX IF NOT EXISTS idx_family_war_stats_user_id ON public.family_war_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_family_wars_user_id ON public.family_wars(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_user_id ON public.follows(user_id);
CREATE INDEX IF NOT EXISTS idx_gas_requests_user_id ON public.gas_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_bonus_tracker_user_id ON public.gift_bonus_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_card_redemptions_user_id ON public.gift_card_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_items_user_id ON public.gift_items(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_leaderboard_entries_user_id ON public.gift_leaderboard_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_leaderboards_user_id ON public.gift_leaderboards(user_id);
CREATE INDEX IF NOT EXISTS idx_giftcard_fulfillments_user_id ON public.giftcard_fulfillments(user_id);
CREATE INDEX IF NOT EXISTS idx_gifts_owned_user_id ON public.gifts_owned(user_id);
CREATE INDEX IF NOT EXISTS idx_group_chats_user_id ON public.group_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_hire_fire_actions_user_id ON public.hire_fire_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_hire_limits_user_id ON public.hire_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_honorary_family_members_user_id ON public.honorary_family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_employees_user_id ON public.hr_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_events_user_id ON public.hr_events(user_id);
CREATE INDEX IF NOT EXISTS idx_hr_notes_user_id ON public.hr_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_reward_logs_user_id ON public.identity_reward_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_user_id ON public.insurance(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_logs_user_id ON public.insurance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_insurance_policies_user_id ON public.insurance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON public.interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_user_id ON public.inventory_items(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_kick_logs_user_id ON public.kick_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_live_sessions_user_id ON public.live_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lucky_coin_events_user_id ON public.lucky_coin_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_appeals_user_id ON public.mai_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_incidents_user_id ON public.mai_incidents(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_overrides_user_id ON public.mai_overrides(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_timeline_events_user_id ON public.mai_timeline_events(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_user_memory_user_id ON public.mai_user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_matchmaking_queue_user_id ON public.matchmaking_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_message_receipts_user_id ON public.message_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_message_requests_user_id ON public.message_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_millionaire_hall_of_fame_user_id ON public.millionaire_hall_of_fame(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_user_id ON public.moderation_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_actions_log_user_id ON public.moderation_actions_log(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_notes_user_id ON public.moderation_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_reports_user_id ON public.moderation_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_activity_user_id ON public.officer_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_applications_user_id ON public.officer_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_assignments_user_id ON public.officer_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_availability_user_id ON public.officer_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_badges_user_id ON public.officer_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_chat_user_id ON public.officer_chat(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_hours_user_id ON public.officer_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_logs_user_id ON public.officer_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_orientation_results_user_id ON public.officer_orientation_results(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_orientations_user_id ON public.officer_orientations(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_patrols_user_id ON public.officer_patrols(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_payouts_user_id ON public.officer_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_quiz_attempts_user_id ON public.officer_quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_quiz_questions_user_id ON public.officer_quiz_questions(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_quiz_results_user_id ON public.officer_quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_shift_logs_user_id ON public.officer_shift_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_officer_weekly_reports_user_id ON public.officer_weekly_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_events_user_id ON public.onboarding_events(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_progress_user_id ON public.onboarding_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_owc_transactions_user_id ON public.owc_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_fees_user_id ON public.payment_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_holds_user_id ON public.payment_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_logs_user_id ON public.payment_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_user_id ON public.payment_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_audit_log_user_id ON public.payout_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_payout_reviews_user_id ON public.payout_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_pitch_votes_user_id ON public.pitch_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_fees_user_id ON public.platform_fees(user_id);
CREATE INDEX IF NOT EXISTS idx_platform_wallet_user_id ON public.platform_wallet(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_bans_user_id ON public.pod_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_episodes_user_id ON public.pod_episodes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_gifts_user_id ON public.post_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user_id ON public.promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_user_id ON public.promo_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_property_insurance_policies_user_id ON public.property_insurance_policies(user_id);
CREATE INDEX IF NOT EXISTS idx_property_loans_user_id ON public.property_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_property_upgrades_user_id ON public.property_upgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_provider_costs_user_id ON public.provider_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_punishment_transactions_user_id ON public.punishment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_punishments_user_id ON public.punishments(user_id);
CREATE INDEX IF NOT EXISTS idx_recent_matches_user_id ON public.recent_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_claims_user_id ON public.referral_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_monthly_bonus_user_id ON public.referral_monthly_bonus(user_id);
CREATE INDEX IF NOT EXISTS idx_report_cases_user_id ON public.report_cases(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_events_user_id ON public.reputation_events(user_id);
CREATE INDEX IF NOT EXISTS idx_revenue_ledger_user_id ON public.revenue_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_user_id ON public.risk_events(user_id);
CREATE INDEX IF NOT EXISTS idx_role_change_log_user_id ON public.role_change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_user_id ON public.rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_royal_family_history_user_id ON public.royal_family_history(user_id);
CREATE INDEX IF NOT EXISTS idx_royal_family_titles_user_id ON public.royal_family_titles(user_id);
CREATE INDEX IF NOT EXISTS idx_secretary_assignments_user_id ON public.secretary_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_reliability_user_id ON public.seller_reliability(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_partners_user_id ON public.shop_partners(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_transactions_user_id ON public.shop_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_shops_user_id ON public.shops(user_id);
CREATE INDEX IF NOT EXISTS idx_special_gift_earnings_user_id ON public.special_gift_earnings(user_id);
CREATE INDEX IF NOT EXISTS idx_square_events_user_id ON public.square_events(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_applications_user_id ON public.staff_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user_id ON public.staff_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_store_items_user_id ON public.store_items(user_id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_discovery_prefs_user_id ON public.stream_discovery_prefs(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_entries_user_id ON public.stream_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_events_user_id ON public.stream_events(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_join_requests_user_id ON public.stream_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_momentum_user_id ON public.stream_momentum(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_mute_counts_user_id ON public.stream_mute_counts(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_passwords_user_id ON public.stream_passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_presets_user_id ON public.stream_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_ranking_user_id ON public.stream_ranking(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_reactions_user_id ON public.stream_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_sessions_user_id ON public.stream_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_snack_purchases_user_id ON public.stream_snack_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_stream_vods_user_id ON public.stream_vods(user_id);
CREATE INDEX IF NOT EXISTS idx_task_completions_user_id ON public.task_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_history_user_id ON public.task_history(user_id);
CREATE INDEX IF NOT EXISTS idx_tax_report_status_user_id ON public.tax_report_status(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_user_id ON public.ticket_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_town_player_state_user_id ON public.town_player_state(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_ai_avatars_user_id ON public.troll_ai_avatars(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_battle_gifts_user_id ON public.troll_battle_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_battle_weekly_stats_user_id ON public.troll_battle_weekly_stats(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_dna_events_user_id ON public.troll_dna_events(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_dna_profiles_user_id ON public.troll_dna_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_dna_traits_user_id ON public.troll_dna_traits(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_drops_log_user_id ON public.troll_drops_log(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_event_claims_user_id ON public.troll_event_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_events_user_id ON public.troll_events(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_members_user_id ON public.troll_family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_memberships_user_id ON public.troll_family_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_messages_user_id ON public.troll_family_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_family_wars_user_id ON public.troll_family_wars(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_gift_items_user_id ON public.troll_gift_items(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_officer_applications_user_id ON public.troll_officer_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_officers_user_id ON public.troll_officers(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_user_id ON public.troll_post_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_views_user_id ON public.troll_post_views(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_stream_messages_user_id ON public.troll_stream_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_streams_user_id ON public.troll_streams(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_gifts_user_id ON public.troll_wall_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_likes_user_id ON public.troll_wall_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_troll_wall_reactions_user_id ON public.troll_wall_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_Mai Troll_orders_user_id ON public.Mai Troll_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_Mai Troll_products_user_id ON public.Mai Troll_products(user_id);
CREATE INDEX IF NOT EXISTS idx_trollmond_gifts_user_id ON public.trollmond_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_trollmond_ledger_user_id ON public.trollmond_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_trollmond_store_items_user_id ON public.trollmond_store_items(user_id);
CREATE INDEX IF NOT EXISTS idx_trollmonds_pools_user_id ON public.trollmonds_pools(user_id);
CREATE INDEX IF NOT EXISTS idx_trolls_night_applications_user_id ON public.trolls_night_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_trollstown_properties_user_id ON public.trollstown_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_trollstown_property_upgrades_user_id ON public.trollstown_property_upgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_trolltract_contracts_user_id ON public.trolltract_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_trolltract_weekly_rewards_user_id ON public.trolltract_weekly_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_battles_user_id ON public.tromody_battles(user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_gifts_user_id ON public.tromody_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_queue_user_id ON public.tromody_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_tromody_sessions_user_id ON public.tromody_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trophies_user_id ON public.trophies(user_id);
CREATE INDEX IF NOT EXISTS idx_typing_statuses_user_id ON public.typing_statuses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_agreements_user_id ON public.user_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_user_id ON public.user_badges_earned(user_id);
CREATE INDEX IF NOT EXISTS idx_user_balances_user_id ON public.user_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON public.user_bans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_car_upgrades_user_id ON public.user_car_upgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cars_user_id ON public.user_cars(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_district_progress_user_id ON public.user_district_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_garage_user_id ON public.user_garage(user_id);
CREATE INDEX IF NOT EXISTS idx_user_insurance_user_id ON public.user_insurance(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_tracking_user_id ON public.user_ip_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_user_levels_user_id ON public.user_levels(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_risk_profile_user_id ON public.user_risk_profile(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streamer_entitlements_user_id ON public.user_streamer_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tax_info_user_id ON public.user_tax_info(user_id);
CREATE INDEX IF NOT EXISTS idx_user_vouchers_user_id ON public.user_vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON public.user_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_users_user_id ON public.users(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_bids_user_id ON public.vehicle_bids(user_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_upgrades_user_id ON public.vehicle_upgrades(user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_user_id ON public.vendor_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_user_id ON public.verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_transactions_user_id ON public.verification_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_visa_redemptions_user_id ON public.visa_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_wall_comments_user_id ON public.wall_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_wall_gifts_user_id ON public.wall_gifts(user_id);
CREATE INDEX IF NOT EXISTS idx_wall_likes_user_id ON public.wall_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_wall_posts_user_id ON public.wall_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_war_results_user_id ON public.war_results(user_id);
CREATE INDEX IF NOT EXISTS idx_wars_user_id ON public.wars(user_id);
CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id ON public.web_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_officer_reports_user_id ON public.weekly_officer_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_ledger_user_id ON public.xp_ledger(user_id);

-- ============================================================================
-- PART 5: Create Row Level Security policies
-- ============================================================================

-- Policy from frontend_schema.sql: troll_family_members
DROP POLICY IF EXISTS "Anyone can view family members" ON public.troll_family_members;
CREATE POLICY "Anyone can view family members" ON public.troll_family_members FOR SELECT USING (true);
-- Policy from frontend_schema.sql: broadcast_background_themes
DROP POLICY IF EXISTS "hide_ceo_theme_from_store" ON public.broadcast_background_themes;
CREATE POLICY "hide_ceo_theme_from_store" ON public.broadcast_background_themes FOR SELECT TO authenticated USING ( slug != 'ceo_gold_premium' OR (slug = 'ceo_gold_premium' AND auth.uid() IN ( SELECT id FROM auth.users WHERE raw_user_meta_data->>'username' = 'ceo' )) );

-- Generic policies for all user-scoped tables

-- abuse_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.abuse_reports;
CREATE POLICY "Allow full access to own records" ON public.abuse_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- action_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.action_logs;
CREATE POLICY "Allow full access to own records" ON public.action_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- activity_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.activity_log;
CREATE POLICY "Allow full access to own records" ON public.activity_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- activity_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.activity_logs;
CREATE POLICY "Allow full access to own records" ON public.activity_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_adjustments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_adjustments;
CREATE POLICY "Allow full access to own records" ON public.admin_adjustments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_allocation_buckets
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_allocation_buckets;
CREATE POLICY "Allow full access to own records" ON public.admin_allocation_buckets FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_coin_pool
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_coin_pool;
CREATE POLICY "Allow full access to own records" ON public.admin_coin_pool FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_coin_revenue
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_coin_revenue;
CREATE POLICY "Allow full access to own records" ON public.admin_coin_revenue FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_flags
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_flags;
CREATE POLICY "Allow full access to own records" ON public.admin_flags FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_gift_totals
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_gift_totals;
CREATE POLICY "Allow full access to own records" ON public.admin_gift_totals FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_pool_buckets
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_pool_buckets;
CREATE POLICY "Allow full access to own records" ON public.admin_pool_buckets FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_tax_reviews
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_tax_reviews;
CREATE POLICY "Allow full access to own records" ON public.admin_tax_reviews FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- admin_top_buyers
DROP POLICY IF EXISTS "Allow full access to own records" ON public.admin_top_buyers;
CREATE POLICY "Allow full access to own records" ON public.admin_top_buyers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ai_action_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.ai_action_logs;
CREATE POLICY "Allow full access to own records" ON public.ai_action_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- app_settings
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.app_settings;
CREATE POLICY "Allow read for authenticated users" ON public.app_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- app_updates
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.app_updates;
CREATE POLICY "Allow read for authenticated users" ON public.app_updates FOR SELECT USING (auth.uid() IS NOT NULL);

-- applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.applications;
CREATE POLICY "Allow full access to own records" ON public.applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- badge_definitions
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.badge_definitions;
CREATE POLICY "Allow read for authenticated users" ON public.badge_definitions FOR SELECT USING (auth.uid() IS NOT NULL);

-- balance_ledger
DROP POLICY IF EXISTS "Allow full access to own records" ON public.balance_ledger;
CREATE POLICY "Allow full access to own records" ON public.balance_ledger FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- bank_audit_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.bank_audit_log;
CREATE POLICY "Allow full access to own records" ON public.bank_audit_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- bank_feature_flags
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.bank_feature_flags;
CREATE POLICY "Allow read for authenticated users" ON public.bank_feature_flags FOR SELECT USING (auth.uid() IS NOT NULL);

-- battle_history
DROP POLICY IF EXISTS "Allow full access to own records" ON public.battle_history;
CREATE POLICY "Allow full access to own records" ON public.battle_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- battle_queue
DROP POLICY IF EXISTS "Allow full access to own records" ON public.battle_queue;
CREATE POLICY "Allow full access to own records" ON public.battle_queue FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- battle_rewards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.battle_rewards;
CREATE POLICY "Allow full access to own records" ON public.battle_rewards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- battle_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.battle_sessions;
CREATE POLICY "Allow full access to own records" ON public.battle_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- battle_skips
DROP POLICY IF EXISTS "Allow full access to own records" ON public.battle_skips;
CREATE POLICY "Allow full access to own records" ON public.battle_skips FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- blocked_users
DROP POLICY IF EXISTS "Allow full access to own records" ON public.blocked_users;
CREATE POLICY "Allow full access to own records" ON public.blocked_users FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcast_background_themes
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.broadcast_background_themes;
CREATE POLICY "Allow read for authenticated users" ON public.broadcast_background_themes FOR SELECT USING (auth.uid() IS NOT NULL);

-- broadcast_cycle_stats
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcast_cycle_stats;
CREATE POLICY "Allow full access to own records" ON public.broadcast_cycle_stats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcast_seat_bans
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcast_seat_bans;
CREATE POLICY "Allow full access to own records" ON public.broadcast_seat_bans FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcast_seats
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcast_seats;
CREATE POLICY "Allow full access to own records" ON public.broadcast_seats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcast_theme_events
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.broadcast_theme_events;
CREATE POLICY "Allow read for authenticated users" ON public.broadcast_theme_events FOR SELECT USING (auth.uid() IS NOT NULL);

-- broadcast_tokens
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcast_tokens;
CREATE POLICY "Allow full access to own records" ON public.broadcast_tokens FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcaster_applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcaster_applications;
CREATE POLICY "Allow full access to own records" ON public.broadcaster_applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcaster_earnings
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcaster_earnings;
CREATE POLICY "Allow full access to own records" ON public.broadcaster_earnings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- broadcaster_metrics
DROP POLICY IF EXISTS "Allow full access to own records" ON public.broadcaster_metrics;
CREATE POLICY "Allow full access to own records" ON public.broadcaster_metrics FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- call_history
DROP POLICY IF EXISTS "Allow full access to own records" ON public.call_history;
CREATE POLICY "Allow full access to own records" ON public.call_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- call_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.call_sessions;
CREATE POLICY "Allow full access to own records" ON public.call_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- call_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.call_transactions;
CREATE POLICY "Allow full access to own records" ON public.call_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- car_insurance_policies
DROP POLICY IF EXISTS "Allow full access to own records" ON public.car_insurance_policies;
CREATE POLICY "Allow full access to own records" ON public.car_insurance_policies FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- car_models
DROP POLICY IF EXISTS "Allow full access to own records" ON public.car_models;
CREATE POLICY "Allow full access to own records" ON public.car_models FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- case_audit_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.case_audit_logs;
CREATE POLICY "Allow full access to own records" ON public.case_audit_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- case_evidence
DROP POLICY IF EXISTS "Allow full access to own records" ON public.case_evidence;
CREATE POLICY "Allow full access to own records" ON public.case_evidence FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- case_participants
DROP POLICY IF EXISTS "Allow full access to own records" ON public.case_participants;
CREATE POLICY "Allow full access to own records" ON public.case_participants FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- case_templates
DROP POLICY IF EXISTS "Allow full access to own records" ON public.case_templates;
CREATE POLICY "Allow full access to own records" ON public.case_templates FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- cashout_requests
DROP POLICY IF EXISTS "Allow full access to own records" ON public.cashout_requests;
CREATE POLICY "Allow full access to own records" ON public.cashout_requests FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- city_districts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.city_districts;
CREATE POLICY "Allow full access to own records" ON public.city_districts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- clan_rewards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.clan_rewards;
CREATE POLICY "Allow full access to own records" ON public.clan_rewards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- clan_vault
DROP POLICY IF EXISTS "Allow full access to own records" ON public.clan_vault;
CREATE POLICY "Allow full access to own records" ON public.clan_vault FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- coin_packages
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.coin_packages;
CREATE POLICY "Allow read for authenticated users" ON public.coin_packages FOR SELECT USING (auth.uid() IS NOT NULL);

-- coin_pool_contributions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.coin_pool_contributions;
CREATE POLICY "Allow full access to own records" ON public.coin_pool_contributions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- coin_purchases
DROP POLICY IF EXISTS "Allow full access to own records" ON public.coin_purchases;
CREATE POLICY "Allow full access to own records" ON public.coin_purchases FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- coin_reward_pool
DROP POLICY IF EXISTS "Allow full access to own records" ON public.coin_reward_pool;
CREATE POLICY "Allow full access to own records" ON public.coin_reward_pool FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- coinback_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.coinback_log;
CREATE POLICY "Allow full access to own records" ON public.coinback_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- config
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.config;
CREATE POLICY "Allow read for authenticated users" ON public.config FOR SELECT USING (auth.uid() IS NOT NULL);

-- content
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.content;
CREATE POLICY "Allow read for authenticated users" ON public.content FOR SELECT USING (auth.uid() IS NOT NULL);

-- court_ai_messages
DROP POLICY IF EXISTS "Allow full access to own records" ON public.court_ai_messages;
CREATE POLICY "Allow full access to own records" ON public.court_ai_messages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- court_box_members
DROP POLICY IF EXISTS "Allow full access to own records" ON public.court_box_members;
CREATE POLICY "Allow full access to own records" ON public.court_box_members FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- court_docket
DROP POLICY IF EXISTS "Allow full access to own records" ON public.court_docket;
CREATE POLICY "Allow full access to own records" ON public.court_docket FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- court_rulings_archive
DROP POLICY IF EXISTS "Allow full access to own records" ON public.court_rulings_archive;
CREATE POLICY "Allow full access to own records" ON public.court_rulings_archive FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- court_schedules
DROP POLICY IF EXISTS "Allow full access to own records" ON public.court_schedules;
CREATE POLICY "Allow full access to own records" ON public.court_schedules FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- creator_panic_alerts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.creator_panic_alerts;
CREATE POLICY "Allow full access to own records" ON public.creator_panic_alerts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- creators_over_600
DROP POLICY IF EXISTS "Allow full access to own records" ON public.creators_over_600;
CREATE POLICY "Allow full access to own records" ON public.creators_over_600 FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- critical_alerts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.critical_alerts;
CREATE POLICY "Allow full access to own records" ON public.critical_alerts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- daily_giveaways
DROP POLICY IF EXISTS "Allow full access to own records" ON public.daily_giveaways;
CREATE POLICY "Allow full access to own records" ON public.daily_giveaways FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- daily_login_claims
DROP POLICY IF EXISTS "Allow full access to own records" ON public.daily_login_claims;
CREATE POLICY "Allow full access to own records" ON public.daily_login_claims FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- daily_logins
DROP POLICY IF EXISTS "Allow full access to own records" ON public.daily_logins;
CREATE POLICY "Allow full access to own records" ON public.daily_logins FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- daily_rewards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.daily_rewards;
CREATE POLICY "Allow full access to own records" ON public.daily_rewards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- declined_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.declined_transactions;
CREATE POLICY "Allow full access to own records" ON public.declined_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- deed_transfers
DROP POLICY IF EXISTS "Allow full access to own records" ON public.deed_transfers;
CREATE POLICY "Allow full access to own records" ON public.deed_transfers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- deeds
DROP POLICY IF EXISTS "Allow full access to own records" ON public.deeds;
CREATE POLICY "Allow full access to own records" ON public.deeds FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- district_announcements
DROP POLICY IF EXISTS "Allow full access to own records" ON public.district_announcements;
CREATE POLICY "Allow full access to own records" ON public.district_announcements FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- district_features
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.district_features;
CREATE POLICY "Allow read for authenticated users" ON public.district_features FOR SELECT USING (auth.uid() IS NOT NULL);

-- earnings
DROP POLICY IF EXISTS "Allow full access to own records" ON public.earnings;
CREATE POLICY "Allow full access to own records" ON public.earnings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- economy_abuse_flags
DROP POLICY IF EXISTS "Allow full access to own records" ON public.economy_abuse_flags;
CREATE POLICY "Allow full access to own records" ON public.economy_abuse_flags FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- empire_applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.empire_applications;
CREATE POLICY "Allow full access to own records" ON public.empire_applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- empire_partner_rewards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.empire_partner_rewards;
CREATE POLICY "Allow full access to own records" ON public.empire_partner_rewards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- empire_partners
DROP POLICY IF EXISTS "Allow full access to own records" ON public.empire_partners;
CREATE POLICY "Allow full access to own records" ON public.empire_partners FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- empire_referrals
DROP POLICY IF EXISTS "Allow full access to own records" ON public.empire_referrals;
CREATE POLICY "Allow full access to own records" ON public.empire_referrals FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- empire_rewards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.empire_rewards;
CREATE POLICY "Allow full access to own records" ON public.empire_rewards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- entrance_effect_catalog
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.entrance_effect_catalog;
CREATE POLICY "Allow read for authenticated users" ON public.entrance_effect_catalog FOR SELECT USING (auth.uid() IS NOT NULL);

-- error_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.error_logs;
CREATE POLICY "Allow full access to own records" ON public.error_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- escalation_matrix
DROP POLICY IF EXISTS "Allow full access to own records" ON public.escalation_matrix;
CREATE POLICY "Allow full access to own records" ON public.escalation_matrix FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- escalation_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.escalation_reports;
CREATE POLICY "Allow full access to own records" ON public.escalation_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- executive_intake
DROP POLICY IF EXISTS "Allow full access to own records" ON public.executive_intake;
CREATE POLICY "Allow full access to own records" ON public.executive_intake FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- executive_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.executive_reports;
CREATE POLICY "Allow full access to own records" ON public.executive_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_activity_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_activity_log;
CREATE POLICY "Allow full access to own records" ON public.family_activity_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_badges_earned
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_badges_earned;
CREATE POLICY "Allow full access to own records" ON public.family_badges_earned FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_lounge_messages
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_lounge_messages;
CREATE POLICY "Allow full access to own records" ON public.family_lounge_messages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_seasons
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_seasons;
CREATE POLICY "Allow full access to own records" ON public.family_seasons FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_shop_items
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_shop_items;
CREATE POLICY "Allow full access to own records" ON public.family_shop_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_shop_purchases
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_shop_purchases;
CREATE POLICY "Allow full access to own records" ON public.family_shop_purchases FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_stats
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_stats;
CREATE POLICY "Allow full access to own records" ON public.family_stats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_tasks_new
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_tasks_new;
CREATE POLICY "Allow full access to own records" ON public.family_tasks_new FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_war_stats
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_war_stats;
CREATE POLICY "Allow full access to own records" ON public.family_war_stats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- family_wars
DROP POLICY IF EXISTS "Allow full access to own records" ON public.family_wars;
CREATE POLICY "Allow full access to own records" ON public.family_wars FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- follows
DROP POLICY IF EXISTS "Allow full access to own records" ON public.follows;
CREATE POLICY "Allow full access to own records" ON public.follows FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gas_requests
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gas_requests;
CREATE POLICY "Allow full access to own records" ON public.gas_requests FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ghost_presence_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.ghost_presence_logs;
CREATE POLICY "Allow full access to own records" ON public.ghost_presence_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gift_bonus_tracker
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gift_bonus_tracker;
CREATE POLICY "Allow full access to own records" ON public.gift_bonus_tracker FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gift_card_redemptions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gift_card_redemptions;
CREATE POLICY "Allow full access to own records" ON public.gift_card_redemptions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gift_catalog
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.gift_catalog;
CREATE POLICY "Allow read for authenticated users" ON public.gift_catalog FOR SELECT USING (auth.uid() IS NOT NULL);

-- gift_items
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gift_items;
CREATE POLICY "Allow full access to own records" ON public.gift_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gift_leaderboard_entries
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gift_leaderboard_entries;
CREATE POLICY "Allow full access to own records" ON public.gift_leaderboard_entries FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gift_leaderboards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gift_leaderboards;
CREATE POLICY "Allow full access to own records" ON public.gift_leaderboards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- giftcard_fulfillments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.giftcard_fulfillments;
CREATE POLICY "Allow full access to own records" ON public.giftcard_fulfillments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- gifts_owned
DROP POLICY IF EXISTS "Allow full access to own records" ON public.gifts_owned;
CREATE POLICY "Allow full access to own records" ON public.gifts_owned FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- group_chats
DROP POLICY IF EXISTS "Allow full access to own records" ON public.group_chats;
CREATE POLICY "Allow full access to own records" ON public.group_chats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- hire_fire_actions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.hire_fire_actions;
CREATE POLICY "Allow full access to own records" ON public.hire_fire_actions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- hire_limits
DROP POLICY IF EXISTS "Allow full access to own records" ON public.hire_limits;
CREATE POLICY "Allow full access to own records" ON public.hire_limits FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- home_feature_cycles
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.home_feature_cycles;
CREATE POLICY "Allow read for authenticated users" ON public.home_feature_cycles FOR SELECT USING (auth.uid() IS NOT NULL);

-- home_feature_spend
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.home_feature_spend;
CREATE POLICY "Allow read for authenticated users" ON public.home_feature_spend FOR SELECT USING (auth.uid() IS NOT NULL);

-- honorary_family_members
DROP POLICY IF EXISTS "Allow full access to own records" ON public.honorary_family_members;
CREATE POLICY "Allow full access to own records" ON public.honorary_family_members FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- hr_employees
DROP POLICY IF EXISTS "Allow full access to own records" ON public.hr_employees;
CREATE POLICY "Allow full access to own records" ON public.hr_employees FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- hr_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.hr_events;
CREATE POLICY "Allow full access to own records" ON public.hr_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- hr_notes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.hr_notes;
CREATE POLICY "Allow full access to own records" ON public.hr_notes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- identity_reward_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.identity_reward_logs;
CREATE POLICY "Allow full access to own records" ON public.identity_reward_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- incidents
DROP POLICY IF EXISTS "Allow full access to own records" ON public.incidents;
CREATE POLICY "Allow full access to own records" ON public.incidents FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- insurance
DROP POLICY IF EXISTS "Allow full access to own records" ON public.insurance;
CREATE POLICY "Allow full access to own records" ON public.insurance FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- insurance_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.insurance_logs;
CREATE POLICY "Allow full access to own records" ON public.insurance_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- insurance_packages
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.insurance_packages;
CREATE POLICY "Allow read for authenticated users" ON public.insurance_packages FOR SELECT USING (auth.uid() IS NOT NULL);

-- insurance_plans
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.insurance_plans;
CREATE POLICY "Allow read for authenticated users" ON public.insurance_plans FOR SELECT USING (auth.uid() IS NOT NULL);

-- insurance_policies
DROP POLICY IF EXISTS "Allow full access to own records" ON public.insurance_policies;
CREATE POLICY "Allow full access to own records" ON public.insurance_policies FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- interview_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.interview_sessions;
CREATE POLICY "Allow full access to own records" ON public.interview_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- inventory_items
DROP POLICY IF EXISTS "Allow full access to own records" ON public.inventory_items;
CREATE POLICY "Allow full access to own records" ON public.inventory_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- invoices
DROP POLICY IF EXISTS "Allow full access to own records" ON public.invoices;
CREATE POLICY "Allow full access to own records" ON public.invoices FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- kick_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.kick_logs;
CREATE POLICY "Allow full access to own records" ON public.kick_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- live_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.live_sessions;
CREATE POLICY "Allow full access to own records" ON public.live_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- lucky_coin_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.lucky_coin_events;
CREATE POLICY "Allow full access to own records" ON public.lucky_coin_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- mai_appeals
DROP POLICY IF EXISTS "Allow full access to own records" ON public.mai_appeals;
CREATE POLICY "Allow full access to own records" ON public.mai_appeals FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- mai_incidents
DROP POLICY IF EXISTS "Allow full access to own records" ON public.mai_incidents;
CREATE POLICY "Allow full access to own records" ON public.mai_incidents FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- mai_overrides
DROP POLICY IF EXISTS "Allow full access to own records" ON public.mai_overrides;
CREATE POLICY "Allow full access to own records" ON public.mai_overrides FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- mai_timeline_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.mai_timeline_events;
CREATE POLICY "Allow full access to own records" ON public.mai_timeline_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- mai_user_memory
DROP POLICY IF EXISTS "Allow full access to own records" ON public.mai_user_memory;
CREATE POLICY "Allow full access to own records" ON public.mai_user_memory FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- matchmaking_queue
DROP POLICY IF EXISTS "Allow full access to own records" ON public.matchmaking_queue;
CREATE POLICY "Allow full access to own records" ON public.matchmaking_queue FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- message_receipts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.message_receipts;
CREATE POLICY "Allow full access to own records" ON public.message_receipts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- message_requests
DROP POLICY IF EXISTS "Allow full access to own records" ON public.message_requests;
CREATE POLICY "Allow full access to own records" ON public.message_requests FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- millionaire_hall_of_fame
DROP POLICY IF EXISTS "Allow full access to own records" ON public.millionaire_hall_of_fame;
CREATE POLICY "Allow full access to own records" ON public.millionaire_hall_of_fame FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- moderation_actions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.moderation_actions;
CREATE POLICY "Allow full access to own records" ON public.moderation_actions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- moderation_actions_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.moderation_actions_log;
CREATE POLICY "Allow full access to own records" ON public.moderation_actions_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- moderation_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.moderation_events;
CREATE POLICY "Allow full access to own records" ON public.moderation_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- moderation_fee_settings
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.moderation_fee_settings;
CREATE POLICY "Allow read for authenticated users" ON public.moderation_fee_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- moderation_notes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.moderation_notes;
CREATE POLICY "Allow full access to own records" ON public.moderation_notes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- moderation_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.moderation_reports;
CREATE POLICY "Allow full access to own records" ON public.moderation_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- observer_ratings
DROP POLICY IF EXISTS "Allow full access to own records" ON public.observer_ratings;
CREATE POLICY "Allow full access to own records" ON public.observer_ratings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_actions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_actions;
CREATE POLICY "Allow full access to own records" ON public.officer_actions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_activity
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_activity;
CREATE POLICY "Allow full access to own records" ON public.officer_activity FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_applications;
CREATE POLICY "Allow full access to own records" ON public.officer_applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_assignments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_assignments;
CREATE POLICY "Allow full access to own records" ON public.officer_assignments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_availability
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_availability;
CREATE POLICY "Allow full access to own records" ON public.officer_availability FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_badges
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_badges;
CREATE POLICY "Allow full access to own records" ON public.officer_badges FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_chat
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_chat;
CREATE POLICY "Allow full access to own records" ON public.officer_chat FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_earnings
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_earnings;
CREATE POLICY "Allow full access to own records" ON public.officer_earnings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_hours
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_hours;
CREATE POLICY "Allow full access to own records" ON public.officer_hours FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_live_assignments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_live_assignments;
CREATE POLICY "Allow full access to own records" ON public.officer_live_assignments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_logs;
CREATE POLICY "Allow full access to own records" ON public.officer_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_mission_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_mission_logs;
CREATE POLICY "Allow full access to own records" ON public.officer_mission_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_orientation_results
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_orientation_results;
CREATE POLICY "Allow full access to own records" ON public.officer_orientation_results FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_orientations
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_orientations;
CREATE POLICY "Allow full access to own records" ON public.officer_orientations FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_patrols
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_patrols;
CREATE POLICY "Allow full access to own records" ON public.officer_patrols FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_payouts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_payouts;
CREATE POLICY "Allow full access to own records" ON public.officer_payouts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_quiz_attempts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_quiz_attempts;
CREATE POLICY "Allow full access to own records" ON public.officer_quiz_attempts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_quiz_questions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_quiz_questions;
CREATE POLICY "Allow full access to own records" ON public.officer_quiz_questions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_quiz_results
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_quiz_results;
CREATE POLICY "Allow full access to own records" ON public.officer_quiz_results FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_shift_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_shift_logs;
CREATE POLICY "Allow full access to own records" ON public.officer_shift_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_strikes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_strikes;
CREATE POLICY "Allow full access to own records" ON public.officer_strikes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_training_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_training_sessions;
CREATE POLICY "Allow full access to own records" ON public.officer_training_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_weekly_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_weekly_reports;
CREATE POLICY "Allow full access to own records" ON public.officer_weekly_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- officer_work_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.officer_work_sessions;
CREATE POLICY "Allow full access to own records" ON public.officer_work_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- onboarding_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.onboarding_events;
CREATE POLICY "Allow full access to own records" ON public.onboarding_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- onboarding_progress
DROP POLICY IF EXISTS "Allow full access to own records" ON public.onboarding_progress;
CREATE POLICY "Allow full access to own records" ON public.onboarding_progress FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- owc_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.owc_transactions;
CREATE POLICY "Allow full access to own records" ON public.owc_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payment_fees
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payment_fees;
CREATE POLICY "Allow full access to own records" ON public.payment_fees FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payment_holds
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payment_holds;
CREATE POLICY "Allow full access to own records" ON public.payment_holds FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payment_logs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payment_logs;
CREATE POLICY "Allow full access to own records" ON public.payment_logs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payment_methods
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payment_methods;
CREATE POLICY "Allow full access to own records" ON public.payment_methods FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payment_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payment_transactions;
CREATE POLICY "Allow full access to own records" ON public.payment_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payout_audit_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payout_audit_log;
CREATE POLICY "Allow full access to own records" ON public.payout_audit_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payout_reviews
DROP POLICY IF EXISTS "Allow full access to own records" ON public.payout_reviews;
CREATE POLICY "Allow full access to own records" ON public.payout_reviews FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- payout_settings
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.payout_settings;
CREATE POLICY "Allow read for authenticated users" ON public.payout_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- perk_catalog
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.perk_catalog;
CREATE POLICY "Allow read for authenticated users" ON public.perk_catalog FOR SELECT USING (auth.uid() IS NOT NULL);

-- pitch_votes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.pitch_votes;
CREATE POLICY "Allow full access to own records" ON public.pitch_votes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- platform_fees
DROP POLICY IF EXISTS "Allow full access to own records" ON public.platform_fees;
CREATE POLICY "Allow full access to own records" ON public.platform_fees FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- platform_wallet
DROP POLICY IF EXISTS "Allow full access to own records" ON public.platform_wallet;
CREATE POLICY "Allow full access to own records" ON public.platform_wallet FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- pod_bans
DROP POLICY IF EXISTS "Allow full access to own records" ON public.pod_bans;
CREATE POLICY "Allow full access to own records" ON public.pod_bans FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- pod_episodes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.pod_episodes;
CREATE POLICY "Allow full access to own records" ON public.pod_episodes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- post_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.post_gifts;
CREATE POLICY "Allow full access to own records" ON public.post_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- posts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.posts;
CREATE POLICY "Allow full access to own records" ON public.posts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- profiles
DROP POLICY IF EXISTS "Allow full access to own records" ON public.profiles;
CREATE POLICY "Allow full access to own records" ON public.profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- promo_code_uses
DROP POLICY IF EXISTS "Allow full access to own records" ON public.promo_code_uses;
CREATE POLICY "Allow full access to own records" ON public.promo_code_uses FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- promo_codes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.promo_codes;
CREATE POLICY "Allow full access to own records" ON public.promo_codes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- property_insurance_policies
DROP POLICY IF EXISTS "Allow full access to own records" ON public.property_insurance_policies;
CREATE POLICY "Allow full access to own records" ON public.property_insurance_policies FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- property_loans
DROP POLICY IF EXISTS "Allow full access to own records" ON public.property_loans;
CREATE POLICY "Allow full access to own records" ON public.property_loans FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- property_types
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.property_types;
CREATE POLICY "Allow read for authenticated users" ON public.property_types FOR SELECT USING (auth.uid() IS NOT NULL);

-- property_upgrades
DROP POLICY IF EXISTS "Allow full access to own records" ON public.property_upgrades;
CREATE POLICY "Allow full access to own records" ON public.property_upgrades FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- provider_costs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.provider_costs;
CREATE POLICY "Allow full access to own records" ON public.provider_costs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- punishment_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.punishment_transactions;
CREATE POLICY "Allow full access to own records" ON public.punishment_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- punishments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.punishments;
CREATE POLICY "Allow full access to own records" ON public.punishments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- recent_matches
DROP POLICY IF EXISTS "Allow full access to own records" ON public.recent_matches;
CREATE POLICY "Allow full access to own records" ON public.recent_matches FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- referral_claims
DROP POLICY IF EXISTS "Allow full access to own records" ON public.referral_claims;
CREATE POLICY "Allow full access to own records" ON public.referral_claims FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- referral_monthly_bonus
DROP POLICY IF EXISTS "Allow full access to own records" ON public.referral_monthly_bonus;
CREATE POLICY "Allow full access to own records" ON public.referral_monthly_bonus FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- referrals
DROP POLICY IF EXISTS "Allow full access to own records" ON public.referrals;
CREATE POLICY "Allow full access to own records" ON public.referrals FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- report_cases
DROP POLICY IF EXISTS "Allow full access to own records" ON public.report_cases;
CREATE POLICY "Allow full access to own records" ON public.report_cases FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- reputation_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.reputation_events;
CREATE POLICY "Allow full access to own records" ON public.reputation_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- revenue_ledger
DROP POLICY IF EXISTS "Allow full access to own records" ON public.revenue_ledger;
CREATE POLICY "Allow full access to own records" ON public.revenue_ledger FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- revenue_settings
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.revenue_settings;
CREATE POLICY "Allow read for authenticated users" ON public.revenue_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- risk_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.risk_events;
CREATE POLICY "Allow full access to own records" ON public.risk_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- role_change_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.role_change_log;
CREATE POLICY "Allow full access to own records" ON public.role_change_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- role_privileges
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.role_privileges;
CREATE POLICY "Allow read for authenticated users" ON public.role_privileges FOR SELECT USING (auth.uid() IS NOT NULL);

-- roles
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.roles;
CREATE POLICY "Allow read for authenticated users" ON public.roles FOR SELECT USING (auth.uid() IS NOT NULL);

-- rooms
DROP POLICY IF EXISTS "Allow full access to own records" ON public.rooms;
CREATE POLICY "Allow full access to own records" ON public.rooms FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- royal_family_history
DROP POLICY IF EXISTS "Allow full access to own records" ON public.royal_family_history;
CREATE POLICY "Allow full access to own records" ON public.royal_family_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- royal_family_perks
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.royal_family_perks;
CREATE POLICY "Allow read for authenticated users" ON public.royal_family_perks FOR SELECT USING (auth.uid() IS NOT NULL);

-- royal_family_titles
DROP POLICY IF EXISTS "Allow full access to own records" ON public.royal_family_titles;
CREATE POLICY "Allow full access to own records" ON public.royal_family_titles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- scheduled_announcements
DROP POLICY IF EXISTS "Allow full access to own records" ON public.scheduled_announcements;
CREATE POLICY "Allow full access to own records" ON public.scheduled_announcements FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- secretary_assignments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.secretary_assignments;
CREATE POLICY "Allow full access to own records" ON public.secretary_assignments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- seller_reliability
DROP POLICY IF EXISTS "Allow full access to own records" ON public.seller_reliability;
CREATE POLICY "Allow full access to own records" ON public.seller_reliability FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- shadow_bans
DROP POLICY IF EXISTS "Allow full access to own records" ON public.shadow_bans;
CREATE POLICY "Allow full access to own records" ON public.shadow_bans FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- shifts
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.shifts;
CREATE POLICY "Allow read for authenticated users" ON public.shifts FOR SELECT USING (auth.uid() IS NOT NULL);

-- shop_partners
DROP POLICY IF EXISTS "Allow full access to own records" ON public.shop_partners;
CREATE POLICY "Allow full access to own records" ON public.shop_partners FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- shop_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.shop_transactions;
CREATE POLICY "Allow full access to own records" ON public.shop_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- shops
DROP POLICY IF EXISTS "Allow full access to own records" ON public.shops;
CREATE POLICY "Allow full access to own records" ON public.shops FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- special_gift_earnings
DROP POLICY IF EXISTS "Allow full access to own records" ON public.special_gift_earnings;
CREATE POLICY "Allow full access to own records" ON public.special_gift_earnings FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- square_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.square_events;
CREATE POLICY "Allow full access to own records" ON public.square_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- staff_applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.staff_applications;
CREATE POLICY "Allow full access to own records" ON public.staff_applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- staff_profiles
DROP POLICY IF EXISTS "Allow full access to own records" ON public.staff_profiles;
CREATE POLICY "Allow full access to own records" ON public.staff_profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- store_items
DROP POLICY IF EXISTS "Allow full access to own records" ON public.store_items;
CREATE POLICY "Allow full access to own records" ON public.store_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stores
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stores;
CREATE POLICY "Allow full access to own records" ON public.stores FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_discovery_prefs
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_discovery_prefs;
CREATE POLICY "Allow full access to own records" ON public.stream_discovery_prefs FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_entrances
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.stream_entrances;
CREATE POLICY "Allow read for authenticated users" ON public.stream_entrances FOR SELECT USING (auth.uid() IS NOT NULL);

-- stream_entries
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_entries;
CREATE POLICY "Allow full access to own records" ON public.stream_entries FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_events;
CREATE POLICY "Allow full access to own records" ON public.stream_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_join_requests
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_join_requests;
CREATE POLICY "Allow full access to own records" ON public.stream_join_requests FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_momentum
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_momentum;
CREATE POLICY "Allow full access to own records" ON public.stream_momentum FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_mute_counts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_mute_counts;
CREATE POLICY "Allow full access to own records" ON public.stream_mute_counts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_passwords
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_passwords;
CREATE POLICY "Allow full access to own records" ON public.stream_passwords FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_presets
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_presets;
CREATE POLICY "Allow full access to own records" ON public.stream_presets FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_ranking
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_ranking;
CREATE POLICY "Allow full access to own records" ON public.stream_ranking FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_reactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_reactions;
CREATE POLICY "Allow full access to own records" ON public.stream_reactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_sessions;
CREATE POLICY "Allow full access to own records" ON public.stream_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_snack_purchases
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_snack_purchases;
CREATE POLICY "Allow full access to own records" ON public.stream_snack_purchases FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- stream_vods
DROP POLICY IF EXISTS "Allow full access to own records" ON public.stream_vods;
CREATE POLICY "Allow full access to own records" ON public.stream_vods FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- system_alerts
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.system_alerts;
CREATE POLICY "Allow read for authenticated users" ON public.system_alerts FOR SELECT USING (auth.uid() IS NOT NULL);

-- system_settings
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.system_settings;
CREATE POLICY "Allow read for authenticated users" ON public.system_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- task_completions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.task_completions;
CREATE POLICY "Allow full access to own records" ON public.task_completions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- task_history
DROP POLICY IF EXISTS "Allow full access to own records" ON public.task_history;
CREATE POLICY "Allow full access to own records" ON public.task_history FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tax_report_status
DROP POLICY IF EXISTS "Allow full access to own records" ON public.tax_report_status;
CREATE POLICY "Allow full access to own records" ON public.tax_report_status FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ticket_messages
DROP POLICY IF EXISTS "Allow full access to own records" ON public.ticket_messages;
CREATE POLICY "Allow full access to own records" ON public.ticket_messages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- town_player_state
DROP POLICY IF EXISTS "Allow full access to own records" ON public.town_player_state;
CREATE POLICY "Allow full access to own records" ON public.town_player_state FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- training_scenarios
DROP POLICY IF EXISTS "Allow full access to own records" ON public.training_scenarios;
CREATE POLICY "Allow full access to own records" ON public.training_scenarios FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.transactions;
CREATE POLICY "Allow full access to own records" ON public.transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_ai_avatars
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_ai_avatars;
CREATE POLICY "Allow full access to own records" ON public.troll_ai_avatars FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_battle_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_battle_gifts;
CREATE POLICY "Allow full access to own records" ON public.troll_battle_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_battle_weekly_stats
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_battle_weekly_stats;
CREATE POLICY "Allow full access to own records" ON public.troll_battle_weekly_stats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_dna_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_dna_events;
CREATE POLICY "Allow full access to own records" ON public.troll_dna_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_dna_profiles
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_dna_profiles;
CREATE POLICY "Allow full access to own records" ON public.troll_dna_profiles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_dna_traits
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_dna_traits;
CREATE POLICY "Allow full access to own records" ON public.troll_dna_traits FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_drops_log
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_drops_log;
CREATE POLICY "Allow full access to own records" ON public.troll_drops_log FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_event_claims
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_event_claims;
CREATE POLICY "Allow full access to own records" ON public.troll_event_claims FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_events
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_events;
CREATE POLICY "Allow full access to own records" ON public.troll_events FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_family_members
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_family_members;
CREATE POLICY "Allow full access to own records" ON public.troll_family_members FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_family_memberships
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_family_memberships;
CREATE POLICY "Allow full access to own records" ON public.troll_family_memberships FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_family_messages
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_family_messages;
CREATE POLICY "Allow full access to own records" ON public.troll_family_messages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_family_wars
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_family_wars;
CREATE POLICY "Allow full access to own records" ON public.troll_family_wars FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_gift_items
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_gift_items;
CREATE POLICY "Allow full access to own records" ON public.troll_gift_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_officer_applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_officer_applications;
CREATE POLICY "Allow full access to own records" ON public.troll_officer_applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_officers
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_officers;
CREATE POLICY "Allow full access to own records" ON public.troll_officers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_post_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_post_gifts;
CREATE POLICY "Allow full access to own records" ON public.troll_post_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_post_views
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_post_views;
CREATE POLICY "Allow full access to own records" ON public.troll_post_views FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_stream_messages
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_stream_messages;
CREATE POLICY "Allow full access to own records" ON public.troll_stream_messages FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_streams
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_streams;
CREATE POLICY "Allow full access to own records" ON public.troll_streams FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_wall_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_wall_gifts;
CREATE POLICY "Allow full access to own records" ON public.troll_wall_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_wall_likes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_wall_likes;
CREATE POLICY "Allow full access to own records" ON public.troll_wall_likes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- troll_wall_reactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.troll_wall_reactions;
CREATE POLICY "Allow full access to own records" ON public.troll_wall_reactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Mai Troll_orders
DROP POLICY IF EXISTS "Allow full access to own records" ON public.Mai Troll_orders;
CREATE POLICY "Allow full access to own records" ON public.Mai Troll_orders FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Mai Troll_products
DROP POLICY IF EXISTS "Allow full access to own records" ON public.Mai Troll_products;
CREATE POLICY "Allow full access to own records" ON public.Mai Troll_products FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollmond_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trollmond_gifts;
CREATE POLICY "Allow full access to own records" ON public.trollmond_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollmond_ledger
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trollmond_ledger;
CREATE POLICY "Allow full access to own records" ON public.trollmond_ledger FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollmond_store_items
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trollmond_store_items;
CREATE POLICY "Allow full access to own records" ON public.trollmond_store_items FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollmonds_pools
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trollmonds_pools;
CREATE POLICY "Allow full access to own records" ON public.trollmonds_pools FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trolls_night_applications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trolls_night_applications;
CREATE POLICY "Allow full access to own records" ON public.trolls_night_applications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollstown_properties
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trollstown_properties;
CREATE POLICY "Allow full access to own records" ON public.trollstown_properties FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollstown_property_upgrades
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trollstown_property_upgrades;
CREATE POLICY "Allow full access to own records" ON public.trollstown_property_upgrades FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trollstown_upgrade_config
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.trollstown_upgrade_config;
CREATE POLICY "Allow read for authenticated users" ON public.trollstown_upgrade_config FOR SELECT USING (auth.uid() IS NOT NULL);

-- trolltract_contracts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trolltract_contracts;
CREATE POLICY "Allow full access to own records" ON public.trolltract_contracts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trolltract_weekly_rewards
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trolltract_weekly_rewards;
CREATE POLICY "Allow full access to own records" ON public.trolltract_weekly_rewards FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tromody_battles
DROP POLICY IF EXISTS "Allow full access to own records" ON public.tromody_battles;
CREATE POLICY "Allow full access to own records" ON public.tromody_battles FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tromody_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.tromody_gifts;
CREATE POLICY "Allow full access to own records" ON public.tromody_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tromody_matches
DROP POLICY IF EXISTS "Allow full access to own records" ON public.tromody_matches;
CREATE POLICY "Allow full access to own records" ON public.tromody_matches FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tromody_queue
DROP POLICY IF EXISTS "Allow full access to own records" ON public.tromody_queue;
CREATE POLICY "Allow full access to own records" ON public.tromody_queue FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- tromody_sessions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.tromody_sessions;
CREATE POLICY "Allow full access to own records" ON public.tromody_sessions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- trophies
DROP POLICY IF EXISTS "Allow full access to own records" ON public.trophies;
CREATE POLICY "Allow full access to own records" ON public.trophies FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- typing_statuses
DROP POLICY IF EXISTS "Allow full access to own records" ON public.typing_statuses;
CREATE POLICY "Allow full access to own records" ON public.typing_statuses FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_active_entrance_effect
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.user_active_entrance_effect;
CREATE POLICY "Allow read for authenticated users" ON public.user_active_entrance_effect FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_agreements
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_agreements;
CREATE POLICY "Allow full access to own records" ON public.user_agreements FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_badges_earned
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_badges_earned;
CREATE POLICY "Allow full access to own records" ON public.user_badges_earned FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_balances
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_balances;
CREATE POLICY "Allow full access to own records" ON public.user_balances FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_bans
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_bans;
CREATE POLICY "Allow full access to own records" ON public.user_bans FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_broadcast_theme_purchases
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.user_broadcast_theme_purchases;
CREATE POLICY "Allow read for authenticated users" ON public.user_broadcast_theme_purchases FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_broadcast_theme_state
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.user_broadcast_theme_state;
CREATE POLICY "Allow read for authenticated users" ON public.user_broadcast_theme_state FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_car_upgrades
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_car_upgrades;
CREATE POLICY "Allow full access to own records" ON public.user_car_upgrades FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_cars
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_cars;
CREATE POLICY "Allow full access to own records" ON public.user_cars FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_devices
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_devices;
CREATE POLICY "Allow full access to own records" ON public.user_devices FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_district_progress
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_district_progress;
CREATE POLICY "Allow full access to own records" ON public.user_district_progress FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_entrances
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.user_entrances;
CREATE POLICY "Allow read for authenticated users" ON public.user_entrances FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_garage
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_garage;
CREATE POLICY "Allow full access to own records" ON public.user_garage FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_insurance
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_insurance;
CREATE POLICY "Allow full access to own records" ON public.user_insurance FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_ip_tracking
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_ip_tracking;
CREATE POLICY "Allow full access to own records" ON public.user_ip_tracking FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_level_perks
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.user_level_perks;
CREATE POLICY "Allow read for authenticated users" ON public.user_level_perks FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_levels
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_levels;
CREATE POLICY "Allow full access to own records" ON public.user_levels FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_notifications
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_notifications;
CREATE POLICY "Allow full access to own records" ON public.user_notifications FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_payout_settings
DROP POLICY IF EXISTS "Allow read for authenticated users" ON public.user_payout_settings;
CREATE POLICY "Allow read for authenticated users" ON public.user_payout_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- user_risk_profile
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_risk_profile;
CREATE POLICY "Allow full access to own records" ON public.user_risk_profile FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_streamer_entitlements
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_streamer_entitlements;
CREATE POLICY "Allow full access to own records" ON public.user_streamer_entitlements FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_tax_info
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_tax_info;
CREATE POLICY "Allow full access to own records" ON public.user_tax_info FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_vouchers
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_vouchers;
CREATE POLICY "Allow full access to own records" ON public.user_vouchers FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- user_wallets
DROP POLICY IF EXISTS "Allow full access to own records" ON public.user_wallets;
CREATE POLICY "Allow full access to own records" ON public.user_wallets FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- users
DROP POLICY IF EXISTS "Allow full access to own records" ON public.users;
CREATE POLICY "Allow full access to own records" ON public.users FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- vehicle_bids
DROP POLICY IF EXISTS "Allow full access to own records" ON public.vehicle_bids;
CREATE POLICY "Allow full access to own records" ON public.vehicle_bids FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- vehicle_upgrades
DROP POLICY IF EXISTS "Allow full access to own records" ON public.vehicle_upgrades;
CREATE POLICY "Allow full access to own records" ON public.vehicle_upgrades FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- vendor_invoices
DROP POLICY IF EXISTS "Allow full access to own records" ON public.vendor_invoices;
CREATE POLICY "Allow full access to own records" ON public.vendor_invoices FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- verification_requests
DROP POLICY IF EXISTS "Allow full access to own records" ON public.verification_requests;
CREATE POLICY "Allow full access to own records" ON public.verification_requests FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- verification_transactions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.verification_transactions;
CREATE POLICY "Allow full access to own records" ON public.verification_transactions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- videos
DROP POLICY IF EXISTS "Allow full access to own records" ON public.videos;
CREATE POLICY "Allow full access to own records" ON public.videos FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- visa_redemptions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.visa_redemptions;
CREATE POLICY "Allow full access to own records" ON public.visa_redemptions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- wall_comments
DROP POLICY IF EXISTS "Allow full access to own records" ON public.wall_comments;
CREATE POLICY "Allow full access to own records" ON public.wall_comments FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- wall_gifts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.wall_gifts;
CREATE POLICY "Allow full access to own records" ON public.wall_gifts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- wall_likes
DROP POLICY IF EXISTS "Allow full access to own records" ON public.wall_likes;
CREATE POLICY "Allow full access to own records" ON public.wall_likes FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- wall_posts
DROP POLICY IF EXISTS "Allow full access to own records" ON public.wall_posts;
CREATE POLICY "Allow full access to own records" ON public.wall_posts FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- wallets
DROP POLICY IF EXISTS "Allow full access to own records" ON public.wallets;
CREATE POLICY "Allow full access to own records" ON public.wallets FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- war_results
DROP POLICY IF EXISTS "Allow full access to own records" ON public.war_results;
CREATE POLICY "Allow full access to own records" ON public.war_results FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- wars
DROP POLICY IF EXISTS "Allow full access to own records" ON public.wars;
CREATE POLICY "Allow full access to own records" ON public.wars FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- web_push_subscriptions
DROP POLICY IF EXISTS "Allow full access to own records" ON public.web_push_subscriptions;
CREATE POLICY "Allow full access to own records" ON public.web_push_subscriptions FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- weekly_officer_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.weekly_officer_reports;
CREATE POLICY "Allow full access to own records" ON public.weekly_officer_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- weekly_reports
DROP POLICY IF EXISTS "Allow full access to own records" ON public.weekly_reports;
CREATE POLICY "Allow full access to own records" ON public.weekly_reports FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- xp_ledger
DROP POLICY IF EXISTS "Allow full access to own records" ON public.xp_ledger;
CREATE POLICY "Allow full access to own records" ON public.xp_ledger FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);


-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
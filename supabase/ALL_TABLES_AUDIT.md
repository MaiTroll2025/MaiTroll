# Supabase Project - Complete Table Audit

**Project:** Mai Troll  
**Date:** 2026-06-10  
**Total Unique Tables:** ~500+

---

## Tables by Source File

### supabase/schema.sql
- user_payment_methods
- coin_transactions
- payouts
- trolls_night_applications
- trolls_night_guest_agreements

### supabase/seed.sql
(References only - no CREATE TABLE)
- user_profiles
- user_tax_info
- payout_requests
- streams
- action_logs

### supabase/troll_station.sql
- troll_station
- troll_station_songs
- troll_station_queue
- troll_station_sessions
- troll_station_hosts
- troll_station_cohosts
- troll_station_invitations
- troll_station_chat

### supabase/post_engagement_tables.sql
- troll_post_views
- troll_post_comments (referenced)
- troll_post_reactions (referenced)

### supabase/post_earnings_functions.sql
(References only - no CREATE TABLE)
- troll_post_views
- troll_post_comments
- troll_post_reactions
- troll_posts
- user_profiles

### supabase/sql/admin_setup.sql
- user_roles

### supabase/sql/fix_terms_agreement_source_of_truth.sql
(Modifies existing - no new tables)
- user_profiles
- user_agreements

### supabase/sql/protect_owner_admin.sql
(Trigger only - no new tables)
- user_profiles

### supabase/dump.sql
(Empty file)

### supabase/migrations/20230101000000_baseline.sql (400+ tables)
- payout_requests
- officer_shift_logs
- user_profiles
- system_settings
- streams
- officer_weekly_reports
- creator_applications
- officer_chat_messages
- court_sessions
- court_summons
- abuse_reports
- action_logs
- active_sessions
- activity_log
- activity_logs
- admin_adjustments
- admin_broadcasts
- admin_coin_pool
- admin_coin_revenue
- admin_flags
- admin_gift_totals
- admin_pool
- admin_tax_reviews
- admin_top_buyers
- user_agreements
- ai_action_logs
- app_settings
- app_updates
- applications
- badge_definitions
- balance_ledger
- stream_participants
- troll_battles
- battle_gifts
- battle_history
- battle_rewards
- battle_sessions
- blocked_users
- broadcast_background_themes
- broadcast_cycle_stats
- broadcast_seats
- broadcast_seat_bans
- broadcast_theme_events
- broadcast_tokens
- broadcaster_applications
- broadcaster_earnings
- broadcaster_metrics
- call_history
- call_minutes
- call_sessions
- call_sound_catalog
- call_transactions
- case_audit_logs
- case_evidence
- case_participants
- case_templates
- cashout_requests
- cashout_tiers
- city_districts
- city_events
- clan_rewards
- clan_vault
- coin_audit_log
- coin_ledger
- coin_packages
- coin_pool_contributions
- coin_purchases
- coin_reward_pool
- coin_transactions
- coinback_log
- config
- content
- conversation_members
- conversation_messages
- conversations
- court_ai_messages
- court_box_members
- court_cases
- court_docket
- court_rulings_archive
- court_schedules
- creator_migration_claims
- creators_over_600
- critical_alerts
- daily_giveaways
- daily_logins
- daily_rewards
- declined_transactions
- deed_transfers
- deeds
- district_announcements
- district_features
- earnings
- economy_abuse_flags
- empire_applications
- empire_partner_rewards
- empire_partners
- empire_referrals
- empire_rewards
- entrance_effect_catalog
- entrance_effects
- error_logs
- escalation_matrix
- escalation_reports
- event_participants
- executive_intake
- executive_reports
- families
- family_activity_log
- family_badges_earned
- family_boosts
- family_invites
- family_lounge_messages
- family_members
- family_seasons
- family_shop_items
- family_shop_purchases
- family_stats
- family_tasks
- family_tasks_new
- family_war_stats
- family_wars
- follows
- ghost_presence_logs
- gift_bonus_tracker
- gift_card_redemptions
- gift_cards
- gift_catalog
- gift_items
- gift_leaderboard_entries
- gift_leaderboards
- gifts
- gift_transactions
- gift_xp_stats
- giftcard_fulfillments
- gifts_owned
- group_chats
- hire_fire_actions
- hire_limits
- home_feature_cycles
- home_feature_spend
- honorary_family_members
- hr_employees
- hr_events
- hr_notes
- identity_reward_logs
- incidents
- insurance
- insurance_logs
- insurance_options
- insurance_packages
- insurance_plans
- interview_sessions
- inventory_items
- ip_bans
- job_applications
- kick_logs
- lucky_coin_events
- mai_appeals
- mai_incidents
- mai_overrides
- mai_timeline_events
- mai_user_memory
- marketplace_items
- message_receipts
- message_requests
- messages
- millionaire_hall_of_fame
- moderation_actions
- moderation_events
- moderation_fee_settings
- moderation_notes
- moderation_reports
- notifications
- observer_ratings
- officer_actions
- officer_activity
- officer_applications
- officer_availability
- officer_badges
- officer_chat
- officer_earnings
- officer_hours
- officer_live_assignments
- officer_logs
- officer_mission_logs
- officer_orientation_results
- officer_orientations
- officer_payouts
- officer_performance
- officer_quiz_attempts
- officer_quiz_questions
- officer_quiz_results
- officer_shift_slots
- officer_shifts
- officer_stream_logs
- officer_strikes
- officer_training_sessions
- officer_work_sessions
- onboarding_events
- onboarding_progress
- owc_transactions
- payment_fees
- payment_holds
- payment_logs
- payment_methods
- payment_transactions
- payout_audit_log
- payout_reviews
- payout_settings
- payouts
- perk_catalog
- perks
- platform_fees
- platform_profit
- platform_revenue
- platform_wallet
- post_gifts
- posts
- profiles
- promo_code_uses
- promo_codes
- properties
- property_upgrades
- provider_costs
- punishment_transactions
- punishments
- referral_claims
- referral_monthly_bonus
- referrals
- report_cases
- reputation_events
- revenue_ledger
- revenue_settings
- risk_events
- role_change_log
- role_privileges
- roles
- rooms
- royal_family_history
- royal_family_perks
- royal_family_titles
- scheduled_announcements
- secretary_assignments
- security_events
- seller_reliability
- shadow_bans
- shifts
- shop_items
- shop_partners
- shop_transactions
- shops
- special_gift_earnings
- square_events
- staff_applications
- staff_profiles
- store_items
- stores
- stream_discovery_prefs
- stream_entrances
- stream_entries
- stream_events
- stream_gifts
- stream_join_requests
- stream_likes
- stream_messages
- stream_momentum
- stream_mute_counts
- stream_passwords
- stream_presets
- stream_ranking
- stream_reactions
- stream_reports
- stream_sessions
- stream_snack_purchases
- stream_viewers
- stream_vods
- streams_participants
- support_tickets
- system_alerts
- system_errors
- task_completions
- task_history
- task_templates
- tax_report_status
- ticket_messages
- training_scenarios
- transactions
- troll_ai_avatars
- troll_battle_gifts
- troll_court_cases
- troll_dna_events
- troll_dna_profiles
- troll_dna_traits
- troll_drops
- troll_drops_log
- troll_event_claims
- troll_events
- troll_families
- troll_family_members
- troll_family_memberships
- troll_family_messages
- troll_family_wars
- troll_gift_items
- troll_officer_applications
- troll_officers
- troll_post_comments
- troll_post_gifts
- troll_post_reactions
- troll_post_views
- troll_posts
- troll_stream_messages
- troll_streams
- troll_wall_gifts
- troll_wall_likes
- troll_wall_posts
- troll_wall_reactions
- Mai Troll_orders
- Mai Troll_products
- Mai Troll_shops
- trollmond_gifts
- trollmond_ledger
- trollmond_store_items
- trollmond_transactions
- trollmonds_pools
- trolls_night_applications
- trollstown_properties
- trollstown_property_upgrades
- trollstown_upgrade_config
- trolltract_contracts
- trolltract_weekly_rewards
- tromody_battles
- tromody_gifts
- tromody_matches
- tromody_queue
- tromody_sessions
- trophies
- typing_statuses
- user_active_entrance_effect
- user_active_items
- user_badges_earned
- user_balances
- user_bans
- user_boosts
- user_broadcast_theme_purchases
- user_broadcast_theme_state
- user_call_sounds
- user_devices
- user_district_progress
- user_entrance_effects
- user_entrances
- user_follows
- user_insurance
- user_insurances
- user_inventory
- user_ip_tracking
- user_levels
- user_notifications
- user_payment_methods
- user_payout_settings
- user_perks
- user_reputation
- user_risk_profile
- user_roles
- user_streamer_entitlements
- user_tax_info
- user_wallets
- users
- vendor_invoices
- verification_requests
- verification_transactions
- videos
- visa_redemptions
- wall_posts
- war_results
- wars
- web_push_subscriptions
- weekly_officer_reports
- weekly_reports
- wheel_spins
- xp_ledger

### supabase/migrations/20240101_xp_system.sql
- user_stats
- xp_ledger

### supabase/migrations/20240415000001_create_support_tickets.sql
- support_tickets

### supabase/migrations/20240523000000_mobile_error_logs.sql
- mobile_error_logs

### supabase/migrations/20240524000000_rls_performance_optimization.sql
- user_auth_cache

### supabase/migrations/20250201100000_universe_event_tables.sql
- tournaments
- tournament_participants

### supabase/migrations/20250202100000_broadcast_overhaul.sql
- streams
- stream_messages

### supabase/migrations/20250202110000_paid_features.sql
- gifts
- stream_gifts

### supabase/migrations/20250202120000_moderation.sql
- stream_moderators
- stream_bans
- stream_mutes

### supabase/migrations/20250202130000_battles.sql
- battles

### supabase/migrations/20250204_soft_delete_messages.sql
- conversations
- conversation_members
- conversation_messages

### supabase/migrations/20250425000000_saved_streams.sql
- saved_streams

### supabase/migrations/20250425000001_troll_court_evidence.sql
- troll_court_evidence

### supabase/migrations/20260115001000_stripe_coin_purchases.sql
- wallets
- coin_orders
- stripe_customers

### supabase/migrations/20260117100000_car_property_insurance.sql
- car_insurance_policies
- property_insurance_policies

### supabase/migrations/20260118093000_trollg.sql
- trollg_applications
- user_gifts
- gift_votes
- gift_sends
- coin_ledger
- admin_pool_ledger
- vote_events
- user_event_dismissals

### supabase/migrations/20260118230000_user_cars_properties.sql
- user_cars

### supabase/migrations/20260119100000_officer_time_off.sql
- officer_time_off_requests

### supabase/migrations/20260120000000_troll_bank_init.sql
- coin_ledger
- loans
- loan_applications
- bank_tiers
- bank_audit_log

### supabase/migrations/20260120000001_bank_feature_flags.sql
- bank_feature_flags

### supabase/migrations/20260120000250_fix_troll_wall_gifts.sql
- troll_wall_gifts

### supabase/migrations/20260121002000_automate_family_tasks.sql
- family_tasks

### supabase/migrations/20260128154000_create_loan_credit_tables.sql
- loans
- loan_payments
- credit_scores
- credit_reports

### supabase/migrations/20260203000002_gift_observability.sql
- gift_batch_logs

### supabase/migrations/20260203000004_fix_gift_schema.sql
- gift_ledger
- broadcaster_stats

### supabase/migrations/20260203202500_apply_tmv_rebuild.sql
- vehicles_catalog
- user_vehicles
- vehicle_titles
- vehicle_registrations
- vehicle_insurance_policies
- vehicle_loans
- vehicle_transactions
- tmv_fee_schedule
- tmv_actions
- user_driver_licenses
- vehicle_listings

### supabase/migrations/20260203210000_unified_loans_and_licenses.sql
- vehicle_loans

### supabase/migrations/20260203215000_universal_rls_system.sql
- system_roles
- user_role_grants
- audit_log

### supabase/migrations/20260203220000_fix_president_proposals.sql
- president_proposals
- president_audit_logs
- president_announcements

### supabase/migrations/20260203233000_add_government_sector.sql
- districts

### supabase/migrations/20260204000000_active_asset_economy.sql
- houses_catalog
- user_houses
- house_upgrades
- user_house_upgrades
- house_rentals
- cars_catalog
- car_upgrades
- user_car_upgrades
- asset_auctions
- auction_bids

### supabase/migrations/20260204000000_mobile_error_logging.sql
- mobile_errors

### supabase/migrations/20260220000000_comprehensive_gifts_system.sql
- gifts

### supabase/migrations/20260225000000_create_mai_talent_queue.sql
- mai_talent_queue

### supabase/migrations/20260225000001_create_mai_talent_shows.sql
- mai_talent_shows

### supabase/migrations/20260225000007_create_mai_talent_v2_tables.sql
- mai_show_sessions
- mai_stage_slots
- mai_queue
- mai_performance_timer

### supabase/migrations/20260226000001_create_global_gift_system.sql
- gifts_catalog
- gift_transactions

### supabase/migrations/20260227000001_create_giveaway_system.sql
- giveaways
- giveaway_entries
- discount_codes
- user_rewards

### supabase/migrations/20260317000000_family_communication_hub.sql
- family_chat_messages
- family_calls
- family_call_members

### supabase/migrations/20260322000000_create_rtc_sessions_table.sql
- rtc_sessions

### supabase/migrations/20260331000001_next_gen_live_streaming_system.sql
- mission_templates
- stream_missions
- user_mission_progress
- profile_frame_tiers
- diamond_avatar_tiers
- diamond_special_styles
- user_entrance_audio
- voice_announcement_styles
- audio_queue
- broadcast_audio_settings
- stream_fan_tiers
- stream_energy_meter
- stream_awards
- fan_memory
- fan_contracts
- broadcast_command_modules
- stream_goals
- stream_milestones
- stream_polls
- user_badge_progress

### supabase/migrations/20260410000000_troll_us_game_system.sql
- games
- game_players
- game_votes
- account_deletion_reasons

### supabase/migrations/20260410000000_x_ads_system.sql
- connected_social_accounts
- source_content_refs
- ad_generation_jobs
- ad_assets
- ad_videos
- caption_variants
- social_publish_queue
- social_publish_logs
- ad_analytics

### supabase/migrations/20260411000000_stream_moderation_and_court_tables.sql
- chat_blocks
- stream_kicks
- court_dockets
- broadcast_restrictions

### supabase/migrations/20260411000000_troll_us_game.sql
- games
- game_players
- game_votes

### supabase/migrations/20260423000000_create_missing_tables.sql
- stream_settings
- tcps_messages

### supabase/migrations/20260423000001_migrate_conversation_messages.sql
- tcps_messages

### supabase/migrations/20260427000000_universe_mode_troll_battle.sql
- troll_battle_participants

### supabase/migrations/20260429000000_create_app_bug_reports.sql
- app_bug_reports

### supabase/migrations/20260501000002_troll_games_system.sql
- game_matches

### supabase/migrations/20260506000000_add_subscription_system.sql
- subscription_tiers
- user_subscriptions
- subscription_revenue_log

### supabase/migrations/20260520000000_payout_methods_and_raid_logs.sql
- house_raid_logs
- house_repair_logs

### supabase/migrations/20260521000000_small_installment_purchases.sql
- small_installment_purchases
- installment_milestone_events

### supabase/migrations/20260524000001_update_stream_seats_and_create_audience_presence.sql
- stream_audience_presence

### supabase/migrations/20260526000000_add_agency_enforcement_system.sql
- agency_enforcement_actions
- agency_feature_flags

### supabase/migrations/20260526000001_troll_family_leagues_system.sql
- troll_family_activity_events
- troll_family_league_seasons
- troll_family_league_standings

### supabase/migrations/20260527202922_security_command_center.sql
- security_events
- security_user_risk_scores
- security_rate_limits
- security_admin_audit_log
- security_incident_reports
- security_ip_reputation

### supabase/migrations/20260530000000_church_live_and_mod.sql
- church_live_sessions
- church_prayer_replies
- church_mod_actions
- church_banned_users

### supabase/migrations/20260604000000_create_admin_reports_tables.sql
- admin_reports
- agency_admin_reports

### supabase/migrations/20260605000000_ghost_stream_sessions.sql
- ghost_stream_sessions

### supabase/migrations/20260606000000_admin_pool.sql
- admin_pool_transactions

### supabase/migrations/20260607000001_telemetry_events.sql
- telemetry_events

### supabase/migrations/20260608000000_hytro_gaming_agency_system.sql
- agency_applications
- agency_members
- agency_point_transactions
- agency_weekly_stats
- agency_rewards
- agency_audit_log
- agency_settings

### supabase/migrations/20260608000000_live_broadcast_updates.sql
- stream_guests

### supabase/migrations/20260608000000_page_visibility.sql
- page_visibility

### supabase/migrations/20260609000000_verified_badge_subscription.sql
- verification_subscriptions

### supabase/migrations/20260609000001_notary_document_system.sql
- document_types
- documents
- document_versions
- document_signatures
- document_approvals
- document_stamps
- document_audit_logs
- document_access

### supabase/migrations/20260609000001_officer_of_week_voting.sql
- officer_vote_cycles
- officer_votes
- officer_assignments

### supabase/migrations/20260609000002_calendar_event_system.sql
- event_categories
- events
- event_participants
- event_notifications
- event_access_rules
- event_invites

### supabase/migrations/20260610000000_create_stream_sessions.sql
- agora_stream_sessions

### supabase/migrations/20260611000000_create_shareathon_system.sql (2029)
- shareathon_events
- shareathon_eligible_broadcasters
- shareathon_submissions
- shareathon_stream_sessions
- shareathon_battles
- shareathon_verification_log

### supabase/migrations/20260611000000_utromail_tromail_system.sql
- utromail_accounts
- tromail_role_accounts
- utromail_threads
- utromail_thread_members
- utromail_messages
- utromail_read_status
- utromail_attachments
- utromail_blocks
- utromail_requests
- utromail_delivery_log
- utromail_reports
- utromail_notifications

### supabase/migrations/20260615000000_academy_phase2_completion.sql (2029)
- academy_notifications
- academy_discussions
- academy_messages
- academy_teacher_credentials
- academy_teacher_payouts
- academy_loan_payments
- academy_accreditation_orgs
- academy_accreditation_requests
- academy_completion_log
- academy_course_reviews
- academy_settings
- academy_pathway_enrollments

### supabase/migrations/20260617000000_vehicle_asset_system_complete.sql
- vehicle_catalog
- user_vehicle_assets
- vehicle_transactions

### supabase/migrations/20270101000000_add_capacity_queue_system.sql
- stream_capacity_queue

### supabase/migrations/20270120000900_admin_pool_allocations.sql
- admin_pool_buckets
- admin_app_settings

### supabase/migrations/20270201000000_trollifieds_system.sql
- marketplace_items
- vehicle_listings
- marketplace_conversations
- marketplace_messages
- listing_flags
- business_profiles
- service_listings
- service_bookings
- service_reviews
- broadcast_pinned_services

### supabase/migrations/20270202100000_create_paypal_transactions.sql
- paypal_transactions

### supabase/migrations/20270203000000_seller_tiers_reviews_appeals.sql
- marketplace_reviews

### supabase/migrations/20270203000000_tmv_system.sql
- gas_requests

### supabase/migrations/20270205000000_troll_church.sql
- church_passages
- church_prayers
- church_prayer_likes
- church_sermon_notes

### supabase/migrations/20270212000000_add_purchase_system.sql
- user_purchases
- user_active_items
- user_avatar_customization
- troll_mart_clothing
- user_troll_mart_purchases

### supabase/migrations/20270215000000_remove_gamerz_add_pods.sql
- pod_rooms
- pod_room_participants
- pod_episodes

### supabase/migrations/20270217000000_add_nested_comments.sql
- troll_post_gifts

### supabase/migrations/20270302000000_tmv_rebuild.sql
- vehicles_catalog
- user_vehicles
- vehicle_titles
- vehicle_registrations
- vehicle_insurance_policies
- vehicle_transactions
- tmv_fee_schedule
- tmv_actions
- user_driver_licenses
- vehicle_listings

### supabase/migrations/20270303000000_tmv_upgrades_and_fixes.sql
- user_vehicle_upgrades

### supabase/migrations/20270303000001_add_user_like_tracking.sql
- user_stream_likes

### supabase/migrations/20270303000004_create_car_upgrades.sql
- car_upgrades
- user_vehicle_upgrades

### supabase/migrations/20270304000000_battle_crown_streak_system.sql
- battle_events

### supabase/migrations/20270304000001_dual_path_streaming.sql
- stream_seat_sessions
- court_cases

### supabase/migrations/20270310000000_repossession_system.sql
- loan_default_summons

### supabase/migrations/20270310000005_trollmonds_system.sql
- trollmond_transactions
- trollmond_config

### supabase/migrations/20270320000000_day_one_features.sql
- guest_tracking
- guest_stream_sessions
- broadcast_overrides

### supabase/migrations/20270330000000_broadcast_abilities.sql
- user_abilities
- broadcast_active_effects
- broadcast_ability_logs
- coin_drop_events
- coin_drop_collections
- daily_free_spins

### supabase/migrations/20270330010000_zip_governance_system.sql
- zip_codes
- officer_performance
- officer_corruption_flags
- zip_crime_events

### supabase/migrations/20270330020000_officer_salary_model.sql
- officer_payroll_logs

### supabase/migrations/20270402000000_housing_lease_critical_fixes.sql
- invoices

### supabase/migrations/20270408001500_advertisement_system.sql
- user_advertisements

### supabase/migrations/20270411000000_ktauto_dealership_inventory.sql
- dealership_inventory
- dealership_vehicle_pool

### supabase/migrations/20270417000000_add_paid_chat_settings.sql
- paid_chat_access
- paid_chat_payments

### supabase/migrations/20270427000000_universe_mode_troll_battle.sql
- troll_battle_participants

### supabase/migrations/20270501000002_troll_games_system.sql
- game_matches

### supabase/migrations/20270521000000_small_installment_purchases.sql
- small_installment_purchases
- installment_milestone_events

### supabase/migrations/20270524000001_update_stream_seats_and_create_audience_presence.sql
- stream_audience_presence

### supabase/migrations/20270526000000_add_agency_enforcement_system.sql
- agency_enforcement_actions
- agency_feature_flags

### supabase/migrations/20270601000000_realistic_credit_card_overhaul.sql
- credit_card_transactions
- credit_card_billing_cycles

### supabase/migrations/20270801000000_comprehensive_fixes.sql
- broadcast_officers
- pod_rooms

### supabase/migrations/20270805000000_create_bug_alerts.sql
- bug_alerts

### supabase/migrations/20270807000001_create_neighbors_tables.sql
- neighbors_events
- neighbors_participants
- neighbors_businesses

### supabase/migrations/20270809000000_create_featured_broadcast_system.sql
- featured_broadcasts
- broadcast_rankings
- weekly_top_broadcasters

### supabase/migrations/20270901000040_create_global_events.sql
- global_events

### supabase/migrations/20270922000002_create_global_events_table.sql
- global_events

### supabase/migrations/20270925000000_neighbors_approval_system.sql
- user_content_approvals
- business_reports
- neighbor_event_badges

### supabase/migrations/20271001000000_troll_wheel_features.sql
- wheel_inventory
- wheel_sessions

### supabase/migrations/20271015000000_troll_city_government_system.sql
- government_laws
- law_votes
- bribe_logs
- protests
- protest_participants
- emergency_powers_log
- government_reputation
- city_reputation
- government_history

### supabase/migrations/20271027000000_create_stream_viewers_and_bans.sql
- stream_viewers
- stream_bans

### supabase/migrations/20271027000001_create_stream_likes.sql
- stream_likes

### supabase/migrations/20280315000000_create_league_system.sql
- league_events
- stream_league_scores
- league_notifications

### supabase/migrations/20280430000004_bug_center_and_admin_finance.sql
- app_bug_reports

### supabase/migrations/20280430000005_organization_management_hub.sql
- organization_members
- organization_messages
- organization_files
- organization_announcements
- organization_audit_logs

### supabase/migrations/20280526000001_troll_city_treasury_system.sql
- troll_city_treasury
- treasury_transactions
- treasury_role_allocations
- treasury_payout_runs
- treasury_payout_items

### supabase/migrations/20290101000000_create_organizations_tables.sql
- organizations
- organization_admins
- organization_students

### supabase/migrations/20290101000002_create_mai_class_system.sql
- mai_classes
- mai_class_enrollments

### supabase/migrations/20290516000000_league_system_expansion.sql
- league_points
- league_leaderboard_snapshots
- user_league_missions
- league_event_templates
- mission_templates

### supabase/migrations/20290519000000_hype_coins_system.sql
- hype_coin_ledger

### supabase/migrations/20290520000000_troll_city_level_reward_engine.sql
- level_rewards
- user_level_reward_claims
- user_inventory_items
- user_achievement_events
- level_engine_runs

### supabase/migrations/20290526000000_add_paid_agency_application_and_family_conversion.sql
- agency_platform_settings
- agency_billing_events

### supabase/migrations/20290527000000_create_tromail_tables.sql
- tromail_accounts
- tromail_messages
- tromail_recipients
- tromail_calendar_events
- tromail_calendar_event_recipients

### supabase/migrations/20290527100000_create_universal_earnings_system.sql
- user_earning_events
- role_earning_rules

### supabase/migrations/20290528000000_weekly_role_perk_system.sql
- role_perk_settings
- role_perk_claims

### supabase/migrations/20290531000000_broadcast_league_system.sql
- broadcast_league_stats

### supabase/migrations/20290531000001_customer_service_system.sql
- customer_service_audit_logs
- admin_password_resets
- user_presence_routes
- support_screen_sessions

### supabase/migrations/20290601000000_ensure_church_prayer_replies.sql
- church_prayer_replies

### supabase/migrations/20290601000000_user_created_leagues.sql
- user_leagues
- user_league_members
- user_league_missions

### supabase/migrations/20290606000000_economy_safety_pass.sql
- platform_economy_settings
- cashout_bonus_grants
- platform_reward_pool

### supabase/migrations/20290607000000_pride_month_system.sql
- pride_challenges
- pride_user_progress
- pride_keyword_config
- pride_credit_xp_log

### supabase/migrations/vehicle_asset_system_schema.sql
- vehicle_catalog

### supabase/migrations/add_bribe_logs_foreign_keys.sql
(No new tables - adds FK constraints to bribe_logs)

### supabase/migrations/add_broadcast_category_columns.sql
(No new tables - alters streams)

### supabase/migrations/add_premium_features.sql
(No new tables - alters marketplace_items, vehicle_listings, service_listings)

### supabase/migrations/CONSOLIDATED_GIVEAWAY_FIX.sql
(No new tables)

### supabase/migrations/END_ALL_BROADCASTS.sql
(No new tables)

### supabase/migrations/remove_coin_exemptions.sql
(No new tables)

### supabase/migrations/summon_user_to_court_fix.sql
(No new tables)

### supabase/migrations/vehicle_asset_system_rpcs.sql
(No new tables)

---

## Summary Statistics

| Source File | New Tables |
|---|---|
| schema.sql | 5 |
| troll_station.sql | 8 |
| post_engagement_tables.sql | 1 |
| sql/admin_setup.sql | 1 |
| migrations/20230101000000_baseline.sql | ~400 |
| Other migration files (2024-2029) | ~150 |
| **Total Unique Tables** | **~500+** |

---

## Notes

- The `baseline.sql` file is the primary schema definition containing ~400 tables
- Many later migration files add new tables or alter existing ones
- Some table names appear in multiple files (e.g., `gifts`, `streams`, `coin_ledger`) - these are typically altered or re-created with `IF NOT EXISTS`
- The project covers a massive feature set including: streaming, battles, families, marketplace, banking, court/justice, government, education (academy), mail systems (tromail/utromail), gaming, real estate, vehicles, and more
- `dump.sql` is empty
- `seed.sql` contains test data inserts only (no CREATE TABLE)

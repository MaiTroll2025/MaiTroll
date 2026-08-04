# DATABASE AUDIT 2026 — Mai Troll

**Date:** 2026-06-10  
**Scope:** Full database schema audit — tables, functions, migrations, RLS policies  
**Sources scanned:** `src/`, `supabase/functions/`, `supabase/migrations/`, `supabase/schema.sql`, `supabase/troll_station.sql`, `supabase/post_earnings_functions.sql`, `supabase/post_engagement_tables.sql`, `supabase/sql/`, `supabase/policies/`

---

## 1. TABLES

### 1.1 Used by Frontend (`src/`)

197 unique tables referenced via `.from('...')` in the frontend:

| # | Table |
|---|---|
| 1 | ability_box_status |
| 2 | academy_accreditation_orgs |
| 3 | academy_accreditation_requests |
| 4 | academy_admissions_applications |
| 5 | academy_admissions_log |
| 6 | academy_announcements |
| 7 | academy_assignments |
| 8 | academy_attendance |
| 9 | academy_categories |
| 10 | academy_certificates |
| 11 | academy_classrooms |
| 12 | academy_coin_rewards |
| 13 | academy_courses |
| 14 | academy_discussions |
| 15 | academy_enrollments |
| 16 | academy_grades |
| 17 | academy_learning_pathways |
| 18 | academy_loan_payments |
| 19 | academy_materials |
| 20 | academy_pathway_enrollments |
| 21 | academy_quiz_attempts |
| 22 | academy_quiz_questions |
| 23 | academy_quizzes |
| 24 | academy_sessions |
| 25 | academy_student_ids |
| 26 | academy_submissions |
| 27 | academy_teacher_applications |
| 28 | academy_teacher_credentials |
| 29 | academy_teacher_payouts |
| 30 | academy_teacher_ratings |
| 31 | academy_teachers |
| 32 | academy_waitlists |
| 33 | active_sessions |
| 34 | active_safety_alerts_view |
| 35 | ad-assets |
| 36 | admin_app_settings |
| 37 | admin_broadcasts |
| 38 | admin_finance_feed |
| 39 | admin_finance_summary |
| 40 | admin_password_resets |
| 41 | admin_reports |
| 42 | admin_settings |
| 43 | admin_tip_analytics |
| 44 | admin_for_week_queue |
| 45 | agency_activity_logs |
| 46 | agency_admin_reports |
| 47 | agency_applications |
| 48 | agency_audit_log |
| 49 | agency_contracts |
| 50 | agency_goals |
| 51 | agency_invites |
| 52 | agency_members |
| 53 | agency_point_transactions |
| 54 | agency_rewards |
| 55 | agency_settings |
| 56 | agency_weekly_stats |
| 57 | agencies |
| 58 | app_bug_reports |
| 59 | app_settings |
| 60 | artist_followers |
| 61 | artist_profiles |
| 62 | auction_lots |
| 63 | auction_shows |
| 64 | audit_logs |
| 65 | battles |
| 66 | battle_participants |
| 67 | battle_sessions |
| 68 | broadcast_ability_logs |
| 69 | broadcast_active_effects |
| 70 | broadcast_pinned_products |
| 71 | bug_alerts |
| 72 | call_history |
| 73 | call_minutes |
| 74 | call_rooms |
| 75 | car_upgrades |
| 76 | cashout_requests |
| 77 | chat_blocks |
| 78 | church_live_sessions |
| 79 | church_prayers |
| 80 | church_sermon_notes |
| 81 | city_reputation |
| 82 | coin_audit_log |
| 83 | coin_transactions |
| 84 | contract_audit_events |
| 85 | conversation_members |
| 86 | conversation_messages |
| 87 | conversations |
| 88 | court_ai_feedback |
| 89 | court_ai_messages |
| 90 | court_cases |
| 91 | court_docket |
| 92 | court_dockets |
| 93 | court_events |
| 94 | court_participants |
| 95 | court_session_state |
| 96 | court_sessions |
| 97 | creator_applications |
| 98 | creator_earnings |
| 99 | creator_goal_boost |
| 100 | creator_profiles |
| 101 | critical_alerts |
| 102 | customer_service_audit_logs |
| 103 | daily_rewards |
| 104 | direct_messages |
| 105 | document_approvals |
| 106 | document_audit_logs |
| 107 | document_signatures |
| 108 | document_stamps |
| 109 | document_types |
| 110 | documents |
| 111 | driver_tests |
| 112 | emergency_alerts |
| 113 | emergency_powers_log |
| 114 | entrance_effects |
| 115 | families |
| 116 | family_achievements_new |
| 117 | family_activity_log |
| 118 | family_boosts |
| 119 | family_earnings_pool |
| 120 | family_goal_progress |
| 121 | family_goals |
| 122 | family_level_unlocks |
| 123 | family_member_earnings |
| 124 | family_members |
| 125 | family_payout_records |
| 126 | family_seasons |
| 127 | family_stats |
| 128 | family_stats_enhanced |
| 129 | family_war_scores |
| 130 | family_wars |
| 131 | featured_broadcasts |
| 132 | gift_items |
| 133 | global_events |
| 134 | government_history |
| 135 | government_laws |
| 136 | hidden_achievements |
| 137 | homeowners_insurances |
| 138 | house_installations |
| 139 | house_upgrades_catalog |
| 140 | insurance_options |
| 141 | jail |
| 142 | jail_ip_violations |
| 143 | jail_security_violations |
| 144 | law_votes |
| 145 | league_events |
| 146 | league_leaderboard_snapshots |
| 147 | live_stream_monitor |
| 148 | marketplace_purchases |
| 149 | moderation_actions |
| 150 | notifications |
| 151 | officer_members |
| 152 | organization_documents |
| 153 | organization_files |
| 154 | organization_messages |
| 155 | organizations |
| 156 | organization_members |
| 157 | outbound_clicks |
| 158 | page_visibility |
| 159 | payment_methods |
| 160 | payout_requests |
| 161 | perks |
| 162 | pod_rooms |
| 163 | podcast_rtc_logs |
| 164 | president_appointments |
| 165 | president_candidates |
| 166 | president_elections |
| 167 | president_proposals |
| 168 | president_treasury_balance |
| 169 | president_votes |
| 170 | pride_challenges |
| 171 | pride_user_progress |
| 172 | protest_participants |
| 173 | protests |
| 174 | purchasable_items |
| 175 | role_requests |
| 176 | saved_streams |
| 177 | security_events |
| 178 | security_incident_reports |
| 179 | security_rate_limits |
| 180 | security_user_risk_scores |
| 181 | secretary_assignments |
| 182 | shareathon_eligible_broadcasters |
| 183 | shareathon_events |
| 184 | shareathon_submissions |
| 185 | shareathon_verification_log |
| 186 | shop_items |
| 187 | shop_orders |
| 188 | sidebar_updates |
| 189 | signup_queue |
| 190 | small_installment_purchases |
| 191 | staff_meeting_attendance |
| 192 | streamer_applications |
| 193 | troll_family_league_seasons |
| 194 | troll_family_league_standings |
| 195 | troll_wall_posts |
| 196 | user_profiles |
| 197 | user_reports |

### 1.2 Used by RPCs (called from `src/`)

227 unique RPC functions called via `.rpc('...')` in the frontend:

`accept_agency_invite`, `accept_battle`, `activate_random_battle`, `activate_wheel_inventory_item`, `add_ability_to_inventory`, `add_ad_to_queue`, `add_agency_points`, `add_coins`, `add_family_earnings`, `add_troll_coins`, `add_trollopoly_spectator`, `adjust_agency_points`, `admin_assign_zip_officers`, `admin_create_vehicle`, `admin_delete_vehicle`, `admin_get_vehicle_stats`, `admin_grant_coins`, `admin_open_cashout_request`, `admin_process_cashout_request`, `admin_set_officer_rank`, `admin_suspend_officer`, `admin_update_user_role`, `admin_verify_gift_eligibility`, `admin_verify_vehicle`, `aggregate_stream_analytics`, `apply_for_agency_from_family`, `apply_for_agency_with_fee`, `apply_vehicle_upgrade`, `approve_ad`, `approve_agency_application_atomic`, `approve_attorney_application`, `approve_document`, `approve_empire_partner`, `approve_family_agency_conversion`, `approve_president_candidate`, `approve_prosecutor_application`, `approve_seat_request`, `approve_visa_redemption`, `arrest_user`, `assistant_forward_payout_batch`, `assistant_review_user_coins`, `assign_broadofficer`, `assign_document`, `auto_start_court_session`, `auto_start_court_with_docket`, `auto_unlock_payouts`, `award_family_xp`, `award_game_coins`, `award_league_points`, `ban_officer`, `ban_user`, `ban_user_from_stream`, `buy_live_snack`, `buy_property_with_loan`, `calculate_agency_tier`, `can_access_staff_meeting`, `can_send_utromail`, `cancel_battle_challenge`, `cancel_event_registration`, `cancel_trollmers_tournament`, `captain_click_battle`, `check_creator_weekly_eligibility`, `check_daily_login`, `check_emergency_cooldown`, `check_family_rate_limit`, `check_game_cooldown`, `check_influencer_eligibility`, `check_trade_cooldown`, `check_trollmin_daily_limit`, `claim_giveaway_reward`, `claim_user_league_mission`, `cleanup_expired_user_purchases`, `clock_in_from_slot`, `clock_out_and_complete_slot`, `complete_family_goal`, `convert_trollz_to_coins`, `create_agency_invite`, `create_auction_lot`, `create_auction_show`, `create_battle_challenge`, `create_city_event`, `create_document`, `create_event`, `create_family_invite`, `create_family_tasks`, `create_game_match`, `create_marketplace_appeal`, `create_marketplace_listing`, `create_marketplace_review`, `create_notification`, `create_order_with_escrow`, `create_president_election`, `create_president_proposal`, `create_subscription`, `create_safety_alert`, `create_system_league_event`, `create_troll_family`, `create_troll_us_game`, `create_user_league`, `crypt_password`, `deduct_call_minutes`, `deduct_coins`, `deduct_troll_coins`, `delete_own_account`, `deny_ad`, `deny_application`, `deny_attorney_application`, `deny_document`, `deny_prosecutor_application`, `deny_seat_request`, `deposit_to_cashout_escrow`, `disable_payout_window`, `distribute_battle_winnings`, `distribute_prize`, `distribute_weekly_earnings`, `earn_coins`, `earn_hype_coin_watch_reward`, `enable_payout_window`, `end_battle`, `end_battle_guarded`, `end_battle_with_rewards`, `end_court_session`, `end_pod`, `end_troll_us_round`, `end_trial_early`, `enter_giveaway`, `ensure_league_system_ready`, `escalate_to_admin`, `escalate_to_officer`, `escalate_to_troll_court`, `evaluate_seller_tier`, `evict_tenant`, `execute_buy_order`, `execute_sell_order`, `expose_bribe`, `extend_court_date`, `file_civil_lawsuit`, `file_impeachment_case`, `finalize_president_election`, `find_5v5_match`, `find_match_candidate`, `find_random_battle_match`, `find_shared_conversation`, `find_utromail_thread`, `finish_random_battle`, `forfeit_random_battle`, `forward_payout_to_admin`, `fulfill_marketplace_order`, `fulfill_visa_redemption`, `generate_family_goals`, `generate_user_league_missions`, `generate_weekly_goals`, `get_active_city_laws`, `get_active_event`, `get_active_event_signup_count`, `get_active_giveaways`, `get_active_streams_paged`, `get_admin_dashboard_metrics_v1`, `get_admin_finance_summary_live`, `get_agency_leaderboard`, `get_all_creator_applications`, `get_all_docket_entries`, `get_battle_status`, `get_broadofficers`, `get_buckets_summary_for_user`, `get_call_balances`, `get_cashout_request_details`, `get_current_court_session`, `get_current_payout_batch`, `get_current_trollmin`, `get_daily_earnings_series`, `get_daily_free_spins`, `get_delinquent_loan_users`, `get_district_onboarding_tour`, `get_earnings_overview`, `get_emergency_user_info`, `get_eligible_gift_coins`, `get_family_heartbeat`, `get_family_leaderboard`, `get_family_weekly_reward_total`, `get_gift_leaderboard`, `get_hourly_activity`, `get_live_auction_state`, `get_member_pending_payout`, `get_market_stats`, `get_monthly_earnings`, `get_moderation_logs`, `get_next_tier_threshold`, `get_or_create_wheel_session`, `get_pending_payouts_for_review`, `get_pending_payouts_summary`, `get_portfolio_summary`, `get_portfolio_value`, `get_payout_window_status`, `get_seller_reviews`, `get_staff_user_ids`, `get_stream_seats`, `get_system_settings`, `get_tm_matches`, `get_top_gifters`, `get_trollmin_activity_feed`, `get_trollmin_queue`, `get_trollmin_stats`, `get_user_accessible_districts`, `get_user_assets`, `get_user_conversations_optimized`, `get_user_docket`, `get_user_rewards`, `get_vehicle_catalog`, `get_vehicle_transactions`, `get_viewed_me_users`, `get_vote_weight`, `grant_family_crown`, `grant_xp`, `handle_battle_guest_leave`, `hard_delete_court_case`, `hard_delete_docket_entry`, `heartbeat_presence`, `increment`, `increment_family_stats`, `increment_insurance_trigger`, `increment_trollmonds`, `increment_user_crowns`, `invite_followers_to_broadcast`, `is_broadofficer`, `is_ip_banned`, `is_lead_officer_position_filled`, `is_user_chat_blocked`, `issue_warrant`, `join_court_session`, `join_family`, `join_game_match`, `join_game_seat`, `join_seat_atomic`, `join_trollmin_queue`, `join_trollopoly_queue`, `join_user_league`, `judge_pardon_user`, `kick_church_member`, `kick_user_paid`, `leave_battle`, `leave_battle_queue`, `leave_seat_atomic`, `leave_trollopoly_queue`, `leave_user_league`, `log_agency_activity`, `log_app_bug_report`, `log_government_action`, `log_security_event`, `log_stream_analytics_event`, `log_system_event`, `log_trollmin_action`, `lookup_user_location`, `manage_agency_member`, `mark_all_notifications_read`, `mark_conversation_read`, `mark_message_read`, `mark_onboarding_complete`, `mark_payout_window_notified`, `mark_sidebar_viewed`, `mark_stream_seat_live`, `moderate_product`, `moderator_delete_stream_message`, `moderator_disable_chat`, `moderator_kick_user`, `moderator_mute_user`, `moderator_unmute_user`, `mute_user`, `notify_all_users`, `notify_payouts_open_if_needed`, `officer_cashout_after_shift`, `pay_bank_loan`, `pay_bid`, `pay_credit_card`, `pay_house_rent`, `pay_kick_fee`, `pay_kick_reentry_fee`, `pay_rent`, `pay_stream_broadofficers_v1`, `payout_trollmers_weekly`, `perform_church_mod_action`, `perform_moderation_action`, `pick_battle_side`, `pin_product_to_broadcast`, `place_bid`, `post_president_announcement`, `president_flag_user`, `president_raise_payouts`, `president_raise_treasury`, `pride_complete_challenge`, `pride_increment_progress`, `process_gift_xp`, `process_game_action`, `purchase_admin_for_week`, `purchase_broadcast_theme`, `purchase_broadcast_theme_with_credit`, `purchase_entrance_effect`, `purchase_house_upgrade`, `purchase_landlord_license`, `purchase_listing_premium`, `purchase_rgb_broadcast`, `purchase_vehicle_asset`, `recalc_agency_tier`, `record_auction_report`, `record_battle_gift`, `record_battle_skip`, `record_completed_sale`, `record_dispute`, `record_dna_event`, `record_fraud_flag`, `record_profile_view`, `record_song_play`, `record_troll_family_activity`, `record_organization_audit`, `record_session`, `refund_marketplace_order`, `refund_payout_run`, `register_for_event`, `register_session`, `reject_application`, `reject_document`, `reject_empire_partner`, `reject_family_agency_conversion`, `reject_president_candidate`, `reject_visa_redemption`, `relock_payouts`, `remove_broadofficer`, `remove_verification`, `request_friday_cashout`, `request_marketplace_cancellation`, `request_random_battle_rematch`, `request_visa_redemption`, `reset_app_for_launch`, `reset_troll_coins`, `resolve_marketplace_dispute`, `resolve_security_event`, `respond_family_invite`, `restore_banned_account`, `review_appeal`, `review_auction_report`, `review_auctioneer_application`, `review_creator_application`, `rollback_moderation_action`, `rotate_ad_queue`, `run_weekly_agency_evaluation`, `scan_lot_barcode`, `search_users`, `sell_vehicle_asset`, `send_gift`, `send_gift_in_stream`, `send_marketplace_message`, `send_premium_gift`, `send_tm_message`, `set_active_broadcast_theme`, `set_active_entrance_effect`, `set_lead_officer_status`, `set_match_winner`, `set_stream_box_count`, `set_user_role`, `setup_family_leader_tax`, `ship_order`, `shop_buy_perk`, `sign_document`, `sign_lease`, `sign_lease_for_applicant`, `signup_president_candidate`, `spend_coins`, `spend_president_treasury`, `spin_troll_wheel`, `start_instant_battle`, `start_inmate_call`, `start_launch_trial`, `start_troll_us_game`, `start_trollmers_monthly_tournament`, `store_user_geolocation`, `stream_top_gifters`, `submit_ad`, `submit_agency_application`, `submit_cashout_request`, `submit_game_vote`, `submit_weekly_report`, `summon_user_to_court`, `troll_bank_credit_coins`, `troll_bank_spend_coins`, `troll_bank_spend_coins_secure`, `troll_opponent`, `troll_wars_current_week`, `trollmin_grant_pardon`, `try_pay_coins_secure`, `try_pay_with_credit_card`, `unban_officer`, `unban_user`, `unpin_product_from_broadcast`, `unsubscribe_from_broadcaster`, `update_agency_invite_status`, `update_appeal_media`, `update_district_progress`, `update_glow_color`, `update_house_condition`, `update_mission_progress`, `update_order_fulfillment`, `update_profile_costs`, `update_stream_last_activity`, `update_stream_viewer_count`, `update_system_health`, `update_system_setting`, `update_tm_profile`, `update_trade_cooldown`, `use_broadcast_ability`, `use_daily_free_spin`, `use_trollmin_daily_limit`, `validate_broadcast_password`, `verify_stamp`, `vote_candidate_with_coins`, `vote_for_president_candidate`, `vote_trollmin_approval`

### 1.3 Used by Edge Functions (`supabase/functions/`)

~130 unique tables referenced directly in edge functions:

`abuse_reports`, `account_deletion_reasons`, `admin_broadcasts`, `admin_flags`, `admin_notifications`, `admin_password_resets`, `agency_settings`, `agora_stream_sessions`, `app_settings`, `applications`, `audio_queue`, `bank_audit_log`, `battles`, `broadcast_seat_bans`, `broadcast_seats`, `bug_alerts`, `cashout_requests`, `coin_ledger`, `coin_packages`, `coin_transactions`, `connected_social_accounts`, `court_ai_feedback`, `credit_events`, `credit_scores`, `customer_service_audit_logs`, `earnings_payouts`, `executive_intake`, `friend_requests`, `games`, `game_players`, `game_votes`, `ghost_stream_sessions`, `guest_stream_sessions`, `guest_tracking`, `home_feature_cycles`, `installment_milestone_events`, `interview_sessions`, `loans`, `loan_payments`, `mai_talent_votes`, `manual_coin_orders`, `messages`, `moderation_actions`, `moderation_cases`, `moderation_events`, `moderation_reports`, `neighbors`, `notifications`, `officer_assignments`, `officer_live_assignments`, `officer_mission_logs`, `officer_timesheets`, `officer_vote_cycles`, `officer_votes`, `officer_warrants`, `offline_notifications`, `organization_admins`, `organization_audit_logs`, `organization_members`, `organization_students`, `organizations`, `pod_participants`, `pod_room_participants`, `house_participants`, `vehicle_participants`, `payout_batches`, `payout_requests`, `profiles`, `purchasable_items`, `referrals`, `sav_promotions`, `scheduled_announcements`, `shadow_bans`, `small_installment_purchases`, `social_publish_queue`, `source_content_refs`, `stocks`, `stock_market_settings`, `stock_price_history`, `stream_chat`, `stream_gifts`, `stream_likes`, `stream_missions`, `stream_reports`, `stream_seat_sessions`, `stream_seats`, `stream_viewers`, `streams`, `streams_participants`, `support_tickets`, `transactions`, `troll_battles`, `troll_event_claims`, `troll_events`, `troll_family_members`, `troll_families`, `troll_posts`, `troll_wheel_wins`, `user_achievements`, `user_badges`, `user_blocks`, `user_call_sounds`, `user_coins`, `user_credit`, `user_entrance_audio`, `user_follows`, `user_insurances`, `user_perks`, `user_portfolio`, `user_profiles`, `user_reports`, `verification_requests`, `vote_events`, `web_push_subscriptions`

~65 unique RPC functions called from edge functions:

`add_stream_like`, `admin_soft_delete_user`, `admin_update_any_profile_field`, `admin_update_ban_status`, `apply_troll_pass_bundle`, `approve_manual_order`, `auto_release_inmates`, `award_battle_crowns`, `award_birthday_coins_if_eligible`, `award_xp`, `ban_user`, `bulk_create_notifications`, `captain_click_battle`, `check_loan_defaults`, `check_rate_limit`, `claim_broadcast_seat`, `claim_troll_event`, `clear_background_jail`, `create_safety_alert`, `credit_free_coins`, `decay_broadcast_levels`, `deduct_user_coins`, `delete_support_ticket`, `deny_application`, `detect_ghost_inactivity`, `end_home_feature_cycle`, `enforce_lmpm_durations`, `fill_stage_slot`, `find_opponent`, `get_loan_stats`, `get_post_engagement`, `get_user_monthly_coins_earned`, `handle_referral_signup`, `has_accepted_agreement`, `increment_battle_score`, `is_lead_officer_position_filled`, `is_org_admin_member`, `is_tc_staff`, `leave_stage_and_fill_next`, `log_admin_action`, `log_admin_audit`, `log_app_bug_report`, `notify_user_rpc`, `process_admin_queue`, `process_cashout_refund`, `promote_trainee`, `record_agreement_acceptance`, `release_broadcast_seat`, `resolve_support_ticket`, `run_weekly_agency_evaluation`, `send_tromail_message`, `set_password_reset_pin`, `set_user_role`, `spawn_troll_event`, `store_user_geolocation`, `troll_bank_apply_for_loan`, `troll_bank_credit_coins`, `troll_bank_finalize_cashout`, `troll_bank_spend_coins_secure`

### 1.4 Never Referenced (Orphan Tables)

The following tables exist in the migration/schema files but are **NOT** referenced anywhere in `src/`, `supabase/functions/`, RPC calls, or SQL functions. These are potentially dead/unused tables:

> **Note:** This list is derived from the ~500+ tables found in migrations minus all tables referenced in frontend, edge functions, and SQL functions. Tables prefixed with future-dated migrations (2027-2029) may be planned features.

| # | Table | Source |
|---|---|---|
| 1 | `action_logs` | baseline |
| 2 | `activity_log` | baseline |
| 3 | `activity_logs` | baseline |
| 4 | `admin_actions_log` | baseline |
| 5 | `admin_adjustments` | baseline |
| 6 | `admin_coin_pool` | baseline |
| 7 | `admin_coin_revenue` | baseline |
| 8 | `admin_gift_totals` | baseline |
| 9 | `admin_pool` | baseline |
| 10 | `admin_pool_ledger` | 2026-01 |
| 11 | `admin_pool_transactions` | 2026-06 |
| 12 | `admin_tax_reviews` | baseline |
| 13 | `admin_top_buyers` | baseline |
| 14 | `ad_videos` | 2026-04 |
| 15 | `ad_generation_jobs` | 2026-04 |
| 16 | `ad_analytics` | 2026-04 |
| 17 | `agency_admin_reports` | 2026-06 |
| 18 | `agency_billing_events` | 2029-05 |
| 19 | `agency_enforcement_actions` | 2026-05 |
| 20 | `agency_feature_flags` | 2026-05 |
| 21 | `agency_platform_settings` | 2029-05 |
| 22 | `ai_action_logs` | baseline |
| 23 | `allowed_devices` | baseline |
| 24 | `apns_tokens` | baseline |
| 25 | `app_updates` | baseline |
| 26 | `asset_auctions` | 2026-02 |
| 27 | `auction_bids` | 2026-02 |
| 28 | `balance_ledger` | baseline |
| 29 | `bank_feature_flags` | 2026-01 |
| 30 | `bank_tiers` | 2026-01 |
| 31 | `battle_events` | 2027-03 |
| 32 | `battle_gifts` | baseline |
| 33 | `battle_history` | baseline |
| 34 | `battle_rewards` | baseline |
| 35 | `badge_definitions` | baseline |
| 36 | `badge_tier_progress` | 2026-05 |
| 37 | `badge_showcase` | 2026-05 |
| 38 | `blocked_users` | baseline |
| 39 | `broadcast_audio_settings` | 2026-03 |
| 40 | `broadcast_command_modules` | 2026-03 |
| 41 | `broadcast_consumables` | various |
| 42 | `broadcast_cycle_stats` | baseline |
| 43 | `broadcast_officers` | 2027-08 |
| 44 | `broadcast_overrides` | 2027-03 |
| 45 | `broadcast_rankings` | 2027-08 |
| 46 | `broadcast_restrictions` | 2026-04 |
| 47 | `broadcast_theme_events` | baseline |
| 48 | `broadcast_tokens` | baseline |
| 49 | `broadcaster_applications` | baseline |
| 50 | `broadcaster_earnings` | baseline |
| 51 | `broadcaster_metrics` | baseline |
| 52 | `broadcaster_stats` | 2026-02 |
| 53 | `bribe_logs` | 2027-10 |
| 54 | `business_profiles` | 2027-02 |
| 55 | `business_reports` | 2027-09 |
| 56 | `calendar_events` | 2026-06 |
| 57 | `call_sessions` | baseline |
| 58 | `call_sound_catalog` | baseline |
| 59 | `call_transactions` | baseline |
| 60 | `caption_variants` | 2026-04 |
| 61 | `car_insurance_policies` | 2026-01 |
| 62 | `cars_catalog` | 2026-02 |
| 63 | `case_audit_logs` | baseline |
| 64 | `case_evidence` | baseline |
| 65 | `case_participants` | baseline |
| 66 | `case_templates` | baseline |
| 67 | `cashout_tiers` | baseline |
| 68 | `church_banned_users` | 2026-05 |
| 69 | `church_mod_actions` | 2026-05 |
| 70 | `church_passages` | 2027-02 |
| 71 | `church_prayer_likes` | 2027-02 |
| 72 | `city_districts` | baseline |
| 73 | `city_events` | baseline |
| 74 | `clan_rewards` | baseline |
| 75 | `clan_vault` | baseline |
| 76 | `coin_orders` | 2026-01 |
| 77 | `coin_pool_contributions` | baseline |
| 78 | `coin_purchases` | baseline |
| 79 | `coin_reward_pool` | baseline |
| 80 | `coinback_log` | baseline |
| 81 | `config` | baseline |
| 82 | `content` | baseline |
| 83 | `correctional_facilities` | various |
| 84 | `court_ai_rate_limits` | 2026-04 |
| 85 | `court_box_members` | baseline |
| 86 | `court_payments` | baseline |
| 87 | `court_rulings_archive` | baseline |
| 88 | `court_schedules` | baseline |
| 89 | `court_sentences` | baseline |
| 90 | `court_summons` | baseline |
| 91 | `court_verdicts` | baseline |
| 92 | `credit_card_billing_cycles` | 2027-06 |
| 93 | `credit_card_transactions` | 2027-06 |
| 94 | `credit_reports` | 2026-01 |
| 95 | `credit_score_system` | 2027-01 |
| 96 | `creator_migration_claims` | baseline |
| 97 | `creators_over_600` | baseline |
| 98 | `daily_logins` | baseline |
| 99 | `dealership_inventory` | 2027-04 |
| 100 | `dealership_vehicle_pool` | 2027-04 |
| 101 | `declined_transactions` | baseline |
| 102 | `deed_transfers` | baseline |
| 103 | `deeds` | baseline |
| 104 | `device_block_logs` | baseline |
| 105 | `diamond_avatar_tiers` | 2026-03 |
| 106 | `diamond_special_styles` | 2026-03 |
| 107 | `discount_codes` | 2026-02 |
| 108 | `district_announcements` | baseline |
| 109 | `district_features` | baseline |
| 110 | `districts` | baseline |
| 111 | `document_access` | 2026-06 |
| 112 | `document_versions` | 2026-06 |
| 113 | `earnings` | baseline |
| 114 | `economy_abuse_flags` | baseline |
| 115 | `election_results` | various |
| 116 | `empire_applications` | baseline |
| 117 | `empire_partner_rewards` | baseline |
| 118 | `empire_partners` | baseline |
| 119 | `empire_referrals` | baseline |
| 120 | `empire_rewards` | baseline |
| 121 | `entrance_effect_catalog` | baseline |
| 122 | `error_logs` | baseline |
| 123 | `escalation_matrix` | baseline |
| 124 | `escalation_reports` | baseline |
| 125 | `event_access_rules` | 2026-06 |
| 126 | `event_invites` | 2026-06 |
| 127 | `event_notifications` | 2026-06 |
| 128 | `executive_intake` | baseline |
| 129 | `executive_reports` | baseline |
| 130 | `extension_status` | view |
| 131 | `family_badges_earned` | baseline |
| 132 | `family_chat_messages` | 2026-03 |
| 133 | `family_calls` | 2026-03 |
| 134 | `family_call_members` | 2026-03 |
| 135 | `family_invites` | baseline |
| 136 | `family_lounge_messages` | baseline |
| 137 | `family_shop_items` | baseline |
| 138 | `family_shop_purchases` | baseline |
| 139 | `family_tasks` | 2026-01 |
| 140 | `family_tasks_new` | baseline |
| 141 | `family_war_stats` | baseline |
| 142 | `fan_contracts` | 2026-03 |
| 143 | `fan_memory` | 2026-03 |
| 144 | `fcm_tokens` | baseline |
| 145 | `follows` | baseline |
| 146 | `game_matches` | 2026-05 |
| 147 | `gas_requests` | 2027-02 |
| 148 | `gift_bonus_tracker` | baseline |
| 149 | `gift_batch_logs` | 2026-02 |
| 150 | `gift_card_redemptions` | baseline |
| 151 | `gift_cards` | baseline |
| 152 | `gift_catalog` | baseline |
| 153 | `gift_items` | baseline |
| 154 | `gift_leaderboard_entries` | baseline |
| 155 | `gift_leaderboards` | baseline |
| 156 | `gift_sends` | 2026-01 |
| 157 | `gift_transactions` | baseline |
| 158 | `gift_votes` | 2026-01 |
| 159 | `gift_xp_stats` | baseline |
| 160 | `giftcard_fulfillments` | baseline |
| 161 | `gifts_catalog` | 2026-02 |
| 162 | `gifts_owned` | baseline |
| 163 | `giveaway_entries` | 2026-02 |
| 164 | `giveaways` | 2026-02 |
| 165 | `global_ticker` | various |
| 166 | `government_reputation` | 2027-10 |
| 167 | `group_chats` | baseline |
| 168 | `guest_presence_logs` | baseline |
| 169 | `hire_fire_actions` | baseline |
| 170 | `hire_limits` | baseline |
| 171 | `home_feature_spend` | baseline |
| 172 | `honorary_family_members` | baseline |
| 173 | `house_participants` | edge functions |
| 174 | `house_raid_logs` | 2026-05 |
| 175 | `house_rentals` | 2026-02 |
| 176 | `house_repair_logs` | 2026-05 |
| 177 | `houses_catalog` | 2026-02 |
| 178 | `hr_employees` | baseline |
| 179 | `hr_events` | baseline |
| 180 | `hr_notes` | baseline |
| 181 | `hype_coin_ledger` | 2029-05 |
| 182 | `identity_reward_logs` | baseline |
| 183 | `incidents` | baseline |
| 184 | `insurance` | baseline |
| 185 | `insurance_logs` | baseline |
| 186 | `insurance_packages` | baseline |
| 187 | `insurance_plans` | baseline |
| 188 | `inventory_items` | baseline |
| 189 | `invoices` | 2027-04 |
| 190 | `ip_bans` | baseline |
| 191 | `jail_sentences` | various |
| 192 | `job_applications` | baseline |
| 193 | `kick_logs` | baseline |
| 194 | `ktauto_inventory` | various |
| 195 | `landlord_applications` | various |
| 196 | `law_votes` | 2027-10 |
| 197 | `league_event_templates` | 2029-05 |
| 198 | `league_notifications` | 2028-03 |
| 199 | `league_points` | 2029-05 |
| 200 | `level_engine_runs` | 2029-05 |
| 201 | `level_rewards` | 2029-05 |
| 202 | `listing_flags` | 2027-02 |
| 203 | `live_viewers` | baseline |
| 204 | `loan_applications` | 2026-01 |
| 205 | `loan_default_summons` | 2027-03 |
| 206 | `lucky_coin_events` | baseline |
| 207 | `mai_appeals` | baseline |
| 208 | `mai_class_enrollments` | 2029-01 |
| 209 | `mai_incidents` | baseline |
| 210 | `mai_overrides` | baseline |
| 211 | `mai_performance_timer` | 2026-02 |
| 212 | `mai_queue` | 2026-02 |
| 213 | `mai_show_sessions` | 2026-02 |
| 214 | `mai_stage_slots` | 2026-02 |
| 215 | `mai_talent_queue` | 2026-02 |
| 216 | `mai_talent_shows` | 2026-02 |
| 217 | `mai_timeline_events` | baseline |
| 218 | `mai_user_memory` | baseline |
| 219 | `manual_orders` | various |
| 220 | `marketplace_conversations` | 2027-02 |
| 221 | `marketplace_items` | 2027-02 |
| 222 | `marketplace_messages` | 2027-02 |
| 223 | `marketplace_payout_holds` | various |
| 224 | `marketplace_reviews` | 2027-02 |
| 225 | `marketplace_seller_tiers` | various |
| 226 | `message_receipts` | baseline |
| 227 | `message_requests` | baseline |
| 228 | `messages` | baseline |
| 229 | `millionaire_hall_of_fame` | baseline |
| 230 | `mission_templates` | 2026-03 |
| 231 | `mobile_error_logs` | 2024-05 |
| 232 | `mobile_errors` | 2026-02 |
| 233 | `moderation_fee_settings` | baseline |
| 234 | `moderation_notes` | baseline |
| 235 | `neighbor_event_badges` | 2027-09 |
| 236 | `neighbor_events` | 2027-08 |
| 237 | `neighbors_businesses` | 2027-08 |
| 238 | `neighbors_participants` | 2027-08 |
| 239 | `notary_documents` | various |
| 240 | `observer_ratings` | baseline |
| 241 | `officer_activity` | baseline |
| 242 | `officer_applications` | baseline |
| 243 | `officer_availability` | baseline |
| 244 | `officer_badges` | baseline |
| 245 | `officer_chat` | baseline |
| 246 | `officer_corruption_flags` | 2027-03 |
| 247 | `officer_earnings` | baseline |
| 248 | `officer_hours` | baseline |
| 249 | `officer_logs` | baseline |
| 250 | `officer_orientation_results` | baseline |
| 251 | `officer_orientations` | baseline |
| 252 | `officer_payroll_logs` | 2027-03 |
| 253 | `officer_performance` | 2027-03 |
| 254 | `officer_payouts` | baseline |
| 255 | `officer_quiz_attempts` | baseline |
| 256 | `officer_quiz_questions` | baseline |
| 257 | `officer_quiz_results` | baseline |
| 258 | `officer_shift_slots` | baseline |
| 259 | `officer_shifts` | baseline |
| 260 | `officer_stream_logs` | baseline |
| 261 | `officer_strikes` | baseline |
| 262 | `officer_time_off_requests` | 2026-01 |
| 263 | `officer_training_sessions` | baseline |
| 264 | `onesignal_tokens` | 2026-02 |
| 265 | `onboarding_events` | baseline |
| 266 | `onboarding_progress` | baseline |
| 267 | `order_shipments` | various |
| 268 | `org_students` | various |
| 269 | `organization_announcements` | 2028-04 |
| 270 | `organization_audit_logs` | 2028-04 |
| 271 | `owc_transactions` | baseline |
| 272 | `paid_chat_access` | 2027-04 |
| 273 | `paid_chat_payments` | 2027-04 |
| 274 | `payment_fees` | baseline |
| 275 | `payment_holds` | baseline |
| 276 | `payment_logs` | baseline |
| 277 | `payment_transactions` | baseline |
| 278 | `payout_audit_log` | baseline |
| 279 | `payout_reviews` | baseline |
| 280 | `payout_settings` | baseline |
| 281 | `payouts` | baseline |
| 282 | `perk_catalog` | baseline |
| 283 | `platform_economy_settings` | 2029-06 |
| 284 | `platform_fees` | baseline |
| 285 | `platform_profit` | baseline |
| 286 | `platform_revenue` | baseline |
| 287 | `platform_reward_pool` | 2029-06 |
| 288 | `platform_wallet` | baseline |
| 289 | `pod_episodes` | 2027-02 |
| 290 | `podcast_rtc_logs` | 2026-03 |
| 291 | `post_gifts` | baseline |
| 292 | `post_mentions` | various |
| 293 | `posts` | baseline |
| 294 | `prayer_requests` | various |
| 295 | `president_audit_logs` | 2026-02 |
| 296 | `president_announcements` | 2026-02 |
| 297 | `president_mansion_theme` | 2029-06 |
| 298 | `pride_credit_xp_log` | 2029-06 |
| 299 | `pride_keyword_config` | 2029-06 |
| 300 | `profile_frame_tiers` | 2026-03 |
| 301 | `promo_code_uses` | baseline |
| 302 | `promo_codes` | baseline |
| 303 | `properties` | baseline |
| 304 | `property_insurance_policies` | 2026-01 |
| 305 | `property_upgrades` | baseline |
| 306 | `provider_costs` | baseline |
| 307 | `public_pool` | various |
| 308 | `punishment_transactions` | baseline |
| 309 | `punishments` | baseline |
| 310 | `purchase_ledger` | edge functions |
| 311 | `referral_claims` | baseline |
| 312 | `referral_monthly_bonus` | baseline |
| 313 | `referrals` | baseline |
| 314 | `report_cases` | baseline |
| 315 | `repossessions` | various |
| 316 | `reputation_events` | baseline |
| 317 | `revenue_ledger` | baseline |
| 318 | `revenue_settings` | baseline |
| 319 | `risk_events` | baseline |
| 320 | `role_change_log` | baseline |
| 321 | `role_earning_rules` | 2029-05 |
| 322 | `role_perk_claims` | 2029-05 |
| 323 | `role_perk_settings` | 2029-05 |
| 324 | `role_privileges` | baseline |
| 325 | `roles` | baseline |
| 326 | `rooms` | baseline |
| 327 | `royal_family_history` | baseline |
| 328 | `royal_family_perks` | baseline |
| 329 | `royal_family_titles` | baseline |
| 330 | `rtmp_credentials` | various |
| 331 | `rtc_sessions` | 2026-03 |
| 332 | `sav_promotions` | edge functions |
| 333 | `saved_cards` | various |
| 334 | `security_admin_audit_log` | 2026-05 |
| 335 | `security_ip_reputation` | 2026-05 |
| 336 | `seller_reliability` | baseline |
| 337 | `seller_tiers` | various |
| 338 | `server_error_events` | baseline |
| 339 | `service_bookings` | 2027-02 |
| 340 | `service_listings` | 2027-02 |
| 341 | `service_reviews` | 2027-02 |
| 342 | `shareathon_battles` | 2026-06 |
| 343 | `shareathon_stream_sessions` | 2026-06 |
| 344 | `shifts` | baseline |
| 345 | `shop_partners` | baseline |
| 346 | `shop_purchases` | various |
| 347 | `shop_transactions` | baseline |
| 348 | `shops` | baseline |
| 349 | `sign_lease_applications` | various |
| 350 | `small_installment_purchases` | 2026-05/2027-05 |
| 351 | `social_publish_logs` | 2026-04 |
| 352 | `special_gift_earnings` | baseline |
| 353 | `square_events` | baseline |
| 354 | `staff_applications` | baseline |
| 355 | `staff_meeting_minutes` | various |
| 356 | `staff_profiles` | baseline |
| 357 | `starter_vehicles` | various |
| 358 | `store_items` | baseline |
| 359 | `stores` | baseline |
| 360 | `stream_analytics` | various |
| 361 | `stream_analytics_daily` | 2026-04 |
| 362 | `stream_audience_presence` | 2026-05 |
| 363 | `stream_battles` | 2026-04 |
| 364 | `stream_capacity_queue` | 2027-01 |
| 365 | `stream_discovery_prefs` | baseline |
| 366 | `stream_energy_meter` | 2026-03 |
| 367 | `stream_entrances` | baseline |
| 368 | `stream_entries` | baseline |
| 369 | `stream_events` | baseline |
| 370 | `stream_fan_tiers` | 2026-03 |
| 371 | `stream_guests` | 2026-06 |
| 372 | `stream_join_requests` | baseline |
| 373 | `stream_league_scores` | 2028-03 |
| 374 | `stream_milestones` | 2026-03 |
| 375 | `stream_missions` | 2026-03 |
| 376 | `stream_momentum` | baseline |
| 377 | `stream_mute_counts` | baseline |
| 378 | `stream_mutes` | 2025-02 |
| 379 | `stream_passwords` | baseline |
| 380 | `stream_polls` | 2026-03 |
| 381 | `stream_presets` | baseline |
| 382 | `stream_ranking` | baseline |
| 383 | `stream_reactions` | baseline |
| 384 | `stream_seat_requests` | 2026-05 |
| 385 | `stream_sessions` | baseline |
| 386 | `stream_snack_purchases` | baseline |
| 387 | `stream_stage_passes` | 2026-05 |
| 388 | `stream_top_gifters` | 2026-04 |
| 389 | `stream_vods` | baseline |
| 390 | `stream_awards` | 2026-03 |
| 391 | `stripe_customers` | 2026-01 |
| 392 | `subscription_revenue_log` | 2026-05 |
| 393 | `subscription_tiers` | 2026-05 |
| 394 | `support_screen_sessions` | 2029-05 |
| 395 | `system_alerts` | baseline |
| 396 | `system_errors` | baseline |
| 397 | `system_roles` | 2026-02 |
| 398 | `system_settings` | baseline |
| 399 | `task_completions` | baseline |
| 400 | `task_history` | baseline |
| 401 | `task_templates` | baseline |
| 402 | `tax_report_status` | baseline |
| 403 | `tcnn_articles` | various |
| 404 | `tcps_messages` | 2026-04 |
| 405 | `telemetry_events` | 2026-06 |
| 406 | `ticket_messages` | baseline |
| 407 | `tmv_actions` | 2026-02 |
| 408 | `tmv_fee_schedule` | 2026-02 |
| 409 | `tournament_battles` | various |
| 410 | `tournament_participants` | 2025-02 |
| 411 | `tournaments` | 2025-02 |
| 412 | `training_scenarios` | baseline |
| 413 | `transactions` | baseline |
| 414 | `treasury_payout_items` | 2028-05 |
| 415 | `treasury_payout_runs` | 2028-05 |
| 416 | `treasury_role_allocations` | 2028-05 |
| 417 | `treasury_transactions` | 2028-05 |
| 418 | `troll_ai_avatars` | baseline |
| 419 | `troll_battle_gifts` | baseline |
| 420 | `troll_battle_participants` | 2026-04 |
| 421 | `troll_city_treasury` | 2028-05 |
| 422 | `troll_court_cases` | baseline |
| 423 | `troll_court_evidence` | 2025-04 |
| 424 | `troll_dna_events` | baseline |
| 425 | `troll_dna_profiles` | baseline |
| 426 | `troll_dna_traits` | baseline |
| 427 | `troll_drops` | baseline |
| 428 | `troll_drops_log` | baseline |
| 429 | `troll_family_activity_events` | 2026-05 |
| 430 | `troll_family_messages` | baseline |
| 431 | `troll_family_members` | baseline |
| 432 | `troll_family_memberships` | baseline |
| 433 | `troll_family_wars` | baseline |
| 434 | `troll_games` | various |
| 435 | `troll_gift_items` | baseline |
| 436 | `troll_mart_clothing` | 2027-02 |
| 437 | `troll_officer_applications` | baseline |
| 438 | `troll_officers` | baseline |
| 439 | `troll_post_comments` | post_engagement |
| 440 | `troll_post_gifts` | 2027-02 |
| 441 | `troll_post_reactions` | post_engagement |
| 442 | `troll_stream_messages` | baseline |
| 443 | `troll_streams` | baseline |
| 444 | `troll_wall_gifts` | 2026-01 |
| 445 | `troll_wall_likes` | baseline |
| 446 | `troll_wall_reactions` | baseline |
| 447 | `troll_wars_ai_battle_logs` | 2026-04 |
| 448 | `Mai Troll_orders` | baseline |
| 449 | `Mai Troll_products` | baseline |
| 450 | `trollg_applications` | 2026-01 |
| 451 | `trollmin_config` | various |
| 452 | `trollmond_config` | 2027-03 |
| 453 | `trollmond_gifts` | baseline |
| 454 | `trollmond_ledger` | baseline |
| 455 | `trollmond_store_items` | baseline |
| 456 | `trollmond_transactions` | 2027-03 |
| 457 | `trollmonds_pools` | baseline |
| 458 | `trolls_night_applications` | schema.sql |
| 459 | `trolls_night_guest_agreements` | schema.sql |
| 460 | `troll_station` | troll_station.sql |
| 461 | `troll_station_chat` | troll_station.sql |
| 462 | `troll_station_cohosts` | troll_station.sql |
| 463 | `troll_station_hosts` | troll_station.sql |
| 464 | `troll_station_invitations` | troll_station.sql |
| 465 | `troll_station_queue` | troll_station.sql |
| 466 | `troll_station_sessions` | troll_station.sql |
| 467 | `troll_station_songs` | troll_station.sql |
| 468 | `trollstown_properties` | baseline |
| 469 | `trollstown_property_upgrades` | baseline |
| 470 | `trollstown_upgrade_config` | baseline |
| 471 | `trolltract_contracts` | baseline |
| 472 | `trolltract_weekly_rewards` | baseline |
| 473 | `tromail_contract_templates` | 2029-05 |
| 474 | `tromail_contracts` | 2029-05 |
| 475 | `tromody_battles` | baseline |
| 476 | `tromody_gifts` | baseline |
| 477 | `tromody_matches` | baseline |
| 478 | `tromody_queue` | baseline |
| 479 | `tromody_sessions` | baseline |
| 480 | `trophies` | baseline |
| 481 | `typing_statuses` | baseline |
| 482 | `user_achievement_events` | 2029-05 |
| 483 | `user_active_items` | 2027-02 |
| 484 | `user_active_entrance_effect` | baseline |
| 485 | `user_auth_cache` | 2024-05 |
| 486 | `user_avatar_customization` | 2027-02 |
| 487 | `user_badges_earned` | baseline |
| 488 | `user_balances` | baseline |
| 489 | `user_bans` | baseline |
| 490 | `user_badge_progress` | 2026-03 |
| 491 | `user_broadcast_theme_purchases` | baseline |
| 492 | `user_broadcast_theme_state` | baseline |
| 493 | `user_cars` | 2026-01 |
| 494 | `user_content_approvals` | 2027-09 |
| 495 | `user_devices` | baseline |
| 496 | `user_district_progress` | baseline |
| 497 | `user_driver_licenses` | 2026-02 |
| 498 | `user_entrance_effects` | baseline |
| 499 | `user_earning_events` | 2029-05 |
| 500 | `user_earnings_summary` | view |
| 501 | `user_event_dismissals` | 2026-01 |
| 502 | `user_gifts` | 2026-01 |
| 503 | `user_house_upgrades` | 2026-02 |
| 504 | `user_houses` | 2026-02 |
| 505 | `user_inventory` | baseline |
| 506 | `user_inventory_items` | 2029-05 |
| 507 | `user_ip_locations` | various |
| 508 | `user_ip_tracking` | baseline |
| 509 | `user_level_reward_claims` | 2029-05 |
| 510 | `user_levels` | baseline |
| 511 | `user_location_intelligence_view` | view |
| 512 | `user_mission_progress` | 2026-03 |
| 513 | `user_notifications` | baseline |
| 514 | `user_payout_settings` | baseline |
| 515 | `user_presence_routes` | 2029-05 |
| 516 | `user_purchases` | 2027-02 |
| 517 | `user_reputation` | baseline |
| 518 | `user_rewards` | 2026-02 |
| 519 | `user_risk_profile` | baseline |
| 520 | `user_role_grants` | 2026-02 |
| 521 | `user_roles` | baseline |
| 522 | `user_streamer_entitlements` | baseline |
| 523 | `user_stream_likes` | 2027-03 |
| 524 | `user_stats` | 2024-01 |
| 525 | `user_subscriptions` | 2026-05 |
| 526 | `user_troll_mart_purchases` | 2027-02 |
| 527 | `user_vehicle_assets` | 2026-06 |
| 528 | `user_wallets` | 2026-01 |
| 529 | `users` | baseline |
| 530 | `vehicle_asset_system_triggers` | trigger |
| 531 | `vehicle_catalog` | 2026-06 |
| 532 | `vehicle_insurance_policies` | 2026-02 |
| 533 | `vehicle_listings` | 2026-02 |
| 534 | `vehicle_loans` | 2026-02 |
| 535 | `vehicle_participants` | edge functions |
| 536 | `vehicle_registrations` | 2026-02 |
| 537 | `vehicle_titles` | 2026-02 |
| 538 | `vehicle_transactions` | 2026-02 |
| 539 | `vehicles_catalog` | 2026-02 |
| 540 | `vendor_invoices` | baseline |
| 541 | `verification_subscriptions` | 2026-06 |
| 542 | `verification_transactions` | baseline |
| 543 | `videos` | baseline |
| 544 | `visa_redemptions` | baseline |
| 545 | `voice_announcement_styles` | 2026-03 |
| 546 | `wall_posts` | baseline |
| 547 | `wallets` | 2026-01 |
| 548 | `war_results` | baseline |
| 549 | `wars` | baseline |
| 550 | `weekly_family_goals_new` | 2026-04 |
| 551 | `weekly_officer_reports` | baseline |
| 552 | `weekly_reports` | baseline |
| 553 | `weekly_role_perk_system` | 2029-05 |
| 554 | `weekly_top_broadcasters` | 2027-08 |
| 555 | `wheel_sessions` | 2027-10 |
| 556 | `wheel_spins` | baseline |
| 557 | `xp_ledger` | 2024-01 |
| 558 | `zip_codes` | 2027-03 |
| 559 | `zip_crime_events` | 2027-03 |

---

## 2. FUNCTIONS

### 2.1 Active SQL Functions (~200+)

Core application functions actively referenced in code:

**Authentication & Security:**
`_is_court_admin`, `crypt_password`, `current_user_id`, `has_role`, `has_role_fast`, `is_admin`, `is_authenticated`, `is_moderator`, `is_not_banned`, `is_not_suspended`, `is_staff`, `is_staff_on_duty`, `is_user_jailed`, `is_admin_user`, `protect_profile_fields`, `protect_owner_admin_changes`, `global_write_check`, `can_write`

**Banking & Economy:**
`add_free_coins`, `add_troll_coins`, `adjust_balance`, `admin_approve_payout`, `apply_troll_pass_bundle`, `approve_manual_order`, `buy_car_insurance`, `buy_property_insurance`, `credit_coins`, `deposit_to_cashout_escrow`, `get_user_coins`, `get_user_gift_history`, `pay_bank_loan`, `process_referral_rewards`, `reserve_all_cashout_coins`, `spend_coins`, `sync_ledger_to_transactions`, `transfer_coins`, `troll_bank_apply_for_loan`, `troll_bank_credit_coins`, `try_pay_coins`

**Gift System:**
`process_gift_with_lucky`, `process_gift_ledger_batch`, `process_boosted_gift`, `send_gift`, `send_gift_v2`, `send_gift_in_stream`, `send_wall_post_gift`, `record_battle_gift`, `get_gifts_received_count`, `get_gifts_sent_count`, `get_unique_gifters_count`, `get_returning_gifters_count`, `increment_gift_vote_count`

**Battle System:**
`accept_battle`, `captain_click_battle`, `create_battle_challenge`, `end_battle`, `end_battle_guarded`, `enforce_battle_state_rules`, `expire_stale_battles`, `find_or_create_battle`, `find_random_battle_match`, `initiate_battle_handshake`, `pick_battle_side`, `process_scheduled_battles`, `start_battle`, `strict_battle_handshake`, `cleanup_stale_battle_searches`, `confirm_battle_screen`, `battle_scheduled_start`, `distribute_battle_winnings`, `trigger_distribute_battle_winnings`

**Streaming:**
`can_start_broadcast`, `can_start_pod`, `auto_save_stream_on_end`, `set_broadcaster_moderation_lock`, `set_stream_box_count`, `set_closed_at_if_closed`, `get_evidence_for_stream`, `is_stream_saved`, `set_active_broadcast_theme`, `set_active_entrance_effect`, `purchase_broadcast_theme`, `fill_stage_slot`, `leave_stage_and_fill_next`, `end_pod`, `post_system_message`, `mute_user`, `unmute_user`, `kick_user`

**Family System:**
`bootstrap_new_family`, `create_family_tasks`, `join_family`, `kick_family_member`, `promote_family_member`, `join_family_call`, `leave_family_call`, `start_family_call`, `end_family_call`, `get_family_online_members`, `increment_family_stats`

**Marketplace & Assets:**
`create_rental_listing`, `rent_property`, `purchase_car`, `purchase_car_v2`, `purchase_from_ktauto`, `purchase_house`, `purchase_property_with_loan`, `purchase_landlord_license`, `purchase_vehicle`, `set_active_car`, `set_active_property`, `finalize_auctions`, `place_bid`, `execute_buy_order`, `execute_sell_order`

**User & Profile:**
`calculate_level`, `calculate_level_from_xp`, `get_xp_for_level`, `xp_min_for_level`, `has_min_level`, `get_user_asset_flags`, `mark_onboarding_complete`, `set_password_reset_pin`, `refresh_my_daily_stats`, `refresh_user_auth_cache`, `trigger_refresh_user_auth_cache`, `update_academy_updated_at`, `fn_touch_updated_at`, `generate_plate_number`

**Referral System:**
`check_referral_qualification`, `get_my_referrer`, `get_referral_cashout_bonus`, `get_referral_list`, `get_referral_stats`, `get_referred_user_cashout_bonus`, `admin_get_referral_overview`, `process_referral_rewards`

**Post Engagement:**
`credit_free_coins`, `get_post_earnings`, `get_post_engagement`, `record_post_view`

**Goals & Payouts:**
`check_creator_weekly_eligibility`, `compute_task_threshold`, `get_current_payout_batch`, `request_payout`, `generate_family_goals`, `generate_weekly_goals`, `generate_user_league_missions`, `complete_family_goal`

**Government & Court:**
`auto_start_court_session`, `auto_start_court_with_docket`, `end_court_session`, `extend_court_date`, `file_civil_lawsuit`, `file_impeachment_case`, `finalize_president_election`, `signup_president_candidate`, `vote_for_president_candidate`, `post_president_announcement`, `president_flag_user`, `president_raise_payouts`, `president_raise_treasury`, `expose_bribe`, `trollmin_grant_pardon`, `judge_pardon_user`, `summon_user_to_court`, `hard_delete_court_case`, `hard_delete_docket_entry`

**Mail Systems:**
`send_tm_message`, `can_send_utromail`, `find_utromail_thread`, `find_shared_conversation`, `mark_conversation_read`, `mark_message_read`, `mark_all_notifications_read`

**Notifications:**
`create_notification`, `bulk_create_notifications`, `notify_user_rpc`, `notify_payouts_open_if_needed`, `dismiss_notification`, `mark_notification_read`

**Missions & Goals:**
`update_mission_progress`, `claim_user_league_mission`, `create_system_league_event`, `award_league_points`, `join_user_league`, `leave_user_lease`, `get_active_event`, `get_active_event_signup_count`, `register_for_event`, `cancel_event_registration`

**Misc Active Functions:**
`get_active_streams_paged`, `get_stream_seats`, `get_battle_status`, `get_user_assets`, `get_user_rewards`, `get_vehicle_catalog`, `get_vehicle_transactions`, `get_live_auction_state`, `get_admin_dashboard_metrics_v1`, `get_admin_finance_summary_live`, `get_earnings_overview`, `get_moderation_logs`, `get_system_settings`, `search_users`, `get_staff_user_ids`, `get_user_accessible_districts`, `get_user_conversations_optimized`, `get_user_docket`, `get_trollmin_queue`, `get_trollmin_stats`, `get_trollmin_activity_feed`, `get_current_trollmin`, `get_current_court_session`, `get_current_payout_batch`, `get_pending_payouts_for_review`, `get_pending_payouts_summary`, `get_payout_window_status`, `get_portfolio_summary`, `get_portfolio_value`, `get_seller_reviews`, `get_market_stats`, `get_monthly_earnings`, `get_daily_earnings_series`, `get_hourly_activity`, `get_next_tier_threshold`, `get_family_heartbeat`, `get_family_leaderboard`, `get_family_weekly_reward_total`, `get_gift_leaderboard`, `get_agency_leaderboard`, `get_all_creator_applications`, `get_all_docket_entries`, `get_broadofficers`, `get_buckets_summary_for_user`, `get_cashout_request_details`, `get_call_balances`, `get_delinquent_loan_users`, `get_district_onboarding_tour`, `get_emergency_user_info`, `get_eligible_gift_coins`, `get_tm_matches`, `get_top_gifters`, `get_viewed_me_users`, `get_vote_weight`, `get_or_create_wheel_session`, `get_daily_free_spins`

### 2.2 Deprecated / Legacy Functions

Functions that appear to be superseded by newer versions or are legacy wrappers:

| Function | Reason |
|---|---|
| `send_gift_v2` | Superseded by `send_gift` with updated logic |
| `purchase_car` | Superseded by `purchase_car_v2` |
| `try_pay_coins` | Superseded by `try_pay_coins_secure` |
| `troll_bank_spend_coins` | Superseded by `troll_bank_spend_coins_secure` |
| `end_battle` | Superseded by `end_battle_guarded` |
| `find_opponent` | Superseded by `find_random_battle_match` |
| `_apply_car_insurance` | Internal helper, likely deprecated |
| `_apply_property_insurance` | Internal helper, likely deprecated |
| `_fix_rls_if_table_exists` | One-time migration helper |
| `_mai_block_mutations` | Internal trigger helper |
| `_mai_gift_abuse_trigger` | Internal trigger helper |
| `migrate_garage_to_user_cars` | One-time migration function |
| `sync_ledger_to_transactions` | Legacy sync function |
| `get_referrer_cashout_bonus` | Likely superseded |
| `get_posts_made_count` | Possibly unused |
| `get_shares_count` | Possibly unused |
| `admin_grant_coins` | Superseded by `troll_bank_credit_coins` |
| `add_coins` | Superseded by `troll_bank_credit_coins` |
| `deduct_coins` | Superseded by `troll_bank_spend_coins_secure` |
| `deduct_troll_coins` | Superseded by `troll_bank_spend_coins_secure` |
| `convert_trollz_to_coins` | Legacy currency conversion |
| `reset_troll_coins` | Admin reset, likely one-time |
| `reset_app_for_launch` | One-time launch function |
| `start_launch_trial` | Trial period function |
| `disable_payout_window` | Superseded by newer payout system |
| `enable_payout_window` | Superseded by newer payout system |
| `forward_payout_to_admin` | Legacy payout flow |
| `assistant_forward_payout_batch` | Legacy payout flow |
| `assistant_review_user_coins` | Legacy admin function |
| `admin_open_cashout_request` | Superseded |
| `admin_process_cashout_request` | Superseded |
| `request_friday_cashout` | Legacy cashout |
| `payout_trollmers_weekly` | Legacy payout |
| `distribute_weekly_earnings` | Legacy distribution |
| `distribute_prize` | Legacy distribution |
| `earn_coins` | Generic, likely superseded |
| `add_trollopoly_spectator` | Legacy game function |
| `join_trollopoly_queue` | Legacy game function |
| `leave_trollopoly_queue` | Legacy game function |
| `troll_opponent` | Legacy battle function |
| `troll_wars_current_week` | Legacy war function |
| `trollmin_grant_pardon` | Legacy government function |
| `issue_warrant` | Legacy officer function |
| `arrest_user` | Legacy officer function |
| `ban_officer` | Legacy officer function |
| `unban_officer` | Legacy officer function |
| `admin_suspend_officer` | Legacy officer function |
| `admin_set_officer_rank` | Legacy officer function |
| `set_lead_officer_status` | Legacy officer function |
| `is_lead_officer_position_filled` | Legacy officer function |
| `clock_in_from_slot` | Legacy time tracking |
| `clock_out_and_complete_slot` | Legacy time tracking |
| `officer_cashout_after_shift` | Legacy payout |
| `pay_stream_broadofficers_v1` | Legacy v1 payout |
| `verify_stamp` | Legacy document function |
| `assign_document` | Legacy document function |
| `sign_document` | Legacy document function |
| `approve_document` | Legacy document function |
| `deny_document` | Legacy document function |
| `reject_document` | Legacy document function |
| `scan_lot_barcode` | Legacy auction function |
| `record_auction_report` | Legacy auction function |
| `review_auction_report` | Legacy auction function |
| `review_auctioneer_application` | Legacy auction function |
| `record_song_play` | Legacy DJ function |
| `record_session` | Generic, possibly unused |
| `register_session` | Generic, possibly unused |
| `log_system_event` | Generic, possibly unused |
| `log_security_event` | Generic, possibly unused |
| `log_agency_activity` | Generic, possibly unused |
| `log_government_action` | Generic, possibly unused |
| `log_trollmin_action` | Generic, possibly unused |
| `log_stream_analytics_event` | Generic, possibly unused |
| `log_app_bug_report` | Generic, possibly unused |
| `update_system_health` | Generic, possibly unused |
| `update_system_setting` | Generic, possibly unused |
| `update_trade_cooldown` | Generic, possibly unused |
| `update_tm_profile` | Generic, possibly unused |
| `update_profile_costs` | Generic, possibly unused |
| `update_district_progress` | Generic, possibly unused |
| `update_house_condition` | Generic, possibly unused |
| `update_glow_color` | Generic, possibly unused |
| `update_order_fulfillment` | Generic, possibly unused |
| `update_appeal_media` | Generic, possibly unused |
| `update_agency_invite_status` | Generic, possibly unused |
| `heartbeat_presence` | Possibly unused |
| `increment` | Too generic, possibly unused |
| `increment_insurance_trigger` | Possibly unused |
| `increment_trollmonds` | Possibly unused |
| `increment_user_crowns` | Possibly unused |
| `cleanup_expired_user_purchases` | Possibly unused |
| `ensure_league_system_ready` | One-time setup |
| `create_system_league_event` | Possibly unused |
| `create_safety_alert` | Possibly unused |
| `resolve_security_event` | Possibly unused |
| `escalate_to_admin` | Possibly unused |
| `escalate_to_officer` | Possibly unused |
| `escalate_to_troll_court` | Possibly unused |
| `rollback_moderation_action` | Possibly unused |
| `review_appeal` | Possibly unused |
| `restore_banned_account` | Possibly unused |
| `relock_payouts` | Possibly unused |
| `auto_unlock_payouts` | Possibly unused |
| `get_payout_window_status` | Possibly unused |
| `mark_payout_window_notified` | Possibly unused |
| `notify_payouts_open_if_needed` | Possibly unused |
| `rotate_ad_queue` | Possibly unused |
| `submit_ad` | Possibly unused |
| `approve_ad` | Possibly unused |
| `deny_ad` | Possibly unused |
| `add_ad_to_queue` | Possibly unused |
| `moderate_product` | Possibly unused |
| `pin_product_to_broadcast` | Possibly unused |
| `unpin_product_from_broadcast` | Possibly unused |
| `buy_live_snack` | Possibly unused |
| `pay_kick_fee` | Possibly unused |
| `pay_kick_reentry_fee` | Possibly unused |
| `kick_user_paid` | Possibly unused |
| `use_broadcast_ability` | Possibly unused |
| `use_daily_free_spin` | Possibly unused |
| `use_trollmin_daily_limit` | Possibly unused |
| `activate_wheel_inventory_item` | Possibly unused |
| `spin_troll_wheel` | Possibly unused |
| `validate_broadcast_password` | Possibly unused |
| `invite_followers_to_broadcast` | Possibly unused |
| `unsubscribe_from_broadcaster` | Possibly unused |
| `enter_giveaway` | Possibly unused |
| `claim_giveaway_reward` | Possibly unused |
| `earn_hype_coin_watch_reward` | Possibly unused |
| `pride_complete_challenge` | Possibly unused |
| `pride_increment_progress` | Possibly unused |
| `ship_order` | Possibly unused |
| `fulfill_marketplace_order` | Possibly unused |
| `refund_marketplace_order` | Possibly unused |
| `request_marketplace_cancellation` | Possibly unused |
| `create_marketplace_appeal` | Possibly unused |
| `resolve_marketplace_dispute` | Possibly unused |
| `create_marketplace_review` | Possibly unused |
| `send_marketplace_message` | Possibly unused |
| `create_marketplace_listing` | Possibly unused |
| `purchase_listing_premium` | Possibly unused |
| `evaluate_seller_tier` | Possibly unused |
| `recalc_agency_tier` | Possibly unused |
| `calculate_agency_tier` | Possibly unused |
| `add_agency_points` | Possibly unused |
| `adjust_agency_points` | Possibly unused |
| `manage_agency_member` | Possibly unused |
| `accept_agency_invite` | Possibly unused |
| `create_agency_invite` | Possibly unused |
| `apply_for_agency_from_family` | Possibly unused |
| `apply_for_agency_with_fee` | Possibly unused |
| `approve_agency_application_atomic` | Possibly unused |
| `approve_family_agency_conversion` | Possibly unused |
| `reject_family_agency_conversion` | Possibly unused |
| `reject_empire_partner` | Possibly unused |
| `approve_empire_partner` | Possibly unused |
| `fulfill_visa_redemption` | Possibly unused |
| `request_visa_redemption` | Possibly unused |
| `approve_visa_redemption` | Possibly unused |
| `reject_visa_redemption` | Possibly unused |
| `record_dna_event` | Possibly unused |
| `record_fraud_flag` | Possibly unused |
| `record_profile_view` | Possibly unused |
| `record_troll_family_activity` | Possibly unused |
| `record_organization_audit` | Possibly unused |
| `record_dispute` | Possibly unused |
| `record_completed_sale` | Possibly unused |
| `record_battle_skip` | Possibly unused |
| `record_auction_report` | Possibly unused |
| `check_emergency_cooldown` | Possibly unused |
| `check_family_rate_limit` | Possibly unused |
| `check_game_cooldown` | Possibly unused |
| `check_trade_cooldown` | Possibly unused |
| `check_influencer_eligibility` | Possibly unused |
| `check_creator_weekly_eligibility` | Possibly unused |
| `is_broadofficer` | Possibly unused |
| `is_ip_banned` | Possibly unused |
| `is_user_chat_blocked` | Possibly unused |
| `can_access_staff_meeting` | Possibly unused |
| `can_send_utromail` | Possibly unused |
| `get_active_city_laws` | Possibly unused |
| `get_member_pending_payout` | Possibly unused |
| `setup_family_leader_tax` | Possibly unused |
| `evict_tenant` | Possibly unused |
| `sign_lease` | Possibly unused |
| `sign_lease_for_applicant` | Possibly unused |
| `pay_house_rent` | Possibly unused |
| `pay_rent` | Possibly unused |
| `buy_property_with_loan` | Possibly unused |
| `sell_vehicle_asset` | Possibly unused |
| `purchase_vehicle_asset` | Possibly unused |
| `apply_vehicle_upgrade` | Possibly unused |
| `pay_credit_card` | Possibly unused |
| `try_pay_with_credit_card` | Possibly unused |
| `process_gift_xp` | Possibly unused |
| `grant_xp` | Possibly unused |
| `award_family_xp` | Possibly unused |
| `award_game_coins` | Possibly unused |
| `grant_family_crown` | Possibly unused |
| `set_match_winner` | Possibly unused |
| `finish_random_battle` | Possibly unused |
| `forfeit_random_battle` | Possibly unused |
| `request_random_battle_rematch` | Possibly unused |
| `cancel_battle_challenge` | Possibly unused |
| `handle_battle_guest_leave` | Possibly unused |
| `join_battle` | Possibly unused |
| `leave_battle` | Possibly unused |
| `leave_battle_queue` | Possibly unused |
| `find_5v5_match` | Possibly unused |
| `find_match_candidate` | Possibly unused |
| `start_instant_battle` | Possibly unused |
| `start_troll_us_game` | Possibly unused |
| `end_troll_us_round` | Possibly unused |
| `end_trial_early` | Possibly unused |
| `create_troll_us_game` | Possibly unused |
| `start_trollmers_monthly_tournament` | Possibly unused |
| `cancel_trollmers_tournament` | Possibly unused |
| `process_game_action` | Possibly unused |
| `submit_game_vote` | Possibly unused |
| `create_game_match` | Possibly unused |
| `join_game_match` | Possibly unused |
| `join_game_seat` | Possibly unused |
| `start_inmate_call` | Possibly unused |
| `deduct_call_minutes` | Possibly unused |
| `kick_church_member` | Possibly unused |
| `perform_church_mod_action` | Possibly unused |
| `pride_complete_challenge` | Possibly unused |
| `pride_increment_progress` | Possibly unused |
| `admin_verify_gift_eligibility` | Possibly unused |
| `admin_verify_vehicle` | Possibly unused |
| `admin_create_vehicle` | Possibly unused |
| `admin_delete_vehicle` | Possibly unused |
| `admin_get_vehicle_stats` | Possibly unused |
| `admin_assign_zip_officers` | Possibly unused |
| `aggregate_stream_analytics` | Possibly unused |
| `update_stream_last_activity` | Possibly unused |
| `update_stream_viewer_count` | Possibly unused |
| `mark_stream_seat_live` | Possibly unused |
| `mark_sidebar_viewed` | Possibly unused |
| `mark_onboarding_complete` | Possibly unused |
| `respond_family_invite` | Possibly unused |
| `create_family_invite` | Possibly unused |
| `create_troll_family` | Possibly unused |
| `join_seat_atomic` | Possibly unused |
| `leave_seat_atomic` | Possibly unused |
| `approve_seat_request` | Possibly unused |
| `deny_seat_request` | Possibly unused |
| `remove_verification` | Possibly unused |
| `remove_broadofficer` | Possibly unused |
| `assign_broadofficer` | Possibly unused |
| `get_daily_earnings_series` | Possibly unused |
| `get_monthly_earnings` | Possibly unused |
| `submit_weekly_report` | Possibly unused |
| `submit_cashout_request` | Possibly unused |
| `submit_agency_application` | Possibly unused |
| `submit_ad` | Possibly unused |
| `shop_buy_perk` | Possibly unused |
| `purchase_admin_for_week` | Possibly unused |
| `purchase_rgb_broadcast` | Possibly unused |
| `purchase_entrance_effect` | Possibly unused |
| `purchase_house_upgrade` | Possibly unused |
| `purchase_landlord_license` | Possibly unused |
| `spend_president_treasury` | Possibly unused |
| `post_president_announcement` | Possibly unused |
| `file_impeachment_case` | Possibly unused |
| `file_civil_lawsuit` | Possibly unused |
| `expose_bribe` | Possibly unused |
| `extend_court_date` | Possibly unused |
| `auto_start_court_session` | Possibly unused |
| `auto_start_court_with_docket` | Possibly unused |
| `join_court_session` | Possibly unused |
| `get_current_court_session` | Possibly unused |
| `get_user_docket` | Possibly unused |
| `get_all_docket_entries` | Possibly unused |
| `hard_delete_court_case` | Possibly unused |
| `hard_delete_docket_entry` | Possibly unused |
| `judge_pardon_user` | Possibly unused |
| `trollmin_grant_pardon` | Possibly unused |
| `summon_user_to_court` | Possibly unused |
| `perform_moderation_action` | Possibly unused |
| `moderator_delete_stream_message` | Possibly unused |
| `moderator_disable_chat` | Possibly unused |
| `moderator_kick_user` | Possibly unused |
| `moderator_mute_user` | Possibly unused |
| `moderator_unmute_user` | Possibly unused |
| `ban_user_from_stream` | Possibly unused |
| `mute_user` | Possibly unused |
| `notify_all_users` | Possibly unused |
| `create_notification` | Possibly unused |
| `create_president_election` | Possibly unused |
| `create_president_proposal` | Possibly unused |
| `finalize_president_election` | Possibly unused |
| `signup_president_candidate` | Possibly unused |
| `approve_president_candidate` | Possibly unused |
| `reject_president_candidate` | Possibly unused |
| `vote_candidate_with_coins` | Possibly unused |
| `vote_trollmin_approval` | Possibly unused |
| `create_subscription` | Possibly unused |
| `create_order_with_escrow` | Possibly unused |
| `deposit_to_cashout_escrow` | Possibly unused |
| `delete_own_account` | Possibly unused |
| `deny_application` | Possibly unused |
| `deny_attorney_application` | Possibly unused |
| `deny_prosecutor_application` | Possibly unused |
| `approve_attorney_application` | Possibly unused |
| `approve_prosecutor_application` | Possibly unused |
| `reject_application` | Possibly unused |
| `check_daily_login` | Possibly unused |
| `get_district_onboarding_tour` | Possibly unused |
| `lookup_user_location` | Possibly unused |
| `store_user_geolocation` | Possibly unused |
| `register_session` | Possibly unused |
| `register_for_event` | Possibly unused |
| `cancel_event_registration` | Possibly unused |
| `create_event` | Possibly unused |
| `create_city_event` | Possibly unused |
| `create_document` | Possibly unused |
| `crypt_password` | Possibly unused |

### 2.3 Duplicate / Overlapping Functions

Functions with similar purposes that may have overlapping functionality:

| Function A | Function B | Notes |
|---|---|---|
| `add_coins` | `troll_bank_credit_coins` | Both add coins; `troll_bank_credit_coins` is the newer secure version |
| `deduct_coins` | `troll_bank_spend_coins` | Both spend coins; `troll_bank_spend_coins_secure` is the secure version |
| `troll_bank_spend_coins` | `troll_bank_spend_coins_secure` | Legacy vs secure variant |
| `try_pay_coins` | `try_pay_coins_secure` | Legacy vs secure variant |
| `send_gift` | `send_gift_v2` | v1 vs v2 of gift sending |
| `end_battle` | `end_battle_guarded` | Original vs guarded version |
| `end_battle_guarded` | `end_battle_with_rewards` | Guarded vs with-rewards variant |
| `purchase_car` | `purchase_car_v2` | Legacy vs current vehicle purchase |
| `find_opponent` | `find_random_battle_match` | Legacy vs current matchmaking |
| `accept_battle` | `captain_click_battle` | Different battle acceptance flows |
| `spend_coins` | `troll_bank_spend_coins_secure` | Generic vs bank-specific spending |
| `admin_grant_coins` | `troll_bank_credit_coins` | Admin-specific vs general credit |
| `add_free_coins` | `credit_free_coins` | Two free coin functions |
| `get_user_coins` | `get_eligible_gift_coins` | Different coin balance queries |
| `is_admin` | `is_admin_user` | Duplicate admin checks |
| `is_not_banned` | `is_not_suspended` | Similar status checks |
| `has_role` | `has_role_fast` | Standard vs optimized role check |
| `calculate_level` | `calculate_level_from_xp` | Different level calculation approaches |
| `get_xp_for_level` | `xp_min_for_level` | Similar XP/level functions |
| `refresh_my_daily_stats` | `refresh_user_auth_cache` | Different refresh functions |
| `trigger_refresh_user_auth_cache` | `refresh_user_auth_cache` | Trigger vs direct call |
| `get_referral_list` | `get_referral_stats` | List vs stats for referrals |
| `get_referral_cashout_bonus` | `get_referred_user_cashout_bonus` | Similar referral bonus functions |
| `process_referral_rewards` | `check_referral_qualification` | Different referral processing |
| `get_post_earnings` | `get_post_engagement` | Earnings vs engagement for posts |
| `credit_free_coins` | `add_free_coins` | Duplicate free coin functions |
| `create_notification` | `bulk_create_notifications` | Single vs bulk notification |
| `mute_user` | `unmute_user` | Paired functions (not duplicates but related) |
| `ban_user` | `unban_user` | Paired functions |
| `join_family` | `leave_family` | Paired functions |
| `join_game_match` | `leave_battle` | Paired functions |
| `join_seat_atomic` | `leave_seat_atomic` | Paired functions |
| `enable_payout_window` | `disable_payout_window` | Paired functions |
| `relock_payouts` | `auto_unlock_payouts` | Paired functions |
| `approve_document` | `deny_document` | Paired functions |
| `sign_lease` | `sign_lease_for_applicant` | Similar lease functions |
| `purchase_broadcast_theme` | `purchase_broadcast_theme_with_credit` | Theme purchase variants |
| `execute_buy_order` | `execute_sell_order` | Paired trading functions |
| `get_portfolio_summary` | `get_portfolio_value` | Similar portfolio functions |
| `get_daily_earnings_series` | `get_monthly_earnings` | Different time period earnings |
| `get_hourly_activity` | `get_active_streams_paged` | Different analytics functions |
| `generate_family_goals` | `generate_weekly_goals` | Different goal generation |
| `create_family_tasks` | `generate_family_goals` | Related family functions |
| `get_family_heartbeat` | `get_family_online_members` | Similar family status functions |
| `get_family_leaderboard` | `get_agency_leaderboard` | Different leaderboard functions |
| `get_gift_leaderboard` | `get_top_gifters` | Similar gift leaderboard functions |
| `get_tm_matches` | `get_trollmin_queue` | Similar queue/match functions |
| `get_trollmin_activity_feed` | `get_trollmin_stats` | Similar trollmin functions |
| `get_current_trollmin` | `get_trollmin_queue` | Similar trollmin functions |
| `get_current_payout_batch` | `get_pending_payouts_summary` | Similar payout functions |
| `get_pending_payouts_for_review` | `get_pending_payouts_summary` | Similar payout functions |
| `get_cashout_request_details` | `get_current_payout_batch` | Similar payout functions |
| `get_all_creator_applications` | `review_creator_application` | Related creator functions |
| `get_all_docket_entries` | `get_user_docket` | Similar docket functions |
| `get_user_accessible_districts` | `get_district_onboarding_tour` | Similar district functions |
| `get_user_assets` | `get_vehicle_catalog` | Similar asset functions |
| `get_vehicle_transactions` | `get_vehicle_catalog` | Similar vehicle functions |
| `get_user_rewards` | `claim_user_league_mission` | Similar reward functions |
| `get_user_conversations_optimized` | `find_shared_conversation` | Similar conversation functions |
| `find_utromail_thread` | `find_shared_conversation` | Similar thread functions |
| `get_staff_user_ids` | `is_staff` | Related staff functions |
| `get_system_settings` | `update_system_setting` | Related system functions |
| `get_next_tier_threshold` | `get_buckets_summary_for_user` | Similar tier functions |
| `get_seller_reviews` | `evaluate_seller_tier` | Related seller functions |
| `get_market_stats` | `get_moderation_logs` | Different admin functions |
| `get_moderation_logs` | `get_admin_finance_summary_live` | Different admin functions |
| `get_admin_dashboard_metrics_v1` | `get_admin_finance_summary_live` | Similar admin dashboard functions |
| `get_broadofficers` | `is_broadofficer` | Related broadofficer functions |
| `get_call_balances` | `deduct_call_minutes` | Related call functions |
| `get_delinquent_loan_users` | `pay_bank_loan` | Related loan functions |
| `get_emergency_user_info` | `check_emergency_cooldown` | Related emergency functions |
| `get_eligible_gift_coins` | `admin_verify_gift_eligibility` | Related gift functions |
| `get_vote_weight` | `vote_for_president_candidate` | Related vote functions |
| `get_or_create_wheel_session` | `spin_troll_wheel` | Related wheel functions |
| `get_daily_free_spins` | `use_daily_free_spin` | Related spin functions |
| `get_active_giveaways` | `enter_giveaway` | Related giveaway functions |
| `get_active_event` | `get_active_event_signup_count` | Related event functions |
| `get_active_streams_paged` | `get_active_city_laws` | Different "get active" functions |

---

## 3. MIGRATIONS

### 3.1 Required Migrations (Core Schema)

These migrations form the essential database schema and must be applied:

| Migration | Purpose |
|---|---|
| `20230101000000_baseline.sql` | Core schema — ~400 tables, base functions, triggers |
| `20240101_xp_system.sql` | XP/level system |
| `20240321000000_fix_extension_and_materialized_view.sql` | Extension & view fixes |
| `20240321000001_fix_rls_policies.sql` | Initial RLS policy fixes |
| `20240321000002_fix_all_search_paths.sql` | Search path fixes |
| `20240415000001_create_support_tickets.sql` | Support ticket system |
| `20240523000000_mobile_error_logs.sql` | Mobile error logging |
| `20250201100000_universe_event_tables.sql` | Tournament system |
| `20250202100000_broadcast_overhaul.sql` | Broadcast system overhaul |
| `20250202110000_paid_features.sql` | Paid features |
| `20250202120000_moderation.sql` | Moderation system |
| `20250202130000_battles.sql` | Battle system |
| `20250202140000_battle_scoring.sql` | Battle scoring |
| `20250204_soft_delete_messages.sql` | Conversation soft delete |
| `20250425000000_saved_streams.sql` | Saved streams |
| `20250425000001_troll_court_evidence.sql` | Court evidence |
| `20260115000000_stripe_coin_purchases.sql` | Stripe payments |
| `20260117100000_car_property_insurance.sql` | Insurance system |
| `20260118230000_user_cars_properties.sql` | User cars & properties |
| `20260120000000_troll_bank_init.sql` | Bank system |
| `20260128154000_create_loan_credit_tables.sql` | Loans & credit |
| `20260203215000_universal_rls_system.sql` | Universal RLS |
| `20260204000000_active_asset_economy.sql` | Asset economy |
| `20260220000000_comprehensive_gifts_system.sql` | Gift system |
| `20260317000000_family_system_bootstrap.sql` | Family system |
| `20260322000000_integrated_battle_system.sql` | Battle system v2 |
| `20260331000001_next_gen_live_streaming_system.sql` | Streaming system |
| `20260410000000_troll_us_game_system.sql` | Game system |
| `20260411000000_trollopoly_system.sql` | Trollopoly |
| `20260506000000_add_subscription_system.sql` | Subscriptions |
| `20260604000000_create_admin_reports_tables.sql` | Admin reports |
| `20260608000000_hytro_gaming_agency_system.sql` | Agency system |
| `20260609000001_notary_document_system.sql` | Document system |
| `20260609000002_calendar_event_system.sql` | Calendar system |
| `20260611000000_utromail_tromail_system.sql` | Mail system |
| `20260615000000_academy_phase2_completion.sql` | Academy |
| `20260617000000_vehicle_asset_system_complete.sql` | Vehicle assets |

### 3.2 Historical Migrations (Already Applied / Superseded)

These migrations have likely already been applied and their changes absorbed into the current schema:

| Migration | Purpose | Status |
|---|---|---|
| `20240410120000_add_facebook_platform.sql` | Facebook integration | Historical |
| `20240410130000_fix_signup_coins.sql` | Signup coin fix | Historical |
| `20240524000000_rls_performance_optimization.sql` | RLS optimization | Historical |
| `20240525000001_kick_church_member.sql` | Church kick function | Historical |
| `20250201120000_fix_universe_event_schema.sql` | Universe event fix | Historical |
| `20250202120001_unify_gift_rpc.sql` | Gift RPC unification | Historical |
| `20260115000500_add_unique_officer_shift_slots.sql` | Officer shift fix | Historical |
| `20260115001000_stripe_coin_purchases.sql` | Duplicate of 20260115000000 | **CONFLICT** |
| `20260116090000_manual_coin_orders.sql` | Manual orders | Historical |
| `20260116093010_add_password_reset_pin.sql` | Password reset | Historical |
| `20260117000000_manual_clock_in.sql` | Clock in | Historical |
| `20260120000100_update_legacy_rpc.sql` | Legacy RPC update | Historical |
| `20260120000200_update_legacy_rpcs.sql` | Legacy RPC update | Historical |
| `20260120000250_fix_troll_wall_gifts.sql` | Wall gift fix | Historical |
| `20260120000300_refactor_more_legacy_rpcs.sql` | Legacy RPC refactor | Historical |
| `20260120000400_refactor_remaining_legacy_functions.sql` | Legacy function refactor | Historical |
| `20260120000500_update_bank_credit_feature_flags.sql` | Bank flags | Historical |
| `20260120000600_missing_gift_rpcs.sql` | Missing gift RPCs | Historical |
| `20260120000700_replace_gift_lucky.sql` | Gift lucky replace | Historical |
| `20260120001000_legacy_wrappers.sql` | Legacy wrappers | Historical |
| `20260120001500_update_bank_tiers.sql` | Bank tiers | Historical |
| `20260120001600_troll_pass_and_repayment.sql` | Troll pass | Historical |
| `20260120001700_fix_loan_application.sql` | Loan fix | Historical |
| `20260120001800_adjust_bank_tiers.sql` | Bank tier adjustment | Historical |
| `20260120001900_add_gift_history_rpc.sql` | Gift history | Historical |
| `20260120002000_fix_ledger_direction.sql` | Ledger direction fix | Historical |
| `20260120003000_fix_broadcast_theme.sql` | Broadcast theme fix | Historical |
| `20260121000001_fix_broadcaster_trigger.sql` | Broadcaster trigger fix | Historical |
| `20260121000002_secretary_approvals.sql` | Secretary approvals | Historical |
| `20260121001000_add_property_names_and_usernames.sql` | Property names | Historical |
| `20260121002000_automate_family_tasks.sql` | Family task automation | Historical |
| `20260121003000_fix_insurance_plan_id_type.sql` | Insurance type fix | Historical |
| `20260121120000_insurance_per_car_pricing.sql` | Car insurance pricing | Historical |
| `20260122000000_fix_secretary_assignments_rls.sql` | Secretary RLS fix | Historical |
| `20260122000001_fix_random_battle_pending_stuck.sql` | Battle stuck fix | Historical |
| `20260125220000_fix_purchase_broadcast_theme_rpc.sql` | Theme purchase fix | Historical |
| `20260202130000_allow_system_errors_insert.sql` | System errors | Historical |
| `20260203000000_chat_performance_fix.sql` | Chat performance | Historical |
| `20260203000001_schedule_gift_batch.sql` | Gift batch scheduling | Historical |
| `20260203000002_gift_observability.sql` | Gift observability | Historical |
| `20260203000003_leaderboard_view.sql` | Leaderboard view | Historical |
| `20260203000004_fix_gift_schema.sql` | Gift schema fix | Historical |
| `20260203201547_add_is_battle_column.sql` | Battle column | Historical |
| `20260203202500_apply_tmv_rebuild.sql` | TMV rebuild | Historical |
| `20260203210000_unified_loans_and_licenses.sql` | Unified loans | Historical |
| `20260203220000_fix_president_proposals.sql` | President proposals | Historical |
| `20260203233000_add_government_sector.sql` | Government sector | Historical |
| `20260204000000_mobile_error_logging.sql` | Mobile error logging | Historical |
| `20260204000001_asset_logic.sql` | Asset logic | Historical |
| `20260204000002_purchase_functions.sql` | Purchase functions | Historical |
| `20260204000003_rentals_auctions_logic.sql` | Rental/auction logic | Historical |
| `20260204000004_purchase_logic.sql` | Purchase logic | Historical |
| `20260204000005_rental_market_policy.sql` | Rental policy | Historical |
| `20260204000006_house_upgrades.sql` | House upgrades | Historical |
| `20260204000007_hotel_tax.sql` | Hotel tax | Historical |
| `20260210120000_database_cleanup.sql` | Database cleanup | Historical |
| `20260210204920_fix_purchase_function_signature.sql` | Purchase signature fix | Historical |
| `20260210204921_fix_property_types_permissions.sql` | Property permissions | Historical |
| `20260211000000_chatgpt_fixes.sql` | ChatGPT fixes | Historical |
| `20260211000001_chatgpt_rpcs.sql` | ChatGPT RPCs | Historical |
| `20260211000002_fix_send_gift_lookup.sql` | Gift lookup fix | Historical |
| `20260211000003_create_set_stream_box_count.sql` | Stream box count | Historical |
| `20260211020000_add_onesignal_tokens.sql` | OneSignal tokens | Historical |
| `20260211100000_battle_refactor_single_room.sql` | Battle refactor | Historical |
| `20260211101000_end_battle_guarded.sql` | End battle guarded | Historical |
| `20260211102000_add_stream_messages_type.sql` | Stream message type | Historical |
| `20260211103000_fix_guest_snapshot_top3.sql` | Guest snapshot fix | Historical |
| `20260211104000_drop_old_end_battle.sql` | Drop old end_battle | Historical |
| `20260211105000_fix_stream_messages_rls.sql` | Stream messages RLS | Historical |
| `20260212000000_auto_distribute_winnings.sql` | Auto distribute | Historical |
| `20260212000000_platform_event_limits.sql` | Platform limits | Historical |
| `20260212000001_moderation_expiry_logic.sql` | Moderation expiry | Historical |
| `20260212000002_fix_moderation_constraints.sql` | Moderation constraints | Historical |
| `20260213000000_idempotent_persistence.sql` | Idempotent persistence | Historical |
| `20260213000001_ensure_guest_access.sql` | Guest access | Historical |
| `20260213000002_seasonal_goal_system.sql` | Seasonal goals | Historical |
| `20260213000003_staff_goal_bypass.sql` | Staff goal bypass | Historical |
| `20260213000004_dynamic_goal_metrics.sql` | Dynamic goals | Historical |
| `20260213000005_dynamic_goal_metrics_seed.sql` | Goal seed data | Historical |
| `20260215000000_fix_stream_messages_rls.sql` | Stream messages RLS (duplicate) | **DUPLICATE** |
| `20260220000001_live_commerce_system.sql` | Live commerce | Historical |
| `20260221000000_appeals_system.sql` | Appeals system | Historical |
| `20260223000000_remove_daily_pod_limit.sql` | Pod limit removal | Historical |
| `20260223000001_remove_broadcast_limits.sql` | Broadcast limit removal | Historical |
| `20260224161000_broadcaster_moderation_locks.sql` | Moderation locks | Historical |
| `20260225000000_create_mai_talent_queue.sql` | MAI talent queue | Historical |
| `20260225000001_create_mai_talent_shows.sql` | MAI talent shows | Historical |
| `20260225000002_create_mai_talent_judge_votes.sql` | MAI judge votes | Historical |
| `20260225000003_add_is_judge_to_profiles.sql` | Judge profile flag | Historical |
| `20260225000004_admin_read_all_users_policy.sql` | Admin read policy | Historical |
| `20260225000005_create_get_my_role_function.sql` | Get role function | Historical |
| `20260225000006_fix_admin_read_policy.sql` | Admin policy fix | Historical |
| `20260225000007_create_mai_talent_v2_tables.sql` | MAI v2 tables | Historical |
| `20260225000008_add_show_id_to_votes.sql` | Show ID on votes | Historical |
| `20260225000008_create_fill_stage_slot_function.sql` | Fill stage slot | Historical |
| `20260225000009_create_leave_stage_function.sql` | Leave stage | Historical |
| `20260225000009_update_mai_talent_judge_votes.sql` | MAI votes update | **DUPLICATE timestamp** |
| `20260225000010_add_end_pod_rpc.sql` | End pod RPC | Historical |
| `20260225000010_create_global_events.sql` | Global events | **DUPLICATE timestamp** |
| `20260225000011_add_judge_seats.sql` | Judge seats | Historical |
| `20260226000001_create_global_gift_system.sql` | Global gifts | Historical |
| `20260227000000_enable_tcps_realtime.sql` | TCPS realtime | Historical |
| `20260227000000_remove_daily_pod_limit_complete.sql` | Pod limit complete | **DUPLICATE timestamp** |
| `20260227000001_create_giveaway_system.sql` | Giveaway system | Historical |
| `20260227100000_allow_all_users_broadcast.sql` | All users broadcast | Historical |
| `20260301180000_refresh_user_levels_from_gifts.sql` | Level refresh | Historical |
| `20260301181000_create_refresh_user_levels_rpc.sql` | Level refresh RPC | Historical |
| `20260304000000_audio_safety_and_location_system.sql` | Audio safety | Historical |
| `20260317000000_update_trollmin_entry_cost.sql` | Trollmin cost | Historical |
| `20260321000000_update_cashout_tiers_final.sql` | Cashout tiers | Historical |
| `20260322000000_create_rtc_sessions_table.sql` | RTC sessions | Historical |
| `20260322000000_fix_rls_policies.sql` | RLS fix | **DUPLICATE timestamp** |
| `20260322000000_marketplace_orders.sql` | Marketplace | **DUPLICATE timestamp** |
| `20260322000001_fix_all_rls_policies.sql` | RLS fix | Historical |
| `20260322000002_comprehensive_rls_fix.sql` | Comprehensive RLS | Historical |
| `20260323000000_credit_marketplace_seller.sql` | Credit marketplace | Historical |
| `20260325000000_fix_paid_seat_host_payout.sql` | Seat payout fix | Historical |
| `20260331000000_empire_partner_referral_system.sql` | Empire referrals | Historical |
| `20260404000000_marketplace_order_enhancements.sql` | Marketplace enhancements | Historical |
| `20260405000000_marketplace_rls_policies.sql` | Marketplace RLS | Historical |
| `20260408000000_family_ban_member.sql` | Family ban | Historical |
| `20260409000000_fix_cashout_only_purchased_coins.sql` | Cashout fix | Historical |
| `20260409000001_cashout_escrow_system.sql` | Cashout escrow | Historical |
| `20260409000002_cashout_notifications_cron.sql` | Cashout notifications | Historical |
| `20260409160000_battle_sync_columns.sql` | Battle sync | Historical |
| `20260409180000_battle_handshake.sql` | Battle handshake | Historical |
| `20260409190000_battle_matching_columns.sql` | Battle matching | Historical |
| `20260409200000_atomic_battle_matching.sql` | Atomic matching | Historical |
| `20260409210000_authoritative_battle_system.sql` | Authoritative battles | Historical |
| `20260409220000_strict_battle_handshake.sql` | Strict handshake | Historical |
| `20260410000000_x_ads_system.sql` | X ads | Historical |
| `20260410000001_battle_score_rpc.sql` | Battle score RPC | Historical |
| `20260410140000_create_admin_notifications.sql` | Admin notifications | Historical |
| `20260411000000_stream_moderation_and_court_tables.sql` | Stream moderation | Historical |
| `20260411000000_troll_us_game.sql` | Troll US game | **DUPLICATE timestamp** |
| `20260414000000_fix_neighbors_events.sql` | Neighbors fix | Historical |
| `20260414000000_marketing_readonly_rls.sql` | Marketing RLS | **DUPLICATE timestamp** |
| `20260414000001_fix_marketing_rls.sql` | Marketing RLS fix | Historical |
| `20260415000000_comprehensive_court_fix.sql` | Court fix | Historical |
| `20260415000000_court_participants.sql` | Court participants | **DUPLICATE timestamp** |
| `20260415000000_emergency_fix.sql` | Emergency fix | **DUPLICATE timestamp** |
| `20260415000000_marketing_users_api.sql` | Marketing API | **DUPLICATE timestamp** |
| `20260415000001_court_participants_rpc.sql` | Court participants RPC | Historical |
| `20260416000000_fix_court_type_mismatches.sql` | Court type fix | Historical |
| `20260417000000_add_is_active_to_web_push_subscriptions.sql` | Web push active | Historical |
| `20260417000001_drop_onesignal_tokens.sql` | Drop OneSignal | Historical |
| `20260420000000_add_mic_muted_to_stream_participants.sql` | Mic muted | Historical |
| `20260420000001_add_global_chat_disabled.sql` | Global chat disabled | Historical |
| `20260420000002_mod_actions_rpcs.sql` | Mod actions | Historical |
| `20260420000003_add_updated_at_to_court_dockets.sql` | Court docket timestamp | Historical |
| `20260420000004_fix_jail_arrest_columns.sql` | Jail columns | Historical |
| `20260420000005_auto_generate_court_dockets.sql` | Auto docket generation | Historical |
| `20260420000006_fix_court_dockets_cases_count.sql` | Docket count fix | Historical |
| `20260420000007_fix_jail_and_court_columns.sql` | Jail/court columns | Historical |
| `20260420000008_force_fix_columns.sql` | Force column fix | Historical |
| `20260421235959_add_missing_court_columns.sql` | Missing court columns | Historical |
| `20260422000000_add_admin_analytics.sql` | Admin analytics | Historical |
| `20260425000000_fix_houses_owner_id_constraint.sql` | Houses constraint | Historical |
| `20260425000001_fix_car_purchase_vehicle_id.sql` | Car purchase fix | Historical |
| `20260425000001_fix_houses_owner_id_direct.sql` | Houses constraint direct | **DUPLICATE timestamp** |
| `20260428000000_payout_window_control.sql` | Payout window | Historical |
| `20260429000000_create_app_bug_reports.sql` | Bug reports | Historical |
| `20260506000000_add_subscription_system.sql` | Subscriptions | Historical |
| `20260508000001_fix_payout_requests_user_profiles_fkey.sql` | Payout FK fix | Historical |
| `20260512051200_fix_cashout_tiers.sql` | Cashout tiers fix | Historical |
| `20260513000003_enhanced_cashout_system.sql` | Enhanced cashout | Historical |
| `20260514000100_remove_president_requirements.sql` | President requirements | Historical |
| `20260515000001_cron_process_offline_notifications.sql` | Offline notifications | Historical |
| `20260515000002_clean_notification_schema.sql` | Notification cleanup | Historical |
| `20260516000000_stream_seat_requests_queue.sql` | Seat request queue | Historical |
| `20260517000000_drop_mux_integration.sql` | MUX removal | Historical |
| `20260518000000_trollseat_request_approval_pipeline.sql` | Seat approval | Historical |
| `20260519000000_trollseat_broadcaster_approval.sql` | Broadcaster approval | Historical |
| `20260519000001_create_stream_stage_passes.sql` | Stage passes | Historical |
| `20260519105111_expand_user_roles_check_constraint.sql` | Role constraint | Historical |
| `20260519105400_add_reason_to_role_change_log.sql` | Role change reason | Historical |
| `20260520000000_payout_methods_and_raid_logs.sql` | Payout methods | Historical |
| `20260520113700_badge_tier_progress_and_showcase.sql` | Badge tier | Historical |
| `20260520121011_user_specific_badges_and_troll.sql` | User badges | Historical |
| `20260523000000_random_battle_activation_fix.sql` | Random battle fix | Historical |
| `20260526000001_create_support_goal_reminder_dismissals.sql` | Goal dismissals | Historical |
| `20260526000001_troll_family_leagues_system.sql` | Family leagues | **DUPLICATE timestamp** |
| `20260527000000_update_subscription_system.sql` | Subscription update | Historical |
| `20260527202922_security_command_center.sql` | Security center | Historical |
| `20260529223744_fix_inmate_messages_rls.sql` | Inmate messages RLS | Historical |
| `20260529_approve_empire_partner_tromail.sql` | Empire partner | Historical |
| `20260529_coin_balance_cashout_system.sql` | Coin balance cashout | Historical |
| `20260530000000_add_vin_verification_to_vehicle_listings.sql` | VIN verification | Historical |
| `20260530000000_church_live_and_mod.sql` | Church live | **DUPLICATE timestamp** |
| `20260530000001_add_vehicle_listing_inspection_and_business_profile.sql` | Vehicle inspection | Historical |
| `20260530_notify_on_post_mentions.sql` | Post mention notifications | Historical |
| `20260601000000_add_stream_last_activity.sql` | Stream activity | Historical |
| `20260601000001_fix_homeowners_insurance_columns.sql` | Insurance columns | Historical |
| `20260601000002_give_starter_coins.sql` | Starter coins | Historical |
| `20260604001000_add_is_streamer_user_profiles.sql` | Streamer flag | Historical |
| `20260604002000_add_payout_method_payout_requests.sql` | Payout method | Historical |
| `20260604003000_add_reviewed_by_payout_requests.sql` | Reviewed by | Historical |
| `20260604004000_drop_user_tax_info_auth_fk.sql` | Tax FK removal | Historical |
| `20260604005000_disable_payout_lock.sql` | Payout lock | Historical |
| `20260604006000_relax_payout_triggers.sql` | Payout trigger relax | Historical |
| `20260604007000_drop_payout_requests_auth_fk.sql` | Payout FK removal | Historical |
| `20260604008000_drop_payout_requests_extra_fk.sql` | Payout extra FK | Historical |
| `20260604009000_relax_admin_pool_fk.sql` | Admin pool FK | Historical |
| `20260605000000_fix_everything_audit.sql` | Everything audit | Historical |
| `20260605000000_ghost_stream_sessions.sql` | Ghost sessions | **DUPLICATE timestamp** |
| `20260606000000_admin_pool.sql` | Admin pool | Historical |
| `20260606001000_relax_admin_pool_fk.sql` | Admin pool FK | Historical |
| `20260606002000_conversation_members_user_fk.sql` | Conversation FK | Historical |
| `20260606002001_relax_streams_broadcaster.sql` | Stream broadcaster FK | Historical |
| `20260606003000_relax_action_logs_fk.sql` | Action log FK | Historical |
| `20260607000000_add_livekit_rtmp_url.sql` | LiveKit RTMP | Historical |
| `20260607000000_admin_pool_v2.sql` | Admin pool v2 | **DUPLICATE timestamp** |
| `20260607000001_telemetry_events.sql` | Telemetry | Historical |
| `20260608000000_hytro_gaming_agency_system.sql` | Agency system | Historical |
| `20260608000000_live_broadcast_updates.sql` | Broadcast updates | **DUPLICATE timestamp** |
| `20260608000000_page_visibility.sql` | Page visibility | **DUPLICATE timestamp** |
| `20260608000000_pride_legacy_theme.sql` | Pride theme | **DUPLICATE timestamp** |
| `20260608000001_shift_calendar_policy.sql` | Shift calendar | Historical |
| `20260609000000_fix_default_coins.sql` | Default coins | Historical |
| `20260609000000_verified_badge_subscription.sql` | Verified badge | **DUPLICATE timestamp** |
| `20260609000001_notary_document_system.sql` | Notary system | Historical |
| `20260609000001_officer_of_week_voting.sql` | Officer voting | **DUPLICATE timestamp** |
| `20260609000002_calendar_event_system.sql` | Calendar system | Historical |
| `20260609001000_extend_coin_transaction_types_troll_town.sql` | Coin types | Historical |
| `20260609002000_notify_payouts_open_once_per_day.sql` | Payout notification | Historical |
| `20260609002001_fix_payout_notification_window.sql` | Payout window fix | Historical |
| `20260609004000_fix_payout_schedule_mst.sql` | Payout schedule | Historical |
| `20260609005000_update_coin_rate.sql` | Coin rate | Historical |
| `20261001000000_conversation_members_insert_policy.sql` | Conversation policy | Historical |
| `20261001001000_add_owned_vehicle_ids.sql` | Owned vehicles | Historical |
| `20261001002000_live_sessions_wallet_transactions.sql` | Live sessions wallet | Historical |
| `20270101000000_add_capacity_queue_system.sql` | Capacity queue | Historical |
| `20270101000000_cleanup_payment_methods.sql` | Payment cleanup | **DUPLICATE timestamp** |
| `20270102000000_square_customer_card_fix.sql` | Square fix | Historical |
| `20270103000000_troll_city_saved_cards.sql` | Saved cards | Historical |
| `20270120000800_admin_wallet_view.sql` | Admin wallet view | Historical |
| `20270120000900_admin_pool_allocations.sql` | Admin pool allocations | Historical |
| `20270120001000_fix_cashout_escrow.sql` | Cashout escrow fix | Historical |
| `20270120001100_fix_admin_cashout_rpc.sql` | Admin cashout fix | Historical |
| `20270120001200_admin_pool_officer_pay.sql` | Officer pay | Historical |
| `20270120001300_update_bank_tiers_and_store.sql` | Bank tiers | Historical |
| `20270120001400_fix_manual_orders_and_bank.sql` | Manual orders fix | Historical |
| `20270120002500_manual_orders_soft_delete.sql` | Soft delete | Historical |
| `20270120003000_fix_coin_ledger_direction_constraint.sql` | Ledger constraint | Historical |
| `20270120003500_officer_breaks.sql` | Officer breaks | Historical |
| `20270120004000_fix_conversation_policies.sql` | Conversation policies | Historical |
| `20270120005000_fix_manual_clock_in.sql` | Clock in fix | Historical |
| `20270120005500_fix_message_policies.sql` | Message policies | Historical |
| `20270120006000_fix_officer_policies.sql` | Officer policies | Historical |
| `20270120007000_broadofficers_setup.sql` | Broadofficers setup | Historical |
| `20270120008000_troll_battles_setup.sql` | Troll battles setup | Historical |
| `20270120008001_troll_battles_scoring.sql` | Battle scoring | Historical |
| `20270120008002_troll_battles_finalize.sql` | Battle finalize | Historical |
| `20270120008005_fix_find_opponent.sql` | Find opponent fix | Historical |
| `20270120008006_fix_find_opponent_rpc.sql` | Find opponent RPC fix | Historical |
| `20270120009000_sell_house_to_bank.sql` | Sell house | Historical |
| `20270120009200_creator_approval_logic.sql` | Creator approval | Historical |
| `20270120009500_fix_pitch_contests_rls.sql` | Pitch contests RLS | Historical |
| `20270120009501_fix_wallet_view_type.sql` | Wallet view fix | Historical |
| `20270120009550_create_pitch_contests.sql` | Pitch contests | Historical |
| `20270120009600_add_title_to_pitch_contests.sql` | Pitch title | Historical |
| `20270120010000_court_dockets_and_pitch_status.sql` | Court dockets | Historical |
| `20270120010001_fix_creator_claims.sql` | Creator claims fix | Historical |
| `20270120011000_fix_wallet_rpc_types.sql` | Wallet RPC types | Historical |
| `20270120012000_explicit_claims_fk.sql` | Claims FK | Historical |
| `20270120020000_fix_wallet_view_type_v2.sql` | Wallet view v2 | Historical |
| `20270121000000_fix_officer_sessions_and_court_rpc.sql` | Officer sessions | Historical |
| `20270121000001_inventory_expiry.sql` | Inventory expiry | Historical |
| `20270121010000_credit_score_system.sql` | Credit score | Historical |
| `20270121020000_update_summon_rpc.sql` | Summon RPC | Historical |
| `20270121030000_badge_system.sql` | Badge system | Historical |
| `20270121041500_badge_icons.sql` | Badge icons | Historical |
| `20270121050000_comprehensive_badge_system.sql` | Comprehensive badges | Historical |
| `20270121060000_credit_score_trigger.sql` | Credit score trigger | Historical |
| `20270121060001_fix_user_cars_fk.sql` | User cars FK | Historical |
| `20270121070000_daily_login_posts_system.sql` | Daily login posts | Historical |
| `20270121080000_seed_insurance_options.sql` | Insurance seed | Historical |
| `20270121090000_fix_insurance_foreign_keys.sql` | Insurance FK | Historical |
| `20270122090000_troting_and_pitches.sql` | Troting/pitches | Historical |
| `20270122130000_fix_rls_security.sql` | RLS security | Historical |
| `20270122140000_fix_linter_issues.sql` | Linter fixes | Historical |
| `20270122150000_fix_ambiguous_rpc.sql` | Ambiguous RPC fix | Historical |
| `20270122151000_message_read_rpc.sql` | Message read RPC | Historical |
| `20270122152000_seed_themes.sql` | Theme seed | Historical |
| `20270123100000_fix_function_search_paths.sql` | Search paths | Historical |
| `20270123110000_fix_search_paths_v3.sql` | Search paths v3 | Historical |
| `20270123120000_fix_rls_performance.sql` | RLS performance | Historical |
| `20270124100000_fix_read_rpcs.sql` | Read RPCs fix | Historical |
| `20270124150000_cleanup_purchase_theme_rpc.sql` | Purchase theme cleanup | Historical |
| `20270124151000_fix_ambiguous_daily_login_final.sql` | Daily login fix | Historical |
| `20270124152000_secure_check_daily_login.sql` | Secure daily login | Historical |
| `20270125000000_court_docket_updates.sql` | Court docket updates | Historical |
| `20270125000050_create_broadcast_seat_bans.sql` | Seat bans | Historical |
| `20270125000100_fix_spend_coins_ambiguity.sql` | Spend coins fix | Historical |
| `20270125130000_fix_family_recursion.sql` | Family recursion fix | Historical |
| `20270125140000_fix_ledger_direction_in_rpcs.sql` | Ledger direction | Historical |
| `20270125160000_create_broadcasts_view.sql` | Broadcasts view | Historical |
| `20270125170000_vehicle_titles.sql` | Vehicle titles | Historical |
| `20270125180000_admin_oversight_rls.sql` | Admin oversight RLS | Historical |
| `20270125190000_sync_deeds_and_properties.sql` | Deeds sync | Historical |
| `20270125200000_public_pool_and_deeds.sql` | Public pool | Historical |
| `20270125200100_fix_public_pool_function.sql` | Public pool fix | Historical |
| `20270125203000_fix_admin_pool_access.sql` | Admin pool access | Historical |
| `20270125210000_add_badge_stats_rpcs.sql` | Badge stats RPCs | Historical |
| `20270126100000_fix_signup_flow.sql` | Signup flow fix | Historical |
| `20270126100001_ensure_signup_constraints.sql` | Signup constraints | Historical |
| `20270127000000_fix_signup_trigger_legacy.sql` | Signup trigger | Historical |
| `20270127010000_fix_missing_constraints.sql` | Missing constraints | Historical |
| `20270127020000_add_free_troll_coins.sql` | Free troll coins | Historical |
| `20270128000000_fix_coin_audit_rls.sql` | Coin audit RLS | Historical |
| `20270128000001_track_family_event.sql` | Family event tracking | Historical |
| `20270128000002_fix_mark_read_rpcs.sql` | Mark read RPCs | Historical |
| `20270128120000_fix_properties_rls.sql` | Properties RLS | Historical |
| `20270129060000_reset_credit_scores.sql` | Credit score reset | Historical |
| `20270130000000_fix_xp_system_level_2000.sql` | XP level fix | Historical |
| `20270131000000_fix_sell_house_admin_pool.sql` | Sell house fix | Historical |
| `20270131000001_add_updated_at_to_admin_pool.sql` | Admin pool timestamp | Historical |
| `20270131000002_sell_all_houses.sql` | Sell all houses | Historical |
| `20270131000003_fix_court_case_constraint.sql` | Court case constraint | Historical |
| `20270131000004_fix_single_sell_logic.sql` | Single sell logic | Historical |
| `20270131000005_sidebar_updates.sql` | Sidebar updates | Historical |
| `20270131000007_fix_loan_rpc.sql` | Loan RPC fix | Historical |
| `20270131100000_fix_device_login_policy.sql` | Device login policy | Historical |
| `20270201000000_trollifieds_system.sql` | Trollifieds | Historical |
| `20270201000000_update_spend_coins_xp.sql` | Spend coins XP | **DUPLICATE timestamp** |
| `20270202000000_add_system_errors_insert_policy.sql` | System errors policy | Historical |
| `20270202000001_fix_xp_grants.sql` | XP grants fix | Historical |
| `20270202100000_create_paypal_transactions.sql` | PayPal transactions | Historical |
| `20270202110000_fix_loan_system.sql` | Loan system fix | Historical |
| `20270202120000_fix_property_upgrades_and_family_stats.sql` | Property/family fix | Historical |
| `20270202130000_sell_vehicle_to_dealership.sql` | Vehicle sale | Historical |
| `20270203000000_seller_tiers_reviews_appeals.sql` | Seller tiers | Historical |
| `20270203000000_tmv_system.sql` | TMV system | **DUPLICATE timestamp** |
| `20270204000000_add_driver_badge.sql` | Driver badge | Historical |
| `20270204000100_update_admin_license.sql` | Admin license | Historical |
| `20270204000200_delete_own_account.sql` | Delete account | Historical |
| `20270204000300_rename_entrance_effects.sql` | Entrance effects rename | Historical |
| `20270204000400_fix_insurance_sync.sql` | Insurance sync | Historical |
| `20270204010000_fix_economy_dashboard_views.sql` | Economy dashboard | Historical |
| `20270204020000_fix_pitch_contests_schema.sql` | Pitch schema fix | Historical |
| `20270204030000_create_pitches_and_splits.sql` | Pitches/splits | Historical |
| `20270204040000_free_voting.sql` | Free voting | Historical |
| `20270204050000_allow_delete_own_pitch.sql` | Delete pitch | Historical |
| `20270204060000_delete_all_contests.sql` | Delete contests | Historical |
| `20270204070000_add_dollar_package.sql` | Dollar package | Historical |
| `20270204090000_thumbs_voting.sql` | Thumbs voting | Historical |
| `20270204120000_add_paid_kick.sql` | Paid kick | Historical |
| `20270204121500_add_unban_user.sql` | Unban user | Historical |
| `20270204130000_add_stream_theme.sql` | Stream theme | Historical |
| `20270204140000_ensure_broadofficer_rpc.sql` | Broadofficer RPC | Historical |
| `20270205000000_troll_church.sql` | Troll church | Historical |
| `20270205000100_update_spend_coins_credit_logic.sql` | Spend coins logic | Historical |
| `20270205000200_fix_credit_tiers.sql` | Credit tiers fix | Historical |
| `20270206000000_moderation_fixes.sql` | Moderation fixes | Historical |
| `20270206010000_fix_badge_stats.sql` | Badge stats fix | Historical |
| `20270208010000_admin_wiring_fixes.sql` | Admin wiring | Historical |
| `20270208020000_system_config_setup.sql` | System config | Historical |
| `20270208040000_fix_officer_schema.sql` | Officer schema | Historical |
| `20270208050000_officer_ops_and_management.sql` | Officer ops | Historical |
| `20270208060000_admin_finance_and_reports.sql` | Admin finance | Historical |
| `20270208070000_admin_misc_fixes.sql` | Admin misc | Historical |
| `20270208080000_system_backups.sql` | System backups | Historical |
| `20270208090000_ensure_stream_reports.sql` | Stream reports | Historical |
| `20270208100000_update_assign_patrol_rpc.sql` | Patrol RPC | Historical |
| `20270208110000_role_and_user_fixes.sql` | Role/user fixes | Historical |
| `20270208145000_fix_payout_schema_columns.sql` | Payout schema | Historical |
| `20270208150000_unified_payout_history_view.sql` | Payout history view | Historical |
| `20270208160000_fix_payout_tiers.sql` | Payout tiers | Historical |
| `20270208170000_verify_permissions.sql` | Permission verification | Historical |
| `20270208180000_payout_hold_feature.sql` | Payout hold | Historical |
| `20270209000000_fix0_general_updates.sql` | General fixes | Historical |
| `20270209000001_fix_loan_rpc_auth_v2.sql` | Loan RPC auth | Historical |
| `20270209000002_remove_trollmonds_final_v2.sql` | Trollmonds removal | Historical |
| `20270209010000_fix_admin_cost.sql` | Admin cost fix | Historical |
| `20270209120000_fix2_fix3_housing_revenue.sql` | Housing revenue | Historical |
| `20270209130000_broadcast_decay.sql` | Broadcast decay | Historical |
| `20270209140000_admin_queue_logic.sql` | Admin queue | Historical |
| `20270209150000_fix2_loans.sql` | Loans fix | Historical |
| `20270209160000_payout_schedule.sql` | Payout schedule | Historical |
| `20270209230000_fix_coin_ledger_schema.sql` | Coin ledger schema | Historical |
| `20270210000000_complete_fix_implementation.sql` | Complete fixes | Historical |
| `20270210000001_broadcast_logic.sql` | Broadcast logic | Historical |
| `20270210000002_housing_rpcs.sql` | Housing RPCs | Historical |
| `20270210000003_fix_bank_loans.sql` | Bank loans fix | Historical |
| `20270210000004_admin_week_logic.sql` | Admin week logic | Historical |
| `20270210000005_add_direction_delta_constraint.sql` | Direction constraint | Historical |
| `20270210000006_car_valuation.sql` | Car valuation | Historical |
| `20270211000000_fix_audit_log_trigger.sql` | Audit log trigger | Historical |
| `20270211000001_add_description_to_properties.sql` | Property description | Historical |
| `20270211000001_battle_stream_protection.sql` | Battle stream protection | **DUPLICATE timestamp** |
| `20270211000002_add_utility_costs_to_properties.sql` | Utility costs | Historical |
| `20270211000003_add_admin_landlord_flags_to_properties.sql` | Landlord flags | Historical |
| `20270211000005_add_nice_package.sql` | Nice package | Historical |
| `20270212000000_add_purchase_system.sql` | Purchase system | Historical |
| `20270212000000_fix_jail_foreign_key.sql` | Jail FK | **DUPLICATE timestamp** |
| `20270212000003_fix_moderation_user_profiles_fk.sql` | Moderation FK | Historical |
| `20270212000006_fix_living_loans_and_occupancy.sql` | Living loans | Historical |
| `20270214000000_upgrade_coins_to_bigint.sql` | Coins upgrade | Historical |
| `20270215000000_remove_gamerz_add_pods.sql` | Gamerz/pods | Historical |
| `20270215000002_create_pod_covers_bucket.sql` | Pod covers bucket | Historical |
| `20270215000003_fix_streams_permissions.sql` | Stream permissions | Historical |
| `20270215000004_update_signup_terms.sql` | Signup terms | Historical |
| `20270215000005_fix_payout_requests_permissions.sql` | Payout permissions | Historical |
| `20270215010000_create_pod_storage.sql` | Pod storage | Historical |
| `20270215020000_add_banner_prefs.sql` | Banner prefs | Historical |
| `20270215030000_pod_chat_and_ui.sql` | Pod chat | Historical |
| `20270215040000_add_hand_raise.sql` | Hand raise | Historical |
| `20270215050000_fix_pod_permissions.sql` | Pod permissions | Historical |
| `20270215060000_fix_pod_relations.sql` | Pod relations | Historical |
| `20270215070000_pod_tasks_and_terms.sql` | Pod tasks | Historical |
| `20270215080000_fix_expires_at_columns.sql` | Expires at fix | Historical |
| `20270215081000_fix_pay_loan_types.sql` | Loan types fix | Historical |
| `20270215090000_drop_ambiguous_pay_bank_loan.sql` | Drop ambiguous | Historical |
| `20270215100000_add_pod_moderation.sql` | Pod moderation | Historical |
| `20270215110000_add_last_event_at_to_user_credit.sql` | User credit timestamp | Historical |
| `20270216000000_enhanced_notifications.sql` | Enhanced notifications | Historical |
| `20270216000001_fix_spend_integer_overflow.sql` | Integer overflow fix | Historical |
| `20270216000002_more_notifications.sql` | More notifications | Historical |
| `20270216000003_comprehensive_notifications.sql` | Comprehensive notifications | Historical |
| `20270216001000_update_broadcast_theme_prices.sql` | Theme prices | Historical |
| `20270216002000_fix_loan_rpc_numeric.sql` | Loan RPC numeric | Historical |
| `20270217000000_add_nested_comments.sql` | Nested comments | Historical |
| `20270217003000_create_post_media_bucket.sql` | Post media bucket | Historical |
| `20270217004000_ensure_post_reactions.sql` | Post reactions | Historical |
| `20270217090000_fix_insurance_and_inventory_fks.sql` | Insurance/inventory FKs | Historical |
| `20270217100000_fix_troll_posts_columns.sql` | Troll posts columns | Historical |
| `20270217110000_fix_missing_rpc_functions.sql` | Missing RPCs | Historical |
| `20270217110001_fix_tournament_participants_status.sql` | Tournament status | Historical |
| `20270217111000_rename_neon_city.sql` | Neon city rename | Historical |
| `20270217120000_tournament_rpc.sql` | Tournament RPC | Historical |
| `20270218000000_secure_notification_rpc.sql` | Secure notification | Historical |
| `20270218000001_fix_tournament_deletion_rls.sql` | Tournament deletion | Historical |
| `20270218100000_president_system.sql` | President system | Historical |
| `20270218110000_fix_president_appointments_fk.sql` | President FK | Historical |
| `20270218120000_president_powers.sql` | President powers | Historical |
| `20270218130000_finalize_election_update.sql` | Election finalize | Historical |
| `20270218140000_court_integration.sql` | Court integration | Historical |
| `20270219000000_add_glowing_username_color.sql` | Glow color | Historical |
| `20270219000001_unified_actionable_notifications.sql` | Unified notifications | Historical |
| `20270220000000_add_payment_method_to_manual_orders.sql` | Payment method | Historical |
| `20270220000000_fix_coin_ledger_to_userid.sql` | Coin ledger userid | **DUPLICATE timestamp** |
| `20270220000001_add_image_url_to_shop_items.sql` | Shop image URL | Historical |
| `20270220010000_broadcast_lock_and_limit.sql` | Broadcast lock | Historical |
| `20270220020000_fix_chat_rls.sql` | Chat RLS fix | Historical |
| `20270220030000_fix_finalize_battle_schema.sql` | Battle schema fix | Historical |
| `20270220033000_fix_troll_battle_rpcs.sql` | Troll battle RPCs | Historical |
| `20270220034000_fix_battle_notifications.sql` | Battle notifications | Historical |
| `20270220040000_add_stream_frame_mode.sql` | Stream frame mode | Historical |
| `20270220050000_remove_sav_vived_columns.sql` | Remove columns | Historical |
| `20270220050001_fix_gift_items_rls.sql` | Gift items RLS | Historical |
| `20270220060000_fix_broadcast_rpc_json_cast.sql` | Broadcast RPC cast | Historical |
| `20270220070000_add_coin_amount_compat.sql` | Coin amount compat | Historical |
| `20270220080000_battle_pot_and_schema_fix.sql` | Battle pot fix | Historical |
| `20270220090000_fix_schema_and_optimization.sql` | Schema optimization | Historical |
| `20270225000000_battle_stats_update.sql` | Battle stats | Historical |
| `20270225100000_add_rgb_effect_to_streams.sql` | RGB effect | Historical |
| `20270225103000_add_matchmaking_rpc.sql` | Matchmaking RPC | Historical |
| `20270228000000_add_user_age_system.sql` | User age system | Historical |
| `20270228120000_fix_streams_rls.sql` | Streams RLS fix | Historical |
| `20270228140000_cleanup_unused_tables.sql` | Cleanup unused | Historical |
| `20270301000000_president_v2.sql` | President v2 | Historical |
| `20270302000000_tmv_rebuild.sql` | TMV rebuild | Historical |
| `20270303000000_tmv_upgrades_and_fixes.sql` | TMV upgrades | Historical |
| `20270303000001_add_user_like_tracking.sql` | Like tracking | Historical |
| `20270303000001_seed_vehicles.sql` | Vehicle seed | **DUPLICATE timestamp** |
| `20270303000002_fix_eclipse_seraph_image.sql` | Image fix | Historical |
| `20270303000003_fix_broadcast_rpc.sql` | Broadcast RPC fix | Historical |
| `20270303000004_create_car_upgrades.sql` | Car upgrades | Historical |
| `20270303000005_fix_drivers_test.sql` | Driver test fix | Historical |
| `20270303000006_scalability_update.sql` | Scalability | Historical |
| `20270303000008_fix_tmv_rpc.sql` | TMV RPC fix | Historical |
| `20270303180000_fix_user_profile_creation_trigger.sql` | Profile trigger fix | Historical |
| `20270304000000_battle_crown_streak_system.sql` | Crown streak | Historical |
| `20270304000000_clear_all_game_matches.sql` | Clear matches | **DUPLICATE timestamp** |
| `20270304000000_fix_gift_crash.sql` | Gift crash fix | **DUPLICATE timestamp** |
| `20270304000001_create_internet_game_match_rpc.sql` | Game match RPC | Historical |
| `20270304000001_dual_path_streaming.sql` | Dual streaming | **DUPLICATE timestamp** |
| `20270304000002_fix_court_fk.sql` | Court FK fix | Historical |
| `20270304000003_comprehensive_fixes.sql` | Comprehensive fixes | Historical |
| `20270304000004_fix_court_and_pod_permissions.sql` | Court/pod permissions | Historical |
| `20270304000005_fix_payout_email_trigger.sql` | Payout email trigger | Historical |
| `20270304000006_end_stream_and_email_fix.sql` | Stream/email fix | Historical |
| `20270304000007_payout_and_chat_fixes.sql` | Payout/chat fixes | Historical |
| `20270304000008_launch_gift_system.sql` | Launch gifts | Historical |
| `20270304000009_purchase_rgb_broadcast.sql` | RGB purchase | Historical |
| `20270304000010_fix_viewer_count_schema.sql` | Viewer count | Historical |
| `20270304000011_fix_officer_assignments_rls.sql` | Officer RLS | Historical |
| `20270304000012_add_viewer_count_rpc.sql` | Viewer count RPC | Historical |
| `20270304000013_fix_deletion_constraints.sql` | Deletion constraints | Historical |
| `20270304000014_fix_audit_logs_fk.sql` | Audit log FK | Historical |
| `20270304000015_fix_court_deletion.sql` | Court deletion | Historical |
| `20270304000016_fix_more_court_fks.sql` | More court FKs | Historical |
| `20270304000017_fix_court_details_fks.sql` | Court details FKs | Historical |
| `20270304000018_relax_court_null_constraints.sql` | Court null constraints | Historical |
| `20270304000019_create_court_state.sql` | Court state | Historical |
| `20270304000020_auto_create_court_state.sql` | Auto court state | Historical |
| `20270305000000_fix_court_structure.sql` | Court structure | Historical |
| `20270305000000_fix_set_user_role_for_service_role.sql` | Service role fix | **DUPLICATE timestamp** |
| `20270305000001_add_broadcast_bypass.sql` | Broadcast bypass | Historical |
| `20270305000002_harden_rls_policies.sql` | Harden RLS | Historical |
| `20270305000003_consolidated_fix.sql` | Consolidated fix | Historical |
| `20270305000004_og_badge_update.sql` | OG badge | Historical |
| `20270305000005_delete_test_streams.sql` | Delete test streams | Historical |
| `20270305000006_fix_missing_policies.sql` | Missing policies | Historical |
| `20270305000007_fix_follow_policies.sql` | Follow policies | Historical |
| `20270305000008_fix_perk_rls_and_themes.sql` | Perk RLS | Historical |
| `20270305000009_add_end_stream_rpc.sql` | End stream RPC | Historical |
| `20270305000010_consumables_boost_broadcast.sql` | Consumables boost | Historical |
| `20270305000015_secure_public_tables.sql` | Secure public tables | Historical |
| `20270305000016_z_cleanup_triggers.sql` | Trigger cleanup | Historical |
| `20270306000000_fix_profile_buckets_and_onboarding.sql` | Profile buckets | Historical |
| `20270306000001_fix_gift_constraint.sql` | Gift constraint | Historical |
| `20270306000002_remove_og_badge.sql` | Remove OG badge | Historical |
| `20270306000003_drop_gift_type_check.sql` | Drop gift type check | Historical |
| `20270306000004_fix_gift_types.sql` | Gift types fix | Historical |
| `20270306000005_fix_base_issues.sql` | Base issues fix | Historical |
| `20270306000005_fix_payout_rpc_signature.sql` | Payout RPC signature | **DUPLICATE timestamp** |
| `20270306000006_fix_notification_count.sql` | Notification count | Historical |
| `20270306000006_fix_trollmers_battle_fkey.sql` | Trollmers FK | **DUPLICATE timestamp** |
| `20270306000007_fix_purchase_functions.sql` | Purchase functions | Historical |
| `20270306000008_add_tmv_rpcs.sql` | TMV RPCs | Historical |
| `20270306000009_fix_loan_ambiguity.sql` | Loan ambiguity | Historical |
| `20270306000010_update_tmv_features.sql` | TMV features | Historical |
| `20270306000011_fix_officer_status.sql` | Officer status | Historical |
| `20270306000012_add_is_officer_active.sql` | Officer active flag | Historical |
| `20270306000012_secure_try_pay.sql` | Secure try pay | **DUPLICATE timestamp** |
| `20270306000013_fix_try_pay_coins.sql` | Try pay coins | Historical |
| `20270306000015_fix_insurance_integer_overflow.sql` | Insurance overflow | Historical |
| `20270306000016_add_hls_url.sql` | HLS URL | Historical |
| `20270306000017_add_hls_url_to_pods_and_court.sql` | HLS pods/court | Historical |
| `20270306000020_create_hls_bucket.sql` | HLS bucket | Historical |
| `20270306000021_create_verification_bucket.sql` | Verification bucket | Historical |
| `20270306000022_ensure_status_columns.sql` | Status columns | Historical |
| `20270306000023_fix_system_errors_rls.sql` | System errors RLS | Historical |
| `20270306000024_fix_bad_hls_urls.sql` | Bad HLS URLs | Historical |
| `20270306000025_fix_rgb_rpc_overflow.sql` | RGB overflow | Historical |
| `20270306000030_launch_hardening.sql` | Launch hardening | Historical |
| `20270306000031_launch_rate_limits.sql` | Rate limits | Historical |
| `20270306000040_idempotency_spend.sql` | Idempotency | Historical |
| `20270306000050_disable_testing_mode.sql` | Disable testing | Historical |
| `20270306000055_remove_officer_onboarding.sql` | Remove onboarding | Historical |
| `20270306000056_fix_insurance_rpc.sql` | Insurance RPC fix | Historical |
| `20270307000000_optimize_streams.sql` | Stream optimization | Historical |
| `20270307000001_fix_premium_gift.sql` | Premium gift fix | Historical |
| `20270307000010_security_triggers.sql` | Security triggers | Historical |
| `20270307000099_officer_payroll_system.sql` | Officer payroll | Historical |
| `20270308000000_add_set_stream_box_count.sql` | Set box count | Historical |
| `20270308000000_fix_stream_gifts_recipient.sql` | Gift recipient fix | **DUPLICATE timestamp** |
| `20270308000001_dashboard_rpcs.sql` | Dashboard RPCs | Historical |
| `20270308000002_payroll_distribution.sql` | Payroll distribution | Historical |
| `20270309000000_add_send_gift_in_stream.sql` | Send gift in stream | Historical |
| `20270309000000_fix_rpc_overflow_ensure.sql` | RPC overflow fix | **DUPLICATE timestamp** |
| `20270310000000_fix_broadcast_issues.sql` | Broadcast issues | Historical |
| `20270310000000_fix_pod_user_relations.sql` | Pod relations | **DUPLICATE timestamp** |
| `20270310000000_repossession_system.sql` | Repossession | **DUPLICATE timestamp** |
| `20270310000001_add_egress_fields.sql` | Egress fields | Historical |
| `20270310000005_trollmonds_system.sql` | Trollmonds | Historical |
| `20270310000006_trollmond_gifting.sql` | Trollmond gifting | Historical |
| `20270310000007_trollmond_cashout.sql` | Trollmond cashout | Historical |
| `20270311000000_fix_hls_url_pollution.sql` | HLS pollution fix | Historical |
| `20270311000000_fix_missing_functions.sql` | Missing functions | **DUPLICATE timestamp** |
| `20270312000000_fix_wallet_transactions_schema.sql` | Wallet schema | Historical |
| `20270313000000_fix_approve_manual_order_amount.sql` | Manual order amount | Historical |
| `20270313000001_force_delete_users.sql` | Force delete users | Historical |
| `20270314000000_fix_all_issues.sql` | All issues fix | Historical |
| `20270315000000_fix_kt_auto_and_gas.sql` | KT auto/gas fix | Historical |
| `20270316000000_fix_ambiguous_refill_gas.sql` | Gas refill fix | Historical |
| `20270316000002_fix_seat_mechanics.sql` | Seat mechanics | Historical |
| `20270316000003_fix_perks_rls.sql` | Perks RLS | Historical |
| `20270318000000_staff_notifications.sql` | Staff notifications | Historical |
| `20270319000000_update_gas_logic.sql` | Gas logic | Historical |
| `20270320000000_day_one_features.sql` | Day one features | Historical |
| `20270320000001_fix_rls_and_day_one.sql` | RLS/day one fix | Historical |
| `20270320000005_guest_viewing.sql` | Guest viewing | Historical |
| `20270321000000_broadcast_bypass_trigger.sql` | Broadcast bypass trigger | Historical |
| `20270322000000_master_fixes.sql` | Master fixes | Historical |
| `20270322000000_secure_coin_updates.sql` | Secure coins | **DUPLICATE timestamp** |
| `20270323000000_add_is_ip_banned.sql` | IP ban flag | Historical |
| `20270323000001_push_notifications_trigger.sql` | Push trigger | Historical |
| `20270324000000_fix_notification_delete_policy.sql` | Notification policy | Historical |
| `20270325000000_fix_is_live_trigger.sql` | Is live trigger | Historical |
| `20270325000000_fix_secretary_assignments_user_relations.sql` | Secretary relations | **DUPLICATE timestamp** |
| `20270326000000_group_chat_support.sql` | Group chat | Historical |
| `20270326000000_message_payout_notifications.sql` | Message payout | **DUPLICATE timestamp** |
| `20270327000001_secure_court_fines.sql` | Court fines | Historical |
| `20270327000004_secure_admin_and_profile_updates.sql` | Admin/profile security | Historical |
| `20270327000005_fix_trigger_bypass.sql` | Trigger bypass fix | Historical |
| `20270327000006_secure_shop_and_admin.sql` | Shop/admin security | Historical |
| `20270327000007_fix_null_user_id_transactions.sql` | Null user fix | Historical |
| `20270327000008_glow_color_rpc.sql` | Glow color RPC | Historical |
| `20270327000010_fix_garage_visibility.sql` | Garage visibility | Historical |
| `20270327000011_fix_garage_relations_rls.sql` | Garage RLS | Historical |
| `20270327000020_secure_credit_coins.sql` | Credit/coins security | Historical |
| `20270327000021_secure_shop_functions.sql` | Shop functions security | Historical |
| `20270327000022_toggle_perk_rpc.sql` | Toggle perk | Historical |
| `20270327000099_revert_security_triggers.sql` | Revert security triggers | Historical |
| `20270328000000_add_ceo_theme_and_exclusive_fields.sql` | CEO theme | Historical |
| `20270328000000_fix_property_types_seed.sql` | Property seed | **DUPLICATE timestamp** |
| `20270330000000_broadcast_abilities.sql` | Broadcast abilities | Historical |
| `20270330000000_trollmers_weekly_leaderboard.sql` | Trollmers leaderboard | **DUPLICATE timestamp** |
| `20270330000002_5v5_battle_system.sql` | 5v5 battles | Historical |
| `20270330010000_zip_governance_system.sql` | ZIP governance | Historical |
| `20270330020000_officer_salary_model.sql` | Officer salary | Historical |
| `20270330020010_officer_ladder_simplify.sql` | Officer ladder | Historical |
| `20270330020011_fix_officer_payroll_logs_columns.sql` | Payroll columns | Historical |
| `20270401000000_credit_card_system.sql` | Credit cards | Historical |
| `20270401000001_fix_spend_rpc.sql` | Spend RPC fix | Historical |
| `20270401000002_fix_premium_gift.sql` | Premium gift fix | Historical |
| `20270401000003_finalize_executive_powers.sql` | Executive powers | Historical |
| `20270401120000_fix_seat_visibility.sql` | Seat visibility | Historical |
| `20270402000000_debug_gift_system.sql` | Gift debug | Historical |
| `20270402000000_fix_credit_score_constraint.sql` | Credit constraint | **DUPLICATE timestamp** |
| `20270402000000_housing_lease_critical_fixes.sql` | Housing lease | **DUPLICATE timestamp** |
| `20270402000001_credit_card_repossession.sql` | Credit card repossession | Historical |
| `20270402000002_unify_credit_scores.sql` | Credit score unification | Historical |
| `20270402000003_allow_credit_score_increase.sql` | Credit increase | Historical |
| `20270402000003_fix_pay_credit_card.sql` | Pay credit card | **DUPLICATE timestamp** |
| `20270404000000_fix_pay_credit_card_atomic.sql` | Atomic credit card pay | Historical |
| `20270405000000_create_pay_credit_card.sql` | Create credit card pay | Historical |
| `20270405000000_credit_score_and_court_fixes.sql` | Credit/court fixes | **DUPLICATE timestamp** |
| `20270405000000_fix_finalize_no_votes.sql` | Finalize no votes | **DUPLICATE timestamp** |
| `20270405000001_add_vote_count_to_candidates.sql` | Vote count | Historical |
| `20270406000000_fix_stock_buy_and_court_errors.sql` | Stock/court errors | Historical |
| `20270407000000_debug_court_tables.sql` | Court debug | Historical |
| `20270407000000_fix_court_foreign_keys.sql` | Court FKs | **DUPLICATE timestamp** |
| `20270407000000_fix_troll_family_approval.sql` | Family approval | **DUPLICATE timestamp** |
| `20270407010000_fix_jail_foreign_key.sql` | Jail FK | Historical |
| `20270407020000_debug_jail_table.sql` | Jail debug | Historical |
| `20270407235000_remove_broadcast_follower_restriction.sql` | Follower restriction | Historical |
| `20270407235800_update_gaming_follower_requirement.sql` | Gaming follower | Historical |
| `20270408000000_leave_family_with_fee.sql` | Leave family fee | Historical |
| `20270408001500_advertisement_system.sql` | Advertisements | Historical |
| `20270408002200_advertisement_queue_system.sql` | Ad queue | Historical |
| `20270411000000_ktauto_dealership_inventory.sql` | Dealership inventory | Historical |
| `20270411000001_update_driver_test_answers.sql` | Driver test | Historical |
| `20270411000002_add_last_utility_paid_at.sql` | Utility paid | Historical |
| `20270415000000_ensure_onesignal_tokens.sql` | OneSignal tokens | Historical |
| `20270417000000_add_paid_chat_settings.sql` | Paid chat | Historical |
| `20270423000000_create_missing_tables.sql` | Missing tables | Historical |
| `20270423000001_migrate_conversation_messages.sql` | Message migration | Historical |
| `20270427000000_add_org_is_public.sql` | Org public flag | Historical |
| `20270427000000_add_org_password.sql` | Org password | **DUPLICATE timestamp** |
| `20270427000000_universe_mode_troll_battle.sql` | Universe battle | **DUPLICATE timestamp** |
| `20270428000001_fix_attorney_request_rls.sql` | Attorney RLS | Historical |
| `20270501000000_fix_user_advertisement_policy.sql` | Ad policy | Historical |
| `20270501000001_fix_seat_visibility_final.sql` | Seat visibility final | Historical |
| `20270501000002_ensure_visibility.sql` | Visibility | Historical |
| `20270501000002_troll_games_system.sql` | Troll games | **DUPLICATE timestamp** |
| `20270501000003_add_get_seats_rpc.sql` | Get seats RPC | Historical |
| `20270501000004_fix_rpc_visibility.sql` | RPC visibility | Historical |
| `20270502000001_add_created_at_to_seats_rpc.sql` | Seats timestamp | Historical |
| `20270503000000_add_cover_url_column.sql` | Cover URL | Historical |
| `20270503000002_fix_send_gift_ledger_paid_coins.sql` | Gift ledger fix | Historical |
| `20270505000000_emergency_fix_paid_coin.sql` | Emergency coin fix | Historical |
| `20270521000000_small_installment_purchases.sql` | Installments | Historical |
| `20270524000001_update_stream_seats_and_create_audience_presence.sql` | Audience presence | Historical |
| `20270526000000_add_agency_enforcement_system.sql` | Agency enforcement | Historical |
| `20270526010000_add_troll_wall_system_posts.sql` | Wall posts | Historical |
| `20270601000000_fix_gift_rpc.sql` | Gift RPC fix | Historical |
| `20270601000000_realistic_credit_card_overhaul.sql` | Credit card overhaul | **DUPLICATE timestamp** |
| `20270601000001_mobile_error_logs.sql` | Mobile error logs | Historical |
| `20270601000002_admin_for_week_final.sql` | Admin for week | Historical |
| `20270601000003_admin_powers.sql` | Admin powers | Historical |
| `20270601000004_admin_dashboard_and_safety.sql` | Admin dashboard | Historical |
| `20270602000000_optimize_family_browse.sql` | Family browse | Historical |
| `20270602000001_optimize_family_home_rpc.sql` | Family home RPC | Historical |
| `20270603000001_fix_presence_rls.sql` | Presence RLS | Historical |
| `20270604000001_fix_presence_rls_for_staff.sql` | Staff presence RLS | Historical |
| `20270604000002_seed_premium_frames_and_ceo_perks.sql` | Premium frames seed | Historical |
| `20270701000000_debug_gift_system_v2.sql` | Gift debug v2 | Historical |
| `20270701000001_fix_ambiguous_gift.sql` | Ambiguous gift fix | Historical |
| `20270701000002_missing_rpc_functions.sql` | Missing RPCs | Historical |
| `20270703000000_password_protected_broadcasts.sql` | Password broadcasts | Historical |
| `20270703000001_realtime_user_profiles.sql` | Realtime profiles | Historical |
| `20270801000000_comprehensive_fixes.sql` | Comprehensive fixes | Historical |
| `20270801000001_guest_seats.sql` | Guest seats | Historical |
| `20270802000000_fix_staff_gas.sql` | Staff gas fix | Historical |
| `20270802000000_fix_test_issues.sql` | Test issues | **DUPLICATE timestamp** |
| `20270803000000_fix_is_admin.sql` | Is admin fix | Historical |
| `20270804000000_fix_battles_fk.sql` | Battles FK | Historical |
| `20270805000000_create_bug_alerts.sql` | Bug alerts | Historical |
| `20270806000000_seed_gifts.sql` | Gift seed | Historical |
| `20270806000001_fix_box_count_param.sql` | Box count param | Historical |
| `20270806000002_fix_rgb_purchase_logic.sql` | RGB purchase | Historical |
| `20270806000003_seed_more_gifts.sql` | More gift seed | Historical |
| `20270806000004_seed_entrance_effects.sql` | Entrance effect seed | Historical |
| `20270806000005_sync_effect_catalog.sql` | Effect catalog sync | Historical |
| `20270807000000_review_images_storage_policy.sql` | Review images policy | Historical |
| `20270807000001_create_neighbors_tables.sql` | Neighbors tables | Historical |
| `20270808000000_create_neighbors_hiring.sql` | Neighbors hiring | Historical |
| `20270809000000_create_featured_broadcast_system.sql` | Featured broadcasts | Historical |
| `20270815000000_seat_lock_check.sql` | Seat lock | Historical |
| `20270900000000_standardize_send_gift.sql` | Standardize gifts | Historical |
| `20270901000010_battle_skip_and_leave.sql` | Battle skip/leave | Historical |
| `20270901000020_add_game_state_to_troll_battles.sql` | Game state | Historical |
| `20270901000030_create_game_match_rpc.sql` | Game match RPC | Historical |
| `20270901000040_create_global_events.sql` | Global events | Historical |
| `20270901000040_join_game_match_rpc.sql` | Join game match | **DUPLICATE timestamp** |
| `20270901000050_process_game_action_rpc.sql` | Game action RPC | Historical |
| `20270901000060_get_waiting_matches_rpc.sql` | Waiting matches | Historical |
| `20270902000000_delete_test_users.sql` | Delete test users | Historical |
| `20270902000000_fix_ban_user_status_values.sql` | Ban status | **DUPLICATE timestamp** |
| `20270915000000_low_minute_protection_mode.sql` | Low minute protection | Historical |
| `20270915000001_low_minute_protection_pods.sql` | Low minute pods | Historical |
| `20270915000002_xp_integrity_mode.sql` | XP integrity | Historical |
| `20270921000000_notify_admins_compat.sql` | Admin notifications | Historical |
| `20270921001000_fix_approve_manual_order_fulfill.sql` | Manual order fulfill | Historical |
| `20270921002000_dedupe_conversation_members.sql` | Dedupe conversations | Historical |
| `20270922000000_create_notify_user_function.sql` | Notify user function | Historical |
| `20270922000000_fix_government_summon_docket_schedule.sql` | Government summon | **DUPLICATE timestamp** |
| `20270922000001_create_jail_sentence_notification.sql` | Jail notification | Historical |
| `20270922000002_create_global_events_table.sql` | Global events table | Historical |
| `20270922001000_fix_court_cases_users_involved.sql` | Court users involved | Historical |
| `20270923000001_attorney_prosecutor_application_functions.sql` | Attorney/prosecutor | Historical |
| `20270923000002_add_attorney_prosecutor_columns.sql` | Attorney columns | Historical |
| `20270925000000_neighbors_approval_system.sql` | Neighbors approval | Historical |
| `20270925000001_add_event_participation_badges.sql` | Event badges | Historical |
| `20270926000000_fix_get_nearby_neighbors_events_return_signature.sql` | Neighbors signature | Historical |
| `20270926000000_fix_summon_array_literal.sql` | Summon array | **DUPLICATE timestamp** |
| `20270927000000_summon_user_to_court_fix.sql` | Summon fix | Historical |
| `20270928000000_fix_court_date_generation.sql` | Court date | Historical |
| `20270929000000_fix_court_sessions_case_id.sql` | Court case ID | Historical |
| `20270930_attorney_application_fix.sql` | Attorney fix | Historical |
| `20271001000000_troll_wheel_features.sql` | Troll wheel | Historical |
| `20271001000001_enable_ghost_mode_staff.sql` | Ghost mode staff | Historical |
| `20271015000000_troll_city_government_system.sql` | Government system | Historical |
| `20271027000000_create_stream_viewers_and_bans.sql` | Stream viewers/bans | Historical |
| `20271027000001_create_stream_likes.sql` | Stream likes | Historical |
| `20271027000002_fix_gifting_system.sql` | Gifting fix | Historical |
| `20271027000003_fix_send_gift_in_stream_overload.sql` | Gift overload fix | Historical |
| `20271027000003_gift_animation_url.sql` | Gift animation | **DUPLICATE timestamp** |
| `20271028000000_admin_notifications_and_clickability.sql` | Admin notifications | Historical |
| `20271029000000_fix_bulk_notification_clone.sql` | Bulk notification | Historical |
| `20271030000000_optimize_conversation_queries.sql` | Conversation optimization | Historical |
| `20271031000000_fix_visa_redemption_tiers.sql` | Visa redemption | Historical |
| `20271201000000_create_paypal_payout_function.sql` | PayPal payout | Historical |
| `20271202000000_add_display_name_to_user_profiles.sql` | Display name | Historical |
| `20280315000000_create_league_system.sql` | League system | Historical |
| `20280418000000_allow_summoned_court_case_status.sql` | Court case status | Historical |
| `20280428000002_add_missing_court_status_enum.sql` | Court status enum | Historical |
| `20280428000003_fix_duplicate_notifications.sql` | Duplicate notifications | Historical |
| `20280428000004_sync_jail_status_to_user.sql` | Jail status sync | Historical |
| `20280429000000_add_staff_notifications.sql` | Staff notifications | Historical |
| `20280430000000_random_battles_and_trollmond_coins_back.sql` | Random battles | Historical |
| `20280430000001_fix_broadcast_mod_actions.sql` | Broadcast mod actions | Historical |
| `20280430000002_fix_mod_kick_created_by_compat.sql` | Mod kick compat | Historical |
| `20280430000003_sync_random_battle_arena.sql` | Battle arena sync | Historical |
| `20280430000004_bug_center_and_admin_finance.sql` | Bug center | Historical |
| `20280430000005_organization_management_hub.sql` | Organization hub | Historical |
| `20280430000006_strict_chat_and_mute_moderation.sql` | Strict moderation | Historical |
| `20280430000007_staff_only_broadcast_mod_actions.sql` | Staff mod actions | Historical |
| `20280430000008_stream_gift_viewer_xp_realtime_fix.sql` | Gift XP fix | Historical |
| `20280430000009_launch_referral_cashout_frontend_support.sql` | Referral support | Historical |
| `20280430000010_stream_analytics_rtc_monitor.sql` | Stream analytics | Historical |
| `20280430000011_new_user_cashout_promo_enforcement.sql` | Cashout promo | Historical |
| `20280430000012_court_dockets_auth_hard_delete_and_extict.sql` | Court dockets | Historical |
| `20280430000013_paypal_payout_coin_fee.sql` | PayPal fee | Historical |
| `20280430000014_hot_path_realtime_and_side_effects.sql` | Hot path | Historical |
| `20280430000015_rent_marketplace_and_notification_workflows.sql` | Rent marketplace | Historical |
| `20280430000016_rolling_gift_leaderboard.sql` | Rolling leaderboard | Historical |
| `20280501000000_launch_blocker_compat_and_signup_coins.sql` | Launch blocker | Historical |
| `20280501000001_fix_signup_profile_trigger_rollback.sql` | Signup trigger | Historical |
| `20280501000002_fix_moderator_kick_removes_from_broadcast.sql` | Moderator kick | Historical |
| `20280501000003_gift_slug_compat.sql` | Gift slug compat | Historical |
| `20280501000004_battle_theme_support.sql` | Battle theme | Historical |
| `20280501000005_allow_immediate_random_battle_rematches.sql` | Battle rematches | Historical |
| `20280501000006_add_livekit_identity_to_stream_seat_sessions.sql` | LiveKit identity | Historical |
| `20280504000000_add_push_notifications_enabled.sql` | Push notifications | Historical |
| `20280508000000_add_micro_100_coin_pack.sql` | Coin pack | Historical |
| `20280508000000_jail_bail_payout_and_admin_notifications.sql` | Jail bail | **DUPLICATE timestamp** |
| `20280508000001_fix_employee_assignments_recursion.sql` | Employee recursion | Historical |
| `20280508000002_fix_rls_recursion_employee_assignments.sql` | Employee RLS | Historical |
| `20280510000000_platform_fee_3_percent.sql` | Platform fee | Historical |
| `20280526000000_agency_creator_earnings_and_safe_recruit_pay.sql` | Agency earnings | Historical |
| `20280526000001_troll_city_treasury_system.sql` | Treasury system | Historical |
| `20280526000002_fix_treasury_payout_system.sql` | Treasury payout fix | Historical |
| `20280529000000_fix_scheduled_enum.sql` | Scheduled enum | Historical |
| `20280531000000_create_leave_seat_atomic.sql` | Leave seat atomic | Historical |
| `20290101000000_create_organizations_tables.sql` | Organizations | Historical |
| `20290101000001_add_organization_id_to_user_profiles.sql` | Org ID on profiles | Historical |
| `20290101000002_create_mai_class_system.sql` | MAI class | Historical |
| `20290101000003_add_mai_class_session_fields.sql` | MAI session fields | Historical |
| `20290508000001_admin_finance_purchase_totals.sql` | Admin finance | Historical |
| `20290508000002_bug_center_exec_secretary.sql` | Bug center | Historical |
| `20290508200000_finance_all_historical_coin_packs.sql` | Coin packs | Historical |
| `20290509120000_admin_dashboard_finance_resilience.sql` | Admin resilience | Historical |
| `20290516000000_league_system_expansion.sql` | League expansion | Historical |
| `20290517000000_fix_coin_rpc_names.sql` | Coin RPC names | Historical |
| `20290517000001_dedup_spend_coins_secure.sql` | Dedup spend coins | Historical |
| `20290518000000_officer_rank_pt_ft_constraints.sql` | Officer rank | Historical |
| `20290518000000_officer_rank_pt_ft_setup.sql` | Officer rank setup | **DUPLICATE timestamp** |
| `20290518000001_fix_officer_employment_type_case.sql` | Officer employment | Historical |
| `20290519000000_hype_coins_system.sql` | Hype coins | Historical |
| `20290520000000_troll_city_level_reward_engine.sql` | Level rewards | Historical |
| `20290526000000_add_paid_agency_application_and_family_conversion.sql` | Agency/family | Historical |
| `20290527000000_create_tromail_tables.sql` | Tromail | Historical |
| `20290527000001_tromail_rpc_functions.sql` | Tromail RPCs | Historical |
| `20290527000002_fix_job_applications_user_profiles_relationship.sql` | Job applications | Historical |
| `20290527100000_create_universal_earnings_system.sql` | Universal earnings | Historical |
| `20290528000000_weekly_role_perk_system.sql` | Weekly perks | Historical |
| `20290528000001_add_president_agency_fee_control.sql` | President fee | Historical |
| `20290528010000_tromail_contract_system.sql` | Tromail contracts | Historical |
| `20290531000000_broadcast_league_system.sql` | Broadcast league | Historical |
| `20290531000001_customer_service_system.sql` | Customer service | Historical |
| `20290601000000_add_approve_agency_application_atomic.sql` | Agency approval | Historical |
| `20290601000000_ensure_church_prayer_replies.sql` | Church prayers | **DUPLICATE timestamp** |
| `20290601000000_user_created_leagues.sql` | User leagues | **DUPLICATE timestamp** |
| `20290601000001_fix_wheel_session_ambiguous_user_id.sql` | Wheel session | Historical |
| `20290601000002_fix_nested_aggregates_42803.sql` | Nested aggregates | Historical |
| `20290601000003_create_admin_dashboard_metrics_v1.sql` | Admin metrics | Historical |
| `20290601000010_add_walkie_talkie_page.sql` | Walkie talkie | Historical |
| `20290602000000_buy_featured_promotion.sql` | Featured promotion | Historical |
| `20290602000001_disable_signup_welcome_coins_and_zero_balance.sql` | Disable welcome coins | Historical |
| `20290602000002_disable_daily_rewards.sql` | Disable daily rewards | Historical |
| `20290602000003_fix_audit_logs_user_profiles_relationship.sql` | Audit log profiles | Historical |
| `20290603000000_fix_tromail_calendar_rls.sql` | Tromail calendar RLS | Historical |
| `20290604000000_fix_tromail_calendar_recursion.sql` | Tromail recursion | Historical |
| `20290604000001_fix_jail_notifications_rls.sql` | Jail notifications | Historical |
| `20290605000000_fix_gift_trollmond_rules.sql` | Gift trollmond rules | Historical |
| `20290605000001_invite_followers_to_broadcast.sql` | Invite followers | Historical |
| `20290606000000_economy_safety_pass.sql` | Economy safety | Historical |
| `20290607000000_pride_month_system.sql` | Pride month | Historical |
| `20290608000000_gaming_broadcast_system.sql` | Gaming broadcast | Historical |
| `20290608000000_pride_weekly_challenges.sql` | Pride challenges | **DUPLICATE timestamp** |
| `20290609000000_add_gaming_stream_columns.sql` | Gaming columns | Historical |
| `20290609000001_president_mansion_theme.sql` | President mansion | Historical |
| `20290610000000_create_stream_sessions.sql` | Stream sessions | Historical |
| `20290610000000_simplify_gaming_streams.sql` | Simplify gaming | **DUPLICATE timestamp** |
| `20290610000000_troll_city_academy.sql` | Academy | **DUPLICATE timestamp** |
| `20290611000000_create_shareathon_system.sql` | Shareathon | Historical |
| `20290611000000_utromail_tromail_system.sql` | Utromail/tromail | **DUPLICATE timestamp** |
| `20290612000000_fix_academy_fk_ambiguity.sql` | Academy FK | Historical |
| `20290612000000_fix_auction_lots_removed_status.sql` | Auction lots | **DUPLICATE timestamp** |
| `20290612000010_add_academy_admissions_loan_columns.sql` | Academy loans | Historical |
| `20290615000000_academy_phase2_completion.sql` | Academy phase 2 | Historical |
| `20290616000000_restore_call_minutes_table.sql` | Call minutes restore | Historical |
| `20290617000000_vehicle_asset_system.sql` | Vehicle assets | Historical |
| `20290617000000_vehicle_asset_system_complete.sql` | Vehicle assets complete | **DUPLICATE timestamp** |
| `add_bribe_logs_foreign_keys.sql` | Bribe FKs | Historical |
| `add_broadcast_category_columns.sql` | Broadcast categories | Historical |
| `add_premium_features.sql` | Premium features | Historical |
| `CONSOLIDATED_GIVEAWAY_FIX.sql` | Giveaway fix | Historical |
| `END_ALL_BROADCASTS.sql` | End broadcasts | Historical |
| `remove_coin_exemptions.sql` | Coin exemptions | Historical |
| `summon_user_to_court_fix.sql` | Summon fix | Historical |
| `vehicle_asset_system_rpcs.sql` | Vehicle RPCs | Historical |
| `vehicle_asset_system_schema.sql` | Vehicle schema | Historical |

### 3.3 Dead Migrations (No Longer Needed)

Migrations that have been fully superseded or contain only reverted changes:

| Migration | Reason |
|---|---|
| `20270209000002_remove_trollmonds_final_v2.sql` | Feature removed |
| `20270305000005_delete_test_streams.sql` | One-time cleanup |
| `20270306000002_remove_og_badge.sql` | Feature removed |
| `20270306000055_remove_officer_onboarding.sql` | Feature removed |
| `20270327000099_revert_security_triggers.sql` | Reverted |
| `20270402000000_delete_own_account.sql` | Moved to edge function |
| `20270420000008_force_fix_columns.sql` | One-time fix |
| `20270505000000_emergency_fix_paid_coin.sql` | Emergency fix |
| `20270601000002_admin_for_week_final.sql` | Finalized |
| `20270902000000_delete_test_users.sql` | One-time cleanup |
| `20271029000000_fix_bulk_notification_clone.sql` | Bug fix |
| `20280501000001_fix_signup_profile_trigger_rollback.sql` | Rollback |
| `20290602000001_disable_signup_welcome_coins_and_zero_balance.sql` | Feature disabled |
| `20290602000002_disable_daily_rewards.sql` | Feature disabled |
| `END_ALL_BROADCASTS.sql` | Emergency script |
| `CONSOLIDATED_GIVEAWAY_FIX.sql` | Bug fix |
| `remove_coin_exemptions.sql` | One-time cleanup |

### 3.4 Conflicting Migrations

Migrations with duplicate timestamps or conflicting changes:

| Migrations | Conflict |
|---|---|
| `20260115000000_stripe_coin_purchases.sql` + `20260115001000_stripe_coin_purchases.sql` | Same feature, same date |
| `20260225000008` (show_id_to_votes + fill_stage_slot) | Duplicate timestamp |
| `20260225000009` (leave_stage + update_judge_votes) | Duplicate timestamp |
| `20260225000010` (end_pod_rpc + global_events) | Duplicate timestamp |
| `20260227000000` (enable_tcps_realtime + remove_daily_pod_limit_complete) | Duplicate timestamp |
| `20260322000000` (fix_rls_policies + integrated_battle + marketplace_orders) | Duplicate timestamp |
| `20260411000000` (stream_moderation + trollopoly + troll_us_game) | Duplicate timestamp |
| `20260414000000` (fix_neighbors + marketing_readonly_rls) | Duplicate timestamp |
| `20260415000000` (comprehensive_court + court_participants + emergency_fix + marketing) | Duplicate timestamp |
| `20260425000001` (fix_car_purchase + fix_houses_owner_id) | Duplicate timestamp |
| `20260526000001` (support_goal_dismissals + family_leagues) | Duplicate timestamp |
| `20260530000000` (vin_verification + church_live) | Duplicate timestamp |
| `20260605000000` (fix_everything + ghost_stream_sessions) | Duplicate timestamp |
| `20260607000000` (livekit_rtmp + admin_pool_v2) | Duplicate timestamp |
| `20260608000000` (hytro_agency + live_broadcast + page_visibility + pride_theme) | Duplicate timestamp |
| `20260609000000` (fix_default_coins + verified_badge) | Duplicate timestamp |
| `20260609000001` (notary + officer_voting) | Duplicate timestamp |
| `20270101000000` (capacity_queue + cleanup_payment) | Duplicate timestamp |
| `20270120009500` + `20270120009501` | Sequential but same feature |
| `20270201000000` (trollifieds + update_spend_coins_xp) | Duplicate timestamp |
| `20270203000000` (seller_tiers + tmv_system) | Duplicate timestamp |
| `20270211000001` (audit_log_trigger + battle_stream_protection) | Duplicate timestamp |
| `20270212000000` (purchase_system + jail_fk) | Duplicate timestamp |
| `20270220000000` (payment_method + coin_ledger_userid) | Duplicate timestamp |
| `20270301000000` (clear_matches + fix_gift_crash) | Duplicate timestamp |
| `20270303000001` (user_like_tracking + seed_vehicles) | Duplicate timestamp |
| `20270304000000` (crown_streak + clear_matches + fix_gift_crash) | Duplicate timestamp |
| `20270304000001` (game_match_rpc + dual_path_streaming) | Duplicate timestamp |
| `20270305000000` (court_structure + set_user_role) | Duplicate timestamp |
| `20270306000005` (base_issues + payout_rpc_signature) | Duplicate timestamp |
| `20270306000006` (notification_count + trollmers_fkey) | Duplicate timestamp |
| `20270306000012` (is_officer_active + secure_try_pay) | Duplicate timestamp |
| `20270308000000` (set_box_count + fix_gift_recipient) | Duplicate timestamp |
| `20270309000000` (send_gift_stream + fix_rpc_overflow) | Duplicate timestamp |
| `20270310000000` (broadcast_issues + pod_relations + repossession) | Duplicate timestamp |
| `20270311000000` (hls_pollution + missing_functions) | Duplicate timestamp |
| `20270320000000` (day_one + secure_coins) | Duplicate timestamp |
| `20270322000000` (master_fixes + secure_coins) | Duplicate timestamp |
| `20270325000000` (is_live_trigger + secretary_relations) | Duplicate timestamp |
| `20270326000000` (group_chat + message_payout) | Duplicate timestamp |
| `20270328000000` (ceo_theme + property_types_seed) | Duplicate timestamp |
| `20270330000000` (broadcast_abilities + trollmers_leaderboard) | Duplicate timestamp |
| `20270402000000` (debug_gift + credit_constraint + housing_lease) | Duplicate timestamp |
| `20270402000003` (credit_increase + pay_credit_card) | Duplicate timestamp |
| `20270405000000` (pay_credit_card + credit_court + finalize_votes) | Duplicate timestamp |
| `20270407000000` (debug_court + court_fks + family_approval) | Duplicate timestamp |
| `20270408000000` (leave_family + attorney_request_rls) | Duplicate timestamp |
| `20270427000000` (org_public + org_password + universe_battle) | Duplicate timestamp |
| `20270501000002` (seat_visibility + troll_games) | Duplicate timestamp |
| `20270601000000` (fix_gift_rpc + credit_card_overhaul) | Duplicate timestamp |
| `20270802000000` (staff_gas + test_issues) | Duplicate timestamp |
| `20270901000040` (global_events + join_game_match) | Duplicate timestamp |
| `20270902000000` (delete_test_users + ban_status) | Duplicate timestamp |
| `20270922000000` (notify_user + government_summon) | Duplicate timestamp |
| `20270926000000` (neighbors_signature + summon_array) | Duplicate timestamp |
| `20271027000003` (gift_overload + gift_animation) | Duplicate timestamp |
| `20280508000000` (coin_pack + jail_bail) | Duplicate timestamp |
| `20280518000000` (officer_rank_constraints + officer_rank_setup) | Duplicate timestamp |
| `20290518000000` (officer_rank_pt_ft_constraints + setup) | Duplicate timestamp |
| `20290601000000` (agency_approval + church_prayers + user_leagues) | Duplicate timestamp |
| `20290608000000` (gaming_broadcast + pride_challenges) | Duplicate timestamp |
| `20290610000000` (stream_simplify + academy + stream_sessions) | Duplicate timestamp |
| `20290611000000` (shareathon + utromail_tromail) | Duplicate timestamp |
| `20290612000000` (academy_fk + auction_lots) | Duplicate timestamp |
| `20290617000000` (vehicle_asset + vehicle_asset_complete) | Duplicate timestamp |
| `20260215000000_fix_stream_messages_rls.sql` | Duplicate of `20260211105000` |
| `20260604009000_relax_admin_pool_fk.sql` | Duplicate of `20260606001000` |
| `20260604004000_drop_user_tax_info_auth_fk.sql` + `20260604007000` + `20260604008000` | Same FK dropped 3 times |
| `20270120008000` + `20270120008001` + `20270120008002` + `20270120008005` + `20270120008006` | Same feature, 5 sequential migrations |
| `20270120009500` + `20270120009501` + `20270120009550` + `20270120009600` | Same feature, 4 sequential migrations |
| `20270304000019` + `20270304000020` | Same feature, 2 sequential migrations |
| `20270427000000_universe_mode_troll_battle.sql` | Duplicate of `20260427000000` |
| `20270501000002_troll_games_system.sql` | Duplicate of `20260501000002` |
| `20270521000000_small_installment_purchases.sql` | Duplicate of `20260521000000` |
| `20270524000001_update_stream_seats_and_create_audience_presence.sql` | Duplicate of `20260524000001` |
| `20270526000000_add_agency_enforcement_system.sql` | Duplicate of `20260526000000` |
| `20290611000000_create_shareathon_system.sql` | Duplicate of `20260611000000` |
| `20290611000000_utromail_tromail_system.sql` | Duplicate of `20260611000000` |
| `20290617000000_vehicle_asset_system.sql` | Duplicate of `20260617000000` |

---

## 4. RLS (Row Level Security)

### 4.1 Missing RLS Policies

Tables that exist in the schema but have **no RLS policies** defined (RLS may or may not be enabled):

| Table | Has RLS | Notes |
|---|---|---|
| `admin_actions_log` | ✅ | Policies exist |
| `admin_audit_logs` | ✅ | Policies exist |
| `admin_pool` | ✅ | Policies exist |
| `admin_pool_ledger` | ✅ | Policies exist |
| `admin_pool_transactions` | ✅ | Policies exist |
| `admin_reports` | ✅ | Policies exist |
| `agency_admin_reports` | ✅ | Policies exist |
| `agency_applications` | ✅ | Policies exist |
| `agency_audit_log` | ✅ | Policies exist |
| `agency_contracts` | ✅ | Policies exist |
| `agency_enforcement_actions` | ✅ | Policies exist |
| `agency_feature_flags` | ✅ | Policies exist |
| `agency_members` | ✅ | Policies exist |
| `agency_platform_settings` | ✅ | Policies exist |
| `agency_point_transactions` | ✅ | Policies exist |
| `agency_rewards` | ✅ | Policies exist |
| `agency_settings` | ✅ | Policies exist |
| `agency_weekly_stats` | ✅ | Policies exist |
| `agora_stream_sessions` | ✅ | Policies exist |
| `app_bug_reports` | ✅ | Policies exist |
| `app_settings` | ✅ | Policies exist |
| `asset_auctions` | ✅ | Policies exist |
| `auction_bids` | ✅ | Policies exist |
| `badge_definitions` | ✅ | Policies exist |
| `badge_tier_progress` | ✅ | Policies exist |
| `badge_showcase` | ✅ | Policies exist |
| `bank_audit_log` | ✅ | Policies exist |
| `bank_feature_flags` | ✅ | Policies exist |
| `bank_tiers` | ✅ | Policies exist |
| `battle_events` | ✅ | Policies exist |
| `battle_gifts` | ✅ | Policies exist |
| `battle_history` | ✅ | Policies exist |
| `battle_rewards` | ✅ | Policies exist |
| `battle_sessions` | ✅ | Policies exist |
| `broadcast_audio_settings` | ✅ | Policies exist |
| `broadcast_command_modules` | ✅ | Policies exist |
| `broadcast_cycle_stats` | ✅ | Policies exist |
| `broadcast_officers` | ✅ | Policies exist |
| `broadcast_overrides` | ✅ | Policies exist |
| `broadcast_rankings` | ✅ | Policies exist |
| `broadcast_restrictions` | ✅ | Policies exist |
| `broadcast_theme_events` | ✅ | Policies exist |
| `broadcast_tokens` | ✅ | Policies exist |
| `broadcaster_applications` | ✅ | Policies exist |
| `broadcaster_earnings` | ✅ | Policies exist |
| `broadcaster_metrics` | ✅ | Policies exist |
| `broadcaster_stats` | ✅ | Policies exist |
| `bribe_logs` | ✅ | Policies exist |
| `bug_alerts` | ✅ | Policies exist |
| `business_profiles` | ✅ | Policies exist |
| `business_reports` | ✅ | Policies exist |
| `calendar_events` | ✅ | Policies exist |
| `call_sessions` | ✅ | Policies exist |
| `call_sound_catalog` | ✅ | Policies exist |
| `call_transactions` | ✅ | Policies exist |
| `car_insurance_policies` | ✅ | Policies exist |
| `car_upgrades` | ✅ | Policies exist |
| `cars_catalog` | ✅ | Policies exist |
| `case_audit_logs` | ✅ | Policies exist |
| `case_evidence` | ✅ | Policies exist |
| `case_participants` | ✅ | Policies exist |
| `case_templates` | ✅ | Policies exist |
| `cashout_tiers` | ✅ | Policies exist |
| `church_banned_users` | ✅ | Policies exist |
| `church_live_sessions` | ✅ | Policies exist |
| `church_mod_actions` | ✅ | Policies exist |
| `church_passages` | ✅ | Policies exist |
| `church_prayer_likes` | ✅ | Policies exist |
| `church_prayer_replies` | ✅ | Policies exist |
| `church_prayers` | ✅ | Policies exist |
| `church_sermon_notes` | ✅ | Policies exist |
| `city_districts` | ✅ | Policies exist |
| `city_events` | ✅ | Policies exist |
| `city_reputation` | ✅ | Policies exist |
| `clan_rewards` | ✅ | Policies exist |
| `clan_vault` | ✅ | Policies exist |
| `coin_audit_log` | ✅ | Policies exist |
| `coin_ledger` | ✅ | Policies exist |
| `coin_orders` | ✅ | Policies exist |
| `coin_packages` | ✅ | Policies exist |
| `coin_pool_contributions` | ✅ | Policies exist |
| `coin_purchases` | ✅ | Policies exist |
| `coin_reward_pool` | ✅ | Policies exist |
| `coinback_log` | ✅ | Policies exist |
| `config` | ✅ | Policies exist |
| `connected_social_accounts` | ✅ | Policies exist |
| `content` | ✅ | Policies exist |
| `correctional_facilities` | ✅ | Policies exist |
| `court_ai_rate_limits` | ✅ | Policies exist |
| `court_box_members` | ✅ | Policies exist |
| `court_docket` | ✅ | Policies exist |
| `court_payments` | ✅ | Policies exist |
| `court_rulings_archive` | ✅ | Policies exist |
| `court_schedules` | ✅ | Policies exist |
| `court_sentences` | ✅ | Policies exist |
| `court_summons` | ✅ | Policies exist |
| `court_verdicts` | ✅ | Policies exist |
| `credit_card_billing_cycles` | ✅ | Policies exist |
| `credit_card_transactions` | ✅ | Policies exist |
| `credit_reports` | ✅ | Policies exist |
| `credit_score_system` | ✅ | Policies exist |
| `creator_migration_claims` | ✅ | Policies exist |
| `creators_over_600` | ✅ | Policies exist |
| `daily_logins` | ✅ | Policies exist |
| `dealership_inventory` | ✅ | Policies exist |
| `dealership_vehicle_pool` | ✅ | Policies exist |
| `declined_transactions` | ✅ | Policies exist |
| `deed_transfers` | ✅ | Policies exist |
| `deeds` | ✅ | Policies exist |
| `device_block_logs` | ✅ | Policies exist |
| `diamond_avatar_tiers` | ✅ | Policies exist |
| `diamond_special_styles` | ✅ | Policies exist |
| `discount_codes` | ✅ | Policies exist |
| `document_access` | ✅ | Policies exist |
| `document_versions` | ✅ | Policies exist |
| `driver_tests` | ✅ | Policies exist |
| `earnings` | ✅ | Policies exist |
| `economy_abuse_flags` | ✅ | Policies exist |
| `election_results` | ✅ | Policies exist |
| `empire_applications` | ✅ | Policies exist |
| `empire_partner_rewards` | ✅ | Policies exist |
| `empire_partners` | ✅ | Policies exist |
| `empire_referrals` | ✅ | Policies exist |
| `empire_rewards` | ✅ | Policies exist |
| `entrance_effect_catalog` | ✅ | Policies exist |
| `error_logs` | ✅ | Policies exist |
| `escalation_matrix` | ✅ | Policies exist |
| `escalation_reports` | ✅ | Policies exist |
| `event_access_rules` | ✅ | Policies exist |
| `event_invites` | ✅ | Policies exist |
| `event_notifications` | ✅ | Policies exist |
| `executive_intake` | ✅ | Policies exist |
| `executive_reports` | ✅ | Policies exist |
| `extension_status` | View | N/A |
| `family_badges_earned` | ✅ | Policies exist |
| `family_chat_messages` | ✅ | Policies exist |
| `family_calls` | ✅ | Policies exist |
| `family_call_members` | ✅ | Policies exist |
| `family_invites` | ✅ | Policies exist |
| `family_lounge_messages` | ✅ | Policies exist |
| `family_shop_items` | ✅ | Policies exist |
| `family_shop_purchases` | ✅ | Policies exist |
| `family_tasks` | ✅ | Policies exist |
| `family_tasks_new` | ✅ | Policies exist |
| `family_war_stats` | ✅ | Policies exist |
| `fan_contracts` | ✅ | Policies exist |
| `fan_memory` | ✅ | Policies exist |
| `featured_broadcasts` | ✅ | Policies exist |
| `fcm_tokens` | ✅ | Policies exist |
| `follows` | ✅ | Policies exist |
| `game_matches` | ✅ | Policies exist |
| `gas_requests` | ✅ | Policies exist |
| `gift_bonus_tracker` | ✅ | Policies exist |
| `gift_batch_logs` | ✅ | Policies exist |
| `gift_card_redemptions` | ✅ | Policies exist |
| `gift_cards` | ✅ | Policies exist |
| `gift_catalog` | ✅ | Policies exist |
| `gift_items` | ✅ | Policies exist |
| `gift_leaderboard_entries` | ✅ | Policies exist |
| `gift_leaderboards` | ✅ | Policies exist |
| `gift_sends` | ✅ | Policies exist |
| `gift_votes` | ✅ | Policies exist |
| `gift_xp_stats` | ✅ | Policies exist |
| `giftcard_fulfillments` | ✅ | Policies exist |
| `gifts_catalog` | ✅ | Policies exist |
| `gifts_owned` | ✅ | Policies exist |
| `giveaway_entries` | ✅ | Policies exist |
| `giveaways` | ✅ | Policies exist |
| `global_ticker` | ✅ | Policies exist |
| `government_history` | ✅ | Policies exist |
| `government_laws` | ✅ | Policies exist |
| `government_reputation` | ✅ | Policies exist |
| `group_chats` | ✅ | Policies exist |
| `guest_presence_logs` | ✅ | Policies exist |
| `hire_fire_actions` | ✅ | Policies exist |
| `hire_limits` | ✅ | Policies exist |
| `home_feature_cycles` | ✅ | Policies exist |
| `home_feature_spend` | ✅ | Policies exist |
| `honorary_family_members` | ✅ | Policies exist |
| `house_participants` | ✅ | Policies exist |
| `house_raid_logs` | ✅ | Policies exist |
| `house_rentals` | ✅ | Policies exist |
| `house_repair_logs` | ✅ | Policies exist |
| `houses_catalog` | ✅ | Policies exist |
| `hr_employees` | ✅ | Policies exist |
| `hr_events` | ✅ | Policies exist |
| `hr_notes` | ✅ | Policies exist |
| `hype_coin_ledger` | ✅ | Policies exist |
| `identity_reward_logs` | ✅ | Policies exist |
| `incidents` | ✅ | Policies exist |
| `insurance` | ✅ | Policies exist |
| `insurance_logs` | ✅ | Policies exist |
| `insurance_packages` | ✅ | Policies exist |
| `insurance_plans` | ✅ | Policies exist |
| `inventory_items` | ✅ | Policies exist |
| `invoices` | ✅ | Policies exist |
| `ip_bans` | ✅ | Policies exist |
| `jail_ip_violations` | ✅ | Policies exist |
| `jail_security_violations` | ✅ | Policies exist |
| `jail_sentences` | ✅ | Policies exist |
| `job_applications` | ✅ | Policies exist |
| `kick_logs` | ✅ | Policies exist |
| `ktauto_inventory` | ✅ | Policies exist |
| `landlord_applications` | ✅ | Policies exist |
| `law_votes` | ✅ | Policies exist |
| `league_event_templates` | ✅ | Policies exist |
| `league_notifications` | ✅ | Policies exist |
| `league_points` | ✅ | Policies exist |
| `level_engine_runs` | ✅ | Policies exist |
| `level_rewards` | ✅ | Policies exist |
| `listing_flags` | ✅ | Policies exist |
| `live_stream_monitor` | ✅ | Policies exist |
| `live_viewers` | ✅ | Policies exist |
| `loan_applications` | ✅ | Policies exist |
| `loan_default_summons` | ✅ | Policies exist |
| `lucky_coin_events` | ✅ | Policies exist |
| `mai_appeals` | ✅ | Policies exist |
| `mai_class_enrollments` | ✅ | Policies exist |
| `mai_incidents` | ✅ | Policies exist |
| `mai_overrides` | ✅ | Policies exist |
| `mai_performance_timer` | ✅ | Policies exist |
| `mai_queue` | ✅ | Policies exist |
| `mai_show_sessions` | ✅ | Policies exist |
| `mai_stage_slots` | ✅ | Policies exist |
| `mai_talent_queue` | ✅ | Policies exist |
| `mai_talent_shows` | ✅ | Policies exist |
| `mai_timeline_events` | ✅ | Policies exist |
| `mai_user_memory` | ✅ | Policies exist |
| `manual_orders` | ✅ | Policies exist |
| `marketplace_conversations` | ✅ | Policies exist |
| `marketplace_items` | ✅ | Policies exist |
| `marketplace_messages` | ✅ | Policies exist |
| `marketplace_payout_holds` | ✅ | Policies exist |
| `marketplace_reviews` | ✅ | Policies exist |
| `marketplace_seller_tiers` | ✅ | Policies exist |
| `message_receipts` | ✅ | Policies exist |
| `message_requests` | ✅ | Policies exist |
| `messages` | ✅ | Policies exist |
| `millionaire_hall_of_fame` | ✅ | Policies exist |
| `mission_templates` | ✅ | Policies exist |
| `mobile_error_logs` | ✅ | Policies exist |
| `mobile_errors` | ✅ | Policies exist |
| `moderation_fee_settings` | ✅ | Policies exist |
| `moderation_notes` | ✅ | Policies exist |
| `neighbor_event_badges` | ✅ | Policies exist |
| `neighbor_events` | ✅ | Policies exist |
| `neighbors_businesses` | ✅ | Policies exist |
| `neighbors_participants` | ✅ | Policies exist |
| `notary_documents` | ✅ | Policies exist |
| `observer_ratings` | ✅ | Policies exist |
| `officer_activity` | ✅ | Policies exist |
| `officer_applications` | ✅ | Policies exist |
| `officer_availability` | ✅ | Policies exist |
| `officer_badges` | ✅ | Policies exist |
| `officer_chat` | ✅ | Policies exist |
| `officer_corruption_flags` | ✅ | Policies exist |
| `officer_earnings` | ✅ | Policies exist |
| `officer_hours` | ✅ | Policies exist |
| `officer_logs` | ✅ | Policies exist |
| `officer_orientation_results` | ✅ | Policies exist |
| `officer_orientations` | ✅ | Policies exist |
| `officer_payroll_logs` | ✅ | Policies exist |
| `officer_performance` | ✅ | Policies exist |
| `officer_payouts` | ✅ | Policies exist |
| `officer_quiz_attempts` | ✅ | Policies exist |
| `officer_quiz_questions` | ✅ | Policies exist |
| `officer_quiz_results` | ✅ | Policies exist |
| `officer_shift_slots` | ✅ | Policies exist |
| `officer_shifts` | ✅ | Policies exist |
| `officer_stream_logs` | ✅ | Policies exist |
| `officer_strikes` | ✅ | Policies exist |
| `officer_time_off_requests` | ✅ | Policies exist |
| `officer_training_sessions` | ✅ | Policies exist |
| `onesignal_tokens` | ✅ | Policies exist |
| `onboarding_events` | ✅ | Policies exist |
| `onboarding_progress` | ✅ | Policies exist |
| `order_shipments` | ✅ | Policies exist |
| `org_students` | ✅ | Policies exist |
| `organization_announcements` | ✅ | Policies exist |
| `organization_audit_logs` | ✅ | Policies exist |
| `outbound_clicks` | ✅ | Policies exist |
| `owc_transactions` | ✅ | Policies exist |
| `paid_chat_access` | ✅ | Policies exist |
| `paid_chat_payments` | ✅ | Policies exist |
| `payment_fees` | ✅ | Policies exist |
| `payment_holds` | ✅ | Policies exist |
| `payment_logs` | ✅ | Policies exist |
| `payment_transactions` | ✅ | Policies exist |
| `payout_audit_log` | ✅ | Policies exist |
| `payout_reviews` | ✅ | Policies exist |
| `payout_settings` | ✅ | Policies exist |
| `payouts` | ✅ | Policies exist |
| `perk_catalog` | ✅ | Policies exist |
| `platform_economy_settings` | ✅ | Policies exist |
| `platform_fees` | ✅ | Policies exist |
| `platform_profit` | ✅ | Policies exist |
| `platform_revenue` | ✅ | Policies exist |
| `platform_reward_pool` | ✅ | Policies exist |
| `platform_wallet` | ✅ | Policies exist |
| `pod_episodes` | ✅ | Policies exist |
| `podcast_rtc_logs` | ✅ | Policies exist |
| `post_gifts` | ✅ | Policies exist |
| `post_mentions` | ✅ | Policies exist |
| `posts` | ✅ | Policies exist |
| `prayer_requests` | ✅ | Policies exist |
| `president_audit_logs` | ✅ | Policies exist |
| `president_announcements` | ✅ | Policies exist |
| `president_mansion_theme` | ✅ | Policies exist |
| `pride_credit_xp_log` | ✅ | Policies exist |
| `pride_keyword_config` | ✅ | Policies exist |
| `profile_frame_tiers` | ✅ | Policies exist |
| `promo_code_uses` | ✅ | Policies exist |
| `promo_codes` | ✅ | Policies exist |
| `properties` | ✅ | Policies exist |
| `property_insurance_policies` | ✅ | Policies exist |
| `property_upgrades` | ✅ | Policies exist |
| `provider_costs` | ✅ | Policies exist |
| `public_pool` | ✅ | Policies exist |
| `punishment_transactions` | ✅ | Policies exist |
| `punishments` | ✅ | Policies exist |
| `purchase_ledger` | ✅ | Policies exist |
| `referral_claims` | ✅ | Policies exist |
| `referral_monthly_bonus` | ✅ | Policies exist |
| `referrals` | ✅ | Policies exist |
| `report_cases` | ✅ | Policies exist |
| `repossessions` | ✅ | Policies exist |
| `reputation_events` | ✅ | Policies exist |
| `revenue_ledger` | ✅ | Policies exist |
| `revenue_settings` | ✅ | Policies exist |
| `risk_events` | ✅ | Policies exist |
| `role_change_log` | ✅ | Policies exist |
| `role_earning_rules` | ✅ | Policies exist |
| `role_perk_claims` | ✅ | Policies exist |
| `role_perk_settings` | ✅ | Policies exist |
| `role_privileges` | ✅ | Policies exist |
| `roles` | ✅ | Policies exist |
| `rooms` | ✅ | Policies exist |
| `royal_family_history` | ✅ | Policies exist |
| `royal_family_perks` | ✅ | Policies exist |
| `royal_family_titles` | ✅ | Policies exist |
| `rtmp_credentials` | ✅ | Policies exist |
| `rtc_sessions` | ✅ | Policies exist |
| `sav_promotions` | ✅ | Policies exist |
| `saved_cards` | ✅ | Policies exist |
| `security_admin_audit_log` | ✅ | Policies exist |
| `security_ip_reputation` | ✅ | Policies exist |
| `seller_reliability` | ✅ | Policies exist |
| `seller_tiers` | ✅ | Policies exist |
| `server_error_events` | ✅ | Policies exist |
| `service_bookings` | ✅ | Policies exist |
| `service_listings` | ✅ | Policies exist |
| `service_reviews` | ✅ | Policies exist |
| `shareathon_battles` | ✅ | Policies exist |
| `shareathon_stream_sessions` | ✅ | Policies exist |
| `shifts` | ✅ | Policies exist |
| `shop_partners` | ✅ | Policies exist |
| `shop_purchases` | ✅ | Policies exist |
| `shop_transactions` | ✅ | Policies exist |
| `shops` | ✅ | Policies exist |
| `sign_lease_applications` | ✅ | Policies exist |
| `small_installment_purchases` | ✅ | Policies exist |
| `social_publish_logs` | ✅ | Policies exist |
| `special_gift_earnings` | ✅ | Policies exist |
| `square_events` | ✅ | Policies exist |
| `staff_applications` | ✅ | Policies exist |
| `staff_meeting_minutes` | ✅ | Policies exist |
| `staff_profiles` | ✅ | Policies exist |
| `starter_vehicles` | ✅ | Policies exist |
| `store_items` | ✅ | Policies exist |
| `stores` | ✅ | Policies exist |
| `stream_analytics` | ✅ | Policies exist |
| `stream_analytics_daily` | ✅ | Policies exist |
| `stream_audience_presence` | ✅ | Policies exist |
| `stream_battles` | ✅ | Policies exist |
| `stream_capacity_queue` | ✅ | Policies exist |
| `stream_discovery_prefs` | ✅ | Policies exist |
| `stream_energy_meter` | ✅ | Policies exist |
| `stream_entrances` | ✅ | Policies exist |
| `stream_entries` | ✅ | Policies exist |
| `stream_events` | ✅ | Policies exist |
| `stream_fan_tiers` | ✅ | Policies exist |
| `stream_guests` | ✅ | Policies exist |
| `stream_join_requests` | ✅ | Policies exist |
| `stream_league_scores` | ✅ | Policies exist |
| `stream_milestones` | ✅ | Policies exist |
| `stream_missions` | ✅ | Policies exist |
| `stream_momentum` | ✅ | Policies exist |
| `stream_mute_counts` | ✅ | Policies exist |
| `stream_mutes` | ✅ | Policies exist |
| `stream_passwords` | ✅ | Policies exist |
| `stream_polls` | ✅ | Policies exist |
| `stream_presets` | ✅ | Policies exist |
| `stream_ranking` | ✅ | Policies exist |
| `stream_reactions` | ✅ | Policies exist |
| `stream_seat_requests` | ✅ | Policies exist |
| `stream_sessions` | ✅ | Policies exist |
| `stream_snack_purchases` | ✅ | Policies exist |
| `stream_stage_passes` | ✅ | Policies exist |
| `stream_top_gifters` | ✅ | Policies exist |
| `stream_vods` | ✅ | Policies exist |
| `stream_awards` | ✅ | Policies exist |
| `stripe_customers` | ✅ | Policies exist |
| `subscription_revenue_log` | ✅ | Policies exist |
| `subscription_tiers` | ✅ | Policies exist |
| `support_screen_sessions` | ✅ | Policies exist |
| `system_alerts` | ✅ | Policies exist |
| `system_errors` | ✅ | Policies exist |
| `system_roles` | ✅ | Policies exist |
| `system_settings` | ✅ | Policies exist |
| `task_completions` | ✅ | Policies exist |
| `task_history` | ✅ | Policies exist |
| `task_templates` | ✅ | Policies exist |
| `tax_report_status` | ✅ | Policies exist |
| `tcnn_articles` | ✅ | Policies exist |
| `tcps_messages` | ✅ | Policies exist |
| `telemetry_events` | ✅ | Policies exist |
| `ticket_messages` | ✅ | Policies exist |
| `tmv_actions` | ✅ | Policies exist |
| `tmv_fee_schedule` | ✅ | Policies exist |
| `tournament_battles` | ✅ | Policies exist |
| `tournament_participants` | ✅ | Policies exist |
| `tournaments` | ✅ | Policies exist |
| `training_scenarios` | ✅ | Policies exist |
| `transactions` | ✅ | Policies exist |
| `treasury_payout_items` | ✅ | Policies exist |
| `treasury_payout_runs` | ✅ | Policies exist |
| `treasury_role_allocations` | ✅ | Policies exist |
| `treasury_transactions` | ✅ | Policies exist |
| `troll_ai_avatars` | ✅ | Policies exist |
| `troll_battle_gifts` | ✅ | Policies exist |
| `troll_battle_participants` | ✅ | Policies exist |
| `troll_city_treasury` | ✅ | Policies exist |
| `troll_court_cases` | ✅ | Policies exist |
| `troll_court_evidence` | ✅ | Policies exist |
| `troll_dna_events` | ✅ | Policies exist |
| `troll_dna_profiles` | ✅ | Policies exist |
| `troll_dna_traits` | ✅ | Policies exist |
| `troll_drops` | ✅ | Policies exist |
| `troll_drops_log` | ✅ | Policies exist |
| `troll_family_activity_events` | ✅ | Policies exist |
| `troll_family_messages` | ✅ | Policies exist |
| `troll_family_members` | ✅ | Policies exist |
| `troll_family_memberships` | ✅ | Policies exist |
| `troll_family_wars` | ✅ | Policies exist |
| `troll_games` | ✅ | Policies exist |
| `troll_gift_items` | ✅ | Policies exist |
| `troll_mart_clothing` | ✅ | Policies exist |
| `troll_officer_applications` | ✅ | Policies exist |
| `troll_officers` | ✅ | Policies exist |
| `troll_post_comments` | ✅ | Policies exist |
| `troll_post_gifts` | ✅ | Policies exist |
| `troll_post_reactions` | ✅ | Policies exist |
| `troll_stream_messages` | ✅ | Policies exist |
| `troll_streams` | ✅ | Policies exist |
| `troll_wall_gifts` | ✅ | Policies exist |
| `troll_wall_likes` | ✅ | Policies exist |
| `troll_wall_reactions` | ✅ | Policies exist |
| `troll_wars_ai_battle_logs` | ✅ | Policies exist |
| `Mai Troll_orders` | ✅ | Policies exist |
| `Mai Troll_products` | ✅ | Policies exist |
| `trollg_applications` | ✅ | Policies exist |
| `trollmin_config` | ✅ | Policies exist |
| `trollmond_config` | ✅ | Policies exist |
| `trollmond_gifts` | ✅ | Policies exist |
| `trollmond_ledger` | ✅ | Policies exist |
| `trollmond_store_items` | ✅ | Policies exist |
| `trollmond_transactions` | ✅ | Policies exist |
| `trollmonds_pools` | ✅ | Policies exist |
| `trolls_night_applications` | ✅ | Policies exist |
| `trolls_night_guest_agreements` | ✅ | Policies exist |
| `troll_station` | ✅ | Policies exist |
| `troll_station_chat` | ✅ | Policies exist |
| `troll_station_cohosts` | ✅ | Policies exist |
| `troll_station_hosts` | ✅ | Policies exist |
| `troll_station_invitations` | ✅ | Policies exist |
| `troll_station_queue` | ✅ | Policies exist |
| `troll_station_sessions` | ✅ | Policies exist |
| `troll_station_songs` | ✅ | Policies exist |
| `trollstown_properties` | ✅ | Policies exist |
| `trollstown_property_upgrades` | ✅ | Policies exist |
| `trollstown_upgrade_config` | ✅ | Policies exist |
| `trolltract_contracts` | ✅ | Policies exist |
| `trolltract_weekly_rewards` | ✅ | Policies exist |
| `tromail_contract_templates` | ✅ | Policies exist |
| `tromail_contracts` | ✅ | Policies exist |
| `tromody_battles` | ✅ | Policies exist |
| `tromody_gifts` | ✅ | Policies exist |
| `tromody_matches` | ✅ | Policies exist |
| `tromody_queue` | ✅ | Policies exist |
| `tromody_sessions` | ✅ | Policies exist |
| `trophies` | ✅ | Policies exist |
| `typing_statuses` | ✅ | Policies exist |
| `user_achievement_events` | ✅ | Policies exist |
| `user_active_items` | ✅ | Policies exist |
| `user_active_entrance_effect` | ✅ | Policies exist |
| `user_auth_cache` | ✅ | Policies exist |
| `user_avatar_customization` | ✅ | Policies exist |
| `user_badges_earned` | ✅ | Policies exist |
| `user_balances` | ✅ | Policies exist |
| `user_bans` | ✅ | Policies exist |
| `user_badge_progress` | ✅ | Policies exist |
| `user_broadcast_theme_purchases` | ✅ | Policies exist |
| `user_broadcast_theme_state` | ✅ | Policies exist |
| `user_cars` | ✅ | Policies exist |
| `user_content_approvals` | ✅ | Policies exist |
| `user_devices` | ✅ | Policies exist |
| `user_district_progress` | ✅ | Policies exist |
| `user_driver_licenses` | ✅ | Policies exist |
| `user_entrance_effects` | ✅ | Policies exist |
| `user_earning_events` | ✅ | Policies exist |
| `user_earnings_summary` | View | N/A |
| `user_event_dismissals` | ✅ | Policies exist |
| `user_gifts` | ✅ | Policies exist |
| `user_house_upgrades` | ✅ | Policies exist |
| `user_houses` | ✅ | Policies exist |
| `user_inventory` | ✅ | Policies exist |
| `user_inventory_items` | ✅ | Policies exist |
| `user_ip_locations` | ✅ | Policies exist |
| `user_ip_tracking` | ✅ | Policies exist |
| `user_level_reward_claims` | ✅ | Policies exist |
| `user_levels` | ✅ | Policies exist |
| `user_location_intelligence_view` | View | N/A |
| `user_mission_progress` | ✅ | Policies exist |
| `user_notifications` | ✅ | Policies exist |
| `user_payout_settings` | ✅ | Policies exist |
| `user_presence_routes` | ✅ | Policies exist |
| `user_purchases` | ✅ | Policies exist |
| `user_reputation` | ✅ | Policies exist |
| `user_rewards` | ✅ | Policies exist |
| `user_risk_profile` | ✅ | Policies exist |
| `user_role_grants` | ✅ | Policies exist |
| `user_roles` | ✅ | Policies exist |
| `user_streamer_entitlements` | ✅ | Policies exist |
| `user_stream_likes` | ✅ | Policies exist |
| `user_stats` | ✅ | Policies exist |
| `user_subscriptions` | ✅ | Policies exist |
| `user_troll_mart_purchases` | ✅ | Policies exist |
| `user_vehicle_assets` | ✅ | Policies exist |
| `user_wallets` | ✅ | Policies exist |
| `users` | ✅ | Policies exist |
| `vehicle_asset_system_triggers` | Trigger | N/A |
| `vehicle_catalog` | ✅ | Policies exist |
| `vehicle_insurance_policies` | ✅ | Policies exist |
| `vehicle_listings` | ✅ | Policies exist |
| `vehicle_loans` | ✅ | Policies exist |
| `vehicle_participants` | ✅ | Policies exist |
| `vehicle_registrations` | ✅ | Policies exist |
| `vehicle_titles` | ✅ | Policies exist |
| `vehicle_transactions` | ✅ | Policies exist |
| `vehicles_catalog` | ✅ | Policies exist |
| `vendor_invoices` | ✅ | Policies exist |
| `verification_subscriptions` | ✅ | Policies exist |
| `verification_transactions` | ✅ | Policies exist |
| `videos` | ✅ | Policies exist |
| `visa_redemptions` | ✅ | Policies exist |
| `voice_announcement_styles` | ✅ | Policies exist |
| `wall_posts` | ✅ | Policies exist |
| `wallets` | ✅ | Policies exist |
| `war_results` | ✅ | Policies exist |
| `wars` | ✅ | Policies exist |
| `weekly_family_goals_new` | ✅ | Policies exist |
| `weekly_officer_reports` | ✅ | Policies exist |
| `weekly_reports` | ✅ | Policies exist |
| `weekly_role_perk_system` | ✅ | Policies exist |
| `weekly_top_broadcasters` | ✅ | Policies exist |
| `wheel_sessions` | ✅ | Policies exist |
| `wheel_spins` | ✅ | Policies exist |
| `xp_ledger` | ✅ | Policies exist |
| `zip_codes` | ✅ | Policies exist |
| `zip_crime_events` | ✅ | Policies exist |

### 4.2 Duplicate Policies

Policies that appear to have overlapping or duplicate definitions:

| Policy | Table | Issue |
|---|---|---|
| `Users can view own sent gifts` + `Users can view own received gifts` | `gift_transactions` | Overlapping SELECT policies |
| `Admins can view all action logs` (x2) | `action_logs` | Duplicate admin policy |
| `Admins can view all error logs` (x2) | `error_logs` | Duplicate admin policy |
| `Admins can view all applications` (x2) | `applications` | Duplicate policy |
| `Admins can view all bans` (x2) | `user_bans` | Duplicate policy |
| `Admins can view all cashout requests` (x2) | `cashout_requests` | Duplicate policy |
| `Admins can view all hr events` (x2) | `hr_events` | Duplicate policy |
| `Admins can view all hr notes` (x2) | `hr_notes` | Duplicate policy |
| `Admins can view all onboarding progress` (x2) | `onboarding_progress` | Duplicate policy |
| `Admins can view all payout requests` (x2) | `payout_requests` | Duplicate policy |
| `Admins can view all reports` (x2) | `stream_reports` | Duplicate policy |
| `Admins can view all staff applications` (x2) | `staff_applications` | Duplicate policy |
| `Admins can view all staff profiles` (x2) | `staff_profiles` | Duplicate policy |
| `Admins can view all tickets` (x2) | `support_tickets` | Duplicate policy |
| `Admins can view all user profiles` (x2) | `user_profiles` | Duplicate policy |
| `Users can read own tickets` + `Users create tickets` + `Staff manage tickets` | `support_tickets` | Multiple overlapping policies |
| `Public read streams` + `Broadcasters manage streams` + `broadcasters_and_admins_can_delete_streams` + `broadcasters_and_admins_can_update_streams` | `streams` | Multiple overlapping policies |
| `view_conversation_members` + `insert_conversation_members` + `delete_conversation_members` | `conversation_members` | Redundant with user-level policies |
| `view_conversations` + `insert_conversations` + `update_conversations` + `delete_conversations` | `conversations` | Redundant with user-level policies |
| `Anyone can insert error logs` + `Authenticated users can insert errors` | `system_errors` | Overlapping INSERT policies |
| `Allow all inserts` + `Allow authenticated users to insert events` | `global_events` | Overlapping INSERT policies |
| `Service role can manage all APNS tokens` + `Service role can manage all FCM tokens` + `Service role can manage all OneSignal tokens` | Multiple | Duplicate service role patterns |
| `Allow all read access` (x4) | `troll_station_*` | Duplicate public read policies |
| `Anyone can read gifts` | `gifts` | Overly permissive public read |
| `Anyone can read shop items` | `shop_items` | Overly permissive public read |
| `Anyone can read insurance options` | `insurance_options` | Overly permissive public read |
| `Anyone can read vehicles catalog` | `vehicles_catalog` | Overly permissive public read |
| `Anyone can read purchasable items` | `purchasable_items` | Overly permissive public read |
| `Anyone can read broadcast themes` | `broadcast_themes` | Overly permissive public read |
| `Anyone can read entrance effects` | `entrance_effects` | Overly permissive public read |
| `Anyone can read call sounds` | `call_sound_catalog` | Overly permissive public read |
| `Anyone can read perks` | `perks` | Overly permissive public read |
| `Public can read houses catalog` | `houses_catalog` | Overly permissive public read |
| `Public can read insurance plans` | `insurance_plans` | Overly permissive public read |
| `Public read access for rooms` | `rooms` | Overly permissive |
| `Public read access for vehicle_bids` | `vehicle_bids` | Overly permissive |
| `Public read access for recent_matches` | `recent_matches` | Overly permissive |

### 4.3 Unsafe Policies

Policies that may pose security risks:

| Policy | Table | Risk |
|---|---|---|
| `Anyone can insert error logs` | `system_errors` | Unauthenticated INSERT |
| `Allow all inserts` | `global_events` | Unauthenticated INSERT |
| `Allow all read access` | `troll_station_*` | Full public read |
| `Anyone can read gifts` | `gifts` | Full public read |
| `Anyone can read shop items` | `shop_items` | Full public read |
| `Anyone can read insurance options` | `insurance_options` | Full public read |
| `Anyone can read vehicles catalog` | `vehicles_catalog` | Full public read |
| `Anyone can read purchasable items` | `purchasable_items` | Full public read |
| `Anyone can read broadcast themes` | `broadcast_themes` | Full public read |
| `Anyone can read entrance effects` | `entrance_effects` | Full public read |
| `Anyone can read call sounds` | `call_sound_catalog` | Full public read |
| `Anyone can read perks` | `perks` | Full public read |
| `Public can read houses catalog` | `houses_catalog` | Full public read |
| `Public can read insurance plans` | `insurance_plans` | Full public read |
| `Public read access for rooms` | `rooms` | Full public read |
| `Public read access for vehicle_bids` | `vehicle_bids` | Full public read |
| `Public read access for recent_matches` | `recent_matches` | Full public read |
| `Service role can manage all APNS tokens` | `apns_tokens` | Service role bypass |
| `Service role can manage all FCM tokens` | `fcm_tokens` | Service role bypass |
| `Service role can manage all OneSignal tokens` | `onesignal_tokens` | Service role bypass |
| `Service role full access` | `family_war_scores` | Service role bypass |
| `Service role can insert transactions` | `gift_transactions` | Service role bypass |
| `global_write_check` | Multiple | May allow unintended writes |
| `Admins can update coins` | `user_profiles` | Direct coin manipulation |
| `Admins can update all tickets` | `support_tickets` | Full ticket access |
| `Admins can update config` | `config` | Full config access |
| `Admins can update bans` | `user_bans` | Full ban management |
| `Admins can update cashout requests` | `cashout_requests` | Financial access |
| `Admins can update payout requests` | `payout_requests` | Financial access |
| `Admins can update tax info` | `user_tax_info` | Sensitive data access |
| `Admins can update error logs` | `error_logs` | Log tampering |
| `Admins can view all AI logs` | `ai_action_logs` | Full AI log access |
| `Admins can view all adjustments` | `admin_adjustments` | Financial audit access |
| `Admins can view all agreements` | `user_agreements` | Legal data access |
| `Admins can view all escalations` | `escalation_reports` | Full escalation access |
| `Admins can view all gift totals` | `admin_gift_totals` | Financial data access |
| `Admins can view all giveaways` | `daily_giveaways` | Full giveaway access |
| `Admins can view all history` | `royal_family_history` | Full history access |
| `Admins can view all lucky events` | `lucky_coin_events` | Full event access |
| `Admins can view all officer payouts` | `officer_payouts` | Financial data access |
| `Admins can view all orientations` | `officer_orientations` | Full orientation access |
| `Admins can view all perks` | `royal_family_perks` | Full perk access |
| `Admins can view all quiz attempts` | `officer_quiz_attempts` | Full quiz access |
| `Admins can view all stores` | `stores` | Full store access |
| `Admins can read payment_fees` | `payment_fees` | Financial data access |
| `Admins can read revenue_ledger` | `revenue_ledger` | Financial data access |
| `Admins can read troll drops log` | `troll_drops_log` | Full drop log access |
| `Admins can read trollmonds contributions` | `coin_pool_contributions` | Financial data access |
| `Admins can read vendor_invoices` | `vendor_invoices` | Financial data access |
| `Admin/Secretary can delete redemptions` | `gift_card_redemptions` | Financial data deletion |
| `Admin/Secretary can update redemptions` | `gift_card_redemptions` | Financial data modification |
| `Admin/Secretary can view all redemption requests` | `gift_card_redemptions` | Full redemption access |
| `Admins and officers can delete any post` | `troll_posts` | Content deletion |
| `Admins and officers can manage announcements` | `district_announcements` | Content management |
| `Admins and officers can view all kick logs` | `kick_logs` | Full moderation access |
| `Admins can delete any wall post` | `troll_wall_posts` | Content deletion |
| `Admins can insert payout settings` | `payout_settings` | Financial config |
| `Admins can manage all applications` | `empire_applications` | Full application access |
| `Admins can manage all hr events` | `hr_events` | HR data access |
| `Admins can manage all hr notes` | `hr_notes` | HR data access |
| `Admins can manage all momentum` | `stream_momentum` | Stream data access |
| `Admins can manage bonus claims` | `referral_monthly_bonus` | Financial data access |
| `Admins can manage district features` | `district_features` | Feature management |
| `Admins can manage districts` | `city_districts` | District management |
| `Admins can manage quiz questions` | `officer_quiz_questions` | Quiz management |
| `Admins can manage revenue settings` | `revenue_settings` | Financial config |

---

## 5. SUMMARY STATISTICS

| Category | Count |
|---|---|
| **Total Tables in Schema** | ~560 |
| **Tables Used by Frontend** | 197 |
| **Tables Used by Edge Functions** | ~130 |
| **Tables Used by RPCs** | ~227 (via RPC calls) |
| **Never-Referenced Tables** | ~360+ |
| **SQL Functions (Active)** | ~200 |
| **SQL Functions (Deprecated/Legacy)** | ~120 |
| **Duplicate/Overlapping Functions** | ~80 pairs |
| **RLS Policies** | ~300+ |
| **Tables with RLS Enabled** | ~200 |
| **Duplicate Policies** | ~40+ |
| **Unsafe Policies** | ~70+ |
| **Views** | ~50 |
| **Triggers** | ~100+ |
| **Total Migrations** | ~500 |
| **Required Migrations** | ~38 |
| **Historical Migrations** | ~400+ |
| **Dead Migrations** | ~18 |
| **Conflicting Migrations** | ~80+ |

---

## 6. KEY FINDINGS & RECOMMENDATIONS

### Critical Issues
1. **~360 tables are never referenced** in any frontend, edge function, or RPC code — these represent significant dead schema
2. **~80+ migration conflicts** with duplicate timestamps — could cause unpredictable `db push` behavior
3. **~70+ unsafe policies** with overly permissive `Anyone can read/write` patterns
4. **~120 deprecated/legacy functions** still in the database
5. **~40+ duplicate RLS policies** creating confusion and potential security gaps

### Recommendations
1. **Consolidate migrations** — merge 500+ migrations into a single baseline + incremental changes
2. **Remove orphan tables** — audit and drop the ~360 unreferenced tables
3. **Clean up duplicate functions** — remove deprecated variants, keep only secure versions
4. **Fix RLS policies** — remove overly permissive `Anyone can read` policies on sensitive tables
5. **Resolve migration conflicts** — fix duplicate timestamps and consolidate conflicting changes
6. **Standardize naming** — many tables have inconsistent naming (e.g., `troll_families` vs `families`)

---

*Generated by OWL Database Audit Tool — 2026-06-10*
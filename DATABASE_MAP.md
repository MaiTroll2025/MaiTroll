# 🗺️ Mai Troll — DATABASE RELATIONSHIP MAP

**Audit Date:** 2026-06-13  
**Database:** Supabase (PostgreSQL)  
**Total Tables:** ~500+

---

## 🔑 CENTRAL HUB: `user_profiles`

Almost every table in the database relates back to `user_profiles` via `user_id` foreign key.

```
user_profiles (id)
├── user_roles
├── user_agreements
├── user_tax_info
├── user_devices
├── user_ip_tracking
├── user_risk_profile
├── user_reputation
├── user_levels
├── user_perks
├── user_badges_earned
├── user_entrance_effects
├── user_call_sounds
├── user_boosts
├── user_streamer_entitlements
├── user_notifications
├── user_payment_methods
├── user_payout_settings
├── user_inventory
├── user_wallets
├── user_balances
├── user_credit
├── active_sessions
├── applications
├── creator_applications
├── verification_requests
│
├── 💰 ECONOMY
│   ├── coin_transactions
│   ├── coin_ledger
│   ├── coin_purchases
│   ├── transactions
│   ├── payment_fees
│   ├── payment_holds
│   ├── payment_logs
│   ├── payment_transactions
│   ├── declined_transactions
│   ├── stripe_customers
│   ├── coin_orders
│   ├── paypal_transactions
│   ├── credit_card_transactions
│   ├── credit_card_billing_cycles
│   ├── balance_ledger
│   ├── bank_tiers
│   ├── bank_audit_log
│   ├── hype_coin_ledger
│   ├── trollmonds
│   ├── payout_requests
│   ├── payout_audit_log
│   ├── payout_reviews
│   ├── payout_settings
│   ├── payout_batches
│   ├── payout_methods
│   ├── payout_tiers
│   ├── cashout_requests
│   ├── cashout_tiers
│   ├── earnings_payouts
│   ├── manual_coin_orders
│   ├── loans
│   ├── loan_applications
│   ├── loan_payments
│   ├── loan_default_summons
│   ├── credit_score_system
│   ├── credit_tiers
│   ├── credit_card_system
│   ├── credit_card_repossession
│   ├── insurance_system
│   ├── insurance_plans
│   ├── insurance_claims
│   ├── stocks
│   ├── user_portfolio
│   ├── stock_price_history
│   ├── pitch_contests
│   ├── pitch_votes
│   ├── admin_pool
│   ├── admin_pool_transactions
│   ├── admin_pool_buckets
│   ├── admin_coin_pool
│   ├── admin_coin_revenue
│   ├── platform_fees
│   ├── platform_revenue
│   ├── platform_profit
│   ├── revenue_ledger
│   ├── troll_city_treasury
│   ├── treasury_transactions
│   ├── treasury_role_allocations
│   ├── treasury_payout_runs
│   └── treasury_payout_items
│
├── 📺 STREAMING
│   ├── streams
│   │   ├── stream_participants
│   │   ├── stream_messages
│   │   ├── stream_gifts
│   │   ├── stream_likes
│   │   ├── stream_viewers
│   │   ├── stream_seats
│   │   │   ├── stream_seat_sessions
│   │   │   └── broadcast_seat_bans
│   │   ├── stream_events
│   │   ├── stream_sessions
│   │   ├── stream_reports
│   │   ├── stream_missions
│   │   ├── stream_presets
│   │   ├── stream_ranking
│   │   ├── stream_reactions
│   │   ├── stream_entrances
│   │   ├── stream_vods
│   │   ├── stream_snack_purchases
│   │   ├── stream_momentum
│   │   ├── stream_mute_counts
│   │   ├── stream_passwords
│   │   ├── stream_join_requests
│   │   ├── stream_discovery_prefs
│   │   ├── stream_audience_presence
│   │   ├── stream_guests
│   │   ├── stream_bans
│   │   ├── stream_kicks
│   │   ├── stream_settings
│   │   ├── stream_awards
│   │   ├── stream_goals
│   │   ├── stream_milestones
│   │   ├── stream_polls
│   │   ├── stream_analytics
│   │   ├── stream_rtc_monitor
│   │   ├── stream_gift_viewer_xp
│   │   ├── stream_health
│   │   ├── stream_recordings
│   │   ├── stream_box_count
│   │   ├── stream_frame_mode
│   │   ├── stream_last_activity
│   │   ├── stream_theme
│   │   ├── stream_capacity
│   │   ├── stream_viewer_cap
│   │   ├── stream_lockdown
│   │   ├── stream_pricing
│   │   ├── stream_notification
│   │   ├── stream_disclaimer
│   │   └── stream_audience_and_seats
│   ├── broadcast_seats
│   ├── broadcast_tokens
│   ├── broadcast_background_themes
│   ├── broadcast_cycle_stats
│   ├── broadcast_theme_events
│   ├── broadcaster_applications
│   ├── broadcaster_earnings
│   ├── broadcaster_metrics
│   ├── broadcast_restrictions
│   ├── broadcast_overrides
│   ├── broadcast_active_effects
│   ├── broadcast_ability_logs
│   ├── broadcast_command_modules
│   ├── broadcast_rankings
│   ├── featured_broadcasts
│   ├── weekly_top_broadcasters
│   ├── saved_streams
│   ├── entrance_effects
│   ├── broadcast_effects
│   ├── broadcast_themes
│   ├── broadcast_theme_prices
│   ├── broadcast_rgb
│   ├── glowing_username
│   ├── glowing_username_color
│   ├── premium_frames
│   ├── ceo_theme
│   └── ceo_perks
│
├── ⚔️ BATTLES & GAMING
│   ├── troll_battles
│   │   ├── battle_gifts
│   │   ├── battle_history
│   │   ├── battle_rewards
│   │   ├── battle_sessions
│   │   ├── battle_events
│   │   ├── battle_score
│   │   ├── battle_pot
│   │   ├── battle_crown_streak
│   │   └── battle_theme
│   ├── games
│   │   ├── game_players
│   │   ├── game_votes
│   │   └── game_matches
│   ├── trophies
│   ├── wars
│   │   └── war_results
│   ├── tournaments
│   │   └── tournament_participants
│   ├── troll_battle_gifts
│   ├── troll_dna_events
│   ├── troll_dna_profiles
│   │   └── troll_dna_traits
│   ├── troll_us_game
│   ├── trollopoly
│   ├── troll_toe
│   ├── troll_wheel_sessions
│   ├── giveaways
│   │   └── giveaway_entries
│   ├── troll_games
│   │   ├── troll_games_queue
│   │   └── troll_games_matches
│   └── trollmers_tournament
│
├── 👨‍👩‍👧 FAMILY
│   ├── troll_families
│   │   ├── troll_family_members
│   │   ├── troll_family_memberships
│   │   ├── troll_family_messages
│   │   ├── troll_family_wars
│   │   └── troll_family_activity_events
│   ├── families
│   │   ├── family_members
│   │   ├── family_activity_log
│   │   ├── family_badges_earned
│   │   ├── family_boosts
│   │   ├── family_invites
│   │   ├── family_lounge_messages
│   │   ├── family_seasons
│   │   ├── family_shop_items
│   │   ├── family_shop_purchases
│   │   ├── family_stats
│   │   ├── family_tasks
│   │   ├── family_tasks_new
│   │   ├── family_war_stats
│   │   └── family_wars
│   ├── troll_family_league_seasons
│   │   └── troll_family_league_standings
│   └── family_leagues
│
├── 🏛️ GOVERNMENT
│   ├── president_proposals
│   ├── president_audit_logs
│   ├── president_announcements
│   ├── president_appointments
│   ├── president_powers
│   ├── government_laws
│   │   └── law_votes
│   ├── districts
│   │   ├── district_announcements
│   │   └── district_features
│   ├── zip_codes
│   │   ├── officer_performance
│   │   ├── officer_corruption_flags
│   │   └── zip_crime_events
│   ├── government_reputation
│   ├── city_reputation
│   ├── government_history
│   ├── protests
│   │   └── protest_participants
│   ├── emergency_powers_log
│   ├── bribe_logs
│   ├── troting
│   ├── election_candidates
│   │   └── election_votes
│   ├── government_streams
│   └── government_sector
│
├── ⚖️ COURT & JUSTICE
│   ├── court_cases
│   │   ├── court_dockets
│   │   ├── court_sessions
│   │   ├── court_summons
│   │   ├── court_rulings_archive
│   │   ├── court_schedules
│   │   ├── court_ai_messages
│   │   ├── court_box_members
│   │   ├── court_participants
│   │   ├── court_evidence
│   │   ├── court_state
│   │   └── court_fines
│   ├── troll_court_cases
│   │   └── troll_court_evidence
│   ├── jail
│   ├── jail_sentences
│   ├── jail_bail
│   ├── jail_appeal
│   ├── punishments
│   │   └── punishment_transactions
│   ├── chat_blocks
│   ├── stream_kicks
│   ├── abuse_reports
│   ├── stream_reports
│   ├── user_reports
│   ├── report_details
│   └── appeals
│
├── 👮 OFFICER SYSTEM
│   ├── officer_shift_logs
│   ├── officer_weekly_reports
│   ├── officer_chat_messages
│   ├── officer_assignments
│   ├── officer_scheduling
│   ├── officer_time_off
│   ├── officer_payroll
│   │   └── officer_payroll_logs
│   ├── officer_sessions
│   ├── officer_status
│   ├── officer_vote
│   │   └── officer_vote_cycle
│   ├── officer_of_week
│   ├── officer_rank
│   ├── officer_employment_type
│   ├── officer_breaks
│   ├── officer_actions
│   ├── officer_moderation
│   ├── officer_enforcement
│   ├── officer_salary
│   └── officer_ladder
│
├── 💬 MESSAGING
│   ├── conversations
│   │   ├── conversation_members
│   │   └── messages
│   │       └── message_read
│   ├── tromail
│   │   ├── tromail_contracts
│   │   ├── tromail_calendar
│   │   └── tromail_roles
│   ├── utromail
│   ├── group_chats
│   │   ├── group_chat_members
│   │   └── group_chat_messages
│   ├── friend_requests
│   └── blocked_users
│
├── 🛒 MARKETPLACE
│   ├── marketplace_items
│   │   ├── marketplace_conversations
│   │   │   └── marketplace_messages
│   │   ├── marketplace_orders
│   │   ├── marketplace_reviews
│   │   └── listing_flags
│   ├── shop_items
│   │   ├── shop_transactions
│   │   └── shop_partners
│   ├── shops
│   ├── store_items
│   │   └── stores
│   ├── Mai Troll_orders
│   │   ├── Mai Troll_products
│   │   └── Mai Troll_shops
│   ├── seller_reliability
│   ├── seller_tiers
│   ├── business_profiles
│   │   ├── service_listings
│   │   ├── service_bookings
│   │   └── service_reviews
│   ├── trollifieds
│   │   └── trollifieds_categories
│   ├── inventory
│   │   └── inventory_expiry
│   ├── purchasable_items
│   │   └── purchases
│   └── broadcast_pinned_services
│
├── 🚗 VEHICLES & TMV
│   ├── vehicles_catalog
│   │   ├── user_vehicles
│   │   │   ├── vehicle_titles
│   │   │   ├── vehicle_registrations
│   │   │   ├── vehicle_insurance_policies
│   │   │   ├── vehicle_loans
│   │   │   ├── vehicle_transactions
│   │   │   ├── vehicle_listings
│   │   │   ├── vehicle_upgrades
│   │   │   │   └── user_vehicle_upgrades
│   │   │   └── user_vehicle_assets
│   │   └── car_insurance_policies
│   ├── cars_catalog
│   │   ├── car_upgrades
│   │   │   └── user_car_upgrades
│   │   └── user_cars
│   ├── user_driver_licenses
│   ├── tmv_fee_schedule
│   ├── tmv_actions
│   ├── dealership_inventory
│   ├── dealership_vehicle_pool
│   ├── property_insurance_policies
│   ├── gas_requests
│   ├── invoices
│   └── repossession
│
├── 🏠 REAL ESTATE
│   ├── houses_catalog
│   │   ├── user_houses
│   │   │   ├── house_upgrades
│   │   │   │   └── user_house_upgrades
│   │   │   ├── house_rentals
│   │   │   ├── house_raid_logs
│   │   │   └── house_repair_logs
│   │   └── property_insurance_policies
│   ├── properties
│   │   ├── property_upgrades
│   │   ├── deed_transfers
│   │   └── deeds
│   ├── trollstown_properties
│   │   ├── trollstown_property_upgrades
│   │   └── trollstown_upgrade_config
│   ├── home_feature_cycles
│   ├── home_feature_spend
│   ├── rental_market
│   ├── rental_marketplace
│   ├── landlord
│   ├── neighbors
│   │   ├── neighbors_events
│   │   │   └── neighbors_participants
│   │   ├── neighbors_businesses
│   │   ├── neighbors_hiring
│   │   └── neighbors_approval
│   └── user_house_upgrades
│
├── 🔨 AUCTIONS
│   ├── auction_shows
│   │   ├── auction_lots
│   │   │   ├── auction_bids
│   │   │   └── auction_bidders
│   │   ├── auction_sales
│   │   ├── auction_reports
│   │   ├── auction_analytics
│   │   ├── auction_inventory
│   │   ├── auction_orders
│   │   ├── auction_packing
│   │   ├── auction_devices
│   │   ├── auction_settings
│   │   └── auction_applications
│   ├── auction_watchlist
│   └── auction_interactive
│
├── 🎓 ACADEMY
│   ├── academy_courses
│   │   ├── academy_enrollments
│   │   ├── academy_lessons
│   │   ├── academy_assignments
│   │   │   ├── academy_submissions
│   │   │   └── academy_grading
│   │   ├── academy_quizzes
│   │   │   └── academy_quiz_questions
│   │   ├── academy_attendance
│   │   ├── academy_grades
│   │   ├── academy_certificates
│   │   ├── academy_transcripts
│   │   ├── academy_pathways
│   │   ├── academy_loans
│   │   ├── academy_admissions
│   │   ├── academy_accreditation
│   │   ├── academy_coins
│   │   ├── academy_communication
│   │   └── academy_revenue
│   ├── academy_teachers
│   ├── mai_class_system
│   │   ├── mai_class_sessions
│   │   └── mai_class_enrollment
│   └── teacher_revenue
│
├── 🏢 AGENCIES
│   ├── agencies
│   │   ├── agency_members
│   │   ├── agency_settings
│   │   ├── agency_hr
│   │   ├── agency_applications
│   │   ├── agency_weekly_evaluation
│   │   ├── agency_creator_earnings
│   │   ├── agency_enforcement
│   │   └── agency_fee
│   └── agency_safe_recruit
│
├── ⛪ CHURCH
│   ├── church
│   │   ├── church_services
│   │   ├── church_members
│   │   ├── church_prayers
│   │   │   └── church_prayer_replies
│   │   ├── church_donations
│   │   └── church_live
│   └── church_pastor
│
├── 📺 TCNN
│   ├── tcnn_articles
│   │   └── tcnn_categories
│   ├── tcnn_authors
│   ├── tcnn_streams
│   ├── tcnn_roles
│   ├── tcnn_tipping
│   ├── tcnn_setup
│   └── tcnn_viewer
│
├── 🎙️ PODCAST
│   ├── podcasts
│   │   ├── podcast_episodes
│   │   ├── podcast_hosts
│   │   ├── podcast_guests
│   │   ├── podcast_chat
│   │   ├── podcast_subscriptions
│   │   └── podcast_tasks
│   ├── podcast_covers
│   ├── podcast_moderation
│   └── podcast_terms
│
├── 🔔 NOTIFICATIONS
│   ├── notifications
│   ├── notification_preferences
│   ├── push_subscriptions
│   ├── web_push_subscriptions
│   ├── announcement_preferences
│   ├── bulk_notifications
│   ├── admin_notifications
│   ├── staff_notifications
│   ├── jail_sentence_notifications
│   ├── payout_notifications
│   └── message_payout_notifications
│
├── 🏆 SOCIAL & ENGAGEMENT
│   ├── follows
│   ├── friend_requests
│   ├── user_likes
│   ├── troll_posts
│   │   ├── troll_post_views
│   │   ├── troll_post_comments
│   │   ├── troll_post_reactions
│   │   └── troll_post_engagement
│   ├── troll_wall_posts
│   ├── post_reactions
│   ├── post_comments
│   ├── post_media
│   ├── badge_definitions
│   │   ├── user_badges
│   │   ├── badge_catalog
│   │   ├── badge_tier_progress
│   │   ├── badge_showcase
│   │   ├── badge_stats
│   │   └── badge_icons
│   ├── xp_system
│   ├── level_rewards
│   ├── level_perks
│   ├── weekly_challenges
│   ├── pride_weekly_challenges
│   ├── daily_rewards
│   ├── daily_login
│   ├── daily_login_posts
│   ├── referral_bonuses
│   ├── referrals
│   ├── shareathon
│   │   ├── shareathon_entries
│   │   ├── shareathon_leaderboard
│   │   └── shareathon_verification
│   ├── trollifications
│   ├── rolling_gift_leaderboard
│   └── universal_earnings
│
├── 📢 ADVERTISING
│   ├── advertisements
│   │   └── advertisement_queue
│   ├── city_ads
│   │   └── city_ad_image
│   ├── featured_broadcasts
│   ├── buy_featured_promotion
│   ├── x_ads_system
│   └── x_ads_studio
│
├── 👥 ORGANIZATIONS
│   ├── organizations
│   │   ├── organization_members
│   │   ├── organization_files
│   │   ├── organization_messages
│   │   └── organization_students
│   └── organization_management_hub
│
├── 📋 CONTRACTS & LEGAL
│   ├── contracts
│   │   ├── contract_templates
│   │   └── contract_signatures
│   ├── notary_documents
│   ├── attorney_requests
│   └── attorney_prosecutor
│
├── 🎭 EVENTS & SEASONAL
│   ├── global_events
│   ├── troll_events
│   ├── troll_drop
│   ├── easter_egg_hunt
│   ├── april_fools
│   ├── pride_month
│   │   ├── pride_shop
│   │   └── pride_legacy_theme
│   ├── holiday_themes
│   └── weather
│
├── 🎵 MEDIA & ENTERTAINMENT
│   ├── troll_station
│   │   ├── troll_station_songs
│   │   ├── troll_station_queue
│   │   ├── troll_station_sessions
│   │   ├── troll_station_hosts
│   │   ├── troll_station_cohosts
│   │   ├── troll_station_invitations
│   │   └── troll_station_chat
│   ├── troll_match
│   │   └── troll_match_participants
│   ├── troll_min
│   ├── troll_town
│   ├── troll_identity_lab
│   ├── media_library
│   └── upload_verification
│
├── 🔧 ADMIN & SYSTEM
│   ├── admin_adjustments
│   ├── admin_broadcasts
│   ├── admin_flags
│   ├── admin_gift_totals
│   ├── admin_tax_reviews
│   ├── admin_top_buyers
│   ├── admin_errors
│   ├── system_settings
│   ├── system_config
│   ├── system_errors
│   ├── system_backups
│   ├── system_health
│   ├── telemetry_events
│   ├── activity_log
│   ├── activity_logs
│   ├── action_logs
│   ├── audit_logs
│   ├── security_events
│   ├── security_logs
│   ├── security_risk
│   ├── security_command_center
│   ├── page_visibility
│   ├── feature_flags
│   ├── cron_jobs
│   ├── scheduled_announcements
│   ├── admin_queue
│   ├── admin_week
│   ├── admin_powers
│   ├── admin_dashboard_metrics
│   ├── admin_finance
│   ├── admin_economy
│   ├── admin_hr
│   ├── admin_meetings
│   ├── admin_verification
│   ├── admin_applications
│   ├── admin_reports
│   ├── admin_support_tickets
│   ├── admin_manual_orders
│   ├── admin_coin_purchases
│   ├── admin_payout_batches
│   ├── admin_referral_bonuses
│   ├── admin_store_pricing
│   ├── admin_page_visibility
│   ├── admin_test_diagnostics
│   ├── admin_reset_maintenance
│   ├── admin_launch_trial
│   ├── admin_night_watch
│   ├── admin_stream_monitor
│   ├── admin_chat_moderation
│   ├── admin_announcements
│   ├── admin_send_notifications
│   ├── admin_export_data
│   ├── admin_user_search
│   ├── admin_reports_queue
│   ├── admin_voting
│   ├── admin_payment_logs
│   ├── admin_buckets
│   ├── admin_grant_coins
│   ├── admin_create_schedule
│   ├── admin_officer_shifts
│   ├── admin_control_panel
│   ├── admin_system_config
│   ├── admin_system_backup
│   ├── admin_system_health
│   ├── admin_system_cache
│   ├── admin_load_lab
│   ├── admin_advertisements
│   ├── admin_zip_governance
│   ├── admin_seller_management
│   ├── admin_court_dockets
│   ├── admin_seasonal_goals
│   ├── admin_friday_battles
│   ├── admin_crown_redemptions
│   ├── admin_troll_family
│   ├── admin_empire_applications
│   ├── admin_troll_town_deeds
│   ├── admin_executive_secretaries
│   ├── admin_executive_intake
│   ├── admin_executive_reports
│   ├── admin_officer_management
│   ├── admin_role_management
│   ├── admin_media_library
│   ├── admin_user_forms
│   ├── admin_calls
│   ├── admin_customer_service
│   ├── admin_trollmers_tournament
│   ├── admin_jail_management
│   ├── admin_appeals
│   ├── admin_hr
│   ├── admin_shareathon
│   ├── support_tickets
│   ├── team_meeting_room
│   │   ├── team_meeting_members
│   │   └── team_meeting_messages
│   ├── bug_alerts
│   ├── bug_reports
│   ├── bug_center
│   ├── mobile_error_logs
│   └── ticker
│
└── 👻 GHOST MODE & SPECIAL
    ├── ghost_mode
    ├── ghost_missions
    ├── ghost_inactivity
    ├── shadow_ban
    ├── ai_action_logs
    ├── ai_tasks
    └── ai_detect_ghost_inactivity
```

---

## 📊 ENTITY RELATIONSHIP SUMMARY

| Entity Group | Table Count | Primary Key | Foreign Key Target |
|---|---|---|---|
| User & Auth | 30 | `user_profiles.id` | - |
| Economy | 40 | `user_profiles.id` | `user_profiles` |
| Payouts | 15 | `user_profiles.id` | `user_profiles` |
| Streaming | 60 | `streams.id` | `user_profiles` |
| Battles | 25 | `troll_battles.id` | `user_profiles` |
| Family | 20 | `troll_families.id` | `user_profiles` |
| Government | 25 | `user_profiles.id` | `user_profiles` |
| Court | 25 | `court_cases.id` | `user_profiles` |
| Officer | 20 | `user_profiles.id` | `user_profiles` |
| Messaging | 15 | `conversations.id` | `user_profiles` |
| Marketplace | 25 | `marketplace_items.id` | `user_profiles` |
| Vehicles | 25 | `vehicles_catalog.id` | `user_profiles` |
| Real Estate | 20 | `houses_catalog.id` | `user_profiles` |
| Auctions | 15 | `auction_shows.id` | `user_profiles` |
| Academy | 15 | `academy_courses.id` | `user_profiles` |
| Agency | 10 | `agencies.id` | `user_profiles` |
| Church | 8 | `church.id` | `user_profiles` |
| TCNN | 8 | `tcnn_articles.id` | `user_profiles` |
| Podcast | 8 | `podcasts.id` | `user_profiles` |
| Notifications | 5 | `user_profiles.id` | `user_profiles` |
| Social | 20 | `user_profiles.id` | `user_profiles` |
| Advertising | 8 | `advertisements.id` | `user_profiles` |
| Organizations | 5 | `organizations.id` | `user_profiles` |
| Contracts | 4 | `contracts.id` | `user_profiles` |
| Events | 6 | `global_events.id` | `user_profiles` |
| Media | 5 | `troll_station.id` | `user_profiles` |
| Admin | 30 | `user_profiles.id` | `user_profiles` |
| Ghost/AI | 6 | `user_profiles.id` | `user_profiles` |

---

## 🔗 KEY RELATIONSHIPS (Cross-System)

```
user_profiles ←→ troll_families (via troll_family_members)
user_profiles ←→ agencies (via agency_members)
user_profiles ←→ organizations (via organization_members)
user_profiles ←→ academy_courses (via academy_enrollments)
user_profiles ←→ church (via church_members)
user_profiles ←→ tcnn (via tcnn_roles)
user_profiles ←→ teams (via team_meeting_members)

streams ←→ troll_battles (battle integration)
streams ←→ auction_shows (auction streaming)
streams ←→ church_live (church streaming)
streams ←→ tcnn_streams (news streaming)
streams ←→ government_streams (government streaming)

court_cases ←→ jail (sentences)
court_cases ←→ punishments (fines)
court_cases ←→ appeals (appeals)

troll_families ←→ family_wars (wars between families)
troll_families ←→ family_leagues (competitive leagues)

vehicles_catalog ←→ user_vehicles (ownership)
vehicles_catalog ←→ dealership_inventory (for sale)
houses_catalog ←→ user_houses (ownership)
houses_catalog ←→ rental_market (for rent)

marketplace_items ←→ marketplace_orders (purchases)
shop_items ←→ shop_transactions (sales)
store_items ←→ stores (store inventory)

academy_courses ←→ academy_assignments (coursework)
academy_courses ←→ academy_quizzes (assessments)
academy_courses ←→ academy_certificates (completion)
```

---

*This map represents the complete database schema as of 2026-06-13.*

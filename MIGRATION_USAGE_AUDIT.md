# Database Object Usage Classification

> Generated: 2026-05-31. Cross-references frontend code, edge functions, API routes, and known migrations.
>
> Classification:
> - **ACTIVE_DIRECT_USE**: Directly called by frontend/store/hook/component
> - **ACTIVE_INDIRECT_USE**: Used by triggers, RLS, FK, cron, RPC chains, realtime, or storage policies
> - **POSSIBLY_UNUSED**: No frontend, edge function, trigger, RLS, FK, cron, or realtime reference found
> - **DANGEROUS_TO_REMOVE**: Security/financial/auth/RLS/role/wallet/payout/jail/court/moderation/stream/gift/ledger
> - **UNKNOWN_NEEDS_MANUAL_REVIEW**: Could not prove use or non-use

---

## CLASSIFIED TABLES

### ACTIVE_DIRECT_USE (Confirmed Frontend + Edge Function Usage)

| Table | Type | Classification | Evidence | Risk |
|-------|------|----------------|----------|------|
| `user_profiles` | table | ACTIVE_DIRECT_USE | 80+ frontend files, 80+ edge functions | DANGEROUS_TO_REMOVE |
| `streams` | table | ACTIVE_DIRECT_USE | Frontend (Broadcast, View, Explore, Admin), edge functions | DANGEROUS_TO_REMOVE |
| `user_follows` | table | ACTIVE_DIRECT_USE | Frontend hooks and components | SAFE |
| `notifications` | table | ACTIVE_DIRECT_USE | Frontend (TCPS, Jail, Admin), edge functions | DANGEROUS_TO_REMOVE |
| `conversations` | table | ACTIVE_DIRECT_USE | TCPS, Inmates | SAFE |
| `conversation_members` | table | ACTIVE_DIRECT_USE | TCPS | SAFE |
| `conversation_messages` | table | ACTIVE_DIRECT_USE | TCPS | SAFE |
| `officer_chat_messages` | table | ACTIVE_DIRECT_USE | lib/supabase.ts, TCPS | SAFE |
| `user_stats` | table | ACTIVE_DIRECT_USE | Profile, XP Store, League | SAFE |
| `user_perks` | table | ACTIVE_DIRECT_USE | Profile | SAFE |
| `user_entrance_effects` | table | ACTIVE_DIRECT_USE | Profile | SAFE |
| `user_insurances` | table | ACTIVE_DIRECT_USE | Profile | SAFE |
| `user_inventory` | table | ACTIVE_DIRECT_USE | Profile, Admin | SAFE |
| `user_blocks` | table | ACTIVE_DIRECT_USE | Profile | SAFE |
| `user_credit` | table | ACTIVE_DIRECT_USE | Broadcast UserActionModal | DANGEROUS_TO_REMOVE |
| `user_licenses` | table | ACTIVE_DIRECT_USE | Neighborhood, Map | SAFE |
| `user_mutes` | table | ACTIVE_DIRECT_USE | Government | DANGEROUS_TO_REMOVE |
| `user_jails` | table | ACTIVE_DIRECT_USE | Government | DANGEROUS_TO_REMOVE |
| `user_bans` | table | ACTIVE_DIRECT_USE | Government | DANGEROUS_TO_REMOVE |
| `user_reputation` | table | ACTIVE_DIRECT_USE | Government hooks | SAFE |
| `user_presence` | table | ACTIVE_DIRECT_USE | RTC Monitor | SAFE |
| `user_presence_routes` | table | ACTIVE_DIRECT_USE | CS, Presence | SAFE |
| `coin_transactions` | table | ACTIVE_DIRECT_USE | Profile, Admin, edge functions | DANGEROUS_TO_REMOVE |
| `payout_requests` | table | ACTIVE_DIRECT_USE | Admin, Cashout, edge functions | DANGEROUS_TO_REMOVE |
| `driver_tests` | table | ACTIVE_DIRECT_USE | CS, Vehicle hooks | SAFE |
| `purchasable_items` | table | ACTIVE_DIRECT_USE | Gift Tray, Admin, edge functions | DANGEROUS_TO_REMOVE |
| `marketplace_items` | table | ACTIVE_DIRECT_USE | Profile, Marketplace, Admin | SAFE |
| `marketplace_purchases` | table | ACTIVE_DIRECT_USE | Seller, Auction | DANGEROUS_TO_REMOVE |
| `Mai Troll_shops` | table | ACTIVE_DIRECT_USE | Marketplace, Sell | SAFE |
| `shop_items` | table | ACTIVE_DIRECT_USE | Marketplace, Sell | SAFE |
| `shop_transactions` | table | ACTIVE_DIRECT_USE | Sell | DANGEROUS_TO_REMOVE |
| `business_profiles` | table | ACTIVE_DIRECT_USE | Marketplace, Sell | SAFE |
| `vehicle_listings` | table | ACTIVE_DIRECT_USE | Profile, Marketplace, Sell | SAFE |
| `service_listings` | table | ACTIVE_DIRECT_USE | Marketplace | SAFE |
| `vehicle_loans` | table | ACTIVE_DIRECT_USE | Vehicle system | DANGEROUS_TO_REMOVE |
| `houses` | table | ACTIVE_DIRECT_USE | Map, Onboarding, UnderConstruction | SAFE |
| `neighborhoods` | table | ACTIVE_DIRECT_USE | Map, Onboarding | SAFE |
| `neighborhood_members` | table | ACTIVE_DIRECT_USE | Neighborhood | SAFE |
| `neighborhood_invites` | table | ACTIVE_DIRECT_USE | Neighborhood | SAFE |
| `house_raids` | table | ACTIVE_DIRECT_USE | Neighborhood hooks | SAFE |
| `homeowners_insurances` | table | ACTIVE_DIRECT_USE | Neighborhood | SAFE |
| `properties` | table | ACTIVE_DIRECT_USE | Profile, Landlord | SAFE |
| `troll_wall_posts` | table | ACTIVE_DIRECT_USE | TrollWall, edge functions | SAFE |
| `troll_wall_likes` | table | ACTIVE_DIRECT_USE | TrollWall | SAFE |
| `jail` | table | ACTIVE_DIRECT_USE | Jail, Broadcast, Gov | DANGEROUS_TO_REMOVE |
| `jail_notifications` | table | ACTIVE_DIRECT_USE | Newest migration | SAFE |
| `troll_families` | table | ACTIVE_DIRECT_USE | Family pages | SAFE |
| `family_members` | table | ACTIVE_DIRECT_USE | Family pages | SAFE |
| `troll_family_members` | table | ACTIVE_DIRECT_USE | Sidebar, Family | SAFE |
| `auction_shows` | table | ACTIVE_DIRECT_USE | Auction pages | SAFE |
| `auction_lots` | table | ACTIVE_DIRECT_USE | Auction pages | SAFE |
| `auction_bids` | table | ACTIVE_DIRECT_USE | Auctions | DANGEROUS_TO_REMOVE |
| `auction_wins` | table | ACTIVE_DIRECT_USE | Auctions | DANGEROUS_TO_REMOVE |
| `auctioneer_profiles` | table | ACTIVE_DIRECT_USE | Auction pages | SAFE |
| `auction_presence` | table | ACTIVE_DIRECT_USE | Live auction | SAFE |
| `auction_reports` | table | ACTIVE_DIRECT_USE | Auction reports | SAFE |
| `auctioneer_applications` | table | ACTIVE_DIRECT_USE | Admin | SAFE |
| `church_prayers` | table | ACTIVE_DIRECT_USE | Prayer Feed | SAFE |
| `church_prayer_likes` | table | ACTIVE_DIRECT_USE | Prayer Feed | SAFE |
| `church_prayer_replies` | table | ACTIVE_DIRECT_USE | Prayer Feed | SAFE |
| `church_sermon_notes` | table | ACTIVE_DIRECT_USE | Pastor | SAFE |
| `church_live_sessions` | table | ACTIVE_DIRECT_USE | Church | SAFE |
| `admin_broadcasts` | table | ACTIVE_DIRECT_USE | Announcements, Pastor | SAFE |
| `government_laws` | table | ACTIVE_DIRECT_USE | Government | SAFE |
| `law_votes` | table | ACTIVE_DIRECT_USE | Government | SAFE |
| `bribe_logs` | table | ACTIVE_DIRECT_USE | Government | DANGEROUS_TO_REMOVE |
| `protests` | table | ACTIVE_DIRECT_USE | Government | SAFE |
| `protest_participants` | table | ACTIVE_DIRECT_USE | Government | SAFE |
| `government_history` | table | ACTIVE_DIRECT_USE | Government | SAFE |
| `emergency_powers_log` | table | ACTIVE_DIRECT_USE | Government | DANGEROUS_TO_REMOVE |
| `president_elections` | table | ACTIVE_DIRECT_USE | President | SAFE |
| `audit_logs` | table | ACTIVE_DIRECT_USE | Security, Admin | DANGEROUS_TO_REMOVE |
| `security_events` | table | ACTIVE_DIRECT_USE | Security | DANGEROUS_TO_REMOVE |
| `security_user_risk_scores` | table | ACTIVE_DIRECT_USE | Security | DANGEROUS_TO_REMOVE |
| `security_incident_reports` | table | ACTIVE_DIRECT_USE | Security | DANGEROUS_TO_REMOVE |
| `support_tickets` | table | ACTIVE_DIRECT_USE | Admin | SAFE |
| `app_bug_reports` | table | ACTIVE_DIRECT_USE | CS | SAFE |
| `customer_service_audit_logs` | table | ACTIVE_DIRECT_USE | CS | SAFE |
| `admin_password_resets` | table | ACTIVE_DIRECT_USE | CS | DANGEROUS_TO_REMOVE |
| `system_alerts` | table | ACTIVE_DIRECT_USE | Admin | DANGEROUS_TO_REMOVE |
| `system_errors` | table | ACTIVE_DIRECT_USE | lib/supabase.ts | SAFE |
| `paypal_transactions` | table | ACTIVE_DIRECT_USE | Admin, edge functions | DANGEROUS_TO_REMOVE |
| `battles` | table | ACTIVE_DIRECT_USE | BattleView, edge functions | SAFE |
| `battle_participants` | table | ACTIVE_DIRECT_USE | BattleView | SAFE |
| `stream_moderators` | table | ACTIVE_DIRECT_USE | Broadcast, Viewer | SAFE |
| `stream_messages` | table | ACTIVE_DIRECT_USE | Broadcast chat | SAFE |
| `stream_gifts` | table | ACTIVE_DIRECT_USE | Broadcast, edge functions | DANGEROUS_TO_REMOVE |
| `stream_mutes` | table | ACTIVE_DIRECT_USE | Broadcast | SAFE |
| `stream_settings` | table | ACTIVE_DIRECT_USE | Chat | SAFE |
| `stream_missions` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_goals` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_polls` | table | ACTIVE_DIRECT_USE | Broadcast | SAFE |
| `poll_votes` | table | ACTIVE_DIRECT_USE | Broadcast | SAFE |
| `stream_milestones` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_energy_meter` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_energy_meters` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_fan_tiers` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_awards` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `gift_items` | table | ACTIVE_DIRECT_USE | Broadcast, Viewer | SAFE |
| `gift_transactions` | table | ACTIVE_DIRECT_USE | Top Broadcasters | DANGEROUS_TO_REMOVE |
| `gift_ledger` | table | ACTIVE_DIRECT_USE | Broadcast | DANGEROUS_TO_REMOVE |
| `rtc_sessions` | table | ACTIVE_DIRECT_USE | Broadcast, TCNN | SAFE |
| `global_events` | table | ACTIVE_DIRECT_USE | Broadcast Setup | SAFE |
| `pod_rooms` | table | ACTIVE_DIRECT_USE | Explore, Home | SAFE |
| `active_sessions` | table | ACTIVE_DIRECT_USE | Auth store | DANGEROUS_TO_REMOVE |
| `organizations` | table | ACTIVE_DIRECT_USE | Profile, Org | SAFE |
| `organization_members` | table | ACTIVE_DIRECT_USE | Org hooks | SAFE |
| `organization_admins` | table | ACTIVE_DIRECT_USE | Profile, Sidebar | SAFE |
| `officer_members` | table | ACTIVE_DIRECT_USE | Sidebar | SAFE |
| `user_subscriptions` | table | ACTIVE_DIRECT_USE | Subscription store | DANGEROUS_TO_REMOVE |
| `subscription_tiers` | table | ACTIVE_DIRECT_USE | Subscription store | SAFE |
| `web_push_subscriptions` | table | ACTIVE_DIRECT_USE | PWA context | SAFE |
| `app_settings` | table | ACTIVE_DIRECT_USE | AppSettings store | DANGEROUS_TO_REMOVE |
| `user_vehicles` | table | ACTIVE_DIRECT_USE | Profile, Secretary | SAFE |
| `vehicles` (catalog) | table | ACTIVE_DIRECT_USE | CarDealership | SAFE |
| `call_rooms` | table | ACTIVE_DIRECT_USE | TCPS | SAFE |
| `call_minutes` | table | ACTIVE_DIRECT_USE | Profile, TCPS | DANGEROUS_TO_REMOVE |
| `stream_viewers` | table | ACTIVE_DIRECT_USE | Broadcast | SAFE |
| `stream_participants` | table | ACTIVE_DIRECT_USE | TCNN, Broadcast | SAFE |
| `outbound_clicks` | table | ACTIVE_DIRECT_USE | RTC Admin | SAFE |
| `stream_analytics_daily` | table | ACTIVE_DIRECT_USE | RTC Admin | SAFE |
| `moderation_reports` | table | ACTIVE_DIRECT_USE | Broadcast | SAFE |
| `v_dealership_catalog` | table | ACTIVE_DIRECT_USE | KT Auto Admin | SAFE |
| `troll_posts` | table | ACTIVE_DIRECT_USE | Profile (count) | SAFE |
| `moderation_actions` | table | ACTIVE_DIRECT_USE | Moderation hooks | DANGEROUS_TO_REMOVE |
| `moderation_reports_view` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `user_reports` | table | ACTIVE_DIRECT_USE | Admin, CEO, Noah | SAFE |
| `officer_work_sessions` | table | ACTIVE_DIRECT_USE | edge functions, Admin | DANGEROUS_TO_REMOVE |
| `officer_live_assignments` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `officer_assignments` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `officer_training_sessions` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `training_scenarios` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `officer_mission_logs` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `officer_vote_cycles` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `officer_votes` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `vote_events` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `shadow_bans` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `moderation_events` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `observer_ratings` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `live_sessions` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `wallet_transactions` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `mai_classes` | table | ACTIVE_DIRECT_USE | MaiClass page, API routes | SAFE |
| `mai_class_enrollments` | table | ACTIVE_DIRECT_USE | MaiClass, API | SAFE |
| `mai_stage_slots` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `mai_queue` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `mai_show_sessions` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `mai_performance_timer` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `mai_talent_votes` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `troll_battles` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `troll_battle_gifts` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `battle_history` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `battle_rewards` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `troll_events` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `troll_event_claims` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `games` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `game_players` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `game_votes` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `manual_coin_orders` | table | ACTIVE_DIRECT_USE | Admin, edge functions | DANGEROUS_TO_REMOVE |
| `coin_packages` | table | ACTIVE_DIRECT_USE | CoinStore, edge functions | DANGEROUS_TO_REMOVE |
| `coin_ledger` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `earnings_payouts` | table | ACTIVE_DIRECT_USE | Admin, edge functions | DANGEROUS_TO_REMOVE |
| `payout_batches` | table | ACTIVE_DIRECT_USE | Admin, edge functions | DANGEROUS_TO_REMOVE |
| `user_payment_methods` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `stripe_customers` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `coin_orders` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `purchase_ledger` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `credit_events` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `credit_scores` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `credit_reports` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `loans` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `loan_payments` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `small_installment_purchases` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `stream_audio_monitoring` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `audio_queue` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `offline_notifications` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `push_notification_logs` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `stocks` | table | ACTIVE_DIRECT_USE | edge functions, StockMarket | SAFE |
| `stock_price_history` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `user_portfolio` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `stock_transactions` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `stock_leaderboards` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `stock_market_settings` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `abuse_reports` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `verification_requests` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `court_ai_feedback` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `connected_social_accounts` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `social_publish_queue` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `social_publish_logs` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `source_content_refs` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `ad_generation_jobs` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `ad_assets` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `ad_videos` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `guest_tracking` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `guest_stream_sessions` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `referrals` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `referral_monthly_bonus` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `admin_pool` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `wallets` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `account_deletion_reasons` | table | ACTIVE_DIRECT_USE | edge function delete-account | SAFE |
| `friend_requests` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `stream_reports` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `stream_seats` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `stream_likes` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `stream_chat` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `admin_notifications` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `admin_audit_logs` | table | ACTIVE_DIRECT_USE | edge functions | DANGEROUS_TO_REMOVE |
| `operator_timesheets` -> `officer_timesheets` | table | ACTIVE_DIRECT_USE | edge functions | SAFE |
| `officer_warrants` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `officer_time_off_requests` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `applications` | table | ACTIVE_DIRECT_USE | Frontend + edge functions | SAFE |
| `attorney_applications` | table | ACTIVE_DIRECT_USE | Admin apps | SAFE |
| `prosecutor_applications` | table | ACTIVE_DIRECT_USE | Admin apps | SAFE |
| `job_applications` | table | ACTIVE_DIRECT_USE | Application page | SAFE |
| `interview_sessions` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `executive_intake` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `attorney_cases` | table | ACTIVE_DIRECT_USE | Jail page | SAFE |
| `home_feature_cycles` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `user_badges` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `agreement_stats` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `bank_audit_log` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `scheduled_announcements` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `punishment_fines` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `sav_promotions` | table | ACTIVE_DIRECT_USE | edge function | DANGEROUS_TO_REMOVE |
| `admin_flags` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `user_agreements` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `order_shipments` | table | ACTIVE_DIRECT_USE | API route | SAFE |
| `tracking_events` | table | ACTIVE_DIRECT_USE | API route | SAFE |
| `telemetry_events` | table | ACTIVE_DIRECT_USE | API route, Express | SAFE |
| `platform_fees` | table | ACTIVE_DIRECT_USE | API route | DANGEROUS_TO_REMOVE |
| `tromail_calendar_events` | table | ACTIVE_DIRECT_USE | Newest migrations | SAFE |
| `tromail_calendar_event_recipients` | table | ACTIVE_DIRECT_USE | Newest migrations | SAFE |
| `agency_applications` | table | ACTIVE_DIRECT_USE | Newest migration | SAFE |
| `agency_members` | table | ACTIVE_DIRECT_USE | Newest migration | SAFE |
| `agency_billing_events` | table | ACTIVE_DIRECT_USE | Newest migration | DANGEROUS_TO_REMOVE |
| `agency_enforcement_actions` | table | ACTIVE_DIRECT_USE | Newest migration | SAFE |
| `agency_activity_logs` | table | ACTIVE_DIRECT_USE | Newest migration | SAFE |
| `agency_platform_settings` | table | ACTIVE_DIRECT_USE | Newest migration | SAFE |
| `deeds` | table | ACTIVE_DIRECT_USE | Secretary | SAFE |
| `property_upgrades` | table | ACTIVE_DIRECT_USE | Secretary | SAFE |
| `fan_memories` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `fan_contracts` | table | ACTIVE_DIRECT_USE | Live features | SAFE |
| `stream_stage_passes` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `broadcast_active_effects` | table | ACTIVE_DIRECT_USE | BroadcastPage | SAFE |
| `broadcast_ability_logs` | table | ACTIVE_DIRECT_USE | BroadcastPage | SAFE |
| `broadcast_troll_usages` | table | ACTIVE_DIRECT_USE | BroadcastPage | SAFE |
| `broadcast_rankings` | table | ACTIVE_DIRECT_USE | Home streams | SAFE |
| `broadcast_league_stats` | table | ACTIVE_DIRECT_USE | City status | SAFE |
| `troll_church_daily_words` | table | ACTIVE_DIRECT_USE | DailyChurchNotification | SAFE |
| `broadcast_seats` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `broadcast_seat_bans` | table | ACTIVE_DIRECT_USE | edge function | SAFE |
| `zips_governance` | table | ACTIVE_DIRECT_USE | ZipGovernance page | SAFE |
| `subjects` | table | ACTIVE_DIRECT_USE | (referenced in migrations) | UNKNOWN |

### ACTIVE_INDIRECT_USE (Triggers, RLS, FK Dependencies)

| Table | Type | Classification | Evidence | Risk |
|-------|------|----------------|----------|------|
| `signup_queue` | table | ACTIVE_INDIRECT_USE | Signup flow in Auth.tsx; referenced in handle_new_user_troll_coins trigger | SAFE |
| `troll_role` types | enum | ACTIVE_INDIRECT_USE | Used in RLS policies and role checks throughout | DANGEROUS_TO_REMOVE |
| `coin_transaction_types` | enum/table | ACTIVE_INDIRECT_USE | Referenced by edge functions and triggers | DANGEROUS_TO_REMOVE |

### KNOWN REMOVED TABLES (from prior cleanup)

| Table | Classification | Evidence |
|-------|----------------|----------|
| `visitor_stats` | REMOVED | DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md |
| `troll_events` | REMOVED | DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md |
| `user_health_records` | REMOVED | DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md |
| `staff_profiles` | REMOVED | DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md |
| `troll_dna_profiles` | REMOVED | DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md |
| `profiles` (redundant) | REMOVED | DATABASE_CLEANUP_COMPREHENSIVE_REPORT.md |

---

## DATABASE OBJECTS SUMMARY

| Classification | Estimated Count |
|----------------|----------------|
| ACTIVE_DIRECT_USE | ~200+ tables |
| ACTIVE_INDIRECT_USE | ~10 tables |
| KNOWN REMOVED | 6 tables |
| POSSIBLY_UNUSED | See below |

---

## TABLES THAT APPEAR IN MIGRATIONS BUT HAVE NO CODE REFERENCE

These tables exist in migration files but were NOT found referenced in frontend code (src/), edge functions (supabase/functions/), API routes (api/), or backend routes (server/). This means they were created historically but may not be actively used by application code.

**MANUAL REVIEW REQUIRED** for each:
- Check if referenced by triggers, RLS policies, or FK relationships
- Check if referenced by future migrations (post-2026)
- Check if referenced by external integrations (Mux, LiveKit, PayPal, Square, Stripe webhooks)

| Table | Likely Still Used? | Notes |
|-------|--------------------|-------|
| `asset_auctions` | UNKNOWN | From DATABASE_CLEANUP_ANALYSIS "remove" list — but may depend on FK chains |
| `court_sessions` | LIKELY | Referenced as SQL in edge functions (`startCourtSession`, `endCourt_session`) |
| `court_summons` | LIKELY | Referenced in realtime channels |
| `court_dockets` | LIKELY | Referenced in ModActionsPopup and Admin |
| `court_cases` | LIKELY | Referenced in TrollCourt page, ModActionsPopup |
| `troll_court_sessions` | LIKELY | Referenced in TrollCourtSession page |
| `troll_court_participants` | LIKELY | Referenced in TrollCourtSession page |
| `troll_court_summons` | LIKELY | Referenced in TrollCourtSession page |
| `user_driver_licenses` | POSSIBLY_UNUSED | May have been merged into `user_licenses` |
| `car_insurances` | POSSIBLY_UNUSED | May have been merged into `homeowners_insurances` |
| `broadcast_restrictions` | LIKELY | Referenced in ModActionsPopup |
| `installment_milestone_events` | LIKELY | Referenced by edge function |
| `property_usage` | LIKELY | Referenced by edge function |
| `broadcast_seats` | LIKELY | Referenced by edge function |
| `broadcast_seat_bans` | LIKELY | Referenced by edge function |

---

## SQL CLEANUP RECOMMENDATIONS ONLY (NOT EXECUTED)

These are suggestions for the user to review. Do NOT execute without manual verification.

```sql
-- POSSIBLY SAFE TO DROP (after manual verification that no triggers/FKs exist):

-- If user_driver_licenses is truly superseded by user_licenses:
-- DROP TABLE IF EXISTS user_driver_licenses CASCADE;

-- If car_insurances is truly superseded by homeowners_insurances:
-- DROP TABLE IF EXISTS car_insurances CASCADE;

-- Only if confirmed no FK constraints, triggers, or policies reference them:
-- DROP TABLE IF EXISTS asset_auctions CASCADE;

-- INDEX CLEANUP: Check for duplicate or unused indexes
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
-- ORDER BY tablename, indexname;

-- FUNCTION CLEANUP: Functions with 0 calls in pg_stat_user_functions
-- SELECT schemaname, funcname, calls
-- FROM pg_stat_user_functions
-- WHERE calls = 0;
```

**CRITICAL RULE**: Do NOT drop any table that:
1. Has foreign keys pointing to it
2. Is referenced by RLS policies using USING/WITH CHECK clauses
3. Is used by triggers (even if trigger is on another table)
4. Contains financial, ledger, or audit data
5. Is part of the auth flow (user_profiles, active_sessions, etc.)

# Final Audit Summary

> Generated: 2026-05-31. Complete Mai Troll app usage audit.
> All findings based on static code analysis + migration review. No destructive operations performed.

---

## 1. SAFE-TO-KEEP DATABASE OBJECTS

These tables/features are directly used by the frontend and should NOT be removed:

### Core Infrastructure (~30 tables)

| Category | Tables |
|----------|--------|
| Users/Auth | `user_profiles`, `active_sessions`, `app_settings` |
| Streams | `streams`, `stream_moderators`, `stream_messages`, `stream_gifts`, `stream_mutes`, `stream_settings`, `stream_missions`, `stream_goals`, `stream_polls`, `stream_milestones`, `stream_energy_meter`, `stream_fan_tiers`, `stream_awards` |
| Messaging | `notifications`, `conversations`, `conversation_members`, `conversation_messages`, `officer_chat_messages` |
| Social | `user_follows`, `user_blocks`, `user_relationships`, `user_subscriptions` |
| Content | `troll_wall_posts`, `troll_wall_likes`, `troll_posts`, `pod_rooms`, `podcast_rtc_logs` |
| Finance (Active) | `coin_transactions`, `payout_requests`, `gift_transactions`, `user_credit` |
| Presence | `user_presence`, `user_presence_routes` |

### Feature Tables (~40 tables)

| Category | Tables |
|----------|--------|
| Marketplace | `marketplace_items`, `marketplace_purchases`, `shop_items`, `Mai Troll_shops`, `vehicle_listings`, `service_listings`, `business_profiles` |
| Auctions | `auction_shows`, `auction_lots`, `auction_bids`, `auction_wins`, `auctioneer_profiles`, `auction_presence` |
| Neighborhood | `neighborhoods`, `neighborhood_members`, `houses`, `house_raids`, `homeowners_insurances`, `user_licenses`, `vehicles`, `vehicle_loans` |
| Government | `government_laws`, `law_votes`, `bribe_logs`, `protests`, `protest_participants`, `government_history`, `president_elections`, `emergency_powers_log` |
| Church | `church_prayers`, `church_prayer_likes`, `church_prayer_replies`, `church_sermon_notes`, `church_live_sessions`, `admin_broadcasts` |
| Family | `troll_families`, `family_members`, `troll_family_members` |
| Games | `battles`, `battle_participants`, `games`, `game_players`, `game_votes` |
| Mai Talent | `mai_classes`, `mai_class_enrollments`, `mai_stage_slots`, `mai_queue`, `mai_show_sessions` |
| Security | `audit_logs`, `security_events`, `security_user_risk_scores`, `security_incident_reports`, `moderation_reports`, `user_reports` |

---

## 2. DANGEROUS OBJECTS THAT MUST NOT BE REMOVED

These handle financial, security, authentication, or moderation functions. Removal requires extensive manual review:

| Object | Reason |
|--------|--------|
| `user_profiles` | Core user table; everything depends on it |
| `coin_transactions` | Financial ledger; irreplaceable transaction history |
| `payout_requests` | Active payout state; data loss = financial liability |
| `gift_ledger` / `gift_transactions` | Financial transaction records |
| `stream_gifts` | Gift spending records |
| `coin_ledger` | Coin tracking |
| `earnings_payouts` | Payout history |
| `paypal_transactions` | Payment processor records |
| `loans` / `loan_payments` | Credit system |
| `credit_events` / `credit_scores` / `credit_reports` | Credit tracking |
| `jail` | Active moderation state |
| `court_dockets` / `court_cases` | Legal record |
| `bribe_logs` | Government system (even if game mechanic, still financial) |
| `transactions` | Generic financial records |
| `user_payment_methods` | Payment method storage (PCI-sensitive) |
| `stripe_customers` | Payment processor records |
| `active_sessions` | Auth session management |
| `app_settings` | System configuration |
| All RLS policies | Security boundary |
| All triggers | Data integrity |
| `admin_pool` | Treasury reserves |
| `wallets` | Wallet balances |
| `referral_monthly_bonus` | Referral payment tracking |
| `manual_coin_orders` | Pending coin order state |
| `purchase_ledger` | Purchase history |
| `coin_packages` | Product catalog |
| `stock_transactions` | Stock trading records |
| `abuse_reports` | Moderation queue |
| `user_bans` / `user_jails` / `user_mutes` / `user_blocks` | Active restriction state |
| `admin_password_resets` | Auth security |
| `system_alerts` | Active alert state |
| `admin_audit_logs` | Audit trail |
| `shadow_bans` | Moderation state |
| `payout_batches` | Active payout processing |
| `agency_billing_events` | Agency payment tracking |

---

## 3. POSSIBLY UNUSED OBJECTS NEEDING MANUAL REVIEW

These have no direct code reference found but may be used by triggers, FK chains, or future features:

| Table | Last Known Use | Suggested Action |
|-------|---------------|-----------------|
| `user_driver_licenses` | Possibly merged into `user_licenses` | Verify no FK dependencies, then drop if redundant |
| `car_insurances` | Possibly merged into `homeowners_insurances` | Verify no FK dependencies, then drop if redundant |
| `asset_auctions` | In cleanup analysis "remove" list | Check for any FK chains; if none, drop |
| `broadcast_restrictions` | ModActionsPopup reference | KEEP until confirmed unused |
| `installment_milestone_events` | Edge function reference | KEEP if credit system active |
| `property_usage` | Edge function reference | KEEP |
| `politician` tables (any) | No code reference found | Verify in actual DB; may be migration-only |
| `troller_level` columns | Cleaned from user_profiles | Verify all columns removed |
| `empire_role` / `empire_partner` | Cleaned from user_profiles | Verify all columns removed |

---

## 4. FRONTEND BUTTONS REPORT

| Metric | Count |
|--------|-------|
| Total unique button/action patterns | ~160 |
| READ_ONLY | ~25 |
| SAFE_WRITE_DEV_ONLY | ~45 |
| MONEY_RISK | ~25 |
| MODERATION_RISK | ~25 |
| DELETE_RISK | ~8 |
| ADMIN_RISK | ~35 |
| AUTH_RISK | ~8 |
| BROADCAST_RISK | ~6 |

### Buttons NOT Tested Because They Are Risky

| Button | Reason Not Tested | Required Action Type |
|--------|-------------------|---------------------|
| Pay Bail (Jail) | MONEY_RISK | Deducts real coins from user |
| Submit Cashout | MONEY_RISK | Creates payout request |
| Process Payout Batch | MONEY_RISK | Sends real money via PayPal |
| PayPal Buy Coins | MONEY_RISK | Real money transaction |
| Square Card Charge | MONEY_RISK | Real money transaction |
| Approve Treasury Run | MONEY_RISK | Transfers real money |
| Grant Coins (Admin) | MONEY_RISK | Adds coins to any user |
| Ban User | MODERATION_RISK | Account restriction |
| Arrest User | MODERATION_RISK | Creates jail record |
| Kick from Stream | MODERATION_RISK | Removes user from stream |
| Permanently Delete Account | DELETE_RISK | Irreversible data loss |
| Repossess Property | DELETE_RISK | Irreversible property transfer |
| Hard Delete Court Case | DELETE_RISK | Irreversible legal record removal |
| Reset App | ADMIN_RISK | Clears all user data / streams |
| Assign Role | ADMIN_RISK | Changes user permissions |
| Toggle Lockdown | BROADCAST_RISK | Disables all broadcasting |
| Force Password Reset | AUTH_RISK | Changes user credentials |
| Shadow Ban | MODERATION_RISK | Hidden restriction |

---

## 5. MOST USED DATABASE OBJECTS

### Top 10 Most Referenced Tables (by code files)

| Rank | Table | Frontend Files | Edge Functions | Total References |
|------|-------|---------------|----------------|-----------------|
| 1 | `user_profiles` | 80+ | 80+ | 160+ |
| 2 | `streams` | 20+ | 15+ | 35+ |
| 3 | `notifications` | 10+ | 10+ | 20+ |
| 4 | `coin_transactions` | 5+ | 8+ | 13+ |
| 5 | `payout_requests` | 8+ | 5+ | 13+ |
| 6 | `conversations` | 5+ | 3+ | 8+ |
| 7 | `user_follows` | 5+ | 3+ | 8+ |
| 8 | `battles` | 3+ | 5+ | 8+ |
| 9 | `auction_lots` | 8+ | 0+ | 8+ |
| 10 | `jail` | 7+ | 2+ | 9+ |

### Top 5 Most Used RPCs

| Rank | RPC | Files |
|------|-----|-------|
| 1 | `send_gift_in_stream` | useGiftSystem, BroadcastGrid, edge functions |
| 2 | `ban_user` / `ban_user_from_stream` | ModActions, RTCAdmin, UserActionModal |
| 3 | `join_seat_atomic` / `leave_seat_atomic` | useStreamSeats, BroadcastPage, ViewerPage |
| 4 | `mute_user` | ModActions, RTCAdmin, edge functions |
| 5 | `troll_bank_credit_coins` | Treasury, Admin, edge functions |

---

## 6. REALTIME CHANNELS ACTUALLY USED

| Category | Active Channels | Tables Subscribed |
|----------|----------------|-------------------|
| Stream/Broadcast | 8 | streams, stream_messages, stream_gifts, stream_participants, battles |
| Chat/Messaging | 6 | conversation_messages, officer_chat_messages |
| Games | 7 | (broadcast events on game channels) |
| Admin | 10 | user_profiles, streams, coin_transactions, applications, payout_runs, payout_requests |
| Government | 4 | government_laws, law_votes, protests, government_history |
| Church | 1 | church_prayers |
| Neighborhood | 1 | houses |
| System/Global | 10 | bug_alerts, app_settings, global_events, gift-events, compliance |
| Auctions | 1 | auction_presence |
| TCNN | 4 | (broadcast events) |

**Total**: ~80 channel registrations across the app, ~69 unique `postgres_changes` subscriptions.

---

## 7. BIGGEST FRONTEND PERFORMANCE PROBLEMS

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | EconomyDashboard scans entire `coin_transactions` table client-side | CRITICAL | OOM/browsetimeout at scale |
| 2 | 5 admin sources independently fetch economy_summary | HIGH | 5x redundant table scans |
| 3 | AdminDashboard 30-second triple-table scan (6000 rows) | HIGH | Client-side merge of 3 large tables |
| 4 | Profile.tsx 9 parallel SELECTs + N+1 follow-ups | MEDIUM | 11+ queries per profile view |
| 5 | 6+ realtime channels per battle participant | HIGH | 60+ connections for 10 players |
| 6 | 4 separate channels per broadcast stream | MEDIUM | Should be 1 multiplexed |
| 7 | Admin dashboard full spinner on every navigation | MEDIUM | Jarring UX (no stale-while-revalidate) |
| 8 | Suspense fallback is null (blank screen) | MEDIXM | No loading feedback |

---

## 8. SQL CLEANUP RECOMMENDATIONS (SUGGESTIONS ONLY — NOT EXECUTED)

These are ordered from safest to most risky:

### Tier 1: Safe If Verified (No FK Dependencies)

```sql
-- Verify no FK dependencies first:
-- SELECT * FROM information_schema.referential_constraints WHERE unique_constraint_table_name = 'user_driver_licenses';
-- If clean:
-- DROP TABLE IF EXISTS user_driver_licenses CASCADE;
-- DROP TABLE IF EXISTS car_insurances CASCADE;
-- DROP TABLE IF EXISTS asset_auctions CASCADE;
```

### Tier 2: Requires Trigger/Policy Check

```sql
-- Check if any triggers reference these tables:
-- SELECT * FROM information_schema.triggers WHERE event_object_table IN ('user_driver_licenses', 'car_insurances');
-- Check if any RLS policies reference these:
-- SELECT * FROM pg_policies WHERE qual LIKE '%user_driver_licenses%' OR with_check LIKE '%user_driver_licenses%';
```

### Tier 3: Column Cleanup (Already Partially Done)

```sql
-- From prior cleanup: confirmed removed columns in user_profiles:
-- troll_coins (exists), multiplier columns, payout columns, empire columns, address columns
-- IF the following still exist AND are unreferenced, they can be dropped:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name IN (
--   'no_kick_until', 'no_ban_until', 'live_restricted_until', 'is_employee', 'employee_role',
--   'hire_date', 'account_deleted_at', 'account_deletion_cooldown_until', 'account_reset_after_ban',
--   'account_state', 'ip_address_history'
-- );
```

### Tier 4: Index/Function Cleanup

```sql
-- Find unused indexes (requires pg_stat_user_indexes to have been populated):
-- SELECT schemaname, tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE idx_scan = 0 AND schemaname = 'public';

-- Find functions with 0 calls:
-- SELECT schemaname, funcname, calls FROM pg_stat_user_functions WHERE calls = 0;
```

---

## 9. NEXT SAFEST CLEANUP STEPS

1. **Run the read-only SQL from Part 5** against the actual database to get current schema state:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
   SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace ORDER BY proname;
   SELECT trigger_name, event_object_table FROM information_schema.triggers WHERE trigger_schema = 'public';
   SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename;
   SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
   SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
   ```

2. **Compare the actual DB output** against the ~200 tables identified in `MIGRATION_OBJECTS_REPORT.md` to find truly orphaned tables.

3. **Check FK dependencies** before dropping anything:
   ```sql
   SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, tc.constraint_name
   FROM information_schema.table_constraints AS tc
   JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
   JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
   WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public';
   ```

4. **DROPPING ORDER** (if confirmed unused): leaf tables first (no FKs pointing to them), then work inward toward `user_profiles`/`streams`.

5. **NEVER drop**: Any table with financial data, RLS policies, triggers, or FK relationships to active tables.

6. **Backup first**: `pg_dump` the entire database before any drops.

---

## 10. AUDIT FILES GENERATED

| File | Contents |
|------|----------|
| `AUDIT_BUTTON_USAGE.md` | ~160 button/action patterns with risk classification |
| `AUDIT_ROUTE_SMOKE_TEST.md` | ~298 routes with expected behavior and known issues |
| `AUDIT_FRONTEND_DB_USAGE.md` | All `.from()`, `.rpc()`, `functions.invoke()` from src/ |
| `AUDIT_EDGE_FUNCTION_USAGE.md` | All 114 edge functions with table/RPC/storage usage |
| `AUDIT_REALTIME_USAGE.md` | ~80 realtime channels, presence API, broadcast sends |
| `AUDIT_STORAGE_USAGE.md` | 15+ storage buckets with operations and access patterns |
| `AUDIT_PERFORMANCE_FINDINGS.md` | 27 performance issues ranked by severity |
| `MIGRATION_USAGE_AUDIT.md` | All database objects classified as active/indirect/unused/dangerous |
| `AUDIT_NEWEST_OBJECTS_AND_FEATURES.md` | Newest migrations, files, edge functions by timestamp |
| `AUDIT_FINAL_SUMMARY.md` | This file — consolidated findings and recommendations |

---

## KEY STATISTICS

| Metric | Value |
|--------|-------|
| Total routes | ~298 |
| Page component files | ~230 |
| Hooks | ~141 |
| Zustand stores | ~20 |
| Edge functions | 114 (42 called from frontend) |
| API routes (Vercel + Express) | 27 |
| Supabase tables (estimated from migrations) | ~380 |
| Active tables (with code reference) | ~200+ |
| Known removed tables | 6 |
| Possibly unused tables | ~3-5 (needs DB verification) |
| RPC functions | ~714 calls across codebase |
| Realtime channel registrations | ~80 |
| Storage buckets | 15+ |
| Migration files | 403 primary + 100+ backup + others |
| Frontend button/action patterns | ~160 |
| Performance issues found | 27 (3 critical, 9 high, 11 medium, 4 low) |

---

## CRITICAL WARNINGS

1. Do NOT run `supabase db push` — migration files go up to 2029 and may contain untested schema changes.
2. Do NOT drop tables based solely on this audit — verify with actual DB queries from Part 5 first.
3. Do NOT click MONEY_RISK or MODERATION_RISK buttons in dev without confirming staging database.
4. All admin edge functions use `SUPABASE_SERVICE_ROLE_KEY` — never expose in frontend logs.
5. The existing `DATABASE_CLEANUP_ANALYSIS.md` contains SQL that has ALREADY been partially applied. Re-running it could fail or cause issues.

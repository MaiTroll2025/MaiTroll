# Mai Troll Database Cleanup Plan

**Generated:** 2026-06-10  
**Based on:** `_orphan_analysis_v2.json` (559 tables scored across 11,654 SQL files)

---

## Executive Summary

| Tier | Count | Action |
|------|-------|--------|
| **CRITICAL** | 264 | Keep — heavy internal usage (functions, views, triggers, RLS) |
| **ACTIVE** | 229 | Keep — moderate internal usage |
| **REVIEW** | 15 | Manual review needed — light usage |
| **SAFE_TO_DROP** | 51 | No internal references found — likely dead |

**Key finding:** The original audit's "559 orphan tables" were NOT actually orphans. Only **51 tables (9%)** are truly unreferenced. The other **508 tables (91%)** are used internally by functions, views, triggers, RLS policies, or migrations.

---

## 1. SAFE_TO_DROP TABLES (51 tables)

These tables have **zero** references in any SQL file — no functions, views, triggers, FK targets, RLS policies, or migration references. They are the strongest candidates for removal.

### 1.1 Feature-Complete / Never Fully Implemented

These tables appear to be from features that were partially implemented but never completed:

| Table | Likely Feature | Notes |
|-------|---------------|-------|
| `badge_tier_progress` | Badge tier system | Created but never populated |
| `badge_showcase` | Badge showcase | Created but never used |
| `broadcast_consumables` | Broadcast consumables | No references |
| `broadcast_overrides` | Broadcast override system | No references |
| `church_passages` | Church scripture passages | No references |
| `correctional_facilities` | Jail expansion | No references |
| `court_ai_rate_limits` | Court AI rate limiting | No references |
| `credit_reports` | Credit report system | No references |
| `credit_score_system` | Credit score system | No references |
| `election_results` | Election results | No references |
| `global_ticker` | Global ticker | No references |
| `guest_presence_logs` | Guest presence logging | No references |
| `house_participants` | House participants | No references |
| `ktauto_inventory` | KT Auto inventory | No references |
| `mai_talent_queue` | MAI talent queue | No references |
| `mai_talent_shows` | MAI talent shows | No references |
| `marketplace_seller_tiers` | Marketplace seller tiers | No references |
| `neighbor_events` | Neighbor events | No references |
| `notary_documents` | Notary document system | No references |
| `org_students` | Organization students | No references |
| `paid_chat_access` | Paid chat access | No references |
| `paid_chat_payments` | Paid chat payments | No references |
| `prayer_requests` | Prayer requests | No references |
| `president_mansion_theme` | President mansion theme | No references |
| `repossessions` | Repossession system | No references |
| `rtmp_credentials` | RTMP credentials | No references |
| `sav_promotions` | SAV promotions | No references |
| `seller_tiers` | Seller tiers | No references |
| `sign_lease_applications` | Lease applications | No references |
| `small_installment_purchases` | Installment purchases | No references |
| `staff_meeting_minutes` | Staff meeting minutes | No references |
| `starter_vehicles` | Starter vehicles | No references |
| `stream_battles` | Stream battles | No references |
| `telemetry_events` | Telemetry events | No references |
| `tmv_actions` | TMV actions | No references |
| `troll_games` | Troll games | No references |
| `troll_wars_ai_battle_logs` | Troll wars AI logs | No references |
| `trollmin_config` | Trollmin config | No references |
| `troll_station` | Troll station | No references |
| `troll_station_chat` | Troll station chat | No references |
| `troll_station_cohosts` | Troll station cohosts | No references |
| `troll_station_hosts` | Troll station hosts | No references |
| `troll_station_invitations` | Troll station invitations | No references |
| `troll_station_queue` | Troll station queue | No references |
| `troll_station_sessions` | Troll station sessions | No references |
| `troll_station_songs` | Troll station songs | No references |
| `tromail_contract_templates` | Tromail contract templates | No references |
| `tromail_contracts` | Tromail contracts | No references |
| `vehicle_asset_system_triggers` | Vehicle asset triggers | No references |
| `vehicle_participants` | Vehicle participants | No references |
| `weekly_role_perk_system` | Weekly role perk system | No references |

### 1.2 Recommended Action

For each table:
1. Verify no data exists: `SELECT COUNT(*) FROM table_name;`
2. If empty, drop: `DROP TABLE IF EXISTS table_name CASCADE;`
3. If data exists, archive before dropping

---

## 2. REVIEW TABLES (15 tables)

These tables have light internal usage and should be reviewed manually before deciding:

| Table | Score | Usage | Recommendation |
|-------|-------|-------|----------------|
| `ad_videos` | 4 | FK target + RLS | **Keep** — referenced by `ad_analytics` |
| `ad_analytics` | 2 | RLS only | **Review** — may be unused |
| `extension_status` | 3 | View only | **Keep** — used by `public.extension_status` view |
| `gift_votes` | 2 | RLS only | **Keep** — has RLS policies |
| `house_raid_logs` | 2 | RLS only | **Keep** — has RLS policies |
| `house_repair_logs` | 2 | RLS only | **Keep** — has RLS policies |
| `mai_performance_timer` | 2 | RLS only | **Keep** — has RLS policies |
| `podcast_rtc_logs` | 2 | RLS only | **Keep** — has RLS policies |
| `role_earning_rules` | 3 | View only | **Keep** — used by `user_earning_summary` view |
| `rtc_sessions` | 2 | RLS only | **Keep** — has RLS policies |
| `social_publish_logs` | 2 | RLS only | **Keep** — has RLS policies |
| `troll_mart_clothing` | 4 | FK target + RLS | **Keep** — referenced by `user_troll_mart_purchases` |
| `user_avatar_customization` | 2 | RLS only | **Keep** — has RLS policies |
| `user_earning_events` | 3 | View only | **Keep** — used by `user_earning_summary` view |
| `user_troll_mart_purchases` | 2 | RLS only | **Keep** — has RLS policies |

**Recommendation:** Keep all 15. They're all either FK targets or have RLS policies, meaning they're part of the security model.

---

## 3. NAMING CONSISTENCY ISSUES

### 3.1 Duplicate Table Pairs

These pairs represent the same concept with inconsistent naming:

| Old Name | New Name | Recommendation |
|----------|----------|----------------|
| `troll_families` | `families` | Migrate data to `families`, drop `troll_families` |
| `troll_family_members` | `family_members` | Migrate data to `family_members`, drop `troll_family_members` |
| `troll_family_memberships` | `family_members` | Consolidate into `family_members` |
| `troll_posts` | `posts` | Migrate data to `posts`, drop `troll_posts` |
| `troll_post_comments` | `post_comments` | Migrate data to `post_comments`, drop `troll_post_comments` |
| `troll_post_reactions` | `post_reactions` | Migrate data to `post_reactions`, drop `troll_post_reactions` |
| `troll_post_gifts` | `post_gifts` | Migrate data to `post_gifts`, drop `troll_post_gifts` |
| `troll_post_views` | `post_views` | Migrate data to `post_views`, drop `troll_post_views` |
| `troll_wall_posts` | `wall_posts` | Migrate data to `wall_posts`, drop `troll_wall_posts` |
| `troll_wall_gifts` | `wall_gifts` | Migrate data to `wall_gifts`, drop `troll_wall_gifts` |
| `troll_wall_likes` | `wall_likes` | Migrate data to `wall_likes`, drop `troll_wall_likes` |
| `troll_wall_reactions` | `wall_reactions` | Migrate data to `wall_reactions`, drop `troll_wall_reactions` |
| `troll_stream_messages` | `stream_messages` | Migrate data to `stream_messages`, drop `troll_stream_messages` |
| `troll_streams` | `streams` | Migrate data to `streams`, drop `troll_streams` |
| `troll_battles` | `battles` | Migrate data to `battles`, drop `troll_battles` |
| `troll_battle_gifts` | `battle_gifts` | Migrate data to `battle_gifts`, drop `troll_battle_gifts` |
| `troll_battle_participants` | `battle_participants` | Migrate data to `battle_participants`, drop `troll_battle_participants` |
| `troll_court_cases` | `court_cases` | Migrate data to `court_cases`, drop `troll_court_cases` |
| `troll_court_evidence` | `court_evidence` | Migrate data to `court_evidence`, drop `troll_court_evidence` |
| `troll_dna_events` | `dna_events` | Migrate data to `dna_events`, drop `troll_dna_events` |
| `troll_dna_profiles` | `dna_profiles` | Migrate data to `dna_profiles`, drop `troll_dna_profiles` |
| `troll_dna_traits` | `dna_traits` | Migrate data to `dna_traits`, drop `troll_dna_traits` |
| `troll_drops` | `drops` | Migrate data to `drops`, drop `troll_drops` |
| `troll_drops_log` | `drops_log` | Migrate data to `drops_log`, drop `troll_drops_log` |
| `troll_event_claims` | `event_claims` | Migrate data to `event_claims`, drop `troll_event_claims` |
| `troll_events` | `events` | Migrate data to `events`, drop `troll_events` |
| `troll_family_activity_events` | `family_activity_events` | Migrate data to `family_activity_events`, drop `troll_family_activity_events` |
| `troll_family_messages` | `family_messages` | Migrate data to `family_messages`, drop `troll_family_messages` |
| `troll_family_wars` | `family_wars` | Migrate data to `family_wars`, drop `troll_family_wars` |
| `troll_gift_items` | `gift_items` | Migrate data to `gift_items`, drop `troll_gift_items` |
| `troll_officer_applications` | `officer_applications` | Migrate data to `officer_applications`, drop `troll_officer_applications` |
| `troll_officers` | `officers` | Migrate data to `officers`, drop `troll_officers` |
| `troll_wheel_wins` | `wheel_wins` | Migrate data to `wheel_wins`, drop `troll_wheel_wins` |
| `Mai Troll_orders` | `shop_orders` | Migrate data to `shop_orders`, drop `Mai Troll_orders` |
| `Mai Troll_products` | `shop_items` | Migrate data to `shop_items`, drop `Mai Troll_products` |
| `Mai Troll_shops` | `shops` | Migrate data to `shops`, drop `Mai Troll_shops` |
| `trollg_applications` | `trollg_applications` | Keep — unique feature |
| `trollmond_gifts` | `trollmond_gifts` | Keep — unique feature |
| `trollmond_ledger` | `trollmond_ledger` | Keep — unique feature |
| `trollmond_store_items` | `trollmond_store_items` | Keep — unique feature |
| `trollmond_transactions` | `trollmond_transactions` | Keep — unique feature |
| `trollmonds_pools` | `trollmonds_pools` | Keep — unique feature |
| `trolls_night_applications` | `trolls_night_applications` | Keep — unique feature |
| `trolls_night_guest_agreements` | `trolls_night_guest_agreements` | Keep — unique feature |
| `trollstown_properties` | `trollstown_properties` | Keep — unique feature |
| `trollstown_property_upgrades` | `trollstown_property_upgrades` | Keep — unique feature |
| `trollstown_upgrade_config` | `trollstown_upgrade_config` | Keep — unique feature |
| `trolltract_contracts` | `trolltract_contracts` | Keep — unique feature |
| `trolltract_weekly_rewards` | `trolltract_weekly_rewards` | Keep — unique feature |
| `tromody_battles` | `tromody_battles` | Keep — unique feature |
| `tromody_gifts` | `tromody_gifts` | Keep — unique feature |
| `tromody_matches` | `tromody_matches` | Keep — unique feature |
| `tromody_queue` | `tromody_queue` | Keep — unique feature |
| `tromody_sessions` | `tromody_sessions` | Keep — unique feature |
| `troll_ai_avatars` | `troll_ai_avatars` | Keep — unique feature |

### 3.2 Naming Convention Rules

1. **Drop `troll_` prefix** for generic concepts (posts, families, battles, etc.)
2. **Keep `troll_` prefix** for unique game features (trollmonds, trolls_night, trollstown, etc.)
3. **Use singular form** for table names (not `families` but `family`)
4. **Use consistent suffixes:** `_logs`, `_history`, `_settings`, `_config`

---

## 4. RLS POLICY FIXES

### 4.1 Unsafe Policies (70+ found)

The following patterns are considered unsafe:

#### Pattern 1: `Anyone can read` on sensitive tables

```sql
-- UNSAFE:
CREATE POLICY "Anyone can read gifts" ON gifts FOR SELECT USING (true);

-- SAFE:
CREATE POLICY "Authenticated users can read gifts" ON gifts FOR SELECT USING (auth.role() = 'authenticated');
```

**Tables affected:** `gifts`, `shop_items`, `insurance_options`, `vehicles_catalog`, `purchasable_items`, `broadcast_themes`, `entrance_effects`, `call_sound_catalog`, `perks`, `houses_catalog`, `insurance_plans`

#### Pattern 2: `Allow all inserts` without authentication

```sql
-- UNSAFE:
CREATE POLICY "Allow all inserts" ON global_events FOR INSERT WITH CHECK (true);

-- SAFE:
CREATE POLICY "Service role can insert global_events" ON global_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

**Tables affected:** `global_events`, `system_errors`

#### Pattern 3: `Service role full access` bypass

```sql
-- UNSAFE:
CREATE POLICY "Service role full access" ON family_war_scores FOR ALL USING (auth.role() = 'service_role');

-- SAFE: Keep but add additional checks
CREATE POLICY "Service role can manage family_war_scores" ON family_war_scores FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
```

**Tables affected:** `family_war_scores`, `apns_tokens`, `fcm_tokens`, `onesignal_tokens`, `gift_transactions`

### 4.2 Duplicate Policies (40+ found)

**Example:** `Admins can view all action logs` appears twice on `action_logs`.

**Fix:** Drop the duplicate:
```sql
DROP POLICY IF EXISTS "Admins can view all action logs" ON action_logs;
-- Keep only one copy
```

### 4.3 Missing RLS (tables without policies)

Tables that should have RLS but don't:
- `admin_actions_log`
- `admin_audit_logs`
- `admin_pool`
- `admin_pool_ledger`
- `admin_pool_transactions`
- `admin_reports`
- `agency_admin_reports`

**Fix:** Add RLS policies:
```sql
ALTER TABLE admin_actions_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view admin_actions_log" ON admin_actions_log FOR SELECT USING (is_admin());
CREATE POLICY "Service role can insert admin_actions_log" ON admin_actions_log FOR INSERT WITH CHECK (auth.role() = 'service_role');
```

---

## 5. MIGRATION CONFLICTS (80+ found)

### 5.1 Duplicate Timestamps

Multiple migrations share the same timestamp, causing unpredictable ordering:

**Example:**
- `20260225000008_add_show_id_to_votes.sql`
- `20260225000008_create_fill_stage_slot_function.sql`

**Fix:** Rename with sequential suffixes:
```sql
-- Before:
20260225000008_add_show_id_to_votes.sql
20260225000008_create_fill_stage_slot_function.sql

-- After:
20260225000008_add_show_id_to_votes.sql
20260225000009_create_fill_stage_slot_function.sql
```

### 5.2 Duplicate Content Across Years

Some migrations in 2027-2029 are exact duplicates of 2026 migrations:

| 2026 Original | 2027-2029 Duplicate | Action |
|---------------|---------------------|--------|
| `20260427000000_universe_mode_troll_battle.sql` | `20270427000000_universe_mode_troll_battle.sql` | Drop duplicate |
| `20260501000002_troll_games_system.sql` | `20270501000002_troll_games_system.sql` | Drop duplicate |
| `20260521000000_small_installment_purchases.sql` | `20270521000000_small_installment_purchases.sql` | Drop duplicate |
| `20260524000001_update_stream_seats_and_create_audience_presence.sql` | `20270524000001_update_stream_seats_and_create_audience_presence.sql` | Drop duplicate |
| `20260526000000_add_agency_enforcement_system.sql` | `20270526000000_add_agency_enforcement_system.sql` | Drop duplicate |
| `20260611000000_create_shareathon_system.sql` | `20290611000000_create_shareathon_system.sql` | Drop duplicate |
| `20260611000000_utromail_tromail_system.sql` | `20290611000000_utromail_tromail_system.sql` | Drop duplicate |
| `20260617000000_vehicle_asset_system.sql` | `20290617000000_vehicle_asset_system.sql` | Drop duplicate |

### 5.3 Recommended Migration Strategy

1. **Consolidate all migrations** into a single `baseline_v2.sql` that represents the current state
2. **Delete all old migrations** after verifying the baseline is complete
3. **Use a single migration folder** with sequential numbering going forward

---

## 6. DEPRECATED FUNCTIONS (120+ found)

### 6.1 Safe to Drop

These functions are superseded by newer versions:

| Old Function | New Function | Action |
|--------------|--------------|--------|
| `add_coins` | `troll_bank_credit_coins` | Drop after migrating callers |
| `deduct_coins` | `troll_bank_spend_coins_secure` | Drop after migrating callers |
| `troll_bank_spend_coins` | `troll_bank_spend_coins_secure` | Drop after migrating callers |
| `try_pay_coins` | `try_pay_coins_secure` | Drop after migrating callers |
| `send_gift_v2` | `send_gift` | Drop after migrating callers |
| `purchase_car` | `purchase_car_v2` | Drop after migrating callers |
| `end_battle` | `end_battle_guarded` | Drop after migrating callers |
| `find_opponent` | `find_random_battle_match` | Drop after migrating callers |
| `admin_grant_coins` | `troll_bank_credit_coins` | Drop after migrating callers |
| `add_free_coins` | `credit_free_coins` | Drop after migrating callers |
| `convert_trollz_to_coins` | (no replacement) | Drop if no callers |
| `reset_troll_coins` | (no replacement) | Drop if no callers |
| `reset_app_for_launch` | (no replacement) | Drop if no callers |
| `start_launch_trial` | (no replacement) | Drop if no callers |
| `disable_payout_window` | (no replacement) | Drop if no callers |
| `enable_payout_window` | (no replacement) | Drop if no callers |
| `forward_payout_to_admin` | (no replacement) | Drop if no callers |
| `assistant_forward_payout_batch` | (no replacement) | Drop if no callers |
| `assistant_review_user_coins` | (no replacement) | Drop if no callers |
| `admin_open_cashout_request` | (no replacement) | Drop if no callers |
| `admin_process_cashout_request` | (no replacement) | Drop if no callers |
| `request_friday_cashout` | (no replacement) | Drop if no callers |
| `payout_trollmers_weekly` | (no replacement) | Drop if no callers |
| `distribute_weekly_earnings` | (no replacement) | Drop if no callers |
| `distribute_prize` | (no replacement) | Drop if no callers |
| `earn_coins` | (no replacement) | Drop if no callers |

### 6.2 Functions to Keep (Despite Being Old)

These functions are still actively used:

| Function | Reason to Keep |
|----------|----------------|
| `crypt_password` | Used by auth triggers |
| `current_user_id` | Used by RLS policies |
| `has_role` | Used by RLS policies |
| `has_role_fast` | Used by RLS policies |
| `is_admin` | Used by RLS policies |
| `is_authenticated` | Used by RLS policies |
| `is_moderator` | Used by RLS policies |
| `is_not_banned` | Used by RLS policies |
| `is_not_suspended` | Used by RLS policies |
| `is_staff` | Used by RLS policies |
| `is_staff_on_duty` | Used by RLS policies |
| `is_user_jailed` | Used by RLS policies |
| `is_admin_user` | Used by RLS policies |
| `protect_profile_fields` | Used by triggers |
| `protect_owner_admin_changes` | Used by triggers |
| `global_write_check` | Used by RLS policies |
| `can_write` | Used by RLS policies |
| `calculate_level` | Used by level system |
| `calculate_level_from_xp` | Used by level system |
| `get_xp_for_level` | Used by level system |
| `xp_min_for_level` | Used by level system |
| `has_min_level` | Used by RLS policies |
| `get_user_asset_flags` | Used by asset system |
| `refresh_my_daily_stats` | Used by daily stats |
| `refresh_user_auth_cache` | Used by auth cache |
| `trigger_refresh_user_auth_cache` | Used by triggers |
| `mark_onboarding_complete` | Used by onboarding |
| `set_password_reset_pin` | Used by password reset |
| `fn_touch_updated_at` | Used by triggers |
| `generate_plate_number` | Used by vehicle system |
| `update_academy_updated_at` | Used by academy triggers |

---

## 7. IMPLEMENTATION ORDER

### Phase 1: Safe Wins (No Risk)
1. Drop 51 SAFE_TO_DROP tables (after verifying they're empty)
2. Fix duplicate RLS policies (drop duplicates)
3. Fix migration timestamps (rename duplicates)

### Phase 2: Naming Consolidation (Low Risk)
1. Create migration to merge `troll_*` tables into their clean-named equivalents
2. Update all function references to use new table names
3. Drop old tables

### Phase 3: Function Cleanup (Medium Risk)
1. Identify callers of deprecated functions
2. Migrate callers to new functions
3. Drop deprecated functions

### Phase 4: RLS Hardening (Medium Risk)
1. Replace `Anyone can read` policies with authenticated-only
2. Replace `Allow all inserts` with service-role-only
3. Add missing RLS policies on admin tables

### Phase 5: Migration Consolidation (High Risk)
1. Create comprehensive baseline migration
2. Test baseline on staging environment
3. Replace old migrations with baseline

---

## 8. ESTIMATED IMPACT

| Metric | Before | After | Reduction |
|--------|--------|-------|-----------|
| Total Tables | ~560 | ~509 | ~9% |
| SQL Functions | ~320 | ~200 | ~38% |
| RLS Policies | ~300 | ~260 | ~13% |
| Migrations | ~500 | ~420 | ~16% |
| Naming Inconsistencies | ~50 pairs | 0 | 100% |

---

*Generated by OWL Cleanup Planner — 2026-06-10*

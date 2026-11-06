# MaiTroll — Role & Security Summary

Scope: `D:\MAiCORP\New folder\MaiTroll-1` — entire codebase (SQL migrations, SQL files at repo root, Edge functions in `supabase/functions/`).

This document summarizes every staff/broadcaster/broadofficer/admin role, what tables each role can and cannot touch, which functions can be called bypassing RLS/authorization, and all identified security risks.

---

## 1. How Roles Work in This Codebase

There are **no `CREATE ROLE` statements** anywhere. Roles are implemented entirely as application-level data on `user_profiles`, enforced through RLS policies and SECURITY DEFINER helper functions.

### Role storage

| Mechanism | File | Line(s) | Notes |
|-----------|------|---------|-------|
| `user_profiles.role` (TEXT) | `secure_db_access.sql` | 154 | Default forced to `'user'` on signup |
| `user_profiles.is_admin` (BOOLEAN) | `supabase/sql/admin_setup.sql` | 6 | Admin flag |
| `user_profiles.is_lead_officer` (BOOLEAN) | `UNIVERSAL_RLS_SYSTEM.sql` | 176 | Staff flag |
| `user_profiles.is_troll_officer` (BOOLEAN) | Various | — | Staff flag |
| `user_profiles.is_secretary` (BOOLEAN) | `UNIVERSAL_RLS_SYSTEM.sql` | 251 | Staff flag |
| `user_profiles.is_broadcaster` (BOOLEAN) | `supabase/functions/moderation-actions/index.ts` | 397 | Broadcaster flag |
| `user_profiles.is_broadofficer` (BOOLEAN) | `supabase/functions/moderation-actions/index.ts` | 400 | Broadcaster officer flag |
| `user_profiles.is_officer` (BOOLEAN) | `20260629000002_staff_audit_system.sql` | 581 | Officer flag |
| `user_profiles.is_ceo` (BOOLEAN) | `UNIVERSAL_RLS_SYSTEM.sql` | 251 | CEO flag |
| `user_profiles.troll_role` (TEXT) | `UNIVERSAL_RLS_SYSTEM.sql` | 186 | Secondary role text |
| `public.system_roles` table | `UNIVERSAL_RLS_SYSTEM.sql` | 18-27 | Canonical roles table |
| `public.user_role_grants` table | `UNIVERSAL_RLS_SYSTEM.sql` | 30-42 | Junction table with expiration |
| `public.user_roles` table | `supabase/sql/admin_setup.sql` | 9-15 | Simple user_roles table |
| `public.role_permission_matrix` table | `20260629000002_staff_audit_system.sql` | 96-105 | Page/action permission matrix |

### Canonical seeded roles (`UNIVERSAL_RLS_SYSTEM.sql:50-58`)

| Role | Level | Staff? | Admin? | Description |
|------|-------|--------|--------|-------------|
| user | 0 | no | no | Regular authenticated user |
| officer | 50 | yes | no | Staff officer |
| lead_officer | 100 | yes | yes | Lead officer |
| secretary | 150 | yes | yes | Secretary |
| pastor | 80 | yes | no | Pastor |
| admin | 200 | yes | yes | System administrator |
| founder | 255 | yes | yes | Platform founder |

### Role names referenced across the codebase

`admin`, `superadmin`, `ceo`, `owner`, `president`, `vice_president`, `secretary`, `executive_secretary`, `troll_city_secretary`, `moderator`, `troll_officer`, `lead_troll_officer`, `officer`, `staff`, `broadcaster`, `broadofficer`, `prosecutor`, `attorney`, `judge`, `auctioneer`, `pastor`, `journalist`, `ceo_assistant`, `noah_assistant`, `hr_admin`, `hr_manager`, `agency_hr`, `agency_hr_manager`, `agency_leader`, `marketing_readonly`, `empire_partner`, `notary`, `tcnn_news_caster`, `tcnn_chief_news_caster`, `academy_teacher`, `academy_director`, `admissions_officer`, `temp_city_admin`, `temp_admin`.

### Key role-check functions (SECURITY DEFINER)

| Function | File | Line | search_path | Granted to |
|----------|------|------|-------------|------------|
| `is_admin(p_user_id UUID)` | `20290905000001_fix_role_management_trigger.sql` | 18 | default | — |
| `is_admin(UUID)` | `UNIVERSAL_RLS_SYSTEM.sql` | 200 | default | — |
| `is_staff(p_user_id UUID)` | `secure_roles_and_permissions.sql` | 12 | `public` | — |
| `is_staff_consolidated(UUID)` | `20260629000002_staff_audit_system.sql` | 563 | default | — |
| `is_modo_role(uuid)` | `20260809000001_moderation_actions_backend.sql` | 20 | `public` | `authenticated, service_role` |
| `is_broadcast_owner(uuid, uuid)` | `secure_roles_and_permissions.sql` | 30 | `public` | — |
| `is_active_broadofficer(uuid, uuid)` | `secure_roles_and_permissions.sql` | 52 | `public` | — |
| `is_admin_user(uuid)` | `supabase/sql/admin_setup.sql` | 33 | `public` | — |
| `is_user_jailed(uuid)` | `20260810000011_maitroll_moderation_rpc.sql` | 57 | `public` | `service_role` |
| `is_broadofficer(uuid, uuid)` | `broadofficers_setup.sql` | 30 | default | — |

---

## 2. Per-Role Table Access Matrix

### anon (public / anonymous)

`secure_db_access.sql:5-8` **REVOKES ALL** from `anon` on all tables, sequences, functions, and schema USAGE — a zero-trust baseline. However, many individual migrations subsequently `GRANT` permissions back to `anon`, so effective access depends on migration order.

**Can SELECT (public read):**

| Table | File | Line | Condition |
|-------|------|------|-----------|
| `streams` | `add_featured_broadcasts.sql` | 11-12 | `USING (true)` — featured streams |
| `streams` | `20260804193604_streams_public_view_rls.sql` | 56 | `USING (true)` — anyone can view |
| `stream_messages` | `20260804193604_streams_public_view_rls.sql` | 70 | `stream_messages_select_all` |
| `user_profiles` | `add_trollmonds_column.sql` | 16 | `GRANT ALL ... TO anon` (overrides REVOKE depending on order) |
| `user_profiles` | `add_wheel_troll_locked_column.sql` | 16 | `GRANT ALL ... TO anon` |
| `profile_views`, `tm_messages`, `family_invites` | `add_troll_match_system.sql` | 273-275 | `GRANT SELECT ... TO anon, authenticated` |
| `league_events`, `league_leaderboard_snapshots`, `league_points`, `league_event_templates`, `mission_templates` | `apply_league_system.sql` | 172-177 | `GRANT SELECT ... TO authenticated, anon` |
| `gifts_catalog`, `role_bonuses`, `marketplace_purchases` | `add_missing_tables_columns_views.sql` | 202-204 | `USING (true)` |
| `broadcast_rankings`, `creators_over_600`, `ledger_recent`, `trollmers_weekly_leaderboard` | `add_missing_tables_columns_views.sql` | 207-210 | `USING (true)` |
| `supporter_economy_config` | `20260806000001_supporter_economy_system.sql` | 22 | `USING (true)` |
| `weekly_cashback_periods` | same | 92 | `USING (true)` |
| `gifter_stats_daily/weekly`, `gifter_leaderboards` | same | 159-161 | `USING (true)` |
| `broadcaster_wishlists` | same | 228 | `USING (true)` |
| `wishlist_items`, `wishlist_progress` | same | 231-235 | `USING (true)` |
| `fan_crowns` | same | 261 | `USING (true)` |
| `free_subscriptions` | same | 289 | `USING (true)` |
| `epaper_stories` | same | 344 | `status = 'published'` |
| `epaper_story_tips` | same | 357 | `USING (true)` |
| `admin_settings` | `add_broadcast_lockdown_settings.sql` | 39 | `setting_key = 'broadcast_lockdown_enabled'` |
| `support_tickets` | `CREATE_SUPPORT_TICKETS_TABLE.sql` | 87 | `GRANT SELECT ... TO anon` |
| `broadcast_officers` | `broadofficers_setup.sql` | 18-19 | `USING (true)` — everyone can view officers |

**Cannot touch:** `user_profiles` (write), financial tables, moderation tables, audit logs, admin tables, most write paths.

**Functions anon can EXECUTE:** `is_broadcast_locked()`, `get_epaper_stories(...)`, `get_epaper_story(...)`, `calculate_t_league_tier(NUMERIC)`, `get_top_broadcasters_with_featured()`, `join_seat_atomic(...)`, `get_tm_matches()`, `get_viewed_me_users()`, `record_profile_view()`.

---

### authenticated (regular signed-in user)

`secure_db_access.sql:16-35`: `GRANT USAGE ON SCHEMA public TO authenticated`; `GRANT SELECT ON ALL TABLES ... TO authenticated`; RLS enabled on all tables; baseline read-only policy `USING (auth.uid() IS NOT NULL)` on non-sensitive tables.

**Can SELECT:** own profile, public tables, live streams, own streams.

**Can INSERT:** streams (own), messages (own), support_tickets (own), staff_action_audit_log (own — `auth.uid() IS NOT NULL`).

**Can UPDATE:** own profile, own streams, own messages.

**Can DELETE:** generally none (audit log is immutable).

**Cannot touch:** other users' profiles, admin tables, financial tables, moderation tables, other broadcasters' data, `user_role_grants`, `role_permission_matrix` (write).

---

### staff (admin, superadmin, ceo, owner, officer, lead_officer, secretary, pastor, moderator, troll_officer, lead_troll_officer, prosecutor, attorney, judge, auctioneer, journalist, ceo_assistant, noah_assistant, hr_admin, agency_hr, agency_leader, etc.)

Staff status is determined by `is_staff()` / `is_staff_consolidated()` / `is_modo_role()` / role text on `user_profiles`.

**Can SELECT:** all profiles (`is_stauth(auth.uid())`), all streams, all messages, moderation tables (`moderation_actions`, `moderation_reports`, `moderation_notes`, `moderation_logs`, `user_bans`, `shadow_bans`, `ip_bans`, `kick_logs`, `mute_logs` — `is_stauth(auth.uid())`), support tickets, court cases.

**Can INSERT:** `staff_action_audit_log` (own), support_tickets.

**Can UPDATE:** streams (if staff or owner), messages (delete if staff/owner/broadofficer), support tickets.

**Can DELETE:** messages/seats/bans where moderator/broadcaster/broadofficer conditions met.

**Cannot touch:** `user_role_grants` (admin only), `role_permission_matrix` write (admin only), other users' profiles (unless staff policy allows).

---

### broadcaster

**Can SELECT:** own stream, own officers (`broadcast_officers` where `broadcaster_id = auth.uid()`), own earnings (`broadcaster_earnings` where `broadcaster_id = auth.uid()`), public data.

**Can INSERT:** `broadcast_officers` (own), `wishlist_items` (own, `WITH CHECK auth.uid() = broadcaster_id`).

**Can UPDATE:** own stream (`broadcaster_id = auth.uid()`), own `wishlist_items`.

**Can DELETE:** own `broadcast_officers`.

**Cannot touch:** other broadcasters' streams/officers/earnings, admin tables, financial tables, moderation tables.

---

### broadofficer

**Can SELECT:** messages for assigned stream (`is_active_broadofficer(stream_id, auth.uid())`), broadcast seats, seat bans.

**Can INSERT:** none via RLS directly (managed through broadcaster-owned `broadcast_officers`).

**Can UPDATE:** none directly via RLS.

**Can DELETE:** messages where active broadofficer for the stream.

**Cannot touch:** admin tables, other broadcasters' officers, financial tables, profile data.

---

### admin (admin / superadmin / ceo / owner)

Admin access via `is_admin()` / `is_admin_user()` / `is_admin_consolidated()`.

**Can SELECT:** all tables (effectively).

**Can INSERT:** all tables.

**Can UPDATE:** all tables.

**Can DELETE:** all tables except immutable audit logs.

**Cannot touch:** nothing meaningful — effectively superuser within RLS.

---

### service_role

Used by Edge Functions via `SUPABASE_SERVICE_ROLE_KEY`. **Bypasses RLS entirely.**

**Can SELECT/INSERT/UPDATE/DELETE:** all tables — no restrictions.

**Cannot touch:** nothing — full database access.

---

## 3. Functions That Can Be Called Bypassing Anything

### SECURITY DEFINER functions executable by `anon`

These run as the function owner (typically `postgres`) and bypass RLS:

| Function | File | Line | SECURITY DEFINER |
|----------|------|------|------------------|
| `is_broadcast_locked()` | `add_broadcast_lockdown_settings.sql` | 64 | Yes |
| `get_epaper_stories(INTEGER, INTEGER, TEXT)` | `20260806000001_supporter_economy_system.sql` | ~915 | Yes |
| `get_epaper_story(TEXT)` | same | ~965 | Yes |
| `calculate_t_league_tier(NUMERIC)` | `20260813000001_fix_t_league_gift_tracking.sql` | ~30 | Yes |
| `get_top_broadcasters_with_featured()` | `add_stream_notification_feature.sql` | 97 | Yes |
| `join_seat_atomic(...)` | `20260810000009_enforce_stream_seat_limit.sql` | ~1 | Yes |
| `get_tm_matches()` | `add_troll_match_system.sql` | 75 | Yes |
| `get_viewed_me_users()` | same | 153 | Yes |
| `record_profile_view()` | same | 178 | Yes |

### SECURITY DEFINER functions executable by `authenticated` (high-impact)

| Function | File | Line | SECURITY DEFINER | search_path |
|----------|------|------|------------------|-------------|
| `handle_user_signup()` (trigger) | `secure_db_access.sql` | 125 | Yes | `public, extensions` |
| `is_staff(UUID)` | `secure_roles_and_permissions.sql` | 12 | Yes | `public` |
| `is_broadcast_owner(UUID, UUID)` | same | 30 | Yes | `public` |
| `is_active_broadofficer(UUID, UUID)` | same | 52 | Yes | `public` |
| `is_admin_user(UUID)` | `supabase/sql/admin_setup.sql` | 33 | Yes | `public` |
| `is_modo_role(uuid)` | `20260809000001_moderation_actions_backend.sql` | 20 | Yes | `public` |
| `is_stream_owner_or_admin(uuid, uuid)` | same | 104 | Yes | `public` |
| `create_notification(...)` | same | 59 | Yes | `public` |
| `is_user_jailed(uuid)` | `20260810000011_maitroll_moderation_rpc.sql` | 57 | Yes | `public` |
| `is_broadofficer(uuid, uuid)` | `broadofficers_setup.sql` | 30 | Yes | default |
| `assign_broadofficer(uuid, uuid)` | same | 57 | Yes | default |
| `remove_broadofficer(uuid, uuid)` | same | 83 | Yes | default |
| `log_staff_action(...)` | `20260629000002_staff_audit_system.sql` | 370 | Yes | default |
| `is_admin_consolidated()` | same | 508 | Yes | default |
| `start_instant_battle(UUID, VARCHAR)` | `apply_battle_fix.sql` | 140 | Yes | default |
| `create_battle_challenge(...)`, `accept_battle(...)`, `end_battle(...)` | `apply_battle_migrations.sql` | 26, 41, 67 | Yes | default |
| `increment_trollmonds()` | `add_trollmonds_column.sql` | 22 | Yes | default |

**Risk:** Many SECURITY DEFINER functions lack `SET search_path`, making them vulnerable to search_path injection attacks.

### service_role-callable functions (bypass RLS)

All service_role functions in `20260810000008_fix_cashout_coin_tracking.sql`, `20260810000011_maitroll_moderation_rpc.sql`, `20260816000001_secure_moderation_reports_rpc.sql`, `20260816000002_jail_attorney_admin_flows.sql`, `20260815000001_create_celeb_system.sql`, etc. — GRANT EXECUTE to `service_role`.

---

## 4. Edge Functions With No / Weak Authorization

### CRITICAL: No authentication check at all (service role, open to any network caller)

| File | Weakness |
|------|----------|
| `supabase/functions/log-app-bug-report/index.ts` | Calls `log_app_bug_report` RPC with service role. **No auth header check whatsoever.** |
| `supabase/functions/capture-content/index.ts` | Creates storage records/screenshots with service role. **No auth check.** |
| `supabase/functions/stream-stale-cleanup/index.ts` | Service role client, **no auth check** (no-op stub currently). |
| `supabase/functions/broadcast-expiration-cron/index.ts` | Can end any live stream, delete LiveKit rooms, insert logs. Service role, **no auth check.** |
| `supabase/functions/cleanup-notifications/index.ts` | Deletes notifications/jail_notifications older than 7 days. Service role, **no auth check.** |
| `supabase/functions/maipiks-story-cleanup/index.ts` | Purges stories via `maipiks_purge_expired_stories`. Service role, **no auth check.** |
| `supabase/functions/printify-webhook/index.ts` | Updates `mai_merch_orders`. Service role, **no auth check** (relies on Printify signature, not visible). |
| `supabase/functions/publish-social/index.ts` | Publishes to social media, modifies `social_publish_queue`. Service role, **no auth check.** |
| `supabase/functions/sla-monitor/index.ts` | Records SLA metrics, inserts violations, claims compensation via RPCs. Service role, **no auth check.** |
| `supabase/functions/record-replay-view/index.ts` | Calls `record_replay_view` RPC with service role. **No auth header validation.** |

### HIGH: Weak authorization

| File | Weakness |
|------|----------|
| `supabase/functions/delete-account/index.ts` | Uses service role. Only checks JWT is valid (any authenticated user). Then `hardDeleteUser()` deletes from `auth.users`, `user_profiles`, `coin_ledger`, streams, social data, reports, etc. **Any authenticated user can delete their own account with full service-role bypass.** |
| `supabase/functions/mai-voice/index.ts` | `maintenance` action calls `mai_voice_expire_due` / `mai_voice_prune_publishers` via service role. **No auth check for maintenance action.** |
| `supabase/functions/push-notifications/index.ts` | Accepts service role key as bearer token, authorizing push to **any** user IDs. Also accepts JWTs with `role === 'service_role'` claim decoded manually. |
| `supabase/functions/ghost-mode/index.ts` | Checks `isCEO(userId)` where `userId` comes from **request body** (client-supplied), not JWT. **No Authorization header validation.** Caller can pass any `userId`. |

### MEDIUM: Insufficient granularity

| File | Weakness |
|------|----------|
| `supabase/functions/celeb-products/index.ts` | Service-role client. `purchase` does read-modify-write on `user_profiles.coin_balance` without atomic protection — race condition / double-spend possible. |
| `supabase/functions/livekit-token/index.ts` | Allows anonymous viewer tokens with client-supplied identity. |
| `supabase/functions/notify-admin-event/index.ts` | `isServiceRole = bearerToken === supabaseServiceKey` — anyone with the service role key can send `new_user_signup` events. |

---

## 5. Security Risks Identified

### Critical

1. **No `CREATE ROLE` statements exist.** Roles are TEXT columns/BOOLEAN flags on `user_profiles`, enforced only through RLS policies and SECURITY DEFINER functions. No database-level role enforcement — any RLS misconfiguration is directly exploitable.

2. **`secure_db_access.sql` REVOKES ALL from `anon`**, but many migrations subsequently `GRANT` back to `anon` (e.g. `add_trollmonds_column.sql:16` grants ALL on `user_profiles` to anon). Effective permissions depend on migration order — uncertainty.

3. **`handle_user_signup()` is SECURITY DEFINER owned by `postgres`** (`secure_db_access.sql:125, 223`) and runs as a trigger on `auth.users`. Inserts into `user_profiles` and `coin_transactions` — bypasses RLS with elevated privileges.

4. **`is_admin()` is redefined in two places** with `DROP FUNCTION ... CASCADE` in `UNIVERSAL_RLS_SYSTEM.sql:199`. Over 100 RLS policies depend on `is_admin()` (`20260629000002_staff_audit_system.sql:498`). Migration load order can cause unexpected behavior.

5. **Many SECURITY DEFINER functions lack `SET search_path`** — vulnerable to search_path injection. `fix_function_search_path_mutable.sql` and `fix_and_patch_search_path.sql` exist but don't cover all functions.

6. **`service_role` bypasses RLS entirely.** Edge functions use `SUPABASE_SERVICE_ROLE_KEY` and `auth.role() = 'service_role'` is trusted in `prevent_profile_privilege_escalation()` trigger (`20290905000001_fix_role_management_trigger.sql:47`). If the service role key leaks, full database access is possible.

7. **`staff_action_audit_log` INSERT policy allows any authenticated user to insert** (`20260629000002_staff_audit_system.sql:78-79`, `WITH CHECK (auth.uid() IS NOT NULL)`). Any authenticated user can write audit log entries — falsifying audit records.

8. **`broadcaster_earnings` table has a `FOR ALL` policy for officers/admins** (`apply_all_pending_migrations.sql:231-239`) — allows DELETE of broadcaster earnings records, not just read/update.

### High

9. **`user_profiles` had ALL granted to `anon` and `authenticated`** in multiple migrations (`add_trollmonds_column.sql:15-16`, `add_wheel_troll_locked_column.sql:15-16`) — these `GRANT ALL` statements override the zero-trust REVOKE depending on migration order.

10. **Edge functions check `is_admin` inconsistently** — some check `profile.is_admin === true`, others `profile.role === 'admin'`, others both. Some check `is_lead_officer`/`is_troll_officer`. Inconsistency creates privilege-escalation risk if a flag is set but not checked.

11. **`log_staff_action()` is SECURITY DEFINER** and reads `user_profiles` — any authenticated user can call it (INSERT policy allows `auth.uid() IS NOT NULL`), and it runs as the function owner.

12. **`create_notification()` is SECURITY DEFINER**, GRANTed to `authenticated, service_role` — any authenticated user can create notifications for any user.

13. **`is_broadcast_locked()` GRANTed to `anon`** — anonymous users can execute this function (information disclosure about broadcast lockdown status).

14. **`moderation-actions` edge function is 3187 lines** with complex role-check logic (`MOD_ACTIONS_ROLES`, boolean flags, `troll_role`) — high complexity increases risk of authorization logic bugs.

### Medium

15. **`role_permission_matrix` is readable by anyone** (`20260629000002_staff_audit_system.sql:116-117`, `USING (true)`) — full permission matrix publicly readable, exposing internal access control structure.

16. **`protect_owner_admin_changes()` trigger is SECURITY DEFINER** (`supabase/sql/protect_owner_admin.sql:40`) — runs with elevated privileges.

17. **`notify-stream-live` and `notify-admin-event` load ALL `user_profiles`** without filtering — data exposure concern at scale.

---

## 6. Key Security Files

| File | Purpose |
|------|---------|
| `secure_db_access.sql` | Zero-trust baseline (REVOKE ALL from anon/public), `handle_user_signup()` trigger |
| `secure_roles_and_permissions.sql` | `is_staff`, `is_broadcast_owner`, `is_active_broadofficer` functions + RLS |
| `UNIVERSAL_RLS_SYSTEM.sql` | Comprehensive RLS system, `system_roles`, `is_admin`, `is_staff` |
| `20260629000002_staff_audit_system.sql` | `role_permission_matrix`, `is_staff_consolidated`, `is_admin_consolidated`, audit log |
| `supabase/sql/admin_setup.sql` | `user_roles` table, `is_admin_user` function |
| `supabase/sql/protect_owner_admin.sql` | Owner protection trigger |
| `broadofficers_setup.sql` | `broadcast_officers` table + SECURITY DEFINER RPCs |
| `add_broadcast_lockdown_settings.sql` | `admin_settings`, `is_broadcast_locked()` |

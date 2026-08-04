# Bug Triage Report — 76 Entries Clustered

================================================================================
CLUSTER 1 — Streams table schema drift (code vs DB mismatch)
================================================================================

Root cause: Frontend/hooks/edge-functions reference columns on `streams` that are
missing from the tracked schema in `supabase/migrations/`.

Missing / misnamed columns:
  - `camera_enabled`, `microphone_enabled`, `end_reason`, `rtc_connected`
  - `is_live` (code uses it, but DB uses `status` enum instead)
  - `last_heartbeat_at`, `updated_at`, `end_time`
  - `livekit_room_name`
  - `state_battle_mode` — EXISTS in live DB with NOT NULL but is absent from
    tracked migrations; code is not supplying it on INSERT.

Affected code & fixes:
  1. src/hooks/useBroadcastShutdown.ts:122-130
     - stopBroadcast() `.update()` writes `is_live`, `camera_enabled`,
       `microphone_enabled`, `end_reason`, `rtc_connected` — all missing.
     - line 217 writes `last_heartbeat_at` — missing.
     - Fix: Align updates with actual `streams` columns OR add the columns
       via migration. At minimum, replace `is_live` with `status = 'ended'`
       and drop unknown fields, or create a migration that adds them.

  2. supabase/functions/livekit-token/index.ts:310
     - Queries `is_live` from `streams`. Does not exist.
     - Code catches the error gracefully (falls back to `status === "live"`),
       but pollutes logs with PGRST204.
     - Fix: Remove `is_live` from the select; rely solely on `status`.

  3. supabase/functions/streams-maintenance/index.ts:93,134,147
     - `end_stream` writes `is_live = false` (line 93).
     - `cleanup_ghost_streams` queries `.eq("is_live", true)` and
       `.or("last_heartbeat_at.is.null", ...)` (lines 134-135).
     - All three columns (`is_live`, `last_heartbeat_at`, plus `ended_at`
       exists but `end_time` does not).
     - Fix: Replace `is_live` with `status != 'live'`, replace heartbeat
       query with `created_at`/`ended_at` logic, or add the columns.

  4. src/pages/broadcast/BroadcastPage.tsx:3676
     - Uses `stream.livekit_room_name || stream.id`. Column missing.
     - Fix: Remove reference or add column.

Bugs in this cluster:
  #1, #3, #4, #5, #10, #11, #14, #15, #17, #19, #20, #22, #67, #72, #75, #76

================================================================================
CLUSTER 2 — Missing tables / old table names still in code
================================================================================

Root cause: Admin and broadcast code query tables that do not exist in the
current schema (or were renamed in recent migrations).

Missing tables:
  - `public.transactions` — only present in `migrations_backup`; current live
    schema uses `coin_transactions` / `xp_transactions` / `paypal_transactions`.
  - `public.coin_store_sales` — schema hint says "Perhaps you meant coin_orders".
  - `public.system_alerts` — only in backup migrations.
  - `public.admin_finance_summary`, `public.admin_finance_feed` — not in any
    active migration.
  - `public.broadcast_missions` — hint says `broadcast_mod_actions`.
  - `public.broadcast_troll_usages` — hint says `broadcast_replays`.
  - `public.user_tax_info` — hint says `user_entrance_audio`.

Affected code & fixes:
  1. src/pages/admin/AdminDashboard.tsx:653,675,881
     - Queries `public.transactions` and `coin_store_sales`.
     - Fix: Replace `transactions` with `coin_transactions` (or whichever
       table actually holds purchase rows). Replace or remove
       `coin_store_sales` references.

  2. src/pages/admin/components/PresidentialOversightPanel.tsx:249
     - Queries `system_alerts` indirectly via other components.
     - Fix: Either add the missing tables via migration or guard the queries
       with feature flags / `try/catch` + fallback UI.

  3. Similar guards needed wherever PGRST205 table-missing errors originate
     (`admin_finance_summary`, `admin_finance_feed`,
     `broadcast_missions`, `broadcast_troll_usages`, `user_tax_info`).

Bugs in this cluster:
  #9, #18, #24, #25, #30, #33, #34, #35, #36, #37

================================================================================
CLUSTER 3 — Missing stored procedures / edge functions
================================================================================

Root cause: Frontend or other functions call Postgres RPCs or edge functions
that are not deployed/synced.

Missing DB functions / edge endpoints:
  - `public.update_stream_viewer_count(p_count, p_stream_id)`
  - `public.issue_promo_card(...)`
  - `public.start_broadcast_with_capacity_check(p_stream_id)`
  - `public.register_session(...)`

Fix options per function:
  a) Create the missing RPC in a new migration.
  b) Remove the caller if the feature was deprecated.
  c) Replace with an equivalent existing function (use the PostgREST hint).

Bugs in this cluster:
  #13, #23, #38, #59

================================================================================
CLUSTER 4 — Missing FK relationships (PGRST200 implicit joins)
================================================================================

Root cause: Code uses Supabase `table!foreign_key(columns)` implicit-join syntax
but the FK constraint is missing from the DB schema.

Broken relationships:
  - `stream_seat_sessions` → `user_profiles` (hint: `agora_stream_sessions`)
  - `user_subscriptions` → `subscriber_id` (hint: `user_reputation`)
  - `stream_viewers` → `user_profiles` (hint: `stream_raffle_winners`)
  - `user_league_members` → `league_id` (hint: `user_licenses`)
  - `president_proposals.created_by` → `user_profiles(id)`

Fix approach:
  - Add explicit FOREIGN KEY constraints via migration so PostgREST can
    detect them.
  - OR replace implicit joins with manual Supabase client-side joins.

Affected files:
  - src/pages/admin/components/shared/ProposalManagementPanel.tsx:45
    `.select('creator:user_profiles!created_by(...)')` breaks because FK
    `president_proposals.created_by → user_profiles(id)` is absent.

Bugs in this cluster:
  #2, #12, #16, #21, #31, #32

================================================================================
CLUSTER 5 — LiveKit token / broadcast setup failures
================================================================================

Symptom: "invalid token", "LiveKit credentials not configured on server",
"Failed to fetch" when starting a broadcast from /broadcast/setup.

Root causes:
  1. `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` not set in Supabase Edge
     Function secrets.
       → supabase/functions/livekit-token/index.ts:634-667
       Fix: Set secrets in Supabase dashboard or local .env.

  2. Frontend stale prefetch / HMR race during SetupPage development.
     @vite/client reports `isStartingBroadcastRef` duplicate declaration
     and HMR reload failures. This was transient during active editing;
     current Source has only one declaration (line 341).
     If it reappears, it is a Vite/HMR cache issue — restart dev server.

  3. Duplicate stream primary key (streams_pkey violation) during INSERT.
     `generateUUID()` in SetupPage.tsx may produce a colliding UUID
     (extremely unlikely) OR the same stream is being inserted twice
     because the broadcast-start flow is not properly gated.
       Fix: Verify the insert path only fires once; add a DB-side
       `ON CONFLICT DO NOTHING` or guard with `isStartingBroadcastRef`
       earlier in the flow.

  4. `state_battle_mode` NOT NULL but not supplied on stream INSERT.
     DB has the column with NOT NULL but the code does not set it.
       Fix: Add `state_battle_mode: 'none'` (or appropriate default) to
       every INSERT payload, or make the column nullable in DB.

Bugs in this cluster:
  #39, #40, #41, #42, #43, #44, #45, #46, #47, #48, #49, #50, #51, #52,
  #53, #54, #55, #56, #57, #58, #63, #64, #65, #66, #68, #69, #70, #71,
  #73, #74

================================================================================
CLUSTER 6 — Admin panel logic bugs (not schema-only)
================================================================================

Root cause: Functional bugs in admin components.

A. `AdminDashboard.tsx:1077-1082`
   Sends `action: 'delete_stream'` to `streams-maintenance`, which only
   supports `end_stream` and `cleanup_ghost_streams`. The request hits the
   default case and returns `{ error: "Invalid action" }` (HTTP 400).
   Fix: Implement a `delete_stream` case in the edge function OR change the
   call to use `end_stream` followed by manual row deletion.

B. `PresidentialOversightPanel.tsx:257`
   Queries `user_role_grants.is_active`, but that column does not exist.
   The filter at line 264 (`grant.is_active === false`) is always false,
   so expired grants are NOT filtered out.
   Fix: Remove `is_active` from the select and rely solely on
   `expires_at` comparison.

C. `BetaCapacityMonitor.tsx:110`
   Filters on `streams.is_live`, which does not exist.
   Fix: Replace `.eq('is_live', true)` with `.eq('status', 'live')`.

Bugs in this cluster:
  #26, #27, #28, #29, #31, #32

================================================================================
CLUSTER 7 — Auth / RLS / session errors
================================================================================

Root cause: These are authentication and policy-level issues rather than
schema mismatches.

A. Login errors (#6, #7, #8)
   "Invalid login credentials" / "Invalid email or password."
   Likely caused by testing against a DB where seeded users don't match,
   or by RLS/auth configuration on `user_profiles`.
   Fix: Verify seeded user emails and that `user_profiles` is accessible
   to the calling role.

B. RLS violation on `global_events` (#60, #61)
   "new row violates row-level security policy"
   Fix: Review the RLS INSERT policy on `public.global_events`; ensure
   the `anon`/`authenticated` role or the service role is permitted.

C. Invalid refresh token (#62)
   `refresh_token_not_found`
   Fix: Client-side session persistence issue; ensure Supabase client is
   initialized with `persistSession: true` and cookies are not being
   cleared aggressively.

Bugs in this cluster:
  #6, #7, #8, #60, #61, #62

================================================================================
CLUSTER 8 — Type mismatches / invalid literals
================================================================================

Root cause: Code passes data of the wrong type to SQL.

A. `operator does not exist: text = uuid` (#20)
   A query is comparing a UUID column to a text value without an explicit
   cast.
   Fix: Cast the value to UUID or fix the variable type at the caller.

B. `invalid input syntax for type boolean: "none"` (#70, #71)
   A boolean column (likely `state_battle_mode`) is being inserted/updated
   with the string `"none"`.
   Fix: Remove the bad payload or convert `"none"` → `false` / `NULL`.

Bugs in this cluster:
  #20, #70, #71

================================================================================
SUMMARY TABLE
================================================================================

Cluster                   | Bugs  | Impact    | Estimated effort
--------------------------|-------|-----------|---------------
1. Streams schema drift   | ~16   | HIGH      | Medium (migration + code sweep)
2. Missing tables         | 10    | HIGH      | Medium (rename/remove queries)
3. Missing functions      | 4     | HIGH      | Low-Medium (add RPCs)
4. Missing FK rels        | 6     | HIGH      | Low (add FK constraints)
5. LiveKit / setup flow   | 22    | MEDIUM    | Medium (secrets + idempotency)
6. Admin logic bugs       | 6     | MEDIUM    | Low (small code fixes)
7. Auth / RLS             | 6     | MEDIUM    | Medium (policy + seed review)
8. Type mismatches        | 2     | LOW       | Low
SetupPage HMR transient   | 6     | RESOLVED  | N/A

Total resolved / transient: 6
Total active bugs: 70
================================================================================

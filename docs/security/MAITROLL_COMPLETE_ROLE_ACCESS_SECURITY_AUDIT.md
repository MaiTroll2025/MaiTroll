# MaiTroll Role, Data Access, and RPC Security Audit

**Status:** Source and live-catalog review; no exploit or state-changing tests run
**Evidence snapshot:** 2026-11-06 (local review; Supabase branch and catalog queried during this session)
**Production project:** `gejtbllazzighxwxudyu` (project ref; URL omitted)
**Staging:** `security-audit-staging`, ref `kiqyxuceengctjugavxm`; branch listing reported `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`. Database migration health and test identities were not verified.

> This is a conservative evidence report, not a certification that the application or production database is secure. No production mutations, payment actions, test writes, or negative API probes were performed. The prior Kilo-generated role summary was excluded; findings below were formed from application source, migrations, and the live catalog evidence collected for this review.

## Executive summary

The Supabase catalog confirms that the public API currently exposes a very large attack surface: **1,201 public relations** (1,184 tables and 17 views) and **882 public functions**, of which 714 are `SECURITY DEFINER`. **809 public functions are executable by `anon`** and 845 by `authenticated` (PostgreSQL ACL inheritance included). There are 2,274 RLS policies across 1,138 objects. All 1,184 public tables report RLS enabled, but RLS alone does not constrain a `SECURITY DEFINER` routine that performs its own privileged SQL. The live advisor reported 50 `rls_enabled_no_policy` findings; an enabled table with no applicable policy is normally denied to API roles, but every finding still needs object-level review.

The most urgent source/catalog issues are privileged routines that accept caller-controlled identities or amounts while being callable via `PUBLIC`/`anon`:

1. **P0 — arbitrary balance changes:** live `SECURITY DEFINER` routines `add_free_coins(uuid,bigint)`, `add_troll_coins(bigint,uuid)`, and `adjust_balance(uuid,text,bigint,text)` are executable by `anon` and `authenticated`; their checked-in implementations update the selected profile balance without binding the target to `auth.uid()` or validating the caller as staff. Their current direct PostgREST RPC path bypasses admin UI guards.
2. **P0 — arbitrary role/profile mutation, conditional on admin UUID:** live `admin_update_any_profile_field(uuid,jsonb,uuid,text)` is also `SECURITY DEFINER` and `PUBLIC`/`anon` executable. Its guard checks the caller-supplied `p_admin_id` against `user_profiles`; it does not bind that parameter to `auth.uid()`. A caller who can supply an actual admin/lead-officer UUID can request role/flag and coin changes. No exploit was attempted.
3. **P0 — cashout mutation / repeated refund risk:** live `troll_bank_deny_cashout(uuid,uuid,text)` and `troll_bank_finalize_cashout(uuid,uuid)` are `SECURITY DEFINER` and publicly executable. Checked-in implementations trust `p_admin_id`; the denial implementation can credit returned coins each time it is called on a still-deniable payout. Live endpoint guards do not protect direct RPC callers.
4. **P1 — caller-supplied promotional inputs and private status:** `award_friday_battle_gifter_bonus`, `reserve_first_cashout_match_slot`, and `issue_first_cashout_match` are public `SECURITY DEFINER` routines with caller-controlled identity/amount parameters. Migration bodies do not consistently bind actors to `auth.uid()` or verify source events. `can_cashout(uuid)` is a public eligibility/status lookup by arbitrary user ID.

These are authorization weaknesses, **not evidence that anyone exploited them**. Precise impact and current body/version equivalence for every routine require safe staging/API tests. None were run.

### Concise role summary

| Actor / app role | What source establishes | Effective access conclusion |
|---|---|---|
| Anonymous / visitor | Uses Postgres `anon`; public functions include security-definer RPCs. | Can call every routine granted to `PUBLIC` (including named high-risk RPCs); table access remains object- and policy-specific. No authenticated API tests run. |
| Regular signed-in user / viewer | Normally Postgres `authenticated`; `user_profiles.role` and `troll_role` currently contain `user` in the small queried profile snapshot. | No generic staff power is established. Direct RPC grants are not narrowed by the app role; public grants remain callable. |
| Broadcaster | Separate `broadcaster` identity in moderation code; stream owner can moderate their own stream. | Stream/owner-scoped moderation is source-defined; no blanket staff or financial privileges demonstrated. |
| **Broadcast Officer (`broadofficer`)** | Exact identifier appears separately in moderation code and staff navigation constants; distinct from `broadcaster`. Assignment and stream scope are represented in moderation/stream logic. | Does not automatically become a Postgres role. Exact live membership and full operation set not proven. |
| Staff / moderator roles | Frontend helper recognizes several roles/flags; Edge and SQL handlers apply narrower checks that differ by endpoint. | Permissions are additive and inconsistent across entry points; “staff” is not a uniform database permission. |
| `admin`, lead troll officer | Present in live `user_profiles` snapshot; explicitly checked by some Edge routes. | Some trusted Edge admin workflows; direct RPC authorization must be checked independently and several RPCs are unsafe. |
| Founder / CEO / owner / superadmin | Names and flags occur in frontend role helpers; no corresponding current live membership was returned by the queried role snapshot. | Role existence in source is not proof of assignment or special Postgres rights. |
| Suspended / banned / restricted / temporary review / test / guest | Account-state fields and temporary-review logic exist in source/migrations. | Individual operation enforcement and expiry require per-endpoint review; no universal API-level denial established. |
| Postgres `service_role`, function owner, triggers, jobs | Service client is used by Edge Functions; live routine owner is `postgres`; triggers and cron/net extensions exist. | Service-role calls bypass ordinary RLS; function owner/definer context can bypass RLS as configured. Job caller boundaries were not fully enumerated. |

## 1. Scope, evidence, and confidence

### Evidence collected

- Read role helpers [`src/lib/staff.ts`](../../src/lib/staff.ts), [`src/lib/protectedRoles.ts`](../../src/lib/protectedRoles.ts), the TCNN role hook [`src/hooks/useTCNNRoles.ts`](../../src/hooks/useTCNNRoles.ts), moderation action code, the main route file [`src/App.tsx`](../../src/App.tsx), and relevant migration/function/Edge source.
- Queried the Supabase project URL and branch listing; read live table/catalog inventory, public function metadata/ACLs for the named candidate RPCs, RLS policy summary, selected trigger inventory, migration history, role field counts, advisor output, and deployed Edge Function list.
- Project ref in the live project URL was `gejtbllazzighxwxudyu`; branch listing showed `main` and `security-audit-staging` (`kiqyxuceengctjugavxm`). Project identity is recorded here only as a ref, not a secret.
- Live migration history returned **47 rows**, latest `20291105000006_officer_name_change_moderation`. The local `20291105000002_add_admin_update_any_profile_field.sql` migration was not present in the returned live migration history, but the live function itself exists; this is migration-history drift and a reason not to infer the deployed body from migration order alone.
- Live profile role query returned **9 profiles** in its scope: `user` (9), `admin` (1), and `lead_troll_officer` (1) across the queried `role`/`troll_role` fields; queried true flags included one each of `is_admin` and `is_troll_officer`. Values are counts only; no user identifiers are reproduced. This query did not establish all app flags, role expiry, or all possible membership systems.

### Inventory counts and limits

| Surface | Count observed | Coverage |
|---|---:|---|
| Live public tables | 1,184 | RLS-enabled state counted for every table; not every table/column/policy was manually classified. |
| Live public views | 17 | Counted; definitions, grants, and underlying security behavior were not exhaustively reviewed. |
| Live public functions | 882 | Counted; 714 `SECURITY DEFINER`; named high-risk set reviewed. |
| Public functions executable by `anon` | 809 | Effective privilege test; PUBLIC grants are inherited and count as anon execution. |
| Public functions executable by `authenticated` | 845 | Effective privilege test; does not imply app-role validation. |
| Live RLS policies | 2,274 | Counted; associated with 1,138 objects. Not all expressions individually traced. |
| Live advisor `rls_enabled_no_policy` | 50 | Advisor category count; not proof of public exposure, but classification remains open. |
| Local Edge Function directories | 109 | Source directories counted. |
| Deployed Edge Function entries | 102 | Deployed list returned 102 entries; every route was not source-to-catalog traced. |
| Local tracked migration SQL files | 341 | Includes local migration tree only; backup/ignored migration trees excluded from active-migration count. |
| Production negative/positive tests | 0 | Deliberately not run. |
| Staging permission tests | 0 | Branch exists and reports healthy/functions deployed, but database migration readiness, identities, API keys, and isolation were not validated. |

**Unreviewed / not classified object sets:** all public relations except those named in this report; all public function overloads except named candidates; full view definitions and view grants; all 2,274 policy expressions; all storage policies and object paths; Realtime publication/channel filters; every Edge Function endpoint; cron jobs and external integration callbacks; every non-public schema. No complete generated per-object dump is included. This report therefore does **not** satisfy a claim of exhaustive per-table/per-function authorization classification; those rows remain **UNKNOWN / NOT REVIEWED**.

## 2. Role glossary and hierarchy

### Distinguish application roles from database roles

`user_profiles.role`, `user_profiles.troll_role`, profile boolean fields, and membership tables are application identity data. They are **not** Postgres database roles. Unless an RPC/Edge handler reads and validates the app identity, a JWT with database role `authenticated` may reach any function granted to `authenticated` or inherited from `PUBLIC`; an `anon` JWT may reach functions granted to `anon` or `PUBLIC`.

The live ACL examples below have the form `{=X/postgres,...,anon=X/postgres,authenticated=X/postgres,...}`. The empty grantee before `=X` is `PUBLIC`; revoking only `anon` does not remove that inherited grant.

### App roles and flags found in code

| Identifier / flag | Evidence / interpretation |
|---|---|
| `user` | Ordinary profile role found in current live profile snapshot. |
| `broadcaster` / `is_broadcaster` | Broadcast actor; moderation SQL checks stream ownership for this role. Not a generic staff role. |
| `broadofficer` / `is_broadofficer` | Separate stream-assigned officer identity in moderation implementation. It is not synonymous with broadcaster, troll officer, or global moderator. |
| `officer`, `troll_officer`, `lead_troll_officer` / `is_troll_officer`, `is_lead_officer` | Various staff/moderation checks. SQL/Edge handlers use different subsets. |
| `admin` / `is_admin` | Admin checks appear in routes and server handlers. Database role still `authenticated` or `anon`. |
| `superadmin`, `is_superadmin`, `is_super_admin` | Both spelling variants appear in source; `useTCNNRoles` selects `is_super_admin`, while staff helpers use `is_superadmin`. This inconsistency needs reconciliation. |
| `owner`, `ceo`, `ceo_assistant`, `noah_assistant`, `noah_admin` | Protected or staff helper constants; no global database privilege follows from the identifier alone. |
| `secretary`, `prosecutor`, `attorney`, `judge`, `court_officer`, `moderator` | Present in staff/protected-role code; exact per-feature authorization differs. |
| `agency_hr`, `agency_hr_manager`, `hr_admin`, `marketing_agent`, `empire_partner` | Present in staff helpers; not uniformly elevated on the server. |
| `president`, `vice_president`, `pastor`, `journalist`, `news_caster`, `chief_news_caster`, `agency_leader` | Present in protected-role/TCNN code; does not demonstrate database permissions. |
| `is_staff`, `is_ceo`, `is_secretary`, `is_prosecutor`, `is_attorney` | Boolean permission sources consumed by client helpers; server-side use must be individually verified. |
| banned / restricted / jailed / review-account states | Account restrictions and temporary-review cleanup appear in code/migrations. Not a single role and no universal operation gate proven. |
| Guest / anonymous / test | Anonymous is a Postgres API role; guest/test identity behavior is feature-specific. No disposable test accounts were used. |

### Role precedence and assignment

The frontend treats role text, `troll_role`, and booleans additively in `isStaffProfile`; any recognized value can make the helper return true. Protected-role checks also use display names in addition to roles. These are client helpers, not authorization proofs. `admin-actions` has its own server check: `admin`, `lead_troll_officer`, `is_lead_officer`, or `is_admin`, with a separate `secretary` allowance for some operations. `paypal-payout` uses `admin`, `lead_troll_officer`, or `is_admin` only. No universal hierarchy, conflict resolution, role expiry, or precedence across all endpoints is established.

`broadofficer` appears in `NIGHT_WATCH_PATROL_ROLES` and moderation code, while the general `STAFF_ROLES` set does not include it. Its scope is stream-specific in moderation; do not infer global staff authority.

## 3. Role-to-data access matrix

`Expected` means the intended scope evident from checked-in code/policies; `effective` is only claimed where catalog/source evidence supports it. Every table/view not listed by exact name below is **UNKNOWN / NOT REVIEWED**, not implicitly denied.

| app_role | database_role | schema.object | object_type | operation | specific_columns | row_scope | access_path | expected_access | verified_effective_access | source_enforcement | evidence | tested? | risk | recommended_change | compatibility_impact |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Anonymous | `anon` | `public.*` | Tables/views | SELECT/INSERT/UPDATE/DELETE | Per-object grants/policy unknown | Policy-specific | REST/PostgREST | Public data only | Unknown per object; public tables all have RLS enabled | RLS plus grants | Live catalog: 1,184 public tables, all RLS enabled; policies need individual review | No | High unknown surface | Classify all policies/grants/columns; do not blanket revoke | Must preserve public browse |
| Signed-in user/viewer | `authenticated` | `public.user_profiles` | Table | SELECT/UPDATE | Source selects varied public profile fields | Own row or public fields expected; exact policies not fully reviewed | REST/client SDK | Own profile and public profile fields | Unknown in full; direct function gaps confirmed | RLS plus function checks (where implemented) | [`useTCNNRoles.ts`](../../src/hooks/useTCNNRoles.ts) reads role flags; catalog shows public table RLS | No | High | Verify each selected column and `WITH CHECK`; bind profile writes to UID | Preserve profile/privacy features |
| Broadcaster | `authenticated` | stream collaboration and stream objects | Tables | CRUD | Stream/participant fields | Own/participating stream expected | REST, RPC, Realtime | Own stream and collaboration scope | Some source-scoped RLS evident; full live policies not reviewed | `auth.uid()` ownership policies in migration | [`20260805000001_create_stream_collaboration_tables.sql`](../../supabase/migrations/20260805000001_create_stream_collaboration_tables.sql) lines 130-182 | No | Medium unknown | Test owner vs collaborator boundaries | Preserve multi-host streaming |
| Broadcaster | `authenticated` | moderation RPCs / own stream | Functions | moderate stream | Targets/action fields | Own stream | Direct RPC/Edge | Owner moderation | Migration checks broadcaster role and stream owner | SQL function checks `is_modo_role_in` and ownership | [`20260809000001_moderation_actions_backend.sql`](../../supabase/migrations/20260809000001_moderation_actions_backend.sql) lines 382-400 | No | Medium | Verify every function grant and target-scope condition | Preserve broadcaster moderation |
| Broadcast Officer (`broadofficer`) | `authenticated` | stream assignment/participant and moderation objects | Tables/functions | stream-scoped actions | Assignment, target, stream | Assigned stream expected | Client/Edge/RPC | Assigned stream only | Role and assignment logic exists; complete effective scope unknown | SQL and Edge role functions; not a Postgres role | [`20260809000001_moderation_actions_backend.sql`](../../supabase/migrations/20260809000001_moderation_actions_backend.sql) lines 394-400, 940-1000; [`moderation-actions/index.ts`](../../supabase/functions/moderation-actions/index.ts) lines 382-434 | No | Medium | Test assigned/unassigned streams and spoofed target IDs | Keep distinct from broadcaster/global staff |
| Troll officer / lead officer / moderator | `authenticated` | moderation RPCs and logs | Functions/tables | moderation and review | Exact set varies by action | Case/stream/role dependent | RPC/Edge | Assigned authority | Handler-specific; no blanket answer | Per-function SQL/Edge checks | [`moderation-actions/index.ts`](../../supabase/functions/moderation-actions/index.ts); [`officer-actions/index.ts`](../../supabase/functions/officer-actions/index.ts) lines 55-56 | No | High | Centralize server-side authorization while preserving role scopes | Avoid broader access regression |
| Admin / lead troll officer | `authenticated` | `public.admin_update_any_profile_field(uuid,jsonb,uuid,text)` | Function | UPDATE/role change/coin change | Role, admin/officer flags, coins, level/XP, broadcast bypass, styles/badge | Any target row | Direct RPC | Admin-only | **PUBLIC/anon/auth executable**, definer; supplied `p_admin_id` is the identity checked | Function body checks profile by argument, not `auth.uid()` | Live catalog and [`20291105000002_add_admin_update_any_profile_field.sql`](../../supabase/migrations/20291105000002_add_admin_update_any_profile_field.sql) lines 4-66 | No | **P0** | Bind actor to `auth.uid()` or trusted server; minimize writable fields | Admin UI uses it; preserve trusted Edge path |
| Any app role | `anon` or `authenticated` | `public.user_profiles.troll_coins` via `add_free_coins` / `add_troll_coins` | Function side effect | UPDATE | `troll_coins` | Caller-selected UUID | Direct RPC | Server-verified credit only | Public/anon/auth executable definer routines; source body updates selected profile without actor/source verification | Routine SQL; not protected by caller page guard | Live catalog; [`20290815000020_unify_paid_coins.sql`](../../supabase/migrations/20290815000020_unify_paid_coins.sql) lines 51-60; [`20291012000001_bug_center_schema_repairs.sql`](../../supabase/migrations/20291012000001_bug_center_schema_repairs.sql) line 573 | No | **P0** | Restrict direct execution; validate actor and trusted credit source/idempotency | Payment/reward callers need migration to trusted workflow |
| Any app role | `anon` or `authenticated` | `public.user_profiles` via `adjust_balance` | Function side effect | UPDATE | `troll_coins` / `trollmonds` | Caller-selected UUID/currency/amount | Direct RPC | Admin/ledger controlled adjustment | Public/anon/auth executable definer; accepts caller-controlled target/currency/amount | Routine body in migration performs update; no actor check | Live catalog; [`20290815000020_unify_paid_coins.sql`](../../supabase/migrations/20290815000020_unify_paid_coins.sql) lines 97-140 | No | **P0** | Restrict and authorize; route ledger writes through audited transaction service | Update direct clients |
| Any app role | `anon` or `authenticated` | `public.payout_requests` and `user_profiles` via cashout RPCs | Function side effect | UPDATE / refund | Status, paid/denied metadata, coin balances/reservations | Selected payout | Direct RPC | Admin-only decision after verified payment | Public definer routines; supplied admin ID not bound to caller; deny path lacks robust idempotency in checked migration | RPC body; Edge guards only protect Edge route | Live catalog; [`20260810000008_fix_cashout_coin_tracking.sql`](../../supabase/migrations/20260810000008_fix_cashout_coin_tracking.sql) lines 178-300; [`20290901000001_drop_cashout_reserve_columns.sql`](../../supabase/migrations/20290901000001_drop_cashout_reserve_columns.sql) | No | **P0** | Caller binding, row lock/state transition guard, single refund ledger key | Preserve payout callback workflows |
| Any app role | `anon` or `authenticated` | `public.cashout_promotions`, claims, profiles via match RPCs | Functions/side effects | SELECT/INSERT/UPDATE/credit | Claim, user, amount, reward coins | Caller-provided user and payout IDs | Direct RPC | Trusted cashout process only | Public definer routines; user/amount arguments not consistently tied to session/event | Migration body | Live catalog; [`20260907000001_first_cashout_match_promotion.sql`](../../supabase/migrations/20260907000001_first_cashout_match_promotion.sql) lines 146-310 | No | P1 | Derive actor and payout/amount from locked DB rows; idempotent issue | Preserve promotion feature |
| Any app role | `anon` or `authenticated` | `public.user_profiles` via `can_cashout(uuid)` | Function | SELECT status | Eligibility/warrant/license/restriction-derived status | Caller-selected profile | Direct RPC | Self or authorized staff | Public definer callable; arbitrary ID accepted in signature | Function body in migrations | Live catalog; [`20290901000011_troll_court_complete_workflow.sql`](../../supabase/migrations/20290901000011_troll_court_complete_workflow.sql) line 1491 | No | P1 | Bind self to `auth.uid()` and return minimal status | Cashout UI call needs own-user semantics |
| Service Edge workflow | `service_role` | `public.*` via admin/payout Edge | Tables/functions | Privileged workflow | Endpoint-dependent | Endpoint checks | Edge + service client | Trusted server workflow | Service key use bypasses RLS; some handlers authenticate before admin checks | Edge source | [`admin-actions/index.ts`](../../supabase/functions/admin-actions/index.ts) lines 1-59; [`paypal-payout/index.ts`](../../supabase/functions/paypal-payout/index.ts) lines 55-112 | No | High | Keep service key server-only; minimize route capabilities and audit calls | Preserve trusted server operations |
| Function owner / trigger context | `postgres` / definer owner | Referenced tables | Function/trigger | Indirect writes | Function-dependent | Triggering row or definer query | Trigger / nested RPC | Narrow side effects | Owner `postgres`; some live triggers enabled; exact trigger completeness not established | Function owner, trigger state, function body | Live candidate function catalog and trigger inventory | No | High | Verify every money-protection trigger is enabled and definer boundaries | Do not disable existing triggers |

### Tables, columns, storage, and Realtime

- **Public relations:** 1,184 tables and 17 views in live catalog; all tables report RLS enabled. This does not answer which roles can read/write each column or whether security-definer routines bypass row checks. Full per-object matrix remains outstanding.
- **Storage:** live Storage relations have RLS enabled; bucket visibility and object-level policies were not enumerated in the available evidence. Bucket names, public/private status, upload/read/delete scope, signed URL access, and policy expressions are **UNKNOWN / NOT REVIEWED**.
- **Realtime:** a `realtime` schema and stream-related subscriptions exist. Publication membership, private channel auth, broadcast/presence policies, and client topic authorization were not exhaustively verified.
- **GraphQL:** the live catalog contains `graphql_public` schema/function surface; GraphQL API exposure and object permissions were not verified.
- **Private schemas:** one live `private` relation and eight `private` functions were counted. API exposure and callers were not fully traced.
- **No blanket denial claim:** a table having RLS enabled is not evidence that every operation is denied or properly scoped; grants, views, policies, definer functions, triggers, and service-role routes all affect effective access.

## 4. Role-to-function and endpoint matrix

### Named RPCs independently checked in the live catalog

All rows below were present in the live `public` schema with owner `postgres`. Unless specified otherwise, ACLs include `PUBLIC`, `anon`, `authenticated`, and `service_role`; the routines are `SECURITY DEFINER`.

| Exact signature | Live execution access | Source behavior / issue | Status |
|---|---|---|---|
| `add_free_coins(p_user_id uuid, p_amount bigint)` | `anon`, `authenticated`, `service_role`, inherited `PUBLIC` | Adds `p_amount` to `user_profiles.troll_coins` for caller-selected user ID. No actor, amount-sign, or source verification in checked implementation. | **Confirmed P0** |
| `add_troll_coins(p_amount bigint, p_user_id uuid)` | `anon`, `authenticated`, `service_role`, inherited `PUBLIC` | Thin wrapper around `add_free_coins`; preserves the same arbitrary credit path. | **Confirmed P0** |
| `adjust_balance(p_user_id uuid, p_currency text, p_amount bigint, p_event text)` | Same | Caller selects user, currency, and signed amount; migration body updates coin fields. | **Confirmed P0** |
| `troll_bank_credit_coins(p_user_id uuid, p_coins bigint, p_bucket text, p_source text, p_ref_id text, p_metadata jsonb)` | Same | Balance-bank write API with caller-selected identity/amount/source fields. Caller authorization, source validation, positive/negative amount handling, and idempotency require staged verification against live body. | **Potential P0** (reachability confirmed; exploit effect not staged) |
| `admin_update_any_profile_field(p_user_id uuid, p_updates jsonb, p_admin_id uuid, p_reason text)` | Same | In-body check reads role/flag for `p_admin_id`; no binding to `auth.uid()`. Can alter role/admin flags, coins, level/XP, and other listed fields. | **Confirmed P0 authorization flaw**; exploit not run |
| `troll_bank_finalize_cashout(p_request_id uuid, p_admin_id uuid)` | Same | Caller-supplied admin ID; marks payout paid and updates reservation/audit state in checked migration. Live PayPal Edge route has a separate admin check. | **Potential P0** direct RPC |
| `troll_bank_deny_cashout(p_request_id uuid, p_admin_id uuid, p_reason text)` | Same | Caller-supplied admin ID; checked migration credits returned coins and changes payout state. Repeated invocation/idempotency needs live API validation. | **Potential P0** direct RPC |
| `reserve_first_cashout_match_slot(p_user_id uuid, p_payout_request_id uuid, p_qualifying_amount numeric)` | Same | Reserves a promotion slot from caller-provided identity, payout, amount; migration does not establish authenticated actor ownership. | **Potential P1** |
| `issue_first_cashout_match(p_claim_id uuid, p_admin_id uuid)` | Same | Migration checks claim/payout existence and paid status but does not bind the caller to an administrator; may credit reward coins if prerequisites hold. | **Potential P1** |
| `award_friday_battle_gifter_bonus(p_gifter_id uuid, p_battle_id uuid, p_gift_total_coins bigint)` | Same | Migration computes/credits bonus from caller-supplied gift total and identifiers; idempotency key limits repeat award but does not prove a qualifying gift occurred. | **Potential P1** |
| `can_cashout(p_user_id uuid)` | Same | Eligibility helper accepts arbitrary user ID and is security definer; any private restriction details returned by body may be exposed. Exact response classification requires current-body review. | **Potential P1 privacy** |

The live metadata for the named routines showed ACLs containing `=X` (PUBLIC execute) and direct `anon`/`authenticated` entries. The source migration is not proof of the exact deployed body; compare the deployed function definition before applying any proposed change.

### Edge endpoints

| Endpoint | Authentication/authorization observed | Privileged effects | Bypass/unknown |
|---|---|---|---|
| `admin-actions` | Requires bearer token, resolves authenticated user, loads profile, gates route to admin/lead officer or secretary; individual actions further restrict some operations to `isAdmin`. | Uses `service_role` client for profile edits, payout actions, RPC invocation. | Does not secure direct PostgREST RPC calls. `secretary` is admitted to endpoint but only action-specific guards determine actual powers. |
| `paypal-payout` | Requires bearer token, verifies user through Supabase Auth, loads profile, checks `is_admin`, `role=admin`, or `role=lead_troll_officer`. | Uses service key and PayPal live endpoint; finalizes payout RPC after provider success. | Edge check is not an RPC guard. Production handler rejects sandbox mode, so no payout route test was performed. |
| `officer-actions` | Source recognizes `officer`, `troll_officer`, `lead_troll_officer`, `admin`, and flags; lead checks narrower. | Moderation actions via privileged client/DB logic. | Per-action scope not fully reviewed. |
| `moderation-actions` | Source recognizes role and boolean flags including `broadcaster` and `broadofficer`; checks action-specific roles and assignments. | Stream moderation and assignment actions. | Each route/action was not tested; direct RPC grants remain separate. |
| Other deployed Edge routes (98+) | Deployed list reports 102 entries; local source directories 109. | May use service-role credentials, external providers, or scheduled invocation. | Full endpoint inventory, `verify_jwt`, shared-secret checks, ownership, and callback verification **NOT REVIEWED**. |

## 5. Role-specific narratives

### Anonymous / visitor

The database API identity `anon` is not a MaiTroll application role. It can reach the named public RPCs above because they have PUBLIC execution. Route guards do not apply to a direct `/rest/v1/rpc/...` request. Direct table access is governed by each object’s grants and RLS policy; no universal anonymous table grant or denial claim is made. Anonymous read of cashout eligibility and caller-supplied balance operations are high-risk.

### Regular user / broadcast viewer

The ordinary `user` profile role does not create database permissions by itself. A signed-in viewer generally calls PostgREST as `authenticated`; direct grants to `authenticated` or PUBLIC remain effective regardless of the role text. The user can invoke the named RPCs unless the live RPC body itself rejects the caller. The balance functions above do not have such a check in their checked-in implementation. Viewer-specific access to chat, profile, gifts, and private messages is not exhaustively classified.

### Broadcaster

`broadcaster` is a distinct stream actor. Checked-in moderation SQL supports a broadcaster moderating their own stream; collaboration migrations include `auth.uid()` ownership predicates. This is not global moderation or staff authority. The independent direct RPC financial risks still apply to broadcaster sessions because the underlying Postgres API role is usually `authenticated`.

### Broadcast Officer (`broadofficer`)

This identifier is distinct from `broadcaster`. It appears in moderation role mapping and stream-specific assignment/removal logic and in the Night Watch role list. The frontend general staff helper does not include it in `STAFF_ROLES`, while another helper treats it as an eligible patrol role. This inconsistency is source evidence of differing UI scopes, not proof of server access. Exact live assignment status and exhaustive set of accessible streams remain unknown.

### Troll officer / lead officer / moderator

Role powers are endpoint-specific. `officer-actions` admits officer/troll-officer/lead-officer/admin checks; moderation SQL uses role arrays and stream ownership; the profile field RPC accepts lead troll officer as an admin-equivalent. A lead officer may therefore obtain broad profile mutation through that routine if they can supply a lead-officer UUID as `p_admin_id`. No consistent moderation case scoping across all handlers is proven.

### Admin / superadmin / founder / CEO

`admin` and `lead_troll_officer` occur in live profile snapshot. Admin settings and helpers recognize `superadmin`, `owner`, `ceo`, and related flags, but current assignment is not evidenced by the queried profile rows. Do not equate any of these with Postgres `service_role`. `admin-actions` and `paypal-payout` enforce distinct server-side subsets. Direct RPC endpoints remain callable without loading those pages.

### Secretary, municipal court, HR, and other staff

Secretary is admitted to `admin-actions` but action guards apply varying requirements. Court, legal, HR, marketing, TCNN, and similar identities appear in code, but this audit did not establish their complete route/API/table access. The exact role availability is **source-present / live-membership-unknown** unless counted in the live role snapshot.

### Suspended, banned, restricted, review, guest, and test identities

Account-state fields and temporary-review cleanup logic are present, but not every RPC or Edge route is shown to consult them. Direct public balance RPCs do not depend on the normal page state. No status bypass test was run. Guest and test identities should be treated as unclassified, not as implicitly least-privileged.

### `service_role`, function owners, triggers, jobs, integrations

The service key is used by privileged Edge code. It bypasses ordinary RLS and must remain server-side. The named functions are owned by `postgres` and execute with definer privileges. Trigger code can execute indirectly outside the user’s direct query and can alter balances or audit rows. The live trigger query included selected profile/coin/cashout triggers; it was not exhaustive enough to certify the state of every balance-protection trigger. Cron, pg_net, webhook, and third-party integrations were not fully traced.

## 6. Existing protection inventory

| Control | Observed state | Effect / limit |
|---|---|---|
| Frontend route guards | Present in [`src/App.tsx`](../../src/App.tsx), role helper files, and admin pages. | UX control only; direct RPC/REST bypasses it. |
| Edge auth | `admin-actions`, `paypal-payout`, officer/moderation routes perform server checks in examined handlers. | Only protects those Edge paths; does not transfer authorization to an RPC invoked directly. |
| RLS | All 1,184 live public tables report RLS enabled; 2,274 total policies across 1,138 objects. | Not a substitute for function checks, view security, table/column grants, owner bypass, or service role. |
| RLS policy gaps | Advisor reports 50 enabled tables with no policies. | Typically API access denied for those tables; review for intentional internal objects and definer paths. |
| Function execution grants | 809/882 public functions callable by `anon`; 845/882 by `authenticated`; many ACLs explicitly include PUBLIC. | Broad surface; do not use anon-only revoke as complete remediation. |
| Security-definer functions | 714 of 882 public functions. | Must inspect caller identity, arguments, owner, search path, SQL operations, and grants per exact overload. |
| Search path | Named functions have fixed `public` or `public, extensions` in catalog, while some functions have null `proconfig`. | A null config is not automatically exploitable, but mutable search path/qualification needs review. |
| Admin audit logging | `admin_update_any_profile_field` inserts an audit row in its checked implementation. | Audit does not prevent unauthorized changes; no append-only or tamper resistance verified. |
| Balance triggers | Live selected-trigger inventory returned trigger state `O` for observed enabled triggers. | No full inventory/count or proof every relevant trigger is enabled; trigger bypass flag exists in profile RPC. |
| Service-role boundary | Edge Functions instantiate service-role clients. | Server secret not shown; complete secret exposure scan not performed. |
| JWT/app claims | Application code selects profile role/flags from `user_profiles`; no universal custom-claims binding verified. | Stale/spoofed app role must be rejected by DB/server lookup; exact behavior varies by endpoint. |
| Payment provider | `paypal-payout` targets PayPal live API and explicitly rejects sandbox mode. | No financial test run; no real payout initiated. |
| Idempotency / concurrency | Some routines use unique-looking transaction keys and slot counters; others mutate payout status/credit without an evident atomic once-only guard in checked migrations. | Must test duplicate/concurrent calls against isolated staging. |

## 7. Priority findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---|---|
| 1 | 🔴 CRITICAL | [`20290815000020_unify_paid_coins.sql`](../../supabase/migrations/20290815000020_unify_paid_coins.sql) | 51-60, 97-140 | Public/anon-executable definer balance RPCs accept arbitrary target and amount; role is not bound to `auth.uid()`. | 10/10 |
| 2 | 🔴 CRITICAL | [`20291105000002_add_admin_update_any_profile_field.sql`](../../supabase/migrations/20291105000002_add_admin_update_any_profile_field.sql) | 4-66 | Definer profile/admin mutation checks caller-supplied `p_admin_id`, not authenticated caller; PUBLIC execution; can change privilege flags and balances if admin UUID supplied. Function is present in live catalog. | 9/10 |
| 3 | 🔴 CRITICAL | [`20260810000008_fix_cashout_coin_tracking.sql`](../../supabase/migrations/20260810000008_fix_cashout_coin_tracking.sql) | 178-300 | Public definer cashout finalize/deny entry points accept caller-supplied admin ID; denial credits balances. Edge auth does not protect direct RPC. | 8/10 |
| 4 | 🟠 HIGH | [`20260907000001_first_cashout_match_promotion.sql`](../../supabase/migrations/20260907000001_first_cashout_match_promotion.sql) | 146-310 | Public definer promotion reservation/issue paths use caller-supplied identity/amount and do not consistently bind the caller or source payout; possible slot abuse/reward issuance if prerequisites are met. | 8/10 |
| 5 | 🟠 HIGH | [`20260831000001_gift_undo_and_friday_battle.sql`](../../supabase/migrations/20260831000001_gift_undo_and_friday_battle.sql) | 191-235 | Public definer reward routine accepts caller-supplied gifter/battle/gift total; does not verify underlying qualifying gifts in that routine. Duplicate key blocks repeat for a gifter+battle, but cannot prove reward entitlement. | 8/10 |
| 6 | 🟡 MEDIUM | [`20290901000011_troll_court_complete_workflow.sql`](../../supabase/migrations/20290901000011_troll_court_complete_workflow.sql) | 1491 onward | `can_cashout(uuid)` publicly callable definer eligibility helper accepts arbitrary user ID; may reveal private restrictions/status. Exact current return fields not fully classified. | 7/10 |

### Status of required candidate functions

| Function | Status | Severity | Evidence / what is not proven |
|---|---|---|---|
| `admin_update_any_profile_field` | **Confirmed** authorization flaw | P0 | Live function and PUBLIC/anon/auth grants confirmed. Body checks provided admin ID, not caller UID. Actual exploit not attempted; admin UUID availability is a precondition. |
| `troll_bank_finalize_cashout` | **Potential** | P0 | Live function and PUBLIC grants confirmed; source migration uses provided admin ID. Direct live-body/state-machine tests not run. |
| `troll_bank_deny_cashout` | **Potential** | P0 | Live function and PUBLIC grants confirmed; checked implementation credits returned balances and has incomplete replay safeguards. Verify exact live body before concluding repeated payout refund. |
| `troll_bank_credit_coins` | **Potential** | P0 | Live function and PUBLIC grants confirmed. It is a privileged credit interface; full live body/source authorization and ledger invariants need staged validation. |
| `add_free_coins` | **Confirmed** | P0 | Live public definer routine; checked implementation increments target `troll_coins` from caller-supplied user and amount. |
| `add_troll_coins` | **Confirmed** | P0 | Live public definer wrapper to `add_free_coins`. |
| `adjust_balance` | **Confirmed** | P0 | Live public definer routine; checked implementation directly adjusts selected user's coins by caller-supplied amount/currency. |
| `issue_first_cashout_match` | **Potential** | P1 | Public definer call confirmed; migration checks paid payout state but caller/admin authorization and actor binding are not established. |
| `reserve_first_cashout_match_slot` | **Potential** | P1 | Public definer call confirmed; caller supplies user, payout ID, qualifying amount; slot consumption/reward impact not tested. |
| `can_cashout` | **Potential** | P1 | Public definer with arbitrary user ID. Exact sensitive output and exploitability not proven in API tests. |
| `award_friday_battle_gifter_bonus` | **Potential** | P1 | Public definer with caller-supplied gift totals; checked migration's idempotency is not evidence that gifts were real. |

**Actual breach:** No evidence of actual compromise was collected. Advisors, grants, and risky code are not proof that anyone used these paths.

## 8. Bypass and attack-surface map

1. **Direct RPC:** `https://<project>/rest/v1/rpc/<function>` with anon or authenticated JWT and ordinary API key. No frontend route is needed. PUBLIC grants confer execution independently of app role.
2. **Forged target/actor arguments:** sensitive RPCs accept IDs and amounts in JSON. Where an actor ID is trusted without comparison to `auth.uid()`, UI checks can be bypassed by substituting the argument. This is a code-level risk; no such request was sent.
3. **Nested calls:** `add_troll_coins` delegates to `add_free_coins`; a public wrapper can expose an otherwise intended internal write.
4. **Edge service role:** Edge route checks are meaningful only on that endpoint. A caller can use the database RPC directly unless the RPC itself enforces equivalent authorization. Service-role code must authenticate, authorize, validate ownership/amount/reference, and then invoke the minimum necessary function.
5. **Repeated requests:** denial/refund and reward paths require idempotent state transitions and uniqueness enforced under row locks/constraints. UI request disabling is not concurrency control.
6. **Storage/Realtime/GraphQL:** these are separate APIs with their own policies. Exact endpoint exposure and bypass status are unknown pending targeted inventory.
7. **Stale/spoofed role claims:** no universal signed-claim/DB profile consistency check was established. Server-side profile lookup in examined Edge routes reduces this risk there, not in unguarded RPCs.

## 9. Production vs migration drift

- Production live history latest row is `20291105000006_officer_name_change_moderation`; current local migration tree includes [`20291105000002_add_admin_update_any_profile_field.sql`](../../supabase/migrations/20291105000002_add_admin_update_any_profile_field.sql), but that version was not in the live history result. The function nevertheless exists in the live catalog. The current body may have been created/changed outside the recorded migration history.
- Local tree has 341 tracked migration SQL files, while production history returned 47 entries. This difference is not itself proof of missing deployment because local tree contains multiple snapshots/branches and multiple migrations may be consolidated. Reconcile migration ledger and deployed definitions before proposing rollout.
- Live `public` counts are 1,184 tables, 17 views, 882 functions; the repository contains migration backups and alternative historical implementations. Do not treat backup trees as active migrations.
- Database includes `pg_cron`, `pg_net`, `pgcrypto`, `uuid-ossp`, PostGIS was not shown in queried extension result. No PostGIS schema change was made.
- Existing local audit artifacts and unrelated untracked files were not edited. In particular, no pre-existing remediation or report was overwritten.

## 10. Test results and staging status

| Test | Identity/path | Expected | Actual | Result |
|---|---|---|---|---|
| Anonymous direct balance credit | Anon JWT → RPC | Denied | Not attempted | **NOT RUN** — no production mutation allowed; staging credentials/schema not verified |
| Regular-user cross-user/admin profile mutation | User JWT → RPC | Denied | Not attempted | **NOT RUN** |
| Direct cashout finalize/deny | Anon/user JWT → RPC | Denied; no payout/balance side effect | Not attempted | **NOT RUN** |
| Fabricated battle gift / cashout match | User JWT → RPC | No reward without verified source | Not attempted | **NOT RUN** |
| Assigned vs unassigned `broadofficer` moderation | Authenticated API → Edge/RPC | Only assigned stream operations succeed | Not attempted | **NOT RUN** |
| Positive signup, streaming, gifting, chat, moderation, cashout | Disposable staging identities | Intended flows work | Not attempted | **NOT RUN** |
| Trigger protection / concurrent replay | Isolated staging only | Invariants hold under repeated calls | Not attempted | **NOT RUN** |
| Production migration/body parity | Read-only catalog | Exact migration/deployed function mapping | Function metadata sampled; full diff absent | **PARTIAL** |

The branch list currently exposes a staging branch and reported it active/functions deployed; it does not establish that the database migrations are complete, isolated, or safe for state-changing tests. The earlier `MIGRATIONS_FAILED` context is therefore **not considered repaired** based solely on branch status. No staging negative tests should be run until project ref, schema version, secrets, seeded disposable identities, and payment sandbox are independently verified.

## 11. Minimal remediation roadmap (proposals only)

No changes or deployments are authorized by this report.

1. **Contain direct financial RPC execution:** for each exact overload, remove PUBLIC/anon direct execution only after mapping all legitimate callers; move admin/system writes behind a trusted Edge/server function; retain only the necessary service role. Set secure default ACLs and explicitly grant each role, including revoking from PUBLIC as needed. Do not assume revoking anon is sufficient.
2. **Bind actor identity:** derive actor from `auth.uid()` inside the database routine, or expose the routine only to a trusted server and assert the server-side actor. Never trust `p_admin_id` without equality to authenticated identity plus role validation.
3. **Balance integrity:** require validated positive amounts and permitted currency/source; verify event/reference against an authoritative source; enforce ledger uniqueness and transaction atomicity; separate paid/refundable accounting; log actor, source, reference, and before/after state.
4. **Cashout state machine:** lock the payout row, validate allowed prior status, ensure provider settlement/refund is authoritative, and make denial/finalization exactly-once with a unique idempotency key. A repeat call must not credit a second refund. Do not use database status alone as proof money transferred.
5. **Promotion/reward integrity:** derive gifter, battle, amounts, and payout from verified persisted rows; lock eligible promotion state; ensure one claim/issue per user and verified event; prevent direct caller-controlled slot consumption.
6. **Profile/admin updates:** validate allowed fields server-side; make role/flag elevation separately authorized; bind actor; ensure target count and audit insertion occur atomically; prevent self-escalation and last-admin lockout.
7. **Complete inventory before rollout:** export exact live function definitions/signatures/ACLs, relation grants/columns, view definitions, RLS policies, trigger enablement, buckets/storage policies, exposed schemas, Realtime, cron jobs, and all Edge routes. Compare against migrations and callers; classify every object.
8. **Staging validation:** repair/recreate an isolated branch without pointing it to production; verify project ref, migrations, JWT identities, and payment sandbox first. Run negative and positive authenticated API tests, duplicate/concurrency tests, then review compatibility. Roll back by redeploying a known-good staged version and restoring only audited grants—never reopen critical PUBLIC grants as a recovery shortcut.

### Compatibility and recovery requirements

Before removing direct grants, migrate every legitimate caller found in `src/` and Edge Functions to a trusted server path. Test rewards, purchases, gifts, admin edits, cashouts, and PayPal handoff with provider mocks. A rollback must restore the prior application version and keep database writes restricted to trusted callers; it must not reinstate arbitrary `PUBLIC` execution. Any production migration requires separate explicit approval.

## 12. Before/after comparison

| Measure | Before / current verified snapshot | After |
|---|---|---|
| Production | Live catalog query; named public definer grants confirmed; no test writes | **AFTER NOT AVAILABLE** — no changes/deployment |
| Staging | Branch exists and reported active/functions deployed; migration readiness not verified | **AFTER NOT AVAILABLE** |
| Actual unauthorized financial mutation | Not attempted | **AFTER NOT AVAILABLE** |
| Role-specific API tests | None | **AFTER NOT AVAILABLE** |

## 13. Coverage/accountability appendix

### Reviewed sources

- Role/UI: [`src/lib/staff.ts`](../../src/lib/staff.ts), [`src/lib/protectedRoles.ts`](../../src/lib/protectedRoles.ts), [`src/hooks/useTCNNRoles.ts`](../../src/hooks/useTCNNRoles.ts), [`src/App.tsx`](../../src/App.tsx)
- Moderation and assignment: [`supabase/functions/moderation-actions/index.ts`](../../supabase/functions/moderation-actions/index.ts), [`supabase/functions/officer-actions/index.ts`](../../supabase/functions/officer-actions/index.ts), [`supabase/migrations/20260809000001_moderation_actions_backend.sql`](../../supabase/migrations/20260809000001_moderation_actions_backend.sql), [`supabase/migrations/20260805000001_create_stream_collaboration_tables.sql`](../../supabase/migrations/20260805000001_create_stream_collaboration_tables.sql)
- Admin/payout: [`supabase/functions/admin-actions/index.ts`](../../supabase/functions/admin-actions/index.ts), [`supabase/functions/paypal-payout/index.ts`](../../supabase/functions/paypal-payout/index.ts), [`supabase/migrations/20291105000002_add_admin_update_any_profile_field.sql`](../../supabase/migrations/20291105000002_add_admin_update_any_profile_field.sql)
- Financial migrations: [`supabase/migrations/20290815000020_unify_paid_coins.sql`](../../supabase/migrations/20290815000020_unify_paid_coins.sql), [`supabase/migrations/20291012000001_bug_center_schema_repairs.sql`](../../supabase/migrations/20291012000001_bug_center_schema_repairs.sql), [`supabase/migrations/20260810000008_fix_cashout_coin_tracking.sql`](../../supabase/migrations/20260810000008_fix_cashout_coin_tracking.sql), [`supabase/migrations/20290901000001_drop_cashout_reserve_columns.sql`](../../supabase/migrations/20290901000001_drop_cashout_reserve_columns.sql), [`supabase/migrations/20260907000001_first_cashout_match_promotion.sql`](../../supabase/migrations/20260907000001_first_cashout_match_promotion.sql), [`supabase/migrations/20260831000001_gift_undo_and_friday_battle.sql`](../../supabase/migrations/20260831000001_gift_undo_and_friday_battle.sql), [`supabase/migrations/20290901000011_troll_court_complete_workflow.sql`](../../supabase/migrations/20290901000011_troll_court_complete_workflow.sql)

### Catalog collection timestamp and query cautions

Collection occurred during this session on **2026-11-06**, around 14:11–14:21 local time. Counts and migration results are snapshots and can change. Function ACL output was evaluated against the current catalog, including PUBLIC inheritance. Advisor output is a lint result, not proof of exploit. No user identifiers, credentials, or payout secrets are included.

### Unresolved questions requiring follow-up

1. What are the exact live function bodies for every overload and their migration/source commit? In particular, diff all 11 named candidates against live definitions.
2. Which of the 109 local Edge functions correspond to the 102 deployed routes, and what are each route's JWT, actor, ownership, and service-role checks?
3. Are all balance-protection triggers enabled, and do any definer RPCs set or bypass their session flags?
4. What exact policy/column grants apply to profiles, financial tables, payout data, private messages, staff records, user exports, and storage?
5. Are `broadcaster`/`broadofficer` assignment rows active in live data, and what exact stream/case scope is enforced in every operation?
6. Is the staging branch fully migrated and isolated after the reported migration failure? Which payment credentials are sandbox-only?
7. Do the admin identity and role flags have an audited, immutable source of truth, and are custom JWT claims refreshed/revoked on role changes?

### Approval boundary

This report contains proposed remediation only. No migrations, grants, triggers, balances, payouts, production objects, or application code were modified. Each remediation requires a separately approved implementation and staged compatibility test.

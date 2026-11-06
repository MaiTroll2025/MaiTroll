# MaiTroll Final Launch Validation

**Disposition: BLOCKED — this report is an evidence-based status snapshot, not launch approval.**

**Evidence date:** 2026-11-06
**Production changes:** None. No migration, financial operation, Edge Function deployment, or other production mutation was performed.

## Executive status

The staging branch is visible in Supabase branch metadata as `security-audit-staging` (`kiqyxuceengctjugavxm`) and reports `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`, with `with_data=false`. This is not database access or evidence of schema health. The active Supabase URL resolves to production (`gejtbllazzighxwxudyu`), and the available SQL tool has no project/branch selector. Therefore no SQL was run against either environment, and the proposed migration has not been validated against staging.

Local verification passed for targeted ESLint, `tsc --noEmit`, `vite build`, and `git diff --check`. Local Supabase lint failed to connect because Postgres was not running at `127.0.0.1:54322`. These checks do not establish database compatibility, authorization, settlement correctness, or feature behavior.

**Acceptance criteria are not met:** no staging API tests were run; multiple previously identified P0 findings are only addressed in an unapplied migration; payout paths still permit non-PayPal direct status updates in source; and temporarily gated features have not been safely restored.

## 1. Previously identified P0 findings

The prior audit is [MAITROLL_COMPLETE_ROLE_ACCESS_SECURITY_AUDIT.md](./MAITROLL_COMPLETE_ROLE_ACCESS_SECURITY_AUDIT.md). Status below distinguishes local source edits from effective deployed remediation.

| Previously identified issue | Local status | Verified remediation status |
|---|---|---|
| Arbitrary balance changes through `add_free_coins`, `add_troll_coins`, and `adjust_balance` | The proposed migration dynamically revokes `PUBLIC`, `anon`, and `authenticated` from matching public overloads and grants `service_role`. Some dependent client paths remain gated; server workflows remain in use. | **Not verified.** Migration unapplied; deployed overload inventory and grants not queried in staging. Call-site compatibility and functional tests are incomplete. |
| Arbitrary credits through `troll_bank_credit_coins` | The proposed migration restricts matching overloads to `service_role`; the dependency matrix lists known PayPal store, restore-license, admin, and legacy callers. | **Not verified.** No staging ACL, nested-call, or feature tests. Direct client helpers and deployed callers are not fully reconciled. |
| Spoofable gift sender through `send_gift_in_stream` and caller-controlled Friday reward source | Local source now routes known frontend gift call sites through a new authenticated `send-gift` Edge Function, which uses the verified auth user as sender. The proposed migration also restricts direct function execution to `service_role`. | **Source mitigation added; not verified.** The function remains exposed until migration deployment, the Edge Function is not deployed, and staging gift/reward tests were not run. |
| Profile/role/flag mutation through `admin_update_any_profile_field` using a caller-supplied administrator ID | The local migration changes the role check to reject missing/invalid admin profiles and restricts direct API-role execution. `admin-actions` authenticates the user and loads their profile before its service-role call. | **Not verified.** Migration unapplied; Edge Function deployment and exact effective grants are unknown. This does not certify every administrative caller. |
| Cashout finalize/deny RPCs callable outside the protected Edge path; repeated refund risk | The local migration restricts direct execution, locks payout rows, constrains state transitions, and makes denial return early for already-denied states. | **Not verified.** No staging replay/concurrency tests. `admin-actions` also contains a direct `update_payout_status` write that can set a payout to `paid` without invoking the PayPal verifier; [admin-actions/index.ts](../../supabase/functions/admin-actions/index.ts). |

The previous audit also identified P1 risks for caller-supplied promotion/battle reward inputs and `can_cashout` status disclosure. The proposed migration restricts reward RPCs to `service_role` and binds authenticated `can_cashout` calls to `auth.uid()`, but neither change has been applied or tested. Payout finalization currently accepts no provider settlement evidence as an RPC argument; the PayPal Edge workflow performs a PayPal status lookup before calling it, but the database function itself cannot independently prove that lookup occurred.

## 2. Temporarily disabled features

None of these features has been safely restored with a complete server-side, actor-validated, source-verified, atomic, idempotent replacement:

| Feature | Current local state | Safe restoration |
|---|---|---|
| Coin tips during broadcasts | Client path returns an unavailable result before attempting charge/credit. | **Not restored.** Existing client sequence deducts and credits in separate operations and is not an atomic settlement path. |
| Paid profile views and paid messages | Positive-cost operations return an unavailable result. | **Not restored.** No atomic transfer RPC/Edge replacement or staging test. |
| Paid property purchases | Client purchase path is blocked. | **Not restored.** No seller-ownership and atomic buyer/seller settlement replacement verified. |
| Family call-minute purchases | Purchase path is blocked. | **Not restored.** Existing client flow debits separately from the family-minute RPC and attempts a separate refund on failure. |
| Paid Academy enrollment | Paid enrollment is blocked. | **Not restored.** No server-side enrollment-and-charge transaction verified. |
| Paid tournament withdrawal fallback | Unsafe client-side fallback is blocked; the primary RPC remains the intended path. | **Not restored/verified.** No proof that the primary RPC covers all deployments or tests of refund/rejoin behavior. |
| Client navigation coin rewards | `grantNavCoins` no longer issues client-side coin credits. | **Not restored.** Eligibility and server-side reward source are not implemented/verified. |
| Level-up coin rewards | Client level-up coin awards are removed; XP/level UI updates remain client-side. | **Not restored.** No server-validated XP progression/reward flow verified. |

These are safety restrictions, not a feature-complete remediation. Do not remove them until each replacement is implemented and passes staging tests.

## 3. Staging test outcomes

| Test area | Outcome | Evidence |
|---|---|---|
| Staging identity and branch metadata | **Partial metadata only** | Branch listing returned the staging ref and `with_data=false`; it did not provide database health or isolation evidence. |
| Staging schema, migrations, functions, grants, RLS, triggers, extensions | **Not run** | Available Supabase SQL context resolves to production and cannot target the branch. No database query was executed. |
| Anonymous / regular user / broadcaster / broadofficer / moderator / administrator / service-role API tests | **Not run** | No staging identities or staging API target were available. |
| Negative RPC tests and overload-specific permission checks | **Not run** | Migration is unapplied; no staging endpoint tests or catalog checks. |
| Financial happy-path, replay, and concurrency tests | **Not run** | No staging financial mutation or provider callback test was executed. |
| Website, Android, and iOS workflow regression | **Not run** | Build validates the web bundle only; mobile workflows and end-to-end behavior were not tested. |
| Local TypeScript and web build checks | **Passed** | Targeted ESLint, `tsc --noEmit`, and `vite build` completed successfully. |
| Local database lint | **Not run successfully** | `supabase db lint --local --schema public --fail-on error` could not connect to local Postgres at `127.0.0.1:54322`. |
| Diff whitespace validation | **Passed** | `git diff --check` returned no errors. |

No test in this table is a staging security pass.

## 4. RPC permissions and known dependent paths

The local migration intends to revoke `PUBLIC`, `anon`, and `authenticated` privileges for every matching overload of the following names, then grant execution to `service_role`:

`add_free_coins`, `add_paid_coins`, `add_troll_coins`, `adjust_balance`, `troll_bank_credit_coins`, `admin_grant_coins`, `admin_update_any_profile_field`, `troll_bank_finalize_cashout`, `troll_bank_deny_cashout`, `reserve_first_cashout_match_slot`, `issue_first_cashout_match`, `award_friday_battle_gifter_bonus`, and `send_gift_in_stream`.

`can_cashout(uuid)` is separately intended to be executable by `authenticated` and `service_role`, but not `PUBLIC` or `anon`; authenticated callers are restricted to their own user ID.

Known source call paths are recorded in [MAITROLL_RPC_DEPENDENCY_MATRIX.csv](./MAITROLL_RPC_DEPENDENCY_MATRIX.csv). Examples include:

- `admin-actions` → `troll_bank_credit_coins`, `admin_update_any_profile_field`, `troll_bank_deny_cashout`.
- `paypal-payout` → `troll_bank_finalize_cashout` after querying the PayPal payout batch.
- Nested cashout flow → `reserve_first_cashout_match_slot`.
- Nested payout finalization → `issue_first_cashout_match`.
- Gift-processing SQL → `award_friday_battle_gifter_bonus`.
- PayPal store fulfillment and restore-license → `troll_bank_credit_coins`.
- Gift clients → new `send-gift` Edge Function → `send_gift_in_stream` with sender set from the verified JWT; deployed permission changes still required.
- Client helpers and feature modules → balance RPCs and the currently gated features.

This is a **known-call-path inventory, not an exhaustive dependency proof**. The report does not establish deployed function overloads, grants, function-owner privileges, triggers, cron/job callers, external integrations, or whether every listed path still works after the revocations. In particular, legitimate nested SQL calls and service-role integrations need staging tests before these permissions can be treated as final.

## 5. Edge Function risks

Deployment metadata in [MAITROLL_EDGE_FUNCTION_SECURITY_MATRIX.csv](./MAITROLL_EDGE_FUNCTION_SECURITY_MATRIX.csv) lists 102 active deployed functions, 68 reporting `verify_jwt=false`. This is configuration metadata only; it neither proves exploitability nor establishes handler-level authorization. Handler review and negative tests for those 68 functions are incomplete.

Read-only source review identified high-confidence unauthenticated service-role paths in `ghost-mode` (client-supplied CEO ID), `publish-social` (publishing through any active connected account), and `generate-ad` (provider-backed campaign generation). Local handlers now require a verified bearer user and an admin/lead-officer check for publishing and ad generation; ghost mode derives the actor from the verified JWT. `send-gift` was added as an authenticated server route and known frontend gift RPC callers now use it; the SQL migration also intends to make the underlying RPC service-role-only. These source fixes are **not deployed or negatively tested**. Existing admin coin-grant UI/helper paths still call `add_free_coins` or `admin_grant_coins` directly and will fail for ordinary API roles if the migration is applied; they need authorized server routing before release.

The following high-impact areas remain unverified:

- Maintenance and cleanup endpoints, including stream and review-account cleanup functions.
- Content and social-publishing endpoints, including Facebook publishing/OAuth and `publish-social`.
- Identity-sensitive and role-sensitive endpoints, including guest identity, ghost mode, account deletion, admin, moderation, payroll, and celebrity cashout flows.
- Webhooks and payment callbacks, including PayPal, Square, and Printify signature/settlement validation.
- Scheduler/cron endpoints, secret rotation, rate limits, suspension/expiry enforcement, and alternate endpoint paths.

The matrix marks handler authorization, ownership/scope, secret/signature checks, and negative tests as not reviewed/not run. No claim is made that any specific `verify_jwt=false` function is exploitable.

## 6. Financial reconciliation and idempotency

No financial reconciliation, ledger-to-profile comparison, duplicate callback test, payout replay test, or concurrent refund/reward test was performed. No money or coin operation was initiated.

The proposed migration adds local row-lock/state checks for cashout denial/finalization, serializes first-cashout slot reservations, makes promotion issuance idempotent, and locks Friday-battle bonus issuance by gifter/battle. These are source changes only. They do not prove source-event eligibility or idempotency against deployed constraints and existing data.

The PayPal Edge workflow checks PayPal batch status before its normal finalization call. However:

- `admin-actions` has a separate `update_payout_status` action that directly updates `payout_requests.status`, including allowing `paid` with a caller-provided payment reference.
- `troll_bank_finalize_cashout` accepts no PayPal batch ID or independently verifiable settlement evidence.
- The end-to-end ordering of PayPal status lookup, persisted provider reference, payout status, ledger entries, and idempotent retries has not been tested.

Accordingly, authoritative settlement enforcement and duplicate-payout/refund prevention are **not certified**.

## 7. Production migration order, monitoring, and recovery

No production deployment is approved or requested. If deployment is later approved, use this gated order:

1. Establish an explicitly selected staging project/branch and prove project ref, isolated provider credentials, disposable identities, and migration state. Never run a staging test through a production-bound tool.
2. Reconcile all 340 local migration files with the 47 previously observed production history rows; inspect drift and deployed function definitions before resolving migration order.
3. Validate the proposed migration against the exact staging schema, including every targeted overload, columns, enum/status values, triggers, extensions, ownership, nested SQL call paths, and grants.
4. Apply to staging only, then run anonymous and role-specific denial tests plus legitimate functional, replay, concurrency, PayPal settlement, ledger reconciliation, and web/mobile regression tests.
5. Replace each temporary gate with its tested server workflow. Verify all callers of revoked functions and update the dependency matrix with evidence.
6. Require owner approval and a verified pre-deployment backup before any production change. No action in this task satisfies that approval.
7. Deploy in reviewed migration order, then monitor RPC authorization failures, Edge errors, payout state/provider-reference mismatches, duplicate transaction keys, coin-ledger/profile-balance deltas, promotion slots/claims, reward budgets, and feature error rates.

Recovery must be forward-only and preserve the security boundary. Stop affected financial workflows and keep unsafe features gated on errors; reconcile pending provider batches and ledger entries before retrying. Use a reviewed corrective migration or restore from a verified backup. **Do not restore broad `PUBLIC`/`anon` execution grants as a rollback shortcut.**

## 8. Remaining launch blockers

- Staging database access and isolation have not been verified.
- The local migration is unapplied and has not been parsed against the target schema.
- Production/local migration drift is unreconciled.
- Effective RPC grants and all overload/dependent call paths are unverified.
- The direct admin payout-status update path can bypass PayPal settlement verification.
- Temporarily disabled features lack safe server-side replacements.
- Edge Function handlers and the 68 `verify_jwt=false` configurations have not been fully reviewed.
- Admin coin-grant frontend/helper call sites still call restricted RPCs directly.
- The new `send-gift` route, migration grants, and all modified Edge Functions remain local and unverified against deployment configuration.
- Required role-specific staging API, financial, idempotency, concurrency, and website/Android/iOS tests have not run.
- Financial reconciliation, monitoring, backup, and recovery readiness have not been demonstrated.

**Launch decision: BLOCKED.** The current evidence cannot establish the required standard of no unresolved exploitable P0 issues and passing tests for every essential feature.

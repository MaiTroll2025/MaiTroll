# MaiTroll Final Launch Validation

**Disposition: BLOCKED — this report is an evidence-based status snapshot, not launch approval.**

**Evidence date:** 2026-11-06
**Production changes:** Four Edge Functions remain deployed (`send-gift` v1, `ghost-mode` v44, `publish-social` v44, `generate-ad` v44; all `verify_jwt=true`). Mistaken migration-tool calls in prior work and this session recorded comment-only no-op entries, including `20261106223858/harden_financial_rpc_authorization` and entries submitted as `noop-test-undo-attempt`; reconcile their exact versions and names from production migration history. No application tables, functions, grants, or triggers were intentionally changed by those comments. The user waived staging validation and authorized direct production migration application. A CLI deployment attempt for `paypal-payout` returned HTTP 403 (insufficient privileges); MCP deployment attempts failed because the uploaded entrypoint was missing. No Edge Function deployment occurred in this turn.

## Executive status

The staging branch is visible in Supabase branch metadata as `security-audit-staging` (`kiqyxuceengctjugavxm`) and reports `FUNCTIONS_DEPLOYED` / `ACTIVE_HEALTHY`, with `with_data=false`. This is not database access or evidence of schema health. The available SQL tool is production-bound (`gejtbllazzighxwxudyu`) and has no project/branch selector. The user waived staging validation; only read-only production catalog/schema queries have been run, and the proposed migration has not been applied.

Local verification passed for targeted ESLint, `tsc --noEmit`, and `git diff --check`. Local Supabase lint failed to connect because Postgres was not running at `127.0.0.1:54322`. These checks do not establish database compatibility, authorization, settlement correctness, or feature behavior.

**Acceptance criteria are not met:** no staging or production API tests were run; multiple previously identified P0 findings are only addressed in unapplied local changes; the production RPC permission changes are absent; payout-path fixes are not deployed; and temporarily gated features have not been safely restored. Read-only production ACL inspection also confirmed direct `anon`/`authenticated` execution on the inspected financial RPCs, while source review found frontend call sites that would lose access if the proposed grants were applied before their replacements ship. The latest local review found payout-schema drift between checked-in migrations and the production snapshot; the draft now supports either known provider column name and conditionally updates the legacy reserve column only when present.

## 1. Previously identified P0 findings

The prior audit is [MAITROLL_COMPLETE_ROLE_ACCESS_SECURITY_AUDIT.md](./MAITROLL_COMPLETE_ROLE_ACCESS_SECURITY_AUDIT.md). Status below distinguishes local source edits from effective deployed remediation.

| Previously identified issue | Local status | Verified remediation status |
|---|---|---|
| Arbitrary balance changes through `add_free_coins`, `add_troll_coins`, and `adjust_balance` | The proposed migration dynamically revokes `PUBLIC`, `anon`, and `authenticated` from matching public overloads and grants `service_role`. | **Not remediated in production.** Production inspection confirmed direct `anon`/`authenticated` execution on the inspected RPCs. The migration is unapplied; frontend callers in profile-view payment, property sale, and admin-grant flows still need authorized replacements. |
| Arbitrary credits through `troll_bank_credit_coins` | The proposed migration restricts matching overloads to `service_role`; current SQL implementation trusts the caller-supplied user, amount, bucket, source, and reference. | **Not remediated in production.** Production inspection confirmed direct `anon`/`authenticated` execution. Browser code still calls this RPC through shared coin-recording helpers; no source-specific replacement or compatibility test is complete. |
| Spoofable gift sender through `send_gift_in_stream` and caller-controlled Friday reward source | Known frontend gift call sites route through `send-gift`, deployed as production v1 with JWT verification. The local migration intends to restrict direct RPC execution to `service_role` and require a matching same-transaction `gift_sent` event for a Friday-battle award. | **Partially mitigated, not verified.** The previous read-only catalog check found direct execution grants; the no-op migration did not change them. The source-event check is a local SQL change only; no gift/reward replay tests were run. |
| Profile/role/flag mutation through `admin_update_any_profile_field` using a caller-supplied administrator ID | The local migration changes the role check to reject missing/invalid admin profiles and restricts direct API-role execution. `admin-actions` authenticates the user and loads their profile before its service-role call. | **Not verified.** Migration unapplied; Edge Function deployment and exact effective grants are unknown. This does not certify every administrative caller. |
| Cashout finalize/deny RPCs callable outside the protected Edge path; repeated refund risk | Local changes now require a validated admin actor for deny/finalize, require a PayPal batch ID for finalization, lock payout rows, and guard direct `paid` status updates with a database trigger. The local `paypal-payout` calls the verified-batch overload, and `admin-actions` routes denials through the refund RPC and rejects direct `paid` updates. | **Not verified or deployed.** Production catalog checks show the existing cashout RPCs remain executable by `anon` and `authenticated`. Updated SQL and Edge Function sources need staging validation and deployment; no payout replay/concurrency test was run. |

The previous audit also identified P1 risks for caller-supplied promotion/battle reward inputs and `can_cashout` status disclosure. The unapplied migration restricts reward RPCs to `service_role` and binds authenticated `can_cashout` calls to `auth.uid()`. The revised finalization overload accepts a PayPal batch ID, checks it against any stored reference, and relies on the service-role-only PayPal Edge workflow to query PayPal for `SUCCESS` before calling it. This provider check is not independently performed by PostgreSQL; the database trigger prevents other database/API update paths from marking a payout paid without the transaction-local finalization guard.

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
| Staging schema, migrations, functions, grants, RLS, triggers, extensions | **Not run** | The available SQL context has no branch selector. Production-only read-only checks found the target RPCs still callable by `anon`/`authenticated`, no installed PostGIS extension or spatial columns, and the no-op migration ledger row. |
| Anonymous / regular user / broadcaster / broadofficer / moderator / administrator / service-role API tests | **Not run** | No staging identities or staging API target were available. |
| Negative RPC tests and overload-specific permission checks | **Not run** | The migration is unapplied; production ACL metadata was inspected, but no staging endpoint tests were possible. |
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
- Gift clients → deployed `send-gift` Edge Function → `send_gift_in_stream` with sender set from the verified JWT; underlying database permission changes are still required.
- Client helpers and feature modules → balance RPCs and the currently gated features.

This is a **known-call-path inventory, not an exhaustive dependency proof**. The report does not establish deployed function overloads, grants, function-owner privileges, triggers, cron/job callers, external integrations, or whether every listed path still works after the revocations. In particular, legitimate nested SQL calls and service-role integrations need staging tests before these permissions can be treated as final.

## 5. Edge Function risks

Deployment metadata in [MAITROLL_EDGE_FUNCTION_SECURITY_MATRIX.csv](./MAITROLL_EDGE_FUNCTION_SECURITY_MATRIX.csv) lists 102 active deployed functions, 68 reporting `verify_jwt=false`. This is configuration metadata only; it neither proves exploitability nor establishes handler-level authorization. Handler review and negative tests for those 68 functions are incomplete.

Read-only source review identified high-confidence unauthenticated service-role paths in `ghost-mode` (client-supplied CEO ID), `publish-social` (publishing through any active connected account), and `generate-ad` (provider-backed campaign generation). Updated handlers for all three and the `send-gift` route are deployed with `verify_jwt=true`. They have not been negatively tested against staging. The financial `admin-actions` and `paypal-payout` changes described above are local only. Existing admin coin-grant UI/helper paths still call `add_free_coins` or `admin_grant_coins` directly and will fail for ordinary API roles if the migration is applied; they need authorized server routing before release.

The following high-impact areas remain unverified:

- Maintenance and cleanup endpoints, including stream and review-account cleanup functions.
- Content and social-publishing endpoints, including Facebook publishing/OAuth and `publish-social`.
- Identity-sensitive and role-sensitive endpoints, including guest identity, ghost mode, account deletion, admin, moderation, payroll, and celebrity cashout flows.
- Webhooks and payment callbacks, including PayPal, Square, and Printify signature/settlement validation.
- Scheduler/cron endpoints, secret rotation, rate limits, suspension/expiry enforcement, and alternate endpoint paths.

The newly added `mai-calendar-reminders` endpoint is configured with `verify_jwt=false`; its local handler now requires a dedicated `MAI_CALENDAR_CRON_SECRET` bearer token (minimum 32 characters), and the calendar migration limits reminder-delivery writes to the service-role backend. The secret has not been provisioned and the function/migration have not been deployed, so the scheduler workflow is not live or validated.

The matrix marks handler authorization, ownership/scope, secret/signature checks, and negative tests as not reviewed/not run. No claim is made that any specific `verify_jwt=false` function is exploitable.

## 6. Financial reconciliation and idempotency

No financial reconciliation, ledger-to-profile comparison, duplicate callback test, payout replay test, or concurrent refund/reward test was performed. No money or coin operation was initiated. Production read-only ACL checks found the listed financial RPCs still executable by `anon` and `authenticated`, confirming the no-op did not harden permissions.

The local migration adds row-lock/state checks for cashout denial/finalization, serializes first-cashout slot reservations, makes promotion issuance idempotent, and locks Friday-battle bonus issuance by gifter/battle. It also requires a same-transaction gift ledger row matching the gifter, battle stream, amount, and gift identifier. Finalization reads `payment_method` or `provider_type` from the payout row and updates the legacy `cashout_reserved_coins` column only when it exists, accommodating the known schema variants without static references to absent fields. These are source changes only; none has been validated against production mutations or role-specific API tests.

The local PayPal Edge workflow checks PayPal batch status before its normal finalization call. Production currently reports `paypal-payout` version 48 with `verify_jwt=false`; its deployed handler source uses its own bearer-token and admin-profile checks. The CLI deployment attempt for the updated source was denied with HTTP 403; the current local version is not deployed. In addition:

- Production still has the old `admin-actions` direct `paid` update path until the updated function is deployed; local source now rejects it.
- The production `troll_bank_finalize_cashout` still accepts no PayPal batch ID until the repaired migration is deployed; local source adds a batch-ID overload and disables the old overload.
- The local PayPal workflow now passes the provider batch ID to finalization and no longer performs a second non-atomic `paid` update, but this end-to-end ordering and retry behavior have not been tested.

Accordingly, authoritative settlement enforcement and duplicate-payout/refund prevention are **not certified**.

## 7. Production migration order, monitoring, and recovery

The user explicitly authorized direct production migration application after waiving staging validation. No corrective migration or updated payout/admin function has yet been applied or deployed. Inspection found a malformed dynamic grant signature in the draft migration; it has been corrected to use argument types and the SQL parser now accepts the file. The draft still must not be applied until the remaining client call paths and Friday-battle source-event validation are addressed.

1. Reconcile local migrations with production history. The no-op remains recorded as `20261106223858/harden_financial_rpc_authorization`; use a uniquely named corrective migration and do not retry that name.
2. Replace every affected direct frontend RPC call with an authorized, source-specific server workflow. Update the dependency matrix and test each replaced feature, including the new Friday-battle source-event check.
3. Validate every referenced production column, overload, trigger, function dependency, and effective grant. Staging validation was waived; do not describe production SQL parsing or metadata inspection as functional validation.
4. Deploy the reviewed `paypal-payout` and `admin-actions` sources using an authorized deployment path, then verify active versions and JWT/handler authentication behavior.
5. Run authorized API tests for denied direct RPC access and legitimate server workflows, including replay/concurrency and PayPal settlement cases, before treating the migration as production-ready.
6. Confirm a verified backup and approved operator window before application; the prior user authorization permits the migration but does not establish feature compatibility or passing tests.
7. After deployment, monitor RPC authorization failures, Edge errors, payout state/provider-reference mismatches, duplicate transaction keys, coin-ledger/profile-balance deltas, promotion slots/claims, reward budgets, and feature error rates.

Recovery must be forward-only and preserve the security boundary. Stop affected financial workflows and keep unsafe features gated on errors; reconcile pending provider batches and ledger entries before retrying. Use a reviewed corrective migration or restore from a verified backup. **Do not restore broad `PUBLIC`/`anon` execution grants as a rollback shortcut.**

## 8. Remaining launch blockers

- Staging database access and isolation have not been verified.
- The local migration repair is unapplied and has not been parsed against staging. The migration history contains the known no-op row with the same original name plus comment-only entries submitted as `noop-test-undo-attempt`; their exact ledger versions still need reconciliation.
- Production/local migration drift is unreconciled.
- Effective RPC grants and all overload/dependent call paths are unverified.
- Applying the current draft before replacement work would break existing direct frontend calls to restricted credit/admin RPCs.
- Friday-battle reward source-event verification has only a local implementation; it has not been exercised against a real nested gift transaction.
- Production still has the direct admin payout-status update path until the modified `admin-actions` function and payout migration are deployed. The local PayPal handler now rejects non-PayPal payout requests using `provider_type`, but it is not deployed.
- Temporarily disabled features lack safe server-side replacements.
- Edge Function handlers and the 68 `verify_jwt=false` configurations have not been fully reviewed.
- Admin coin-grant frontend/helper call sites still call restricted RPCs directly.
- The gift and three prior security Edge Functions are deployed, but the database grants remain unsafe; updated payout/admin Edge Functions remain local and unverified.
- The attempted CLI deployment of `paypal-payout` was rejected with HTTP 403; no function was deployed through the separate Supabase deployment tool.
- Required role-specific staging API, financial, idempotency, concurrency, and website/Android/iOS tests have not run.
- Financial reconciliation, monitoring, backup, and recovery readiness have not been demonstrated.

**Launch decision: BLOCKED.** The current evidence cannot establish the required standard of no unresolved exploitable P0 issues and passing tests for every essential feature.

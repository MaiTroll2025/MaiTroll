# MaiTroll Security Remediation Plan

**Status: in progress; not a launch approval**

## Environment and evidence

- The local Supabase config and current Supabase MCP URL identify production ref `gejtbllazzighxwxudyu`.
- Supabase branch listing shows `security-audit-staging` (`kiqyxuceengctjugavxm`) as `ACTIVE_HEALTHY`, `with_data=false`. This confirms branch metadata only; its schema, migration history, test users, secrets, and external-service isolation were not verified.
- The MCP database tools available in this session were bound to production. No database changes, financial calls, test writes, or production backup were performed.
- Production migration history returned 47 rows; the checkout has 340 migration files. At least `20291105000002_add_admin_update_any_profile_field.sql` is local but absent from the queried history. Full reconciliation is still required.
- A read-only live/source audit is recorded in [MAITROLL_COMPLETE_ROLE_ACCESS_SECURITY_AUDIT.md](./MAITROLL_COMPLETE_ROLE_ACCESS_SECURITY_AUDIT.md). Its findings were not re-exploited in this task.

## Implemented locally, not applied

Migration [`20291106000002_harden_financial_rpc_authorization.sql`](../../supabase/migrations/20291106000002_harden_financial_rpc_authorization.sql):

- Restricts direct execution of balance-creation, admin-grant/profile, payout-transition, and promotion-award RPCs to `service_role`; security-definer callers and server workflows remain the intended paths.
- Fixes the NULL administrator-ID check in `admin_update_any_profile_field`.
- Binds `can_cashout(uuid)` to the authenticated caller's own account, except for trusted service-role calls.
- Derives promotion reservation amounts from the persisted payout, serializes slot reservations, makes reward issuance and payout denial/finalization idempotent under row locks, and rejects invalid state transitions.
- Serializes Friday battle bonus issuance by gifter/battle.

Client-only credit paths that do not yet have a verified server-side settlement flow were temporarily restricted in the UI to avoid charging users before an untrusted or unavailable credit. The specific affected features are listed in [MAITROLL_SECURITY_TEST_RESULTS.md](./MAITROLL_SECURITY_TEST_RESULTS.md).

## Required before release

1. Reconcile every local and production migration version and inspect the deployed definitions before applying this migration.
2. Connect the approved Supabase tools to staging and verify its schema, grants, function bodies, RLS, triggers, extensions, migration history, disposable identities, and provider/scheduler isolation.
3. Replace the temporary client restrictions with source-validated, atomic server workflows; do not re-enable client-side balance credits.
4. Review the deployed Edge Functions individually, including handler authorization and deployment JWT configuration.
5. Run the role-specific negative, regression, replay, and concurrency tests in isolated staging and record actual results.
6. Prepare backup, monitoring, recovery, and owner-approval steps. No production deployment is authorized by this report.

## Release disposition

**Not ready for staging deployment or public launch.** The migration has not been applied or validated against a database. Staging isolation and migration health are unverified, direct client credit replacements are incomplete, and Edge Function review and end-to-end tests remain outstanding.

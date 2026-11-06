# MaiTroll Security Test Results

**Status: staging tests not run; no result below is a security pass.**

## Environment checks

| Check | Result | Evidence / limitation |
|---|---|---|
| Current production project identification | Observed | Local `project_id` and Supabase MCP project URL resolve to ref `gejtbllazzighxwxudyu`. |
| Staging branch existence/status | Observed, partial | `security-audit-staging` (`kiqyxuceengctjugavxm`) is listed `ACTIVE_HEALTHY`, `with_data=false`; this is branch metadata, not database health or isolation proof. |
| Staging schema, functions, grants, policies, triggers, extensions | Not tested | Available SQL tooling was bound to production; no staging database query was run. |
| Staging migration history | Not tested | Production returned 47 migration rows; local checkout has 340 files. The full diff is not reconciled. |
| Payment, LiveKit, push, scheduler and webhook isolation | Not tested | No staging secrets/configuration or outbound effects were inspected. |
| Production backup / balance snapshot | Not performed | No backup or balance data was read or exported. |

## Changes and local checks

- Added a local migration that restricts listed financial/admin RPCs, adds actor and state checks, and serializes cashout/promotion transitions. It has **not** been applied to any database.
- Temporarily disabled client-only coin issuance and gated unverified paths that could otherwise debit a user before a direct client credit is rejected: navigation rewards, level-up coin awards, coin tips, paid profile views/messages, paid property purchases, paid family-minute purchases, paid Academy enrollment, and paid tournament-withdraw fallback.
- These restrictions are intentional safety gates, not verified feature-preserving replacements. Re-enable them only after their server-side source verification and atomic settlement paths pass staging tests.
- No HTTP/API security-negative test, financial mutation, concurrency test, provider callback test, or cross-role regression test was run.
- `git diff --check`, targeted ESLint on modified TypeScript files, `tsc --noEmit`, and `vite build` passed.
- `supabase db lint --local --schema public --fail-on error` could not run because no local Postgres was listening on `127.0.0.1:54322`. The migration has not been validated by a database parser or against staging.
- No focused application test script was run.

## Required staging tests

Use real staging identities and verify side effects, not only response codes. Cover unauthenticated and ordinary-user attempts against every restricted RPC; self-versus-other `can_cashout`; admin ID spoofing and missing IDs; payout approval/finalization/denial replay and concurrency; promotion source validation, claim duplication, and slot exhaustion; Friday bonus source validation and duplicate concurrency; and all features temporarily gated above.

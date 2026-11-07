# Security Review

**Date:** 2026-10-05

## Anonymous Access Review

**Review date:** 2026-11-06  
**Scope:** Anonymous (`anon`) access only  
**Status:** Source-based review; production application of every migration and deployed function version still requires live Supabase verification.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🔴 CRITICAL | `migrations/20260819_create_treelz_missing_functions.sql` | 57-88, 106-107 | `send_treelz_tip` is `SECURITY DEFINER`, callable by `anon`, trusts caller-supplied sender IDs, and accepts negative amounts. | 10/10 |
| 2 | 🟠 HIGH | `migrations/20260109_create_payment_logs.sql` | 73-81, 111-145 | Anonymous clients can insert/update payment logs under permissive RLS; completing a forged record can affect financial aggregates. | 9/10 |
| 3 | 🟠 HIGH | `supabase/migrations/20260816000001_fix_user_profiles_public_read.sql` | 12-16 | Anonymous access can select every column from `user_profiles`, including sensitive identity, payout, tax, balance, and security fields. | 9/10 |
| 4 | 🟠 HIGH | `supabase/migrations/20260810000009_enforce_stream_seat_limit.sql` | 9-11, 51-112, 120 | Anonymous callers can supply another user’s ID to `join_seat_atomic`, potentially charging that user and creating a seat session as them. | 9/10 |

### Anonymous public surface

Public routes include home, profiles, calendar/events, podcasts, gaming, Treelz, court, broadcasts, watch/live/stream pages, and MaiTroll Run. Anonymous LiveKit audience tokens are intentionally supported; publisher access still requires authentication.

The reviewed source also exposes anonymous-callable functions/RPCs for guest-seat identity, bug reports, viewer tokens/tracking, Treelz operations, e-paper reads, signal logging, global event insertion, and IP-block checks. Their production behavior requires verification against deployed function versions and live grants.

### Recommended remediation

1. Revoke `anon` execution on `send_treelz_tip` and `join_seat_atomic`; derive actor identity from `auth.uid()` or use a server-issued guest identity.
2. Remove anonymous table writes to `payment_logs`; accept payment completion only through validated webhook/service workflows.
3. Revoke anonymous reads from the base `user_profiles` table and expose a restricted public-profile view with only safe fields.
4. Verify live production grants, RLS policies, deployed Edge Function versions, and financial aggregate triggers before re-enabling affected flows.

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [20261005000011_enforce_shared_user_restrictions.sql](./supabase/migrations/20261005000011_enforce_shared_user_restrictions.sql) | 3-10, 21-39, 87 | Authenticated callers may pass another user's UUID to a `SECURITY DEFINER` RPC and retrieve their restriction status and moderation details, including restriction reason and source report ID. | 9/10 |

### Details

The RPC accepts a caller-supplied user ID, runs with elevated privileges, and is executable by the `authenticated` role without verifying that the requested ID belongs to the caller or that the caller is authorized staff. The related `user_is_restricted(UUID, TEXT)` helper also accepts arbitrary user IDs and is executable by authenticated users. This can expose another user's restriction status and moderation information, bypassing the self-or-staff access restriction on `user_restrictions` in [20261005000009_central_user_restrictions.sql](./supabase/migrations/20261005000009_central_user_restrictions.sql).

**Recommended remediation:** Limit these RPCs to the caller's own UUID or authorized staff, and return only information appropriate for the caller's authorization level.

**Remediation added:** Migration [20261005000012_restrict_user_restriction_rpcs.sql](./supabase/migrations/20261005000012_restrict_user_restriction_rpcs.sql) adds caller/staff/service-role authorization checks to both RPCs and removes anonymous/public execution. The migration must be applied to each deployed Supabase project for the fix to take effect.

## Frontend UUID/auth UID exposure check

No explicit display of a user's profile UUID or auth UID was found in the reviewed frontend surfaces. UUIDs are included in data returned for visible content, such as `creator_id` from `search_maipiks_by_hashtag` and `user_id` selected by the phone feed. These content-associated identifiers were not considered a vulnerability by themselves; UUIDs are identifiers, not authentication credentials. The explicit Go Live action was excluded from the UI display review.

## Scope and limitations

The review covered current worktree changes, including the MAI Piks migrations and Edge Functions, restriction-related RPCs, and relevant profile, admin, phone, and search frontend surfaces. No requests were run against a live Supabase project, and deployed policies and grants were not verified. Findings are based on checked-in code and SQL grants; this document does not assert that the reported RPCs are deployed.

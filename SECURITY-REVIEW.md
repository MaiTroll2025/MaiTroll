# Security Review

**Date:** 2026-10-05

## Findings

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | [20261005000011_enforce_shared_user_restrictions.sql](./supabase/migrations/20261005000011_enforce_shared_user_restrictions.sql) | 3-10, 21-39, 87 | Authenticated callers may pass another user's UUID to a `SECURITY DEFINER` RPC and retrieve their restriction status and moderation details, including restriction reason and source report ID. | 9/10 |

### Details

The RPC accepts a caller-supplied user ID, runs with elevated privileges, and is executable by the `authenticated` role without verifying that the requested ID belongs to the caller or that the caller is authorized staff. The related `user_is_restricted(UUID, TEXT)` helper also accepts arbitrary user IDs and is executable by authenticated users. This can expose another user's restriction status and moderation information, bypassing the self-or-staff access restriction on `user_restrictions` in [20261005000009_central_user_restrictions.sql](./supabase/migrations/20261005000009_central_user_restrictions.sql).

**Recommended remediation:** Limit these RPCs to the caller's own UUID or authorized staff, and return only information appropriate for the caller's authorization level.

## Frontend UUID/auth UID exposure check

No explicit display of a user's profile UUID or auth UID was found in the reviewed frontend surfaces. UUIDs are included in data returned for visible content, such as `creator_id` from `search_maipiks_by_hashtag` and `user_id` selected by the phone feed. These content-associated identifiers were not considered a vulnerability by themselves; UUIDs are identifiers, not authentication credentials. The explicit Go Live action was excluded from the UI display review.

## Scope and limitations

The review covered current worktree changes, including the MAI Piks migrations and Edge Functions, restriction-related RPCs, and relevant profile, admin, phone, and search frontend surfaces. No requests were run against a live Supabase project, and deployed policies and grants were not verified. Findings are based on checked-in code and SQL grants; this document does not assert that the reported RPCs are deployed.

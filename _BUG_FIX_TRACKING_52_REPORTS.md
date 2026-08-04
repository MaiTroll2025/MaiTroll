# Mai Troll Bug Fix Tracking - 52 Report Export (2026-06-27)

## Summary

| Category | Count | Fix Type |
|----------|-------|----------|
| Database (SQL migration) | 8 | ✅ `20260627000001_fix_database_bugs_from_report_export.sql` |
| Frontend (React/TS code) | 38 | 🔧 Requires source edits |
| Infrastructure/Auth | 4 | ⚠️ Config or deployment |
| External (LiveKit) | 2 | ℹ️ SDK-level |

---

## Database Bugs (Fixed via Migration — Schema-Verified)

| Bug # | Error | Route | Fix Applied |
|-------|-------|-------|-------------|
| 1 | `get_user_conversations_optimized` not in schema cache | /jail | Created function wrapper using `conversation_members` + `messages` tables |
| 2 | `42P10` ON CONFLICT constraint | /home | Added `UNIQUE(follower_id, following_id)` on `user_follows` + dedup |
| 6 | `record "new" has no field "recipient_id"` | /utromail | Auto-detect broken triggers, replace `recipient_id`→`receiver_id` |
| 7 | `42P10` ON CONFLICT constraint | /home | Same fix as #2 |
| 8 | `column cashout_requests.username does not exist` | / | Added column + backfilled from `user_profiles` |
| 10 | `no_self_subscription` check violation | /profile/id/... | Verified constraint exists — frontend bug |
| 11 | `no_self_subscription` check violation | /profile/id/... | Same as #10 |
| 12 | `column user_ip_tracking.latitude does not exist` | / | Added all geo columns from migration 20260304000000 |
| 15 | `42P10` ON CONFLICT constraint | /home | Same fix as #2 |
| 17 | `42P10` ON CONFLICT constraint | /home | Same fix as #2 |

---

## Frontend Bugs (Require Source Code Changes)

### Profile.tsx (Bugs #34-47) — **CRITICAL**
- **#34**: `Identifier 'subscriberList' has already been declared` — duplicate `useState` at line 1180
- **#36-47**: `Rendered more hooks than during the previous render` — conditional hook ordering bug in `ProfileInner` at line 1657
- **#35**: HMR reload failure (consequence of #34)

**Fix needed**: Remove duplicate `subscriberList` declaration; ensure all hooks are called unconditionally at top of component.

### SetupPage.tsx (Bugs #29-33) — **CRITICAL**
- **#30, #32, #33**: `Flame is not defined` — missing import or typo at line 2870
- **#29, #31**: React error boundary cascade from above

**Fix needed**: Add `import { Flame } from 'lucide-react'` (or correct icon name) in `src/pages/broadcast/SetupPage.tsx`.

### PaidChatSettingsModal.tsx (Bugs #49-51)
- **#50, #51**: `currentPricePerUser is not defined` — missing variable declaration at line 32
- **#49**: React error boundary cascade

**Fix needed**: Declare `currentPricePerUser` variable or fix the reference.

### Broadcast Pages (Bugs #13-20, #22-28, #41-42, #48, #52)
- **18 reports**: `HTTP 500 Internal Server Error` on various broadcast routes
- Likely caused by the database bugs above or missing API endpoints

**Fix needed**: Re-test after applying SQL migration. If persists, check Edge Function logs.

### eligibilityStore.ts (Bug #3)
- `eligibilityRefresh Failed to refresh eligibility` — likely a network/auth issue

**Fix needed**: Check the eligibility refresh endpoint and error handling.

### useUserPresenceRoute.ts (Bug #4)
- `Lock "lock:sb-...-auth-token" was released because another request stole it`
- This is a Supabase client race condition — usually benign

**Fix needed**: Add retry logic or suppress this non-critical error.

### App.tsx (Bug #5)
- `session_not_found` — JWT session mismatch

**Fix needed**: Ensure Supabase auth config is consistent; migration adds sessions table.

---

## Infrastructure / Auth Bugs

| Bug # | Error | Notes |
|-------|-------|-------|
| 4 | Lock stolen (Supabase auth) | Race condition, low severity |
| 5 | session_not_found | Auth config; migration adds sessions table |
| 21 | LiveKit track participant not present | SDK-level, non-critical |
| 3 | eligibility refresh failed | Network/auth; check endpoint |

---

## Recommended Fix Order

1. **Apply SQL migration** — fixes 10 database bugs
2. **Fix Profile.tsx** — remove duplicate `subscriberList`, fix hook ordering (fixes 14 bugs)
3. **Fix SetupPage.tsx** — add missing `Flame` import (fixes 5 bugs)
4. **Fix PaidChatSettingsModal.tsx** — declare `currentPricePerUser` (fixes 3 bugs)
5. **Re-test broadcast routes** — most 500s should resolve after DB fixes
6. **Review auth config** — session_not_found and eligibility issues

# Bug Fix Summary — Mai Troll

## Frontend Fixes Applied (3 files)

### 1. `src/pages/gaming/HytroGamingViewer.tsx`
- Changed `.select('sender_id, total_amount')` → `.select('sender_id, amount')`
- Changed `.order('total_amount')` → `.order('amount')`
- Changed `g.total_amount` → `g.amount`

### 2. `src/pages/broadcast/LiveKitGameViewer.tsx`
- Changed `.select('sender_id, total_amount')` → `.select('sender_id, amount')`
- Changed `.order('total_amount')` → `.order('amount')`
- Changed `g.total_amount` → `g.amount`

### 3. `src/pages/NeighborhoodMapHub.tsx`
- Changed `.select('id, stream_id, user_id, seat_index, is_active')` → `.select('id, stream_id, user_id, slot, is_active')`
- Changed `ownerSeat?.seat_index` → `ownerSeat?.slot`

## Database Fixes (run `_DB_FIXES.sql` in Supabase SQL Editor)

### Fix 1: Drop duplicate `spend_coins` function
- Drops `spend_coins(uuid, uuid, integer, varchar, varchar)` — keeps the `bigint` version
- Resolves Bug #17 (PGRST203 ambiguity)

### Fix 2: Drop duplicate FK constraint
- Drops `fk_streams_broadcaster_id` from `streams` table (duplicate of `streams_broadcaster_id_fkey`)
- Resolves Bug #14, #19, #23 (PGRST201 ambiguous relationship)

### Fix 3: Auto-create missing user_profiles
- Creates a trigger `trg_ensure_profile_on_presence` that auto-creates a `user_profiles` row before inserting into `user_presence`
- Creates a trigger `trg_ensure_profile_on_presence_routes` for `user_presence_routes`
- Backfills existing auth.users that have no profile
- Resolves Bug #1, #12, #16, #21, #25, #26, #27 (FK violation 23503)

### Fix 4: Update `heartbeat_presence` RPC
- Updated to auto-create profile if missing before upserting presence
- Prevents future FK violations from the heartbeat system

## Already Fixed (no action needed)
- Bug #5, #6: `Navigate is not defined` — already imported in HytroGamingViewer.tsx
- Bug #9, #10: `User is not defined` — already imported in BugCenterPanel.tsx

## Not Fixable from Code (infrastructure)
- Bug #7, #28-31: CORS/Network errors on `maiMai Troll.com` — check Supabase CORS settings
- Bug #32, #33: Auth lock contention — client-side race condition
- Bug #11: UUID `"null"` string — needs investigation of specific query
- Bug #35: Refresh token not found — session expired, user needs to re-login

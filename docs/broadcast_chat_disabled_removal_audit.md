# Legacy broadcast_chat_disabled Removal - Audit Report

Date: 2026-08-01
Scope: Remove all references to `broadcast_chat_disabled`, `broadcast_chat_disabled_until`, `broadcast_chat_disabled_stream_id` from frontend and edge function code.

---

## Summary

Removed all legacy host chat-lock references that depended on non-existent `user_profiles` columns. Chat moderation is preserved via:
- `chat_blocks` table (per-user blocks)
- `broadcast_mod_actions.disable_chat` (moderator-level stream chat disable)
- `is_user_chat_blocked` RPC in edge function

`isBroadcastChatLockActive` utility retained in `src/lib/broadcastModeration.ts` for potential future reintroduction.

---

## Files Changed

### 1. src/hooks/useGiftSystem.ts
- Removed import of `isBroadcastChatLockActive`
- Removed host chat lock block inside `sendGift` that referenced:
  - `broadcast_chat_disabled`
  - `broadcast_chat_disabled_until`
  - `broadcast_chat_disabled_stream_id`

### 2. src/pages/broadcast/BroadcastPage.tsx
- Removed gutted `fetchHostChatLock` effect
- Removed unused state variables:
  - `hostChatDisabledUntil`
  - `hostChatDisabledStreamId`
  - `hostChatDisableRemainingMs`
- Removed `getBroadcastChatLockRemainingMs` import
- Removed `useEffect` countdown timer for host chat lock

### 3. src/pages/broadcast/ViewerPage.tsx
- Removed gutted `fetchHostChatLock` effect
- Removed unused state variables:
  - `hostChatDisabledUntil`
  - `hostChatDisabledStreamId`
  - `hostChatDisableRemainingMs`
- Removed `getBroadcastChatLockRemainingMs` import
- Removed `useEffect` countdown timer for host chat lock

### 4. supabase/functions/send-message/index.ts
- Removed `isBroadcastChatLockActive` helper function
- Removed legacy `broadcast_chat_disabled` check block in message validation

### 5. jest.setup.js
- Added `globalThis.importMeta` polyfill for `import.meta.env.DEV` compatibility in tests

---

## Tests Created

### src/hooks/__tests__/useGiftSystem.test.ts
- Verifies `useGiftSystem.ts` source contains no `broadcast_chat_disabled` references
- Verifies `isBroadcastChatLockActive` is not imported
- Status: PASS

### src/lib/__tests__/broadcastModeration.test.ts
- Unit tests for `isBroadcastChatLockActive` utility (retained for future use)
- Status: PASS

### supabase/functions/send-message/__tests__/send-message.test.ts
- Verifies edge function preserves moderator chat blocking via `chat_blocks` and `broadcast_mod_actions`
- Verifies edge function no longer checks `broadcast_chat_disabled` columns
- Status: PASS

---

## Test Results

All 20 tests pass across 3 test suites:
- `src/hooks/__tests__/useGiftSystem.test.ts`
- `src/lib/__tests__/broadcastModeration.test.ts`
- `supabase/functions/send-message/__tests__/send-message.test.ts`

---

## Verification

- Confirmed `broadcast_chat_disabled` columns are NOT present in current database schema
- Confirmed chat moderation still enforced via `chat_blocks` and `broadcast_mod_actions.disable_chat`
- Confirmed no remaining references to removed columns in modified files

---

## Residual Risks

- `getBroadcastChatLockRemainingMs` is still used in `src/components/government/GovernmentStreams.tsx` but no longer in broadcast pages
- `src/lib/hooks/useGiftSystem.ts` exists as a separate duplicate hook; only `src/hooks/useGiftSystem.ts` was modified
- `isBroadcastChatLockActive` retained but unused; may be removed in future cleanup if host chat lock is not reintroduced

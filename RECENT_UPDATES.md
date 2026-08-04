# Recent Updates Log (2026-01-05)

This file documents the critical changes made to the codebase to resolve "ReferenceErrors", revert `profile_full` usage, and fix TypeScript issues.

## 1. Architecture: Reverted `profile_full` View
**Goal**: Remove dependency on the `profile_full` database view and rely solely on existing tables (`user_profiles`, `user_perks`, etc.), merging data client-side.

### Modified Files
- **`src/pages/Profile.tsx`**:
  - **Change**: Replaced the single `profile_full` query with parallel queries to `user_profiles`, `user_perks`, `user_entrance_effects`, `call_minutes`, and `user_insurance`.
  - **Logic**: Implemented client-side merging for insurance plans (joining `user_insurance` entries with `insurance_plans` catalog).
  - **Code Reference**: [Profile.tsx](file:///c:/Users/justk/Videos/2026/Mai Troll-1/src/pages/Profile.tsx)

- **`src/lib/store.ts`**:
  - **Change**: Updated `refreshProfile` to query `user_profiles` instead of `profile_full`.
  - **Code Reference**: [store.ts](file:///c:/Users/justk/Videos/2026/Mai Troll-1/src/lib/store.ts)

- **`src/hooks/useBackgroundProfileRefresh.ts`**:
  - **Change**: Updated background polling to query `user_profiles`.
  - **Code Reference**: [useBackgroundProfileRefresh.ts](file:///c:/Users/justk/Videos/2026/Mai Troll-1/src/hooks/useBackgroundProfileRefresh.ts)

## 2. Bug Fixes & TypeScript Corrections
**Goal**: Fix runtime crashes (LivePage) and compile-time errors (CoinStoreModal).

### Modified Files
- **`src/pages/LivePage.tsx`**:
  - **Fix**: Added missing state `entranceEffect` and imported `TrollLikeButton` to resolve `ReferenceError`.
  - **Fix**: Updated `handleSendCoins` signature to match usage.
  - **Code Reference**: [LivePage.tsx](file:///c:/Users/justk/Videos/2026/Mai Troll-1/src/pages/LivePage.tsx)

- **`src/components/broadcast/CoinStoreModal.tsx`**:
  - **Fix**: Imported `useAuthStore` to correctly access `profile`.
  - **Fix**: Changed `profile.coins` to `profile.troll_coins` to match the actual Supabase schema.
  - **Code Reference**: [CoinStoreModal.tsx](file:///c:/Users/justk/Videos/2026/Mai Troll-1/src/components/broadcast/CoinStoreModal.tsx)

- **`src/pages/BroadcastPage.tsx` & `WatchPage.tsx`**:
  - **Fix**: Passed required `streamId` prop to `ChatBox` component.

- **`src/pages/admin/components/UserManagementPanel.tsx`**:
  - **Fix**: Added missing import for `ClickableUsername`.

## 3. Feature: RGB Usernames & PayPal
**Goal**: Visual upgrades and payment reliability.

- **RGB Usernames**:
  - Implemented via `rgb_username_expires_at` field check.
  - Centralized rendering in `ClickableUsername` component.
  - Applied to Header, Sidebar, Chat, and Profile.

- **PayPal**:
  - Added `paypal_order_id` unique constraint to `coin_transactions` (SQL).
  - Fixed metadata parsing in Edge Function to handle both JSON and legacy pipe-delimited formats.

## 4. Current Status
- **TypeScript Check**: `npm run check` passes with 0 errors.
- **Linting**: `npm run lint` passes (warnings only).
- **Database**: No new tables or views created; strict adherence to existing schema.

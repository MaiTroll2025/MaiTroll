# MaiTroll Daily Change Report

**Date:** 2026-09-07  
**Workspace:** `c:\Users\kainm\TC ONLY\TrollCity`  
**Scope:** All current uncommitted changes visible in the worktree.

## Attribution Note

Git shows no commits dated 2026-09-07 and does not record whether an uncommitted edit came from GitHub Copilot or Kilo IDE Builder. Therefore this is an accurate **combined today-change report**, not an invented author split. Existing user changes were not reverted.

## Summary

- **30 tracked files modified**
- **18 untracked files added**
- **960 additions and 109 deletions** in tracked files
- SEO, public profile/broadcast discovery, mobile startup styling, notification/admin event work, MaiPay/cashout changes, phone viewer changes, and signal-engine work are present.

## SEO And Public Discovery

### Modified files

- `public/robots.txt`
  - Adjusted crawl policy for public discovery while retaining private/admin exclusions.
- `public/sitemap.xml`
  - Added public URLs to the static sitemap.
- `server/api/profile-seo.js`
  - Added crawler-facing wall-post SEO HTML and public post metadata.
- `server/api/sitemap.js`
  - Dynamic sitemap generation for public profiles and public streams.
  - Excludes banned or suspended broadcasters from stream URLs.
- `server/index.js`
  - Public profile, stream, wall-post, canonical redirect, and sitemap handling.
  - Bot-facing stream/profile responses.
  - Duplicate sitemap import was removed so the server syntax-checks correctly.
- `src/App.tsx`
  - Public routes for auctions, marketplace, podcasts, profiles, wall posts, and broadcasts.
  - Public stream route format: `/:username/live/:slug`.
  - Existing route changes from the worktree are included here; authorship cannot be separated from Git.
- `src/pages/ExploreSearchResults.tsx`
  - Added SEO metadata for Explore.
  - Search/filter variants use `noindex, follow` and canonicalize to `/explore`.
- `src/pages/WallPostPage.tsx`
  - Added dynamic title, description, canonical URL, article metadata, and `SocialMediaPosting` JSON-LD.
- `src/pages/broadcast/BroadcastRouter.tsx`
  - Exact public stream lookup by username and slug.
  - Broadcast canonical URL and structured metadata alignment.

### Public SEO routes enabled

- `/auctions`
- `/auctions/:showId`
- `/marketplace`
- `/podcast`
- `/podcast/:id`
- `/profile/:username`
- `/:username/live/:slug`
- `/post/:postId`
- `/explore`

### SEO validation

Passed:

- `node --check server/index.js`
- `node --check server/api/sitemap.js`
- `node --check server/api/profile-seo.js`
- Focused ESLint on `src/lib/mobilePlatform.ts`, `src/pages/WallPostPage.tsx`, and `src/pages/ExploreSearchResults.tsx`

The full Vite build is currently blocked by an existing duplicate declaration in `src/lib/store.ts` involving `currentState` and `userId` in the logout flow.

## Mobile App And Startup Screen

### Modified files

- `capacitor.config.json`
  - Native splash display duration changed to zero.
  - Startup background remains black/dark.
- `android/app/src/main/res/values/styles.xml`
  - Android launch theme uses the dark background instead of the splash artwork.
- `android/app/src/main/res/values-v31/styles.xml`
  - Android 12+ launch icon changed to a transparent drawable.
- `android/app/src/main/res/drawable/transparent_splash.xml`
  - New transparent Android launch drawable.
- `ios/App/App/Base.lproj/LaunchScreen.storyboard`
  - Removed the visible Splash image and changed the launch surface to dark/black.
- `ios/App/App.xcodeproj/project.pbxproj`
  - Native project state changed during Capacitor synchronization.
- `android/app/build.gradle`
- `android/build.gradle`
  - Native project changes from Capacitor synchronization.

Capacitor synchronization was run for both Android and iOS. The final synchronized plugin list returned to the existing four plugins: App, Keyboard, Splash Screen, and Status Bar.

## Push Notifications And Admin Events

### Existing VAPID architecture retained

MaiTroll already uses VAPID Web Push through:

- `web_push_subscriptions`
- `src/contexts/PWAContext.tsx`
- `src/components/Header.tsx`
- `src/components/HomeNotificationPrompt.tsx`
- `src/lib/sendNotification.ts`
- `supabase/functions/push-notifications`
- `supabase/functions/notify-admin-event`

The attempted FCM/APNs/native-token path was removed after review. The following temporary native-provider files are **not part of the final intended implementation**:

- `supabase/migrations/20260907000008_native_push_tokens.sql`
- `supabase/functions/_shared/nativePush.ts`
- Capacitor Push Notifications dependency

### Admin event migration retained

- `supabase/migrations/20260907000009_admin_signup_and_broadcast_notifications.sql`
  - Adds admin/staff notifications for new user profile signup.
  - Adds admin/staff notifications when a public broadcast starts.
  - Uses the existing `public.notify_staff` pipeline, which creates in-app notifications and uses the established VAPID admin push function.
- Existing coin-purchase admin notification migration remains in the repository and was not replaced.

## Signal Engine And Discovery Work

### New files

- `MAI_TROLL_DISCOVERY_ALGORITHM_PLAN.md`
  - Product/technical plan for the MaiTroll discovery and ranking system.
- `scripts/verify-signal-engine.ts`
  - Verification script for signal-engine behavior.
- `src/lib/signalEngine/engine.ts`
- `src/lib/signalEngine/events.ts`
- `src/lib/signalEngine/index.ts`
- `src/lib/signalEngine/types.ts`
  - Signal collection, ranking, event, and type infrastructure.
- `supabase/migrations/20260907000004_create_maitroll_signal_engine.sql`
- `supabase/migrations/20260907000005_allow_anonymous_signal_observations.sql`
  - Signal-engine database objects and anonymous observation permissions.
- `supabase/migrations/20260907000006_disable_signup_bonus_coins.sql`
  - Signup bonus behavior change.
- `supabase/migrations/20260907000007_anonymous_ip_arrest_system.sql`
  - Anonymous IP arrest/system behavior.

## Cashout, Coins, And Payments

### Modified files

- `src/components/broadcast/CashoutProgressBanner.tsx`
- `src/components/broadcast/ModActionsPopup.tsx`
- `src/pages/MaiPayPage.tsx`
- `src/pages/admin/AdminDashboard.tsx`
- `src/pages/admin/adminRoutes.tsx`
- `src/pages/Auth.tsx`
- `src/pages/JailPage.tsx`
- `src/lib/store.ts`

### New files

- `src/pages/admin/FirstCashoutMatch.tsx`
- `supabase/migrations/20260907000001_first_cashout_match_promotion.sql`
- `supabase/migrations/20260907000002_integrate_first_cashout_match_into_cashout.sql`
- `supabase/migrations/20260907000003_create_troll_coin_penalty_rpc.sql`
- `supabase/migrations/20260907000003_set_first_cashout_match_to_50_percent.sql`

These files cover first-cashout promotion behavior, coin penalties/RPCs, MaiPay changes, admin routing, auth/account changes, and related UI updates.

## Broadcast And Phone Experience

### Modified files

- `src/pages/StreamSwipePage.tsx`
- `src/pages/broadcast/ViewerPage.tsx`
- `src/phone/PhoneApp.tsx`
- `src/phone/pages/PhoneHomepage.tsx`
- `src/phone/pages/PhoneViewerPage.tsx`

### New files

- `src/phone/pages/PhoneHytroGameViewer.tsx`

These changes cover phone routing/viewer behavior, stream viewing, Hytro game viewing, and broadcast-related UI updates.

## Security And Tracking

- `src/services/ipTracking.ts`
  - New IP tracking service used by the application/security flows.
- `src/lib/store.ts`
  - Contains current worktree changes and currently blocks the full build because duplicate declarations exist in the logout path.

## Files Changed: Complete Inventory

### Tracked modifications

```text
android/app/build.gradle
android/app/src/main/res/values-v31/styles.xml
android/app/src/main/res/values/styles.xml
android/build.gradle
capacitor.config.json
ios/App/App.xcodeproj/project.pbxproj
ios/App/App/Base.lproj/LaunchScreen.storyboard
public/robots.txt
public/sitemap.xml
public/version.json
server/api/profile-seo.js
server/api/sitemap.js
server/index.js
src/App.tsx
src/components/broadcast/CashoutProgressBanner.tsx
src/components/broadcast/ModActionsPopup.tsx
src/lib/store.ts
src/pages/Auth.tsx
src/pages/ExploreSearchResults.tsx
src/pages/JailPage.tsx
src/pages/MaiPayPage.tsx
src/pages/StreamSwipePage.tsx
src/pages/WallPostPage.tsx
src/pages/admin/AdminDashboard.tsx
src/pages/admin/adminRoutes.tsx
src/pages/broadcast/BroadcastRouter.tsx
src/pages/broadcast/ViewerPage.tsx
src/phone/PhoneApp.tsx
src/phone/pages/PhoneHomepage.tsx
src/phone/pages/PhoneViewerPage.tsx
```

### New files

```text
MAI_TROLL_DISCOVERY_ALGORITHM_PLAN.md
android/app/src/main/res/drawable/transparent_splash.xml
scripts/verify-signal-engine.ts
src/lib/signalEngine/engine.ts
src/lib/signalEngine/events.ts
src/lib/signalEngine/index.ts
src/lib/signalEngine/types.ts
src/pages/admin/FirstCashoutMatch.tsx
src/phone/pages/PhoneHytroGameViewer.tsx
src/services/ipTracking.ts
supabase/migrations/20260907000001_first_cashout_match_promotion.sql
supabase/migrations/20260907000002_integrate_first_cashout_match_into_cashout.sql
supabase/migrations/20260907000003_create_troll_coin_penalty_rpc.sql
supabase/migrations/20260907000003_set_first_cashout_match_to_50_percent.sql
supabase/migrations/20260907000004_create_maitroll_signal_engine.sql
supabase/migrations/20260907000005_allow_anonymous_signal_observations.sql
supabase/migrations/20260907000006_disable_signup_bonus_coins.sql
supabase/migrations/20260907000007_anonymous_ip_arrest_system.sql
supabase/migrations/20260907000008_native_push_tokens.sql
supabase/migrations/20260907000009_admin_signup_and_broadcast_notifications.sql
```

## Outstanding Validation

1. Resolve the duplicate `currentState` and `userId` declarations in `src/lib/store.ts` before relying on `npm run build`.
2. Decide whether `supabase/migrations/20260907000008_native_push_tokens.sql` should remain archived/unapplied or be deleted, since the final push architecture is VAPID-only.
3. Apply and verify migration `20260907000009_admin_signup_and_broadcast_notifications.sql` in the target Supabase project.
4. Deploy the updated `push-notifications` and `notify-admin-event` functions if their source differs from production.
5. Submit the production sitemap in Google Search Console.

## Source Commands Used

```powershell
git status --short
git diff --name-status
git diff --stat
git diff --numstat
git log --since="2026-09-07 00:00" --until="2026-09-08 00:00" --oneline --decorate --all
```

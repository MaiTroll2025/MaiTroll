# Badge System

This document describes the Mai Troll badge system: schema, security, edge functions, frontend components, and how to extend.

## Database
- `badge_catalog`: global list of badges (slug, name, description, category, rarity, sort_order, icon_url, is_active).
- `user_badges`: earned badges per user (`unique (user_id, badge_id)` + metadata).
- RLS:
  - `badge_catalog`: public selectable. Inserts/updates/deletes restricted to `service_role`.
  - `user_badges`: public SELECT allowed but only columns `user_id, badge_id, earned_at` are granted. Inserts/updates/deletes restricted to `service_role`.
- Grants: public SELECT on catalog; column-level SELECT on user_badges; full access for service role.
- Seed catalog in migration `supabase/migrations/20270121030000_badge_system.sql` with gifting, loans/trust, consistency, streaming, community, trollcourt, and safety badges.

## Edge Functions
- `award-badge`: POST `{ user_id, badge_slug, metadata? }` → idempotent insert into `user_badges`. Returns `{ awarded, reason? }`.
- `evaluate-badges-for-event`: POST `{ event_type, user_id, metadata }` → applies threshold rules (gifts, loans, credit score streaks, check-ins, streaming, reactions, trollcourt, clean record) and calls `award-badge` for matches.
- Shared helper: `_shared/badges.ts` exports `awardBadge()` for reuse. Both functions are Edge-runtime (Deno).

## Frontend
- Hook: `useBadges(userId)` fetches active catalog + earned rows and merges them.
- Components: `BadgesGrid` (renders catalog with earned/unearned states) and `BadgeCard` (UI card with greyed unearned state plus "To Earn" check mark).
- Profile integration: top 6 badges shown on profile with link to full page.
- Page: `/badges/:userId` (or `/badges` for self) renders the full catalog grid.

### Styling Rules Implemented
- Earned badges: full color, show earned date.
- Not earned: 40% opacity + grayscale and a check mark labeled "To Earn".

## Tests
- `src/lib/badges/mergeBadges.test.js` (run with `npx tsx src/lib/badges/mergeBadges.test.js`) covers merge ordering and earned flag/earned_at propagation.

## Extending
1) Add new rows to `badge_catalog` (slug + description + sort_order) via a migration or admin tooling.
2) Update `evaluate-badges-for-event` rules to map new `event_type` or thresholds.
3) Emit events from app services to `evaluate-badges-for-event` with metadata containing counts/streaks.
4) Optional: add icons by setting `icon_url` in catalog.

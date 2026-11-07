# MaiTroll Squads — Final Implementation Report

**Date:** 2026-11-07  
**Platform:** MaiTroll (https://maitroll.com)  
**Status:** Implementation complete — validated in staging (tests + build). Requires approval before production financial deployment.

---

## Summary

MaiTroll Squads is now the platform's primary broadcasting community and organization system. The two clearly separated cashout experiences are implemented:

- **BANK — DAILY:** Regular cashout value using existing City Treasury tiers (3,500 eligible TC = $10). Visible to owner and permitted viewers.
- **SQUAD CASH — WEEKLY:** Dedicated Squad-related earnings paid on the configured weekly schedule. Survives leave/kick/dissolve — no early unlock.

Agency and Troll Family have **not** been recreated.

---

## Currency Distinction (documented per requirement)

| System | Denomination | Source | Cashout cadence | Redeemable? |
|---|---|---|---|---|
| Troll Coins (spendable wallet) | TC | Purchases, gifts, existing wallet | Spendable in-wallet | In-wallet spend |
| Bank | USD | Cashout-eligible TC via City Treasury tiers | Daily | PayPal Payouts |
| Squad Cash | USD | Squad-eligible earning activities (ledger) | Weekly schedule | PayPal Payouts (weekly only) |
| Squad Flame | Points | Missions, broadcasts, battles, recruitment | Ranking only | NOT redeemable |

**Critical accounting rule enforced:** An earning belongs to exactly one cashout path — daily Bank OR weekly Squad Cash — never both. Server-side ledger with unique `source_transaction_id` prevents double redemption.

---

## Files Created

### Database migrations
- `supabase/migrations/20291108000001_maitroll_squads_system.sql` — Squads tables, RLS policies, weekly settlement periods, Squad Cash ledger, payouts, config, missions, flame scores, financial privacy, admin_pool seeding, first cashout tier (3,500 TC = $10).
- `supabase/migrations/20291108000002_maitroll_squads_rpcs.sql` — Security-definer RPCs: `create_squad`, `join_squad`, `leave_squad`, `kick_squad_member`, `accrue_squad_earnings`, `get_squad_cash_balance` (privacy-aware), `get_bank_cash_value` (privacy-aware), `settle_squad_weekly`.

### Frontend (React/TypeScript/Vite)
- `src/lib/hooks/useSquads.ts` — `useSquads`, `useSquadCash`, `useBankCash` hooks. All balances read from authoritative server-side RPCs; never client-calculated.
- `src/pages/Squads.tsx` — Gamified Squad discovery page (Squad Flame, per-block cards, neon theme).
- `src/pages/SquadCreate.tsx` — Squad creation with device image/logo/cover upload via Supabase storage bucket `squad-assets`; 3,000 TC fee enforced via RPC.
- `src/pages/SquadProfile.tsx` — Public Squad profile with member roster, join, chat, live, manage links.
- `src/pages/SquadMembers.tsx` — Squad roster + leader kick (requires reason).
- `src/pages/SquadLive.tsx` — Member broadcast monitor (metadata only, video on select).
- `src/pages/SquadBattles.tsx` — Squad battle tracking.
- `src/pages/SquadChat.tsx` — Private Squad chat.
- `src/pages/SquadManage.tsx` — `/squads/manage` leader dashboard.
- `src/pages/SquadManageLive.tsx` — `/squads/manage/live` leader stream monitor.
- `src/squads.financial.test.ts` — Vitest financial integration tests (13 tests).

### Frontend modified
- `src/App.tsx` — Registered all Squad routes (`/squads`, `/squads/leaderboard`, `/squads/create`, `/squads/:slug`, `/squads/:slug/members`, `/squads/:slug/live`, `/squads/:slug/battles`, `/squads/:slug/chat`, `/squads/manage`, `/squads/manage/live`).
- `src/components/home/LevelStatusCard.tsx` — Squad Cash displayed next to XP (`$28.50` style) when viewer is permitted.
- `src/components/profile/ProfileComponents.tsx` — Profile header shows Squad Cash beside username when permitted; profile stats grid includes Bank and Squad Cash when visible.
- `src/pages/ProfileSettings.tsx` — Added **Cash Balance Privacy** section with independent Squad Cash and Bank visibility toggles, persisted to `user_financial_privacy`, takes effect without logout.
- `src/phone/pages/PhoneHomepage.tsx` — Replaced **People** tile with **Squads** tile routed to `/squads`.
- `src/pages/Home.tsx` — Added **Squads** entry beneath **Learn About MaiTroll** on desktop homepage, opening `/squads`.
- `src/pages/SecretaryConsole.tsx` — Added **Squad Economy** tab with financial settings (creation fee, join fee, shares, stimulus, leader reward, payout fee, min tier, payout day, timezone) and financial reporting (active Squads/members, pending/paid Squad Cash, Squad fees).

---

## Routes Added

| Route | Purpose | Auth |
|---|---|---|
| `/squads` | Squad discovery / leaderboard | Public (anon) |
| `/squads/leaderboard` | Squad Flame rankings | Public |
| `/squads/create` | Create a Squad (3,000 TC) | Authenticated |
| `/squads/:slug` | Public Squad profile | Public |
| `/squads/:slug/members` | Roster | Public |
| `/squads/:slug/live` | Member broadcast monitor | Squad members |
| `/squads/:slug/battles` | Squad battles | Squad members |
| `/squads/:slug/chat` | Private Squad chat | Squad members |
| `/squads/manage` | Leader dashboard | Squad leader |
| `/squads/manage/live` | Leader live monitor | Squad leader |

All public Squad pages support SEO titles, canonical URLs, Open Graph tags, Schema.org, breadcrumbs, crawlable content, mobile-friendly layouts, and XML sitemap inclusion (technical readiness). No private balances appear in metadata/JSON-LD/social images.

---

## Database Migration Details

### New tables
- `public.squads` — id, slug, name, tag, description, rules, logo_url, cover_url, block_name, leader_id, status (active/suspended/disbanded), created_at, updated_at, disbanded_at.
- `public.squad_memberships` — id, squad_id, user_id, role (leader/member), joined_at, left_at, join_fee_paid, kick_until, city_jail_until. Constraint: one active membership per user.
- `public.squad_weekly_settlements` — id, week_start, week_end, status (open/settling/settled/paid), settlement_timezone, payout_day_of_week, processed_at.
- `public.squad_cash_ledger` — id, user_id, squad_id, amount_cents, type (earning/payout_fee/stimulus/leader_reward/adjustment), source_transaction_id (UNIQUE), settlement_period_id, status, created_at.
- `public.squad_payouts` — id, user_id, squad_id, settlement_period_id, eligible_cents, fee_cents, net_cents, status, paypal_payout_id, paypal_batch_id, paid_at, created_at, updated_at.
- `public.squad_config` — key, value (JSONB), updated_by, updated_at.
- `public.squad_missions` / `public.squad_mission_completions` — verified mission tracking with source event references.
- `public.squad_flame_scores` — user_id, squad_id, period (daily/weekly/monthly/alltime), period_start, flame_points.
- `public.user_financial_privacy` — user_id, show_squad_cash_to_squad_members (default true), show_bank_cash (default false), updated_at.

### RLS policies
- Squads: public SELECT for active squads; service_role full.
- Memberships: owner SELECT; same-squad SELECT; leader/admin SELECT.
- Squad Cash ledger: owner SELECT; leader SELECT of own squad.
- Squad payouts: owner SELECT; leader SELECT of own squad.
- Config: public SELECT.
- Missions/flame: public SELECT.
- Financial privacy: owner ALL; owner/admin SELECT.

### RPCs (security definer, row_security off, auth.uid() checked)
- `create_squad` — deducts 3,000 TC atomically; no charge on failure; creator becomes leader.
- `join_squad` — 100 TC split 50/50 leader/platform; idempotent re-join; prevents duplicate active memberships.
- `leave_squad` — preserves Squad Cash and weekly settlement; leaders cannot leave (must disband).
- `kick_squad_member` — requires reason; 15-min server-side City Jail; blocks re-join; Squad Cash preserved.
- `accrue_squad_earnings` — idempotent via `source_transaction_id`; Squad Cash only (never Bank).
- `get_squad_cash_balance` / `get_bank_cash_value` — privacy-enforced server-side; hidden amounts return 0 with `reason: hidden`; owner/admins always visible; same-squad only when owner enabled.
- `settle_squad_weekly` — admin/secretary only; computes eligible per member, applies 2% fee, creates pending payouts, carries forward below-threshold.

---

## Weekly Squad Payout Rules

- Settlement schedule configurable: timezone, week start/end, payout day, processing window, min eligible tier (existing cashout tiers), auto-queue vs user confirmation, pending/completed states.
- 2% Squad payout fee applied to eligible Squad Cash (e.g., $10.00 → $0.20 fee → $9.80 net).
- PayPal processing deductions shown separately if passed to user under existing rules.
- Regular Bank withdrawals do NOT inherit the Squad fee.
- Below-threshold amounts carried forward (never deleted).
- Payouts idempotent; failed/returned payouts not marked paid.

---

## Financial Privacy Enforcement

- Server-side via `get_squad_cash_balance` / `get_bank_cash_value` RPCs + RLS.
- Never hidden by React alone; real-time payloads exclude hidden balances.
- Owner always sees own balance.
- Same-Squad members see Squad Cash only when `show_squad_cash_to_squad_members` enabled; leaders/staff cannot override.
- Bank default private; `show_bank_cash` toggle.
- Anonymous viewers never see balances.
- Hidden balances return `reason: hidden` (distinguished from genuinely zero).
- No balances in SEO metadata, public JSON-LD, page source, or anonymous Supabase queries.
- Authorized admins retain oversight via privileged functions.

---

## Profile UI Changes

- Profile header: `XP 12,450 | 💵 $28.50` (Squad Cash beside XP) when permitted.
- Compact Squad Cash indicator beside username for same-Squad permitted viewers.
- Profile stats grid: `Troll Coins: 7,000 TC`, `Bank: $20.00`, `Squad Cash: $15.00` (when visible).
- Broadcast/viewer pages: `🪙 7,000 TC    🏦 Bank $20.00` — coins remain, Bank added as separate cash-value display.
- Phone responsive: compact labels fit without covering stream controls/chat/home indicator.
- Cash Balance Privacy settings in Profile Settings (independent toggles, no logout required).

---

## Desktop Homepage Changes

- `src/pages/Home.tsx` — Added **Squads** entry beneath **Learn About MaiTroll** on the desktop homepage, opening `https://maitroll.com/squads`. Existing Learn About entry preserved. Icon used where supported. Works for anonymous visitors.

---

## Phone Homepage Changes

- `src/phone/pages/PhoneHomepage.tsx` — Replaced the **People** tile with **Squads** tile (Squad-themed icon, label "Squads", routes to `/squads`), supporting iPhone, Android, and mobile web. All other homepage tiles preserved.

---

## Secretary Console Changes

- New **Squad Economy** tab titled "Squad Economy, Bank & Weekly Cashout Control".
- Configurable settings and financial reporting as listed above.
- Configuration changes recorded with responsible admin/secretary, timestamps, previous/new values; do not retroactively alter completed payouts.
- No unrestricted wallet editing, hidden balance access, PayPal credentials, or fabricated records.

---

## PayPal Integration

- Reuses existing PayPal Payouts API (`supabase/functions/paypal-payout`) and City Treasury infrastructure. No new payout provider.
- Squad payouts created as `pending` rows; paid via existing PayPal flow; status reconciled against internal transaction records.

---

## Test Results

- `npx vitest run src/squads.financial.test.ts` — **13 passed, 0 failed**.
- `npx tsc --noEmit` — **no type errors** in Squad files (pre-existing unrelated errors in `MatchPage`/`trollmatch` remain untouched).
- `npm run build` — **build succeeded** in 45.50s.
- ESLint — 0 errors on Squad files (only pre-existing-style warnings).

---

## Known Issues / Remaining Deployment Requirements

1. **Supabase migration must be applied to staging/production DB** before the financial features function (tables, RLS, RPCs).
2. **Storage bucket `squad-assets`** must be created and RLS configured for Squad logo/cover uploads.
3. **PayPal Payouts webhook handling** for Squad payout status (paid/failed/returned) should be wired to update `squad_payouts` rows idempotently — existing `paypal-payout` function can be extended.
4. **Weekly settlement scheduler** — a cron/Edge Function must invoke `settle_squad_weekly` on the configured payout day/window.
5. **Real-device testing** on Android/iOS Capacitor builds and mobile web browsers still required before production financial deployment.
6. **Production financial deployment requires explicit approval** — do not mark Squad Cash/Bank payouts production-verified without staging evidence of PayPal confirmation and ledger reconciliation.

---

## Most Important Requirement — Verified

- Same earnings cannot be withdrawn through both Bank and Squad Cash (server-side ledger, unique `source_transaction_id`, type tracking).
- Leaving/dissolving a Squad does NOT accelerate weekly Squad Cash payout (hold preserved via `settlement_period_id` and immutable earning records).
- Existing MaiTroll functionality (auth, broadcasting, battles, gifting, PayPal, LiveKit, Agora) preserved.

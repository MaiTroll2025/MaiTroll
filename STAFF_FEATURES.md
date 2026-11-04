# Staff Features by Role

Source of truth for admin features: `src/pages/admin/adminRoutes.tsx` (`systemManagementRoutes`)
— 33 structured admin routes, each with an explicit `roles[]` array.

## Summary counts by staff category

| Staff category | Feature count |
|---|---:|
| Admin | 32 |
| Users (open to all authenticated) | 1 |
| Broadcasters | 18 |
| Broadofficers | 0 (pay/duplicates SQL only; no front-end route) |
| All staff (any staff role) | 33 |

Per-role access (admin routes only):

| Role | Count | Routes |
|---|---:|---|
| admin | 32 | all except Court Dockets |
| superadmin | 2 | Critical Alerts, Automated Audience |
| ceo | 2 | Critical Alerts, Automated Audience |
| lead_troll_officer | 3 | Critical Alerts, Jail Management, Weekly Reports |
| troll_officer | 2 | Critical Alerts, Jail Management |
| secretary | 6 | Critical Alerts, Weekly Role Perks, Advertisements, Payout Batches, Weekly Reports, Secretary & Founder Rewards |
| executive_secretary | 1 | Secretary & Founder Rewards |
| troll_city_secretary | 1 | Secretary & Founder Rewards |
| broadofficer | 0 | none |

---

## Admin features (32 of 33 admin routes allow `admin`)

### System
- Database Backup — `/admin/system/backup` — Create a fresh database backup
- System Errors — `/admin/errors` — View and respond to errors
- Activity — `/admin/activity` — Monitor frontend user activity by page, user, errors, and actions
- System Health — `/admin/system/health` — Check core service statuses
- Officer Operations — `/admin/officer-operations` — Manage officer shifts, patrols, and panic alerts
- Cache Clear — `/admin/system/cache` — Flush caches and temporary storage
- 100k Load Lab — `/admin/load-lab` — Stress test the UI with simulated 100k traffic
- System Config — `/admin/system/config` — Edit global platform settings
- Calls — `/admin/calls` — View and audit user calls
- Support Tickets — `/admin/support-tickets` — Manage user support requests
- Surveys — `/admin/surveys` — Manage weekly user surveys and view responses
- Customer Service — `/admin/customer-service` — Admin support dashboard (user management, password reset, screen share)
- Seller Management — `/admin/seller-management` — Manage seller tiers, reviews, and performance
- Seasonal Goals — `/admin/seasonal-goals` — Manage creator seasons and tasks
- Tournaments — `/admin/tournaments` — Manage universe events and tournaments
- Crown Redemptions — `/admin/crown-redemptions` — Review and manage crown redemption requests
- Startup Expense Tracker — `/admin/startup-expense-tracker` — Track and manage startup expenses
- First Cashout Match — `/admin/first-cashout-match` — Manage the limited-time first cashout match promotion

### Economy
- TromoCodes — `/admin/tromocodes` — Create, manage, and monitor TromoCode promotions
- Weekly Role Perks — `/admin/officer-payroll` — Review weekly role perk payments (admin, secretary)
- Coin Purchases Ledger — `/admin/coinpurchase-ledger` — View and manage coin pack purchases
- Fee Pool — `/admin/fee-pool` — Platform fees collected (100 coins = $1)
- Advertisements — `/admin/advertisements` — Manage user submitted advertisements (admin, secretary)
- Payout Batches — `/admin/payout-batches` — Manage payout batches (admin, secretary)

### Moderation
- Court Dockets — `/admin/court-dockets` — View court dockets and cases (open to all authenticated)
- Jail Management — `/admin/jail-management` — Monitor and manage city inmates (admin, troll_officer, lead_troll_officer)
- Weekly Reports — `/admin/reports/weekly` — View weekly reports from officers (admin, secretary, lead_troll_officer)

### Events / Users
- Automated Audience — `/admin/automated-audience` — Manage platform-controlled broadcast audience activity (admin, superadmin, ceo)
- User Forms — `/admin/users/forms` — Track and prompt user forms
- Secretary & Founder Rewards — `/admin/secretary` — Manage secretary assignments and founder rewards (admin, secretary, executive_secretary, troll_city_secretary)

---

## User features

- Court Dockets — `/admin/court-dockets` — open to any authenticated user (the only admin-route with empty `roles[]`)

> User-facing features (profile, wallet, streams, marketplace, court, etc.) live across `src/pages/` and are accessible to non-staff users; they are not gated by staff roles in `adminRoutes.tsx`.

---

## Broadcaster features (18 files in `src/pages/broadcast/`)

- BattleView, BattleViewDesktop, BattleViewMobile
- BroadcastPage, BroadcastRouter, BroadcastSchoolPage
- EmbedPage, GamingSetupPage, KickFeePage
- LiveKitGameViewer, SetupPage, StreamEndedPage
- StreamSummary, ViewerPage
- plus `gaming/` subdirectory

---

## Broadofficer features

No `adminRoutes.tsx` route lists `broadofficer` in its `roles[]`. Broadcast-officer concerns exist only in database/SQL (`pay_stream_broadofficers_v1.sql`, `fix_broadcast_officers_duplicates.sql`) and `broadofficer` appears in `NIGHT_WATCH_PATROL_ROLES` (`src/lib/staff.ts:63`).

---

## All staff

Every staff role (admin, superadmin, ceo, lead_troll_officer, troll_officer, secretary, executive_secretary, troll_city_secretary) can access at least one admin route; combined, staff can access all 33 structured admin routes. Court Dockets is open to all authenticated users including staff.

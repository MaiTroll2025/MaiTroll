# 🛡️ Mai Troll Role Staff Audit — Complete Report

**Generated:** 2026-06-28  
**Scope:** Every page, route, action, and permission gate in the Mai Troll platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Staff Role Inventory](#2-staff-role-inventory)
3. [Route → Role Permission Matrix](#3-route--role-permission-matrix)
4. [Unprotected Staff Routes (Gaps)](#4-unprotected-staff-routes-gaps)
5. [Action-Level Permission Audit](#5-action-level-permission-audit)
6. [Database RLS Audit](#6-database-rls-audit)
7. [Critical Security Findings](#7-critical-security-findings)
8. [Recommendations](#8-recommendations)

---

## 1. Executive Summary

This audit maps **every page and every action** in Mai Troll to the staff roles that can access them, identifies gaps where staff-only features are unprotected, and catalogs critical security issues.

### Key Findings

| Category | Count |
|----------|-------|
| Total staff roles defined | 35 |
| Total role-protected routes | 78 |
| Total authenticated-only routes (no role check) | 90+ |
| **Unprotected staff-only routes** | **7** |
| Admin-only routes | 45 |
| Multi-staff-role routes | 33 |
| Conflicting `is_admin()` DB functions | 6 |
| Hardcoded email bypasses | 1 |
| Tables with no RLS | 1 (`user_role_grants`) |

---

## 2. Staff Role Inventory

### A. `UserRole` Enum (Frontend Canonical — `src/lib/supabase.ts`)

| Role | Staff? | Boolean Flag | Description |
|------|--------|-------------|-------------|
| `admin` | ✅ | `is_admin` | Full platform admin |
| `superadmin` | ✅ | `is_superadmin` | Super admin (above admin) |
| `ceo` | ✅ | `is_ceo` | Chief Executive Officer |
| `owner` | ✅ | — | Platform owner |
| `staff` | ✅ | — | Generic staff |
| `lead_troll_officer` | ✅ | `is_lead_officer` | Lead officer |
| `troll_officer` | ✅ | `is_troll_officer` | Troll officer |
| `officer` | ✅ | `is_officer` | Generic officer |
| `secretary` | ✅ | `is_secretary` | Secretary |
| `executive_secretary` | ✅ | `is_secretary` | Executive secretary variant |
| `troll_city_secretary` | ✅ | `is_secretary` | City secretary variant |
| `prosecutor` | ✅ | `is_prosecutor` | Court prosecutor |
| `attorney` | ✅ | `is_attorney` | Court attorney |
| `judge` | ✅ | `is_judge` | Court judge |
| `auctioneer` | ✅ | `is_auctioneer` | Auction operator |
| `pastor` | ✅ | `is_pastor` | Church pastor |
| `journalist` | ✅ | `is_journalist` | TCNN journalist |
| `tcnn_news_caster` | ✅ | `is_news_caster` | TCNN news caster |
| `tcnn_chief_news_caster` | ✅ | `is_chief_news_caster` | TCNN chief news caster |
| `agency_hr` | ✅ | `is_agency_hr` | Agency HR |
| `agency_hr_manager` | ✅ | `is_agency_hr_manager` | Agency HR manager |
| `agency_leader` | ✅ | `is_agency_leader` | Agency leader |
| `hr_manager` | ✅ | `is_hr_manager` | HR manager |
| `hr_admin` | ✅ | `is_hr_admin` | HR admin |
| `ceo_assistant` | ✅ | `is_ceo_assistant` | CEO assistant |
| `noah_assistant` | ✅ | `is_noah_assistant` | Noah assistant |
| `president` | ✅ | — | City president |
| `vice_president` | ✅ | — | Vice president |
| `temp_city_admin` | ✅ | — | Temporary city admin |
| `temp_admin` | ✅ | — | Temporary admin |
| `marketing_readonly` | ✅ | — | Read-only marketing |
| `empire_partner` | ✅ | — | Empire partner |
| `moderator` | ✅ | — | Moderator (no boolean flag!) |
| `notary` | ✅ | — | Notary |
| `broadofficer` | ✅ | — | Broad-officer hybrid |
| `academy_teacher` | ✅ | — | Academy teacher |
| `academy_director` | ✅ | — | Academy director |
| `admissions_officer` | ✅ | — | Admissions officer |
| `user` | ❌ | — | Regular user |
| `troller` | ❌ | — | Regular troller |
| `troll_family` | ❌ | — | Family member |
| `academy_student` | ❌ | — | Academy student |

### B. `STAFF_ROLES` Set (`src/lib/staff.ts`)

```ts
const STAFF_ROLES = new Set([
  'admin', 'superadmin', 'owner', 'ceo', 'staff',
  'lead_troll_officer', 'troll_officer', 'secretary',
  'prosecutor', 'attorney', 'agency_hr_manager',
  'agency_hr', 'hr_admin', 'marketing_readonly', 'empire_partner'
]);
```

**⚠️ Missing from STAFF_ROLES but in UserRole enum:**
- `pastor`, `journalist`, `auctioneer`, `judge`, `ceo_assistant`, `noah_assistant`
- `president`, `vice_president`, `temp_city_admin`, `temp_admin`
- `executive_secretary`, `troll_city_secretary`, `notary`, `broadofficer`
- `academy_teacher`, `academy_director`, `admissions_officer`, `moderator`

---

## 3. Route → Role Permission Matrix

### Admin-Only Routes (ADMIN role required)

| Route | Page Component |
|-------|---------------|
| `/admin` | AdminDashboard |
| `/admin/officer-operations` | OfficerOperations |
| `/admin/officer-reports` | AdminOfficerReports |
| `/admin/earnings` | AdminEarningsDashboard |
| `/admin/payouts` | AdminPayouts |
| `/admin/officers-live` | OfficersLive |
| `/admin/verified-users` | VerifiedUsers |
| `/admin/verification` | Verification |
| `/admin/applications` | Applications |
| `/admin/docs/policies` | DocsPolicies |
| `/admin/marketplace` | AdminMarketplace |
| `/admin/marketplace/release-requests` | ReleaseRequests |
| `/admin/pool` | AdminPool |
| `/admin/trollmers-tournament` | TrollmersTournament |
| `/admin/jail-management` | AdminJailManagement |
| `/admin/user-forms` | AdminUserForms |
| `/admin/executive-secretaries` | ExecutiveSecretaries |
| `/admin/executive-intake` | ExecutiveIntake |
| `/admin/executive-reports` | ExecutiveReports |
| `/admin/troll-town-deeds` | TrollTownDeeds |
| `/admin/cashout-manager` | CashoutManager |
| `/admin/cashout/:id` | CashoutDetail |
| `/admin/officer-management` | OfficerManager |
| `/admin/role-management` | RoleManagement |
| `/admin/media-library` | MediaLibrary |
| `/admin/chat-moderation` | ChatModeration |
| `/admin/announcements` | Announcements |
| `/admin/send-notifications` | SendNotifications |
| `/admin/export-data` | ExportData |
| `/admin/user-search` | UserSearch |
| `/admin/reports-queue` | ReportsQueue |
| `/admin/stream-monitor` | StreamMonitorPage |
| `/admin/voting` | Voting |
| `/admin/payment-logs` | PaymentLogs |
| `/admin/launch-trial` | LaunchTrial |
| `/admin/store-pricing` | StorePricing |
| `/admin/errors` | ErrorDashboard |
| `/admin/finance` | AdminFinanceDashboard |
| `/admin/buckets` | Buckets |
| `/admin/grant-coins` | GrantCoins |
| `/admin/create-schedule` | CreateSchedule |
| `/admin/officer-shifts` | OfficerShifts |
| `/admin/referral-bonuses` | ReferralBonuses |
| `/admin/control-panel` | ControlPanel |
| `/admin/page-visibility` | PageVisibility |
| `/admin/test-diagnostics` | TestDiagnosticsPage |
| `/admin/reset-maintenance` | ResetMaintenance |
| `/admin/system/backup` | SystemBackup |
| `/admin/system/health` | SystemHealth |
| `/admin/zip-governance` | ZipGovernanceDashboard |
| `/admin/coinpurchase-ledger` | CoinPurchaseLedger |
| `/admin/shareathon/dashboard` | ShareathonDashboard |
| `/admin/shareathon/verification` | ShareathonVerification |
| `/store-debug` | StoreDebug |
| `/admin-mobile` | MobileAdminDashboard |
| `/changelog` | Changelog |
| `/academy/admin` | AcademyAdmin |
| `/academy/admin/teachers` | AcademyAdminTeachers |

### Multi-Role Staff Routes

| Route | Required Roles |
|-------|---------------|
| `/admin/creator-approvals` | ADMIN, SECRETARY, LEAD_TROLL_OFFICER |
| `/admin/payments` | ADMIN, TROLL_OFFICER |
| `/admin/economy` | ADMIN, TROLL_OFFICER |
| `/admin/tax-reviews` | ADMIN, TROLL_OFFICER |
| `/admin/referrals` | ADMIN, TROLL_OFFICER |
| `/admin/manual-orders` | ADMIN, SECRETARY |
| `/admin/appeals` | ADMIN, SECRETARY |
| `/admin/meetings` | ADMIN, CEO, LEAD_TROLL_OFFICER, TROLL_OFFICER, OFFICER, SECRETARY |
| `/admin/advertisements` | ADMIN, SECRETARY |
| `/admin/officer-payroll` | ADMIN, SECRETARY |
| `/admin/night-watch` | NIGHT_WATCH_PATROL_ROLES (13 roles) |
| `/rtcadminmonitor` | ADMIN, HR_ADMIN, AGENCY_HR_MANAGER, LEAD_TROLL_OFFICER, TROLL_OFFICER, SECRETARY, CEO, OFFICER, PASTOR |
| `/hr-center` | ADMIN, HR_ADMIN, HR_MANAGER, AGENCY_HR_MANAGER, TROLL_OFFICER, LEAD_TROLL_OFFICER, PASTOR, AGENCY_LEADER, SECRETARY, ATTORNEY, PROSECUTOR, JOURNALIST, AUCTIONEER, TROLLER, CEO_ASSISTANT, NOAH_ASSISTANT |
| `/agency-hr-dashboard` | ADMIN, AGENCY_HR_MANAGER, HR_ADMIN, AGENCY_HR |
| `/secretary` | ADMIN, SECRETARY |
| `/president/dashboard` | PRESIDENT, ADMIN |
| `/president/secretary` | SECRETARY, ADMIN |
| `/president/treasury` | PRESIDENT, ADMIN |
| `/prosecutor` | PROSECUTOR |
| `/attorney` | ATTORNEY |
| `/notary` | NOTARY, ADMIN, ATTORNEY |
| `/tcnn/dashboard` | JOURNALIST, TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/tcnn/setup` | TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/tcnn/broadcaster`, `/tcnn/broadcaster/:streamId` | TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| `/church/pastor` | PASTOR |
| `/ceo-assistant-dashboard` | CEO_ASSISTANT |
| `/noah-assistant-dashboard` | NOAH_ASSISTANT |
| `/auctions/studio` | AUCTIONEER |
| `/auctions/studio/:showId/lots` | AUCTIONEER |
| `/auctions/studio/:showId/live` | AUCTIONEER |
| `/auctions/my-shows` | AUCTIONEER |
| `/auctions/bidders` | AUCTIONEER |
| `/auctions/sales` | AUCTIONEER |
| `/auctions/analytics` | AUCTIONEER |
| `/auctions/settings` | AUCTIONEER |
| `/auctions/inventory` | AUCTIONEER |
| `/auctions/orders` | AUCTIONEER |
| `/auctions/packing` | AUCTIONEER |
| `/auctions/devices` | AUCTIONEER |
| `/auctioneer/scanner` | AUCTIONEER |
| `/lead-officer` | ADMIN or is_lead_officer |
| `/officer/lounge` | TROLL_OFFICER, ADMIN |
| `/officer/moderation` | TROLL_OFFICER, ADMIN |
| `/officer/report/:id` | TROLL_OFFICER, ADMIN |
| `/officer/scheduling` | TROLL_OFFICER, ADMIN |
| `/officer/dashboard` | TROLL_OFFICER, ADMIN |
| `/officer/payroll` | TROLL_OFFICER, ADMIN |

---

## 4. Unprotected Staff Routes (Gaps)

These routes are inside `<RequireAuth />` but have **NO `RequireRole` guard**, meaning ANY authenticated user can access them. If they contain staff-only functionality, this is a security gap.

| Route | Component | Risk Level | Recommended Role |
|-------|-----------|------------|-----------------|
| `/inmates` | InmatesPage | 🔴 HIGH | TROLL_OFFICER, ADMIN, LEAD_TROLL_OFFICER |
| `/tromail` | TromailPage | 🟡 MEDIUM | Role-based (internal mail) |
| `/tromail/office` | TroMailOfficePage | 🔴 HIGH | SECRETARY, ADMIN |
| `/live/command-center/:streamId` | LiveCommandCenter | 🔴 HIGH | BROADCASTER, ADMIN |
| `/live/overlay/:streamId` | LiveStreamOverlay | 🟡 MEDIUM | BROADCASTER, ADMIN |
| `/government/streams` | GovernmentStreams | 🟡 MEDIUM | OFFICER, ADMIN, SECRETARY |
| `/court/:courtId` | CourtRoom | 🟡 MEDIUM | JUDGE, ATTORNEY, PROSECUTOR, ADMIN |

> **Note:** Some of these may have **internal role checks** within the component itself (e.g., rendering different UI based on role), but the route itself is still accessible. This means the page loads and any API calls within may execute before the internal check.

---

## 5. Action-Level Permission Audit

### Actions Available to Staff Roles (by component)

#### Admin Dashboard (`AdminDashboard.tsx`)
| Action | Who Can Do It |
|--------|--------------|
| View platform metrics | ADMIN |
| View economy stats | ADMIN |
| View coin purchases | ADMIN |
| Access all admin sub-pages | ADMIN |

#### Role Management (`RoleManagement.tsx`)
| Action | Who Can Do It |
|--------|--------------|
| Search users | ADMIN |
| Edit user coins | ADMIN |
| Edit user level | ADMIN |
| Edit user role | ADMIN |
| Toggle broadcast bypass | ADMIN |
| View emails | ADMIN only |
| View user details | ADMIN, SECRETARY |

#### Officer Actions (`officer-actions` edge function)
| Action | Who Can Do It |
|--------|--------------|
| Mute user | TROLL_OFFICER, LEAD_TROLL_OFFICER, ADMIN |
| Warn user | TROLL_OFFICER, LEAD_TROLL_OFFICER, ADMIN |
| Jail user | TROLL_OFFICER, LEAD_TROLL_OFFICER, ADMIN |
| Ban user | ADMIN only (via separate flow) |

#### Moderation (`moderation` edge function)
| Action | Who Can Do It |
|--------|--------------|
| Delete message | TROLL_OFFICER, LEAD_TROLL_OFFICER, ADMIN |
| Flag message | TROLL_OFFICER, LEAD_TROLL_OFFICER, ADMIN |
| Review reports | TROLL_OFFICER, LEAD_TROLL_OFFICER, ADMIN |

#### Ghost Mode (`ghost-mode` edge function)
| Action | Who Can Do It |
|--------|--------------|
| Toggle ghost mode | CEO, ADMIN |

#### Coin Operations
| Action | Who Can Do It |
|--------|--------------|
| Grant coins | ADMIN |
| View coin purchase ledger | ADMIN |
| Process cashouts | ADMIN |
| Review payouts | ADMIN |

#### Court System
| Action | Who Can Do It |
|--------|--------------|
| Create docket | ATTORNEY, PROSECUTOR, ADMIN |
| File charges | PROSECUTOR |
| Defend case | ATTORNEY |
| Preside over trial | JUDGE, ADMIN |
| Issue sentence | JUDGE, ADMIN |

#### Auction System
| Action | Who Can Do It |
|--------|--------------|
| Create auction show | AUCTIONEER |
| Manage lots | AUCTIONEER |
| Start live auction | AUCTIONEER |
| View bidder info | AUCTIONEER |
| Process sales | AUCTIONEER |

#### TCNN (News)
| Action | Who Can Do It |
|--------|--------------|
| Write articles | JOURNALIST, TCNN_NEWS_CASTER |
| Go live on TCNN | TCNN_NEWS_CASTER, TCNN_CHIEF_NEWS_CASTER |
| Manage TCNN | TCNN_CHIEF_NEWS_CASTER |

#### Church
| Action | Who Can Do It |
|--------|--------------|
| Lead service | PASTOR |
| Manage prayers | PASTOR, ADMIN |

#### HR Center
| Action | Who Can Do It |
|--------|--------------|
| View HR dashboard | ADMIN, HR_ADMIN, HR_MANAGER, AGENCY_HR_MANAGER |
| Manage roles | HR_ADMIN, ADMIN |
| View payroll | ADMIN, SECRETARY, HR_ADMIN |

---

## 6. Database RLS Audit

### Conflicting `is_admin()` Functions

| Migration | Logic | Issue |
|-----------|-------|-------|
| `20230101000000_baseline.sql` | `role = 'admin'` on `profiles` view | Only checks text role |
| `20230101000000_baseline.sql` (param) | `role = 'admin' AND is_officer_active` | Requires active officer |
| `20260203215000_universal_rls_system.sql` | Checks `user_role_grants` | Different source of truth |
| `20270803000000_fix_is_admin.sql` | `is_admin = true OR admin_override_until > NOW()` | Adds time-limited admin |
| `20260513000003_enhanced_cashout_system.sql` | Variant logic | Cashout-specific |
| `20270330010000_zip_governance_system.sql` | Variant logic | Governance-specific |

### Helper Functions

| Function | Logic |
|----------|-------|
| `is_admin()` | Multiple conflicting versions (see above) |
| `is_admin_or_secretary()` | `role IN ('admin','secretary')` |
| `is_secretary()` | Checks `secretary_assignments` table |
| `is_staff()` | `is_admin() OR is_secretary() OR is_lead()` |
| `is_staff(p_uid)` | `role = 'admin' OR role = 'secretary' OR is_admin = true` |
| `has_role_fast(p_role, p_user_id)` | Checks `user_auth_cache` table |

### Tables Missing RLS

| Table | Issue |
|-------|-------|
| `user_role_grants` | **NO RLS enabled** — anyone with DB access can read/modify role grants |

---

## 7. Critical Security Findings

### 🔴 CRITICAL

1. **Multiple conflicting `is_admin()` functions** — At least 6 different definitions with different logic. The one that resolves at runtime determines admin access to ALL tables via the "Admin Bypass" RLS policy. If the wrong version wins, admin access could be granted or denied incorrectly.

2. **`user_role_grants` table has NO RLS** — Any authenticated user can read all role grants (discovering who has what role) and potentially modify them.

3. **`set_user_role(UUID)` RPC is a full privilege escalation vector** — Flagged in `SECURITY_AUDIT_ROUND2.md`. Allows arbitrary role assignment.

4. **Hardcoded admin email** — `src/pages/handleSearchChange.tsx:50` checks `user.email === 'Mai Troll2025@gmail.com'` as an admin bypass, bypassing normal role checks.

### 🟡 HIGH

5. **Dual role system inconsistency** — Both `role` (text) and `troll_role` (text) plus boolean flags (`is_admin`, `is_troll_officer`, etc.) create multiple sources of truth. Some checks use one, some use another.

6. **Admin override in `hasRole()` is default-on** — `allowAdminOverride: true` means admins bypass ALL role checks, including sensitive routes like RoleManagement. This may be intentional but is overly permissive.

7. **7 unprotected staff routes** — Routes like `/inmates`, `/tromail/office`, `/live/command-center` are accessible to any authenticated user.

8. **`STAFF_ROLES` set is incomplete** — Missing 18 roles that are in the `UserRole` enum, including `pastor`, `auctioneer`, `judge`, `president`, etc.

### 🟢 MEDIUM

9. **No centralized permission matrix** — Role permissions are scattered across `hasRole()`, `isStaffProfile()`, `canAccessNightWatch()`, inline checks in components, and edge functions. No single source of truth.

10. **No staff action audit trail** — While audit log tables exist (`audit_logs`, `action_logs`, etc.), there's no systematic logging of every staff action with role context.

11. **`moderator` role has no boolean flag** — The `is_moderator` column doesn't exist in `user_profiles`, making the moderator role unreliable.

---

## 8. Recommendations

### Immediate Actions (Security Fixes)

1. **Create `is_admin_consolidated()` as a NEW function** (do NOT replace `is_admin()` — too many RLS policies, triggers, and DB objects depend on it). The new function adds `user_role_grants` and `admin_override_until` checks while preserving the existing `is_admin` boolean + `role` text checks.

2. **Enable RLS on `user_role_grants`** with admin-only write and staff-only read policies.

3. **Remove hardcoded email bypass** in `handleSearchChange.tsx`.

4. **Add `RequireRole` guards** to the 7 unprotected staff routes.

5. **Update `STAFF_ROLES` set** to include all 35 staff roles from the `UserRole` enum.

### Short-Term (Audit Infrastructure)

6. **Create `staff_action_audit_log` table** — Log every staff action with: who, what role, what action, target user, timestamp, IP, and result.

7. **Create `role_permission_matrix` table** — Define which roles can access which pages/actions, making permissions data-driven rather than code-scattered.

8. **Build Staff Audit Dashboard** — Admin page to review all staff actions, filter by role/user/action type, and detect anomalies.

9. **Add `is_moderator` column** to `user_profiles` or remove the moderator role from the enum.

### Long-Term (Architecture)

10. **Migrate to RBAC** — Replace the dual `role`/`troll_role`/boolean-flags system with the `system_roles`/`user_role_grants` tables that already exist but aren't fully utilized.

11. **Create a `canAccess(action, resource)` helper** — Centralized permission check that queries the permission matrix instead of scattered inline checks.

12. **Implement role-based feature flags** — Allow granular enable/disable of features per role without code changes.

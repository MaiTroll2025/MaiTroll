# Employees Office — Consolidation Plan

**Goal:** Replace all scattered non-admin Mai Troll employee dashboards (officer, lead officer, secretary, CEO assistant, Noah assistant, HR, scheduling, clock-in, applications) with ONE unified internal employee page at **`/Employees`**. Every approved employee role uses this single page; tabs, actions, and permissions are driven by the logged-in member's role. The Admin Dashboard (`/admin` and related admin routes) and the CEO's personal admin page are **untouched**.

> Status: STAGE 1 (foundation + core tabs). Old pages are retained (not deleted) and old routes redirect to `/Employees`. Old nav links remain until each feature's migration is verified (per instructions: "Do not delete an old page until all of its working logic has been successfully moved and verified").

---

## 1. Pages being consolidated

| Source page | Route(s) | Migrated into Employees tab(s) |
|---|---|---|
| `src/pages/officer/OfficerDashboard.tsx` | `/officer/dashboard` | Office Home, Clock In |
| `src/components/officer/OfficerClock.tsx` | (used by officer dash) | Clock In |
| `src/components/hr/ClockInPanel.tsx` | (HR Center) | Clock In |
| `src/pages/OfficerScheduling.tsx` | `/officer/scheduling` | Schedule |
| `src/components/officer/OfficerShiftCalendar.tsx` | (used by dashi) | Schedule |
| `src/pages/officer/OfficerPayrollDashboard.tsx` | `/officer/payroll` | Payroll (replaced by new real payroll) |
| `src/pages/lead-officer/LeadOfficerDashboard.tsx` | `/lead-officer` | Management, Hiring, Attendance |
| `src/pages/lead-officer/TimeOffRequestsList.tsx` | (lead dash) | Schedule (time-off) |
| `src/pages/lead-officer/Review.tsx` | (lead dash) | Reports/Dept Tools |
| `src/pages/OfficerOWCDashboard.tsx` | `/officer/owc` | Department Tools (Officer Work Credit) |
| `src/pages/OfficerModeration.tsx` | `/officer/moderation` | Department Tools (Officer) |
| `src/pages/OfficerVote.tsx` | `/officer/vote` | Department Tools (Officer) |
| `src/pages/TrollOfficerLounge.tsx` | `/officer/lounge` | Chat, Schedule (time-off), Reports |
| `src/pages/secretary/SecretaryConsole.tsx` | `/secretary` | Management → Assistant Workspace |
| `src/pages/ceo-assistant-dashboard.tsx` | `/ceo-assistant-dashboard` | Management → Assistant Workspace |
| `src/pages/noah-assistant-dashboard.tsx` | `/noah-assistant-dashboard` | Management → Assistant Workspace |
| `src/pages/HRCenter.tsx` | `/hr-center` | Office Home, Applications, Clock In, Payroll, Attendance, Records |
| `src/pages/agency-hr-dashboard.tsx` | `/agency-hr-dashboard` | Dept Tools (Agency HR) — kept separate role |
| `src/pages/Career.tsx` + `src/pages/Application.tsx` | `/careers`, `/apply` | Applications (career flow reused) |

**Explicitly NOT consolidated:** `/admin*`, CEO personal admin page (`src/pages/CEOAssistantDashboard.tsx`), Tromail/UTroMail, public pages.

## 2. Routes being redirected to /Employees

`/officer`, `/officer/dashboard`, `/officer/scheduling`, `/officer/payroll`, `/officer/owc`, `/officer/moderation`, `/officer/vote`, `/officer/lounge`, `/lead-officer`, `/secretary`, `/ceo-assistant-dashboard`, `/noah-assistant-dashboard`, `/hr-center`. (Old page files stay until verified; redirects preserve bookmarks.)

## 3. Features being moved (mapped to tabs)

Shared tabs: **Office Home, Clock In, Schedule, Chat, Tasks, Reports, Announcements, Change Requests, Frontend Studio, Department Tools, Management, Hiring, Attendance, Employees Records**.

- Clock In/Attendance → reuse `manual_clock_in/out/start_break/end_break` RPCs + `officer_work_sessions` + `officer_shift_slots`; add corrections/audit.
- Schedule → reuse `officer_shift_slots` + time-off requests; managers can create/edit/publish.
- Chat → new `employee_chat_messages` + channels (All Employees, Troll Officers, Lead Troll Officers, Assistants, Secretary Office, Management, Safety, Announcements, Platform Changes, Scheduling) with RLS by role.
- Announcements → new `employee_announcements` + acknowledgements.
- Tasks → new `employee_tasks`.
- Reports → new `employee_reports` (replaces ad-hoc officer reports) with statuses + routing to supervisor.
- Change Requests → new `employee_change_requests` (vote, comment, attach; no auto-approve).
- Frontend Studio → new `frontend_studio_drafts` (gated; config-only, no code exec/SQL/terminal).
- Payroll → new `employee_payroll_runs` + `employee_paystubs` + `employee_perk_pay`; MAI CORP / Mai Mai Troll; real location/state tax fields; PDF paystub (jsPDF). Secretary + CEO + admin can edit payroll; all employees can view/download their own.
- Applications → reuse `career_positions` + `job_applications`; apply, view status, on hire grant role + add to payroll + onboarding tasks.
- Hiring → role-gated hire/fire/suspend with reason + confirmation + audit + notification; Troll Officers cannot hire/fire; Lead Troll Officers only for Troll Officers.
- Attendance → `officer_work_sessions` history, corrections (management), excused/unexcused (management), audit.
- Management → Assistant Workspace (Secretary/CEO Assistant/Noah Assistant), Officer Operations (Lead), Perk Pay (Lead/Secretary), Disciplinary Actions, audit history, role preview (admin).
- Department Tools → role-specific tools (Officer: moderation/OWC/vote/lounge; Agency HR; etc.).
- Employees Records → `employee_records` (profile, employment status, history) read by management.

## 4. Affected database objects (new migration `20260711000000_employees_office.sql`)

New tables: `employee_announcements`, `employee_announcement_acks`, `employee_tasks`, `employee_reports`, `employee_change_requests`, `employee_change_request_votes`, `employee_chat_messages`, `employee_chat_channels`, `frontend_studio_drafts`, `employee_payroll_runs`, `employee_paystubs`, `employee_perk_pay`, `employee_records`, `employee_disciplinary_actions`, `employee_supervisors`, `employee_audit_log`.
Reused existing tables: `officer_work_sessions`, `officer_shift_slots`, `officer_time_off_requests`, `career_positions`, `job_applications`, `user_profiles`, `role_change_log`.
New RPCs: `log_employee_audit(p_actor, p_target, p_action, p_prev, p_new, p_reason, p_dept, p_record)`, `run_employee_payroll(p_period_start, p_period_end, p_actor)`, `employee_can(p_user, p_action)`.
RLS: every new table restricted by role/employment status server-side; channel/announcement visibility enforced via RPCs + policies; audit log insert-only for non-admins; payroll write limited to secretary/ceo/admin; chat channel membership enforced by policy.
Realtime: one publication `supabase_realtime` add for new tables; single shared channel groups per purpose (`employees:general`, `employees:chat`, `employees:presence`).

## 5. Permissions preserved / changed

- Preserved: existing `is_troll_officer`, `is_lead_officer`, `role` values (`secretary`, `ceo_assistant`, `noah_assistant`, etc.), `RequireRole`, `hasRole`, `hasPermission`.
- Centralized: `src/features/employees/permissions.ts` exposes `getEmployeeTabs(profile)` and `can(profile, action)`; RLS duplicates these checks server-side.
- Changed: Troll Officer cannot call hire/fire RPCs (RLS blocks). Lead Troll Officer hire/fire limited to managed roles. Payroll edits limited to secretary/ceo/admin. Frontend Studio publish limited to design/dev/management/admin.
- Terminated/inactive employees: `employee_records.employment_status != 'active'` → `/Employees` redirects to access-denied (RLS blocks all employee tables).

## 6. Migration order

1. DB migration (tables, RLS, RPCs, realtime).
2. `src/features/employees/types.ts`, `permissions.ts`.
3. `EmployeesPage` shell + `PermissionGate` + `OnlineEmployees` + layout.
4. Route `/Employees` + redirects + nav entry in `App.tsx` + `Sidebar.tsx` + `BottomNavigation.tsx` + `BottomNavBar.tsx`.
5. Tabs (shared first, then role-specific) — migrate logic, preserve behavior.
6. Verify each role; remove old nav links; (later) delete old page files.
7. Typecheck + smoke test per role.

## 7. Testing required per role

- **Troll Officer:** can clock in/out, view schedule, submit report to Lead, view announcements, complete tasks, use Troll Officer tools, CANNOT see Management/Hiring/Payroll-edit, CANNOT hire/fire (verify RPC blocked).
- **Lead Troll Officer:** above + manage officer reports, hire/fire Troll Officers only, set perk pay, view attendance corrections, disciplinary actions.
- **Secretary:** Assistant Workspace + set perk pay + bypass Lead pay, executive messages, documents.
- **CEO Assistant / Noah Assistant:** Assistant Workspace, reports, documents; NO CEO personal admin.
- **Admin:** all tabs + role preview mode; Admin Dashboard still separate.
- **Terminated:** `/Employees` blocked.

## 8. Open follow-ups (post Stage 1)

- Delete old page files after each tab's logic verified in staging.
- Remove old nav links after redirects confirmed.
- Wire `employee_supervisors` assignments for all roles (seed from existing officer hierarchy + secretary→CEO).
- Pagination for chat/reports/audit/records.

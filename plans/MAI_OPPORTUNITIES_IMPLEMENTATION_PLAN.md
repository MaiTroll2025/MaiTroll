# MAI OPPORTUNITIES — Implementation Plan (STEP 1 Audit + STEP 2 Plan)

## STEP 1 — AUDIT

### 1. Current Routing (`src/App.tsx`)
- Routes render inside `<AppLayout>` (line 1655). Public routes have no auth gate; protected routes use `<RequireAuth />`.
- **Academy routes** live at lines 1782-1815 (20 routes, `/academy` → `/academy/assignments`).
- `/academy` root → `UnderConstructionPage` (placeholder, opens Oct 1 2026).
- Academy admin routes use `<RequireRole roles={[UserRole.ADMIN]}>`.
- Catch-all: `/:username` → `UsernameRedirect`, `*` → `/` (must be last).
- No existing `/mai-opportunities` routes.

### 2. Sidebar (`src/components/Sidebar.tsx`)
- Academy section at lines 660-675: "Mai Troll Academy" with tiles: Academy, Courses, Certificates, Admissions, Classroom, Teacher Dashboard (if `isTeacher`), Board of Education (if `isAdmin`), Assignments, Teachers, My Loans, Transcript.
- `src/lib/isActive.tsx` is a **legacy duplicate** (not imported anywhere — safe to ignore).

### 3. Bottom Navigation (`src/components/BottomNavigation.tsx`)
- Line 633: Academy is a menu option under "Careers + Work". This is the new OS-style bottom nav shown on all screen sizes (AppLayout line 71-73, 271-273). Must replace Academy here too.

### 4. Authentication (`src/lib/store.ts` + `src/lib/supabase.ts`)
- Zustand `useAuthStore` persists `troll-city-auth`. Session via `supabase.auth.getSession()`.
- `auth.uid()` is the authenticated identity (Supabase).
- **`user_profiles` table** has: `role` (text, default `'user'`), `troll_role` (text), `is_admin` (boolean), plus boolean staff flags (`is_ceo`, `is_secretary`, `is_attorney`, etc.).
- **`UserRole` enum** (`src/lib/supabase.ts:585`) — 36 values. Includes `ACADEMY_TEACHER`, `ACADEMY_STUDENT`, `ACADEMY_DIRECTOR`, `ADMISSIONS_OFFICER`. No `student` or `instructor` values.
- **`hasRole()`** (line 968) — checks `profile.role`, `profile.troll_role`, boolean staff flags, and "god mode" (`is_admin`, `ADMIN`, `superadmin`, `ceo`, `owner`). **`instructor`/`student` do NOT match god-mode** → safe.
- **`RequireRole`** component wraps admin-gated routes.
- **`set_user_role` RPC** (migration `20260911000001`) — SECURITY DEFINER, admin-only, updates both `role` and `troll_role` columns. Reusable for instructor approval.

### 5. Existing Role Architecture
- `role` column is **text** (not an enum) → can safely add `instructor` and `student` string values.
- `troll_role` column is **text** → mirrors `role` for staff.
- **No** existing `student` or `instructor` role values. Both are purely additive.
- Setting `role = 'instructor'` does NOT grant any career dashboard access (verified: `isAdmin`, `isCEO`, `isOfficer`, etc. checks do not include `instructor`).

### 6. Existing Academy Implementation (`src/pages/academy/`)
- Academy pages exist but `/academy` root is a placeholder (`UnderConstructionPage`).
- `academy_teachers` table (defined in `supabase/migrations_backup3/20290610000000_troll_city_academy.sql`) tracks teacher applications with `user_id`, `is_approved`. Used by `usePhoneRoleAccess` (line 267-274).
- **Conflict note:** Existing Academy has its own teacher system. Mai Opportunities will use a **separate** `mai_opportunities_` namespace for instructors. The `mai_opportunities_profiles` table will track program roles independently.

### 7. Phone Navigation (DO NOT MODIFY — per spec)
- `src/phone/PhoneApp.tsx` — has `/academy` routes (lines 219, 248-250).
- `src/phone/PhoneDrawer.tsx` — Academy entry (line 81).
- `src/phone/phoneNav.ts` — Academy section (lines 102-124).
- `src/phone/PhoneWebApp.tsx` — Academy path handling (lines 28, 37-38).
- **Mai Opportunities will NOT be added to any phone file.**

### 8. RLS Conventions
- Pattern: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` then `DROP POLICY IF EXISTS ... ; CREATE POLICY ...`.
- Helper functions (e.g., `singoff_is_staff`) check `user_profiles` columns server-side.
- `SECURITY DEFINER` functions use `SET search_path = public` and `GRANT EXECUTE ... TO authenticated, service_role`.
- `auth.uid()` used for user scoping.

### 9. Storage
- Buckets created via migration SQL (e.g., `20260901000002_create_camera_off_images_bucket.sql`, `20270101000000_ensure_covers_bucket.sql`).
- Storage uses Supabase bucket policies.

### 10. PDF Generation
- `src/lib/loanApplicationPDF.ts` — uses `jspdf` + `jspdf-autotable`, client-side generation with `downloadLoanApplicationPDF()`.
- No server-side PDF generation found; all PDF is client-side via jsPDF.

### 11. Supabase Edge Functions
- Located in `supabase/functions/` with `index.ts` per function.
- Import from `_shared/supabaseClient.ts` (service-role key, `persistSession: false`).
- CORS via `_shared/cors.ts`.
- Authentication via `auth.uid()` from the JWT in the request.

---

## STEP 2 — Implementation Plan

### Phase A: Database (STEP 3-4)

**Migration 1: `20260913000001_add_mai_business.sql`** — 17 tables:

| Table | Key Columns | PK Type |
|---|---|---|
| `mai_opportunities_profiles` | `user_id` (FK→user_profiles), `program_role` (`student`/`instructor`), `enrollment_date`, `completion_date`, `is_active` | uuid |
| `mai_opportunities_applications` | `user_id` (FK), `type` (`instructor`/`admin`), `status` (`pending`/`approved`/`denied`), `name`, `email`, `expertise`, `bio`, `credential_info`, `reviewed_by`, `reviewed_at` | uuid |
| `mai_opportunities_businesses` | `user_id` (FK), `business_name`, `business_idea`, `business_stage`, `industry`, `monthly_budget`, `funding_requested` | uuid |
| `mai_opportunities_courses` | `title`, `description`, `duration_weeks`, `is_active`, `is_default` | uuid |
| `mai_opportunities_course_modules` | `course_id` (FK), `week_number`, `title`, `description`, `order_index` | uuid |
| `mai_opportunities_lessons` | `module_id` (FK), `title`, `content` (JSONB), `objectives`, `examples`, `key_terms`, `order_index` | uuid |
| `mai_opportunities_progress` | `user_id` (FK), `course_id` (FK), `module_id` (FK), `lesson_id` (FK), `status` (`available`/`in_progress`/`completed`/`locked`), `completed_at`, `progress_percent` | uuid |
| `mai_opportunities_assessments` | `module_id` (FK), `title`, `questions` (JSONB), `passing_score`, `max_attempts` | uuid |
| `mai_opportunities_assessment_attempts` | `user_id` (FK), `assessment_id` (FK), `score`, `passed`, `attempt_number`, `answers` (JSONB), `attempted_at` | uuid |
| `mai_opportunities_business_plans` | `user_id` (FK), `title`, `data` (JSONB), `version`, `status`, `submitted_at`, `reviewed_at` | uuid |
| `mai_opportunities_funding_programs` | `name`, `organization`, `funding_type`, `award_range`, `eligibility`, `geography`, `industry_restrictions`, `requirements`, `deadline`, `official_source`, `application_url`, `last_verified_date`, `status` | uuid |
| `mai_opportunities_funding_applications` | `user_id` (FK), `program_id` (FK), `status` (`draft`/`submitted`/`under_review`/`needs_information`/`approved`/`denied`/`withdrawn`/`completed`), `requested_amount`, `submitted_at`, `decision_at`, `reviewer_id`, `decision_notes` | uuid |
| `mai_opportunities_grant_allocations` | `application_id` (FK), `amount`, `status`, `reviewer_id` (FK→user_profiles), `allocated_at`, `reason` | uuid |
| `mai_opportunities_documents` | `user_id` (FK), `type`, `file_path`, `file_name`, `file_size`, `status`, `version` | uuid |
| `mai_opportunities_resources` | `name`, `description`, `category`, `official_source`, `url`, `geography`, `last_verified_date`, `status` | uuid |
| `mai_opportunities_activity_log` | `user_id` (FK), `actor_id` (FK→user_profiles), `action`, `category`, `target_type`, `target_id`, `previous_value` (JSONB), `new_value` (JSONB), `metadata` (JSONB), `created_at` | uuid |
| `mai_opportunities_certificates` | `user_id` (FK), `course_id` (FK), `identifier`, `type`, `title`, `issue_date`, `expiry_date`, `status`, `pdf_path`, `final_exam_score`, `final_exam_passed`, `course_completion_date`, `eligibility` (JSONB) | uuid |

**Migration 2: `20260913000002_add_mai_business_course.sql`** — Default 8-week "Entrepreneurship Fundamentals" course with 8 modules, ~7 lessons each, weekly assessments, final exam.

**Migration 3: `20260913000003_add_mai_business_resources.sql`** — Seed verified resources (SBDCs, SBA, IRS, etc.) and funding programs (SBA loans, grants — all with official sources/URLs).

**Migration 4: `20260913000004_add_mai_business_rls.sql`** — RLS on all 17 tables. User-scoped (`auth.uid() = user_id`) for private data; public read for courses/lessons/resources/funding programs; admin/instructor-scoped where appropriate.

**Migration 5: `20260913000005_add_mai_business_functions.sql`** — Secure RPCs:
- `mai_opp_is_admin(p_user_id)` — checks `user_profiles` for admin/CEO/superadmin
- `mai_opp_is_instructor(p_user_id)` — checks `mai_opportunities_profiles.program_role = 'instructor'`
- `validate_funding_availability(p_program_id, p_amount)` — checks program budget/availability
- `allocate_funding(p_application_id, p_amount)` — SECURITY DEFINER, transactional, prevents over-allocation
- `update_lesson_progress(p_user_id, p_lesson_id, p_status)` — server-side progress
- `submit_funding_application(p_application_id)` — validates and transitions to `submitted`
- `approve_instructor_application(p_application_id, p_decision, p_notes)` — admin-only, sets `user_profiles.role = 'instructor'`

**Migration 6: `20260913000006_add_mai_business_triggers.sql`** — Activity logging triggers on insert/update for all tables → writes to `mai_opportunities_activity_log`.

**Migration 7: `20260913000007_add_mai_business_indexes.sql`** — Indexes on `user_id`, `status`, `course_id`, `lesson_id`, `funding_program_id`, `document_type`, `category`, `actor_id`, `target_type`/`target_id`, `created_at`.

### Phase B: Core UI (STEP 5)

**Files to modify:**
- `src/App.tsx` — Add `/mai-opportunities/*` routes (13 routes). Redirect `/academy` → `/mai-opportunities/dashboard`. Keep existing Academy routes intact (do NOT delete — spec says "decommission or redirect without breaking").
- `src/components/Sidebar.tsx` — Replace "Mai Troll Academy" section (lines 660-675) with "Mai Opportunities" section using the 11 dashboard cards.
- `src/components/BottomNavigation.tsx` — Replace Academy (line 633) with Mai Opportunities.

**Files to create:**
- `src/features/mai-opportunities/` — Feature directory
  - `layout/MaiOppsLayout.tsx` — layout wrapper
  - `pages/MaiOppsLanding.tsx` — landing page
  - `pages/MaiOppsDashboard.tsx` — dashboard with 11 cards
  - `pages/MaiOppsBusiness.tsx` — business profile
  - `pages/MaiOppsStartBusiness.tsx` — start business education
  - `pages/MaiOppsEducation.tsx` — 8-week course
  - `pages/MaiOppsCredit.tsx` — credit education
  - `pages/MaiOppsFunding.tsx` — funding center
  - `pages/MaiOppsApplication.tsx` — funding application workflow
  - `pages/MaiOppsProgress.tsx` — progress tracking
  - `pages/MaiOppsResources.tsx` — resources directory
  - `pages/MaiOppsDocuments.tsx` — document system
  - `pages/MaiOppsHelp.tsx` — help & resources
  - `pages/MaiOppsAdmin.tsx` — admin dashboard
  - `pages/MaiOppsInstructorApplication.tsx` — instructor signup flow
- `src/lib/maiOpportunities.ts` — Supabase client helpers for Mai Opportunities

### Phase C: Business Plan / PDFs (STEP 6)
- `src/lib/maiPlanPDF.ts` — PDF generation (reuse `jspdf` + `jspdf-autotable` pattern)
- Mai stamp component/element for official documents

### Phase D: Funding (STEP 7)
- Funding opportunity directory
- Application workflow with server-side status transitions
- Atomic allocation via `allocate_funding` RPC

### Phase E: Admin / CEO / Instructor (STEP 8-9)
- Admin dashboard (courses, modules, assessments, resources, funding programs, applications, certificates)
- CEO dashboard (user-by-user view, audit log, funding overview)
- Instructor dashboard (manage modules/lessons, grade assessments, view student progress)

### Phase F: Testing (STEP 10)
- Run `npm run lint` and `npm run build`
- Browser checks for routing, auth gating, RLS

### Role Model
- **Instructor role**: `mai_opportunities_profiles.program_role = 'instructor'` is the authoritative label. When approved via the `approve_instructor_application` RPC (admin-only), `user_profiles.role` and `user_profiles.troll_role` are also set to `'instructor'`. Instructor access is **scoped** — no career dashboard privileges are granted.
- **Student label**: Authenticated users get `mai_opportunities_profiles` with `program_role = 'student'`. This is the "citizen/student" label. Existing `user_profiles.role` remains `user` (no breaking changes to game functionality).
- **Admin/CEO/Superadmin**: Reuse existing `is_admin`, `is_ceo`, `role IN ('admin','superadmin','ceo','owner')` checks server-side.

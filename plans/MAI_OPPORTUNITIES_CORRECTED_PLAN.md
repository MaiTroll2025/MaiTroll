# MAI OPPORTUNITIES - CORRECTED IMPLEMENTATION PLAN

## Architecture Audit + Security Review + Corrected Specification

**Document Version:** 2.0  
**Date:** 2026-09-13  
**Status:** NOT READY FOR MIGRATION  
**Based On:** MAI_OPPORTUNITIES_STRATEGIC_PLAN.md v1.0 (Sections 1–48)

---

# SECTION A: CRITICAL ISSUES FOUND

## A.1 Authentication Contradiction (CRITICAL)

Original plan Section 47 states "Any authenticated MAiTROLL user can use Mai Opportunities" but original prompt implies student verification may be prerequisite for certain features. Three distinct concepts were conflated:

1. MAiTROLL account-creation eligibility (student verification)
2. Mai Opportunities program access (any authenticated user)
3. Funding-program eligibility (configured per program)

**Resolution:** These are separate tiers. Student verification is for MAiTROLL account creation only. Any authenticated user accesses Mai Opportunities. Funding eligibility is configured per funding program.

## A.2 Funding Allocation Race Condition (CRITICAL)

Funding availability check described as CHECK then INSERT then UPDATE as three independent operations. Concurrent admins could over-allocate.

**Resolution:** Must use BEGIN/COMMIT transaction with SELECT ... FOR UPDATE row locking. Allocation, availability update, and audit record must be atomic.

## A.3 Client-Supplied Actor ID Trust (CRITICAL)

Functions accept user_id, reviewer_id, actor_id as parameters. Client-supplied and untrusted. User could set actor_id = admin to bypass authorization.

**Resolution:** All actor IDs derive from auth.uid() server-side. Function parameters exclude actor IDs. Authorization determined by role check on auth.uid().

## A.4 Audit Log Immutability Violation (CRITICAL)

"Users log own activity" INSERT policy allows users to insert arbitrary audit records like "funding approved" or "certificate issued."

**Resolution:** Remove INSERT policy for authenticated users. Audit events only from database triggers and trusted server-side functions. Users cannot UPDATE or DELETE audit records. Corrections create new events.

## A.5 Audit Log Actor vs Subject Confusion (CRITICAL)

Activity log trigger risks treating affected user as actor. CEO approves John's funding: actor_id should be CEO, user_id should be John.

**Resolution:** Strict separation: user_id/subject_id = whose record was affected, actor_id = who performed the action. System events have system actor representation.

## A.6 Funding Opportunity Is Not Funding Available (CRITICAL)

External funding opportunities listed in mai_opportunities_funding_programs are NOT money Mai Opportunities possesses. Grants.gov listing is a directory entry, not Mai Opportunities' funds.

**Resolution:** Two separate entity hierarchies: (1) external opportunity directory listings, (2) internal funding sources that Mai Opportunities actually controls. Allocations only from internal sources.

## A.7 No Atomic Funding Transaction (CRITICAL)

Allocation described without row locking or transaction wrapping.

**Resolution:** BEGIN transaction, lock funding source row with SELECT ... FOR UPDATE, verify availability, create allocation, update allocated amount, create audit record, COMMIT.

## A.8 Audit Logs Log Secrets (HIGH)

Triggers use to_jsonb(OLD)/to_jsonb(NEW) which would log passwords, tokens, and credentials if those columns exist.

**Resolution:** Create sanitization function that strips sensitive columns before logging. Never store raw passwords, tokens, keys, or payment credentials in audit log.

## A.9 Student Verification = Access Misunderstanding (HIGH)

Student verification and Mai Opportunities access are confused in the plan.

**Resolution:** Three-tier model: account creation eligibility (verification) is separate from program access (any authenticated user) which is separate from funding eligibility (per-program configuration).

## A.10 Dashboard Inconsistency (MEDIUM)

Dashboard example shows "Education: 3 / 14 Days" but course is 8 weeks.

**Resolution:** Update to "Education: 3 / 8 Weeks" consistently.

## A.11 Insufficient RLS Granularity (HIGH)

Generic "Admin read all" policies for all tables without role distinction.

**Resolution:** Per-table RLS matrix: define read/write/insert/update/delete for each role (owner, staff, admin, CEO, superadmin) per table.

## A.12 No Funding Ledger/Accounting Model (HIGH)

Simple total_available/total_allocated without provenance.

**Resolution:** Add funding ledger table tracking received, allocated, disbursed, returned amounts per source per program.

## A.13 Client-Side PDF as Official Document (HIGH)

PDF generation via client-side jsPDF without trusted server record.

**Resolution:** Require server-side document record in mai_opportunities_documents before PDF generation. PDF path stored in documents table. Generation logged.

## A.14 No Database Constraints (HIGH)

Tables lack foreign keys, CHECK constraints for funding amounts, score ranges, status values, required relationships.

**Resolution:** Add comprehensive constraints: foreign keys on all FKs, nonnegative funding amounts, valid enums, required NOT NULL fields, valid percentage/score ranges.

## A.15 Assessment Answer Key Exposure (HIGH)

Assessment questions stored as JSONB visible via RLS SELECT.

**Resolution:** Never store answer keys in assessment questions JSONB. Questions contain prompts only. Answer keys stored separately with admin-only access. Server-side grading.

## A.16 Certificate Eligibility Client-Settable (HIGH)

certificate_eligibility could be set by client.

**Resolution:** Server-only derivation. Issue certificate only via SECURITY DEFINER function that validates all completion requirements.

## A.17 Migration Order Problems (MEDIUM)

Functions before RLS policies, triggers before functions, indexes in separate migration.

**Resolution:** Correct order: Schema (tables + constraints + basic indexes + basic RLS) -> Functions -> Triggers -> Detailed RLS -> Seed data -> Performance indexes.

## A.18 No Separation of Application Decision vs Financial Allocation (MEDIUM)

Application status and financial allocation collapsed into one flow.

**Resolution:** Application decision = administrative (approved/denied conceptually). Financial allocation = separate financial commitment. Application approved does not guarantee funds.

## A.19 Delete Cascade Audit Risk (MEDIUM)

ON DELETE CASCADE on all tables to auth.users destroys audit history.

**Resolution:** Use ON DELETE RESTRICT on audit-bearing tables. Preserve historical records. Set user_id to NULL or anonymize in audit log on user deletion.

## A.20 Nonprofit Legal Claims (MEDIUM)

Plan describes "nonprofit" without verified status.

**Resolution:** Use "intended nonprofit entrepreneur-development program model" language. No claims of 501(c)(3), tax-exempt, or charitable status without verification.

## A.21 Phone App Navigation Inconsistency (LOW)

Phone app excluded but PhoneDrawer/phoneNav still reference Academy.

**Resolution:** Remove Academy from phone navigation. Add note that Mai Opportunities is web-only.

## A.22 No External vs Internal Funding Separation (HIGH)

mai_opportunities_funding_programs conflates external listings with internal program definitions.

**Resolution:** Separate table: mai_opportunities_funding_sources for internal funding (when Mai Opportunities has funds). External opportunities are directory entries only.

## A.23 Sensitive Eligibility Fields (MEDIUM)

Citizenship, immigration, criminal history mentioned without access restrictions.

**Resolution:** Restrict to admin/CEO only, encrypt at rest, only store when actual funding program requires them. Configure per program, not hardcoded.

## A.24 Admin Dashboard Permission Granularity (HIGH)

No distinction between CEO, admin, superadmin, reviewer, staff.

**Resolution:** Scoped permission matrix defining exactly what each role can do within Mai Opportunities. Not all admins can manage funding. Not all staff have financial access.

## A.25 External URL Security (LOW)

URLs stored without validation.

**Resolution:** Validate URLs (prefer HTTPS), sanitize on input, validate on display. Prevent javascript:, file:, and other unsafe protocols.

---

# SECTION B: REQUIRED CORRECTIONS

| Issue | Correction |
|-------|-----------|
| A.1 | Three-tier access model: account creation, program access, funding eligibility |
| A.2 | Atomic transaction with SELECT FOR UPDATE and row locking |
| A.3 | Derive all actor IDs from auth.uid(). No client-supplied actor IDs |
| A.4 | Remove user INSERT on audit log. Triggers and functions only |
| A.5 | Strict separation: actor_id (who acted) vs user_id/subject_id (whose record) |
| A.6 | Split: external opportunity directory vs internal funding sources |
| A.7 | BEGIN/COMMIT with FOR UPDATE locking on allocation |
| A.8 | Sanitization function for audit before/after values |
| A.9 | Per-program funding eligibility configuration |
| A.10 | Dashboard: "3 / 8 Weeks" |
| A.11 | Per-table, per-role RLS policy matrix |
| A.12 | Funding ledger: received, allocated, disbursed, returned |
| A.13 | Server-side document record required before PDF generation |
| A.14 | Comprehensive DB constraints: FKs, CHECKs, NOT NULLs |
| A.15 | Separate assessment questions from answer keys |
| A.16 | Certificate eligibility derived server-side only |
| A.17 | Reorder migrations: Schema -> Functions -> Triggers -> RLS -> Data -> Indexes |
| A.18 | Separate application decision from financial allocation |
| A.19 | ON DELETE RESTRICT for audit-bearing tables |
| A.20 | Use "intended nonprofit model" language |
| A.21 | Remove Academy from phone navigation |
| A.22 | Separate external directory from internal funding |
| A.23 | Restrict sensitive fields to admin/CEO only, encrypt at rest |
| A.24 | Scoped permission matrix for admin roles |
| A.25 | URL validation, HTTPS enforcement |

---

# SECTION C: CORRECTED ARCHITECTURE

## C.1 Core Principles

1. **Single Authentication Source:** Supabase Auth (auth.users) ONLY
2. **Three-Tier Access:** Account Creation Eligibility, Program Access, Funding Eligibility are SEPARATE concerns
3. **Server-Authoritative:** All business logic, status transitions, financial operations execute server-side via SECURITY DEFINER functions and triggers
4. **No Social/Economic Funding Links:** Funding decisions NEVER reference Troll Coins, followers, views, broadcasts, gifts, battles, likes, popularity, social status, engagement, or broadcast activity
5. **Atomic Financial Operations:** All allocations use transactions with SELECT ... FOR UPDATE
6. **Immutable Audit:** Authoritative audit records originate only from trusted operations. Users cannot fabricate or modify audit history
7. **Minimal Data:** Collect only necessary data. PII minimized
8. **Expandable:** Supports adding courses, programs, resources without redesign

## C.2 Three-Tier Access Model

**Tier 1: Account Creation Eligibility** - Student verification (Hipo + IPEDS/NCES). Controls whether someone can create a student account in MAiTROLL. Does NOT determine Mai Opportunities access. Does NOT imply funding eligibility.

**Tier 2: Program Access** - Any authenticated MAiTROLL user. Controls access to Mai Opportunities features (education, courses, business plan, resources, directory). Funding applications may have additional requirements.

**Tier 3: Funding Eligibility** - Per-program configuration. Controls whether a user can apply for specific funding. Criteria include account age, status, participation, documentation. NEVER social/economic metrics.

**Tier 4: Funding Approval/Allocation** - Server-side only. Uses authorized reviewer + transparent criteria + atomic availability validation.

## C.3 System Boundaries

MAiTROLL = parent platform (auth, profiles, broadcasts, coins, court, messaging - unchanged)
Mai Opportunities = program subsystem (isolated tables, scoped access, separate funding model)

## C.4 Key Decisions

D1: No separate auth system. Use existing Supabase Auth sessions.
D2: External opportunity directory != Internal funding sources.
D3: No client-triggered financial operations. All via SECURITY DEFINER functions.
D4: Trigger-based audit. Users cannot insert/update/delete audit records.
D5: Subject-Actor separation in all audit records.

## C.5 Corrected RLS Model

| Table | Public Read | Auth Read | Owner Read | Owner Write | Staff | Admin | Server Only |
|-------|------------|-----------|------------|-------------|-------|-------|-------------|
| profiles | No | Yes | Yes | Yes | No | Yes | No |
| businesses | No | Yes | Yes | Yes | No | Yes | No |
| business_plans | No | Yes | Yes | Yes | No | Yes | No |
| courses | Yes | Yes | N/A | No | Yes | Yes | No |
| modules | Yes | Yes | N/A | No | Yes | Yes | No |
| lessons | Yes | Yes | N/A | No | Yes | Yes | No |
| progress | No | Yes | Yes | Fn only | No | Yes | No |
| assessments | Yes | Yes | N/A | No | Yes | Yes | No |
| assessment_attempts | No | Yes | Yes | Fn only | No | Yes | No |
| certificates | No | Yes | Yes | Admin | No | Yes | Yes |
| funding_programs | Yes | Yes | N/A | Admin | No | Yes | Yes |
| funding_applications | No | Yes | Yes | Owner draft | No | Yes | Yes |
| allocations | No | No | No | No | No | Yes | Yes |
| documents | No | Yes | Yes | Yes | No | Yes | Yes |
| resources | Yes | Yes | N/A | Admin | Yes | Yes | Yes |
| activity_log | No | No | No | No | No | Yes | Yes |

## C.6 Security Model

Actor derivation: auth.uid() -> role check -> authorization -> operation -> audit log
All functions: SET search_path, owned by admin role, selective EXECUTE grants, input validation, auth.uid() derivation, safe errors
Audit log: No user INSERT, UPDATE, or DELETE permissions. Populated by triggers and trusted functions only. Sanitized before/after values.
Documents: RLS + Storage policies match. Signed URLs. Server-side record required for official PDFs.

---

# SECTION D: CORRECTED DATABASE MODEL

## D.1 Table Inventory (19 Tables)

| # | Table | Purpose | Access |
|---|-------|---------|--------|
| 1 | mai_opportunities_profiles | User program profile | Owner + Admin |
| 2 | mai_opportunities_businesses | Business profiles | Owner + Admin |
| 3 | mai_opportunities_business_plans | Business plans | Owner + Admin |
| 4 | mai_opportunities_courses | Course definitions | Public + Admin |
| 5 | mai_opportunities_course_modules | Course modules | Public + Admin |
| 6 | mai_opportunities_lessons | Lesson content | Public + Admin |
| 7 | mai_opportunities_progress | User progress | Owner + Admin |
| 8 | mai_opportunities_assessments | Assessment definitions | Public + Admin |
| 9 | mai_opportunities_assessment_attempts | Assessment submissions | Owner + Admin |
| 10 | mai_opportunities_certificates | Completion certificates | Owner + Admin |
| 11 | mai_opportunities_funding_programs | External opportunity directory | Public + Admin |
| 12 | mai_opportunities_funding_sources | Internal funding (when applicable) | Admin only |
| 13 | mai_opportunities_funding_applications | User funding applications | Owner + Admin |
| 14 | mai_opportunities_grant_allocations | Financial allocations | Admin/CEO only |
| 15 | mai_opportunities_funding_ledger | Accounting ledger | Admin/CEO only |
| 16 | mai_opportunities_documents | User documents | Owner + Admin |
| 17 | mai_opportunities_resources | Resource directory | Public + Admin |
| 18 | mai_opportunities_activity_log | Audit log | Admin/CEO only |
| 19 | mai_opportunities_verification | Per-program eligibility | Admin only |

## D.2 Key Table Definitions

### D.2.1 mai_opportunities_profiles
- user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT (preserve audit)
- UNIQUE(user_id) - one profile per user
- program_status, business_status, education_status, application_status, funding_status (all CHECK constrained)
- course_progress INT CHECK (0-100)
- final_exam_status, final_exam_score, final_exam_attempts
- certificate_issued BOOLEAN (derived from server validation)
- NO duplicated email/name/role from user_profiles
- current_program_id for per-program eligibility tracking
- monthly_budget, funding_amount_requested CHECK >= 0

### D.2.2 mai_opportunities_business_plans
- user_id REFERENCES auth.users(id) ON DELETE RESTRICT
- version INT with unique(user_id, version) constraint
- status CHECK constrained
- submitted_snapshot JSONB for version history
- All plan content sections as TEXT or JSONB

### D.2.3 mai_opportunities_progress
- server_verified BOOLEAN (client cannot claim completion)
- verified_by_function TEXT (which function verified)
- All CHECK constraints for valid ranges

### D.2.4 mai_opportunities_assessment_attempts
- No answer key storage (user's submitted answers only)
- assessment_version TEXT for audit
- CHECK score >= 0 AND score <= 100

### D.2.5 mai_opportunities_certificates
- eligibility_verified_by UUID (admin who verified)
- eligibility_verified_at TIMESTAMPTZ
- pdf_path requires server-side storage record
- audit_event_id for traceability
- ON DELETE RESTRICT

### D.2.6 mai_opportunities_funding_programs (External Directory)
- NO total_available field (external opportunity, not Mai Opportunities' money)
- verification_status CHECK constrained
- verifier_id references auth.users(id)
- official_source_url separate from source_url
- ON DELETE RESTRICT

### D.2.7 mai_opportunities_funding_sources (Internal Funding - NEW)
- source_name, source_type (received_grant, internal_fund, donation, endowment)
- total_received, total_allocated, total_disbursed (all CHECK >= 0)
- CHECK: total_allocated <= total_received
- source_provenance (where/how funding was received)
- status CHECK constrained

### D.2.8 mai_opportunities_grant_allocations
- funding_source_id REFERENCES internal funding sources (not external programs)
- Immutable flag after finalization
- ON DELETE RESTRICT throughout
- reviewer_id from auth.uid() (NOT client-supplied)

### D.2.9 mai_opportunities_funding_applications
- application_decision (administrative: pending/approved_conceptually/denied/needs_info) - SEPARATE from financial outcome
- allocation_id links to allocation (SEPARATE concept)
- ON DELETE RESTRICT

### D.2.10 mai_opportunities_activity_log
- user_id = SUBJECT (whose record was affected)
- actor_id = ACTOR (who performed the action) - NOT nullable
- is_system_event BOOLEAN
- previous_value/new_value JSONB (SANITIZED - triggers call sanitize function)
- No INSERT policy for authenticated users
- UPDATE/DELETE policies = false (immutable)
- On user deletion: user_id set to NULL (preserve audit without identifying deleted user)

## D.3 Constraints Summary

All tables:
- Foreign keys: ON DELETE RESTRICT (preserve audit history) except where NOT NULL required
- CHECK constraints: valid status enums, nonnegative funding, valid percentages, valid score ranges
- UNIQUE constraints on natural keys (user_id on profiles, certificate_identifier on certificates, etc.)
- NOT NULL on required fields
- Timestamps: created_at, updated_at on all tables

---

# SECTION E: CORRECTED SECURITY MODEL

## E.1 Universal Actor Derivation Rule

Every function: auth.uid() -> role check -> authorization -> operation -> audit

NEVER: trust client-supplied user_id, actor_id, reviewer_id, role, authority, funding balance, eligibility, completion status

## E.2 SECURITY DEFINER Requirements

Each function MUST:
1. SET search_path = public, auth
2. Be owned by admin/database role
3. Grant EXECUTE selectively (not blanket to authenticated)
4. Validate ALL inputs (non-negative, valid UUIDs, valid enums)
5. Derive actor from auth.uid()
6. Check authorization before operations
7. Return safe error messages (no SQL internals)
8. Log operations in activity log
9. No privilege escalation path

Controlled EXECUTE grants:
- allocate_funding: admin/CEO/superadmin only
- submit_funding_application: authenticated (own records)
- update_lesson_progress: authenticated (own progress only)
- validate_funding_availability: authenticated (read-only)
- issue_certificate: admin/CEO only

## E.3 Activity Log Security

- No INSERT policy for authenticated users
- Populated by: database triggers on data changes + explicit audit functions called by admin operations + system events
- Users CANNOT UPDATE or DELETE audit records (UPDATE/DELETE policies = false)
- Corrections: create new corrective event (not silent rewrite)
- Sanitization: before/after values pass through sanitize_audit_values() which strips passwords, tokens, keys, payment data
- All entries correctly record actor_id (who acted) and user_id (whose record affected)

## E.4 Document Security

- Database RLS + Storage bucket policies must match
- Signed URLs for private document access (no public paths)
- Official documents: require server-side record before PDF generation
- Document generation logged in activity log
- Mai stamp identifies official documents without implying government certification, accreditation, or guaranteed funding

## E.5 RLS Enforcement

- All 19 tables: ENABLE ROW LEVEL SECURITY
- Public read ONLY: courses, modules, lessons, resources, active funding programs (external directory)
- All financial/administrative operations: SECURITY DEFINER functions only
- No INSERT/UPDATE/DELETE for authenticated users on audit logs, allocations, funding sources
- Owner access derived from auth.uid(), not client claims

---

# SECTION F: CORRECTED FUNDING MODEL

## F.1 Conceptual Separation

External Opportunity (Directory): What exists in the world, controlled by external orgs, Mai Opportunities is information provider. Table: mai_opportunities_funding_programs.

Internal Funding: Funding Mai Opportunities actually controls. Table: mai_opportunities_funding_sources. May be added when funding received.

Application: User's request. Status separate from financial outcome. Table: mai_opportunities_funding_applications.

Allocation: Financial commitment from internal funds. Atomic, immutable after finalization. Table: mai_opportunities_grant_allocations.

Disbursement: Actual payment. Separate from allocation. Table: funding_ledger or disbursement tracking.

## F.2 Application Lifecycle

Draft -> Submitted -> Under Review -> Needs Info -> Approved (conceptual) / Denied -> Completed

Key: Approved (conceptual) means eligible. Does NOT mean funds allocated. Separate allocation step required.

## F.3 Allocation vs Decision

Application decision = "This applicant meets criteria" (administrative)
Financial allocation = "We commit X from our internal funds" (financial)

A user can have application approved but no funds available -> allocation pending.

## F.4 Accounting Model

mai_opportunities_funding_ledger answers:
- How much received? SUM(received) from funding_sources
- From whom? source_name and source_provenance
- For which program? restrictions + criteria_used
- How much remains? total_received - total_allocated
- How much approved/d allocated/disbursed/returned? Ledger entries

---

# SECTION G: CORRECTED AUTHENTICATION INTEGRATION

## G.1 Three-Tier Access (Corrected)

Tier 1 (Account Creation): Student verification controls MAiTROLL student account creation. NOT required for Mai Opportunities access. Does NOT imply funding eligibility.

Tier 2 (Program Access): Any authenticated MAiTROLL user accesses Mai Opportunities. Education, courses, business plan, resources open to all authenticated users. Funding applications may have additional requirements.

Tier 3 (Funding Eligibility): Per-program configuration. Account age, status, participation, course completion, documentation. NEVER social/economic metrics.

Tier 4 (Funding Approval): Server-side only. Authorized reviewer + transparent criteria + atomic availability validation.

## G.2 Role Access Matrix

Normal User: Dashboard, courses, business plan, funding browse, funding application, documents, resources
Staff (authorized): Plus delegated admin functions per permission configuration
Admin: Full admin panel, content management, conditional funding review
CEO: Full access including CEO dashboard, funding decisions, allocations, user activity view
Superadmin: Full system access

## G.3 No Independent Auth

- No separate login page for Mai Opportunities
- All auth through existing Supabase Auth infrastructure
- Mobile web responsive (phone app native excluded)
- Zero new authentication infrastructure

---

# SECTION H: CORRECTED MIGRATION DEPENDENCY ORDER

Migration 1: 20260914000001_add_mai_business_schema.sql
Tables (in dependency order), constraints, CHECK constraints, basic indexes, RLS ENABLE, basic owner policies. All in one migration.

Migration 2: 20260914000002_add_mai_business_functions.sql
All SECURITY DEFINER functions with explicit search_path, controlled EXECUTE grants, input validation.

Migration 3: 20260914000003_add_mai_business_triggers.sql
Activity log triggers, timestamp triggers, sanitization triggers. Reference functions from Migration 2.

Migration 4: 20260914000004_add_mai_business_rls_policies.sql
Per-table detailed RLS policies. Public read tables first, owner-based next, admin-only last. No INSERT on audit log. UPDATE/DELETE = false on audit log.

Migration 5: 20260914000005_add_mai_business_course_data.sql
8-week course: 8 modules, 56 lessons, 8 assessments, 1 final exam, course config.

Migration 6: 20260914000006_add_mai_business_resources.sql
Resource directory entries with official sources. External funding program directory entries.

Migration 7: 20260914000007_add_mai_business_indexes.sql
All remaining performance indexes. Composite indexes for queries. Covering indexes for CEO dashboard.

---

# SECTION I: TESTING PLAN

AUTH Tests: unauthorized access, authenticated access, admin access, CEO access, staff access, no public signup, no privilege escalation.
RLS Tests: cross-user read denied, cross-user write denied, public content accessible, audit log inaccessible, allocation records inaccessible.
Funding Tests: insufficient funds, exact balance, concurrent allocations, negative allocation, unauthorized reviewer, fake reviewer ID, fake application, duplicate allocation, after exhaustion, external opportunity confusion.
Audit Tests: actor correctness, subject correctness, no user INSERT, no user UPDATE/DELETE, secrets not logged, trigger-based logging.
Course Tests: fake completion rejected, fake score rejected, fake exam pass rejected, unauthorized progress update rejected.
Certificate Tests: early generation rejected, forged score rejected, post-issuance modification blocked, client eligibility denied.
Document Tests: cross-user access denied, storage access matches RLS, client PDF not official.
Account Deletion Tests: audit history preserved, RESTRICT behavior, business plan history intact.
Security Tests: SQL injection, privilege escalation, actor impersonation, frontend role trust bypass.

---

# SECTION J: IMPLEMENTATION READINESS

**Status: NOT READY FOR MIGRATION**

Reasons: Critical authentication contradiction resolved, funding model redesigned, atomic allocation designed, audit security redesigned, actor derivation secured, RLS per-table defined, migration order corrected, document security defined, certificate security defined, assessment security defined.

Remaining: Stakeholder review, external funding verification, funding source availability confirmation, course content finalization, internal funding timing determination, test environment setup, implementation phase approval.

**Ready for:** Plan review and approval, Migration 1 creation only.

**Next step:** Review this corrected plan. After approval, begin with Migration 1 only.

---
# END OF CORRECTED PLAN

---

# SECTION K: INSTRUCTOR SIGN-UP AND ROLE MANAGEMENT



## K.1 Instructor Sign-Up Flow



Instructors sign up through a dedicated instructor sign-up flow, separate from student sign-up and normal MAiTROLL registration.



**Flow:**

```

Instructor Sign-Up

  ↓

Instructor information (name, email, expertise area, bio, credentials)

  ↓

Professional credentials verification

  ↓

Email verification

  ↓

Application submitted → status = pending_review

  ↓

Admin/CEO review

  ↓

Approved → role = instructor, troll_role = instructor

Denied → notified, application archived

```



## K.2 New Role Definitions



Two new roles added to `user_profiles.role` and `user_profiles.troll_role`:



| Field | Value | Description |

|-------|-------|-------------|

| role | student | Verified student participant |

| troll_role | student | Mirror of student role |

| role | instructor | Course instructor/educator |

| troll_role | instructor | Mirror of instructor role |



**Assignment Rules:**

- Students: role = student, troll_role = student (upon verification/approval)

- Instructors: role = instructor, troll_role = instructor (upon admin approval)

- These roles are scoped to Mai Opportunities only

- Do NOT modify existing MAiTROLL role-protection triggers

- Do NOT create duplicate role systems



## K.3 Instructor Capabilities (Mai Opportunities Scope)



**CAN:**

- Create/manage course modules and lessons

- Create/manage assessments (questions, passing scores)

- Review student submissions

- Grade assessments and provide feedback

- Manage course enrollment

- View student progress (in their courses only)

- Access Mai Opportunities admin for course management



CANNOT:

- Manage funding, allocations, or financial decisions

- Access CEO dashboard

- Modify program settings

- Approve/deny funding applications

- View student financial/banking information

- Self-promote to admin or instructor role



## K.4 Validation Requirements



**Student Validation:**

- Student verification (Hipo + IPEDS/NCES) if applicable to cohort

- OR admin manual approval with documented reasoning

- Sets: role = student, troll_role = student



**Instructor Validation:**

- Professional credentials review (resume, certifications, experience)

- Industry experience verification

- Admin/CEO approval REQUIRED (no self-service instructor status)

- Sets: role = instructor, troll_role = instructor

- Logged in activity log as administrative action



## K.5 Integration with Mai Opportunities



- Students and instructors access Mai Opportunities as authenticated MAiTROLL users

- Instructor role is scoped to Mai Opportunities course management only

- Instructor role does NOT grant admin or financial access

- All instructor actions logged in mai_opportunities_activity_log

- Instructor management done through Mai Opportunities admin tools

- Instructor access requires explicit admin authorization



## K.6 Updated RLS Implications



- `role = student` and `role = instructor` are Mai Opportunities-specific roles

- These do NOT override existing MAiTROLL role protections

- Instructor access to Mai Opportunities admin features requires explicit permission check

- All role checks happen server-side via auth.uid() → user_profiles.role

- Frontend role values NEVER authorize privileged actions
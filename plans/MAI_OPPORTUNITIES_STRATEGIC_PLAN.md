# KILO — MAI OPPORTUNITIES MASTER IMPLEMENTATION PROMPT

You are implementing **Mai Opportunities** as a new integrated subsystem of the existing **MAiTROLL** application.

The complete Mai Opportunities specification has been provided in three parts. Treat all three parts as ONE authoritative specification.

Your job is to implement the specification into the existing MAiTROLL codebase while preserving existing functionality.

---

# 1. NON-NEGOTIABLE RULE

**DO NOT rewrite MAiTROLL.**

Do not replace existing authentication, navigation architecture, Zustand stores, Supabase architecture, existing pages, existing broadcast functionality, payments, court systems, roles, or unrelated functionality.

Before modifying anything:

1. Inspect the repository.
2. Inspect `src/App.tsx`.
3. Inspect `src/components/Sidebar.tsx`.
4. Inspect `src/components/layout/AppLayout.tsx`.
5. Inspect existing authentication/session logic.
6. Inspect `src/lib/store.ts`.
7. Inspect existing `user_profiles` schema and role implementation.
8. Inspect existing Supabase migrations.
9. Inspect existing PDF generation patterns.
10. Inspect existing RLS/security-definer/RPC patterns.
11. Inspect existing `src/phone/` navigation.

Reuse existing architecture wherever possible.

Make the **smallest safe changes necessary**.

Do not create duplicate authentication systems.

Do not create a second user system.

Do not create a second MAiTROLL role system.

Do not expose service-role credentials to the browser.

---

# 2. PRODUCT

Create:

**Mai Opportunities**

Parent platform:

**MAiTROLL**

Primary route:

`/mai-opportunities`

Purpose:

A professional nonprofit entrepreneur-development program providing:

* Entrepreneurship education
* Business formation education
* Business structure education
* Business finance education
* Personal credit education
* Business credit education
* Business plan development
* Startup cost education
* Funding opportunity discovery
* Funding application preparation
* Business resources
* Local entrepreneur resources
* Progress tracking
* Certificates
* Professional PDF documents
* Instructor-led educational administration
* Funding administration
* CEO-level auditing and oversight

Mai Opportunities is NOT a game interface.

It must look professional, educational, trustworthy, modern, organized, and entrepreneur-focused.

---

# 3. AUTHENTICATION

Use existing MAiTROLL Supabase authentication.

There is NO separate Mai Opportunities login.

Use:

`auth.uid()`

as the authenticated identity.

Mai Opportunities tables reference the existing authenticated MAiTROLL user.

Do not duplicate authentication.

Do not trust:

* localStorage roles
* frontend role values
* client-supplied admin flags
* client-supplied instructor flags
* client-supplied eligibility
* client-supplied funding amounts
* client-supplied approval states

Critical authorization and financial operations MUST be validated server-side.

---

# 4. PHONE APP EXCLUSION

This is extremely important.

Mai Opportunities is available on:

* Desktop web
* PC web
* Tablet web
* Mobile web

Mai Opportunities is NOT included in the native MAiTROLL phone application.

Do NOT add Mai Opportunities to:

`src/phone/`

Do NOT add it to:

`PhoneDrawer.tsx`

Do NOT add it to:

`phoneNav.ts`

The desktop/web Sidebar DOES contain Mai Opportunities.

---

# 5. NAVIGATION

Replace the existing primary Academy destination with:

**Mai Opportunities**

Use route:

`/mai-opportunities`

Remove Academy as the primary navigation destination.

Existing Academy routes should be safely decommissioned or redirected without breaking unrelated routes.

Required routes:

`/mai-opportunities`

`/mai-opportunities/dashboard`

`/mai-opportunities/business`

`/mai-opportunities/start-business`

`/mai-opportunities/business-plan`

`/mai-opportunities/education`

`/mai-opportunities/credit`

`/mai-opportunities/funding`

`/mai-opportunities/application`

`/mai-opportunities/progress`

`/mai-opportunities/resources`

`/mai-opportunities/documents`

`/mai-opportunities/help`

`/mai-opportunities/admin`

Add proper authentication/role protection where required.

---

# 6. DATABASE NAMESPACE

All Mai Opportunities tables MUST use the prefix:

`mai_opportunities_`

Do not overload unrelated MAiTROLL tables.

Required tables:

1. `mai_opportunities_profiles`
2. `mai_opportunities_applications`
3. `mai_opportunities_businesses`
4. `mai_opportunities_courses`
5. `mai_opportunities_course_modules`
6. `mai_opportunities_lessons`
7. `mai_opportunities_progress`
8. `mai_opportunities_assessments`
9. `mai_opportunities_assessment_attempts`
10. `mai_opportunities_business_plans`
11. `mai_opportunities_funding_programs`
12. `mai_opportunities_funding_applications`
13. `mai_opportunities_grant_allocations`
14. `mai_opportunities_documents`
15. `mai_opportunities_resources`
16. `mai_opportunities_activity_log`
17. `mai_opportunities_certificates`

Use proper UUID primary keys, foreign keys, timestamps, indexes, constraints, and JSONB where appropriate.

Inspect the existing database conventions before creating the schema.

---

# 7. MIGRATION ORDER

Create these migrations:

`20260913000001_add_mai_business.sql`

Database foundation and all 17 tables.

`20260913000002_add_mai_business_course.sql`

Default 8-week course.

`20260913000003_add_mai_business_resources.sql`

Resources and verified funding seed data.

`20260913000004_add_mai_business_rls.sql`

RLS policies.

`20260913000005_add_mai_business_functions.sql`

Server-side functions/RPCs.

`20260913000006_add_mai_business_triggers.sql`

Activity logging triggers.

`20260913000007_add_mai_business_indexes.sql`

Performance indexes.

Do not collapse everything into one enormous migration if the existing project convention supports modular migrations.

Do not modify an already-applied production migration.

---

# 8. RLS

Enable RLS on EVERY Mai Opportunities table.

Normal users can access only their own private data.

Examples:

Profiles:

`auth.uid() = user_id`

Businesses:

`auth.uid() = user_id`

Business plans:

`auth.uid() = user_id`

Progress:

`auth.uid() = user_id`

Documents:

`auth.uid() = user_id`

Assessment attempts:

`auth.uid() = user_id`

Funding applications:

`auth.uid() = user_id`

Do not rely on frontend filtering as security.

---

# 9. ADMIN AUTHORIZATION

Existing MAiTROLL administrative roles remain the source of truth.

Admin/CEO/Superadmin authorization must be checked server-side.

Inspect the actual existing `user_profiles` schema before implementing role checks.

Do not assume a role column has a particular enum implementation until inspected.

Administrative access includes:

* Mai Opportunities admin
* CEO dashboard
* User-by-user records
* Funding review
* Funding allocation
* Course administration
* Resource administration
* Audit logs
* Program settings

---

# 10. INSTRUCTOR ROLE

Add support for:

`student`

and:

`instructor`

where compatible with the existing MAiTROLL role architecture.

Before modifying role schema, inspect the existing enum/type/constraints.

**Instructor is a scoped, non-career role:**

* A user with `role = instructor` (or equivalent in the existing role architecture) is labeled as an **instructor** validated by a college or university.
* An instructor does **NOT** have access to any MAiTROLL career dashboards such as **admin**, **troll officer**, **lead troll officer**, **secretary**, or any other career-role privileges.
* An instructor has **no MAiTROLL administrative privileges** whatsoever.
* Instructor permissions are exclusively scoped to Mai Opportunities course management.
* Students must be labeled as **student** (or equivalent citizen label) for Mai Troll, and instructor must be distinctly separated from all MAiTROLL career/troll roles.

Instructor access MUST NOT automatically grant MAiTROLL admin access.

Instructor permissions are scoped to Mai Opportunities.

Instructor capabilities:

* Create/manage course modules
* Create/manage lessons
* Create/manage assessments
* Review student educational submissions
* Grade assessments
* Provide feedback
* View student progress for courses they are authorized to teach

Instructor CANNOT:

* Approve funding
* Allocate funding
* Access CEO dashboard
* Manage program-wide financial settings
* View unrelated student financial information
* Manage MAiTROLL administrator roles

Enforce this server-side and through RLS.

---

# 11. INSTRUCTOR SIGNUP

Create a dedicated instructor application flow.

Flow:

Instructor signup

→ name/email/expertise/bio

→ professional credential information

→ email verification

→ application submitted

→ admin review

→ approved or denied

Approved:

`role = instructor`

`troll_role = instructor`

unless existing role architecture requires a safer compatible implementation.

Do not store plaintext credentials or passwords.

An approved instructor is validated by a college or university and is granted **no** MAiTROLL career-dashboard access (no admin, troll officer, lead troll officer, secretary, or other career privileges).

Instructor actions must be audited.

---

# 12. STUDENT ACCESS

Any authenticated MAiTROLL user may use Mai Opportunities.

Student verification is NOT required simply to access Mai Opportunities.

Student verification is part of MAiTROLL student-account processes.

Do not make Hipo/IPEDS/NCES verification a hardcoded Mai Opportunities access requirement.

---

# 13. LANDING PAGE

Create a professional landing page.

Hero:

MAI OPPORTUNITIES

Learn. Build. Grow.

Description:

Learn how to start a business, create a business plan, understand business credit, discover legitimate funding opportunities, and prepare for growth.

CTA:

Get Started

Include:

* What Mai Opportunities is
* Why entrepreneurship education matters
* What users learn
* Business planning
* Credit education
* Funding education
* Application preparation
* Clear nonprofit/funding disclaimer

Do NOT make this look like Troll City game UI.

Use subtle MAiTROLL parent branding.

---

# 14. DASHBOARD

Title:

MAI OPPORTUNITIES / Your Entrepreneur Journey

Provide cards for:

1. My Business
2. Start My Business
3. Business Plan
4. Education
5. Credit Education
6. Funding Opportunities
7. My Application
8. My Progress
9. Business Resources
10. Documents
11. Help & Resources

Show useful status/progress.

Education is an 8-week program.

Do not use the obsolete 14-day course language.

---

# 15. BUSINESS PROFILE

Support:

* Business idea
* Preparing to start
* Starting a business
* Existing business
* Exploring entrepreneurship

Profile information can include:

* Business name
* Business idea
* Business stage
* Founder name
* Industry
* Monthly budget
* Funding amount requested

Reuse display name/email from existing `user_profiles` where possible instead of duplicating data unnecessarily.

---

# 16. START MY BUSINESS

Create educational content covering:

* Business idea
* Problem
* Customer
* Market research
* Business name
* Business structure
* State registration
* Articles
* Registered agent
* EIN
* Licenses
* Permits
* Business bank account
* Accounting/bookkeeping
* Insurance
* Business credit
* Business plan
* Marketing
* Customers
* Operations

State-specific information must be clearly identified.

Do not invent government fees.

Educational disclaimer:

Not legal, tax, accounting, or professional advice.

---

# 17. BUSINESS STRUCTURES

Explain:

* Sole proprietorship
* Partnership
* LLC
* S corporation taxation/election
* C corporation
* Nonprofits
* Professional entities where applicable
* Trusts where relevant

Explain:

* Liability
* Ownership
* Tax considerations
* Management
* Formation
* Compliance

Use educational disclaimers.

---

# 18. EIGHT-WEEK COURSE

Create:

**Entrepreneurship Fundamentals**

Duration:

8 weeks / 56 days

Approximately 7 lessons per week.

Week 1:
Entrepreneurship Fundamentals

Week 2:
Business Structures

Week 3:
Business Formation

Week 4:
Business Finance and Credit

Week 5:
Business Planning and Market Research

Week 6:
Marketing, Sales, and Operations

Week 7:
Funding and Growth

Week 8:
Launch and Long-Term Strategy

Each lesson should have:

* Objectives
* Educational content
* Examples
* Key terms
* Knowledge check

Each week has an assessment.

Final exam exists separately.

---

# 19. COURSE PROGRESS

Track:

* Course
* Module
* Lesson
* Completion
* Completion date
* Assessment score
* Attempts
* Overall progress

Statuses:

* Available
* In Progress
* Completed
* Locked

Progress must persist in Supabase.

Do not rely on browser/localStorage for authoritative progress.

---

# 20. FINAL EXAM

Final Business Fundamentals exam.

Initial passing score:

60%

Make configurable.

Record every attempt.

Store:

* Score
* Pass/fail
* Attempt number
* Date
* Answers
* User
* Course

Allow configurable retakes.

---

# 21. BUSINESS PLAN BUILDER

Create:

`/mai-opportunities/business-plan`

Sections:

* Business name
* Executive overview
* Founder
* Problem
* Solution
* Product/service
* Target market
* Customers
* Market research
* Competitive analysis
* Competitive advantage
* Marketing
* Sales
* Operations
* Management/staffing
* Legal/entity structure
* Startup costs
* Monthly expenses
* Revenue model
* Pricing
* Financial projections
* Funding requirements
* Use of funds
* Milestones
* Risks
* Risk mitigation
* Launch plan
* Long-term strategy

Support:

Save

Edit

Continue

Review

Version tracking

Generate PDF

Print/export

Submit for review

---

# 22. STARTUP COST EDUCATION

Cover:

* Formation
* Filing
* Registered agent
* EIN
* Licenses
* Permits
* Insurance
* Website/domain
* Software
* Equipment
* Accounting
* Professional services
* Marketing
* Inventory
* Office/location
* Other legitimate startup expenses

Government fees must come from verified authoritative sources.

Never fabricate costs.

---

# 23. CREDIT EDUCATION

Create:

`/mai-opportunities/credit`

Personal credit:

* Reports
* Scores
* Payment history
* Utilization
* Debt
* Credit age
* Applications

Business credit:

* EIN
* Business identity
* Accounts
* Vendor relationships
* Reporting
* Business bureaus
* D&B
* Responsible management

Clearly distinguish personal credit from business credit.

Do NOT claim that a D-U-N-S number automatically creates strong business credit.

---

# 24. FUNDING CENTER

Create:

`/mai-opportunities/funding`

Funding opportunities must contain:

* Program name
* Organization
* Funding type
* Award amount/range
* Eligibility
* Geography
* Industry restrictions
* Requirements
* Deadline
* Official source
* Application URL
* Last verified date
* Status

Types:

* Grants
* Government programs
* Nonprofit programs
* Private grants
* Local programs
* Competitions
* Educational programs
* Other legitimate non-debt opportunities

Never fabricate funding opportunities.

Never use unverified sources.

---

# 25. FUNDING APPLICATION WORKFLOW

Create:

`/mai-opportunities/application`

Workflow:

Start

→ Save draft

→ Continue

→ Complete information

→ Upload documents

→ Submit

→ Under review

→ Needs information

→ Decision

Statuses:

* Draft
* Submitted
* Under Review
* Needs Information
* Approved
* Denied
* Withdrawn
* Completed

All status changes must be validated server-side.

---

# 26. FUNDING DECISIONS

Funding decisions MUST remain independent from MAiTROLL social systems.

NEVER use:

* Followers
* Views
* Troll Coins
* Gifts
* Battles
* Likes
* Social status
* Broadcast activity
* Popularity

as funding criteria.

Possible program-related criteria:

* Eligibility
* Demonstrated need
* Business plan quality
* Completeness
* Eligible expenses
* Business stage
* Program objectives
* Funding availability
* Source restrictions
* Readiness

---

# 27. FUNDING AVAILABILITY

Funding allocation MUST be server-side.

Never trust the frontend amount.

Before approving an allocation:

1. Lock/check current program state appropriately.
2. Calculate available funds.
3. Verify requested amount.
4. Verify source restrictions.
5. Verify eligibility.
6. Prevent over-allocation.
7. Create allocation.
8. Update totals atomically.
9. Write audit record.

Use a transactional database function/RPC.

Avoid race conditions where two approvals could allocate the same funds.

---

# 28. SERVER-SIDE FUNCTIONS

Implement appropriate secure RPCs/functions for:

`validate_funding_availability`

`allocate_funding`

`update_lesson_progress`

`submit_funding_application`

Inspect existing Supabase function conventions before implementation.

Use `SECURITY DEFINER` only where necessary.

Set an explicit secure `search_path` for security-definer functions.

Do not expose privileged credentials.

Validate the actual authenticated actor inside the function.

Do not allow users to pass arbitrary reviewer/admin IDs and impersonate another user.

---

# 29. ACTIVITY LOGGING

Table:

`mai_opportunities_activity_log`

Track:

* user_id
* actor_id
* action
* category
* target_type
* target_id
* previous_value
* new_value
* metadata
* created_at

Potential events:

* Profile creation
* Business creation/update
* Course activity
* Lesson completion
* Assessment attempt
* Final exam
* Certificate
* Business plan
* Document upload
* Document generation
* Funding application
* Funding submission
* Funding review
* Funding decision
* Funding allocation
* Instructor application
* Instructor approval
* Role changes
* Account status changes
* Privileged-access attempts
* Administrative changes

CRITICAL:

`actor_id` must represent the authenticated person who actually performed the action.

Example:

CEO approves User A.

`user_id = User A`

`actor_id = CEO`

Do NOT blindly set both IDs to the affected user.

Automatic triggers must not incorrectly attribute administrative actions.

---

# 30. AUTHENTICATION AUDIT

Integrate with existing MAiTROLL audit infrastructure where appropriate.

Track:

* Admin authentication events
* Failed privileged access
* Account status changes
* Role changes

Do not duplicate existing global audit infrastructure unnecessarily.

If an existing MAiTROLL audit table already handles an event, integrate with it rather than creating conflicting duplicate systems.

---

# 31. DOCUMENT SYSTEM

Create secure document functionality.

Document types:

* Business plans
* Funding applications
* Supporting documents
* Formation documents
* Funding decisions
* Certificates
* Completion documents
* Correspondence

Users only access their own documents.

Authorized administrators/reviewers may access documents according to permissions.

Every document access/action should be auditable.

Use secure storage policies.

Do not expose unrestricted public storage URLs for private documents.

---

# 32. PDF SYSTEM

Reuse existing MAiTROLL PDF patterns where appropriate.

Reference existing:

`src/lib/loanApplicationPDF.ts`

PDFs should include:

* Mai Opportunities branding
* Document title
* User/business information
* Date
* Document identifier
* Mai stamp
* Disclaimer
* Page numbers

Generate PDFs for:

* Business plans
* Certificates
* Funding applications
* Funding decisions
* Program completion documents
* Other official participant documents

Use secure/server-side generation where appropriate.

---

# 33. MAI STAMP

All official Mai Opportunities documents receive a professional:

**Mai**

program stamp.

It must clearly identify the document as an official Mai Opportunities document.

Do not make the stamp imply funding approval or government certification.

Certificates must NOT imply guaranteed funding, grants, business success, or financial approval.

---

# 34. CERTIFICATES

Certificate eligibility should be configurable.

Track:

* User
* Course
* Certificate identifier
* Certificate type
* Title
* Issue date
* Expiry date
* Status
* PDF path
* Final exam score
* Final exam pass
* Course completion date
* Eligibility

Certificates represent educational/program completion only.

---

# 35. RESOURCES

Create:

`/mai-opportunities/resources`

Categories:

* Business formation
* Government
* Taxes
* Legal
* Accounting
* Credit
* Business credit
* D&B
* Licensing
* Permits
* Marketing
* Hiring
* Payroll
* Funding
* Grants
* Education
* Entrepreneurship
* Local assistance

Every resource should contain:

* Name
* Description
* Category
* Official source
* URL
* Geography
* Last verified date
* Status

---

# 36. LOCAL ENTREPRENEUR RESOURCES

Support:

* SBDCs
* Colleges
* Universities
* Community colleges
* Trade schools
* Entrepreneurship programs
* Incubators
* Accelerators
* Chambers
* Government programs
* Nonprofits

Only claim partnerships when an actual relationship exists.

---

# 37. ADMIN DASHBOARD

Route:

`/mai-opportunities/admin`

Build administrative tools for:

* Courses
* Modules
* Lessons
* Assessments
* Passing scores
* Resources
* Funding programs
* Funding applications
* Application review
* Funding criteria
* Funding allocations
* Document review
* Program settings
* Certificates

Instructor permissions must remain separate from administrator permissions.

---

# 38. CEO DASHBOARD

CEO needs a complete user-by-user Mai Opportunities view.

Selecting a user should expose:

## Profile

* Enrollment
* Business stage
* Business information
* Program status

## Education

* Course
* Weeks
* Modules
* Lessons
* Completion
* Dates
* Scores
* Attempts
* Final exam
* Certificate

## Business

* Business profile
* Business idea
* Structure
* Business plan
* Revisions
* Startup information
* Milestones

## Funding

* Opportunities viewed
* Applications
* Requested amounts
* Status
* Supporting documents
* Review history
* Decisions
* Approved amounts
* Funding source
* Allocations
* Disbursement records if implemented

## Documents

* Document list
* Type
* Date
* Status
* Version
* Secure PDF access

## Activity

Complete chronological Mai Opportunities activity.

---

# 39. CEO AUDIT LOG

Search/filter by:

* User
* Category
* Date
* Actor
* Action
* Target

Display:

* Timestamp
* Actor
* Affected user
* Action
* Previous value
* New value
* Associated record

Persist in Supabase.

Do not rely on browser history/localStorage.

---

# 40. CEO FUNDING VIEW

Program-wide dashboard showing:

* Total funding received
* Funding source
* Program
* Restrictions
* Total available
* Total allocated
* Remaining
* Applicants
* Approved
* Denied
* Requested
* Approved
* Allocation history

Every allocation must be traceable to:

* User
* Application
* Source
* Amount
* Decision
* Reason
* Reviewer
* Date
* Supporting records

Never display hypothetical funding as actual available money.

---

# 41. NONPROFIT MODEL

Mai Opportunities is a nonprofit entrepreneur-development program.

The UI and backend must clearly distinguish:

Educational benefit

Opportunity discovered

Application submitted

Funding received

Funding available to the program

Funding allocated

Funding exhausted/unavailable

Funding is NOT guaranteed.

Never imply that completing the course guarantees:

* Grants
* Loans
* Funding
* Approval
* Business success

---

# 42. INDEXING

Create indexes based on actual query patterns.

At minimum consider:

* user_id
* status
* course_id
* lesson_id
* funding_program_id
* document_type
* category
* actor_id
* target_type/target_id
* created_at

Do not blindly create redundant indexes.

Check existing indexes and constraints first.

---

# 43. PERFORMANCE

Use:

* Pagination
* Efficient Supabase queries
* Proper indexes
* Selective columns
* Lazy loading where appropriate
* Avoid unnecessary nested queries
* Avoid loading entire activity logs
* Avoid loading every document at dashboard startup

The dashboard should load quickly.

---

# 44. DATA VALIDATION

Critical operations MUST be validated server-side:

* Funding amount
* Funding availability
* Application submission
* Eligibility
* Application status
* Course completion
* Assessment completion
* Final exam
* Certificate eligibility
* Funding approval
* Funding allocation
* Administrative actions

Client-side validation is for UX only.

---

# 45. SECURITY

Before completion perform a security review for:

* RLS
* Storage policies
* RPC authorization
* SECURITY DEFINER functions
* Role escalation
* Instructor privilege escalation
* Admin impersonation
* Funding manipulation
* Document access
* IDOR vulnerabilities
* Client-trusted values
* Service-role exposure
* Private information leakage

---

# 46. IMPORTANT ACTOR SECURITY

Never allow a client to choose:

`actor_id`

for a privileged operation.

The authenticated session determines the actor.

For example, the client must not be able to submit:

`reviewer_id = CEO_ID`

and thereby impersonate the CEO.

The server must determine the authenticated actor from the Supabase session.

---

# 47. UI/UX

Professional entrepreneur-development platform.

Do NOT use:

* Cartoon UI
* Medieval/game styling
* Troll-game visual language
* Excessive neon
* Gamified financial decisions

Mai Opportunities can retain subtle MAiTROLL branding but must feel like a serious education/business platform.

Responsive:

* PC
* Desktop
* Tablet
* Mobile web

Native phone app remains excluded.

---

# 48. IMPLEMENTATION PROCESS

Do NOT immediately modify dozens of files.

Follow this order:

## STEP 1 — AUDIT

Inspect the repository and report:

* Current routing
* Current Sidebar
* Current authentication
* Current user_profiles schema
* Existing roles
* Existing RLS patterns
* Existing migrations
* Existing storage
* Existing PDF generation
* Existing admin patterns
* Existing Academy implementation
* Existing phone navigation

## STEP 2 — PLAN

Produce a concrete file-by-file implementation plan.

Identify conflicts with existing code.

Do not invent architecture that already exists.

## STEP 3 — DATABASE

Create the migrations.

Validate SQL syntax and dependencies.

Do not apply destructive changes.

## STEP 4 — SECURITY

Implement and test RLS/RPC authorization.

## STEP 5 — CORE UI

Implement:

* Landing
* Dashboard
* Business
* Start Business
* Education
* Credit
* Funding
* Application
* Progress
* Resources
* Documents
* Help

## STEP 6 — BUSINESS PLAN/PDFS

Implement builder, persistence, versioning and PDF generation.

## STEP 7 — FUNDING

Implement opportunity directory, applications, decisions and atomic allocation.

## STEP 8 — ADMIN/CEO/INSTRUCTOR

Implement appropriate dashboards and permission boundaries.

## STEP 9 — AUDIT

Verify all critical activity is logged correctly.

## STEP 10 — TEST

Run tests and browser checks.

---

# 49. TESTING

Test:

### Authentication

* Logged-out landing
* Logged-in user
* Admin
* CEO
* Superadmin
* Instructor
* Unauthorized user

### RLS

Attempt unauthorized reads/writes.

### Business

Create/update/persist business profile.

### Education

Complete lessons.

Complete assessments.

Retake assessments.

Complete final exam.

Generate certificate.

### Business Plan

Create.

Save.

Reload.

Edit.

Version.

Generate PDF.

### Funding

Browse.

Apply.

Save draft.

Submit.

Review.

Approve.

Deny.

Attempt over-allocation.

Attempt unauthorized allocation.

### Documents

Upload.

View.

Download.

Attempt unauthorized access.

### Audit

Verify correct:

`user_id`

and:

`actor_id`

especially for administrative actions.

### Instructor

Verify instructors cannot access funding administration or CEO dashboard.

### Mobile Web

Test responsive layouts.

### Native Phone

Verify Mai Opportunities was NOT added.

---

# 50. ACCEPTANCE CRITERIA

The implementation is complete only when:

1. Mai Opportunities appears in desktop MAiTROLL navigation.
2. Academy is replaced as the primary destination.
3. `/mai-opportunities` works.
4. Landing page works.
5. Dashboard contains the required sections.
6. Business profile persists.
7. Eight-week course works.
8. Lesson progress persists.
9. Assessments work.
10. Retakes work.
11. Final exam uses configurable passing score.
12. Business Plan Builder works.
13. Business plans persist.
14. PDFs generate.
15. Mai stamp appears on official documents.
16. Credit education works.
17. Funding directory works.
18. Funding sources are verified.
19. Funding applications work.
20. Application status workflow works.
21. Funding approval is server-side.
22. Funding allocation cannot exceed availability.
23. Documents are secured.
24. Resources work.
25. Admin tools work.
26. Instructor permissions are isolated.
27. CEO user-by-user view works.
28. CEO audit log works.
29. CEO funding overview works.
30. Activity logging works.
31. RLS is verified.
32. Mobile web works.
33. Native phone app does NOT contain Mai Opportunities.
34. Existing MAiTROLL functionality remains intact.
35. Nonprofit/funding disclaimers are present.
36. No client-side security decisions are trusted.
37. No service-role secret is exposed.
38. No funding decision uses MAiTROLL popularity/social/economic metrics.

---

# 51. DEVELOPMENT SAFETY RULE

If you discover that an existing MAiTROLL table, enum, RPC, component, route, or authentication mechanism conflicts with this specification:

**STOP and inspect it before changing it.**

Prefer an additive compatibility solution.

Do not destroy existing production functionality merely to satisfy the new subsystem.

If a schema change is genuinely required, create a migration and document exactly why.

---

# 52. LOG EVERYTHING

Maintain an implementation log containing:

* Files inspected
* Files changed
* Migrations created
* SQL changes
* Functions created
* RLS policies created
* Components created
* Routes added
* Existing components modified
* Tests run
* Tests passed
* Tests failed
* Security findings
* Remaining TODOs

Do not claim something is complete unless it was actually implemented and verified.

---

# 53. FINAL OUTPUT

At the end of each implementation phase report:

## COMPLETED

What was actually implemented.

## FILES CHANGED

Exact files.

## DATABASE

Migrations/functions/policies added.

## SECURITY

RLS and authorization verified.

## TESTS

Tests actually executed and results.

## ISSUES

Anything remaining.

## NEXT PHASE

The next concrete implementation step.

Do not rewrite unrelated MAiTROLL code.

Do not remove existing working functionality.

Build Mai Opportunities as a clean, modular, secure subsystem inside MAiTROLL.

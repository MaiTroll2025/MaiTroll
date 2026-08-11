-- ============================================================================
-- SAFE REMOVAL OF OBSOLETE PAYROLL/TIMEKEEPING OBJECTS
-- Only removes objects that were exclusively used by the retired Employees
-- page payroll/timekeeping features and are no longer referenced by any
-- active frontend path or authorized role workflow.
--
-- DO NOT drop officer_work_sessions, officer_shift_slots, officer_shifts,
-- officer_shift_logs, officer_time_off_requests, officer_payouts, or
-- officer_weekly_reports. Those tables are still used by the Officer
-- Dashboard, scheduling, lounge, and admin tooling.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Remove obsolete edge function (employee-payroll)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS supabase_functions.handler(uuid, jsonb) CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Remove obsolete RPCs that were only used by the removed Employees
--    Payroll tab and ManagementTab PerkPay feature.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.run_employee_payroll(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.run_employee_payroll(uuid, date, date, uuid) CASCADE;

-- ---------------------------------------------------------------------------
-- 3. Remove obsolete tables that were exclusively tied to the removed
--    Employees page payroll/timekeeping UI.
--
--    Safe to drop because:
--    - employee_perk_pay was only read/written by ManagementTab PerkPay
--    - employee_payroll_runs was only read by PayrollTab
--    - No other active frontend path, edge function, or authorized role
--      workflow references these tables after the Employees page rewrite.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS public.employee_perk_pay CASCADE;
DROP TABLE IF EXISTS public.employee_payroll_runs CASCADE;

COMMIT;

-- ===========================================================================
-- Payroll: extend schema to support the Employee Workspace "Payroll" tab.
-- The existing migration 20260711000000_employees_office.sql created thin
-- employee_payroll_runs / employee_paystubs tables. This migration adds the
-- columns the PayrollTab UI and the employee-payroll edge function rely on,
-- plus PayPal payout tracking and the richer run lifecycle.
-- All additions are ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS so
-- this is safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- employee_payroll_runs: richer lifecycle + money totals + PayPal batch link
-- ---------------------------------------------------------------------------
alter table if exists public.employee_payroll_runs
  add column if not exists pay_date date,
  add column if not exists employee_count integer,
  add column if not exists gross_total numeric default 0,
  add column if not exists deduction_total numeric default 0,
  add column if not exists tax_total numeric default 0,
  add column if not exists net_total numeric default 0,
  add column if not exists employer_tax_total numeric default 0,
  add column if not exists paypal_batch_id text,
  add column if not exists approved_by uuid references auth.users(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists submitted_at timestamptz,
  add column if not exists notes text;

-- Allow the extra lifecycle statuses the UI uses (draft -> calculating ->
-- ready -> approved -> processing -> paid / partially_paid / failed /
-- cancelled). The baseline check only allowed draft/approved/paid.
alter table if exists public.employee_payroll_runs
  drop constraint if exists employee_payroll_runs_status_check;

alter table if exists public.employee_payroll_runs
  add constraint employee_payroll_runs_status_check
  check (status in (
    'draft','calculating','ready','approved','processing',
    'paid','partially_paid','failed','cancelled'
  ));

-- ---------------------------------------------------------------------------
-- employee_paystubs: detailed earnings/deductions + PayPal payout tracking
-- (baseline columns: run_id, user_id, pay_period_start, pay_period_end,
--  pay_date, hours, rate, gross_pay, federal_tax, state_tax, fica, medicare,
--  net_pay, location_city, location_state, created_at)
-- ---------------------------------------------------------------------------
alter table if exists public.employee_paystubs
  add column if not exists regular_hours numeric default 0,
  add column if not exists overtime_hours numeric default 0,
  add column if not exists overtime_rate numeric default 0,
  add column if not exists regular_pay numeric default 0,
  add column if not exists overtime_pay numeric default 0,
  add column if not exists bonus_pay numeric default 0,
  add column if not exists commission_pay numeric default 0,
  add column if not exists reimbursement_pay numeric default 0,
  add column if not exists local_tax numeric default 0,
  add column if not exists social_security_tax numeric default 0,
  add column if not exists other_deductions numeric default 0,
  add column if not exists payout_status text default 'pending'
    check (payout_status in (
      'pending','processing','success','failed',
      'unclaimed','returned','blocked'
    )),
  add column if not exists payout_method text default 'paypal',
  add column if not exists paypal_email text,
  add column if not exists paypal_item_id text,
  add column if not exists payment_error text,
  add column if not exists paid_at timestamptz;

-- Backfill derived columns for any stubs created by the original RPC so the
-- UI totals stay correct even before a recalculation.
update public.employee_paystubs
  set regular_hours = coalesce(hours, 0),
      regular_pay = coalesce(gross_pay, 0),
      social_security_tax = coalesce(fica, 0)
  where regular_hours is null or regular_hours = 0;

-- ---------------------------------------------------------------------------
-- RLS: payroll_run money/batch fields are written only by the SECURITY
-- DEFINER edge function (service role bypasses RLS). Management/secretary/ceo
-- keep read access through the existing policies. Stubs keep existing select
-- policy; payout columns are service-role managed.
-- ---------------------------------------------------------------------------
-- Ensure management can update run money/status (needed for approve/cancel
-- flows driven from the client via the edge function's service role; the
-- client never writes directly, but allow management edits defensively).
drop policy if exists payroll_runs_update on public.employee_payroll_runs;
create policy "payroll_runs_update" on public.employee_payroll_runs
  for update using (public.employee_can(auth.uid(),'edit_payroll'));

drop policy if exists paystubs_update on public.employee_paystubs;
create policy "paystubs_update" on public.employee_paystubs
  for update using (public.employee_can(auth.uid(),'edit_payroll'));

-- Realtime for run status changes (stubs already added in baseline).
alter publication supabase_realtime add table public.employee_payroll_runs;

-- Ensure officer_payroll_logs has pay period columns

ALTER TABLE public.officer_payroll_logs
  ADD COLUMN IF NOT EXISTS pay_period_start date,
  ADD COLUMN IF NOT EXISTS pay_period_end date,
  ADD COLUMN IF NOT EXISTS base_pay bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_pay bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_paid bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS pool_balance_before bigint,
  ADD COLUMN IF NOT EXISTS pool_balance_after bigint,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.officer_payroll_logs
  ALTER COLUMN pay_period_start SET NOT NULL,
  ALTER COLUMN pay_period_end SET NOT NULL;

ALTER TABLE public.officer_payroll_logs
  DROP CONSTRAINT IF EXISTS officer_payroll_logs_status_check;

ALTER TABLE public.officer_payroll_logs
  ADD CONSTRAINT officer_payroll_logs_status_check
  CHECK (status IN ('paid', 'prorated', 'skipped', 'frozen'));

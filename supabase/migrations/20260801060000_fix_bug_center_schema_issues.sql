-- Bug Center: Add missing 'source' column to coin_transactions
-- Error: SQL state 42703 (undefined_column) "column source does not exist"
-- Routes affected: /, /government/streams
-- The backup migration migrations_backup3/20260801060000_fix_bug_center_schema_issues.sql
-- was never applied to the active migrations directory, so the source column
-- was missing from coin_transactions despite frontend queries referencing it.

-- Add missing columns referenced by frontend queries
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS coins BIGINT,
  ADD COLUMN IF NOT EXISTS from_user_id UUID,
  ADD COLUMN IF NOT EXISTS from_user_name TEXT,
  ADD COLUMN IF NOT EXISTS to_user_id UUID,
  ADD COLUMN IF NOT EXISTS to_user_name TEXT;

-- Indexes to support efficient querying
CREATE INDEX IF NOT EXISTS idx_coin_transactions_source
  ON public.coin_transactions(source);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_from_user_id
  ON public.coin_transactions(from_user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_to_user_id
  ON public.coin_transactions(to_user_id);

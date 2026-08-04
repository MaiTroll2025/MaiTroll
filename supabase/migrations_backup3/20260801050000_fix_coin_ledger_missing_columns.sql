-- ============================================================================
-- Migration: 20260801050000_fix_coin_ledger_missing_columns
-- Fixes missing columns in coin_ledger used by recent RPCs:
--   - troll_bank_credit_coins (20260801000001)
--   - try_pay_coins_secure (20260801000002)
--   - try_pay_with_credit_card (20260801000006)
-- ============================================================================

ALTER TABLE public.coin_ledger
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS reason TEXT;

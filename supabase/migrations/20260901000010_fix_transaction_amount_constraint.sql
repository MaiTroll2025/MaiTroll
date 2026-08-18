-- ============================================================================
-- Migration: Allow fractional coins in record_label_transactions
-- Date: 2026-08-18
-- Purpose: The amount check constraint requires artist_coins + label_coins = gross_coins,
--          but the columns are bigint which can't store 0.5. Change to numeric(10,2)
--          so 0.5/0.5 splits work correctly.
-- ============================================================================

ALTER TABLE public.record_label_transactions
  ALTER COLUMN gross_coins TYPE numeric(10,2) USING gross_coins::numeric(10,2),
  ALTER COLUMN artist_split_bps TYPE numeric(10,2) USING artist_split_bps::numeric(10,2),
  ALTER COLUMN label_split_bps TYPE numeric(10,2) USING label_split_bps::numeric(10,2),
  ALTER COLUMN artist_coins TYPE numeric(10,2) USING artist_coins::numeric(10,2),
  ALTER COLUMN label_coins TYPE numeric(10,2) USING label_coins::numeric(10,2);

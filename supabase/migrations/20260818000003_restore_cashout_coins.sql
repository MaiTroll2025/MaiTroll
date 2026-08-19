-- ============================================================================
-- Migration: Restore cashout_coins column for gift processing
-- Date: 2026-08-18
-- Purpose: cashout_coins was dropped from user_profiles but gift processing
--          and other systems still reference it. This restores the column
--          so existing logic continues to work.
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS cashout_coins bigint NOT NULL DEFAULT 0;

-- Backfill: cashout_coins should mirror troll_coins for all users
UPDATE public.user_profiles
SET cashout_coins = COALESCE(troll_coins, 0)
WHERE COALESCE(cashout_coins, 0) = 0
  AND COALESCE(troll_coins, 0) > 0;

-- ============================================================================
-- Migration: Remove legacy gift_card_redemptions triggers referencing dropped columns
-- Date: 2026-09-01
-- Purpose: Drop triggers/functions that reference reserved_troll_coins,
--          cashout_reserved_coins, and cashout_coins which were removed from
--          user_profiles in 20290901000001_drop_cashout_reserve_columns.sql.
-- ============================================================================

-- Drop triggers first
DROP TRIGGER IF EXISTS trg_reserve_troll_coins ON public.gift_card_redemptions;
DROP TRIGGER IF EXISTS trg_finalize_redemption_status ON public.gift_card_redemptions;

-- Drop functions
DROP FUNCTION IF EXISTS public.reserve_troll_coins_on_redemption();
DROP FUNCTION IF EXISTS public.finalize_redemption_status();

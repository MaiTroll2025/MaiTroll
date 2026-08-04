-- ============================================================================
-- ADD HIGHER CASHOUT TIERS
-- Date: 2026-07-20
-- Purpose: Add 6 additional higher cashout tiers (14-19) beyond the existing 13.
-- ============================================================================

INSERT INTO public.cashout_tiers (coin_amount, cash_amount, processing_fee_percentage, is_active) VALUES
  (120000, 700, 0, TRUE),
  (135000, 800, 0, TRUE),
  (150000, 950, 0, TRUE),
  (170000, 1100, 0, TRUE),
  (190000, 1300, 0, TRUE),
  (210000, 1500, 0, TRUE);

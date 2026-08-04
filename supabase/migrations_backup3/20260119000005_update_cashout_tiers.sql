-- Migration to update cashout tiers and remove fees
-- This migration updates the cashout_tiers table with new coin amounts and payouts
-- and ensures processing fees are set to 0.

-- Deactivate old tiers
UPDATE cashout_tiers SET is_active = false;

-- Insert new tiers
INSERT INTO cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active, created_at)
VALUES 
(12375, 50, 'USD', 0, true, now()),
(30375, 70, 'USD', 0, true, now()),
(60375, 170, 'USD', 0, true, now()),
(120375, 355, 'USD', 0, true, now());

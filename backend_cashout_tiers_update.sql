-- Update cashout tiers to match frontend configuration
-- This script should be run against the Supabase database

-- First, deactivate all existing tiers
UPDATE public.cashout_tiers SET is_active = false;

-- Insert new tiers (or do nothing if they exist)
INSERT INTO public.cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active)
VALUES 
  (2000, 10.00, 'USD', 0, true),
  (4000, 20.00, 'USD', 0, true),
  (10000, 50.00, 'USD', 0, true),
  (20000, 100.00, 'USD', 0, true),
  (30000, 150.00, 'USD', 0, true),
  (50000, 250.00, 'USD', 0, true),
  (100000, 500.00, 'USD', 0, true),
  (200000, 1000.00, 'USD', 0, true),
  (500000, 2500.00, 'USD', 0, true),
  (1000000, 5000.00, 'USD', 0, true)
ON CONFLICT DO NOTHING;

-- Update existing tiers with new values
UPDATE public.cashout_tiers 
SET 
  cash_amount = CASE coin_amount
    WHEN 2000 THEN 10.00
    WHEN 4000 THEN 20.00
    WHEN 10000 THEN 50.00
    WHEN 20000 THEN 100.00
    WHEN 30000 THEN 150.00
    WHEN 50000 THEN 250.00
    WHEN 100000 THEN 500.00
    WHEN 200000 THEN 1000.00
    WHEN 500000 THEN 2500.00
    WHEN 1000000 THEN 5000.00
    ELSE cash_amount
  END,
  is_active = true,
  processing_fee_percentage = 0
WHERE coin_amount IN (2000, 4000, 10000, 20000, 30000, 50000, 100000, 200000, 500000, 1000000);

-- Verify the update
SELECT * FROM public.cashout_tiers ORDER BY coin_amount;
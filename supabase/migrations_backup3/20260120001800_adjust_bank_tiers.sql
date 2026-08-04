-- Update Bank Tiers per user request
-- Established (30-179 days): 1000 -> 500
-- Veteran (180+ days): 2000 -> 1000

UPDATE public.bank_tiers
SET max_loan_coins = 500
WHERE tier_name = 'Established';

UPDATE public.bank_tiers
SET max_loan_coins = 1000
WHERE tier_name = 'Veteran';

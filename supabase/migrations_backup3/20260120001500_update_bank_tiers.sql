
-- Update Bank Tiers to match specific user requirements
-- Requirement: 
-- < 1 month: 100 coins
-- > 1 month (30 days): 1000 coins
-- > 6 months (180 days): 2000 coins

-- First, clear existing tiers to avoid conflicts/duplicates during update
TRUNCATE TABLE public.bank_tiers;

-- Insert new tiers
INSERT INTO public.bank_tiers (tier_name, min_tenure_days, max_loan_coins) VALUES
('New User', 0, 100),       -- 0 to 29 days
('Established', 30, 1000),  -- 30 to 179 days
('Veteran', 180, 2000);     -- 180+ days

-- Verify update (optional debug check, mostly for manual run)
-- SELECT * FROM public.bank_tiers;

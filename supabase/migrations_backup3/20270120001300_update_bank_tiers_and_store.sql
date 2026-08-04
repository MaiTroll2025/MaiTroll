-- Update Bank Tiers to match new requirements
-- < 1 month: 100 coins
-- 1 - 6 months: 1000 coins
-- > 6 months: 2000 coins

TRUNCATE TABLE public.bank_tiers;

INSERT INTO public.bank_tiers (tier_name, min_tenure_days, max_loan_coins) VALUES
('New', 0, 100),           -- Up to 1 month (0-30 days)
('Established', 30, 1000), -- After 1 month (30-180 days)
('Veteran', 180, 2000);    -- After 6 months (> 180 days)

-- Ensure troll_pass_expires_at column exists
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS troll_pass_expires_at timestamptz;

-- Ensure we have a way to track manual orders if not already
CREATE TABLE IF NOT EXISTS public.manual_coin_orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.user_profiles(id),
    package_id text NOT NULL,
    amount int NOT NULL,
    price text NOT NULL,
    payment_method text NOT NULL, -- 'cashapp'
    status text DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz,
    processed_by uuid REFERENCES public.user_profiles(id)
);

-- Enable RLS for manual_coin_orders
ALTER TABLE public.manual_coin_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders" ON public.manual_coin_orders;
CREATE POLICY "Users can view own orders" ON public.manual_coin_orders
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all orders" ON public.manual_coin_orders;
CREATE POLICY "Admins can view all orders" ON public.manual_coin_orders
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );

DROP POLICY IF EXISTS "Users can insert own orders" ON public.manual_coin_orders;
CREATE POLICY "Users can insert own orders" ON public.manual_coin_orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

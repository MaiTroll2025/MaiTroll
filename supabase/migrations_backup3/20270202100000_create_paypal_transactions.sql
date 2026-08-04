
-- Create paypal_transactions table for idempotency and audit
CREATE TABLE IF NOT EXISTS public.paypal_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    paypal_order_id TEXT NOT NULL UNIQUE,
    paypal_capture_id TEXT,
    amount NUMERIC,
    currency TEXT,
    coins BIGINT,
    status TEXT NOT NULL, -- 'completed', 'credited'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add RLS policies
ALTER TABLE public.paypal_transactions ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all transactions
CREATE POLICY "Admins can view all paypal transactions" 
    ON public.paypal_transactions 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
        )
    );

-- Users can view their own transactions
CREATE POLICY "Users can view their own paypal transactions" 
    ON public.paypal_transactions 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Service role can do everything (default, but good to be explicit if needed, though RLS is bypassed by service role)

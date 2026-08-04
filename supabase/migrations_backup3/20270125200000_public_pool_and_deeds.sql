-- Public Pool and Foreclosure System

-- 1. Create Pool Donations Table
CREATE TABLE IF NOT EXISTS public.pool_donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pool_donations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read donations (for the public feed)
CREATE POLICY "Public read donations" ON public.pool_donations
    FOR SELECT USING (true);

-- Allow authenticated users to insert (via RPC only usually, but let's allow insert for now if we use direct insert, though RPC is safer for balance check)
-- actually, we will use RPC, so we don't strictly need insert policy if we use security definer, but good practice.
CREATE POLICY "Users can insert own donations" ON public.pool_donations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. RPC: Donate to Public Pool
CREATE OR REPLACE FUNCTION public.donate_to_public_pool(
    p_amount NUMERIC,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_balance NUMERIC;
    v_pool_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Check if user exists
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Check amount
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Invalid amount';
    END IF;

    -- Check user balance
    SELECT troll_coins INTO v_current_balance
    FROM public.user_profiles
    WHERE id = v_user_id;

    IF v_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- Deduct from user
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = v_user_id;

    -- Add to Admin Pool (System Wallet)
    -- We assume there is at least one row, we take the first one or a specific one.
    -- If multiple exist, we add to the first one found.
    UPDATE public.admin_pool
    SET trollcoins_balance = trollcoins_balance + p_amount
    WHERE id = (SELECT id FROM public.admin_pool LIMIT 1);

    -- Log donation
    INSERT INTO public.pool_donations (user_id, amount, message)
    VALUES (v_user_id, p_amount, p_message);

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_current_balance - p_amount
    );
END;
$$;

-- 3. RPC: Foreclose Property
CREATE OR REPLACE FUNCTION public.foreclose_property(
    p_deed_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN;
    v_property_id UUID;
BEGIN
    v_caller_id := auth.uid();

    -- Check if caller is admin
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.user_profiles
    WHERE id = v_caller_id;

    IF NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: Admin only';
    END IF;

    -- Get property ID from deed
    SELECT property_id INTO v_property_id
    FROM public.deeds
    WHERE id = p_deed_id;

    IF v_property_id IS NULL THEN
        RAISE EXCEPTION 'Deed not found';
    END IF;

    -- Update Deed: Remove owner
    UPDATE public.deeds
    SET current_owner_user_id = NULL,
        owner_username = NULL
    WHERE id = p_deed_id;

    -- Update Property: Remove owner, set status (optional, depends on property schema)
    UPDATE public.properties
    SET owner_user_id = NULL
    WHERE id = v_property_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.donate_to_public_pool TO authenticated;
GRANT EXECUTE ON FUNCTION public.foreclose_property TO authenticated;

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pool_donations;

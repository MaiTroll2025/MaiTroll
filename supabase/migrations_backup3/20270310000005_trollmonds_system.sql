-- Migration: Trollmonds System Implementation

-- 1. Add Trollmonds balance to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS trollmonds INTEGER DEFAULT 0;

-- 2. Create Trollmond Transactions Log
CREATE TABLE IF NOT EXISTS public.trollmond_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id),
    amount INTEGER NOT NULL, -- Positive for mint/gift_received, Negative for cashout/gift_sent
    type TEXT NOT NULL CHECK (type IN ('mint', 'gift_sent', 'gift_received', 'cashout', 'admin_adjustment', 'fee')),
    source_type TEXT NOT NULL CHECK (source_type IN ('car_sale', 'property_sale', 'bank_sale', 'broadcast_gift', 'cashout_request', 'manual', 'admin_override')),
    source_id TEXT, -- ID of the car/house or transaction reference
    profit_amount INTEGER, -- The calculated profit (only for mints)
    ratio_used NUMERIC, -- The minting ratio used (e.g. 4.0)
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for transactions
ALTER TABLE public.trollmond_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trollmond transactions"
    ON public.trollmond_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all trollmond transactions"
    ON public.trollmond_transactions FOR SELECT
    USING (public.is_admin_user(auth.uid()));

-- 3. Trollmond Config Table (for ratio)
CREATE TABLE IF NOT EXISTS public.trollmond_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);

-- Seed default config
INSERT INTO public.trollmond_config (key, value)
VALUES ('mint_ratio', '4'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 4. Add last_purchase_price to properties for profit tracking
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS last_purchase_price INTEGER DEFAULT 0;

-- 5. Internal Mint Function
CREATE OR REPLACE FUNCTION public.mint_trollmonds_internal(
    p_user_id UUID,
    p_profit_amount INTEGER,
    p_source_type TEXT,
    p_source_id TEXT,
    p_description TEXT
)
RETURNS INTEGER -- Returns amount minted
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ratio NUMERIC;
    v_mint_amount INTEGER;
BEGIN
    -- Get ratio
    SELECT (value::text)::numeric INTO v_ratio FROM public.trollmond_config WHERE key = 'mint_ratio';
    IF v_ratio IS NULL THEN v_ratio := 4.0; END IF;

    -- Calculate mint amount: floor(profit / ratio)
    IF p_profit_amount <= 0 THEN
        RETURN 0;
    END IF;

    v_mint_amount := FLOOR(p_profit_amount / v_ratio);

    IF v_mint_amount <= 0 THEN
        RETURN 0;
    END IF;

    -- Update balance
    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) + v_mint_amount
    WHERE id = p_user_id;

    -- Log transaction
    INSERT INTO public.trollmond_transactions (
        user_id, amount, type, source_type, source_id, profit_amount, ratio_used, description
    ) VALUES (
        p_user_id, v_mint_amount, 'mint', p_source_type, p_source_id, p_profit_amount, v_ratio, p_description
    );

    RETURN v_mint_amount;
END;
$$;

-- 6. Transfer Function (Gifting)
CREATE OR REPLACE FUNCTION public.transfer_trollmonds(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_amount INTEGER,
    p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_balance INTEGER;
BEGIN
    IF p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
    IF p_sender_id = p_receiver_id THEN RAISE EXCEPTION 'Cannot gift self'; END IF;

    -- Check balance
    SELECT trollmonds INTO v_sender_balance FROM public.user_profiles WHERE id = p_sender_id;
    IF v_sender_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient Trollmonds balance';
    END IF;

    -- Deduct from sender
    UPDATE public.user_profiles
    SET trollmonds = trollmonds - p_amount
    WHERE id = p_sender_id;

    -- Add to receiver
    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) + p_amount
    WHERE id = p_receiver_id;

    -- Log Sender
    INSERT INTO public.trollmond_transactions (
        user_id, amount, type, source_type, source_id, description
    ) VALUES (
        p_sender_id, -p_amount, 'gift_sent', 'broadcast_gift', p_receiver_id::text, p_description
    );

    -- Log Receiver
    INSERT INTO public.trollmond_transactions (
        user_id, amount, type, source_type, source_id, description
    ) VALUES (
        p_receiver_id, p_amount, 'gift_received', 'broadcast_gift', p_sender_id::text, p_description
    );

    RETURN TRUE;
END;
$$;

-- 7. Update sell_vehicle_to_dealership to include Minting
CREATE OR REPLACE FUNCTION public.sell_vehicle_to_dealership(
    p_user_car_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_car public.user_cars%ROWTYPE;
    v_price INTEGER;
    v_user_share INTEGER;
    v_admin_pool_share INTEGER;
    v_public_pool_share INTEGER;
    v_profit INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the car
    SELECT * INTO v_car FROM public.user_cars WHERE id = p_user_car_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Car not found';
    END IF;

    IF v_car.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You do not own this car';
    END IF;

    -- Get Price
    SELECT price INTO v_price 
    FROM public.vehicles_catalog 
    WHERE model_url = v_car.model_url;

    IF v_price IS NULL THEN
        RAISE EXCEPTION 'Vehicle catalog entry not found for valuation. Cannot sell.';
    END IF;

    IF v_price <= 0 THEN
         RAISE EXCEPTION 'Invalid vehicle value';
    END IF;

    -- Calculate Split (33.3% each)
    v_user_share := FLOOR(v_price / 3.0);
    v_admin_pool_share := FLOOR(v_price / 3.0);
    v_public_pool_share := v_price - v_user_share - v_admin_pool_share; 
    
    -- Credit User (Troll Coins)
    PERFORM public.troll_bank_credit_coins(
        v_user_id,
        v_user_share,
        'paid',
        'vehicle_sale_dealership',
        jsonb_build_object('car_id', v_car.id, 'model', v_car.car_id)::text
    );

    -- Credit Admin Pool
    UPDATE public.admin_pool
    SET trollcoins_balance = trollcoins_balance + v_admin_pool_share + v_public_pool_share,
        updated_at = now()
    WHERE id = (SELECT id FROM public.admin_pool LIMIT 1);

    -- TROLLMONDS MINTING
    -- Profit = Sale Price (User Share) - Purchase Price
    -- We assume purchase_price is tracked. If NULL, we treat cost as 0 (full profit) or maybe 0 profit?
    -- User requirement: "No profit -> NO Trollmonds".
    -- If purchase_price is 0 (won/gifted), profit is full.
    v_profit := v_user_share - COALESCE(v_car.purchase_price, 0);

    IF v_profit > 0 THEN
        PERFORM public.mint_trollmonds_internal(
            v_user_id,
            v_profit,
            'car_sale',
            v_car.id::text,
            'Profit from selling ' || v_car.car_id
        );
    END IF;

    -- Delete User Car
    DELETE FROM public.user_cars WHERE id = p_user_car_id;
    
    RETURN jsonb_build_object(
        'success', true, 
        'sale_price', v_price, 
        'user_share', v_user_share, 
        'profit', v_profit
    );
END;
$$;

-- 8. Update sell_house_to_bank to include Minting
CREATE OR REPLACE FUNCTION public.sell_house_to_bank(
    house_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_house RECORD;
    v_seller_id UUID;
    v_admin_id UUID;
    v_price BIGINT;
    v_third BIGINT;
    v_seller_share BIGINT;
    v_admin_pool_share_1 BIGINT;
    v_admin_pool_share_2 BIGINT;
    v_admin_pool_total BIGINT;
    v_admin_pool_id UUID;
    v_profit INTEGER;
BEGIN
    -- Get House Details
    SELECT * INTO v_house FROM public.properties WHERE id = house_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    v_seller_id := v_house.owner_user_id;
    
    IF v_seller_id <> auth.uid() THEN
        RAISE EXCEPTION 'You do not own this property';
    END IF;

    -- Get Admin ID (Bank Admin)
    SELECT id INTO v_admin_id 
    FROM public.user_profiles 
    WHERE role = 'admin' OR is_admin = true 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF v_admin_id IS NULL THEN
         SELECT id INTO v_admin_id FROM public.user_profiles WHERE id != auth.uid() ORDER BY created_at ASC LIMIT 1;
    END IF;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'Bank admin not found';
    END IF;

    -- Calculate Values
    v_price := COALESCE(v_house.base_value, 0);
    
    IF v_price <= 0 THEN
       v_price := COALESCE(v_house.ask_price, 0);
    END IF;
    
    IF v_price <= 0 THEN
        IF v_house.is_starter THEN
             v_price := 1500;
        ELSE
             RAISE EXCEPTION 'Property has no value';
        END IF;
    END IF;

    v_third := FLOOR(v_price / 3);
    v_seller_share := v_third;
    v_admin_pool_share_1 := v_third;
    v_admin_pool_share_2 := v_price - v_seller_share - v_admin_pool_share_1;
    v_admin_pool_total := v_admin_pool_share_1 + v_admin_pool_share_2;

    -- Pay Seller
    PERFORM public.troll_bank_credit_coins(
        v_seller_id,
        v_seller_share::INT,
        'paid', 
        'property_sale_seller',
        house_id::TEXT
    );

    -- Admin Pool Logic
    SELECT id INTO v_admin_pool_id FROM public.admin_pool LIMIT 1;
    IF v_admin_pool_id IS NULL THEN
        INSERT INTO public.admin_pool (user_id, trollcoins_balance) VALUES (v_admin_id, 0) RETURNING id INTO v_admin_pool_id;
    END IF;
    UPDATE public.admin_pool SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + v_admin_pool_total, updated_at = NOW() WHERE id = v_admin_pool_id;
    INSERT INTO public.admin_pool_ledger (amount, reason, ref_user_id, created_at)
    VALUES (v_admin_pool_total, 'Property Sale Profit', v_seller_id, NOW());

    -- TROLLMONDS MINTING
    -- Use last_purchase_price if available
    v_profit := v_seller_share - COALESCE(v_house.last_purchase_price, 0);
    
    IF v_profit > 0 THEN
        PERFORM public.mint_trollmonds_internal(
            v_seller_id,
            v_profit,
            'property_sale',
            house_id::TEXT,
            'Profit from selling property ' || COALESCE(v_house.name, 'Unknown')
        );
    END IF;

    -- Transfer Property
    UPDATE public.properties
    SET owner_user_id = v_admin_id,
        is_listed = false,
        is_active_home = false,
        updated_at = NOW(),
        last_purchase_price = 0 -- Reset cost basis for bank
    WHERE id = house_id;

    RETURN jsonb_build_object(
        'success', true,
        'seller_share', v_seller_share,
        'profit', v_profit
    );
END;
$$;

-- 9. Update buy_property_with_loan to set last_purchase_price
CREATE OR REPLACE FUNCTION public.buy_property_with_loan(p_property_id UUID, p_down_payment INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_property RECORD;
    v_price INTEGER;
    v_loan_amount INTEGER;
    v_min_down INTEGER;
    v_balance INTEGER;
    v_loan_id UUID;
    v_prev_owner_id UUID;
BEGIN
    SELECT * INTO v_property FROM public.properties WHERE id = p_property_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Property not found');
    END IF;

    v_price := v_property.price;
    v_min_down := ceil(v_price * 0.10);

    IF p_down_payment < v_min_down THEN
        RETURN jsonb_build_object('success', false, 'error', 'Down payment must be at least 10%');
    END IF;

    SELECT troll_coins INTO v_balance FROM public.user_profiles WHERE id = v_user_id;
    IF v_balance < p_down_payment THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    v_loan_amount := v_price - p_down_payment;
    v_prev_owner_id := v_property.owner_id;

    -- Deduct Down Payment
    UPDATE public.user_profiles SET troll_coins = troll_coins - p_down_payment WHERE id = v_user_id;

    -- Create Loan
    INSERT INTO public.property_loans (user_id, property_id, total_amount, remaining_amount, interest_rate, next_payment_due)
    VALUES (v_user_id, p_property_id, v_loan_amount, v_loan_amount, 5.0, NOW() + INTERVAL '30 days')
    RETURNING id INTO v_loan_id;

    -- Transfer Property
    UPDATE public.properties
    SET owner_id = v_user_id, -- Handle both owner_id and owner_user_id just in case
        owner_user_id = v_user_id,
        is_for_rent = false,
        is_listed = false,
        last_purchase_price = v_price -- Track cost basis!
    WHERE id = p_property_id;

    -- Pay Previous Owner (if not bank/system)
    IF v_prev_owner_id IS NOT NULL THEN
        PERFORM public.troll_bank_credit_coins(v_prev_owner_id, v_price, 'paid', 'property_sale', p_property_id::text);
    END IF;

    RETURN jsonb_build_object('success', true, 'loan_id', v_loan_id);
END;
$$;

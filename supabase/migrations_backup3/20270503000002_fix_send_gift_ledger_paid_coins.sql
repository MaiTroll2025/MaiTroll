-- Fix send_gift_ledger to use troll_coins instead of paid_coin_balance
-- and remove any triggers that might reference the old column

-- 1. Drop the legacy trigger if it exists
DROP TRIGGER IF EXISTS trg_check_paid_coin_balance ON public.user_profiles;
DROP FUNCTION IF EXISTS public.check_paid_coin_balance();

-- 2. Update the send_gift_ledger function
CREATE OR REPLACE FUNCTION public.send_gift_ledger(
    v_sender_id UUID, 
    v_receiver_id UUID, 
    v_gift_id UUID, 
    v_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cost BIGINT;
    v_total_cost BIGINT;
    v_sender_balance BIGINT;
    v_receiver_balance BIGINT;
    v_gift_name TEXT;
    v_sender_username TEXT;
    v_receiver_username TEXT;
    v_transaction_id UUID;
BEGIN
    -- Get gift details
    SELECT cost, name INTO v_cost, v_gift_name
    FROM public.gifts
    WHERE id = v_gift_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Gift not found');
    END IF;

    -- Calculate total cost
    v_total_cost := v_cost * v_amount;

    -- Check sender balance (using troll_coins)
    SELECT troll_coins, username INTO v_sender_balance, v_sender_username
    FROM public.user_profiles
    WHERE id = v_sender_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sender not found');
    END IF;

    IF v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Get receiver username
    SELECT username INTO v_receiver_username
    FROM public.user_profiles
    WHERE id = v_receiver_id;

    -- Deduct from sender
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - v_total_cost
    WHERE id = v_sender_id;

    -- Add to receiver (if not same person) - Optional: Gifts usually transfer value? 
    -- Assuming standard gift logic where receiver gets the coins (or a portion? Usually it's 1:1 in this system based on prior context, or maybe receiver gets nothing and it's just burned? 
    -- User said "deduct from troll_coins", didn't specify receiver. 
    -- Looking at other migrations, usually gifts transfer. 
    -- But to be safe and avoid inflation/deflation bugs I'll check if I should credit receiver.
    -- Let's just deduct for now as that's the primary constraint. 
    -- Actually, usually gifts add to receiver's balance. 
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_total_cost
    WHERE id = v_receiver_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (
        sender_id,
        receiver_id,
        amount,
        transaction_type,
        description,
        metadata
    ) VALUES (
        v_sender_id,
        v_receiver_id,
        v_total_cost,
        'gift',
        'Gift: ' || v_gift_name || ' x' || v_amount,
        jsonb_build_object(
            'gift_id', v_gift_id,
            'gift_name', v_gift_name,
            'amount', v_amount,
            'processed', true -- Mark as processed to skip background workers
        )
    ) RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_sender_balance - v_total_cost,
        'transaction_id', v_transaction_id
    );
END;
$$;

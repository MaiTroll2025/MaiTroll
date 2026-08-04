
-- Migration to fix XP granting logic in RPCs
-- 1. Updates spend_coins to grant XP to sender (gift_sent) and receiver (gift_received)
-- 2. Updates troll_bank_credit_coins to grant XP for purchases (coin_purchase, paypal_purchase, etc.)

-- Recreate spend_coins RPC with XP logic
CREATE OR REPLACE FUNCTION public.spend_coins(
    p_sender_id UUID,
    p_receiver_id UUID,
    p_coin_amount BIGINT,
    p_item TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_sender_balance BIGINT;
    v_gift_id UUID;
BEGIN
    -- Check sender balance
    SELECT troll_coins INTO v_sender_balance
    FROM public.user_profiles
    WHERE id = p_sender_id;

    IF v_sender_balance IS NULL OR v_sender_balance < p_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Deduct from sender
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_coin_amount
    WHERE id = p_sender_id;

    -- Credit to receiver
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + p_coin_amount
    WHERE id = p_receiver_id;

    -- Record transaction
    INSERT INTO public.coin_transactions (
        sender_id, receiver_id, amount, item, metadata
    ) VALUES (
        p_sender_id, p_receiver_id, p_coin_amount, p_item, p_metadata
    ) RETURNING id INTO v_gift_id;

    -- Grant XP to Sender (0.25 XP per coin spent on gifts)
    PERFORM public.grant_xp(
        p_sender_id,
        (p_coin_amount * 0.25)::bigint,
        'gift_sent',
        v_gift_id::text || '_sender',
        jsonb_build_object('receiver_id', p_receiver_id, 'item', p_item)
    );

    -- Grant XP to Receiver (1 XP per coin received)
    PERFORM public.grant_xp(
        p_receiver_id,
        p_coin_amount,
        'gift_received',
        v_gift_id::text || '_receiver',
        jsonb_build_object('sender_id', p_sender_id, 'item', p_item)
    );

    RETURN jsonb_build_object(
        'success', true, 
        'new_balance', v_sender_balance - p_coin_amount,
        'transaction_id', v_gift_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Recreate troll_bank_credit_coins with XP logic for purchases
CREATE OR REPLACE FUNCTION public.troll_bank_credit_coins(
    p_user_id UUID,
    p_coins BIGINT,
    p_bucket TEXT,
    p_source TEXT,
    p_ref_id TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
    v_user_gets BIGINT := p_coins;
    v_repay_amount BIGINT := 0;
    v_new_loan_balance BIGINT := 0;
    v_loan_status TEXT := NULL;
    v_loan_record RECORD;
    v_ledger_id UUID;
BEGIN
    -- 1. Create Ledger Entry for Income
    INSERT INTO public.coin_ledger (
        user_id, delta, bucket, source, ref_id, metadata, direction
    ) VALUES (
        p_user_id, p_coins, p_bucket, p_source, p_ref_id, p_metadata, 'in'
    ) RETURNING id INTO v_ledger_id;

    -- 2. Check for Active Loan
    SELECT * INTO v_loan_record
    FROM public.loans
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY created_at ASC
    LIMIT 1;

    -- 3. Calculate Repayment (50% rule) if applicable
    IF v_loan_record IS NOT NULL AND p_bucket = 'paid' THEN
        v_repay_amount := floor(p_coins * 0.5);
        
        -- Don't take more than the loan balance
        IF v_repay_amount > v_loan_record.balance THEN
            v_repay_amount := v_loan_record.balance;
        END IF;

        v_user_gets := p_coins - v_repay_amount;
    END IF;

    -- 4. Update User Balance
    UPDATE public.user_profiles
    SET troll_coins = troll_coins + v_user_gets
    WHERE id = p_user_id;

    -- 5. Process Loan Repayment
    IF v_repay_amount > 0 THEN
        v_new_loan_balance := v_loan_record.balance - v_repay_amount;
        v_loan_status := 'active';
        
        IF v_new_loan_balance <= 0 THEN
            v_new_loan_balance := 0;
            v_loan_status := 'paid';
        END IF;

        UPDATE public.loans
        SET balance = v_new_loan_balance,
            status = v_loan_status,
            updated_at = now()
        WHERE id = v_loan_record.id;

        -- Log Repayment in Ledger
        INSERT INTO public.coin_ledger (
            user_id, delta, bucket, source, ref_id, metadata, direction
        ) VALUES (
            p_user_id, -v_repay_amount, 'repayment', 'loan_repayment', 
            v_loan_record.id::text, 
            jsonb_build_object('original_source', p_source, 'ref_id', p_ref_id), 
            'out'
        );
    END IF;

    -- 6. Grant XP for Purchases
    -- 0.5 XP per coin purchased (approx 50 XP per $1)
    IF p_source IN ('coin_purchase', 'paypal_purchase', 'cashapp_purchase', 'stripe_purchase') THEN
        PERFORM public.grant_xp(
            p_user_id,
            (p_coins * 0.5)::bigint,
            p_source,
            COALESCE(p_ref_id, v_ledger_id::text),
            p_metadata
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'user_gets', v_user_gets,
        'repay', v_repay_amount,
        'new_loan_balance', v_new_loan_balance,
        'loan_status', v_loan_status,
        'ledger_id', v_ledger_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

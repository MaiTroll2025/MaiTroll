-- Migration: Refactor process_gift_with_lucky to use Troll Bank pipeline
-- Description: Ensures gift transactions use the centralized coin ledger and repayment rules.

CREATE OR REPLACE FUNCTION public.process_gift_with_lucky(
    p_sender_id uuid,
    p_receiver_id uuid,
    p_paid_coins bigint,
    p_gift_type text DEFAULT 'standard'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_spend_result jsonb;
    v_credit_result jsonb;
    v_lucky_multiplier integer;
    v_trollmonds_awarded bigint := 0;
    v_event_id uuid;
    v_admin_check boolean := false;
    v_sender_balance bigint;
BEGIN
    -- Input validation
    IF p_paid_coins <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid coin amount');
    END IF;

    IF p_sender_id = p_receiver_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot send gift to yourself');
    END IF;

    -- Check if receiver is admin
    SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = p_receiver_id AND role = 'admin') INTO v_admin_check;

    -- 1. Spend coins (Atomic deduction via Troll Bank)
    -- This handles balance check and locking
    SELECT public.troll_bank_spend_coins_secure(
        p_sender_id,
        p_paid_coins::int,
        'paid', -- spending usually comes from paid bucket logic, or fungible
        'gift_sent',
        null,
        jsonb_build_object('receiver_id', p_receiver_id, 'gift_type', p_gift_type)
    ) INTO v_spend_result;

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN jsonb_build_object('success', false, 'error', v_spend_result->>'error');
    END IF;

    v_sender_balance := (v_spend_result->>'new_balance')::bigint;

    -- 2. Credit receiver (Atomic credit via Troll Bank)
    -- This handles loan repayment automatically
    SELECT public.troll_bank_credit_coins(
        p_receiver_id,
        p_paid_coins::int,
        'gifted',
        'gift_received',
        null
    ) INTO v_credit_result;

    -- 3. Update receiver's total_earned_coins (for cashout logic)
    UPDATE user_profiles
    SET total_earned_coins = COALESCE(total_earned_coins, 0) + p_paid_coins
    WHERE id = p_receiver_id;

    -- 4. Lucky Multiplier Logic
    -- We need the helper function calculate_lucky_multiplier if it exists
    BEGIN
        SELECT public.calculate_lucky_multiplier(p_paid_coins) INTO v_lucky_multiplier;
    EXCEPTION WHEN OTHERS THEN
        -- Fallback if function missing
        v_lucky_multiplier := NULL;
    END;

    IF v_lucky_multiplier IS NOT NULL THEN
        v_trollmonds_awarded := p_paid_coins * v_lucky_multiplier;
        
        -- Credit Trollmonds (assuming simple column update for now as secondary currency)
        UPDATE user_profiles
        SET trollmonds = COALESCE(trollmonds, 0) + v_trollmonds_awarded
        WHERE id = p_sender_id;
    END IF;

    -- 5. Log Event
    INSERT INTO lucky_trollmond_events (
        user_id, gift_id, spent_paid_coins, multiplier, trollmonds_awarded
    ) VALUES (
        p_sender_id, gen_random_uuid(), p_paid_coins, v_lucky_multiplier, v_trollmonds_awarded
    ) RETURNING id INTO v_event_id;

    -- 6. Process admin gift if needed
    IF v_admin_check THEN
        BEGIN
            PERFORM public.process_admin_gift(p_sender_id, p_receiver_id, p_paid_coins);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'spent_coins', p_paid_coins,
        'lucky_multiplier', v_lucky_multiplier,
        'trollmonds_awarded', v_trollmonds_awarded,
        'new_paid_balance', v_sender_balance, -- mapping troll_coins to new_paid_balance for frontend compat
        'event_id', v_event_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_gift_with_lucky(uuid, uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_gift_with_lucky(uuid, uuid, bigint, text) TO service_role;

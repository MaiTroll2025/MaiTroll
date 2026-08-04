DROP FUNCTION IF EXISTS public.pay_bank_loan(uuid, int);
CREATE OR REPLACE FUNCTION public.pay_bank_loan(p_loan_id uuid, p_amount int)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    loan_record RECORD;
    user_balance int;
    new_balance int;
    principal_val int;
BEGIN
    -- Check if loan exists and belongs to user
    SELECT * INTO loan_record
    FROM public.loans
    WHERE id = p_loan_id AND user_id = auth.uid();

    IF loan_record IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Loan not found');
    END IF;

    IF loan_record.status != 'active' THEN
        RETURN json_build_object('success', false, 'error', 'Loan is not active');
    END IF;

    -- Check user balance
    SELECT troll_coins INTO user_balance
    FROM public.user_profiles
    WHERE id = auth.uid();

    IF user_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient funds');
    END IF;

    -- Calculate new loan balance
    -- Ensure we don't pay more than needed
    IF p_amount > loan_record.balance THEN
        p_amount := loan_record.balance;
    END IF;

    new_balance := loan_record.balance - p_amount;
    principal_val := loan_record.principal;

    -- Deduct coins from user
    UPDATE public.user_profiles
    SET troll_coins = troll_coins - p_amount
    WHERE id = auth.uid();

    -- Add ledger entry for repayment
    INSERT INTO public.coin_ledger (user_id, delta, bucket, source, reason, direction)
    VALUES (auth.uid(), -p_amount, 'repayment', 'Bank Loan Repayment', 'Manual repayment of loan', 'out');

    -- Update loan
    IF new_balance <= 0 THEN
        UPDATE public.loans
        SET balance = 0, status = 'paid'
        WHERE id = p_loan_id;

        -- Increase credit score by 5% of principal
        UPDATE public.user_credit
        SET score = LEAST(800, score + (principal_val * 0.05)),
            updated_at = NOW()
        WHERE user_id = auth.uid();
        
        -- Also log credit event
        INSERT INTO public.credit_events (user_id, event_type, delta, source_table, source_id, metadata)
        VALUES (auth.uid(), 'loan_repaid', (principal_val * 0.05), 'loans', p_loan_id, jsonb_build_object('principal', principal_val));
        
    ELSE
        UPDATE public.loans
        SET balance = new_balance
        WHERE id = p_loan_id;
    END IF;

    RETURN json_build_object('success', true, 'new_balance', new_balance, 'paid_amount', p_amount);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

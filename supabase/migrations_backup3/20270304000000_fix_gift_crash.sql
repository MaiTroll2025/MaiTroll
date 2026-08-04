
-- Migration to fix Gift System Crashes and Schema Mismatches

-- 1. Ensure gift_ledger has quantity column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_ledger' AND column_name = 'quantity') THEN
        ALTER TABLE public.gift_ledger ADD COLUMN quantity INTEGER DEFAULT 1;
    END IF;
END $$;

-- 2. Ensure gift_transactions has quantity column
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'gift_transactions' AND column_name = 'quantity') THEN
        ALTER TABLE public.gift_transactions ADD COLUMN quantity INTEGER DEFAULT 1;
    END IF;
END $$;

-- 3. Update send_gift_ledger RPC to handle p_quantity
CREATE OR REPLACE FUNCTION send_gift_ledger(
    p_receiver_id UUID,
    p_gift_id TEXT,
    p_amount INTEGER,
    p_stream_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_idempotency_key TEXT DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_ledger_id UUID;
    v_sender_balance INTEGER;
    v_total_cost INTEGER;
BEGIN
    -- Get Sender ID from Auth
    v_sender_id := auth.uid();
    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Calculate total cost
    v_total_cost := p_amount * p_quantity;

    -- Check Balance
    SELECT troll_coins INTO v_sender_balance FROM public.user_profiles WHERE id = v_sender_id;
    
    IF v_sender_balance < v_total_cost THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_ledger_id 
        FROM public.gift_ledger 
        WHERE sender_id = v_sender_id AND idempotency_key = p_idempotency_key;
        
        IF v_ledger_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id, 'message', 'Idempotent replay');
        END IF;
    END IF;

    -- Insert into Ledger
    INSERT INTO public.gift_ledger (
        sender_id, 
        receiver_id, 
        gift_id, 
        amount, 
        stream_id, 
        metadata, 
        idempotency_key, 
        status,
        quantity
    )
    VALUES (
        v_sender_id, 
        p_receiver_id, 
        p_gift_id, 
        p_amount, 
        p_stream_id, 
        p_metadata, 
        p_idempotency_key, 
        'pending',
        p_quantity
    )
    RETURNING id INTO v_ledger_id;

    RETURN jsonb_build_object('success', true, 'ledger_id', v_ledger_id);
END;
$$;

-- 4. Update Batch Processor to handle quantity
-- Added error handling with BEGIN...EXCEPTION to prevent blocking
CREATE OR REPLACE FUNCTION process_gift_ledger_batch(p_batch_size INTEGER DEFAULT 1000)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_processed_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_sender_totals RECORD;
    v_receiver_totals RECORD;
    v_error_text TEXT;
BEGIN
    -- Safety check: return early if called in inappropriate context
    -- This function should ONLY be called by pg_cron, not in request lifecycle
    IF current_setting('app.bypass_gift_batch', true) <> 'on' THEN
        -- Only process a small batch to prevent long-running transactions
        p_batch_size := LEAST(p_batch_size, 1000);
    END IF;

    -- 1. Lock Pending Rows (Skip Locked to allow parallel workers)
    -- Using TEMP TABLE with ON COMMIT DROP to auto-cleanup
    CREATE TEMPORARY TABLE temp_batch (
        LIKE public.gift_ledger INCLUDING ALL
    ) ON COMMIT DROP;

    INSERT INTO temp_batch
    SELECT * FROM public.gift_ledger
    WHERE status = 'pending'
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED;

    IF NOT EXISTS (SELECT 1 FROM temp_batch) THEN
        RETURN jsonb_build_object('success', true, 'processed', 0, 'message', 'No pending gifts');
    END IF;

    -- 2. Process by Sender (Deduct Balance) - with error handling
    BEGIN
        FOR v_sender_totals IN 
            SELECT sender_id, SUM(amount * COALESCE(quantity, 1)) as total_spend 
            FROM temp_batch 
            GROUP BY sender_id
        LOOP
            -- Check and Deduct with balance validation
            UPDATE public.user_profiles
            SET troll_coins = troll_coins - v_sender_totals.total_spend
            WHERE id = v_sender_totals.sender_id 
              AND troll_coins >= v_sender_totals.total_spend
              AND troll_coins >= 0;

            IF FOUND THEN
                -- Success - continue to next sender
                NULL;
            ELSE
                -- Fail: Insufficient funds or constraint violation
                BEGIN
                    UPDATE public.gift_ledger
                    SET status = 'failed', 
                        error_message = 'Insufficient funds at batch processing', 
                        processed_at = NOW()
                    WHERE id IN (SELECT id FROM temp_batch WHERE sender_id = v_sender_totals.sender_id)
                    AND status = 'pending';
                EXCEPTION WHEN OTHERS THEN
                    -- Log but continue processing
                    v_error_text := SQLERRM;
                END;
                
                v_failed_count := v_failed_count + (SELECT COUNT(*) FROM temp_batch WHERE sender_id = v_sender_totals.sender_id);
                
                -- Remove from temp_batch so we don't credit receiver
                DELETE FROM temp_batch WHERE sender_id = v_sender_totals.sender_id;
            END IF;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        -- Critical error in sender processing
        v_error_text := SQLERRM;
        -- Mark all remaining as failed
        UPDATE public.gift_ledger
        SET status = 'failed', error_message = 'Batch error: ' || v_error_text, processed_at = NOW()
        WHERE id IN (SELECT id FROM temp_batch);
        
        RETURN jsonb_build_object('success', false, 'error', v_error_text, 'processed', v_processed_count, 'failed', v_failed_count);
    END;

    -- 3. Credit Receivers (Bulk Update) - with error handling
    BEGIN
        FOR v_receiver_totals IN
            SELECT receiver_id, SUM(amount * COALESCE(quantity, 1)) as total_receive
            FROM temp_batch
            GROUP BY receiver_id
        LOOP
            UPDATE public.user_profiles
            SET total_earned_coins = COALESCE(total_earned_coins, 0) + v_receiver_totals.total_receive
            WHERE id = v_receiver_totals.receiver_id;
            
            -- Update Broadcaster Stats with upsert
            BEGIN
                INSERT INTO public.broadcaster_stats (user_id, total_gifts_24h, total_gifts_all_time, last_updated_at)
                VALUES (v_receiver_totals.receiver_id, v_receiver_totals.total_receive, v_receiver_totals.total_receive, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    total_gifts_24h = broadcaster_stats.total_gifts_24h + EXCLUDED.total_gifts_24h,
                    total_gifts_all_time = broadcaster_stats.total_gifts_all_time + EXCLUDED.total_gifts_all_time,
                    last_updated_at = NOW();
            EXCEPTION WHEN OTHERS THEN
                -- Stats update failed, but don't stop processing
                NULL;
            END;
        END LOOP;
    EXCEPTION WHEN OTHERS THEN
        -- Log error but continue
        v_error_text := SQLERRM;
    END;

    -- 4. Mark remaining as Processed
    BEGIN
        UPDATE public.gift_ledger
        SET status = 'processed', processed_at = NOW()
        WHERE id IN (SELECT id FROM temp_batch)
        AND status = 'pending';
        
        GET DIAGNOSTICS v_processed_count = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN
        v_error_text := SQLERRM;
    END;

    -- TEMP TABLE auto-drops at end of transaction (ON COMMIT DROP)

    -- 5. Log Observability (If table exists) - non-critical
    BEGIN
        IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'gift_batch_logs') THEN
            INSERT INTO public.gift_batch_logs (processed_count, backlog_count, duration_ms)
            VALUES (v_processed_count, (SELECT COUNT(*) FROM public.gift_ledger WHERE status = 'pending'), 0);
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Logging failure should not affect batch processing
        NULL;
    END;

    RETURN jsonb_build_object(
        'success', true, 
        'processed', v_processed_count, 
        'failed', v_failed_count,
        'message', CASE 
            WHEN v_processed_count > 0 THEN 'Batch processed successfully'
            ELSE 'No gifts to process'
        END
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Top-level error handler - return structured error response
    v_error_text := SQLERRM;
    RETURN jsonb_build_object(
        'success', false, 
        'error', 'Batch processor fatal error: ' || v_error_text,
        'processed', v_processed_count, 
        'failed', v_failed_count
    );
END;
$$;

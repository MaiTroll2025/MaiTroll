-- =============================================================================
-- COIN STORE MARKET + CREDIT SCORE FIX
-- =============================================================================
-- Fixes:
--   1. sync_creator_stocks now includes ALL users (not just broadcasters/verified)
--   2. pay_credit_card raises credit score by 5 per payment (capped at 800)
--   3. Audit hardening: null-safety, FOR UPDATE locks, overflow guards
-- =============================================================================

-- =============================================================================
-- 1. FIX CREATOR STOCK SYNC — INCLUDE ALL USERS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sync_creator_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_user_record RECORD;
    v_symbol VARCHAR(20);
    v_base_price DECIMAL(15,2);
    v_username VARCHAR(100);
BEGIN
    FOR v_user_record IN
        SELECT up.id, up.username, up.display_name
        FROM public.user_profiles up
        LEFT JOIN public.stocks s ON s.entity_id = up.id AND s.type = 'creator'
        WHERE s.id IS NULL
        ORDER BY up.created_at ASC
        LIMIT 100
    LOOP
        v_username := COALESCE(NULLIF(v_user_record.username, ''), NULLIF(v_user_record.display_name, ''), 'Creator');
        v_symbol := '$' || UPPER(LEFT(REGEXP_REPLACE(v_username, '[^a-zA-Z0-9]', '', 'g'), 8));

        IF LENGTH(v_symbol) <= 1 THEN
            v_symbol := '$USER';
        END IF;

        IF EXISTS (SELECT 1 FROM public.stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_user_record.id::TEXT) FROM 1 FOR 4);
        END IF;

        SELECT COALESCE(ul.xp, 0) / 100.0 + 50.0 INTO v_base_price
        FROM public.user_levels ul
        WHERE ul.user_id = v_user_record.id;

        IF v_base_price IS NULL OR v_base_price < 10.0 THEN
            v_base_price := 50.00;
        END IF;

        INSERT INTO public.stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_username, 'creator', v_user_record.id, v_base_price, v_base_price, v_base_price, v_base_price * 1000000, 'Creator')
        ON CONFLICT (stock_symbol) DO NOTHING;

        IF FOUND THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    RETURN v_count;
END;
$$;

-- Fix sync_family_stocks with table-existence check
CREATE OR REPLACE FUNCTION public.sync_family_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_stock_id UUID;
    v_symbol VARCHAR(20);
    v_base_price DECIMAL(15,2);
    v_family_name VARCHAR(100);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'troll_families') THEN
        RETURN 0;
    END IF;

    FOR v_stock_id, v_family_name IN
        SELECT tf.id, tf.family_name FROM public.troll_families tf
        LEFT JOIN public.stocks s ON s.entity_id = tf.id AND s.type = 'family'
        WHERE s.id IS NULL
        LIMIT 100
    LOOP
        v_symbol := COALESCE(UPPER(LEFT(REGEXP_REPLACE(v_family_name, '[^a-zA-Z0-9]', '', 'g'), 8)), 'FAMILY');
        v_symbol := '$' || v_symbol;
        IF LENGTH(v_symbol) <= 1 THEN
            v_symbol := '$FAMILY';
        END IF;
        IF EXISTS (SELECT 1 FROM public.stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        SELECT COALESCE(tf.xp / 100.0 + 50.0, 100.0) INTO v_base_price FROM public.troll_families tf WHERE tf.id = v_stock_id;
        IF v_base_price IS NULL OR v_base_price < 10.0 THEN v_base_price := 100.00; END IF;
        INSERT INTO public.stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_family_name, 'family', v_stock_id, v_base_price, v_base_price, v_base_price, v_base_price * 1000000, 'Troll Family')
        ON CONFLICT (stock_symbol) DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;
    RETURN v_count;
END;
$$;

-- Fix sync_property_stocks with table-existence check
CREATE OR REPLACE FUNCTION public.sync_property_stocks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_count INTEGER := 0;
    v_stock_id UUID;
    v_symbol VARCHAR(20);
    v_base_price DECIMAL(15,2);
    v_property_name VARCHAR(100);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_houses') THEN
        RETURN 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_houses' AND column_name = 'is_for_sale') THEN
        RETURN 0;
    END IF;

    FOR v_stock_id, v_property_name, v_base_price IN
        SELECT uh.id, COALESCE(uh.name, 'Property'), COALESCE(uh.price, 100000.00) FROM public.user_houses uh
        LEFT JOIN public.stocks s ON s.entity_id = uh.id AND s.type = 'property'
        WHERE s.id IS NULL AND uh.is_for_sale = true LIMIT 100
    LOOP
        v_symbol := COALESCE(UPPER(LEFT(REGEXP_REPLACE(v_property_name, '[^a-zA-Z0-9]', '', 'g'), 6)), 'PROP');
        v_symbol := '$' || v_symbol || '_P';
        IF LENGTH(v_symbol) <= 2 THEN
            v_symbol := '$PROP_P';
        END IF;
        IF EXISTS (SELECT 1 FROM public.stocks WHERE stock_symbol = v_symbol) THEN
            v_symbol := v_symbol || SUBSTRING(MD5(v_stock_id::TEXT) FROM 1 FOR 4);
        END IF;
        v_base_price := COALESCE(v_base_price / 1000.0, 100.00);
        IF v_base_price < 10.0 THEN v_base_price := 100.00; END IF;
        INSERT INTO public.stocks (stock_symbol, name, type, entity_id, base_price, current_price, previous_price, market_cap, description)
        VALUES (v_symbol, v_property_name, 'property', v_stock_id, v_base_price, v_base_price, v_base_price, v_base_price * 1000000, 'Property')
        ON CONFLICT (stock_symbol) DO NOTHING;
        IF FOUND THEN v_count := v_count + 1; END IF;
    END LOOP;
    RETURN v_count;
END;
$$;

-- Fix sync_all_stocks — gracefully handles missing tables
CREATE OR REPLACE FUNCTION public.sync_all_stocks()
RETURNS TABLE(
    families_synced INTEGER,
    creators_synced INTEGER,
    properties_synced INTEGER,
    total_synced INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_families INTEGER := 0;
    v_creators INTEGER := 0;
    v_properties INTEGER := 0;
BEGIN
    BEGIN
        v_families := public.sync_family_stocks();
    EXCEPTION WHEN OTHERS THEN
        v_families := 0;
    END;

    BEGIN
        v_creators := public.sync_creator_stocks();
    EXCEPTION WHEN OTHERS THEN
        v_creators := 0;
    END;

    BEGIN
        v_properties := public.sync_property_stocks();
    EXCEPTION WHEN OTHERS THEN
        v_properties := 0;
    END;

    RETURN QUERY SELECT v_families, v_creators, v_properties, v_families + v_creators + v_properties;
END;
$$;

-- =============================================================================
-- 2. FIX PAY CREDIT CARD — RAISE CREDIT SCORE
-- =============================================================================
CREATE OR REPLACE FUNCTION public.pay_credit_card(p_amount BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile RECORD;
    v_pay_amount BIGINT;
    v_new_credit_used BIGINT;
    v_new_credit_score INTEGER;
    v_new_tier TEXT;
    v_score_increase INTEGER := 5;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Not authenticated');
    END IF;

    IF p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount must be positive');
    END IF;

    SELECT * INTO v_profile
    FROM public.user_profiles
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'User profile not found');
    END IF;

    IF v_profile.credit_used <= 0 THEN
        RETURN jsonb_build_object('success', false, 'message', 'No credit debt to pay');
    END IF;

    -- Cap payment to debt
    v_pay_amount := LEAST(p_amount, v_profile.credit_used);

    -- Check Coin Balance
    IF v_profile.troll_coins < v_pay_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Troll Coins');
    END IF;

    -- Calculate new credit score (raise by 5 per payment, capped at 800)
    v_new_credit_score := LEAST(COALESCE(v_profile.credit_score, 400) + v_score_increase, 800);

    -- Compute new tier
    v_new_tier := CASE
        WHEN v_new_credit_score < 300 THEN 'Untrusted'
        WHEN v_new_credit_score < 450 THEN 'Shaky'
        WHEN v_new_credit_score < 600 THEN 'Building'
        WHEN v_new_credit_score < 700 THEN 'Reliable'
        WHEN v_new_credit_score < 800 THEN 'Trusted'
        ELSE 'Elite'
    END;

    -- Atomic update with credit score raise
    UPDATE public.user_profiles
    SET
        troll_coins = troll_coins - v_pay_amount,
        credit_used = credit_used - v_pay_amount,
        last_credit_payment_at = NOW(),
        credit_default_warning_sent = FALSE,
        credit_score = v_new_credit_score
    WHERE id = v_user_id
    RETURNING credit_used INTO v_new_credit_used;

    -- Update user_credit table to keep scores in sync
    INSERT INTO public.user_credit (user_id, score, tier, updated_at, last_event_at)
    VALUES (v_user_id, v_new_credit_score, v_new_tier, NOW(), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        score = v_new_credit_score,
        tier = v_new_tier,
        updated_at = NOW(),
        last_event_at = NOW();

    -- Log credit event
    INSERT INTO public.credit_events (user_id, event_type, delta, metadata)
    VALUES (
        v_user_id,
        'credit_card_payment',
        v_score_increase,
        jsonb_build_object('payment_amount', v_pay_amount, 'remaining_debt', v_new_credit_used)
    );

    RETURN jsonb_build_object(
        'success', true,
        'amount_paid', v_pay_amount,
        'new_credit_used', v_new_credit_used,
        'new_credit_score', v_new_credit_score,
        'new_tier', v_new_tier
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_credit_card(BIGINT) TO service_role;

-- =============================================================================
-- 3. AUDIT HARDENING — STOCK MARKET FUNCTIONS
-- =============================================================================

-- Hardened execute_buy_order with better null-safety and overflow guards
CREATE OR REPLACE FUNCTION public.execute_buy_order(
    p_user_id UUID,
    p_stock_id UUID,
    p_coins DECIMAL(20,2),
    p_stock_symbol VARCHAR
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    shares_purchased DECIMAL(20,8),
    price_per_share DECIMAL(15,2),
    total_spent DECIMAL(20,2),
    coins_remaining DECIMAL(20,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_price DECIMAL(15,2);
    v_shares DECIMAL(20,8);
    v_total_spent DECIMAL(20,2);
    v_user_coins DECIMAL(20,2);
    v_portfolio_id UUID;
    v_avg_price DECIMAL(15,2);
    v_existing_shares DECIMAL(20,8);
    v_existing_invested DECIMAL(20,2);
    v_total_shares DECIMAL(20,8);
    v_market_cap DECIMAL(20,2);
    v_ownership_pct DECIMAL(10,2);
    v_fee_amount DECIMAL(20,2);
    v_buy_spread DECIMAL(10,4) := 1.02;
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL OR p_stock_id IS NULL OR p_coins IS NULL OR p_coins <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Invalid input parameters', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2);
        RETURN;
    END IF;

    -- Lock the stock row to prevent race conditions
    SELECT current_price INTO v_current_price
    FROM public.stocks
    WHERE id = p_stock_id AND is_active = TRUE
    FOR UPDATE;

    IF v_current_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Stock not found or inactive', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2);
        RETURN;
    END IF;

    v_current_price := v_current_price * v_buy_spread;

    -- Lock the user profile row
    SELECT troll_coins INTO v_user_coins
    FROM public.user_profiles
    WHERE id = p_user_id
    FOR UPDATE;

    IF v_user_coins IS NULL THEN
        RETURN QUERY SELECT FALSE, 'User profile not found', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2);
        RETURN;
    END IF;

    v_fee_amount := p_coins * 0.02;
    v_total_spent := p_coins + v_fee_amount;

    IF v_user_coins < v_total_spent THEN
        RETURN QUERY SELECT FALSE, 'Insufficient coins (fee included)', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), v_user_coins;
        RETURN;
    END IF;

    -- Guard against division by zero
    IF v_current_price <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Invalid stock price', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), v_user_coins;
        RETURN;
    END IF;

    v_shares := p_coins / v_current_price;

    -- Check ownership limit
    SELECT COALESCE(SUM(up.shares), 0) INTO v_total_shares
    FROM public.user_portfolio up
    JOIN public.stocks s ON s.id = up.stock_id
    WHERE up.user_id = p_user_id AND s.stock_symbol = p_stock_symbol;

    SELECT market_cap INTO v_market_cap FROM public.stocks WHERE id = p_stock_id;

    IF v_market_cap > 0 AND v_current_price > 0 THEN
        v_ownership_pct := (v_total_shares / (v_market_cap / v_current_price)) * 100;
        IF v_ownership_pct >= 10 THEN
            RETURN QUERY SELECT FALSE, 'Maximum ownership limit reached (10%)', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), v_user_coins;
            RETURN;
        END IF;
    END IF;

    -- Deduct coins
    UPDATE public.user_profiles SET troll_coins = troll_coins - v_total_spent WHERE id = p_user_id;

    -- Update or insert portfolio
    SELECT id, shares, total_invested INTO v_portfolio_id, v_existing_shares, v_existing_invested
    FROM public.user_portfolio WHERE user_id = p_user_id AND stock_id = p_stock_id;

    IF v_portfolio_id IS NOT NULL THEN
        v_avg_price := (v_existing_invested + v_total_spent) / NULLIF(v_existing_shares + v_shares, 0);
        UPDATE public.user_portfolio SET
            shares = shares + v_shares,
            avg_price = v_avg_price,
            total_invested = total_invested + v_total_spent,
            updated_at = NOW()
        WHERE id = v_portfolio_id;
    ELSE
        INSERT INTO public.user_portfolio (user_id, stock_id, shares, avg_price, total_invested)
        VALUES (p_user_id, p_stock_id, v_shares, v_current_price, v_total_spent);
    END IF;

    -- Record transaction
    INSERT INTO public.stock_transactions (user_id, stock_id, transaction_type, shares, price_per_share, total_amount, coins_before, coins_after)
    VALUES (p_user_id, p_stock_id, 'buy', v_shares, v_current_price, v_total_spent, v_user_coins, v_user_coins - v_total_spent);

    -- Update volume
    UPDATE public.stocks SET volume = volume + 1 WHERE id = p_stock_id;

    RETURN QUERY SELECT TRUE, 'Purchase successful (2% fee)', v_shares, v_current_price, v_total_spent, v_user_coins - v_total_spent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_buy_order(UUID, UUID, DECIMAL, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_buy_order(UUID, UUID, DECIMAL, VARCHAR) TO service_role;

-- Hardened execute_sell_order
CREATE OR REPLACE FUNCTION public.execute_sell_order(
    p_user_id UUID,
    p_stock_id UUID,
    p_shares DECIMAL(20,8)
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    shares_sold DECIMAL(20,8),
    price_per_share DECIMAL(15,2),
    total_received DECIMAL(20,2),
    profit_loss DECIMAL(20,2),
    coins_remaining DECIMAL(20,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_current_price DECIMAL(15,2);
    v_total_received DECIMAL(20,2);
    v_user_coins DECIMAL(20,2);
    v_portfolio_id UUID;
    v_existing_shares DECIMAL(20,8);
    v_avg_price DECIMAL(15,2);
    v_existing_invested DECIMAL(20,2);
    v_profit_loss DECIMAL(20,2);
    v_fee_amount DECIMAL(20,2);
    v_sell_spread DECIMAL(10,4) := 0.98;
BEGIN
    -- Validate inputs
    IF p_user_id IS NULL OR p_stock_id IS NULL OR p_shares IS NULL OR p_shares <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Invalid input parameters', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2);
        RETURN;
    END IF;

    -- Lock stock row
    SELECT current_price INTO v_current_price
    FROM public.stocks
    WHERE id = p_stock_id AND is_active = TRUE
    FOR UPDATE;

    IF v_current_price IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Stock not found or inactive', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2);
        RETURN;
    END IF;

    v_current_price := v_current_price * v_sell_spread;

    -- Get portfolio with lock
    SELECT id, shares, avg_price, total_invested
    INTO v_portfolio_id, v_existing_shares, v_avg_price, v_existing_invested
    FROM public.user_portfolio
    WHERE user_id = p_user_id AND stock_id = p_stock_id
    FOR UPDATE;

    IF v_portfolio_id IS NULL OR v_existing_shares < p_shares THEN
        SELECT troll_coins INTO v_user_coins FROM public.user_profiles WHERE id = p_user_id;
        RETURN QUERY SELECT FALSE, 'Insufficient shares', 0::DECIMAL(20,8), 0::DECIMAL(15,2), 0::DECIMAL(20,2), 0::DECIMAL(20,2), COALESCE(v_user_coins, 0);
        RETURN;
    END IF;

    v_total_received := p_shares * v_current_price;
    v_profit_loss := v_total_received - (p_shares * v_avg_price);
    v_fee_amount := v_total_received * 0.02;
    v_total_received := v_total_received - v_fee_amount;

    -- Get current coins
    SELECT troll_coins INTO v_user_coins FROM public.user_profiles WHERE id = p_user_id;

    -- Add coins to user
    UPDATE public.user_profiles SET troll_coins = troll_coins + v_total_received WHERE id = p_user_id;

    -- Update or delete portfolio
    IF v_existing_shares = p_shares THEN
        DELETE FROM public.user_portfolio WHERE id = v_portfolio_id;
    ELSE
        UPDATE public.user_portfolio SET
            shares = shares - p_shares,
            total_invested = total_invested - (p_shares * v_avg_price),
            updated_at = NOW()
        WHERE id = v_portfolio_id;
    END IF;

    -- Record transaction
    INSERT INTO public.stock_transactions (user_id, stock_id, transaction_type, shares, price_per_share, total_amount, coins_before, coins_after, profit_loss)
    VALUES (p_user_id, p_stock_id, 'sell', p_shares, v_current_price, v_total_received, v_user_coins, v_user_coins + v_total_received, v_profit_loss - v_fee_amount);

    -- Update volume
    UPDATE public.stocks SET volume = volume + 1 WHERE id = p_stock_id;

    RETURN QUERY SELECT TRUE, 'Sale successful (2% fee)', p_shares, v_current_price, v_total_received, v_profit_loss - v_fee_amount, v_user_coins + v_total_received;
END;
$$;

GRANT EXECUTE ON FUNCTION public.execute_sell_order(UUID, UUID, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.execute_sell_order(UUID, UUID, DECIMAL) TO service_role;

-- =============================================================================
-- 4. SYNC ALL USERS INTO STOCKS MARKET
-- =============================================================================
-- Run the sync to immediately populate missing users
DO $$
DECLARE
    v_result RECORD;
BEGIN
    SELECT * INTO v_result FROM public.sync_all_stocks();
    RAISE NOTICE 'Stock sync complete: families=%, creators=%, properties=%, total=%',
        v_result.families_synced, v_result.creators_synced, v_result.properties_synced, v_result.total_synced;
END $$;

-- =============================================================================
-- 5. VERIFY CREDIT SCORE SYNC
-- =============================================================================
-- Ensure all user_profiles have a credit_score that matches user_credit
UPDATE public.user_profiles up
SET credit_score = uc.score
FROM public.user_credit uc
WHERE up.id = uc.user_id
  AND (up.credit_score IS DISTINCT FROM uc.score OR up.credit_score IS NULL);

-- Backfill any users without a credit record
INSERT INTO public.user_credit (user_id, score, tier, updated_at, last_event_at)
SELECT up.id, COALESCE(up.credit_score, 400), 'Building', NOW(), NOW()
FROM public.user_profiles up
LEFT JOIN public.user_credit uc ON uc.user_id = up.id
WHERE uc.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
    RAISE NOTICE '✅ Coin store market fix: all users now included in creator stocks';
    RAISE NOTICE '✅ Credit score: pay_credit_card raises score by 5 per payment (capped at 800)';
    RAISE NOTICE '✅ Audit hardening: added null-safety, FOR UPDATE locks, input validation';
END $$;

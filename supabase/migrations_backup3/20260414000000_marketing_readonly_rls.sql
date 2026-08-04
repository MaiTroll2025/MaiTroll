-- ============================================================================
-- MARKETING READ-ONLY ACCESS RLS POLICIES
-- ============================================================================
-- Allows marketing agencies to view all data but blocks all write operations
-- ============================================================================

-- ============================================================================
-- SECTION 1: HELPER FUNCTION TO CHECK MARKETING READONLY ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_marketing_readonly()
RETURNS BOOLEAN AS $$
DECLARE
    profile_row record;
BEGIN
    -- Get the current user's profile
    SELECT up.role INTO profile_row
    FROM user_profiles up
    WHERE up.id = auth.uid()
    LIMIT 1;
    
    RETURN profile_row.role = 'marketing_readonly';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SECTION 2: CORE USER DATA POLICIES (SELECT only for marketing_readonly)
-- ============================================================================

-- User profiles: Full read access, no writes
DROP POLICY IF EXISTS "Allow marketing_readonly select user_profiles" ON user_profiles;
CREATE POLICY "Allow marketing_readonly select user_profiles" ON user_profiles
    FOR SELECT
    TO authenticated
    USING (
        auth.role() = 'authenticated' 
        AND (
            (SELECT role FROM user_profiles WHERE id = auth.uid()) != 'marketing_readonly'
            OR is_marketing_readonly() = false
        )
    );

-- Marketing readonly can SELECT all profiles
DROP POLICY IF EXISTS "marketing_readonly can view user_profiles" ON user_profiles;
CREATE POLICY "marketing_readonly can view user_profiles" ON user_profiles
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block INSERT for marketing_readonly on user_profiles
DROP POLICY IF EXISTS "Block marketing_readonly insert user_profiles" ON user_profiles;
CREATE POLICY "Block marketing_readonly insert user_profiles" ON user_profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- Block UPDATE for marketing_readonly on user_profiles
DROP POLICY IF EXISTS "Block marketing_readonly update user_profiles" ON user_profiles;
CREATE POLICY "Block marketing_readonly update user_profiles" ON user_profiles
    FOR UPDATE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- Block DELETE for marketing_readonly on user_profiles
DROP POLICY IF EXISTS "Block marketing_readonly delete user_profiles" ON user_profiles;
CREATE POLICY "Block marketing_readonly delete user_profiles" ON user_profiles
    FOR DELETE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 3: STREAMS / BROADCASTING POLICIES
-- ============================================================================

-- Allow marketing_readonly to view streams
DROP POLICY IF EXISTS "marketing_readonly can view streams" ON streams;
CREATE POLICY "marketing_readonly can view streams" ON streams
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block stream creation
DROP POLICY IF EXISTS "Block marketing_readonly insert streams" ON streams;
CREATE POLICY "Block marketing_readonly insert streams" ON streams
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- Block stream updates
DROP POLICY IF EXISTS "Block marketing_readonly update streams" ON streams;
CREATE POLICY "Block marketing_readonly update streams" ON streams
    FOR UPDATE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- Block stream deletion
DROP POLICY IF EXISTS "Block marketing_readonly delete streams" ON streams;
CREATE POLICY "Block marketing_readonly delete streams" ON streams
    FOR DELETE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 4: TRANSACTIONS / PAYMENTS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view transactions
DROP POLICY IF EXISTS "marketing_readonly can view transactions" ON transactions;
CREATE POLICY "marketing_readonly can view transactions" ON transactions
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block transaction creation
DROP POLICY IF EXISTS "Block marketing_readonly insert transactions" ON transactions;
CREATE POLICY "Block marketing_readonly insert transactions" ON transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- Block transaction updates
DROP POLICY IF EXISTS "Block marketing_readonly update transactions" ON transactions;
CREATE POLICY "Block marketing_readonly update transactions" ON transactions
    FOR UPDATE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 5: GIFTS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view gifts
DROP POLICY IF EXISTS "marketing_readonly can view gifts" ON gifts;
CREATE POLICY "marketing_readonly can view gifts" ON gifts
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block gift creation
DROP POLICY IF EXISTS "Block marketing_readonly insert gifts" ON gifts;
CREATE POLICY "Block marketing_readonly insert gifts" ON gifts
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 6: CHAT / MESSAGES POLICIES
-- ============================================================================

-- Allow marketing_readonly to view messages (read-only chat)
DROP POLICY IF EXISTS "marketing_readonly can view messages" ON messages;
CREATE POLICY "marketing_readonly can view messages" ON messages
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block message creation
DROP POLICY IF EXISTS "Block marketing_readonly insert messages" ON messages;
CREATE POLICY "Block marketing_readonly insert messages" ON messages
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 7: BATTLES POLICIES
-- ============================================================================

-- Allow marketing_readonly to view battles
DROP POLICY IF EXISTS "marketing_readonly can view battles" ON battles;
CREATE POLICY "marketing_readonly can view battles" ON battles
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block battle creation
DROP POLICY IF EXISTS "Block marketing_readonly insert battles" ON battles;
CREATE POLICY "Block marketing_readonly insert battles" ON battles
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- Block battle updates
DROP POLICY IF EXISTS "Block marketing_readonly update battles" ON battles;
CREATE POLICY "Block marketing_readonly update battles" ON battles
    FOR UPDATE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 8: GLOBAL EVENTS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view global events
DROP POLICY IF EXISTS "marketing_readonly can view global_events" ON global_events;
CREATE POLICY "marketing_readonly can view global_events" ON global_events
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block event creation
DROP POLICY IF EXISTS "Block marketing_readonly insert global_events" ON global_events;
CREATE POLICY "Block marketing_readonly insert global_events" ON global_events
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 9: BROADCAST SEATS / STREAM PARTICIPATION POLICIES
-- ============================================================================

-- Allow marketing_readonly to view broadcast_seats
DROP POLICY IF EXISTS "marketing_readonly can view broadcast_seats" ON broadcast_seats;
CREATE POLICY "marketing_readonly can view broadcast_seats" ON broadcast_seats
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block seat creation/update
DROP POLICY IF EXISTS "Block marketing_readonly insert broadcast_seats" ON broadcast_seats;
CREATE POLICY "Block marketing_readonly insert broadcast_seats" ON broadcast_seats
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

DROP POLICY IF EXISTS "Block marketing_readonly update broadcast_seats" ON broadcast_seats;
CREATE POLICY "Block marketing_readonly update broadcast_seats" ON broadcast_seats
    FOR UPDATE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 10: BROADCASTER STATS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view broadcaster_stats
DROP POLICY IF EXISTS "marketing_readonly can view broadcaster_stats" ON broadcaster_stats;
CREATE POLICY "marketing_readonly can view broadcaster_stats" ON broadcaster_stats
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- ============================================================================
-- SECTION 11: WALLET / COINS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view user_wallets (read-only)
DROP POLICY IF EXISTS "marketing_readonly can view user_wallets" ON user_wallets;
CREATE POLICY "marketing_readonly can view user_wallets" ON user_wallets
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block wallet updates (spending)
DROP POLICY IF EXISTS "Block marketing_readonly update user_wallets" ON user_wallets;
CREATE POLICY "Block marketing_readonly update user_wallets" ON user_wallets
    FOR UPDATE
    TO authenticated
    USING (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 12: TROLL BANK / LOANS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view loans
DROP POLICY IF EXISTS "marketing_readonly can view loans" ON loans;
CREATE POLICY "marketing_readonly can view loans" ON loans
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block loan creation
DROP POLICY IF EXISTS "Block marketing_readonly insert loans" ON loans;
CREATE POLICY "Block marketing_readonly insert loans" ON loans
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- Allow marketing_readonly to view loan_payments
DROP POLICY IF EXISTS "marketing_readonly can view loan_payments" ON loan_payments;
CREATE POLICY "marketing_readonly can view loan_payments" ON loan_payments
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- ============================================================================
-- SECTION 13: PROPERTIES / ASSETS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view properties
DROP POLICY IF EXISTS "marketing_readonly can view properties" ON properties;
CREATE POLICY "marketing_readonly can view properties" ON properties
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- Block property creation
DROP POLICY IF EXISTS "Block marketing_readonly insert properties" ON properties;
CREATE POLICY "Block marketing_readonly insert properties" ON properties
    FOR INSERT
    TO authenticated
    WITH CHECK (is_marketing_readonly() = false);

-- ============================================================================
-- SECTION 14: MANUAL ORDERS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view manual_orders
DROP POLICY IF EXISTS "marketing_readonly can view manual_orders" ON manual_orders;
CREATE POLICY "marketing_readonly can view manual_orders" ON manual_orders
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- ============================================================================
-- SECTION 15: COIN TRANSACTIONS POLICIES
-- ============================================================================

-- Allow marketing_readonly to view coin_transactions
DROP POLICY IF EXISTS "marketing_readonly can view coin_transactions" ON coin_transactions;
CREATE POLICY "marketing_readonly can view coin_transactions" ON coin_transactions
    FOR SELECT
    TO authenticated
    USING (is_marketing_readonly() = true);

-- ============================================================================
-- DONE
-- ============================================================================

DO $$ 
BEGIN 
    RAISE NOTICE 'Marketing Read-Only RLS policies applied successfully';
END $$;
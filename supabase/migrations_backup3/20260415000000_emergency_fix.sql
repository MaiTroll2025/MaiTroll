-- Emergency fix: Remove ALL broken marketing RLS policies
-- Run this in Supabase SQL Editor

-- First drop policies that might depend on the function
DROP POLICY IF EXISTS "Allow marketing_readonly select user_profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view user_profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Block marketing_readonly insert user_profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Block marketing_readonly update user_profiles" ON user_profiles CASCADE;
DROP POLICY IF EXISTS "Block marketing_readonly delete user_profiles" ON user_profiles CASCADE;

DROP POLICY IF EXISTS "marketing_readonly can view streams" ON streams CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view transactions" ON transactions CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view gifts" ON gifts CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view messages" ON messages CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view battles" ON battles CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view global_events" ON global_events CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view broadcast_seats" ON broadcast_seats CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view broadcaster_stats" ON broadcaster_stats CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view user_wallets" ON user_wallets CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view loans" ON loans CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view loan_payments" ON loan_payments CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view properties" ON properties CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view manual_orders" ON manual_orders CASCADE;
DROP POLICY IF EXISTS "marketing_readonly can view coin_transactions" ON coin_transactions CASCADE;

-- Now drop the function
DROP FUNCTION IF EXISTS public.is_marketing_readonly() CASCADE;

SELECT 'Fixed! All broken RLS policies removed' AS status;
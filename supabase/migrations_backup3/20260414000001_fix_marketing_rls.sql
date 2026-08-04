-- Fix: Remove the broken marketing_readonly RLS policies that cause infinite recursion
-- Using CASCADE to drop dependent policies automatically

-- Drop all policies that depend on the broken function
DROP POLICY IF EXISTS "Allow marketing_readonly select user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "marketing_readonly can view user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Block marketing_readonly insert user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Block marketing_readonly update user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Block marketing_readonly delete user_profiles" ON user_profiles;

-- Streams
DROP POLICY IF EXISTS "marketing_readonly can view streams" ON streams;
DROP POLICY IF EXISTS "Block marketing_readonly insert streams" ON streams;
DROP POLICY IF EXISTS "Block marketing_readonly update streams" ON streams;
DROP POLICY IF EXISTS "Block marketing_readonly delete streams" ON streams;

-- transactions
DROP POLICY IF EXISTS "marketing_readonly can view transactions" ON transactions;
DROP POLICY IF EXISTS "Block marketing_readonly insert transactions" ON transactions;
DROP POLICY IF EXISTS "Block marketing_readonly update transactions" ON transactions;

-- Gifts
DROP POLICY IF EXISTS "marketing_readonly can view gifts" ON gifts;
DROP POLICY IF EXISTS "Block marketing_readonly insert gifts" ON gifts;

-- Messages
DROP POLICY IF EXISTS "marketing_readonly can view messages" ON messages;
DROP POLICY IF EXISTS "Block marketing_readonly insert messages" ON messages;

-- Battles
DROP POLICY IF EXISTS "marketing_readonly can view battles" ON battles;
DROP POLICY IF EXISTS "Block marketing_readonly insert battles" ON battles;
DROP POLICY IF EXISTS "Block marketing_readonly update battles" ON battles;

-- Global events
DROP POLICY IF EXISTS "marketing_readonly can view global_events" ON global_events;
DROP POLICY IF EXISTS "Block marketing_readonly insert global_events" ON global_events;

-- Broadcast seats
DROP POLICY IF EXISTS "marketing_readonly can view broadcast_seats" ON broadcast_seats;
DROP POLICY IF EXISTS "Block marketing_readonly insert broadcast_seats" ON broadcast_seats;
DROP POLICY IF EXISTS "Block marketing_readonly update broadcast_seats" ON broadcast_seats;

-- Broadcaster stats
DROP POLICY IF EXISTS "marketing_readonly can view broadcaster_stats" ON broadcaster_stats;

-- User wallets
DROP POLICY IF EXISTS "marketing_readonly can view user_wallets" ON user_wallets;
DROP POLICY IF EXISTS "Block marketing_readonly update user_wallets" ON user_wallets;

-- Loans
DROP POLICY IF EXISTS "marketing_readonly can view loans" ON loans;
DROP POLICY IF EXISTS "Block marketing_readonly insert loans" ON loans;

-- Loan payments
DROP POLICY IF EXISTS "marketing_readonly can view loan_payments" ON loan_payments;

-- Properties
DROP POLICY IF EXISTS "marketing_readonly can view properties" ON properties;
DROP POLICY IF EXISTS "Block marketing_readonly insert properties" ON properties;

-- Manual orders
DROP POLICY IF EXISTS "marketing_readonly can view manual_orders" ON manual_orders;

-- Coin transactions
DROP POLICY IF EXISTS "marketing_readonly can view coin_transactions" ON coin_transactions;

-- Now drop the broken helper function
DROP FUNCTION IF EXISTS public.is_marketing_readonly() CASCADE;

SELECT 'Fixed: Removed broken marketing_readonly RLS policies' AS status;
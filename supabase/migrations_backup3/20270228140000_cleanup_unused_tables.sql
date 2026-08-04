-- Cleanup unused tables that are no longer referenced by frontend
-- Run this migration to remove deprecated tables

-- Drop trolls_night_applications table (no longer used by frontend)
DROP TABLE IF EXISTS public.trolls_night_applications CASCADE;

-- Drop trolls_night_guest_agreements table (no longer used by frontend)
DROP TABLE IF EXISTS public.trolls_night_guest_agreements CASCADE;

-- Drop stripe_customers table (legacy Stripe integration, using Square instead)
DROP TABLE IF EXISTS public.stripe_customers CASCADE;

-- Drop wallet_transactions table (replaced by coin_transactions)
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;

-- Drop unused legacy tables if they exist
DROP TABLE IF EXISTS public.troll_events CASCADE;
DROP TABLE IF EXISTS public.troll_event_claims CASCADE;
DROP TABLE IF EXISTS public.taxi_requests CASCADE;
DROP TABLE IF EXISTS public.user_health_records CASCADE;
DROP TABLE IF EXISTS public.visitor_stats CASCADE;

-- Drop legacy troll_court_cases (replaced by court_cases)

-- Note: Some tables may not exist if they were already dropped or never created
-- The IF EXISTS clause ensures this migration runs without error

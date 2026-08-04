-- Drop legacy payout_requests -> user_profiles(user_id) constraint that blocks seeding
ALTER TABLE IF EXISTS public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_user_profiles_fkey;

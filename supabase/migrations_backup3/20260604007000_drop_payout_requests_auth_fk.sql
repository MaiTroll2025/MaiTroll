-- Relax payout_requests FK for local/dev
ALTER TABLE IF EXISTS public.payout_requests
  DROP CONSTRAINT IF EXISTS payout_requests_user_id_fkey;

ALTER TABLE IF EXISTS public.payout_requests
  ADD CONSTRAINT payout_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

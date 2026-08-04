-- Ensure payout_requests has payout_method expected by seed
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS payout_method text;

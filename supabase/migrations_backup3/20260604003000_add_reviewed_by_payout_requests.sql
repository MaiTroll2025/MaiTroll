-- Add reviewed_by column used by seed data
ALTER TABLE public.payout_requests
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;

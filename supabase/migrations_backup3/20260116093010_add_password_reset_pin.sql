-- Add password reset PIN columns to user_profiles
-- Requires: user_profiles table already exists

BEGIN;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS password_reset_pin_hash text,
  ADD COLUMN IF NOT EXISTS password_reset_pin_set_at timestamptz;

COMMIT;

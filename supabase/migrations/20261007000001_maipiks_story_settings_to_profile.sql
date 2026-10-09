BEGIN;

-- =============================================================================
-- MIGRATION: Move MAI Piks story settings from camera screen to user profile
-- Date: 2026-10-07
-- =============================================================================
-- Story-level settings (visibility, duration, monetization, pricing) used to be
-- configured inline on the camera screen before every capture. That meant a
-- creator had to re-select the same options every time they posted. This
-- migration moves those defaults onto user_profiles so they are configured
-- once, in the profile settings screen, and the camera screen simply uses
-- whatever the user has saved.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS maipiks_story_visibility TEXT NOT NULL DEFAULT 'everyone'
    CHECK (maipiks_story_visibility IN ('everyone', 'followers', 'private')),
  ADD COLUMN IF NOT EXISTS maipiks_story_duration_hours INTEGER NOT NULL DEFAULT 24
    CHECK (maipiks_story_duration_hours BETWEEN 1 AND 720),
  ADD COLUMN IF NOT EXISTS maipiks_story_monetization TEXT NOT NULL DEFAULT 'free'
    CHECK (maipiks_story_monetization IN ('free', 'paid', 'subscribers_only', 'free_for_subscribers')),
  ADD COLUMN IF NOT EXISTS maipiks_story_base_price_coins BIGINT NOT NULL DEFAULT 0
    CHECK (maipiks_story_base_price_coins >= 0 AND maipiks_story_base_price_coins <= 1000000),
  ADD COLUMN IF NOT EXISTS maipiks_story_subscriber_discount_mode TEXT NOT NULL DEFAULT 'platform'
    CHECK (maipiks_story_subscriber_discount_mode IN ('platform', 'none')),
  ADD COLUMN IF NOT EXISTS maipiks_story_paid_access_duration TEXT NOT NULL DEFAULT 'until_story_expiry'
    CHECK (maipiks_story_paid_access_duration IN ('until_story_expiry', '1h', '6h', '24h', '7d', 'permanent'));

COMMENT ON COLUMN public.user_profiles.maipiks_story_visibility IS
  'Default MAI Piks story visibility applied when the user captures from the camera.';
COMMENT ON COLUMN public.user_profiles.maipiks_story_duration_hours IS
  'Default MAI Piks story lifetime in hours (1-720).';
COMMENT ON COLUMN public.user_profiles.maipiks_story_monetization IS
  'Default MAI Piks story monetization mode.';
COMMENT ON COLUMN public.user_profiles.maipiks_story_base_price_coins IS
  'Default MAI Piks story base price in Troll Coins.';
COMMENT ON COLUMN public.user_profiles.maipiks_story_subscriber_discount_mode IS
  'Default subscriber discount mode for paid MAI Piks stories.';
COMMENT ON COLUMN public.user_profiles.maipiks_story_paid_access_duration IS
  'Default paid access duration for purchased MAI Piks stories.';

COMMIT;

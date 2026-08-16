-- =============================================================================
-- Migration: incoming_message_popup_settings
-- =============================================================================
-- Purpose:
--   Adds per-user setting for incoming message popup notifications.
-- =============================================================================

BEGIN;

ALTER TABLE public.user_profiles
    ADD COLUMN IF NOT EXISTS incoming_message_popups_enabled BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_incoming_message_popups
    ON public.user_profiles(incoming_message_popups_enabled)
    WHERE incoming_message_popups_enabled = true;

COMMIT;

-- ============================================================
-- 2025 Migration: User-Specific Badges + Troll Button Support
-- 1) Adds tracking columns to user_profiles for new badge checks
-- 2) Seeds new achievements into badge_catalog
-- ============================================================

-- ------------------------------------------------------------------
-- user_profiles: new tracking / flag columns
-- ------------------------------------------------------------------
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_completed_at     timestamptz,
  ADD COLUMN IF NOT EXISTS profile_fields_filled    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS first_broadcast_done_at  timestamptz,
  ADD COLUMN IF NOT EXISTS first_gift_sent_at       timestamptz,
  ADD COLUMN IF NOT EXISTS first_gift_received_at   timestamptz,
  ADD COLUMN IF NOT EXISTS first_follow_at          timestamptz,
  ADD COLUMN IF NOT EXISTS first_tcpcs_at           timestamptz,
  ADD COLUMN IF NOT EXISTS first_troll_at           timestamptz;

-- ------------------------------------------------------------------
-- badge_catalog: seed the new user-action badges
-- ------------------------------------------------------------------
INSERT INTO badge_catalog (slug, name, description, category, rarity, sort_order, icon_url, is_active)
VALUES
  -- Onboarding / profile
  ('profile_pioneer',  'Profile Pioneer',  'Complete your profile for the first time',         'onboarding', 'common',    101, '📝', true),
  -- Broadcast
  ('first_broadcast',  'First Broadcast',  'Go live for the very first time',                   'streaming',  'common',    131, '📡', true),
  -- Gifts
  ('first_gift_sent',  'First Gift Sent',  'Send your first gift to anyone in a broadcast',     'gifting',    'common',    201, '🎁', true),
  ('first_gift_received', 'First Gift Received', 'Receive your first gift from a viewer',      'gifting',    'common',    202, '🎉', true),
  -- Social
  ('first_follow',     'First Follow',     'Follow your first user',                            'social',     'common',    301, '👥', true),
  -- TCPC (Mai Troll Private Chat)
  ('first_tcpcs',      'First TCPC',       'Send your first message in Mai Troll Private Chat', 'community','common',    401, '💬', true),
  -- Troll action
  ('first_troll',      "Troll's Initiation","Use the Troll button for the first time",          'troll',      'uncommon', 501, '😈', true)
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  category    = EXCLUDED.category,
  rarity      = EXCLUDED.rarity,
  sort_order  = EXCLUDED.sort_order,
  icon_url    = EXCLUDED.icon_url,
  is_active   = EXCLUDED.is_active;

-- Disable daily broadcaster and viewer rewards.
-- This migration turns off daily coin giveaways through the daily reward system.

UPDATE admin_app_settings
SET setting_value = 'false'::jsonb
WHERE setting_key IN (
  'broadcaster_daily_reward_enabled',
  'viewer_daily_reward_enabled'
);

UPDATE admin_app_settings
SET setting_value = '0'::jsonb
WHERE setting_key IN (
  'broadcaster_daily_reward_amount',
  'viewer_daily_reward_amount'
);

NOTIFY pgrst, 'reload schema';

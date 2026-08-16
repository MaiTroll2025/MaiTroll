-- ============================================================================
-- LOWER GIFT XP RATES
-- Reduces gift XP from 1 XP per coin to 0.05 XP per coin
-- 100-coin gift = 5 XP
-- 1,000-coin gift = 50 XP
-- ============================================================================

BEGIN;

-- Update xp_rates in admin_app_settings
UPDATE public.admin_app_settings
SET setting_value = '{
    "gifter_base": 0.05,
    "gifter_live_bonus": 0.055,
    "broadcaster_base": 0.05,
    "store_purchase_per_dollar": 5.0,
    "coin_purchase_per_coin": 0.5
  }',
    updated_at = NOW()
WHERE setting_key = 'xp_rates';

-- If the setting doesn't exist yet, insert it
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
SELECT 'xp_rates',
  '{
    "gifter_base": 0.05,
    "gifter_live_bonus": 0.055,
    "broadcaster_base": 0.05,
    "store_purchase_per_dollar": 5.0,
    "coin_purchase_per_coin": 0.5
  }',
  'Central source of truth for all XP awarding rates.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_app_settings WHERE setting_key = 'xp_rates'
);

COMMIT;

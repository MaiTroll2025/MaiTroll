-- Migration: Add Payout Window Control Settings
-- Allows Secretary/Admin to enable payout windows with special tiers

-- Add payout window settings to admin_app_settings
INSERT INTO public.admin_app_settings (setting_key, setting_value, description)
VALUES (
  'payout_window_config', 
  '{"enabled": false, "min_coins": 5000, "special_tier_enabled": true, "special_tier_coins": 5000, "special_tier_usd": 1, "duration_minutes": 20, "notified_users": false}', 
  'Configuration for secretary-controlled payout windows with special tiers'
)
ON CONFLICT (setting_key) DO UPDATE
SET setting_value = EXCLUDED.setting_value,
    description = EXCLUDED.description;

-- Function to get current payout window status
CREATE OR REPLACE FUNCTION public.get_payout_window_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_config JSONB;
  v_result JSONB;
BEGIN
  SELECT setting_value INTO v_config
  FROM public.admin_app_settings
  WHERE setting_key = 'payout_window_config';

  IF v_config IS NULL THEN
    RETURN jsonb_build_object(
      'enabled', false,
      'min_coins', 5000,
      'special_tier_enabled', false,
      'special_tier_coins', 5000,
      'special_tier_usd', 1,
      'duration_minutes', 20,
      'message', 'Payouts are currently closed'
    );
  END IF;

  -- Check if window has expired
  IF v_config->>'enabled' = 'true' THEN
    DECLARE
      v_enabled_at TIMESTAMPTZ;
      v_duration_minutes INT;
      v_expires_at TIMESTAMPTZ;
    BEGIN
      v_enabled_at := (v_config->>'enabled_at')::TIMESTAMPTZ;
      v_duration_minutes := COALESCE((v_config->>'duration_minutes')::INT, 20);
      
      IF v_enabled_at IS NOT NULL THEN
        v_expires_at := v_enabled_at + (v_duration_minutes || ' minutes')::INTERVAL;
        
        IF now() > v_expires_at THEN
          -- Window has expired, disable it
          v_config := jsonb_set(v_config, '{enabled}', 'false');
          v_config := jsonb_set(v_config, '{message}', 'Payout window has expired');
          
          UPDATE public.admin_app_settings
          SET setting_value = v_config
          WHERE setting_key = 'payout_window_config';
          
          RETURN jsonb_build_object(
            'enabled', false,
            'min_coins', (v_config->>'min_coins')::INT,
            'special_tier_enabled', (v_config->>'special_tier_enabled')::BOOLEAN,
            'special_tier_coins', (v_config->>'special_tier_coins')::INT,
            'special_tier_usd', (v_config->>'special_tier_usd')::NUMERIC,
            'duration_minutes', v_duration_minutes,
            'message', 'Payout window has expired'
          );
        END IF;
        
        -- Window is still active
        RETURN jsonb_build_object(
          'enabled', true,
          'min_coins', (v_config->>'min_coins')::INT,
          'special_tier_enabled', (v_config->>'special_tier_enabled')::BOOLEAN,
          'special_tier_coins', (v_config->>'special_tier_coins')::INT,
          'special_tier_usd', (v_config->>'special_tier_usd')::NUMERIC,
          'duration_minutes', v_duration_minutes,
          'expires_at', v_expires_at,
          'message', 'Payout window OPEN! Special $1 tier available for 20 minutes'
        );
      END IF;
    END;
  END IF;

  RETURN jsonb_build_object(
    'enabled', (v_config->>'enabled')::BOOLEAN,
    'min_coins', COALESCE((v_config->>'min_coins')::INT, 5000),
    'special_tier_enabled', COALESCE((v_config->>'special_tier_enabled')::BOOLEAN, true),
    'special_tier_coins', COALESCE((v_config->>'special_tier_coins')::INT, 5000),
    'special_tier_usd', COALESCE((v_config->>'special_tier_usd')::NUMERIC, 1),
    'duration_minutes', COALESCE((v_config->>'duration_minutes')::INT, 20),
    'message', 'Payouts are currently closed'
  );
END;
$$;

-- Function to enable payout window (called by secretary)
CREATE OR REPLACE FUNCTION public.enable_payout_window(
  p_duration_minutes INT DEFAULT 20,
  p_min_coins INT DEFAULT 5000,
  p_special_tier_usd NUMERIC DEFAULT 1.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
  v_result JSONB;
BEGIN
  -- Get current config
  SELECT setting_value INTO v_config
  FROM public.admin_app_settings
  WHERE setting_key = 'payout_window_config'
  FOR UPDATE;

  IF v_config IS NULL THEN
    v_config := jsonb_build_object(
      'enabled', false,
      'min_coins', 5000,
      'special_tier_enabled', true,
      'special_tier_coins', 5000,
      'special_tier_usd', 1,
      'duration_minutes', 20,
      'notified_users', false
    );
  END IF;

  -- Update config with new window
  v_config := jsonb_set(v_config, '{enabled}', 'true');
  v_config := jsonb_set(v_config, '{enabled_at}', to_jsonb(now()));
  v_config := jsonb_set(v_config, '{duration_minutes}', to_jsonb(p_duration_minutes));
  v_config := jsonb_set(v_config, '{min_coins}', to_jsonb(p_min_coins));
  v_config := jsonb_set(v_config, '{special_tier_usd}', to_jsonb(p_special_tier_usd));
  v_config := jsonb_set(v_config, '{notified_users}', 'false');

  -- Save config
  UPDATE public.admin_app_settings
  SET setting_value = v_config,
      updated_at = now()
  WHERE setting_key = 'payout_window_config';

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'enabled', true,
    'duration_minutes', p_duration_minutes,
    'min_coins', p_min_coins,
    'special_tier_coins', 5000,
    'special_tier_usd', p_special_tier_usd,
    'message', 'Payout window enabled for ' || p_duration_minutes || ' minutes'
  );
END;
$$;

-- Function to disable payout window
CREATE OR REPLACE FUNCTION public.disable_payout_window()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT setting_value INTO v_config
  FROM public.admin_app_settings
  WHERE setting_key = 'payout_window_config'
  FOR UPDATE;

  IF v_config IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No payout window config found');
  END IF;

  v_config := jsonb_set(v_config, '{enabled}', 'false');
  v_config := jsonb_set(v_config, '{message}', 'Payout window closed by administrator');

  UPDATE public.admin_app_settings
  SET setting_value = v_config,
      updated_at = now()
  WHERE setting_key = 'payout_window_config';

  RETURN jsonb_build_object('success', true, 'message', 'Payout window disabled');
END;
$$;

-- Function to mark users as notified
CREATE OR REPLACE FUNCTION public.mark_payout_window_notified()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config JSONB;
BEGIN
  SELECT setting_value INTO v_config
  FROM public.admin_app_settings
  WHERE setting_key = 'payout_window_config'
  FOR UPDATE;

  IF v_config IS NOT NULL THEN
    v_config := jsonb_set(v_config, '{notified_users}', 'true');
    UPDATE public.admin_app_settings
    SET setting_value = v_config,
        updated_at = now()
    WHERE setting_key = 'payout_window_config';
  END IF;
END;
$$;

-- Grant execute permissions
GRANT ALL ON FUNCTION public.get_payout_window_status() TO authenticated;
GRANT ALL ON FUNCTION public.get_payout_window_status() TO anon;
GRANT ALL ON FUNCTION public.enable_payout_window(INT, INT, NUMERIC) TO authenticated;
GRANT ALL ON FUNCTION public.disable_payout_window() TO authenticated;
GRANT ALL ON FUNCTION public.mark_payout_window_notified() TO authenticated;
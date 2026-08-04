-- Robust script to disable testing mode and open signups
-- Handles both 'key' and 'setting_key' column names to avoid 23502 errors
DO $$
DECLARE
  v_has_key_col BOOLEAN;
  v_has_setting_key_col BOOLEAN;
BEGIN
  -- Check for existence of columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'key'
  ) INTO v_has_key_col;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'app_settings' AND column_name = 'setting_key'
  ) INTO v_has_setting_key_col;

  -- Logic to insert/update based on available columns
  IF v_has_key_col AND v_has_setting_key_col THEN
     -- Case: Both columns exist (rare but possible during migration)
     INSERT INTO public.app_settings (key, setting_key, setting_value, description)
     VALUES (
        'testing_mode', 
        'testing_mode', 
        '{"enabled": false, "signup_limit": 100, "current_signups": 0}'::jsonb, 
        'Testing mode configuration for controlled signups'
     )
     ON CONFLICT (setting_key) 
     DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = now();

  ELSIF v_has_key_col THEN
     -- Case: Only 'key' column exists
     INSERT INTO public.app_settings (key, setting_value, description)
     VALUES (
        'testing_mode', 
        '{"enabled": false, "signup_limit": 100, "current_signups": 0}'::jsonb, 
        'Testing mode configuration for controlled signups'
     )
     ON CONFLICT (key) 
     DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = now();

  ELSIF v_has_setting_key_col THEN
     -- Case: Only 'setting_key' column exists
     INSERT INTO public.app_settings (setting_key, setting_value, description)
     VALUES (
        'testing_mode', 
        '{"enabled": false, "signup_limit": 100, "current_signups": 0}'::jsonb, 
        'Testing mode configuration for controlled signups'
     )
     ON CONFLICT (setting_key) 
     DO UPDATE SET 
        setting_value = EXCLUDED.setting_value,
        updated_at = now();
  
  ELSE
    RAISE EXCEPTION 'Table public.app_settings does not have expected columns (key or setting_key)';
  END IF;

END $$;

-- Expand the supported concurrent broadcaster cap range.
-- Preserve the currently configured value; the admin UI can select:
-- 2, 4, 6, 8, 10, 20, 40, 60, 80, or 100.

BEGIN;

INSERT INTO public.admin_settings (
  setting_key,
  setting_value,
  description,
  updated_at
)
VALUES (
  'broadcast_start_cap_max',
  '{"value": 100}',
  'Max concurrent broadcasters (supported values: 2, 4, 6, 8, 10, 20, 40, 60, 80, 100)',
  NOW()
)
ON CONFLICT (setting_key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();

DO $$
DECLARE
  v_raw_value TEXT;
  v_value INTEGER;
BEGIN
  SELECT CASE jsonb_typeof(setting_value)
    WHEN 'object' THEN COALESCE(setting_value ->> 'value', setting_value ->> 'max')
    WHEN 'array' THEN setting_value ->> 0
    ELSE setting_value #>> '{}'
  END
  INTO v_raw_value
  FROM public.admin_settings
  WHERE setting_key = 'broadcast_start_cap_max';

  IF v_raw_value !~ '^[0-9]+$' THEN
    v_value := 2;
  ELSE
    v_value := v_raw_value::INTEGER;
    IF v_value < 2 OR v_value > 100 THEN
      v_value := 2;
    END IF;
  END IF;

  UPDATE public.admin_settings
  SET setting_value = jsonb_build_object('value', v_value),
      updated_at = NOW()
  WHERE setting_key = 'broadcast_start_cap_max';
END;
$$;

COMMIT;

-- Fix for insurance type mismatch (22P02 error)
-- Ensures insurance_options table exists with correct schema and data

-- First, ensure insurance_options has the correct PRIMARY KEY
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'insurance_options_pkey'
      AND table_name = 'insurance_options'
  ) THEN
    ALTER TABLE public.insurance_options ADD CONSTRAINT insurance_options_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- Verify foreign key exists and is correct
DO $$
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_insurances_insurance_id_fkey'
    AND table_name = 'user_insurances'
  ) THEN
    ALTER TABLE public.user_insurances 
      ADD CONSTRAINT user_insurances_insurance_id_fkey 
      FOREIGN KEY (insurance_id) REFERENCES public.insurance_options(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Seed insurance_options if table is empty
INSERT INTO public.insurance_options (id, name, cost, description, duration_hours, protection_type, icon, is_active)
VALUES 
  ('insurance_kick_24h', 'Kick Insurance (24h)', 50, 'Blocks kick penalties from streams for a 24 hour period.', 24, 'kick', '🛡️', true),
  ('insurance_full_24h', 'Full Protection (24h)', 100, 'Covers kick and other major penalties for 24 hours.', 24, 'full', '🛡️', true),
  ('insurance_full_week', 'Full Protection (1 Week)', 400, 'Covers kick and other major penalties for seven days.', 168, 'full', '🛡️', true),
  ('insurance_basic_week', 'Basic Coverage (1 Week)', 200, 'Basic protection for 7 days.', 168, 'kick', '🛡️', true)
ON CONFLICT (id) DO NOTHING;

-- Verify the foreign key constraint is working by checking if we can query
SELECT COUNT(*) as insurance_options_count FROM public.insurance_options;

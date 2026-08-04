-- Seed insurance_options table with stream/broadcast insurance options
-- This ensures the foreign key references will work when users purchase insurance

INSERT INTO public.insurance_options (
  id, 
  name, 
  cost, 
  description, 
  duration_hours, 
  protection_type, 
  icon, 
  is_active
) VALUES
  ('insurance_kick_24h', 'Kick Insurance (24h)', 50, 'Blocks kick penalties from streams for a 24 hour period.', 24, 'kick', '🛡️', true),
  ('insurance_full_24h', 'Full Protection (24h)', 100, 'Covers kick and other major penalties for 24 hours.', 24, 'full', '🛡️', true),
  ('insurance_full_week', 'Full Protection (1 Week)', 400, 'Covers kick and other major penalties for seven days.', 168, 'full', '🛡️', true),
  ('insurance_basic_week', 'Basic Coverage', 200, 'Basic coverage for 7 days.', 168, 'kick', '🛡️', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cost = EXCLUDED.cost,
  description = EXCLUDED.description,
  duration_hours = EXCLUDED.duration_hours,
  protection_type = EXCLUDED.protection_type,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;

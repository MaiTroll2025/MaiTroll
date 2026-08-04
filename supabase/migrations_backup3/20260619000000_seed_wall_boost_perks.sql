-- ============================================================================
-- WALL BOOST PERKS - DATABASE MIGRATION
-- Adds 2 new perks for wall boosting to the perks catalog table
-- ============================================================================

-- Add the wall_boost perk_type to the check constraint if it doesn't exist
ALTER TABLE public.perks 
  DROP CONSTRAINT IF EXISTS perks_perk_type_check;

ALTER TABLE public.perks 
  ADD CONSTRAINT perks_perk_type_check 
  CHECK (perk_type IN ('visibility', 'chat', 'protection', 'boost', 'cosmetic', 'wall_boost'));

-- Insert wall boost perks into the perks catalog table
INSERT INTO public.perks (id, name, cost, description, duration_minutes, icon, perk_type, is_active)
VALUES
  ('wall_boost_24h', 'Wall Boost 24 Hours', 100, 'Boost a Troll Wall post for 24 hours.', 1440, '⚡', 'wall_boost', true),
  ('wall_boost_7d', 'Wall Boost 7 Days', 500, 'Boost a Troll Wall post for 7 days.', 10080, '⚡', 'wall_boost', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  cost = EXCLUDED.cost,
  description = EXCLUDED.description,
  duration_minutes = EXCLUDED.duration_minutes,
  icon = EXCLUDED.icon,
  perk_type = EXCLUDED.perk_type,
  is_active = EXCLUDED.is_active;

-- Verification
SELECT 'Wall Boost Perks' as table_name, COUNT(*) as count FROM public.perks WHERE perk_type = 'wall_boost';
-- Ensure districts table exists
CREATE TABLE IF NOT EXISTS public.districts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    color TEXT,
    required_role TEXT DEFAULT 'user',
    features JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Government Sector to districts
INSERT INTO districts (name, display_name, description, icon, color, required_role, features)
VALUES (
  'government_sector',
  'Government Sector',
  'The seat of power. President, Secretary, and civic duties.',
  'Crown',
  'amber',
  'user',
  '{"enabled": true}'::jsonb
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  features = EXCLUDED.features;

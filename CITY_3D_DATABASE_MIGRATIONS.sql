-- Mai Troll 3D System - Database Migration
-- Run these queries in your Supabase SQL editor to prepare the database

-- ============================================================================
-- 1. Ensure user_perks table has metadata column (if not already)
-- ============================================================================

ALTER TABLE user_perks 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- 2. Create indexes for faster 3D asset queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_perks_car_query 
  ON user_perks(user_id) 
  WHERE perk_id ILIKE '%car%' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_perks_house_query 
  ON user_perks(user_id) 
  WHERE perk_id ILIKE '%house%' AND is_active = true;

CREATE INDEX IF NOT EXISTS idx_user_perks_active 
  ON user_perks(user_id, is_active);

-- ============================================================================
-- 3. Example: Insert sample car perks
-- ============================================================================

-- Modern Sports Car (Red)
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(), -- Replace with actual user ID when testing
  'car_sports_red',
  true,
  NULL,
  jsonb_build_object(
    'car_model', 'Sports Car',
    'color', '#ff0000',
    'purchased_at', now()::text,
    'description', 'Fast sports car with sleek design'
  )
)
ON CONFLICT DO NOTHING;

-- Classic Sedan (Blue)
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(),
  'car_sedan_blue',
  true,
  NULL,
  jsonb_build_object(
    'car_model', 'Classic Sedan',
    'color', '#0000ff',
    'purchased_at', now()::text,
    'description', 'Elegant sedan for city cruising'
  )
)
ON CONFLICT DO NOTHING;

-- Luxury SUV (Gold)
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(),
  'car_suv_gold',
  true,
  NULL,
  jsonb_build_object(
    'car_model', 'Luxury SUV',
    'color', '#ffd700',
    'purchased_at', now()::text,
    'description', 'Premium SUV with advanced features'
  )
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. Example: Insert sample house perks
-- ============================================================================

-- Modern House
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(),
  'house_modern_downtown',
  true,
  NULL,
  jsonb_build_object(
    'house_name', 'Downtown Modern Home',
    'style', 'modern',
    'purchased_at', now()::text,
    'description', 'Sleek modern architecture in the city center'
  )
)
ON CONFLICT DO NOTHING;

-- Classic House
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(),
  'house_classic_suburban',
  true,
  NULL,
  jsonb_build_object(
    'house_name', 'Suburban Classic Estate',
    'style', 'classic',
    'purchased_at', now()::text,
    'description', 'Traditional family home with charm'
  )
)
ON CONFLICT DO NOTHING;

-- Luxury House
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(),
  'house_luxury_hillside',
  true,
  NULL,
  jsonb_build_object(
    'house_name', 'Hillside Luxury Villa',
    'style', 'luxury',
    'purchased_at', now()::text,
    'description', 'Premium hillside property with panoramic views'
  )
)
ON CONFLICT DO NOTHING;

-- Villa House
INSERT INTO user_perks (user_id, perk_id, is_active, expires_at, metadata)
VALUES (
  auth.uid(),
  'house_villa_beachfront',
  true,
  NULL,
  jsonb_build_object(
    'house_name', 'Beachfront Villa',
    'style', 'villa',
    'purchased_at', now()::text,
    'description', 'Mediterranean-style villa with ocean views'
  )
)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. Verify the data was inserted
-- ============================================================================

-- View all 3D assets owned by the current user
SELECT 
  perk_id,
  metadata->>'car_model' as car_name,
  metadata->>'house_name' as house_name,
  metadata->>'color' as color,
  metadata->>'style' as style,
  is_active,
  created_at
FROM user_perks
WHERE (perk_id ILIKE '%car%' OR perk_id ILIKE '%house%')
  AND user_id = auth.uid()
ORDER BY created_at DESC;

-- ============================================================================
-- 6. Helper function to get user's 3D assets (optional)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_3d_assets(p_user_id UUID)
RETURNS TABLE (
  asset_id TEXT,
  asset_type TEXT,
  asset_name TEXT,
  color TEXT,
  style TEXT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    perk_id as asset_id,
    CASE 
      WHEN perk_id ILIKE '%car%' THEN 'car'
      WHEN perk_id ILIKE '%house%' THEN 'house'
      ELSE 'other'
    END as asset_type,
    COALESCE(
      metadata->>'car_model',
      metadata->>'house_name',
      'Unknown Asset'
    ) as asset_name,
    metadata->>'color' as color,
    metadata->>'style' as style,
    metadata
  FROM user_perks
  WHERE user_id = p_user_id
    AND is_active = true
    AND (perk_id ILIKE '%car%' OR perk_id ILIKE '%house%')
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 7. Test the helper function
-- ============================================================================

SELECT * FROM get_user_3d_assets(auth.uid());

-- ============================================================================
-- 8. Optional: Create a view for easy querying
-- ============================================================================

CREATE OR REPLACE VIEW user_3d_inventory AS
SELECT 
  up.user_id,
  up.perk_id,
  CASE 
    WHEN up.perk_id ILIKE '%car%' THEN 'car'
    WHEN up.perk_id ILIKE '%house%' THEN 'house'
    ELSE 'other'
  END as asset_type,
  up.metadata,
  up.is_active,
  up.created_at,
  up.expires_at
FROM user_perks up
WHERE up.perk_id ILIKE '%car%' OR up.perk_id ILIKE '%house%';

-- Usage: SELECT * FROM user_3d_inventory WHERE user_id = 'your-user-id';

-- ============================================================================
-- 9. RLS Policy for 3D assets (if not already set)
-- ============================================================================

-- Enable RLS on user_perks if not already enabled
ALTER TABLE user_perks ENABLE ROW LEVEL SECURITY;

-- Create policy for users to see only their own assets
CREATE POLICY "Users can view their own perks"
  ON user_perks
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy for users to insert their own perks
CREATE POLICY "Users can insert their own perks"
  ON user_perks
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own perks
CREATE POLICY "Users can update their own perks"
  ON user_perks
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- 10. Cleanup script (if needed - CAUTION: destructive)
-- ============================================================================

-- To remove 3D-related perks:
-- DELETE FROM user_perks 
-- WHERE user_id = auth.uid() 
--   AND (perk_id ILIKE '%car%' OR perk_id ILIKE '%house%');

-- To drop the view:
-- DROP VIEW IF EXISTS user_3d_inventory;

-- To drop the helper function:
-- DROP FUNCTION IF EXISTS get_user_3d_assets(UUID);

-- ============================================================================
-- 11. Metadata schema documentation
-- ============================================================================

/*
CAR PERK METADATA SCHEMA:
{
  "car_model": "Sports Car",           -- Display name
  "color": "#ff0000",                  -- Hex color code
  "purchased_at": "2026-01-16T...",    -- ISO timestamp
  "description": "Fast sports car...",  -- Optional description
  "top_speed": 120,                    -- Optional performance stat
  "acceleration": 95,                  -- Optional performance stat
  "handling": 85                       -- Optional performance stat
}

HOUSE PERK METADATA SCHEMA:
{
  "house_name": "Downtown Modern Home", -- Display name
  "style": "modern",                    -- 'modern'|'classic'|'luxury'|'villa'
  "purchased_at": "2026-01-16T...",    -- ISO timestamp
  "description": "Sleek modern...",     -- Optional description
  "bedrooms": 4,                        -- Optional property details
  "bathrooms": 2,                       -- Optional property details
  "square_feet": 3500                  -- Optional property details
}
*/

-- ============================================================================
-- 12. Performance tuning query
-- ============================================================================

-- Check if indexes are being used efficiently
EXPLAIN ANALYZE
SELECT * FROM user_perks
WHERE user_id = auth.uid()
  AND perk_id ILIKE '%car%'
  AND is_active = true;

-- Should show "Index Scan" if indexes are being used properly

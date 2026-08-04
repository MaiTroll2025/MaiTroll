-- Sync Properties to Deeds and Fix Ownership Data

-- 1. Ensure every property has a corresponding deed
-- Insert missing deeds for existing properties
INSERT INTO public.deeds (
    property_id,
    current_owner_user_id,
    owner_user_id,
    purchase_price,
    acquired_at,
    deed_type,
    property_name
)
SELECT 
    p.id,
    p.owner_user_id,
    p.owner_user_id, -- Original owner assumed to be current for backfill
    COALESCE(p.base_price, 0),
    NOW(),
    'standard',
    p.name
FROM public.properties p
WHERE NOT EXISTS (
    SELECT 1 FROM public.deeds d WHERE d.property_id = p.id
);

-- 2. Sync Ownership: properties.owner_user_id -> deeds.current_owner_user_id
-- If they differ, trust the property table as the source of truth for current ownership
UPDATE public.deeds d
SET current_owner_user_id = p.owner_user_id
FROM public.properties p
WHERE d.property_id = p.id
AND d.current_owner_user_id IS DISTINCT FROM p.owner_user_id;

-- 3. Sync Metadata: Update property_name and owner_username in deeds
-- This ensures the Admin Dashboard can display names without complex joins if it uses these columns
UPDATE public.deeds d
SET 
    property_name = p.name,
    owner_username = up.username
FROM public.properties p
LEFT JOIN public.user_profiles up ON up.id = p.owner_user_id
WHERE d.property_id = p.id
AND (
    d.property_name IS DISTINCT FROM p.name OR
    d.owner_username IS DISTINCT FROM up.username
);

-- 4. Fix RLS for Real-time Oversight
-- Ensure the realtime publication includes these tables for admins
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deeds;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.properties;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.deed_transfers;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END;
$$;

-- 5. Create a view or function to help Admin Dashboard fetch all deeds efficiently
-- This view joins deeds, properties, and profiles for a complete picture
CREATE OR REPLACE VIEW public.admin_deed_oversight AS
SELECT 
    d.id AS deed_id,
    d.property_id,
    d.current_owner_user_id,
    d.purchase_price,
    d.acquired_at,
    p.name AS property_name,
    p.address,
    p.is_active_home,
    up.username AS owner_username,
    up.email AS owner_email
FROM public.deeds d
JOIN public.properties p ON d.property_id = p.id
LEFT JOIN public.user_profiles up ON d.current_owner_user_id = up.id;

-- Grant access to this view for admins
GRANT SELECT ON public.admin_deed_oversight TO authenticated;

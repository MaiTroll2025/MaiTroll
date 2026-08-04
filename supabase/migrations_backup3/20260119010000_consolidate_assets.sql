-- Migration to consolidate asset persistence
-- 1. Ensure user_cars is set up (from previous step, but reinforcing if needed)
-- We assume user_cars is already created by 20260118230000_user_cars_properties.sql
-- If not, the previous migration should be run. 
-- Here we focus on integrating properties correctly with the existing 'properties' table.

-- 2. Modify existing 'properties' table to support driving scene
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS is_active_home BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS model_url TEXT;

-- 3. Partial Unique Index for properties
-- Ensure only one active home per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_active_home_unique 
    ON public.properties(owner_user_id) 
    WHERE is_active_home = true;

-- 4. Update set_active_property RPC to use public.properties
CREATE OR REPLACE FUNCTION public.set_active_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = p_property_id AND owner_user_id = v_user_id) THEN
        RAISE EXCEPTION 'Property not owned by user';
    END IF;

    -- Update all properties to inactive for this user
    UPDATE public.properties 
    SET is_active_home = false 
    WHERE owner_user_id = v_user_id;

    -- Set the specific property to active
    UPDATE public.properties 
    SET is_active_home = true 
    WHERE id = p_property_id;

    RETURN true;
END;
$$;

-- 5. Helper to sync legacy user_garage to user_cars (optional one-time migration helper)
-- This function can be called to migrate data if needed
CREATE OR REPLACE FUNCTION public.migrate_garage_to_user_cars()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    -- Insert distinct cars from user_garage into user_cars if not exists
    INSERT INTO public.user_cars (user_id, car_id, purchased_at, is_active)
    SELECT 
        ug.user_id, 
        ug.car_model_id::text, 
        ug.acquired_at, 
        ug.is_active
    FROM public.user_garage ug
    WHERE NOT EXISTS (
        SELECT 1 FROM public.user_cars uc 
        WHERE uc.user_id = ug.user_id AND uc.car_id = ug.car_model_id::text
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

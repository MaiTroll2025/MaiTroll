-- Migration for User Cars and Properties with personalized assets
-- Created based on user request for Babylon.js driving scene persistence

-- 0. Ensure user_cars is a real table (not a legacy view)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'user_cars'
      AND c.relkind = 'v'
  ) THEN
    DROP VIEW public.user_cars;
  END IF;
END $$;

-- 1. Create user_cars table
CREATE TABLE IF NOT EXISTS public.user_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    car_id TEXT NOT NULL, -- ID from the game config/catalog
    model_url TEXT NOT NULL, -- URL to the GLB/GLTF model
    purchased_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT false,
    customization_json JSONB DEFAULT '{}'::jsonb,
    
    CONSTRAINT user_cars_user_car_unique UNIQUE (user_id, car_id)
);

-- 2. Update properties table (existing table)
-- Add is_active_home column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'is_active_home') THEN
        ALTER TABLE public.properties ADD COLUMN is_active_home BOOLEAN DEFAULT false;
    END IF;
    
    -- Add model_url if it doesn't exist (useful for custom homes)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'properties' AND column_name = 'model_url') THEN
        ALTER TABLE public.properties ADD COLUMN model_url TEXT;
    END IF;
END $$;

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_cars_user_id ON public.user_cars(user_id);
-- properties already has indexes, but ensure owner_user_id is indexed
CREATE INDEX IF NOT EXISTS idx_properties_owner_user_id ON public.properties(owner_user_id);

-- 4. Partial Unique Indexes to enforce "One Active Item Per User"
-- This ensures the DB rejects any attempt to have 2 active cars for the same user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_cars_active_unique 
    ON public.user_cars(user_id) 
    WHERE is_active = true;

-- For properties, we enforce one active home per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_properties_active_home_unique 
    ON public.properties(owner_user_id) 
    WHERE is_active_home = true;

-- 5. Enable RLS
ALTER TABLE public.user_cars ENABLE ROW LEVEL SECURITY;
-- properties table already has RLS enabled usually, but safe to re-run

-- 6. RLS Policies

-- User Cars Policies
DROP POLICY IF EXISTS "Users can view own cars" ON public.user_cars;
CREATE POLICY "Users can view own cars" 
    ON public.user_cars FOR SELECT 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own cars" ON public.user_cars;
CREATE POLICY "Users can insert own cars" 
    ON public.user_cars FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own cars" ON public.user_cars;
CREATE POLICY "Users can update own cars" 
    ON public.user_cars FOR UPDATE 
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own cars" ON public.user_cars;
CREATE POLICY "Users can delete own cars" 
    ON public.user_cars FOR DELETE 
    USING (auth.uid() = user_id);

-- 7. Backend Functions (RPCs) for Atomic Operations

-- Function to set active car transactionally
CREATE OR REPLACE FUNCTION public.set_active_car(p_car_row_id UUID)
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
    IF NOT EXISTS (SELECT 1 FROM public.user_cars WHERE id = p_car_row_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Car not owned by user';
    END IF;

    -- Update all cars to inactive for this user
    UPDATE public.user_cars 
    SET is_active = false 
    WHERE user_id = v_user_id;

    -- Set the specific car to active
    UPDATE public.user_cars 
    SET is_active = true 
    WHERE id = p_car_row_id;

    RETURN true;
END;
$$;

-- Function to set active property transactionally
-- Updated to use 'properties' table and 'p_property_id' to match frontend usage
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

-- Function to purchase car (atomic insert)
CREATE OR REPLACE FUNCTION public.purchase_car_v2(
    p_car_id TEXT,
    p_model_url TEXT,
    p_customization JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_new_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Insert the new car
    -- Note: This does not handle payment logic (coin deduction), assume that is handled by caller or another wrapper
    INSERT INTO public.user_cars (user_id, car_id, model_url, customization_json, is_active)
    VALUES (v_user_id, p_car_id, p_model_url, p_customization, false)
    RETURNING id INTO v_new_id;

    -- If this is the user's first car, make it active automatically
    IF NOT EXISTS (SELECT 1 FROM public.user_cars WHERE user_id = v_user_id AND is_active = true) THEN
        PERFORM public.set_active_car(v_new_id);
    END IF;

    RETURN v_new_id;
END;
$$;

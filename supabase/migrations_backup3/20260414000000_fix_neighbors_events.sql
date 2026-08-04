-- Add images column to neighbors_events table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'neighbors_events' AND column_name = 'images'
    ) THEN
        ALTER TABLE neighbors_events ADD COLUMN images TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Also add approval_status column if not exists (needed for the function to work)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'neighbors_events' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE neighbors_events ADD COLUMN approval_status TEXT DEFAULT 'pending';
    END IF;
END $$;

-- Fix the get_nearby_neighbors_events function to handle both old and new table structures
CREATE OR REPLACE FUNCTION get_nearby_neighbors_events(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius DOUBLE PRECISION)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  state TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  max_participants INTEGER,
  reward_coins INTEGER,
  created_by_user_id UUID,
  business_id UUID,
  status TEXT,
  created_at TIMESTAMPTZ,
  approval_status TEXT,
  images TEXT[],
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ne.id,
    ne.title,
    ne.description,
    ne.category,
    ne.latitude,
    ne.longitude,
    ne.city,
    ne.state,
    ne.start_time,
    ne.end_time,
    ne.duration_minutes,
    ne.max_participants,
    ne.reward_coins,
    ne.created_by_user_id,
    ne.business_id,
    ne.status,
    ne.created_at,
    COALESCE(ne.approval_status, 'pending')::TEXT AS approval_status,
    COALESCE(ne.images, '{}')::TEXT[] AS image
    COALESCE(ne.approval_status, 'pending')::TEXT AS approval_status,
    COALESCE(ne.images, '{}')::TEXT[] AS images,
    ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 AS distance
  FROM neighbors_events ne
  WHERE
    ne.status = 'active'
    AND COALESCE(ne.approval_status, 'pending') IN ('approved', 'pending')
    AND ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 <= radius;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ensure jail foreign key exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'jail_user_id_fkey'
        AND table_name = 'jail'
    ) THEN
        ALTER TABLE public.jail
        ADD CONSTRAINT jail_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id)
        ON DELETE CASCADE;
    END IF;
END $$;
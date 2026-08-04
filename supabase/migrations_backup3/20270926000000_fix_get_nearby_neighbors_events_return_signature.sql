-- Fix get_nearby_neighbors_events return signature to match neighbors_events current schema
DROP FUNCTION IF EXISTS get_nearby_neighbors_events(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);

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
    COALESCE(ne.images, '{}')::TEXT[] AS images,
    ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 AS distance
  FROM neighbors_events ne
  WHERE
    ne.status = 'active'
    AND ne.approval_status = 'approved'
    AND ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 <= radius;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_nearby_neighbors_events(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_neighbors_events(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon;

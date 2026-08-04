-- Create neighbors events table
CREATE TABLE IF NOT EXISTS neighbors_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  max_participants INTEGER,
  reward_coins INTEGER DEFAULT 0,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  business_id UUID REFERENCES neighbors_businesses(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create neighbors participants table
CREATE TABLE IF NOT EXISTS neighbors_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES neighbors_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'joined',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  verified BOOLEAN DEFAULT FALSE,
  UNIQUE(event_id, user_id)
);

-- Create neighbors businesses table
CREATE TABLE IF NOT EXISTS neighbors_businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id),
  business_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  logo_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for neighbors_events
ALTER TABLE neighbors_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active events"
ON neighbors_events
FOR SELECT
USING (status = 'active');

CREATE POLICY "Authenticated users can create events"
ON neighbors_events
FOR INSERT
WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Creator can update/delete own events"
ON neighbors_events
FOR UPDATE USING (auth.uid() = created_by_user_id);

CREATE POLICY "Creator can delete own events"
ON neighbors_events
FOR DELETE USING (auth.uid() = created_by_user_id);

-- RLS Policies for neighbors_participants
ALTER TABLE neighbors_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can join events"
ON neighbors_participants
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read their participation"
ON neighbors_participants
FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policies for neighbors_businesses
ALTER TABLE neighbors_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their businesses"
ON neighbors_businesses
FOR ALL
USING (auth.uid() = owner_user_id);

CREATE POLICY "Public can read verified businesses"
ON neighbors_businesses
FOR SELECT
USING (verified = TRUE);

-- Create RPC function to get nearby events
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
  distance DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ne.*,
    ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 AS distance
  FROM neighbors_events ne
  WHERE
    ne.status = 'active'
    AND ST_Distance(
      ST_GeographyFromText('POINT(' || lng || ' ' || lat || ')'),
      ST_GeographyFromText('POINT(' || ne.longitude || ' ' || ne.latitude || ')')
    ) / 1000 <= radius;
END;
$$ LANGUAGE plpgsql STABLE;

-- Create function to verify event completion and reward coins
CREATE OR REPLACE FUNCTION verify_event_participation(participant_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_participant neighbors_participants;
  v_event neighbors_events;
BEGIN
  -- Get participant and event details
  SELECT * INTO v_participant FROM neighbors_participants WHERE id = participant_id;
  SELECT * INTO v_event FROM neighbors_events WHERE id = v_participant.event_id;

  -- Check if participant has completed the event
  IF v_participant.status != 'completed' THEN
    RETURN FALSE;
  END IF;

  -- Check if participant is already verified
  IF v_participant.verified THEN
    RETURN FALSE;
  END IF;

  -- Update participant status to verified
  UPDATE neighbors_participants
  SET verified = TRUE
  WHERE id = participant_id;

  -- Add reward coins to user balance
  UPDATE user_profiles
  SET coins = coins + v_event.reward_coins
  WHERE user_id = v_participant.user_id;

  -- Log transaction (assuming there's a transactions table)
  INSERT INTO wallet_transactions (
    user_id,
    type,
    amount,
    description,
    source
  ) VALUES (
    v_participant.user_id,
    'credit',
    v_event.reward_coins,
    'Event participation reward: ' || v_event.title,
    'events'
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql VOLATILE;

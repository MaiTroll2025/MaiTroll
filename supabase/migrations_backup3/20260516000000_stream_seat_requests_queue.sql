-- Create stream_seat_requests table for queue-based seat system
CREATE TABLE IF NOT EXISTS stream_seat_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  broadcaster_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  seat_index INTEGER NOT NULL,
  
  -- Request status: pending, approved, denied, cancelled, expired, joined, refunded
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'cancelled', 'expired', 'joined', 'refunded')),
  
  -- Session reference (set after approval)
  session_id UUID REFERENCES stream_seat_sessions(id) ON DELETE SET NULL,
  
  -- Payment tracking
  seat_price INTEGER NOT NULL DEFAULT 0,
  paid_amount INTEGER NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  denied_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  joined_at TIMESTAMPTZ,
  
  -- Deny/refund reason
  deny_reason TEXT
);

-- Indexes for efficient querying
CREATE INDEX idx_stream_seat_requests_stream_id ON stream_seat_requests(stream_id);
CREATE INDEX idx_stream_seat_requests_user_id ON stream_seat_requests(user_id);
CREATE INDEX idx_stream_seat_requests_broadcaster_id ON stream_seat_requests(broadcaster_id);
CREATE INDEX idx_stream_seat_requests_status ON stream_seat_requests(stream_id, status);
CREATE INDEX idx_stream_seat_requests_pending ON stream_seat_requests(stream_id, status) WHERE status = 'pending';
CREATE INDEX idx_stream_seat_requests_approved ON stream_seat_requests(stream_id, status) WHERE status = 'approved';

-- Ensure only one active request per user per stream per seat
CREATE UNIQUE INDEX idx_unique_active_request_per_seat 
  ON stream_seat_requests(stream_id, user_id, seat_index) 
  WHERE status IN ('pending', 'approved');

-- Ensure only one active request per user per stream overall (prevent multiple seat requests)
CREATE UNIQUE INDEX idx_unique_active_request_per_stream 
  ON stream_seat_requests(stream_id, user_id) 
  WHERE status IN ('pending', 'approved', 'joined');

-- RLS Policies
ALTER TABLE stream_seat_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "stream_seat_requests_user_read" ON stream_seat_requests
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() = broadcaster_id OR
    is_admin_or_officer(auth.uid())
  );

-- Users can create their own requests (via RPC, but allow for safety)
CREATE POLICY "stream_seat_requests_user_create" ON stream_seat_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
  );

-- Only broadcaster can update their own stream's requests
CREATE POLICY "stream_seat_requests_broadcaster_update" ON stream_seat_requests
  FOR UPDATE USING (
    auth.uid() = broadcaster_id
  );

-- System (via RPC) can update for refunds
CREATE POLICY "stream_seat_requests_system_update" ON stream_seat_requests
  FOR UPDATE USING (true)
  WITH CHECK (true);

-- Admins/officers can manage
CREATE POLICY "stream_seat_requests_admin_all" ON stream_seat_requests
  FOR ALL USING (is_admin_or_officer(auth.uid()));

----
-- RPC FUNCTIONS
----

-- RPC 1: Request a seat (viewer clicks seat)
-- Does: check balance, deduct viewer coins, add to broadcaster, create pending request
CREATE OR REPLACE FUNCTION request_stream_seat(
  p_stream_id UUID,
  p_user_id UUID,
  p_seat_index INTEGER,
  p_seat_price INTEGER DEFAULT 0
)
RETURNS TABLE (
  success BOOLEAN,
  request_id UUID,
  error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_broadcaster_id UUID;
  v_user_balance INTEGER;
  v_seat_price INTEGER;
  v_request_id UUID;
  v_existing_request UUID;
  v_is_broadcaster BOOLEAN;
  v_already_in_seat BOOLEAN;
BEGIN
  -- Get stream broadcaster
  SELECT broadcaster_id INTO v_broadcaster_id FROM streams WHERE id = p_stream_id;
  IF v_broadcaster_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Stream not found'::TEXT;
    RETURN;
  END IF;

  -- Check viewer is not the broadcaster
  IF p_user_id = v_broadcaster_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Broadcaster cannot request their own seat'::TEXT;
    RETURN;
  END IF;

  -- Check viewer is not already in a seat
  SELECT id INTO v_already_in_seat FROM stream_seat_sessions 
    WHERE stream_id = p_stream_id AND user_id = p_user_id AND status = 'active';
  IF v_already_in_seat IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'User already in a seat'::TEXT;
    RETURN;
  END IF;

  -- Check no existing pending/approved request from this user for this stream
  SELECT id INTO v_existing_request FROM stream_seat_requests 
    WHERE stream_id = p_stream_id AND user_id = p_user_id 
    AND status IN ('pending', 'approved');
  IF v_existing_request IS NOT NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'User already has pending or approved request'::TEXT;
    RETURN;
  END IF;

  -- Get seat price (use provided or stream default)
  v_seat_price := COALESCE(p_seat_price, (
    SELECT COALESCE((seat_prices[p_seat_index + 1])::INTEGER, 0) FROM streams WHERE id = p_stream_id
  ));

  -- If seat price > 0, check and deduct viewer balance
  IF v_seat_price > 0 THEN
    SELECT COALESCE(paid_coin_balance, 0) INTO v_user_balance FROM user_profiles WHERE id = p_user_id;
    
    IF v_user_balance < v_seat_price THEN
      RETURN QUERY SELECT FALSE, NULL::UUID, 'Insufficient coin balance'::TEXT;
      RETURN;
    END IF;

    -- Deduct from viewer
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance - v_seat_price
    WHERE id = p_user_id;

    -- Add to broadcaster
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance + v_seat_price
    WHERE id = v_broadcaster_id;
  END IF;

  -- Create pending request
  INSERT INTO stream_seat_requests (
    stream_id, broadcaster_id, user_id, seat_index, 
    status, seat_price, paid_amount, payment_status, 
    expires_at
  ) VALUES (
    p_stream_id, v_broadcaster_id, p_user_id, p_seat_index,
    'pending', v_seat_price, v_seat_price, CASE WHEN v_seat_price > 0 THEN 'paid' ELSE 'unpaid' END,
    NOW() + INTERVAL '2 minutes'
  ) RETURNING id INTO v_request_id;

  RETURN QUERY SELECT TRUE, v_request_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION request_stream_seat(UUID, UUID, INTEGER, INTEGER) TO authenticated;

----

-- RPC 2: Broadcaster approves seat request
-- Does: mark request approved, reserve seat session
CREATE OR REPLACE FUNCTION approve_stream_seat_request(
  p_request_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  session_id UUID,
  error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_broadcaster_id UUID;
  v_stream_id UUID;
  v_user_id UUID;
  v_seat_index INTEGER;
  v_seat_price INTEGER;
  v_session_id UUID;
  v_current_user UUID;
  v_seat_occupied BOOLEAN;
BEGIN
  v_current_user := auth.uid();

  -- Get request details
  SELECT broadcaster_id, stream_id, user_id, seat_index, seat_price 
  INTO v_broadcaster_id, v_stream_id, v_user_id, v_seat_index, v_seat_price
  FROM stream_seat_requests WHERE id = p_request_id;

  IF v_broadcaster_id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Request not found'::TEXT;
    RETURN;
  END IF;

  -- Verify current user is the broadcaster
  IF v_current_user != v_broadcaster_id THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Only broadcaster can approve'::TEXT;
    RETURN;
  END IF;

  -- Check seat is still available
  SELECT (SELECT COUNT(*) > 0 FROM stream_seat_sessions 
    WHERE stream_id = v_stream_id AND seat_index = v_seat_index AND status = 'active')
  INTO v_seat_occupied;

  IF v_seat_occupied THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Seat is already occupied'::TEXT;
    RETURN;
  END IF;

  -- Mark request as approved
  UPDATE stream_seat_requests 
  SET status = 'approved', approved_at = NOW(),
      expires_at = NOW() + INTERVAL '60 seconds'
  WHERE id = p_request_id;

  -- Create reserved seat session
  INSERT INTO stream_seat_sessions (
    stream_id, user_id, seat_index, status, price_paid
  ) VALUES (
    v_stream_id, v_user_id, v_seat_index, 'reserved', v_seat_price
  ) RETURNING id INTO v_session_id;

  -- Link session to request
  UPDATE stream_seat_requests
  SET session_id = v_session_id
  WHERE id = p_request_id;

  RETURN QUERY SELECT TRUE, v_session_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION approve_stream_seat_request(UUID) TO authenticated;

----

-- RPC 3: Broadcaster denies seat request
-- Does: mark denied, refund viewer, deduct broadcaster (can go negative)
CREATE OR REPLACE FUNCTION deny_stream_seat_request(
  p_request_id UUID,
  p_deny_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_broadcaster_id UUID;
  v_user_id UUID;
  v_paid_amount INTEGER;
  v_current_user UUID;
BEGIN
  v_current_user := auth.uid();

  -- Get request details
  SELECT broadcaster_id, user_id, paid_amount 
  INTO v_broadcaster_id, v_user_id, v_paid_amount
  FROM stream_seat_requests WHERE id = p_request_id;

  IF v_broadcaster_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Request not found'::TEXT;
    RETURN;
  END IF;

  -- Verify current user is the broadcaster
  IF v_current_user != v_broadcaster_id THEN
    RETURN QUERY SELECT FALSE, 'Only broadcaster can deny'::TEXT;
    RETURN;
  END IF;

  -- Mark as denied
  UPDATE stream_seat_requests 
  SET status = 'denied', denied_at = NOW(), deny_reason = p_deny_reason,
      payment_status = 'refunded'
  WHERE id = p_request_id;

  -- Refund viewer
  IF v_paid_amount > 0 THEN
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance + v_paid_amount
    WHERE id = v_user_id;

    -- Deduct broadcaster (can go negative)
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance - v_paid_amount
    WHERE id = v_broadcaster_id;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION deny_stream_seat_request(UUID, TEXT) TO authenticated;

----

-- RPC 4: Mark seat request as joined (only after successful LiveKit publish)
-- Does: set status to joined, update seat session status to active
CREATE OR REPLACE FUNCTION mark_seat_request_joined(
  p_request_id UUID,
  p_session_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user_id UUID;
  v_current_user UUID;
  v_status TEXT;
BEGIN
  v_current_user := auth.uid();

  -- Get request user
  SELECT user_id, status INTO v_user_id, v_status
  FROM stream_seat_requests WHERE id = p_request_id;

  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Request not found'::TEXT;
    RETURN;
  END IF;

  -- Verify current user is the requester
  IF v_current_user != v_user_id THEN
    RETURN QUERY SELECT FALSE, 'Only requester can mark joined'::TEXT;
    RETURN;
  END IF;

  -- Can only join if approved
  IF v_status != 'approved' THEN
    RETURN QUERY SELECT FALSE, 'Request must be approved to join'::TEXT;
    RETURN;
  END IF;

  -- Mark request as joined
  UPDATE stream_seat_requests 
  SET status = 'joined', joined_at = NOW()
  WHERE id = p_request_id;

  -- Update seat session to active
  UPDATE stream_seat_sessions 
  SET status = 'active', joined_at = NOW()
  WHERE id = p_session_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_seat_request_joined(UUID, UUID) TO authenticated;

----

-- RPC 5: Refund failed seat request
-- Does: refund viewer, deduct broadcaster, clear seat session if needed, mark refunded
CREATE OR REPLACE FUNCTION refund_failed_seat_request(
  p_request_id UUID,
  p_session_id UUID DEFAULT NULL,
  p_refund_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_broadcaster_id UUID;
  v_user_id UUID;
  v_paid_amount INTEGER;
  v_status TEXT;
BEGIN
  -- Get request details
  SELECT broadcaster_id, user_id, paid_amount, status
  INTO v_broadcaster_id, v_user_id, v_paid_amount, v_status
  FROM stream_seat_requests WHERE id = p_request_id;

  IF v_broadcaster_id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Request not found'::TEXT;
    RETURN;
  END IF;

  -- Can only refund non-terminal statuses
  IF v_status IN ('refunded', 'denied') THEN
    RETURN QUERY SELECT FALSE, 'Request already processed'::TEXT;
    RETURN;
  END IF;

  -- Mark as refunded
  UPDATE stream_seat_requests 
  SET status = 'refunded', payment_status = 'refunded', deny_reason = p_refund_reason
  WHERE id = p_request_id;

  -- Refund viewer
  IF v_paid_amount > 0 THEN
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance + v_paid_amount
    WHERE id = v_user_id;

    -- Deduct broadcaster (can go negative)
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance - v_paid_amount
    WHERE id = v_broadcaster_id;
  END IF;

  -- Clear seat session if provided
  IF p_session_id IS NOT NULL THEN
    UPDATE stream_seat_sessions 
    SET status = 'failed', left_at = NOW()
    WHERE id = p_session_id;
  END IF;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION refund_failed_seat_request(UUID, UUID, TEXT) TO authenticated;

----

-- Helper function to expire old requests (call periodically from client or cron)
CREATE OR REPLACE FUNCTION expire_old_seat_requests()
RETURNS TABLE (
  expired_count INTEGER,
  refunded_count INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_expired_count INTEGER := 0;
  v_refunded_count INTEGER := 0;
  v_request RECORD;
BEGIN
  -- Expire pending requests that are past expiry
  UPDATE stream_seat_requests 
  SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW()
  RETURNING 1 INTO v_request;
  
  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  -- Refund expired requests
  FOR v_request IN
    SELECT id, broadcaster_id, user_id, paid_amount
    FROM stream_seat_requests
    WHERE status = 'expired' AND payment_status != 'refunded'
  LOOP
    -- Refund viewer
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance + v_request.paid_amount
    WHERE id = v_request.user_id;

    -- Deduct broadcaster
    UPDATE user_profiles 
    SET paid_coin_balance = paid_coin_balance - v_request.paid_amount
    WHERE id = v_request.broadcaster_id;

    UPDATE stream_seat_requests 
    SET payment_status = 'refunded'
    WHERE id = v_request.id;

    v_refunded_count := v_refunded_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_expired_count, v_refunded_count;
END;
$$;

GRANT EXECUTE ON FUNCTION expire_old_seat_requests() TO authenticated;

-- Commit migration
COMMIT;

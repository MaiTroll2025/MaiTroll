-- ==========================================
-- Marketplace Manual Payout Release Requests
-- ==========================================
-- Table for admin approval of manual payouts
CREATE TABLE IF NOT EXISTS marketplace_payout_release_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid REFERENCES marketplace_purchases(id) ON DELETE CASCADE NOT NULL,
  seller_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,

  -- Request details
  tracking_number text NOT NULL,
  tracking_url text,
  carrier text CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
  seller_notes text,

  -- Gate info
  completed_sales_count int DEFAULT 0,
  has_open_appeals boolean DEFAULT false,

  -- Status flow: pending -> approved -> rejected -> completed | expired
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'expired')),

  -- Admin fields
  reviewed_by uuid REFERENCES user_profiles(id),
  reviewed_at timestamptz,
  admin_notes text,
  rejection_reason text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(order_id)
);

CREATE INDEX IF NOT EXISTS idx_payout_release_requests_status ON marketplace_payout_release_requests(status);
CREATE INDEX IF NOT EXISTS idx_payout_release_requests_seller ON marketplace_payout_release_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_payout_release_requests_order ON marketplace_payout_release_requests(order_id);

-- ==========================================
-- RPC: request manual payout release (seller side, gated)
-- ==========================================
CREATE OR REPLACE FUNCTION request_marketplace_payout_release(
  p_order_id uuid,
  p_seller_id uuid,
  p_tracking_number text,
  p_carrier text DEFAULT 'usps',
  p_seller_notes text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order marketplace_purchases%ROWTYPE;
  v_existing_request uuid;
  v_completed_sales int;
  v_has_appeals boolean;
  v_tracking_url text;
  v_min_sales int := 10;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Verify seller owns this order
  IF v_order.seller_id != p_seller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this order');
  END IF;

  -- Check order status
  IF v_order.payout_status != 'held' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payout is not in held status');
  END IF;

  -- Check if request already exists
  SELECT id INTO v_existing_request FROM marketplace_payout_release_requests
  WHERE order_id = p_order_id AND status IN ('pending', 'approved');
  IF v_existing_request IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A pending or approved request already exists for this order');
  END IF;

  -- Gate: check seller's completed sales count (excluding this order)
  SELECT COUNT(*) INTO v_completed_sales FROM marketplace_purchases
  WHERE seller_id = p_seller_id
    AND status IN ('delivered', 'completed')
    AND id != p_order_id
    AND fulfillment_status NOT IN ('cancelled', 'refunded', 'lawsuit_filed');

  -- Gate: check for open appeals/lawsuits on seller's other orders
  SELECT EXISTS(
    SELECT 1 FROM marketplace_purchases mp
    WHERE mp.seller_id = p_seller_id
      AND mp.id != p_order_id
      AND (mp.appeal_id IS NOT NULL OR mp.troll_court_case_id IS NOT NULL)
  ) INTO v_has_appeals;

  -- Build tracking URL
  v_tracking_url := CASE p_carrier
    WHEN 'usps' THEN 'https://tools.usps.com/go/TrackConfirmAction?tLabels=' || p_tracking_number
    WHEN 'fedex' THEN 'https://www.fedex.com/fedextrack/?trknbr=' || p_tracking_number
    WHEN 'ups' THEN 'https://www.ups.com/track?tracknum=' || p_tracking_number
    WHEN 'dhl' THEN 'https://www.dhl.com/en/express/tracking.html?AWB=' || p_tracking_number
    ELSE null
  END;

  -- Insert request
  INSERT INTO marketplace_payout_release_requests (
    order_id, seller_id, tracking_number, carrier, tracking_url,
    seller_notes, completed_sales_count, has_open_appeals
  ) VALUES (
    p_order_id, p_seller_id, p_tracking_number, p_carrier, v_tracking_url,
    p_seller_notes, v_completed_sales, v_has_appeals
  );

  RETURN jsonb_build_object(
    'success', true,
    'request_created', true,
    'completed_sales', v_completed_sales,
    'has_open_appeals', v_has_appeals,
    'min_sales_required', v_min_sales
  );
END;
$$;

-- ==========================================
-- RPC: admin approve payout release + credit coins
-- ==========================================
CREATE OR REPLACE FUNCTION admin_approve_marketplace_release(
  p_request_id uuid,
  p_admin_id uuid,
  p_admin_notes text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req marketplace_payout_release_requests%ROWTYPE;
  v_order marketplace_purchases%ROWTYPE;
  v_release_result text;
BEGIN
  SELECT * INTO v_req FROM marketplace_payout_release_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not pending');
  END IF;

  -- Get order
  SELECT * INTO v_order FROM marketplace_purchases WHERE id = v_req.order_id;
  IF v_order IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Release the marketplace payout hold and credit seller earnings via release_marketplace_payout
  SELECT release_marketplace_payout(v_order.id, 'admin_manual_approval', p_admin_id)
    INTO v_release_result;

  IF v_release_result IS DISTINCT FROM 'Payout released successfully' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payout release failed',
      'details', v_release_result
    );
  END IF;

  -- Update request status only after successful payout release
  UPDATE marketplace_payout_release_requests
  SET status = 'approved',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      admin_notes = p_admin_notes,
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Payout released and seller credited');
END;
$$;

-- ==========================================
-- RPC: admin reject payout release request
-- ==========================================
CREATE OR REPLACE FUNCTION admin_reject_marketplace_release(
  p_request_id uuid,
  p_admin_id uuid,
  p_rejection_reason text DEFAULT null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_req marketplace_payout_release_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_req FROM marketplace_payout_release_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_req.status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request is not pending');
  END IF;

  UPDATE marketplace_payout_release_requests
  SET status = 'rejected',
      reviewed_by = p_admin_id,
      reviewed_at = now(),
      rejection_reason = COALESCE(p_rejection_reason, ''),
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('success', true, 'message', 'Request rejected');
END;
$$;

-- ==========================================
-- RPC: seller's completed sales count (for gate check)
-- ==========================================
CREATE OR REPLACE FUNCTION get_seller_completed_sales_count(
  p_seller_id uuid
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM marketplace_purchases
  WHERE seller_id = p_seller_id
    AND status IN ('delivered', 'completed')
    AND fulfillment_status NOT IN ('cancelled', 'refunded', 'lawsuit_filed');

  RETURN COALESCE(v_count, 0);
END;
$$;

-- ==========================================
-- RPC: does seller have open appeals
-- ==========================================
CREATE OR REPLACE FUNCTION seller_has_open_appeals(
  p_seller_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM marketplace_purchases mp
    WHERE mp.seller_id = p_seller_id
      AND (mp.appeal_id IS NOT NULL OR mp.troll_court_case_id IS NOT NULL)
      AND mp.fulfillment_status NOT IN ('resolved', 'refunded', 'cancelled')
  ) INTO v_has;

  RETURN COALESCE(v_has, false);
END;
$$;

-- ==========================================
-- Permissions
-- ==========================================
ALTER TABLE marketplace_payout_release_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view own requests" ON marketplace_payout_release_requests
  FOR SELECT USING (
    seller_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

CREATE POLICY "Sellers can create own requests" ON marketplace_payout_release_requests
  FOR INSERT WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Admins can update requests" ON marketplace_payout_release_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true))
  );

GRANT ALL ON marketplace_payout_release_requests TO service_role;
GRANT SELECT, INSERT ON marketplace_payout_release_requests TO authenticated;

GRANT EXECUTE ON FUNCTION request_marketplace_payout_release(uuid, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_approve_marketplace_release(uuid, uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION admin_reject_marketplace_release(uuid, uuid, text) TO service_role;

GRANT EXECUTE ON FUNCTION admin_approve_marketplace_release(uuid, uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION admin_reject_marketplace_release(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_completed_sales_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seller_has_open_appeals(uuid) TO authenticated;

SELECT 'Marketplace manual payout release migration completed!' as status;

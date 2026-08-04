-- ============================================================================
-- AUCTION STUDIO 2.0 — DATABASE MIGRATION
-- Barcode/QR, Orders, Fulfillment, Devices, Chat Bidding
-- ============================================================================

-- ============================================================================
-- PART 1: EXTEND AUCTION_LOTS WITH BARCODE / QR / INVENTORY FIELDS
-- ============================================================================

ALTER TABLE auction_lots
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS barcode_data TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS condition TEXT,
  ADD COLUMN IF NOT EXISTS auctioneer_id UUID REFERENCES auctioneer_profiles(id),
  ADD COLUMN IF NOT EXISTS status_extended TEXT NOT NULL DEFAULT 'draft'
    CHECK (status_extended IN (
      'draft', 'available', 'queued', 'live', 'sold',
      'packed', 'shipped', 'delivered'
    )),
  ADD COLUMN IF NOT EXISTS reserve_price BIGINT,
  ADD COLUMN IF NOT EXISTS bid_increment BIGINT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS buy_now_price BIGINT,
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS shipping_base_price BIGINT NOT NULL DEFAULT 0;

-- Generate lot numbers and barcodes for existing lots
DO $$
DECLARE
  v_lot RECORD;
  v_counter INTEGER := 0;
  v_lot_number TEXT;
  v_barcode TEXT;
BEGIN
  FOR v_lot IN SELECT id FROM auction_lots WHERE lot_number IS NULL ORDER BY created_at LOOP
    LOOP
      v_counter := v_counter + 1;
      v_lot_number := 'TC-LOT-' || LPAD(v_counter::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM auction_lots WHERE id <> v_lot.id AND lot_number = v_lot_number
      );
    END LOOP;

    LOOP
      v_barcode := 'TC-LOT-' || LPAD(v_counter::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM auction_lots WHERE id <> v_lot.id AND barcode = v_barcode
      );
      v_counter := v_counter + 1;
    END LOOP;

    UPDATE auction_lots
    SET lot_number = v_lot_number,
        barcode = v_barcode,
        barcode_data = v_lot_number,
        status_extended = CASE status
          WHEN 'upcoming' THEN 'queued'
          WHEN 'live' THEN 'live'
          WHEN 'sold' THEN 'sold'
          WHEN 'unsold' THEN 'available'
          WHEN 'removed' THEN 'available'
          ELSE 'draft'
        END
    WHERE id = v_lot.id;
  END LOOP;
END $$;

-- Indexes for barcode lookups
CREATE INDEX IF NOT EXISTS idx_auction_lots_barcode ON auction_lots(barcode);
CREATE INDEX IF NOT EXISTS idx_auction_lots_lot_number ON auction_lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_auction_lots_sku ON auction_lots(sku);
CREATE INDEX IF NOT EXISTS idx_auction_lots_status_extended ON auction_lots(status_extended);

-- ============================================================================
-- PART 2: AUCTION ORDERS — post-sale order tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE,
  winner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auctioneer_id UUID NOT NULL REFERENCES auctioneer_profiles(id),
  sale_amount BIGINT NOT NULL DEFAULT 0,
  shipping_cost BIGINT NOT NULL DEFAULT 0,
  batch_id UUID,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'held', 'paid', 'refunded', 'failed', 'disputed')),
  fulfillment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'packed', 'ready_to_ship', 'shipped', 'delivered', 'disputed')),
  shipping_name TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'US',
  shipping_carrier TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_orders_winner ON auction_orders(winner_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_orders_show ON auction_orders(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_orders_lot ON auction_orders(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_orders_batch ON auction_orders(batch_id);
CREATE INDEX IF NOT EXISTS idx_auction_orders_payment ON auction_orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_auction_orders_fulfillment ON auction_orders(fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_auction_orders_number ON auction_orders(order_number);

ALTER TABLE auction_orders
  ADD COLUMN IF NOT EXISTS batch_id UUID;

-- Trigger for updated_at
CREATE TRIGGER trigger_auction_orders_updated_at
  BEFORE UPDATE ON auction_orders
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================================
-- ORDER RECEIPTS — auto-generated Mai Troll LLC receipts
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  order_id UUID NOT NULL REFERENCES auction_orders(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auctioneer_profiles(id) ON DELETE CASCADE,
  item_title TEXT NOT NULL,
  item_image_url TEXT,
  sale_amount BIGINT NOT NULL DEFAULT 0,
  shipping_cost BIGINT NOT NULL DEFAULT 0,
  total_amount BIGINT NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL,
  shipping_name TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_country TEXT DEFAULT 'US',
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_receipts_order ON order_receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_order_receipts_buyer ON order_receipts(buyer_id);
CREATE INDEX IF NOT EXISTS idx_order_receipts_number ON order_receipts(receipt_number);

CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS TEXT AS $$
DECLARE
  v_number TEXT;
BEGIN
  LOOP
    v_number := 'TCRC-' || LPAD(FLOOR(RANDOM() * 900000 + 100000)::TEXT, 6, '0');
    IF NOT EXISTS (SELECT 1 FROM order_receipts WHERE receipt_number = v_number) THEN
      RETURN v_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_order_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_receipt_number TEXT;
BEGIN
  SELECT id INTO v_receipt_number
  FROM order_receipts
  WHERE order_id = NEW.id;

  IF v_receipt_number IS NULL THEN
    v_receipt_number := generate_receipt_number();

    INSERT INTO order_receipts (
      receipt_number,
      order_id,
      order_number,
      buyer_id,
      auction_show_id,
      lot_id,
      seller_id,
      item_title,
      item_image_url,
      sale_amount,
      shipping_cost,
      total_amount,
      payment_status,
      fulfillment_status,
      shipping_name,
      shipping_line1,
      shipping_line2,
      shipping_city,
      shipping_state,
      shipping_zip,
      shipping_country,
      metadata
    )
    SELECT
      v_receipt_number,
      NEW.id,
      NEW.order_number,
      NEW.winner_user_id,
      NEW.auction_show_id,
      NEW.lot_id,
      NEW.auctioneer_id,
      COALESCE(al.title, 'Auction Item'),
      al.image_urls->>0,
      NEW.sale_amount,
      NEW.shipping_cost,
      COALESCE(NEW.sale_amount, 0) + COALESCE(NEW.shipping_cost, 0),
      NEW.payment_status,
      NEW.fulfillment_status,
      NEW.shipping_name,
      NEW.shipping_line1,
      NEW.shipping_line2,
      NEW.shipping_city,
      NEW.shipping_state,
      NEW.shipping_zip,
      COALESCE(NEW.shipping_country, 'US'),
      jsonb_build_object(
        'brand', 'Mai Troll LLC',
        'source', 'auction_order',
        'batch_id', NEW.batch_id
      )
    FROM auction_lots al
    WHERE al.id = NEW.lot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_order_receipt ON auction_orders;
CREATE TRIGGER trigger_create_order_receipt
  AFTER INSERT ON auction_orders
  FOR EACH ROW EXECUTE FUNCTION create_order_receipt();

CREATE OR REPLACE FUNCTION refresh_order_receipt()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE order_receipts
  SET order_number = NEW.order_number,
      sale_amount = NEW.sale_amount,
      shipping_cost = NEW.shipping_cost,
      total_amount = COALESCE(NEW.sale_amount, 0) + COALESCE(NEW.shipping_cost, 0),
      payment_status = NEW.payment_status,
      fulfillment_status = NEW.fulfillment_status,
      shipping_name = NEW.shipping_name,
      shipping_line1 = NEW.shipping_line1,
      shipping_line2 = NEW.shipping_line2,
      shipping_city = NEW.shipping_city,
      shipping_state = NEW.shipping_state,
      shipping_zip = NEW.shipping_zip,
      shipping_country = COALESCE(NEW.shipping_country, 'US'),
      metadata = jsonb_set(
        COALESCE(metadata, '{}'::JSONB),
        '{batch_id}',
        to_jsonb(COALESCE(NEW.batch_id::TEXT, 'null')),
        true
      ),
      updated_at = now()
  WHERE order_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_refresh_order_receipt ON auction_orders;
CREATE TRIGGER trigger_refresh_order_receipt
  AFTER UPDATE ON auction_orders
  FOR EACH ROW EXECUTE FUNCTION refresh_order_receipt();

-- ============================================================================
-- PART 3: AUCTION DEVICES — scanner & printer management
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('scanner', 'printer')),
  device_brand TEXT,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('usb', 'bluetooth', 'hid', 'network')),
  device_id TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'pairing', 'error')),
  last_connected_at TIMESTAMPTZ,
  last_error TEXT,
  settings JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_devices_user ON auction_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_devices_status ON auction_devices(status);

CREATE TRIGGER trigger_auction_devices_updated_at
  BEFORE UPDATE ON auction_devices
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================================================
-- PART 4: AUCTION CHAT BIDS — separate table for chat bid tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS auction_chat_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id UUID NOT NULL REFERENCES auction_shows(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES auction_lots(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bid_amount BIGINT NOT NULL CHECK (bid_amount > 0),
  bid_source TEXT NOT NULL DEFAULT 'chat'
    CHECK (bid_source IN ('chat', 'quick_bid', 'custom_bid', 'button')),
  chat_message TEXT,
  accepted BOOLEAN NOT NULL DEFAULT false,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_chat_bids_lot ON auction_chat_bids(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_chat_bids_show ON auction_chat_bids(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_chat_bids_bidder ON auction_chat_bids(bidder_id);

-- ============================================================================
-- PART 5: AUCTIONEER SETTINGS — extend with chat bid settings
-- ============================================================================

ALTER TABLE auctioneer_profiles
  ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{
    "default_bid_increment": 500,
    "auto_advance_queue": true,
    "notify_on_bid": true,
    "notify_on_sale": true,
    "require_shipping_address": true,
    "default_auction_duration_minutes": 30,
    "min_starting_bid": 100,
    "max_lots_per_show": 100,
    "chat_bidding_enabled": true,
    "quick_bid_enabled": true,
    "custom_bid_enabled": true,
    "bid_confirmation_required": false
  }'::JSONB;

-- ============================================================================
-- PART 6: AUCTION WINNER PROFILE — shipping info cache
-- ============================================================================

ALTER TABLE auction_wins
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES auction_orders(id),
  ADD COLUMN IF NOT EXISTS shipping_name TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line1 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_line2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_city TEXT,
  ADD COLUMN IF NOT EXISTS shipping_state TEXT,
  ADD COLUMN IF NOT EXISTS shipping_zip TEXT,
  ADD COLUMN IF NOT EXISTS shipping_country TEXT DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_cost BIGINT NOT NULL DEFAULT 0;

-- ============================================================================
-- PART 7: RPC FUNCTIONS
-- ============================================================================

-- Generate unique order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  v_number TEXT;
BEGIN
  LOOP
    v_number := 'AUC-' || LPAD(FLOOR(RANDOM() * 90000 + 10000)::TEXT, 5, '0');
    IF NOT EXISTS (SELECT 1 FROM auction_orders WHERE order_number = v_number) THEN
      RETURN v_number;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Auto-create order when lot is marked sold
CREATE OR REPLACE FUNCTION create_order_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_order_number TEXT;
  v_existing_order_id UUID;
BEGIN
  -- Only when transitioning to sold
  IF NEW.status = 'sold' AND (OLD.status IS NULL OR OLD.status != 'sold') THEN
    -- Check if order already exists for this lot
    SELECT id INTO v_existing_order_id
    FROM auction_orders
    WHERE lot_id = NEW.id;

    IF v_existing_order_id IS NULL AND NEW.winner_user_id IS NOT NULL THEN
      v_order_number := generate_order_number();

      INSERT INTO auction_orders (
        order_number,
        auction_show_id,
        lot_id,
        winner_user_id,
        auctioneer_id,
        sale_amount,
        shipping_cost,
        payment_status,
        fulfillment_status
      ) VALUES (
        v_order_number,
        NEW.auction_show_id,
        NEW.id,
        NEW.winner_user_id,
        (SELECT auctioneer_id FROM auction_shows WHERE id = NEW.auction_show_id),
        COALESCE(NEW.current_highest_bid, NEW.starting_bid, 0),
        COALESCE(NEW.shipping_base_price, 0),
        'held',
        'pending'
      );

      -- Also create auction_wins record if not exists
      INSERT INTO auction_wins (
        auction_show_id,
        lot_id,
        winner_user_id,
        final_bid,
        shipping_cost,
        payment_status,
        fulfillment_status
      ) VALUES (
        NEW.auction_show_id,
        NEW.id,
        NEW.winner_user_id,
        COALESCE(NEW.current_highest_bid, NEW.starting_bid, 0),
        COALESCE(NEW.shipping_base_price, 0),
        'held',
        'pending'
      )
      ON CONFLICT (lot_id) DO NOTHING;

      -- Log audit
      PERFORM log_auction_audit(
        NULL,
        'order_created_auto',
        NEW.auction_show_id,
        NEW.id,
        NEW.winner_user_id,
        jsonb_build_object(
          'order_number', v_order_number,
          'sale_amount', COALESCE(NEW.current_highest_bid, NEW.starting_bid, 0)
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to auction_lots
DROP TRIGGER IF EXISTS trigger_create_order_on_sale ON auction_lots;
CREATE TRIGGER trigger_create_order_on_sale
  AFTER UPDATE ON auction_lots
  FOR EACH ROW EXECUTE FUNCTION create_order_on_sale();

-- Get live auction state (extended version)
CREATE OR REPLACE FUNCTION get_live_auction_state(p_show_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_current_lot auction_lots%ROWTYPE;
  v_bids JSONB;
  v_viewer_count INTEGER;
BEGIN
  -- Get current lot
  SELECT * INTO v_current_lot
  FROM auction_lots
  WHERE auction_show_id = p_show_id
    AND status = 'live'
  ORDER BY queue_position NULLS LAST
  LIMIT 1;

  -- Get recent bids
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', ab.id,
      'lot_id', ab.lot_id,
      'bidder_id', ab.bidder_id,
      'bid_amount', ab.bid_amount,
      'created_at', ab.created_at,
      'bidder', jsonb_build_object(
        'username', up.username,
        'display_name', up.display_name,
        'avatar_url', up.avatar_url
      )
    ) ORDER BY ab.created_at DESC
  ), '[]'::JSONB)
  INTO v_bids
  FROM auction_bids ab
  LEFT JOIN user_profiles up ON up.id = ab.bidder_id
  WHERE ab.auction_show_id = p_show_id
    AND ab.created_at > now() - interval '5 minutes';

  -- Get viewer count
  SELECT COUNT(DISTINCT user_id) INTO v_viewer_count
  FROM auction_presence
  WHERE auction_show_id = p_show_id AND is_active = true;

  RETURN jsonb_build_object(
    'current_lot', CASE WHEN v_current_lot.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_current_lot.id,
        'title', v_current_lot.title,
        'description', v_current_lot.description,
        'image_url', v_current_lot.image_urls->>0,
        'starting_bid', v_current_lot.starting_bid,
        'bid_increment', v_current_lot.min_increment,
        'current_highest_bid', v_current_lot.current_highest_bid,
        'current_highest_bidder_id', v_current_lot.current_highest_bidder_id,
        'status', v_current_lot.status,
        'countdown_end_at', v_current_lot.countdown_end_at,
        'lot_number', v_current_lot.lot_number,
        'barcode', v_current_lot.barcode,
        'condition', v_current_lot.condition,
        'quantity', v_current_lot.quantity
      )
    ELSE NULL END,
    'recent_bids', v_bids,
    'viewer_count', v_viewer_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Place chat bid (wraps existing place_bid with chat-specific logging)
CREATE OR REPLACE FUNCTION place_chat_bid(
  p_show_id UUID,
  p_lot_id UUID,
  p_bid_amount BIGINT,
  p_bid_source TEXT DEFAULT 'chat',
  p_chat_message TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_result JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'Authentication required');
  END IF;

  -- Call the existing place_bid function
  v_result := place_bid(p_show_id, p_lot_id, p_bid_amount);

  -- Log the chat bid
  INSERT INTO auction_chat_bids (
    auction_show_id,
    lot_id,
    bidder_id,
    bid_amount,
    bid_source,
    chat_message,
    accepted,
    rejection_reason
  ) VALUES (
    p_show_id,
    p_lot_id,
    v_user_id,
    p_bid_amount,
    p_bid_source,
    p_chat_message,
    (v_result->>'accepted') = 'true',
    v_result->>'reason'
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Scan barcode to get lot info
CREATE OR REPLACE FUNCTION scan_lot_barcode(p_barcode TEXT)
RETURNS JSONB AS $$
DECLARE
  v_lot auction_lots%ROWTYPE;
  v_order auction_orders%ROWTYPE;
  v_receipt order_receipts%ROWTYPE;
  v_winner RECORD;
BEGIN
  -- Find the lot
  SELECT * INTO v_lot
  FROM auction_lots
  WHERE barcode = p_barcode OR lot_number = p_barcode
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false, 'error', 'Lot not found');
  END IF;

  -- Get order info if sold
  SELECT * INTO v_order
  FROM auction_orders
  WHERE lot_id = v_lot.id;

  -- Get receipt info if available
  IF v_order.id IS NOT NULL THEN
    SELECT * INTO v_receipt
    FROM order_receipts
    WHERE order_id = v_order.id
    LIMIT 1;
  END IF;

  -- Get winner info if sold
  IF v_lot.winner_user_id IS NOT NULL THEN
    SELECT id, username, display_name, avatar_url
    INTO v_winner
    FROM user_profiles
    WHERE id = v_lot.winner_user_id;
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'lot', jsonb_build_object(
      'id', v_lot.id,
      'lot_number', v_lot.lot_number,
      'title', v_lot.title,
      'description', v_lot.description,
      'image_url', v_lot.image_urls->>0,
      'status', v_lot.status_extended,
      'sale_amount', v_lot.current_highest_bid,
      'barcode', v_lot.barcode
    ),
    'order', CASE WHEN v_order.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_order.id,
        'order_number', v_order.order_number,
        'payment_status', v_order.payment_status,
        'fulfillment_status', v_order.fulfillment_status,
        'tracking_number', v_order.tracking_number,
        'shipping_carrier', v_order.shipping_carrier,
        'shipping_name', v_order.shipping_name,
        'shipping_line1', v_order.shipping_line1,
        'shipping_city', v_order.shipping_city,
        'shipping_state', v_order.shipping_state,
        'shipping_zip', v_order.shipping_zip
      )
    ELSE NULL END,
    'receipt', CASE WHEN v_receipt.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_receipt.id,
        'receipt_number', v_receipt.receipt_number,
        'order_id', v_receipt.order_id,
        'order_number', v_receipt.order_number,
        'buyer_id', v_receipt.buyer_id,
        'seller_id', v_receipt.seller_id,
        'item_title', v_receipt.item_title,
        'item_image_url', v_receipt.item_image_url,
        'sale_amount', v_receipt.sale_amount,
        'shipping_cost', v_receipt.shipping_cost,
        'total_amount', v_receipt.total_amount,
        'payment_status', v_receipt.payment_status,
        'fulfillment_status', v_receipt.fulfillment_status,
        'shipping_name', v_receipt.shipping_name,
        'shipping_line1', v_receipt.shipping_line1,
        'shipping_city', v_receipt.shipping_city,
        'shipping_state', v_receipt.shipping_state,
        'shipping_zip', v_receipt.shipping_zip,
        'shipping_country', v_receipt.shipping_country,
        'tracking_number', v_order.tracking_number,
        'shipping_carrier', v_order.shipping_carrier,
        'shipped_at', v_order.shipped_at,
        'delivered_at', v_order.delivered_at,
        'created_at', v_receipt.created_at,
        'metadata', v_receipt.metadata
      )
    ELSE NULL END,
    'winner', CASE WHEN v_winner.id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_winner.id,
        'username', v_winner.username,
        'display_name', v_winner.display_name
      )
    ELSE NULL END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update order fulfillment status
CREATE OR REPLACE FUNCTION update_order_fulfillment(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_carrier TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_order auction_orders%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_order FROM auction_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Verify auctioneer owns the show
  IF NOT EXISTS (
    SELECT 1 FROM auction_shows s
    JOIN auctioneer_profiles ap ON s.auctioneer_id = ap.id
    WHERE s.id = v_order.auction_show_id
      AND ap.user_id = v_user_id
  ) AND NOT is_admin(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  UPDATE auction_orders
  SET fulfillment_status = p_status,
      tracking_number = COALESCE(p_tracking_number, tracking_number),
      shipping_carrier = COALESCE(p_carrier, shipping_carrier),
      shipped_at = CASE WHEN p_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_status = 'delivered' THEN now() ELSE delivered_at END,
      updated_at = now()
  WHERE id = p_order_id;

  -- Also update auction_lots status
  UPDATE auction_lots
  SET status_extended = p_status
  WHERE id = v_order.lot_id;

  RETURN jsonb_build_object('success', true, 'message', 'Order updated');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get auctioneer dashboard stats
CREATE OR REPLACE FUNCTION get_auctioneer_stats(p_auctioneer_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_shows INTEGER;
  v_total_lots INTEGER;
  v_total_sold INTEGER;
  v_gross_sales BIGINT;
  v_pending_orders INTEGER;
  v_delivered_orders INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_shows
  FROM auction_shows WHERE auctioneer_id = p_auctioneer_id;

  SELECT COUNT(*) INTO v_total_lots
  FROM auction_lots al
  JOIN auction_shows s ON al.auction_show_id = s.id
  WHERE s.auctioneer_id = p_auctioneer_id;

  SELECT COUNT(*) INTO v_total_sold
  FROM auction_lots al
  JOIN auction_shows s ON al.auction_show_id = s.id
  WHERE s.auctioneer_id = p_auctioneer_id AND al.status = 'sold';

  SELECT COALESCE(SUM(sale_amount), 0) INTO v_gross_sales
  FROM auction_orders WHERE auctioneer_id = p_auctioneer_id;

  SELECT COUNT(*) INTO v_pending_orders
  FROM auction_orders WHERE auctioneer_id = p_auctioneer_id AND fulfillment_status IN ('pending', 'packed', 'ready_to_ship');

  SELECT COUNT(*) INTO v_delivered_orders
  FROM auction_orders WHERE auctioneer_id = p_auctioneer_id AND fulfillment_status = 'delivered';

  RETURN jsonb_build_object(
    'total_shows', v_total_shows,
    'total_lots', v_total_lots,
    'total_sold', v_total_sold,
    'sell_through_rate', CASE WHEN v_total_lots > 0 THEN ROUND((v_total_sold::NUMERIC / v_total_lots) * 100, 1) ELSE 0 END,
    'gross_sales', v_gross_sales,
    'pending_orders', v_pending_orders,
    'delivered_orders', v_delivered_orders
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

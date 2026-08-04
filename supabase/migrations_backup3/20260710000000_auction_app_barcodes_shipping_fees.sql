-- ============================================================================
-- AUCTION APP — BARCODES, SHIPPING, CANCELLATION FEES (forward-only)
-- ============================================================================
-- Safe to run once in production. Guards for existing objects included.
-- ============================================================================
-- PART 1: AUTOMATIC BARCODE / LOT NUMBER GENERATION
-- Every item receives a stable, unique barcode at creation time.
-- The barcode encodes ONLY a non-sensitive id (TC-LOT-000123).
-- ============================================================================

-- Counter sequence for human-readable lot numbers.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'auction_lot_number_seq') THEN
    CREATE SEQUENCE auction_lot_number_seq START WITH 1;
  END IF;
END $$;

-- Ensure barcode-related columns exist.
ALTER TABLE auction_lots
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS barcode TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS barcode_data TEXT,
  ADD COLUMN IF NOT EXISTS qr_code TEXT,
  ADD COLUMN IF NOT EXISTS item_number TEXT,
  ADD COLUMN IF NOT EXISTS barcode_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS barcode_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (barcode_status IN ('pending', 'generated', 'failed')),
  ADD COLUMN IF NOT EXISTS shipping_method TEXT NOT NULL DEFAULT 'shipping'
    CHECK (shipping_method IN ('shipping', 'local_pickup', 'both'));

-- Indexes for lookups.
CREATE INDEX IF NOT EXISTS idx_auction_lots_barcode ON auction_lots(barcode);
CREATE INDEX IF NOT EXISTS idx_auction_lots_lot_number ON auction_lots(lot_number);
CREATE INDEX IF NOT EXISTS idx_auction_lots_sku ON auction_lots(sku);

-- Generate lot_number + barcode for one lot (idempotent).
CREATE OR REPLACE FUNCTION generate_lot_barcode(p_lot_id UUID)
RETURNS void AS $$
DECLARE
  v_counter INTEGER;
  v_lot_number TEXT;
  v_barcode TEXT;
BEGIN
  SELECT lot_number, barcode INTO v_lot_number, v_barcode
  FROM auction_lots WHERE id = p_lot_id;

  IF v_lot_number IS NOT NULL AND v_barcode IS NOT NULL THEN
    RETURN; -- already generated, preserve existing value
  END IF;

  -- Pick the next free counter, avoiding collisions with existing rows.
  LOOP
    v_counter := nextval('auction_lot_number_seq');
    v_lot_number := 'TC-LOT-' || LPAD(v_counter::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM auction_lots WHERE lot_number = v_lot_number);
  END LOOP;

  LOOP
    v_barcode := 'TC-LOT-' || LPAD(v_counter::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM auction_lots WHERE barcode = v_barcode);
    v_counter := v_counter + 1;
  END LOOP;

  UPDATE auction_lots
  SET lot_number = v_lot_number,
      barcode = v_barcode,
      barcode_data = v_lot_number,
      barcode_generated_at = now(),
      barcode_status = 'generated'
  WHERE id = p_lot_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: generate barcode on INSERT.
CREATE OR REPLACE FUNCTION trg_auction_lot_barcode()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM generate_lot_barcode(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auction_lot_barcode ON auction_lots;
CREATE TRIGGER trigger_auction_lot_barcode
  AFTER INSERT ON auction_lots
  FOR EACH ROW EXECUTE FUNCTION trg_auction_lot_barcode();

-- Backfill only lots missing barcodes (preserve existing values).
DO $$
DECLARE
  v_max INTEGER;
BEGIN
  SELECT MAX(CAST(REGEXP_REPLACE(lot_number, '[^0-9]', '', 'g') AS INTEGER))
    INTO v_max
    FROM auction_lots WHERE lot_number ~ 'TC-LOT-[0-9]+';
  IF v_max IS NOT NULL AND v_max > 0 THEN
    PERFORM setval('auction_lot_number_seq', v_max, true);
  END IF;
END $$;

DO $$
DECLARE
  v_lot RECORD;
BEGIN
  FOR v_lot IN SELECT id FROM auction_lots WHERE barcode IS NULL OR lot_number IS NULL LOOP
    PERFORM generate_lot_barcode(v_lot.id);
  END LOOP;
END $$;

-- ============================================================================
-- PART 2: REUSABLE SAVED ADDRESSES + IMMUTABLE ORDER SNAPSHOTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_legal_name TEXT NOT NULL,
  street_address TEXT NOT NULL,
  apt_unit TEXT,
  city TEXT NOT NULL,
  state TEXT,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  email TEXT,
  delivery_instructions TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_saved_addresses_user ON user_saved_addresses(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_saved_addresses_default
  ON user_saved_addresses(user_id) WHERE is_default;

-- Order-specific immutable snapshot of the confirmed address.
CREATE TABLE IF NOT EXISTS auction_order_address_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES auction_orders(id) ON DELETE RESTRICT,
  source_address_id UUID REFERENCES user_saved_addresses(id) ON DELETE SET NULL,
  label TEXT,
  full_legal_name TEXT NOT NULL,
  street_address TEXT NOT NULL,
  apt_unit TEXT,
  city TEXT NOT NULL,
  state TEXT,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  phone TEXT,
  email TEXT,
  delivery_instructions TEXT,
  is_local_pickup BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auction_order_address_snapshots_order
  ON auction_order_address_snapshots(order_id);

-- Cancellation fee records (idempotent per order + event).
CREATE TABLE IF NOT EXISTS auction_cancellation_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES auction_orders(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES auction_lots(id) ON DELETE SET NULL,
  winner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fee_type TEXT NOT NULL DEFAULT 'shipping_timeout',
  cancellation_event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  winning_bid_coins BIGINT NOT NULL,
  fee_coins BIGINT NOT NULL,
  fee_percentage INTEGER NOT NULL DEFAULT 10,
  collection_source TEXT,
  processor_ref TEXT,
  collection_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (collection_status IN ('pending', 'collected', 'owed', 'failed', 'waived')),
  amount_collected_coins BIGINT NOT NULL DEFAULT 0,
  amount_owed_coins BIGINT NOT NULL DEFAULT 0,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (order_id, fee_type, cancellation_event_id)
);

CREATE INDEX IF NOT EXISTS idx_auction_cancellation_fees_order ON auction_cancellation_fees(order_id);
CREATE INDEX IF NOT EXISTS idx_auction_cancellation_fees_status ON auction_cancellation_fees(collection_status);

-- ============================================================================
-- PART 3: ORDER / WIN STATE EXTENSIONS
-- Primary shipping state + deadline/cancellation timestamps + carrier codes.
-- ============================================================================

ALTER TABLE auction_orders
  ADD COLUMN IF NOT EXISTS shipping_information_status TEXT NOT NULL DEFAULT 'awaiting_shipping_information'
    CHECK (shipping_information_status IN (
      'awaiting_shipping_information',
      'shipping_information_received',
      'preparing_shipment',
      'ready_to_ship',
      'shipped',
      'pickup_ready',
      'pickup_completed',
      'bidder_confirmed_received',
      'shipping_issue',
      'completed',
      'cancelled_timeout',
      'cancelled_admin'
    )),
  ADD COLUMN IF NOT EXISTS shipping_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS carrier_code TEXT,
  ADD COLUMN IF NOT EXISTS carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS marked_shipped_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS packed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bidder_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_issue_note TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_fee_coins BIGINT,
  ADD COLUMN IF NOT EXISTS cancellation_fee_status TEXT
    CHECK (cancellation_fee_status IS NULL OR cancellation_fee_status IN ('pending','collected','owed','failed','waived')),
  ADD COLUMN IF NOT EXISTS snapshot_address_id UUID REFERENCES auction_order_address_snapshots(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_auction_orders_shipping_status ON auction_orders(shipping_information_status);
CREATE INDEX IF NOT EXISTS idx_auction_orders_cancellation_at ON auction_orders(cancellation_at);

ALTER TABLE auction_wins
  ADD COLUMN IF NOT EXISTS shipping_information_status TEXT,
  ADD COLUMN IF NOT EXISTS shipping_deadline TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipping_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS carrier_code TEXT,
  ADD COLUMN IF NOT EXISTS carrier_name TEXT,
  ADD COLUMN IF NOT EXISTS bidder_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_fee_coins BIGINT,
  ADD COLUMN IF NOT EXISTS cancellation_fee_status TEXT;

-- ============================================================================
-- PART 4: RLS POLICIES (verify & secure every private record)
-- ============================================================================

-- Helper: is the current user the auctioneer that owns a given show?
CREATE OR REPLACE FUNCTION is_show_auctioneer(p_show_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auction_shows s
    JOIN auctioneer_profiles ap ON ap.id = s.auctioneer_id
    WHERE s.id = p_show_id AND ap.user_id = auth.uid()
  ) OR is_admin(auth.uid());
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Enable RLS everywhere.
ALTER TABLE auction_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_wins ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctioneer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_saved_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_order_address_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_cancellation_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_scan_events ENABLE ROW LEVEL SECURITY;

-- Generic guarded policy helper.
CREATE OR REPLACE FUNCTION create_rls_policy(
  p_table TEXT, p_policy TEXT, p_cmd TEXT, p_using TEXT, p_check TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=p_table AND policyname=p_policy) THEN
    RETURN;
  END IF;
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR %s%s%s',
    p_policy, p_table, p_cmd,
    CASE WHEN p_using IS NOT NULL THEN ' USING (' || p_using || ')' ELSE '' END,
    CASE WHEN p_check IS NOT NULL THEN ' WITH CHECK (' || p_check || ')' ELSE '' END
  );
END;
$$ LANGUAGE plpgsql;

-- auction_shows
SELECT create_rls_policy('auction_shows','shows_public_read','SELECT','status IN (''live'',''scheduled'',''ended'')');
SELECT create_rls_policy('auction_shows','shows_owner_all','ALL','is_show_auctioneer(id)','is_show_auctioneer(id)');

-- auction_lots
SELECT create_rls_policy('auction_lots','lots_public_read','SELECT','EXISTS (SELECT 1 FROM auction_shows s WHERE s.id=auction_lots.auction_show_id AND s.status IN (''live'',''scheduled'',''ended''))');
SELECT create_rls_policy('auction_lots','lots_owner_all','ALL','is_show_auctioneer(auction_show_id)','is_show_auctioneer(auction_show_id)');

-- auction_bids
SELECT create_rls_policy('auction_bids','bids_viewer_read','SELECT','EXISTS (SELECT 1 FROM auction_shows s WHERE s.id=auction_bids.auction_show_id AND s.status IN (''live'',''scheduled''))');
SELECT create_rls_policy('auction_bids','bids_owner_insert','INSERT',NULL,'bidder_id = auth.uid()');
SELECT create_rls_policy('auction_bids','bids_owner_read','SELECT','bidder_id = auth.uid() OR is_show_auctioneer(auction_show_id)');

-- auction_wins
SELECT create_rls_policy('auction_wins','wins_winner_read','SELECT','winner_user_id = auth.uid() OR is_show_auctioneer(auction_show_id)');
SELECT create_rls_policy('auction_wins','wins_owner_update','UPDATE','is_show_auctioneer(auction_show_id)','is_show_auctioneer(auction_show_id)');

-- auction_orders
SELECT create_rls_policy('auction_orders','orders_winner_read','SELECT','winner_user_id = auth.uid() OR is_show_auctioneer(auction_show_id)');
SELECT create_rls_policy('auction_orders','orders_owner_all','ALL','is_show_auctioneer(auction_show_id)','is_show_auctioneer(auction_show_id)');

-- order_receipts
SELECT create_rls_policy('order_receipts','receipts_buyer_read','SELECT','buyer_id = auth.uid() OR is_show_auctioneer(auction_show_id)');

-- auctioneer_profiles
SELECT create_rls_policy('auctioneer_profiles','ap_owner_read','SELECT','user_id = auth.uid() OR is_admin(auth.uid())');
SELECT create_rls_policy('auctioneer_profiles','ap_owner_update','UPDATE','user_id = auth.uid() OR is_admin(auth.uid())','user_id = auth.uid() OR is_admin(auth.uid())');

-- user_saved_addresses (owner only — auctioneers can NEVER list these)
SELECT create_rls_policy('user_saved_addresses','addr_owner_all','ALL','user_id = auth.uid()','user_id = auth.uid()');

-- auction_order_address_snapshots (winner or show auctioneer only)
SELECT create_rls_policy('auction_order_address_snapshots','snap_winner_or_seller_read','SELECT',
  'EXISTS (SELECT 1 FROM auction_orders o WHERE o.id=order_id AND (o.winner_user_id = auth.uid() OR is_show_auctioneer(o.auction_show_id)))');

-- auction_cancellation_fees
SELECT create_rls_policy('auction_cancellation_fees','fee_winner_or_seller_read','SELECT',
  'winner_user_id = auth.uid() OR EXISTS (SELECT 1 FROM auction_orders o WHERE o.id=order_id AND is_show_auctioneer(o.auction_show_id))');

-- device sessions / scan events (auctioneer owner)
SELECT create_rls_policy('auction_device_sessions','dev_owner_all','ALL','auctioneer_id = (SELECT id FROM auctioneer_profiles WHERE user_id = auth.uid())','auctioneer_id = (SELECT id FROM auctioneer_profiles WHERE user_id = auth.uid())');
SELECT create_rls_policy('auction_scan_events','scan_owner_read','SELECT','is_show_auctioneer(auction_id)');

DROP FUNCTION IF EXISTS create_rls_policy(TEXT, TEXT, TEXT, TEXT, TEXT);

-- ============================================================================
-- PART 5: SERVER-AUTHORITATIVE RPCs
-- ============================================================================

-- Safe user notification (no-op if notifications table missing).
CREATE OR REPLACE FUNCTION safe_notify_user(
  p_user_id UUID, p_title TEXT, p_body TEXT, p_link TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_user_id IS NULL THEN RETURN; END IF;
  BEGIN
    INSERT INTO notifications (user_id, title, body, link, read, created_at)
    VALUES (p_user_id, p_title, p_body, p_link, false, now());
  EXCEPTION WHEN others THEN
    -- notifications table shape differs; ignore.
    NULL;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.1 Unified lot control (start/pause/resume/hold/pass/unsold).
CREATE OR REPLACE FUNCTION auction_lot_action(
  p_show_id UUID,
  p_lot_id UUID,
  p_action TEXT,
  p_countdown_seconds INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_show auction_shows%ROWTYPE;
  v_lot auction_lots%ROWTYPE;
  v_new_status TEXT;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  IF NOT is_show_auctioneer(p_show_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this show');
  END IF;

  SELECT * INTO v_show FROM auction_shows WHERE id = p_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Show not found');
  END IF;
  IF v_show.status != 'live' AND p_action != 'queue' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Show must be live');
  END IF;

  SELECT * INTO v_lot FROM auction_lots WHERE id = p_lot_id AND auction_show_id = p_show_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lot not found in this show');
  END IF;

  v_new_status := CASE p_action
    WHEN 'start' THEN 'live'
    WHEN 'resume' THEN 'live'
    WHEN 'pause' THEN 'paused'
    WHEN 'hold' THEN 'held'
    WHEN 'pass' THEN 'passed'
    WHEN 'unsold' THEN 'unsold'
    WHEN 'queue' THEN 'queued'
    ELSE v_lot.status
  END;

  -- When starting a new lot, retire the previously live lot.
  IF v_new_status = 'live' AND v_lot.status != 'live' THEN
    UPDATE auction_lots
    SET status = 'passed', updated_at = now()
    WHERE auction_show_id = p_show_id AND status = 'live' AND id != p_lot_id;
  END IF;

  UPDATE auction_lots
  SET status = v_new_status,
      current_highest_bid = CASE WHEN v_new_status = 'live' THEN NULL ELSE current_highest_bid END,
      current_highest_bidder_id = CASE WHEN v_new_status = 'live' THEN NULL ELSE current_highest_bidder_id END,
      countdown_end_at = CASE WHEN v_new_status = 'live'
        THEN now() + (GREATEST(10, p_countdown_seconds) || ' seconds')::INTERVAL ELSE countdown_end_at END,
      updated_at = now()
  WHERE id = p_lot_id;

  UPDATE auction_shows SET current_lot_id = CASE WHEN v_new_status = 'live' THEN p_lot_id ELSE current_lot_id END,
    updated_at = now() WHERE id = p_show_id;

  PERFORM pg_notify('auction:' || p_show_id::TEXT, jsonb_build_object(
    'event', 'lot_' || p_action, 'lot_id', p_lot_id, 'status', v_new_status
  )::TEXT);

  RETURN jsonb_build_object('success', true, 'status', v_new_status, 'lot_id', p_lot_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.2 Atomic, idempotent Sold.
CREATE OR REPLACE FUNCTION mark_lot_sold(
  p_lot_id UUID,
  p_expected_bidder_id UUID DEFAULT NULL,
  p_expected_amount BIGINT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_lot auction_lots%ROWTYPE;
  v_show auction_shows%ROWTYPE;
  v_order auction_orders%ROWTYPE;
  v_winner UUID;
  v_amount BIGINT;
  v_sold_at TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_lot FROM auction_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lot not found');
  END IF;
  IF NOT is_show_auctioneer(v_lot.auction_show_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized for this show');
  END IF;
  IF v_lot.status = 'sold' THEN
    -- Idempotent: return existing order.
    SELECT * INTO v_order FROM auction_orders WHERE lot_id = p_lot_id LIMIT 1;
    RETURN jsonb_build_object('success', true, 'already_sold', true, 'order', row_to_json(v_order)::JSONB,
      'winner_user_id', v_lot.winner_user_id, 'final_bid', v_lot.final_bid);
  END IF;

  -- Server-authoritative winner/amount.
  v_winner := v_lot.current_highest_bidder_id;
  v_amount := COALESCE(v_lot.current_highest_bid, v_lot.starting_bid, 0);

  -- If client provided values, they must match the server state.
  IF (p_expected_bidder_id IS NOT NULL AND p_expected_bidder_id IS DISTINCT FROM v_winner)
     OR (p_expected_amount IS NOT NULL AND p_expected_amount IS DISTINCT FROM v_amount) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Provided winner/amount does not match server bid state');
  END IF;
  -- Unsold lots with no bidder cannot be "sold" with a winner.
  IF v_winner IS NULL AND v_lot.status = 'live' THEN
    RETURN jsonb_build_object('success', false, 'error', 'No winning bidder for this lot');
  END IF;

  v_sold_at := now();

  UPDATE auction_lots
  SET status = 'sold',
      sold_at = v_sold_at,
      winner_user_id = v_winner,
      final_bid = v_amount,
      updated_at = now()
  WHERE id = p_lot_id;

  -- The create_order_on_sale trigger has now created the order + win atomically.
  SELECT * INTO v_order FROM auction_orders WHERE lot_id = p_lot_id ORDER BY created_at DESC LIMIT 1;

  IF v_order.id IS NOT NULL THEN
    UPDATE auction_orders
    SET shipping_information_status = 'awaiting_shipping_information',
        shipping_deadline = v_sold_at + interval '10 minutes',
        cancellation_at = v_sold_at + interval '11 minutes',
        updated_at = now()
    WHERE id = v_order.id;

    UPDATE auction_wins
    SET shipping_information_status = 'awaiting_shipping_information',
        shipping_deadline = v_sold_at + interval '10 minutes',
        cancellation_at = v_sold_at + interval '11 minutes'
    WHERE id = v_order.id OR lot_id = p_lot_id;
  END IF;

  PERFORM safe_notify_user(v_winner, 'You won an auction item!',
    'Lot ' || COALESCE(v_lot.lot_number, '') || ' — submit shipping info within 10 minutes.',
    '/my-orders');
  PERFORM pg_notify('auction:' || v_lot.auction_show_id::TEXT, jsonb_build_object(
    'event', 'lot_sold', 'lot_id', p_lot_id, 'order_id', v_order.id, 'winner', v_winner
  )::TEXT);

  RETURN jsonb_build_object('success', true, 'order', row_to_json(v_order)::JSONB,
    'winner_user_id', v_winner, 'final_bid', v_amount, 'sold_at', v_sold_at);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.3 Submit shipping information (creates immutable snapshot; stops cancellation).
CREATE OR REPLACE FUNCTION submit_shipping_information(
  p_order_id UUID,
  p_address JSONB,
  p_is_local_pickup BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_order auction_orders%ROWTYPE;
  v_snap_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_order FROM auction_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  IF v_order.winner_user_id != v_user AND NOT is_admin(v_user) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not your order');
  END IF;

  -- Transaction-safe: recheck before committing.
  IF v_order.shipping_information_status != 'awaiting_shipping_information' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shipping already submitted or order cancelled');
  END IF;

  INSERT INTO auction_order_address_snapshots (
    order_id, source_address_id, label, full_legal_name, street_address, apt_unit,
    city, state, zip, country, phone, email, delivery_instructions, is_local_pickup
  ) VALUES (
    p_order_id,
    NULLIF(p_address->>'source_address_id', '')::UUID,
    COALESCE(p_address->>'label', 'Shipping'),
    p_address->>'full_legal_name',
    p_address->>'street_address',
    p_address->>'apt_unit',
    p_address->>'city',
    p_address->>'state',
    p_address->>'zip',
    COALESCE(p_address->>'country', 'US'),
    p_address->>'phone',
    p_address->>'email',
    p_address->>'delivery_instructions',
    p_is_local_pickup
  ) RETURNING id INTO v_snap_id;

  UPDATE auction_orders
  SET shipping_information_status = CASE WHEN p_is_local_pickup THEN 'pickup_ready' ELSE 'shipping_information_received' END,
      shipping_submitted_at = now(),
      snapshot_address_id = v_snap_id,
      updated_at = now()
  WHERE id = p_order_id;

  -- Mirror to auction_wins.
  UPDATE auction_wins
  SET shipping_information_status = CASE WHEN p_is_local_pickup THEN 'pickup_ready' ELSE 'shipping_information_received' END,
      shipping_submitted_at = now()
  WHERE id = v_order.id OR lot_id = v_order.lot_id;

  PERFORM pg_notify('auction:' || v_order.auction_show_id::TEXT, jsonb_build_object(
    'event', 'shipping_submitted', 'order_id', p_order_id
  )::TEXT);

  RETURN jsonb_build_object('success', true, 'snapshot_id', v_snap_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.4 Mark shipped (carrier required; tracking required unless local).
CREATE OR REPLACE FUNCTION mark_order_shipped(
  p_order_id UUID,
  p_carrier_code TEXT,
  p_carrier_name TEXT DEFAULT NULL,
  p_tracking_number TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_order auction_orders%ROWTYPE;
  v_is_local BOOLEAN;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;
  SELECT * INTO v_order FROM auction_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  IF NOT is_show_auctioneer(v_order.auction_show_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  v_is_local := p_carrier_code IN ('local_pickup', 'local_delivery');
  IF p_carrier_code IS NULL OR p_carrier_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carrier is required');
  END IF;
  IF NOT v_is_local AND (p_tracking_number IS NULL OR p_tracking_number = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tracking number is required');
  END IF;

  UPDATE auction_orders
  SET carrier_code = p_carrier_code,
      carrier_name = COALESCE(p_carrier_name, p_carrier_code),
      tracking_number = CASE WHEN v_is_local THEN NULL ELSE p_tracking_number END,
      notes = COALESCE(p_note, notes),
      marked_shipped_by = v_user,
      shipped_at = now(),
      shipping_information_status = CASE WHEN v_is_local THEN 'pickup_ready' ELSE 'shipped' END,
      fulfillment_status = CASE WHEN v_is_local THEN 'ready_to_ship' ELSE 'shipped' END,
      updated_at = now()
  WHERE id = p_order_id;

  UPDATE auction_wins
  SET carrier_code = p_carrier_code, carrier_name = COALESCE(p_carrier_name, p_carrier_code),
      shipping_information_status = CASE WHEN v_is_local THEN 'pickup_ready' ELSE 'shipped' END
  WHERE id = v_order.id OR lot_id = v_order.lot_id;

  PERFORM safe_notify_user(v_order.winner_user_id, 'Your order shipped',
    'Order ' || v_order.order_number || ' is on the way.', '/my-orders');
  PERFORM pg_notify('auction:' || v_order.auction_show_id::TEXT, jsonb_build_object(
    'event', 'order_shipped', 'order_id', p_order_id
  )::TEXT);

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.5 Bidder confirms receipt / reports issue.
CREATE OR REPLACE FUNCTION confirm_delivery(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE v_user UUID := auth.uid(); v_order auction_orders%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required'); END IF;
  SELECT * INTO v_order FROM auction_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;
  IF v_order.winner_user_id != v_user THEN RETURN jsonb_build_object('success', false, 'error', 'Not your order'); END IF;

  UPDATE auction_orders
  SET bidder_received_at = now(), shipping_information_status = 'bidder_confirmed_received',
      fulfillment_status = 'delivered', completed_at = now(), updated_at = now()
  WHERE id = p_order_id;
  UPDATE auction_wins SET bidder_received_at = now(), shipping_information_status = 'bidder_confirmed_received'
  WHERE id = v_order.id OR lot_id = v_order.lot_id;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION report_shipping_issue(p_order_id UUID, p_note TEXT)
RETURNS JSONB AS $$
DECLARE v_user UUID := auth.uid(); v_order auction_orders%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required'); END IF;
  SELECT * INTO v_order FROM auction_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;
  IF v_order.winner_user_id != v_user THEN RETURN jsonb_build_object('success', false, 'error', 'Not your order'); END IF;

  UPDATE auction_orders
  SET shipping_information_status = 'shipping_issue', shipping_issue_note = p_note, updated_at = now()
  WHERE id = p_order_id;
  PERFORM safe_notify_user(
    (SELECT ap.user_id FROM auction_shows s JOIN auctioneer_profiles ap ON ap.id = s.auctioneer_id WHERE s.id = v_order.auction_show_id),
    'Shipping issue reported', 'Order ' || v_order.order_number, '/auctions/orders');
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.6 Idempotent 10% cancellation fee (integer Troll Coin math).
CREATE OR REPLACE FUNCTION create_cancellation_fee(
  p_order_id UUID, p_event_id UUID, p_winning_bid_coins BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_fee BIGINT;
  v_order auction_orders%ROWTYPE;
  v_spend JSONB;
  v_collection_source TEXT := 'wallet';
BEGIN
  -- Idempotency: unique (order_id, fee_type, cancellation_event_id).
  IF EXISTS (
    SELECT 1 FROM auction_cancellation_fees
    WHERE order_id = p_order_id AND fee_type = 'shipping_timeout' AND cancellation_event_id = p_event_id
  ) THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  -- fee = round(winning * 10 / 100) using numeric to avoid float drift.
  v_fee := (NULLIF(p_winning_bid_coins, 0) * 10 / 100)::NUMERIC(20,2);
  v_fee := ROUND(v_fee);

  SELECT * INTO v_order FROM auction_orders WHERE id = p_order_id;

  BEGIN
    SELECT public.troll_bank_spend_coins_secure(
      p_user_id := v_order.winner_user_id,
      p_amount := v_fee::int,
      p_bucket := 'paid',
      p_source := 'auction_cancellation_fee',
      p_ref_id := p_order_id::text,
      p_metadata := jsonb_build_object('order_id', p_order_id, 'event', p_event_id)
    ) INTO v_spend;

    IF (v_spend->>'success') = 'true' THEN
      v_collection_source := 'wallet';
      INSERT INTO auction_cancellation_fees (
        order_id, lot_id, winner_user_id, fee_type, cancellation_event_id,
        winning_bid_coins, fee_coins, fee_percentage, collection_source,
        collection_status, amount_collected_coins, amount_owed_coins, processed_at
      ) VALUES (
        p_order_id, v_order.lot_id, v_order.winner_user_id, 'shipping_timeout', p_event_id,
        p_winning_bid_coins, v_fee, 10, v_collection_source,
        'collected', v_fee, 0, now()
      );
    ELSE
      v_collection_source := 'owed';
      INSERT INTO auction_cancellation_fees (
        order_id, lot_id, winner_user_id, fee_type, cancellation_event_id,
        winning_bid_coins, fee_coins, fee_percentage, collection_source,
        collection_status, amount_collected_coins, amount_owed_coins
      ) VALUES (
        p_order_id, v_order.lot_id, v_order.winner_user_id, 'shipping_timeout', p_event_id,
        p_winning_bid_coins, v_fee, 10, 'owed',
        'owed', 0, v_fee
      );
    END IF;
  EXCEPTION WHEN others THEN
    INSERT INTO auction_cancellation_fees (
      order_id, lot_id, winner_user_id, fee_type, cancellation_event_id,
      winning_bid_coins, fee_coins, fee_percentage, collection_source,
      collection_status, amount_collected_coins, amount_owed_coins, failure_reason
    ) VALUES (
      p_order_id, v_order.lot_id, v_order.winner_user_id, 'shipping_timeout', p_event_id,
      p_winning_bid_coins, v_fee, 10, 'owed',
      'owed', 0, v_fee, SQLERRM
    );
  END;

  RETURN jsonb_build_object('success', true, 'fee_coins', v_fee, 'collection_source', v_collection_source);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.7 Backend timeout cancellation processor (run by pg_cron every minute).
CREATE OR REPLACE FUNCTION process_auction_cancellations()
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_event UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_order IN
    SELECT o.* FROM auction_orders o
    WHERE o.shipping_information_status = 'awaiting_shipping_information'
      AND o.cancellation_at <= now()
      AND o.snapshot_address_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM auction_cancellation_fees f
        WHERE f.order_id = o.id AND f.fee_type = 'shipping_timeout'
      )
    FOR UPDATE
  LOOP
    v_event := gen_random_uuid();

    -- Set timeout status (fee amount is computed inside create_cancellation_fee).
    UPDATE auction_orders
    SET shipping_information_status = 'cancelled_timeout',
        cancellation_fee_status = 'owed',
        updated_at = now()
    WHERE id = v_order.id;

    PERFORM create_cancellation_fee(v_order.id, v_event,
      COALESCE(v_order.sale_amount, 0));

    PERFORM safe_notify_user(v_order.winner_user_id,
      'Auction order cancelled', 'Order ' || v_order.order_number || ' was cancelled for missing shipping info. A 10% fee applies.', '/my-orders');
    PERFORM safe_notify_user(
      (SELECT ap.user_id FROM auction_shows s JOIN auctioneer_profiles ap ON ap.id = s.auctioneer_id WHERE s.id = v_order.auction_show_id),
      'Order cancelled (no shipping)', 'Order ' || v_order.order_number, '/auctions/orders');

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'cancelled', v_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.8 Saved addresses (owner-only).
CREATE OR REPLACE FUNCTION upsert_saved_address(p_address JSONB)
RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required'); END IF;

  IF (p_address->>'id') IS NOT NULL AND (p_address->>'id') <> '' THEN
    v_id := (p_address->>'id')::UUID;
    UPDATE user_saved_addresses
    SET label=COALESCE(p_address->>'label',label), full_legal_name=p_address->>'full_legal_name',
        street_address=p_address->>'street_address', apt_unit=p_address->>'apt_unit', city=p_address->>'city',
        state=p_address->>'state', zip=p_address->>'zip', country=COALESCE(p_address->>'country','US'),
        phone=p_address->>'phone', email=p_address->>'email', delivery_instructions=p_address->>'delivery_instructions',
        is_default=COALESCE((p_address->>'is_default')::BOOLEAN, is_default), updated_at=now()
    WHERE id=v_id AND user_id=v_user;
  ELSE
    INSERT INTO user_saved_addresses (user_id, label, full_legal_name, street_address, apt_unit, city, state, zip, country, phone, email, delivery_instructions, is_default)
    VALUES (v_user, COALESCE(p_address->>'label','Home'), p_address->>'full_legal_name', p_address->>'street_address', p_address->>'apt_unit',
      p_address->>'city', p_address->>'state', p_address->>'zip', COALESCE(p_address->>'country','US'), p_address->>'phone', p_address->>'email',
      p_address->>'delivery_instructions', COALESCE((p_address->>'is_default')::BOOLEAN, false))
    RETURNING id INTO v_id;
  END IF;

  IF (p_address->>'is_default')::BOOLEAN THEN
    UPDATE user_saved_addresses SET is_default=false WHERE user_id=v_user AND id<>v_id;
    UPDATE user_saved_addresses SET is_default=true WHERE id=v_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'id', v_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION delete_saved_address(p_id UUID)
RETURNS JSONB AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required'); END IF;
  DELETE FROM user_saved_addresses WHERE id=p_id AND user_id=v_user;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_default_address(p_id UUID)
RETURNS JSONB AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required'); END IF;
  UPDATE user_saved_addresses SET is_default=false WHERE user_id=v_user;
  UPDATE user_saved_addresses SET is_default=true, updated_at=now() WHERE id=p_id AND user_id=v_user;
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.9 Batch carrier/tracking for multiple orders won by same bidder.
CREATE OR REPLACE FUNCTION apply_batch_carrier(
  p_order_ids UUID[], p_carrier_code TEXT, p_carrier_name TEXT DEFAULT NULL, p_tracking_number TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user UUID := auth.uid();
  v_order auction_orders%ROWTYPE;
  v_is_local BOOLEAN;
  v_n INTEGER := 0;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Authentication required'); END IF;
  v_is_local := p_carrier_code IN ('local_pickup','local_delivery');
  IF p_carrier_code IS NULL OR p_carrier_code = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Carrier is required');
  END IF;
  IF NOT v_is_local AND (p_tracking_number IS NULL OR p_tracking_number = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tracking number is required');
  END IF;

  FOREACH v_order IN ARRAY (SELECT array_agg(o) FROM auction_orders o WHERE o.id = ANY(p_order_ids) AND is_show_auctioneer(o.auction_show_id))
  LOOP
    UPDATE auction_orders
    SET carrier_code=p_carrier_code, carrier_name=COALESCE(p_carrier_name,p_carrier_code),
        tracking_number=CASE WHEN v_is_local THEN NULL ELSE p_tracking_number END,
        marked_shipped_by=v_user, shipped_at=now(),
        shipping_information_status=CASE WHEN v_is_local THEN 'pickup_ready' ELSE 'shipped' END,
        fulfillment_status=CASE WHEN v_is_local THEN 'ready_to_ship' ELSE 'shipped' END,
        updated_at=now()
    WHERE id=v_order.id;
    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated', v_n);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.10 Eligibility helper: unpaid auction fee blocks bidding.
CREATE OR REPLACE FUNCTION has_unpaid_auction_fee(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM auction_cancellation_fees
    WHERE winner_user_id = p_user_id AND collection_status = 'owed' AND amount_owed_coins > 0
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- NOTE: to fully enforce, extend user_can_bid to also return allowed=false when
-- has_unpaid_auction_fee(auth.uid()) is true. See change report.

-- Grants
GRANT EXECUTE ON FUNCTION auction_lot_action(UUID,UUID,TEXT,INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_lot_sold(UUID,UUID,BIGINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION submit_shipping_information(UUID,JSONB,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_order_shipped(UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_delivery(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION report_shipping_issue(UUID,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_cancellation_fee(UUID,UUID,BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION process_auction_cancellations() TO service_role;
GRANT EXECUTE ON FUNCTION upsert_saved_address(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_saved_address(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION set_default_address(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_batch_carrier(UUID[],TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION has_unpaid_auction_fee(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_show_auctioneer(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION generate_lot_barcode(UUID) TO authenticated, service_role;

-- 5.11 Schedule backend timeout processor (guarded).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_cron' AND installed_version IS NOT NULL) THEN
    PERFORM cron.schedule('process_auction_cancellations', '* * * * *', 'SELECT public.process_auction_cancellations()');
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

-- __END__

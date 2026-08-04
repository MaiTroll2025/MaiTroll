-- ============================================================================
-- Migration: repair_auction_backend
-- Ensures all auction system tables and columns exist for frontend pages
-- Applied: 2026-07-30
-- ============================================================================

-- ============================================================================
-- 1. Auction shows: add missing columns
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN category text DEFAULT 'general';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN thumbnail_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN status text DEFAULT 'draft'
      CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'current_lot_id'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN current_lot_id uuid;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'scheduled_for'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN scheduled_for timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'ended_at'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN ended_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'auctioneer_id'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN auctioneer_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'livekit_room_name'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN livekit_room_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_shows' AND column_name = 'display_text'
  ) THEN
    ALTER TABLE public.auction_shows ADD COLUMN display_text text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'auction_shows' AND constraint_name = 'auction_shows_status_check'
  ) THEN
    ALTER TABLE public.auction_shows ADD CONSTRAINT auction_shows_status_check
      CHECK (status IN ('draft', 'scheduled', 'live', 'ended', 'cancelled'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auction_shows_status ON public.auction_shows(status);
CREATE INDEX IF NOT EXISTS idx_auction_shows_auctioneer_id ON public.auction_shows(auctioneer_id);
CREATE INDEX IF NOT EXISTS idx_auction_shows_current_lot_id ON public.auction_shows(current_lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_shows_scheduled_for ON public.auction_shows(scheduled_for);

-- ============================================================================
-- 2. Auction lots: ensure table exists and add missing columns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lot_number TEXT,
  barcode TEXT,
  item_number TEXT,
  starting_bid NUMERIC DEFAULT 0,
  current_highest_bid NUMERIC,
  image_url TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'live', 'ended', 'sold', 'cancelled')),
  queue_position INTEGER DEFAULT 0,
  countdown_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view auction lots"
  ON public.auction_lots FOR SELECT
  USING (status IN ('pending', 'live', 'ended', 'sold'));

CREATE POLICY "Auctioneer can insert lots"
  ON public.auction_lots FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_show_id AND auctioneer_id = auth.uid()
  ));

CREATE POLICY "Auctioneer can update own lots"
  ON public.auction_lots FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_show_id AND auctioneer_id = auth.uid()
  ));

CREATE POLICY "Auctioneer can delete own lots"
  ON public.auction_lots FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_show_id AND auctioneer_id = auth.uid()
  ));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'reserve_price'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN reserve_price numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'bid_increment'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN bid_increment numeric DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'buy_now_price'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN buy_now_price numeric;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'shipping_base_price'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN shipping_base_price numeric DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'shipping_method'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN shipping_method text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'condition'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN condition text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN quantity integer DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'quantity_total'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN quantity_total integer DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'quantity_available'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN quantity_available integer DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'winner_user_id'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN winner_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'final_bid'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN final_bid numeric;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'sold_at'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN sold_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'status_extended'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN status_extended text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'sku'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN sku text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'order_index'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN order_index integer DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_lots' AND column_name = 'image_urls'
  ) THEN
    ALTER TABLE public.auction_lots ADD COLUMN image_urls text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auction_lots_show_id ON public.auction_lots(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_lots_status ON public.auction_lots(status);
CREATE INDEX IF NOT EXISTS idx_auction_lots_queue_position ON public.auction_lots(queue_position);
CREATE INDEX IF NOT EXISTS idx_auction_lots_winner ON public.auction_lots(winner_user_id);

-- ============================================================================
-- 3. Auction orders: ensure table exists (must come before auction_wins which references it)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES public.auction_lots(id) ON DELETE SET NULL,
  winner_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  auctioneer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  order_number TEXT UNIQUE,
  sale_amount NUMERIC DEFAULT 0,
  shipping_cost NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'held', 'paid', 'refunded', 'disputed', 'failed')),
  fulfillment_status TEXT DEFAULT 'pending'
    CHECK (fulfillment_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  batch_id UUID,
  shipping_name TEXT,
  shipping_line1 TEXT,
  shipping_line2 TEXT,
  shipping_city TEXT,
  shipping_state TEXT,
  shipping_zip TEXT,
  shipping_carrier TEXT,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Winner can view own orders"
  ON public.auction_orders FOR SELECT
  USING (auth.uid() = winner_user_id);

CREATE POLICY "Auctioneer can view show orders"
  ON public.auction_orders FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_show_id AND auctioneer_id = auth.uid()
  ));

CREATE POLICY "Auctioneer can insert orders"
  ON public.auction_orders FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_show_id AND auctioneer_id = auth.uid()
  ));

CREATE POLICY "Auctioneer can update own orders"
  ON public.auction_orders FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_show_id AND auctioneer_id = auth.uid()
  ));

-- ============================================================================
-- 4. Auction wins table: ensure it exists with proper columns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_wins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  winner_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  winning_bid numeric NOT NULL,
  payment_status text DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'refunded', 'disputed')),
  order_id uuid REFERENCES public.auction_orders(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lot_id)
);

ALTER TABLE public.auction_wins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Winner can view own wins"
  ON public.auction_wins FOR SELECT
  USING (auth.uid() = winner_user_id);

CREATE POLICY "Auctioneer can view show wins"
  ON public.auction_wins FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = show_id AND auctioneer_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_auction_wins_winner ON public.auction_wins(winner_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_wins_show ON public.auction_wins(show_id);

-- ============================================================================
-- 5. Auction orders: add missing columns
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_orders' AND column_name = 'winner_username'
  ) THEN
    ALTER TABLE public.auction_orders ADD COLUMN winner_username text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_orders' AND column_name = 'show_title'
  ) THEN
    ALTER TABLE public.auction_orders ADD COLUMN show_title text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_orders' AND column_name = 'lot_title'
  ) THEN
    ALTER TABLE public.auction_orders ADD COLUMN lot_title text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_orders' AND column_name = 'cancellation_fee_coins'
  ) THEN
    ALTER TABLE public.auction_orders ADD COLUMN cancellation_fee_coins integer DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_orders' AND column_name = 'cancellation_fee_status'
  ) THEN
    ALTER TABLE public.auction_orders ADD COLUMN cancellation_fee_status text DEFAULT 'none'
      CHECK (cancellation_fee_status IN ('none', 'pending', 'charged', 'waived'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auction_orders_show_id ON public.auction_orders(auction_show_id);
CREATE INDEX IF NOT EXISTS idx_auction_orders_winner ON public.auction_orders(winner_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_orders_status ON public.auction_orders(payment_status, fulfillment_status);

-- ============================================================================
-- 5. Auction reports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reporter_role text,
  reported_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  auction_show_id UUID REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES public.auction_lots(id) ON DELETE CASCADE,
  reason text NOT NULL,
  notes text,
  status text DEFAULT 'open'
    CHECK (status IN ('open', 'reviewed', 'resolved', 'dismissed')),
  resolution_notes text,
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter can view own reports"
  ON public.auction_reports FOR SELECT
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports"
  ON public.auction_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR is_troll_officer)));

CREATE POLICY "Admins can update reports"
  ON public.auction_reports FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin OR is_troll_officer)));

CREATE INDEX IF NOT EXISTS idx_auction_reports_reporter ON public.auction_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_auction_reports_status ON public.auction_reports(status);

-- ============================================================================
-- 6. Auction devices table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_type text DEFAULT 'scanner',
  device_brand text,
  connection_type text DEFAULT 'bluetooth',
  device_id text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  last_connected_at timestamptz,
  last_error text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own devices"
  ON public.auction_devices FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices"
  ON public.auction_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices"
  ON public.auction_devices FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own devices"
  ON public.auction_devices FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_auction_devices_user_id ON public.auction_devices(user_id);

-- ============================================================================
-- 7. Auction device sessions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auctioneer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  device_id UUID REFERENCES public.auction_devices(id) ON DELETE SET NULL,
  pairing_code text NOT NULL UNIQUE,
  session_token text,
  status text DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'completed', 'expired')),
  device_name text,
  connected_at timestamptz,
  last_seen_at timestamptz,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_device_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auctioneer can view own sessions"
  ON public.auction_device_sessions FOR SELECT
  USING (auth.uid() = auctioneer_id);

CREATE POLICY "Auctioneer can insert own sessions"
  ON public.auction_device_sessions FOR INSERT
  WITH CHECK (auth.uid() = auctioneer_id);

CREATE POLICY "Auctioneer can update own sessions"
  ON public.auction_device_sessions FOR UPDATE
  USING (auth.uid() = auctioneer_id);

CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_auctioneer_id ON public.auction_device_sessions(auctioneer_id);
CREATE INDEX IF NOT EXISTS idx_auction_device_sessions_pairing_code ON public.auction_device_sessions(pairing_code);

-- ============================================================================
-- 8. Auction scan events table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  device_session_id UUID REFERENCES public.auction_device_sessions(id) ON DELETE SET NULL,
  barcode text NOT NULL,
  barcode_type text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_scan_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auctioneer can view scan events for own auctions"
  ON public.auction_scan_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.auction_shows
    WHERE id = auction_id AND auctioneer_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_auction_scan_events_auction_id ON public.auction_scan_events(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_scan_events_barcode ON public.auction_scan_events(barcode);

-- ============================================================================
-- 9. Auction presence table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.auction_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_show_id UUID NOT NULL REFERENCES public.auction_shows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  presence_role TEXT DEFAULT 'bidder'
    CHECK (presence_role IN ('auctioneer', 'bidder', 'observer')),
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view presence for shows they participate in"
  ON public.auction_presence FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.auction_shows
      WHERE id = auction_show_id AND auctioneer_id = auth.uid()
    )
  );

CREATE POLICY "Users can upsert own presence"
  ON public.auction_presence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presence"
  ON public.auction_presence FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_auction_presence_show_user ON public.auction_presence(auction_show_id, user_id);
CREATE INDEX IF NOT EXISTS idx_auction_presence_is_active ON public.auction_presence(is_active);
CREATE INDEX IF NOT EXISTS idx_auction_presence_last_seen ON public.auction_presence(last_seen);

-- ============================================================================
-- 10. Auction bids table: ensure columns exist
-- ============================================================================

-- Add missing columns to existing auction_bids table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_bids' AND column_name = 'auction_show_id'
  ) THEN
    ALTER TABLE public.auction_bids ADD COLUMN auction_show_id UUID REFERENCES public.auction_shows(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_bids' AND column_name = 'lot_id'
  ) THEN
    ALTER TABLE public.auction_bids ADD COLUMN lot_id UUID REFERENCES public.auction_lots(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_bids' AND column_name = 'bid_amount'
  ) THEN
    ALTER TABLE public.auction_bids ADD COLUMN bid_amount NUMERIC;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auction_bids' AND column_name = 'is_boosted'
  ) THEN
    ALTER TABLE public.auction_bids ADD COLUMN is_boosted BOOLEAN DEFAULT false;
  END IF;
END $$;

ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view auction bids"
  ON public.auction_bids FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own bids"
  ON public.auction_bids FOR INSERT
  WITH CHECK (auth.uid() = bidder_user_id);

CREATE INDEX IF NOT EXISTS idx_auction_bids_lot_id ON public.auction_bids(lot_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON public.auction_bids(bidder_user_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_created_at ON public.auction_bids(created_at DESC);

-- ============================================================================
-- 11. Auction watchlist table: ensure RLS and indexes
-- ============================================================================

ALTER TABLE public.auction_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own watchlist"
  ON public.auction_watchlist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watchlist items"
  ON public.auction_watchlist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own watchlist items"
  ON public.auction_watchlist FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_auction_watchlist_user_id ON public.auction_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_auction_watchlist_auction_show_id ON public.auction_watchlist(auction_show_id);
-- Live Commerce System Migration
-- Comprehensive tables for pinned products, orders, escrow, and shipping

BEGIN;

-- ==========================================
-- BROADCAST PINNED PRODUCTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.broadcast_pinned_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 1
);

-- Index for efficient queries
CREATE INDEX idx_broadcast_pinned_products_stream ON public.broadcast_pinned_products(stream_id);
CREATE INDEX idx_broadcast_pinned_products_active ON public.broadcast_pinned_products(stream_id, is_active);

-- ==========================================
-- SHOP ORDERS (ESCROW SYSTEM)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.shop_orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_number TEXT UNIQUE NOT NULL,
    buyer_id UUID NOT NULL REFERENCES public.profiles(id),
    seller_id UUID NOT NULL REFERENCES public.profiles(id),
    shop_id UUID NOT NULL REFERENCES public.Mai Troll_shops(id),
    
    -- Order Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
        'pending', 'paid', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
    )),
    
    -- Pricing
    subtotal INTEGER NOT NULL, -- in coins
    shipping_cost INTEGER DEFAULT 0,
    total_coins INTEGER NOT NULL,
    
    -- Escrow Status
    escrow_status TEXT NOT NULL DEFAULT 'pending' CHECK (escrow_status IN (
        'pending', 'held', 'released', 'refunded'
    )),
    escrow_released_at TIMESTAMPTZ,
    
    -- Shipping
    shipping_name TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_zip TEXT,
    shipping_country TEXT DEFAULT 'US',
    tracking_number TEXT,
    carrier TEXT CHECK (carrier IN ('usps', 'ups', 'fedex', 'dhl', 'other')),
    tracking_url TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    estimated_delivery DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    paid_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    notes TEXT,
    metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_shop_orders_buyer ON public.shop_orders(buyer_id);
CREATE INDEX idx_shop_orders_seller ON public.shop_orders(seller_id);
CREATE INDEX idx_shop_orders_status ON public.shop_orders(status);
CREATE INDEX idx_shop_orders_escrow ON public.shop_orders(escrow_status);

-- ==========================================
-- ORDER ITEMS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.shop_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.shop_items(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price INTEGER NOT NULL, -- in coins
    total_price INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_order_items_order ON public.order_items(order_id);

-- ==========================================
-- WALLET ESCROW (RESERVED BALANCES)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.wallet_escrow (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    order_id UUID NOT NULL REFERENCES public.shop_orders(id),
    amount INTEGER NOT NULL, -- in coins
    status TEXT NOT NULL DEFAULT 'held' CHECK (status IN ('held', 'released', 'refunded')),
    created_at TIMESTAMPTZ DEFAULT now(),
    released_at TIMESTAMPTZ,
    
    UNIQUE(user_id, order_id)
);

CREATE INDEX idx_wallet_escrow_user ON public.wallet_escrow(user_id);
CREATE INDEX idx_wallet_escrow_order ON public.wallet_escrow(order_id);

-- ==========================================
-- SHIPPING CARRIERS REFERENCE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.shipping_carriers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tracking_url_template TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true
);

-- Insert default carriers
INSERT INTO public.shipping_carriers (id, name, tracking_url_template, is_active) VALUES
    ('usps', 'USPS', 'https://tools.usps.com/go/TrackConfirmAction?tLabels={tracking_number}', true),
    ('ups', 'UPS', 'https://www.ups.com/track?tracknum={tracking_number}', true),
    ('fedex', 'FedEx', 'https://www.fedex.com/fedextrack/?trknbr={tracking_number}', true),
    ('dhl', 'DHL', 'https://www.dhl.com/en/express/tracking.html?AWB={tracking_number}', true),
    ('other', 'Other', NULL, true)
ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================
ALTER TABLE public.broadcast_pinned_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_escrow ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- broadcast_pinned_products policies
CREATE POLICY "Anyone can read pinned products" ON public.broadcast_pinned_products
    FOR SELECT USING (true);

CREATE POLICY "Broadcasters can manage pinned products" ON public.broadcast_pinned_products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.streams 
            WHERE id = stream_id 
            AND user_id = auth.uid()
        )
    );

-- shop_orders policies
CREATE POLICY "Buyers can read their orders" ON public.shop_orders
    FOR SELECT USING (auth.uid() = buyer_id);

CREATE POLICY "Sellers can read their orders" ON public.shop_orders
    FOR SELECT USING (auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders" ON public.shop_orders
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update their orders" ON public.shop_orders
    FOR UPDATE USING (auth.uid() = seller_id);

-- order_items policies
CREATE POLICY "Anyone can read order items" ON public.order_items
    FOR SELECT USING (true);

CREATE POLICY "Sellers can manage order items" ON public.order_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.shop_orders so
            WHERE so.id = order_id AND so.seller_id = auth.uid()
        )
    );

-- wallet_escrow policies
CREATE POLICY "Users can read their escrow" ON public.wallet_escrow
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage escrow" ON public.wallet_escrow
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND troll_role IN ('admin', 'moderator'))
    );

-- shipping_carriers policies
CREATE POLICY "Anyone can read carriers" ON public.shipping_carriers
    FOR SELECT USING (true);

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Function to pin a product to a broadcast
CREATE OR REPLACE FUNCTION pin_product_to_broadcast(
    p_stream_id UUID,
    p_product_id UUID,
    p_pinned_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pinned_id UUID;
    v_existing_count INTEGER;
BEGIN
    -- Check if product exists and belongs to user
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_items si
        JOIN public.Mai Troll_shops ts ON ts.id = si.shop_id
        WHERE si.id = p_product_id AND ts.owner_id = p_pinned_by
    ) THEN
        RAISE EXCEPTION 'Product not found or does not belong to you';
    END IF;

    -- Check if already pinned
    SELECT id INTO v_pinned_id
    FROM public.broadcast_pinned_products
    WHERE stream_id = p_stream_id AND product_id = p_product_id AND is_active = true;

    IF v_pinned_id IS NOT NULL THEN
        RETURN v_pinned_id;
    END IF;

    -- Get current pinned count
    SELECT COUNT(*) INTO v_existing_count
    FROM public.broadcast_pinned_products
    WHERE stream_id = p_stream_id AND is_active = true;

    -- Insert pinned product
    INSERT INTO public.broadcast_pinned_products (stream_id, product_id, pinned_by, position)
    VALUES (p_stream_id, p_product_id, p_pinned_by, v_existing_count + 1)
    RETURNING id INTO v_pinned_id;

    RETURN v_pinned_id;
END;
$$;

-- Function to unpin a product
CREATE OR REPLACE FUNCTION unpin_product_from_broadcast(
    p_stream_id UUID,
    p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.broadcast_pinned_products
    SET is_active = false
    WHERE stream_id = p_stream_id AND product_id = p_product_id AND is_active = true;

    RETURN FOUND;
END;
$$;

-- Function to create order with escrow
CREATE OR REPLACE FUNCTION create_order_with_escrow(
    p_buyer_id UUID,
    p_product_id UUID,
    p_quantity INTEGER DEFAULT 1,
    p_shipping_name TEXT,
    p_shipping_address TEXT,
    p_shipping_city TEXT,
    p_shipping_state TEXT,
    p_shipping_zip TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_product RECORD;
    v_shop RECORD;
    v_total_coins INTEGER;
    v_buyer_balance INTEGER;
    v_escrow_id UUID;
BEGIN
    -- Get product and shop info
    SELECT si.*, ts.id as shop_id, ts.owner_id as seller_id
    INTO v_product
    FROM public.shop_items si
    JOIN public.Mai Troll_shops ts ON ts.id = si.shop_id
    WHERE si.id = p_product_id;

    IF v_product IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    -- Check stock
    IF v_product.stock_quantity IS NOT NULL AND v_product.stock_quantity < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock';
    END IF;

    -- Get buyer balance
    SELECT COALESCE(coins, 0) INTO v_buyer_balance
    FROM public.profiles
    WHERE id = p_buyer_id;

    -- Calculate total
    v_total_coins := v_product.price * p_quantity;

    -- Check balance
    IF v_buyer_balance < v_total_coins THEN
        RAISE EXCEPTION 'Insufficient coins';
    END IF;

    -- Generate order number
    v_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LEFT(gen_random_uuid()::TEXT, 8);

    -- Deduct coins from buyer
    UPDATE public.profiles
    SET coins = coins - v_total_coins
    WHERE id = p_buyer_id;

    -- Create order
    INSERT INTO public.shop_orders (
        order_number, buyer_id, seller_id, shop_id,
        status, subtotal, total_coins, escrow_status,
        shipping_name, shipping_address, shipping_city,
        shipping_state, shipping_zip, paid_at
    ) VALUES (
        v_order_number, p_buyer_id, v_product.seller_id, v_product.shop_id,
        'paid', v_product.price * p_quantity, v_total_coins, 'held',
        p_shipping_name, p_shipping_address, p_shipping_city,
        p_shipping_state, p_shipping_zip, NOW()
    )
    RETURNING id INTO v_order_id;

    -- Create order item
    INSERT INTO public.order_items (order_id, product_id, quantity, unit_price, total_price)
    VALUES (v_order_id, p_product_id, p_quantity, v_product.price, v_total_coins);

    -- Reduce stock
    IF v_product.stock_quantity IS NOT NULL THEN
        UPDATE public.shop_items
        SET stock_quantity = stock_quantity - p_quantity
        WHERE id = p_product_id;
    END IF;

    -- Create escrow entry
    INSERT INTO public.wallet_escrow (user_id, order_id, amount, status)
    VALUES (v_product.seller_id, v_order_id, v_total_coins, 'held')
    RETURNING id INTO v_escrow_id;

    -- Log transaction
    INSERT INTO public.coin_transactions (user_id, coins, source, type, description)
    VALUES (
        p_buyer_id, 
        -v_total_coins, 
        'order_purchase', 
        'debit',
        v_order_number || ': Purchase ' || v_product.name || ' x' || p_quantity
    );

    -- Seller notification transaction
    INSERT INTO public.coin_transactions (user_id, coins, source, type, description)
    VALUES (
        v_product.seller_id, 
        v_total_coins, 
        'order_escrow', 
        'escrow_hold',
        v_order_number || ': Escrow hold for ' || v_product.name
    );

    RETURN v_order_id;
END;
$$;

-- Function to ship order
CREATE OR REPLACE FUNCTION ship_order(
    p_order_id UUID,
    p_tracking_number TEXT,
    p_carrier TEXT,
    p_seller_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tracking_url TEXT;
    v_carrier_template TEXT;
BEGIN
    -- Verify seller owns the order
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_orders
        WHERE id = p_order_id AND seller_id = p_seller_id AND status = 'paid'
    ) THEN
        RAISE EXCEPTION 'Order not found or not authorized';
    END IF;

    -- Get tracking URL template
    SELECT tracking_url_template INTO v_carrier_template
    FROM public.shipping_carriers
    WHERE id = p_carrier;

    -- Generate tracking URL
    IF v_carrier_template IS NOT NULL THEN
        v_tracking_url := REPLACE(v_carrier_template, '{tracking_number}', p_tracking_number);
    END IF;

    -- Update order
    UPDATE public.shop_orders
    SET status = 'shipped',
        tracking_number = p_tracking_number,
        carrier = p_carrier,
        tracking_url = v_tracking_url,
        shipped_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN FOUND;
END;
$$;

-- Function to confirm delivery
CREATE OR REPLACE FUNCTION confirm_delivery(
    p_order_id UUID,
    p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_escrow RECORD;
BEGIN
    -- Get order
    SELECT * INTO v_order
    FROM public.shop_orders
    WHERE id = p_order_id AND buyer_id = p_user_id AND status = 'shipped';

    IF v_order IS NULL THEN
        RAISE EXCEPTION 'Order not found or not authorized';
    END IF;

    -- Update order status
    UPDATE public.shop_orders
    SET status = 'completed',
        delivered_at = NOW(),
        completed_at = NOW(),
        escrow_status = 'released',
        escrow_released_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Release escrow
    UPDATE public.wallet_escrow
    SET status = 'released',
        released_at = NOW()
    WHERE order_id = p_order_id AND status = 'held';

    -- Move coins to seller available balance
    UPDATE public.profiles
    SET coins = coins + v_order.total_coins
    WHERE id = v_order.seller_id;

    -- Log transaction for seller
    INSERT INTO public.coin_transactions (user_id, coins, source, type, description)
    VALUES (
        v_order.seller_id,
        v_order.total_coins,
        'order_complete',
        'credit',
        v_order.order_number || ': Order completed - escrow released'
    );

    RETURN FOUND;
END;
$$;

-- Function to auto-confirm delivery (called by cron job)
CREATE OR REPLACE FUNCTION auto_confirm_delivery()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_orders_updated INTEGER := 0;
    v_order RECORD;
    v_escrow RECORD;
    v_order_id UUID;
BEGIN
    -- Find orders that are shipped and past 7 days
    FOR v_order IN
        SELECT * FROM public.shop_orders
        WHERE status = 'shipped'
        AND shipped_at < NOW() - INTERVAL '7 days'
        AND escrow_status = 'held'
    LOOP
        v_order_id := v_order.id;
        
        -- Update order status
        UPDATE public.shop_orders
        SET status = 'completed',
            delivered_at = NOW(),
            completed_at = NOW(),
            escrow_status = 'released',
            escrow_released_at = NOW(),
            updated_at = NOW()
        WHERE id = v_order_id;

        -- Release escrow
        UPDATE public.wallet_escrow
        SET status = 'released',
            released_at = NOW()
        WHERE order_id = v_order_id AND status = 'held';

        -- Move coins to seller
        UPDATE public.profiles
        SET coins = coins + v_order.total_coins
        WHERE id = v_order.seller_id;

        -- Log transaction
        INSERT INTO public.coin_transactions (user_id, coins, source, type, description)
        VALUES (
            v_order.seller_id,
            v_order.total_coins,
            'order_auto_complete',
            'credit',
            v_order.order_number || ': Auto-completed after 7 days'
        );

        v_orders_updated := v_orders_updated + 1;
    END LOOP;

    RETURN v_orders_updated;
END;
$$;

-- ==========================================
-- REALTIME SUBSCRIPTIONS
-- ==========================================

-- Enable realtime for pinned products
ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_pinned_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_escrow;

COMMIT;

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

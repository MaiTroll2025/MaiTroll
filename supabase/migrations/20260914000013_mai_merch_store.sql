-- Migration: MaiTroll Merch Store (isolated from MAI Business merchandise)
-- Separate from mai_business_merchandise_* tables. USD only (no coins).

BEGIN;

-- =========================================================================
-- Merchandise Products
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_merch_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    price_usd       NUMERIC(10,2) NOT NULL CHECK (price_usd >= 0),
    category        TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN ('bags', 'tshirts', 'mugs', 'water_bottles', 'hats', 'scarves', 'other')),
    image_url       TEXT,
    stock_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Merchandise Orders
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_merch_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_amount    NUMERIC(10,2) NOT NULL CHECK (total_amount >= 0),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    shipping_address JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Merchandise Order Items
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_merch_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES public.mai_merch_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES public.mai_merch_products(id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE public.mai_merch_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_merch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_merch_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read merch products" ON public.mai_merch_products;
CREATE POLICY "public read merch products"
  ON public.mai_merch_products FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "admins manage merch products" ON public.mai_merch_products;
CREATE POLICY "admins manage merch products"
  ON public.mai_merch_products FOR ALL USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "users view own merch orders" ON public.mai_merch_orders;
CREATE POLICY "users view own merch orders"
  ON public.mai_merch_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all merch orders" ON public.mai_merch_orders;
CREATE POLICY "admins read all merch orders"
  ON public.mai_merch_orders FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

DROP POLICY IF EXISTS "users can create merch orders" ON public.mai_merch_orders;
CREATE POLICY "users can create merch orders"
  ON public.mai_merch_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users view own merch order items" ON public.mai_merch_order_items;
CREATE POLICY "users view own merch order items"
  ON public.mai_merch_order_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.mai_merch_orders o WHERE o.id = mai_merch_order_items.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admins read all merch order items" ON public.mai_merch_order_items;
CREATE POLICY "admins read all merch order items"
  ON public.mai_merch_order_items FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =========================================================================
-- Indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_merch_products_category ON public.mai_merch_products(category);
CREATE INDEX IF NOT EXISTS idx_mai_merch_products_active ON public.mai_merch_products(is_active);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_user_id ON public.mai_merch_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_status ON public.mai_merch_orders(status);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_created_at ON public.mai_merch_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mai_merch_order_items_order ON public.mai_merch_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_order_items_product ON public.mai_merch_order_items(product_id);

-- =========================================================================
-- Updated-at triggers
-- =========================================================================
CREATE TRIGGER trg_mai_merch_products_updated
    BEFORE UPDATE ON public.mai_merch_products
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_merch_orders_updated
    BEFORE UPDATE ON public.mai_merch_orders
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

COMMIT;

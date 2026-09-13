-- Migration: MAI Business — Marketplace, Merchandise, Credit
-- Repurposes Auction → Marketplace. Adds merchandise store.
-- Existing auction infrastructure remains untouched.

BEGIN;

-- =========================================================================
-- Marketplace Listings (student-to-student commerce)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_marketplace_listings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    currency        TEXT NOT NULL DEFAULT 'usd' CHECK (currency IN ('usd', 'coins', 'troll_coins')),
    category        TEXT
                    CHECK (category IN ('general', 'textbooks', 'electronics', 'clothing', 'services', 'other')),
    condition       TEXT
                    CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'used')),
    image_urls      TEXT[],
    status          TEXT NOT NULL DEFAULT 'available'
                    CHECK (status IN ('available', 'sold', 'archived', 'removed')),
    is_local_pickup BOOLEAN NOT NULL DEFAULT false,
    location_hint   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sold_at         TIMESTAMPTZ
);

-- =========================================================================
-- Marketplace Orders
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_marketplace_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id      UUID NOT NULL REFERENCES public.mai_business_marketplace_listings(id),
    buyer_id        UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seller_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    price           NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'usd',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled', 'disputed', 'refunded')),
    payment_method  TEXT,
    shipping_address JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Merchandise Products (official MAiTROLL store)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_merchandise_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    price_usd       NUMERIC(10,2) NOT NULL,
    price_coins     BIGINT,
    category        TEXT NOT NULL
                    CHECK (category IN ('bags', 'tshirts', 'mugs', 'water_bottles', 'hats', 'scarves', 'other')),
    image_url       TEXT,
    stock_quantity  INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    is_college_specific BOOLEAN NOT NULL DEFAULT false,
    institution_id  UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Merchandise Orders
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_merchandise_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    total_amount    NUMERIC(10,2) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'usd',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
    shipping_address JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Merchandise Order Items
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_merchandise_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES public.mai_business_merchandise_orders(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES public.mai_business_merchandise_products(id),
    quantity        INTEGER NOT NULL CHECK (quantity > 0),
    unit_price      NUMERIC(10,2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- MAI Business Credit Accounts (reputation/credit system)
-- Separates credit score from troll coins and crystals.
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_credit_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    credit_score    INTEGER NOT NULL DEFAULT 650 CHECK (credit_score BETWEEN 300 AND 850),
    credit_limit    NUMERIC(12,2) DEFAULT 0,
    credit_used     NUMERIC(12,2) DEFAULT 0,
    Apr_fee_percent NUMERIC(5,2) DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'frozen', 'closed', 'delinquent')),
    score_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Credit Transactions (auditable ledger)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_credit_transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      UUID NOT NULL REFERENCES public.mai_business_credit_accounts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type            TEXT NOT NULL
                    CHECK (type IN ('score_update', 'limit_change', 'payment', 'fee', 'adjustment', 'education_bonus')),
    amount          NUMERIC(12,2) NOT NULL,
    description     TEXT,
    actor_id        UUID REFERENCES public.user_profiles(id),
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Student Recognition Requests
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_recognition_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id      UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    instructor_id   UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    recognition_type TEXT NOT NULL
                    CHECK (recognition_type IN ('mug', 'hat', 'scarf', 'shirt', 'notebook', 'water_bottle', 'other')),
    reason          TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'denied', 'fulfilled')),
    reviewed_by     UUID REFERENCES public.user_profiles(id),
    reviewed_at     TIMESTAMPTZ,
    decision_notes  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Weekly College Contribution Calculation Records
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_college_contributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start      DATE NOT NULL,
    week_end        DATE NOT NULL,
    institution_id  UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    calculation_rule TEXT,
    qualifying_revenue NUMERIC(12,2) NOT NULL,
    contribution_rate NUMERIC(5,4) NOT NULL DEFAULT 0.0500,
    contribution_amount NUMERIC(12,2) NOT NULL,
    is_approved     BOOLEAN NOT NULL DEFAULT false,
    approved_by     UUID REFERENCES public.user_profiles(id),
    approved_at     TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(week_start, institution_id)
);

-- =========================================================================
ALTER TABLE public.mai_business_marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_marketplace_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_merchandise_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_merchandise_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_merchandise_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_recognition_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read marketplace listings" ON public.mai_business_marketplace_listings;
CREATE POLICY "authenticated read marketplace listings"
  ON public.mai_business_marketplace_listings FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'available'
  );

DROP POLICY IF EXISTS "sellers manage own listings" ON public.mai_business_marketplace_listings;
CREATE POLICY "sellers manage own listings"
  ON public.mai_business_marketplace_listings FOR ALL USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "admins manage marketplace" ON public.mai_business_marketplace_listings;
CREATE POLICY "admins manage marketplace"
  ON public.mai_business_marketplace_listings FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users view own orders as buyer" ON public.mai_business_marketplace_orders;
CREATE POLICY "users view own orders as buyer"
  ON public.mai_business_marketplace_orders FOR SELECT USING (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "users view own orders as seller" ON public.mai_business_marketplace_orders;
CREATE POLICY "users view own orders as seller"
  ON public.mai_business_marketplace_orders FOR SELECT USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "admins read all orders" ON public.mai_business_marketplace_orders;
CREATE POLICY "admins read all orders"
  ON public.mai_business_marketplace_orders FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users can create orders" ON public.mai_business_marketplace_orders;
CREATE POLICY "users can create orders"
  ON public.mai_business_marketplace_orders FOR INSERT WITH CHECK (auth.uid() = buyer_id);

DROP POLICY IF EXISTS "public read merchandise products" ON public.mai_business_merchandise_products;
CREATE POLICY "public read merchandise products"
  ON public.mai_business_merchandise_products FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage merchandise products" ON public.mai_business_merchandise_products;
CREATE POLICY "admins manage merchandise products"
  ON public.mai_business_merchandise_products FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users view own merchandise orders" ON public.mai_business_merchandise_orders;
CREATE POLICY "users view own merchandise orders"
  ON public.mai_business_merchandise_orders FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all merchandise orders" ON public.mai_business_merchandise_orders;
CREATE POLICY "admins read all merchandise orders"
  ON public.mai_business_merchandise_orders FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users can create merchandise orders" ON public.mai_business_merchandise_orders;
CREATE POLICY "users can create merchandise orders"
  ON public.mai_business_merchandise_orders FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users view own order items" ON public.mai_business_merchandise_order_items;
CREATE POLICY "users view own order items"
  ON public.mai_business_merchandise_order_items FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.mai_business_merchandise_orders o
      WHERE o.id = mai_business_merchandise_order_items.order_id
        AND (
          o.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.user_profiles p
            WHERE p.id = auth.uid()
              AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
          )
        )
    )
  );

DROP POLICY IF EXISTS "users view own credit account" ON public.mai_business_credit_accounts;
CREATE POLICY "users view own credit account"
  ON public.mai_business_credit_accounts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all credit accounts" ON public.mai_business_credit_accounts;
CREATE POLICY "admins read all credit accounts"
  ON public.mai_business_credit_accounts FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "system manages credit accounts" ON public.mai_business_credit_accounts;
CREATE POLICY "system manages credit accounts"
  ON public.mai_business_credit_accounts FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users view own credit transactions" ON public.mai_business_credit_transactions;
CREATE POLICY "users view own credit transactions"
  ON public.mai_business_credit_transactions FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all credit transactions" ON public.mai_business_credit_transactions;
CREATE POLICY "admins read all credit transactions"
  ON public.mai_business_credit_transactions FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "system manages credit transactions" ON public.mai_business_credit_transactions;
CREATE POLICY "system manages credit transactions"
  ON public.mai_business_credit_transactions FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users view own recognition requests" ON public.mai_business_recognition_requests;
CREATE POLICY "users view own recognition requests"
  ON public.mai_business_recognition_requests FOR SELECT USING (
    auth.uid() = student_id OR auth.uid() = instructor_id
  );

DROP POLICY IF EXISTS "instructors can create recognition requests" ON public.mai_business_recognition_requests;
CREATE POLICY "instructors can create recognition requests"
  ON public.mai_business_recognition_requests FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
    AND auth.uid() = instructor_id
  );

DROP POLICY IF EXISTS "admins manage recognition requests" ON public.mai_business_recognition_requests;
CREATE POLICY "admins manage recognition requests"
  ON public.mai_business_recognition_requests FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "admins manage college contributions" ON public.mai_business_college_contributions;
CREATE POLICY "admins manage college contributions"
  ON public.mai_business_college_contributions FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

-- Updated triggers for new tables
-- =========================================================================
CREATE TRIGGER trg_mai_business_marketplace_listings_updated
    BEFORE UPDATE ON public.mai_business_marketplace_listings
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_marketplace_orders_updated
    BEFORE UPDATE ON public.mai_business_marketplace_orders
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_merchandise_products_updated
    BEFORE UPDATE ON public.mai_business_merchandise_products
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_merchandise_orders_updated
    BEFORE UPDATE ON public.mai_business_merchandise_orders
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_credit_accounts_updated
    BEFORE UPDATE ON public.mai_business_credit_accounts
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_recognition_requests_updated
    BEFORE UPDATE ON public.mai_business_recognition_requests
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();
CREATE TRIGGER trg_mai_business_college_contributions_updated
    BEFORE UPDATE ON public.mai_business_college_contributions
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

COMMIT;

-- Migration: Printify Merch System
-- Extends mai_merch tables for Printify integration and adds user_addresses table

BEGIN;

-- =========================================================================
-- User Saved Shipping Addresses
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.user_addresses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    label           TEXT, -- e.g. "Home", "Work", "Office"
    first_name      TEXT NOT NULL,
    last_name       TEXT NOT NULL,
    email           TEXT NOT NULL,
    phone           TEXT,
    address_line1   TEXT NOT NULL,
    address_line2   TEXT,
    city            TEXT NOT NULL,
    state           TEXT NOT NULL,
    postal_code     TEXT NOT NULL,
    country         TEXT NOT NULL DEFAULT 'US',
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Extend mai_merch_products for Printify
-- =========================================================================
ALTER TABLE public.mai_merch_products
    ADD COLUMN IF NOT EXISTS printify_product_id TEXT,
    ADD COLUMN IF NOT EXISTS printify_variant_id TEXT,
    ADD COLUMN IF NOT EXISTS printify_blueprint_id INTEGER,
    ADD COLUMN IF NOT EXISTS printify_provider TEXT,
    ADD COLUMN IF NOT EXISTS printify_status TEXT,
    ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- =========================================================================
-- Extend mai_merch_orders for Printify + PayPal
-- =========================================================================
ALTER TABLE public.mai_merch_orders
    ADD COLUMN IF NOT EXISTS order_number TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
    ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
    ADD COLUMN IF NOT EXISTS printify_order_id TEXT,
    ADD COLUMN IF NOT EXISTS printify_external_id TEXT,
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS shipping_amount NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(10,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS fulfillment_status TEXT,
    ADD COLUMN IF NOT EXISTS tracking_number TEXT,
    ADD COLUMN IF NOT EXISTS tracking_carrier TEXT,
    ADD COLUMN IF NOT EXISTS tracking_url TEXT,
    ADD COLUMN IF NOT EXISTS shipped_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS printify_error TEXT,
    ADD COLUMN IF NOT EXISTS customer_email TEXT;

-- Update status constraint to include new statuses
ALTER TABLE public.mai_merch_orders
    DROP CONSTRAINT IF EXISTS mai_merch_orders_status_check;
ALTER TABLE public.mai_merch_orders
    ADD CONSTRAINT mai_merch_orders_status_check CHECK (status IN (
        'pending', 'payment_pending', 'paypal_approved', 'paid',
        'printify_submission_pending', 'submitted_to_printify',
        'in_production', 'shipped', 'delivered',
        'cancelled', 'refunded', 'failed', 'printify_submission_failed'
    ));

-- =========================================================================
-- Extend mai_merch_order_items for Printify
-- =========================================================================
ALTER TABLE public.mai_merch_order_items
    ADD COLUMN IF NOT EXISTS printify_product_id TEXT,
    ADD COLUMN IF NOT EXISTS printify_variant_id TEXT,
    ADD COLUMN IF NOT EXISTS variant_name TEXT,
    ADD COLUMN IF NOT EXISTS size TEXT,
    ADD COLUMN IF NOT EXISTS color TEXT,
    ADD COLUMN IF NOT EXISTS sku TEXT,
    ADD COLUMN IF NOT EXISTS product_image TEXT;

-- =========================================================================
-- RLS for user_addresses
-- =========================================================================
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users view own addresses" ON public.user_addresses;
CREATE POLICY "users view own addresses"
  ON public.user_addresses FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users manage own addresses" ON public.user_addresses;
CREATE POLICY "users manage own addresses"
  ON public.user_addresses FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all addresses" ON public.user_addresses;
CREATE POLICY "admins read all addresses"
  ON public.user_addresses FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- =========================================================================
-- Indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_user_addresses_user_id ON public.user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_addresses_default ON public.user_addresses(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_mai_merch_products_printify_id ON public.mai_merch_products(printify_product_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_paypal_id ON public.mai_merch_orders(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_printify_id ON public.mai_merch_orders(printify_order_id);
CREATE INDEX IF NOT EXISTS idx_mai_merch_orders_order_number ON public.mai_merch_orders(order_number);

-- =========================================================================
-- Trigger to auto-set default address
-- =========================================================================
CREATE OR REPLACE FUNCTION public.set_default_address()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.is_default = true THEN
        UPDATE public.user_addresses
        SET is_default = false, updated_at = now()
        WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_addresses_default ON public.user_addresses;
CREATE TRIGGER trg_user_addresses_default
    BEFORE INSERT ON public.user_addresses
    FOR EACH ROW EXECUTE FUNCTION public.set_default_address();

-- =========================================================================
-- Trigger for updated_at on user_addresses
-- =========================================================================
CREATE TRIGGER trg_user_addresses_updated
    BEFORE UPDATE ON public.user_addresses
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

COMMIT;
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (delivery_status IN ('pending', 'shipped', 'in_transit', 'delivered', 'returned', 'disputed'));

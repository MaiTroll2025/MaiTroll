-- Add payment_method and purchase_type columns to manual_coin_orders
-- This fixes the Edge Function error when creating manual orders

-- Add payment_method column (cashapp, venmo, paypal)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_coin_orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE public.manual_coin_orders ADD COLUMN payment_method text DEFAULT 'cashapp';
  END IF;
END $$;

-- Add purchase_type column for tracking the source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'manual_coin_orders' AND column_name = 'purchase_type'
  ) THEN
    ALTER TABLE public.manual_coin_orders ADD COLUMN purchase_type text DEFAULT 'manual_cashapp';
  END IF;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_manual_orders_payment_method ON public.manual_coin_orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_manual_orders_purchase_type ON public.manual_coin_orders(purchase_type);

-- Add comments
COMMENT ON COLUMN public.manual_coin_orders.payment_method IS 'Payment method used: cashapp, venmo, paypal';
COMMENT ON COLUMN public.manual_coin_orders.purchase_type IS 'Type of purchase: manual_cashapp, manual_venmo, manual_paypal, troll_pass, etc.';

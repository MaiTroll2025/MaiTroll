-- Add image_url column to shop_items table
-- This fixes the schema cache error when querying shop_items with image_url

-- Add image_url column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_items' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE public.shop_items ADD COLUMN image_url text;
  END IF;
END $$;

-- Add other commonly expected columns for shop items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_items' AND column_name = 'stock_quantity'
  ) THEN
    ALTER TABLE public.shop_items ADD COLUMN stock_quantity integer;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_items' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE public.shop_items ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shop_items' AND column_name = 'price'
  ) THEN
    -- Add price column if it doesn't exist (some code uses price instead of price_coins)
    ALTER TABLE public.shop_items ADD COLUMN price integer;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shop_items_shop_id ON public.shop_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_items_is_active ON public.shop_items(is_active);

-- Add comments
COMMENT ON COLUMN public.shop_items.image_url IS 'URL to the product image';
COMMENT ON COLUMN public.shop_items.stock_quantity IS 'Available stock quantity, null means unlimited';
COMMENT ON COLUMN public.shop_items.is_active IS 'Whether the item is available for purchase';
COMMENT ON COLUMN public.shop_items.price IS 'Price in coins (alternative to price_coins)';

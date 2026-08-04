-- Fix Marketplace Foreign Key Relationship
-- Add foreign key relationship between Mai Troll_shops and shop_items tables

-- First, ensure the shop_items table has the correct structure
-- (This assumes shop_items table already exists with shop_id column)

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'shop_items_shop_id_fkey'
        AND table_name = 'shop_items'
    ) THEN
        ALTER TABLE shop_items
        ADD CONSTRAINT shop_items_shop_id_fkey
        FOREIGN KEY (shop_id) REFERENCES Mai Troll_shops(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for better performance on the foreign key
CREATE INDEX IF NOT EXISTS idx_shop_items_shop_id ON shop_items(shop_id);

-- Ensure Mai Troll_shops table has is_active column
ALTER TABLE Mai Troll_shops
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Ensure Mai Troll_shops table has created_at column
ALTER TABLE Mai Troll_shops
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure shop_items table has created_at column
ALTER TABLE shop_items
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure shop_items table has updated_at column
ALTER TABLE shop_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
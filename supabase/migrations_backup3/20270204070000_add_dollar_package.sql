-- Fix schema for coin_packages to match frontend/modern requirements
DO $$
BEGIN
    -- Fix ID column: Convert UUID to TEXT if needed
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coin_packages' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        -- 1. Handle payment_logs
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_logs') THEN
            ALTER TABLE public.payment_logs DROP CONSTRAINT IF EXISTS payment_logs_package_id_fkey;
            
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'payment_logs' AND column_name = 'package_id' AND data_type = 'uuid'
            ) THEN
                ALTER TABLE public.payment_logs ALTER COLUMN package_id TYPE text;
            END IF;
        END IF;

        -- 2. Handle coin_orders
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_orders') THEN
            ALTER TABLE public.coin_orders DROP CONSTRAINT IF EXISTS coin_orders_package_fk;
            
            IF EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'coin_orders' AND column_name = 'package_id' AND data_type = 'uuid'
            ) THEN
                ALTER TABLE public.coin_orders ALTER COLUMN package_id TYPE text;
            END IF;
        END IF;

        -- 3. Change PK column type on coin_packages
        -- We need to drop the PK constraint first if we want to be safe, but changing type usually works if data is compatible.
        -- However, UUID to TEXT is compatible.
        ALTER TABLE public.coin_packages ALTER COLUMN id TYPE text;
        
        -- 4. Re-add FKs
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_logs') THEN
             ALTER TABLE public.payment_logs 
             ADD CONSTRAINT payment_logs_package_id_fkey 
             FOREIGN KEY (package_id) REFERENCES public.coin_packages(id) ON DELETE SET NULL;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_orders') THEN
             ALTER TABLE public.coin_orders 
             ADD CONSTRAINT coin_orders_package_fk 
             FOREIGN KEY (package_id) REFERENCES public.coin_packages(id) ON DELETE SET NULL;
        END IF;

    END IF;

    -- Fix Price column: Rename price_usd to price if price doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coin_packages' AND column_name = 'price'
    ) THEN
        IF EXISTS (
             SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'coin_packages' AND column_name = 'price_usd'
        ) THEN
            ALTER TABLE public.coin_packages RENAME COLUMN price_usd TO price;
        ELSE
            ALTER TABLE public.coin_packages ADD COLUMN price numeric(10,2);
        END IF;
    END IF;

    -- Add other columns
    ALTER TABLE public.coin_packages ADD COLUMN IF NOT EXISTS label text;
    ALTER TABLE public.coin_packages ADD COLUMN IF NOT EXISTS description text;
    ALTER TABLE public.coin_packages ADD COLUMN IF NOT EXISTS currency text DEFAULT 'USD';
    
    -- Fix paypal_sku: make it nullable as we use other IDs now
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'coin_packages' AND column_name = 'paypal_sku'
    ) THEN
        ALTER TABLE public.coin_packages ALTER COLUMN paypal_sku DROP NOT NULL;
    END IF;

END $$;

-- Add $1 coin package (1000 coins)
INSERT INTO public.coin_packages (id, name, coins, price, label, description, is_active, currency)
VALUES 
  ('pkg-1000-promo', 'Promo Pack', 1000, 1.00, '1,000 Coins', 'Limited time offer!', true, 'USD')
ON CONFLICT (id) DO UPDATE
SET 
  coins = EXCLUDED.coins,
  price = EXCLUDED.price,
  label = EXCLUDED.label,
  is_active = EXCLUDED.is_active;

-- Also ensure other packages exist just in case
INSERT INTO public.coin_packages (id, name, coins, price, label, description, is_active, currency)
VALUES 
  ('pkg-500', 'Starter Pack', 500, 4.99, '500 Coins', 'Get started', true, 'USD'),
  ('pkg-1000', 'Basic Pack', 1000, 9.99, '1,000 Coins', 'Standard pack', true, 'USD'),
  ('pkg-2500', 'Value Pack', 2500, 19.99, '2,500 Coins', 'Best value', true, 'USD'),
  ('pkg-5000', 'Pro Pack', 5000, 36.99, '5,000 Coins', 'For pros', true, 'USD'),
  ('pkg-10000', 'Elite Pack', 10000, 69.99, '10,000 Coins', 'Elite status', true, 'USD')
ON CONFLICT (id) DO NOTHING;

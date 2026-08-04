
-- Create and Seed Car Upgrades Table
-- Essential for the Car Upgrades Modal to function

-- 1. Create car_upgrades table
CREATE TABLE IF NOT EXISTS public.car_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- engine, transmission, tires, body, nitro
    tier INTEGER NOT NULL DEFAULT 1,
    cost INTEGER NOT NULL,
    value_increase_amount INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table already existed with different schema
DO $$
BEGIN
    -- Handle legacy category column if it exists (map to type)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'category') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'type') THEN
            ALTER TABLE public.car_upgrades RENAME COLUMN category TO type;
        ELSE
            ALTER TABLE public.car_upgrades DROP COLUMN category;
        END IF;
    END IF;

    -- Handle legacy cost_coins column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'cost_coins') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'cost') THEN
            ALTER TABLE public.car_upgrades RENAME COLUMN cost_coins TO cost;
        ELSE
            ALTER TABLE public.car_upgrades DROP COLUMN cost_coins;
        END IF;
    END IF;

    -- Handle legacy price column if it exists (from 20260204 migration)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'price') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'cost') THEN
            ALTER TABLE public.car_upgrades RENAME COLUMN price TO cost;
            -- Ensure it is INTEGER
            ALTER TABLE public.car_upgrades ALTER COLUMN cost TYPE INTEGER USING cost::INTEGER;
        ELSE
            ALTER TABLE public.car_upgrades DROP COLUMN price;
        END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'type') THEN
        ALTER TABLE public.car_upgrades ADD COLUMN type TEXT NOT NULL DEFAULT 'misc';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'tier') THEN
        ALTER TABLE public.car_upgrades ADD COLUMN tier INTEGER NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'cost') THEN
        ALTER TABLE public.car_upgrades ADD COLUMN cost INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'value_increase_amount') THEN
        ALTER TABLE public.car_upgrades ADD COLUMN value_increase_amount INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'car_upgrades' AND column_name = 'description') THEN
        ALTER TABLE public.car_upgrades ADD COLUMN description TEXT;
    END IF;
END $$;

-- 2. Enable RLS
ALTER TABLE public.car_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read upgrades" ON public.car_upgrades;
CREATE POLICY "Public read upgrades" ON public.car_upgrades FOR SELECT USING (true);

-- 3. Ensure user_vehicle_upgrades exists (retry if previous migration failed due to missing FK)
CREATE TABLE IF NOT EXISTS public.user_vehicle_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_vehicle_id UUID REFERENCES public.user_vehicles(id) ON DELETE CASCADE,
    upgrade_id UUID REFERENCES public.car_upgrades(id) ON DELETE CASCADE,
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_vehicle_id, upgrade_id)
);

ALTER TABLE public.user_vehicle_upgrades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own upgrades" ON public.user_vehicle_upgrades;
CREATE POLICY "Users view own upgrades" ON public.user_vehicle_upgrades FOR SELECT USING (
    user_vehicle_id IN (SELECT id FROM public.user_vehicles WHERE user_id = auth.uid())
);

-- 4. Seed Data
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.car_upgrades) THEN
        INSERT INTO public.car_upgrades (name, type, tier, cost, value_increase_amount, description) VALUES
        ('Street Tuned Engine', 'engine', 1, 2000, 1500, 'Basic ECU remap and intake for better street performance.'),
        ('Sport Performance Engine', 'engine', 2, 8000, 6000, 'Forged internals and high-flow turbo for serious power.'),
        ('Race Spec Engine', 'engine', 3, 25000, 20000, 'Full race engine build capable of extreme RPMs.'),
        ('Short Shifter', 'transmission', 1, 1000, 800, 'Faster gear changes for street racing.'),
        ('Race Transmission', 'transmission', 2, 5000, 4000, 'Sequential gearbox for lightning-fast shifts.'),
        ('Street Performance Tires', 'tires', 1, 1500, 1000, 'Improved grip for city driving.'),
        ('Slick Racing Tires', 'tires', 2, 4000, 3000, 'Maximum grip for dry tarmac.'),
        ('Off-Road Rally Tires', 'tires', 2, 4000, 3000, 'Deep treads for dirt and rough terrain.'),
        ('Nitrous Oxide System (NOS)', 'nitro', 1, 3000, 2500, 'Temporary speed boost injection.'),
        ('Dual-Stage Nitrous', 'nitro', 2, 10000, 8000, 'Professional grade nitrous system for sustained boosts.'),
        ('Aerodynamic Body Kit', 'body', 1, 2500, 2000, 'Reduces drag and improves stability.'),
        ('Widebody Kit', 'body', 2, 6000, 5000, 'Wider stance for better cornering and aggressive look.'),
        ('Carbon Fiber Weight Reduction', 'body', 3, 15000, 12000, 'Replaces panels with carbon fiber to reduce weight.');
    END IF;
END $$;

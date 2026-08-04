-- Migration to implement Sell Vehicle to Dealership logic
-- and ensure vehicles_catalog exists for pricing

-- 1. Create/Ensure vehicles_catalog table exists
CREATE TABLE IF NOT EXISTS public.vehicles_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL,
    model_url TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    tier TEXT,
    style TEXT,
    speed INTEGER,
    armor INTEGER,
    color_from TEXT,
    color_to TEXT,
    image TEXT,
    overlay_video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT vehicles_catalog_name_key UNIQUE(name),
    CONSTRAINT vehicles_catalog_model_url_key UNIQUE(model_url)
);

-- Ensure unique constraints exist (in case table existed without them)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_catalog_name_key') THEN
        ALTER TABLE public.vehicles_catalog ADD CONSTRAINT vehicles_catalog_name_key UNIQUE(name);
    END IF;
    -- Note: model_url uniqueness is also critical for lookups, but the ON CONFLICT below uses (name)
END $$;

-- Ensure all columns exist (for existing tables)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'slug') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN slug TEXT NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'model_url') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN model_url TEXT NOT NULL DEFAULT '';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'price') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN price INTEGER NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'style') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN style TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'tier') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN tier TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'speed') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN speed INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'armor') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN armor INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'color_from') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN color_from TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'color_to') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN color_to TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'image_url') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'overlay_video_url') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN overlay_video_url TEXT;
    END IF;
    -- Add category if it doesn't exist, as it's required by the existing schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vehicles_catalog' AND column_name = 'category') THEN
        ALTER TABLE public.vehicles_catalog ADD COLUMN category TEXT DEFAULT 'Car';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.vehicles_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'vehicles_catalog' AND policyname = 'Public read vehicles catalog'
    ) THEN
        CREATE POLICY "Public read vehicles catalog" ON public.vehicles_catalog FOR SELECT USING (true);
    END IF;
END $$;

-- 2. Populate vehicles_catalog with data from src/data/vehicles.ts
-- Using ON CONFLICT to update prices if they changed
INSERT INTO public.vehicles_catalog 
(name, slug, tier, style, price, speed, armor, color_from, color_to, image, model_url, category) 
VALUES
('Troll Compact S1', 'troll_compact_s1', 'Starter', 'Compact modern starter sedan', 5000, 40, 20, '#38bdf8', '#22c55e', '/assets/cars/troll_compact_s1.png', '/models/vehicles/troll_compact_s1.glb', 'Car'),
('Midline XR', 'midline_xr', 'Mid', 'Mid-size SUV / crossover', 12000, 60, 35, '#fbbf24', '#f87171', '/assets/cars/midline_xr.png', '/models/vehicles/midline_xr.glb', 'Car'),
('Urban Drift R', 'urban_drift_r', 'Mid', 'Aggressive street tuner coupe', 18000, 75, 30, '#a855f7', '#ec4899', '/assets/cars/urban_drift_r.png', '/models/vehicles/urban_drift_r.glb', 'Car'),
('Ironclad GT', 'ironclad_gt', 'Luxury', 'Heavy luxury muscle car', 45000, 85, 60, '#94a3b8', '#475569', '/assets/cars/ironclad_gt.png', '/models/vehicles/ironclad_gt.glb', 'Car'),
('Vanta LX', 'vanta_lx', 'Luxury', 'High-end performance motorcycle', 60000, 92, 35, '#1e293b', '#000000', '/assets/cars/vanta_lx.png', '/models/vehicles/vanta_lx.glb', 'Car'),
('Phantom X', 'phantom_x', 'Super', 'Stealth supercar', 150000, 110, 40, '#4c1d95', '#8b5cf6', '/assets/cars/phantom_x.png', '/models/vehicles/phantom_x.glb', 'Car'),
('Obsidian One Apex', 'obsidian_one_apex', 'Elite / Hyper', 'Ultra-elite hypercar', 180000, 120, 45, '#111827', '#0f172a', '/assets/cars/vehicle_1_original.png', '/models/vehicles/obsidian_one_apex.glb', 'Car'),
('Titan Enforcer', 'titan_enforcer', 'Legendary / Armored', 'Heavily armored enforcement vehicle', 500000, 60, 100, '#0b0f1a', '#111827', '/assets/cars/vehicle_2_original.png', '/models/vehicles/titan_enforcer.glb', 'Car'),
('Neon Hatch S', 'neon_hatch_s', 'Street', 'Compact hatchback for city runs', 8000, 48, 22, '#22d3ee', '#3b82f6', '/assets/cars/vehicle_3_original.png', '/models/vehicles/neon_hatch_s.glb', 'Car'),
('Courier Spark Bike', 'courier_spark_bike', 'Street', 'Delivery bike built for fast runs', 7000, 55, 16, '#f59e0b', '#f97316', '/assets/cars/vehicle_4_original.png', '/models/vehicles/courier_spark_bike.glb', 'Car'),
('Apex Trail SUV', 'apex_trail_suv', 'Mid', 'Sport SUV with rugged stance', 22000, 70, 45, '#60a5fa', '#1d4ed8', '/assets/cars/vehicle_5_original.png', '/models/vehicles/apex_trail_suv.glb', 'Car'),
('Quantum Veil', 'quantum_veil', 'Super', 'Experimental prototype hypercar', 220000, 130, 38, '#7c3aed', '#ec4899', '/assets/cars/vehicle_6_original.png', '/models/vehicles/quantum_veil.glb', 'Car'),
('Driftline Pulse Bike', 'driftline_pulse_bike', 'Mid', 'Drift-ready performance bike', 16000, 78, 20, '#06b6d4', '#3b82f6', '/assets/cars/vehicle_7_original.png', '/models/vehicles/driftline_pulse_bike.glb', 'Car'),
('Regal Meridian', 'regal_meridian', 'Luxury', 'Executive luxury sedan', 85000, 88, 50, '#0f172a', '#334155', '/assets/cars/vehicle_8_original.png', '/models/vehicles/regal_meridian.glb', 'Car'),
('Luxe Voyager', 'luxe_voyager', 'Luxury', 'Luxury cruiser bike', 78000, 86, 32, '#1f2937', '#111827', '/assets/cars/vehicle_1_original.png', '/models/vehicles/luxe_voyager.glb', 'Car'),
('Eclipse Seraph', 'eclipse_seraph', 'Super', 'Exotic supercar', 260000, 138, 42, '#312e81', '#9333ea', '/assets/cars/vehicle_2_original.png', '/models/vehicles/eclipse_seraph.glb', 'Car')
ON CONFLICT (name) DO UPDATE SET
    slug = EXCLUDED.slug,
    model_url = EXCLUDED.model_url,
    price = EXCLUDED.price,
    tier = EXCLUDED.tier,
    style = EXCLUDED.style,
    speed = EXCLUDED.speed,
    armor = EXCLUDED.armor,
    color_from = EXCLUDED.color_from,
    color_to = EXCLUDED.color_to,
    image_url = EXCLUDED.image_url,
    category = EXCLUDED.category;

-- 3. Create sell_vehicle_to_dealership RPC
CREATE OR REPLACE FUNCTION public.sell_vehicle_to_dealership(
    p_user_car_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_car public.user_cars%ROWTYPE;
    v_price INTEGER;
    v_user_share INTEGER;
    v_admin_pool_share INTEGER;
    v_public_pool_share INTEGER;
    v_car_model_id_int INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get the car
    SELECT * INTO v_car FROM public.user_cars WHERE id = p_user_car_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Car not found';
    END IF;

    IF v_car.user_id <> v_user_id THEN
        RAISE EXCEPTION 'You do not own this car';
    END IF;

    -- Get Price
    -- Try to match via model_url first (most reliable link to catalog)
    SELECT price INTO v_price 
    FROM public.vehicles_catalog 
    WHERE model_url = v_car.model_url;

    -- If not found, try name if we can derive it (risky), or try legacy ID lookup if car_id is integer
    IF v_price IS NULL THEN
        -- Try to see if car_id is a name? Unlikely.
        -- If car_id is '1', '2', etc. we might map it manually or assume catalog is populated with correct model_urls
        -- For now, if price is not found, we fallback to a safe default or error.
        -- Let's try to match by name if car_id looks like a name (unlikely).
        -- Safe default: Error out to prevent selling for 0.
        RAISE EXCEPTION 'Vehicle catalog entry not found for valuation. Cannot sell.';
    END IF;

    IF v_price <= 0 THEN
         RAISE EXCEPTION 'Invalid vehicle value';
    END IF;

    -- Calculate Split (33.3% each)
    -- Total = v_price
    -- User: 1/3
    -- Admin Pool: 1/3
    -- Public Pool: 1/3 (But since Public Pool -> Admin Pool, we just add 2/3 to Admin Pool effectively)
    
    v_user_share := FLOOR(v_price / 3.0);
    v_admin_pool_share := FLOOR(v_price / 3.0);
    v_public_pool_share := v_price - v_user_share - v_admin_pool_share; -- Remainder goes here to ensure sum = price
    
    -- Credit User
    PERFORM public.troll_bank_credit_coins(
        v_user_id,
        v_user_share,
        'paid',
        'vehicle_sale_dealership',
        jsonb_build_object('car_id', v_car.id, 'model', v_car.car_id)::text
    );

    -- Credit Admin Pool (Admin Share + Public Pool Share)
    UPDATE public.admin_pool
    SET trollcoins_balance = trollcoins_balance + v_admin_pool_share + v_public_pool_share,
        updated_at = now()
    WHERE id = (SELECT id FROM public.admin_pool LIMIT 1);

    -- Delete User Car
    DELETE FROM public.user_cars WHERE id = p_user_car_id;

    -- Delete associated upgrades
    -- We need to parse car_id as integer to find upgrades in legacy table
    BEGIN
        v_car_model_id_int := v_car.car_id::INTEGER;
        DELETE FROM public.vehicle_upgrades 
        WHERE user_id = v_user_id 
          AND vehicle_id = v_car_model_id_int;
    EXCEPTION WHEN OTHERS THEN
        -- Ignore if car_id is not integer
        NULL;
    END;

    -- Update legacy profile array
    UPDATE public.user_profiles
    SET owned_vehicle_ids = (
        SELECT jsonb_agg(elem)
        FROM jsonb_array_elements(owned_vehicle_ids) elem
        WHERE elem::text <> v_car.car_id
    )
    WHERE id = v_user_id;
    
    -- Reset active vehicle if this was it
    UPDATE public.user_profiles
    SET active_vehicle = NULL,
        vehicle_image = NULL
    WHERE id = v_user_id AND active_vehicle = p_user_car_id;

    RETURN jsonb_build_object(
        'success', true,
        'sale_price', v_price,
        'user_share', v_user_share,
        'admin_share', v_admin_pool_share,
        'public_share', v_public_pool_share
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_vehicle_to_dealership(UUID) TO authenticated;

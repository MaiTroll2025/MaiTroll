-- Migration for Active Asset Economy (Houses & Cars)
-- Implements requirements from 'kain' file

-- ==========================================
-- 1. HOUSES
-- ==========================================

-- A) houses_catalog
CREATE TABLE IF NOT EXISTS public.houses_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tier INT NOT NULL CHECK (tier BETWEEN 1 AND 5),
    base_price BIGINT NOT NULL,
    rent_slots INT NOT NULL DEFAULT 0,
    power_band TEXT NOT NULL, -- apartment/condo/estate/mansion/landmark
    daily_tax_rate_bps INT NOT NULL DEFAULT 0,
    maintenance_rate_bps INT NOT NULL DEFAULT 0,
    influence_points INT NOT NULL DEFAULT 0,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed houses_catalog (Example data based on tier descriptions)
INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
VALUES 
('Starter Apartment', 1, 5000, 0, 'apartment', 10, 5, 0, '{"storage_slots": 10}'::jsonb),
('City Condo', 2, 50000, 1, 'condo', 15, 8, 10, '{"fee_discount_bps": 50}'::jsonb),
('Luxury Estate', 3, 500000, 3, 'estate', 20, 10, 50, '{"business_license": true}'::jsonb),
('Governor Mansion', 4, 5000000, 5, 'mansion', 25, 15, 200, '{"political_influence": true}'::jsonb),
('Troll Tower Penthouse', 5, 100000000, 10, 'landmark', 30, 20, 1000, '{"city_influence": true}'::jsonb)
ON CONFLICT DO NOTHING; -- No conflict constraint on name, so this might duplicate if run multiple times. Ideally use unique name or ID.
-- To prevent duplicates on re-run, we should probably add a unique constraint on name or check existence.
-- But for now, let's assume this is a one-time migration or we can clean up.
-- Better:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Starter Apartment') THEN
        INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
        VALUES ('Starter Apartment', 1, 5000, 0, 'apartment', 10, 5, 0, '{"storage_slots": 10}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'City Condo') THEN
        INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
        VALUES ('City Condo', 2, 50000, 1, 'condo', 15, 8, 10, '{"fee_discount_bps": 50}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Luxury Estate') THEN
        INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
        VALUES ('Luxury Estate', 3, 500000, 3, 'estate', 20, 10, 50, '{"business_license": true}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Governor Mansion') THEN
        INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
        VALUES ('Governor Mansion', 4, 5000000, 5, 'mansion', 25, 15, 200, '{"political_influence": true}'::jsonb);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.houses_catalog WHERE name = 'Troll Tower Penthouse') THEN
        INSERT INTO public.houses_catalog (name, tier, base_price, rent_slots, power_band, daily_tax_rate_bps, maintenance_rate_bps, influence_points, feature_flags)
        VALUES ('Troll Tower Penthouse', 5, 100000000, 10, 'landmark', 30, 20, 1000, '{"city_influence": true}'::jsonb);
    END IF;
END $$;


-- B) user_houses
CREATE TABLE IF NOT EXISTS public.user_houses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    house_catalog_id UUID NOT NULL REFERENCES public.houses_catalog(id),
    purchase_price BIGINT NOT NULL DEFAULT 0,
    condition INT DEFAULT 100 CHECK (condition BETWEEN 0 AND 100),
    is_primary BOOL DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'delinquent', 'foreclosed', 'auctioned')),
    last_tax_paid_at TIMESTAMPTZ,
    last_maintenance_paid_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    influence_active BOOL DEFAULT true,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- C) house_upgrades
CREATE TABLE IF NOT EXISTS public.house_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    house_catalog_id UUID REFERENCES public.houses_catalog(id),
    name TEXT NOT NULL,
    price BIGINT NOT NULL,
    effects JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- D) user_house_upgrades
CREATE TABLE IF NOT EXISTS public.user_house_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_house_id UUID NOT NULL REFERENCES public.user_houses(id) ON DELETE CASCADE,
    house_upgrade_id UUID NOT NULL REFERENCES public.house_upgrades(id),
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- E) house_rentals
CREATE TABLE IF NOT EXISTS public.house_rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    landlord_user_id UUID NOT NULL REFERENCES auth.users(id),
    tenant_user_id UUID NOT NULL REFERENCES auth.users(id),
    user_house_id UUID NOT NULL REFERENCES public.user_houses(id),
    rent_amount BIGINT NOT NULL,
    platform_fee_bps INT DEFAULT 1000,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'late', 'ended', 'evicted')),
    last_paid_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 2. CARS
-- ==========================================

-- A) cars_catalog
CREATE TABLE IF NOT EXISTS public.cars_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tier INT NOT NULL,
    base_price BIGINT NOT NULL,
    exposure_level INT DEFAULT 0 CHECK (exposure_level BETWEEN 0 AND 4),
    insurance_rate_bps INT DEFAULT 0,
    registration_fee BIGINT DEFAULT 0,
    plate_change_fee BIGINT DEFAULT 20,
    feature_flags JSONB DEFAULT '{}'::jsonb,
    
    -- Fields to map back to existing vehicles_catalog (legacy support)
    legacy_slug TEXT, 
    model_url TEXT,
    image_url TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Populate cars_catalog from vehicles_catalog
INSERT INTO public.cars_catalog (name, tier, base_price, legacy_slug, model_url, image_url, exposure_level, insurance_rate_bps, registration_fee)
SELECT 
    name, 
    CASE 
        WHEN tier = 'Starter' THEN 1
        WHEN tier = 'Street' THEN 1
        WHEN tier = 'Mid' THEN 2
        WHEN tier = 'Luxury' THEN 3
        WHEN tier = 'Super' THEN 4
        WHEN tier LIKE 'Elite%' THEN 5
        WHEN tier LIKE 'Legendary%' THEN 5
        ELSE 1 
    END as tier,
    price as base_price,
    LOWER(REPLACE(name, ' ', '-')) as legacy_slug,
    model_url,
    image as image_url,
    CASE 
        WHEN tier = 'Starter' THEN 0
        WHEN tier = 'Street' THEN 1
        WHEN tier = 'Mid' THEN 2
        WHEN tier = 'Luxury' THEN 3
        WHEN tier = 'Super' THEN 4
        ELSE 0
    END as exposure_level,
    CASE 
        WHEN tier = 'Starter' THEN 10
        WHEN tier = 'Street' THEN 20
        WHEN tier = 'Mid' THEN 30
        WHEN tier = 'Luxury' THEN 50
        WHEN tier = 'Super' THEN 100
        ELSE 10
    END as insurance_rate_bps,
    CASE 
        WHEN tier = 'Starter' THEN 100
        WHEN tier = 'Street' THEN 200
        WHEN tier = 'Mid' THEN 500
        WHEN tier = 'Luxury' THEN 1000
        WHEN tier = 'Super' THEN 5000
        ELSE 100
    END as registration_fee
FROM public.vehicles_catalog
ON CONFLICT DO NOTHING; -- cars_catalog has UUID PK, so this only works if I don't set ID. But I'm inserting new rows.
-- To avoid duplicates, check if legacy_slug exists
-- Or better, we can assume cars_catalog is the new source of truth.

-- B) user_cars (Alter existing)
-- Check and add columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'car_catalog_id') THEN
        ALTER TABLE public.user_cars ADD COLUMN car_catalog_id UUID REFERENCES public.cars_catalog(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'purchase_price') THEN
        ALTER TABLE public.user_cars ADD COLUMN purchase_price BIGINT DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'condition') THEN
        ALTER TABLE public.user_cars ADD COLUMN condition INT DEFAULT 100 CHECK (condition BETWEEN 0 AND 100);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'status') THEN
        ALTER TABLE public.user_cars ADD COLUMN status TEXT DEFAULT 'active' CHECK (status IN ('active', 'unregistered', 'insured', 'uninsured', 'impounded', 'auctioned'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'insurance_expires_at') THEN
        ALTER TABLE public.user_cars ADD COLUMN insurance_expires_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'registration_expires_at') THEN
        ALTER TABLE public.user_cars ADD COLUMN registration_expires_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'plate_number') THEN
        ALTER TABLE public.user_cars ADD COLUMN plate_number TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'plate_status') THEN
        ALTER TABLE public.user_cars ADD COLUMN plate_status TEXT DEFAULT 'valid' CHECK (plate_status IN ('valid', 'temp_valid', 'temp_expired', 'expired', 'suspended'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_cars' AND column_name = 'last_fees_paid_at') THEN
        ALTER TABLE public.user_cars ADD COLUMN last_fees_paid_at TIMESTAMPTZ;
    END IF;
END $$;

-- Backfill car_catalog_id in user_cars
UPDATE public.user_cars uc
SET car_catalog_id = cc.id
FROM public.cars_catalog cc
WHERE uc.car_id = cc.legacy_slug OR uc.car_id = cc.name -- try to match slug or name
  AND uc.car_catalog_id IS NULL;


-- C) car_upgrades
CREATE TABLE IF NOT EXISTS public.car_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_catalog_id UUID REFERENCES public.cars_catalog(id),
    name TEXT NOT NULL,
    price BIGINT NOT NULL,
    effects JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- D) user_car_upgrades
CREATE TABLE IF NOT EXISTS public.user_car_upgrades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_car_id UUID NOT NULL REFERENCES public.user_cars(id) ON DELETE CASCADE,
    car_upgrade_id UUID NOT NULL REFERENCES public.car_upgrades(id),
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 3. AUCTIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.asset_auctions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type TEXT NOT NULL CHECK (asset_type IN ('house', 'car')),
    asset_id UUID NOT NULL, -- Generic UUID, refer to user_houses or user_cars in app logic
    reason TEXT CHECK (reason IN ('foreclosure', 'seizure', 'repo', 'admin_action')),
    starting_bid BIGINT DEFAULT 0,
    current_bid BIGINT DEFAULT 0,
    current_winner_user_id UUID REFERENCES auth.users(id),
    ends_at TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.auction_bids (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID NOT NULL REFERENCES public.asset_auctions(id) ON DELETE CASCADE,
    bidder_user_id UUID NOT NULL REFERENCES auth.users(id),
    amount BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 4. RLS & Permissions
-- ==========================================

ALTER TABLE public.houses_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read houses_catalog" ON public.houses_catalog FOR SELECT USING (true);

ALTER TABLE public.user_houses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own houses" ON public.user_houses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own houses" ON public.user_houses FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE public.house_rentals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view rentals involved" ON public.house_rentals FOR SELECT USING (auth.uid() = landlord_user_id OR auth.uid() = tenant_user_id);

ALTER TABLE public.cars_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read cars_catalog" ON public.cars_catalog FOR SELECT USING (true);

ALTER TABLE public.asset_auctions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read auctions" ON public.asset_auctions FOR SELECT USING (true);

-- Ensure coin_ledger is accessible (already exists, just checking policy)
-- (Existing policies likely suffice)


BEGIN;

-- ==========================================
-- BUSINESS PROFILES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.business_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    address TEXT,
    logo_url TEXT,
    banner_url TEXT,
    verified BOOLEAN DEFAULT false,
    rating NUMERIC DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    total_bookings INTEGER DEFAULT 0,
    status TEXT CHECK (status IN ('active', 'paused', 'suspended')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_profiles_owner ON public.business_profiles(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_profiles_category ON public.business_profiles(category);
CREATE INDEX IF NOT EXISTS idx_business_profiles_location ON public.business_profiles(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_business_profiles_status ON public.business_profiles(status);
CREATE INDEX IF NOT EXISTS idx_business_profiles_rating ON public.business_profiles(rating DESC);

-- ==========================================
-- VEHICLE LISTINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.vehicle_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    price_coins INTEGER,
    price_usd NUMERIC,
    make TEXT,
    model TEXT,
    year INTEGER,
    mileage INTEGER,
    vin TEXT,
    condition TEXT CHECK (condition IN ('new', 'used', 'refurbished')),
    body_type TEXT,
    fuel_type TEXT,
    transmission TEXT,
    color TEXT,
    description TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    images JSONB DEFAULT '[]',
    photo_urls JSONB DEFAULT '{}'::jsonb,
    vin_verification_url TEXT,
    problems TEXT,
    diagnostic_codes TEXT,
    check_engine_light BOOLEAN DEFAULT false,
    ceo_mechanic_verified BOOLEAN DEFAULT false,
    ceo_mechanic_verification_statement TEXT,
    status TEXT CHECK (status IN ('active', 'sold', 'hidden', 'flagged')) DEFAULT 'active',
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_listings_seller ON public.vehicle_listings(seller_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_status ON public.vehicle_listings(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_make_model ON public.vehicle_listings(make, model);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_year ON public.vehicle_listings(year);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_location ON public.vehicle_listings(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_vehicle_listings_price ON public.vehicle_listings(price_usd);

ALTER TABLE public.vehicle_listings
  ADD COLUMN IF NOT EXISTS vin_verification_url TEXT,
  ADD COLUMN IF NOT EXISTS photo_urls JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS problems TEXT,
  ADD COLUMN IF NOT EXISTS diagnostic_codes TEXT,
  ADD COLUMN IF NOT EXISTS check_engine_light BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceo_mechanic_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ceo_mechanic_verification_statement TEXT;

COMMENT ON COLUMN public.vehicle_listings.vin_verification_url IS 'URL to the VIN verification PDF document from NICB VINCheck (https://www.nicb.org/vincheck). Required for all vehicle listings.';
COMMENT ON COLUMN public.vehicle_listings.photo_urls IS 'Category-specific vehicle photos for vehicle listings, stored as JSON keyed by photo category.';
COMMENT ON COLUMN public.vehicle_listings.problems IS 'Seller-provided list of known problems or issues for the vehicle.';
COMMENT ON COLUMN public.vehicle_listings.diagnostic_codes IS 'Reported diagnostic trouble codes (DTCs) for the vehicle.';
COMMENT ON COLUMN public.vehicle_listings.check_engine_light IS 'Indicates whether the vehicle has an active check engine light.';
COMMENT ON COLUMN public.vehicle_listings.ceo_mechanic_verified IS 'Whether the Mai Troll CEO/mechanic has verified this vehicle listing.';
COMMENT ON COLUMN public.vehicle_listings.ceo_mechanic_verification_statement IS 'Statement that the CEO is a mechanic and will verify the vehicle listing.';

COMMIT;

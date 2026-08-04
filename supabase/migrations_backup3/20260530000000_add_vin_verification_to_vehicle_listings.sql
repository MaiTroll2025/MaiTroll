-- Add VIN verification document URL and vehicle inspection fields to vehicle_listings
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

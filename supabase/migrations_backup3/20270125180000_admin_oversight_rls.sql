-- Fix RLS policies for Admin Oversight (Deeds, Cars, Listings)

-- 1. Deeds & Deed Transfers Oversight
-- Admins need to see ALL deeds and transfers, not just their own.

-- Deeds
DROP POLICY IF EXISTS "Admins can view all deeds" ON public.deeds;
CREATE POLICY "Admins can view all deeds"
ON public.deeds
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

-- Deed Transfers
DROP POLICY IF EXISTS "Admins can view all deed transfers" ON public.deed_transfers;
CREATE POLICY "Admins can view all deed transfers"
ON public.deed_transfers
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

-- 2. User Cars Oversight (Dealership/Title Management)
-- Admins and Secretaries need to see all cars to verify titles/ownership.

DROP POLICY IF EXISTS "Admins can view all user cars" ON public.user_cars;
CREATE POLICY "Admins can view all user cars"
ON public.user_cars
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

-- 3. Vehicle Listings Oversight
-- Admins need to see all listings (including sold/cancelled/pending) for moderation.

DROP POLICY IF EXISTS "Admins can view all vehicle listings" ON public.vehicle_listings;
CREATE POLICY "Admins can view all vehicle listings"
ON public.vehicle_listings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

-- 4. Vehicle Upgrades Oversight (Audit)
-- Just in case admins need to see upgrades on cars they don't own.

DROP POLICY IF EXISTS "Admins can view all vehicle upgrades" ON public.vehicle_upgrades;
CREATE POLICY "Admins can view all vehicle upgrades"
ON public.vehicle_upgrades
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

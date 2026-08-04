-- Fix RLS policies for vehicle related tables to ensure they are visible in garage

-- 1. vehicle_registrations
DROP POLICY IF EXISTS "Users view own registrations" ON public.vehicle_registrations;
CREATE POLICY "Users view own registrations" ON public.vehicle_registrations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_vehicles uv 
        WHERE uv.id = user_vehicle_id 
        AND uv.user_id = auth.uid()
    )
);

-- 2. vehicle_titles
DROP POLICY IF EXISTS "Users view own titles" ON public.vehicle_titles;
CREATE POLICY "Users view own titles" ON public.vehicle_titles
FOR SELECT USING (
    auth.uid() = user_id
);

-- 3. vehicle_insurance_policies
DROP POLICY IF EXISTS "Users view own insurance" ON public.vehicle_insurance_policies;
CREATE POLICY "Users view own insurance" ON public.vehicle_insurance_policies
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_vehicles uv 
        WHERE uv.id = user_vehicle_id 
        AND uv.user_id = auth.uid()
    )
);

-- 4. vehicle_transactions
DROP POLICY IF EXISTS "Users view own transactions" ON public.vehicle_transactions;
CREATE POLICY "Users view own transactions" ON public.vehicle_transactions
FOR SELECT USING (
    auth.uid() = user_id
);

-- 5. user_driver_licenses
DROP POLICY IF EXISTS "Users view own license" ON public.user_driver_licenses;
CREATE POLICY "Users view own license" ON public.user_driver_licenses
FOR SELECT USING (
    auth.uid() = user_id
);

-- 6. Ensure user_vehicles is definitely correct (redundant but safe)
DROP POLICY IF EXISTS "Users view own vehicles" ON public.user_vehicles;
CREATE POLICY "Users view own vehicles" ON public.user_vehicles
FOR SELECT USING (
    auth.uid() = user_id
);

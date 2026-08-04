-- Fix RLS for property_upgrades
ALTER TABLE public.property_upgrades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own upgrades" ON public.property_upgrades;
CREATE POLICY "Users can view their own upgrades" 
ON public.property_upgrades FOR SELECT 
USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can insert their own upgrades" ON public.property_upgrades;
CREATE POLICY "Users can insert their own upgrades" 
ON public.property_upgrades FOR INSERT 
WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can update their own upgrades" ON public.property_upgrades;
CREATE POLICY "Users can update their own upgrades" 
ON public.property_upgrades FOR UPDATE 
USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Users can delete their own upgrades" ON public.property_upgrades;
CREATE POLICY "Users can delete their own upgrades" 
ON public.property_upgrades FOR DELETE 
USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Admins can view all upgrades" ON public.property_upgrades;
CREATE POLICY "Admins can view all upgrades" 
ON public.property_upgrades FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.user_profiles
        WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
    )
);

-- Fix increment_family_stats RPC (column name mismatch)
CREATE OR REPLACE FUNCTION public.increment_family_stats(
    p_family_id uuid,
    p_coin_bonus bigint,
    p_xp_bonus bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_new_coins bigint;
    v_new_xp bigint;
BEGIN
    -- Update family_stats using correct column names (family_coins, not coins)
    UPDATE public.family_stats
    SET 
        family_coins = COALESCE(family_coins, 0) + p_coin_bonus,
        total_coins = COALESCE(total_coins, 0) + p_coin_bonus,
        family_xp = COALESCE(family_xp, 0) + p_xp_bonus,
        updated_at = now()
    WHERE family_id = p_family_id
    RETURNING family_coins, family_xp INTO v_new_coins, v_new_xp;

    IF NOT FOUND THEN
        -- Create stats if missing
        INSERT INTO public.family_stats (family_id, family_coins, total_coins, family_xp)
        VALUES (p_family_id, p_coin_bonus, p_coin_bonus, p_xp_bonus)
        RETURNING family_coins, family_xp INTO v_new_coins, v_new_xp;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_coins', v_new_coins,
        'new_xp', v_new_xp
    );
END;
$$;

-- Weekly Role Perk System Migration
-- Replaces hourly pay concept with weekly Troll Coin role perks

-- 1. Role perk settings table
CREATE TABLE IF NOT EXISTS public.role_perk_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key TEXT NOT NULL UNIQUE,
    role_label TEXT NOT NULL,
    weekly_coin_amount INTEGER NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    controlled_by_president BOOLEAN NOT NULL DEFAULT true,
    requires_admin_approval BOOLEAN NOT NULL DEFAULT true,
    min_weekly_coin_amount INTEGER NOT NULL DEFAULT 0,
    max_weekly_coin_amount INTEGER NOT NULL DEFAULT 10000,
    updated_by UUID,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Role perk claims table
CREATE TABLE IF NOT EXISTS public.role_perk_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    role_key TEXT NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    coin_amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    requested_by UUID,
    approved_by UUID,
    denied_by UUID,
    paid_by UUID,
    denial_reason TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT role_perk_claims_status_check CHECK (status IN ('pending', 'approved', 'paid', 'denied', 'cancelled'))
);

-- 3. Unique constraint to prevent duplicate weekly claims
CREATE UNIQUE INDEX IF NOT EXISTS idx_role_perk_claims_unique
    ON public.role_perk_claims(user_id, role_key, week_start)
    WHERE status IN ('pending', 'approved', 'paid');

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_role_perk_settings_enabled ON public.role_perk_settings(is_enabled);
CREATE INDEX IF NOT EXISTS idx_role_perk_settings_president ON public.role_perk_settings(controlled_by_president);
CREATE INDEX IF NOT EXISTS idx_role_perk_claims_user ON public.role_perk_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_role_perk_claims_status ON public.role_perk_claims(status);
CREATE INDEX IF NOT EXISTS idx_role_perk_claims_week ON public.role_perk_claims(week_start, week_end);

-- 5. Seed eligible roles with default perk settings
INSERT INTO public.role_perk_settings (role_key, role_label, weekly_coin_amount, is_enabled, controlled_by_president, requires_admin_approval, min_weekly_coin_amount, max_weekly_coin_amount)
VALUES
    ('president', 'President', 0, true, false, false, 0, 0),
    ('secretary', 'Secretary', 5000, true, true, true, 0, 25000),
    ('pastor', 'Pastor', 5000, true, true, true, 0, 25000),
    ('auctioneer', 'Auctioneer', 5000, true, true, true, 0, 25000),
    ('prosecutor', 'Prosecutor', 5000, true, true, true, 0, 25000),
    ('attorney', 'Attorney', 5000, true, true, true, 0, 25000),
    ('tcnn_news_caster', 'TCNN News Caster', 5000, true, true, true, 0, 25000),
    ('tcnn_chief_news_caster', 'TCNN Chief News Caster', 7500, true, true, true, 0, 25000),
    ('journalist', 'Journalist', 3000, true, true, true, 0, 25000),
    ('troll_officer', 'Troll Officer', 5000, true, true, true, 0, 25000),
    ('lead_troll_officer', 'Lead Troll Officer', 7500, true, true, true, 0, 25000),
    ('troller', 'Troller', 2000, true, true, true, 0, 25000),
    ('agency_hr_manager', 'Agency HR Manager', 5000, true, true, true, 0, 25000),
    ('agency_hr', 'Agency HR', 3000, true, true, true, 0, 25000),
    ('agency_leader', 'Agency Leader', 5000, true, true, true, 0, 25000),
    ('troll_family_leader', 'Troll Family Leader', 5000, true, true, true, 0, 25000),
    ('ceo_assistant', 'CEO Assistant', 5000, true, false, true, 0, 25000),
    ('noah_assistant', 'Noah Assistant', 5000, true, false, true, 0, 25000)
ON CONFLICT (role_key) DO NOTHING;

-- 6. Function: Get current week range
CREATE OR REPLACE FUNCTION public.get_current_week_range()
RETURNS TABLE (week_start DATE, week_end DATE)
LANGUAGE sql STABLE
AS $$
    SELECT 
        (date_trunc('week', now() - interval '6 days'))::date AS week_start,
        (date_trunc('week', now()) + interval '6 days')::date AS week_end;
$$;

-- 7. Function: Request weekly role perk
CREATE OR REPLACE FUNCTION public.request_weekly_role_perk(
    p_user_id UUID,
    p_role_key TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE;
    v_week_end DATE;
    v_perk_settings RECORD;
    v_has_role BOOLEAN;
    v_existing_claim UUID;
BEGIN
    -- Get current week range
    SELECT week_start, week_end INTO v_week_start, v_week_end FROM public.get_current_week_range();
    
    -- Check if perk settings exist and are enabled
    SELECT * INTO v_perk_settings FROM public.role_perk_settings WHERE role_key = p_role_key AND is_enabled = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Role perk not found or disabled');
    END IF;
    
    -- Check if user has the role (check both role and troll_role columns)
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles 
        WHERE id = p_user_id 
        AND (role = p_role_key OR troll_role = p_role_key)
    ) INTO v_has_role;
    
    IF NOT v_has_role THEN
        RETURN jsonb_build_object('success', false, 'message', 'User does not have the required role');
    END IF;
    
    -- Check for existing claim for this week
    SELECT id INTO v_existing_claim 
    FROM public.role_perk_claims 
    WHERE user_id = p_user_id 
    AND role_key = p_role_key 
    AND week_start = v_week_start 
    AND status IN ('pending', 'approved', 'paid');
    
    IF v_existing_claim IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Weekly perk already claimed for this period');
    END IF;
    
    -- Create claim with appropriate status based on approval requirements
    INSERT INTO public.role_perk_claims (
        user_id, role_key, week_start, week_end, coin_amount, status, requested_by, created_at, updated_at
    ) VALUES (
        p_user_id, p_role_key, v_week_start, v_week_end, 
        v_perk_settings.weekly_coin_amount,
        CASE WHEN v_perk_settings.requires_admin_approval THEN 'pending' ELSE 'approved' END,
        p_user_id, now(), now()
    ) RETURNING id;
    
    -- Write Treasury ledger entry
    INSERT INTO public.treasury_transactions (
        transaction_type, source_type, direction, amount_coins, 
        details, created_at
    ) VALUES (
        'weekly_role_perk', 'president_treasury', 'debit', 
        v_perk_settings.weekly_coin_amount,
        jsonb_build_object(
            'role_key', p_role_key,
            'user_id', p_user_id,
            'week_start', v_week_start,
            'week_end', v_week_end,
            'status', 'pending_claim'
        ),
        now()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'claim_id', (SELECT id FROM public.role_perk_claims WHERE user_id = p_user_id AND role_key = p_role_key AND week_start = v_week_start),
        'coin_amount', v_perk_settings.weekly_coin_amount,
        'week_start', v_week_start,
        'week_end', v_week_end
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 8. Function: Approve role perk claim
CREATE OR REPLACE FUNCTION public.approve_weekly_role_perk_claim(
    p_claim_id UUID,
    p_approver_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_claim RECORD;
BEGIN
    SELECT * INTO v_claim FROM public.role_perk_claims WHERE id = p_claim_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Claim not found');
    END IF;
    
    IF v_claim.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Claim already paid');
    END IF;
    
    UPDATE public.role_perk_claims
    SET status = 'approved', approved_by = p_approver_id, updated_at = now()
    WHERE id = p_claim_id;
    
    RETURN jsonb_build_object('success', true, 'message', 'Claim approved');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 9. Function: Pay weekly role perk claim
CREATE OR REPLACE FUNCTION public.pay_weekly_role_perk_claim(
    p_claim_id UUID,
    p_payer_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_claim RECORD;
    v_user_has_role BOOLEAN;
BEGIN
    SELECT * INTO v_claim FROM public.role_perk_claims WHERE id = p_claim_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Claim not found');
    END IF;
    
    IF v_claim.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Claim already paid');
    END IF;
    
    -- Verify user still has the role
    SELECT EXISTS(
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_claim.user_id 
        AND (role = v_claim.role_key OR troll_role = v_claim.role_key OR is_admin = true OR role = 'admin')
    ) INTO v_user_has_role;
    
    IF NOT v_user_has_role THEN
        RETURN jsonb_build_object('success', false, 'message', 'User no longer has required role');
    END IF;
    
    -- Add coins to user balance
    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) + v_claim.coin_amount,
        updated_at = now()
    WHERE id = v_claim.user_id;
    
    -- Write user coin ledger
    INSERT INTO public.user_coin_ledger (
        user_id, amount, source, type, reference_id, created_at
    ) VALUES (
        v_claim.user_id, v_claim.coin_amount, 'treasury_perk', 'credit', p_claim_id, now()
    );
    
    -- Update claim status
    UPDATE public.role_perk_claims
    SET status = 'paid', paid_by = p_payer_id, paid_at = now(), updated_at = now()
    WHERE id = p_claim_id;
    
    -- Update treasury transaction
    UPDATE public.treasury_transactions
    SET details = jsonb_set(COALESCE(details, '{}'), '{status}', '"paid"', true)
    WHERE transaction_type = 'weekly_role_perk'
    AND (details->>'user_id')::uuid = v_claim.user_id
    AND (details->>'week_start')::date = v_claim.week_start;
    
    -- Update treasury balance
    UPDATE public.troll_city_treasury
    SET total_distributed_coins = total_distributed_coins + v_claim.coin_amount,
        balance_coins = balance_coins - v_claim.coin_amount,
        updated_at = now()
    WHERE balance_coins >= v_claim.coin_amount;
    
    RETURN jsonb_build_object('success', true, 'message', 'Perk paid successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 10. Function: President update role perk
CREATE OR REPLACE FUNCTION public.president_update_role_perk(
    p_role_key TEXT,
    p_weekly_coin_amount INTEGER,
    p_president_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_perk RECORD;
BEGIN
    -- Check if role exists and is president-controlled
    SELECT * INTO v_perk FROM public.role_perk_settings WHERE role_key = p_role_key AND controlled_by_president = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Role not found or not president-controlled');
    END IF;
    
    -- Check min/max limits
    IF p_weekly_coin_amount < v_perk.min_weekly_coin_amount OR p_weekly_coin_amount > v_perk.max_weekly_coin_amount THEN
        RETURN jsonb_build_object('success', false, 'message', 'Amount outside allowed range');
    END IF;
    
    -- Update the perk
    UPDATE public.role_perk_settings
    SET weekly_coin_amount = p_weekly_coin_amount,
        updated_by = p_president_id,
        updated_at = now()
    WHERE role_key = p_role_key;
    
    -- If admin approval required, mark as pending
    IF v_perk.requires_admin_approval THEN
        UPDATE public.role_perk_settings
        SET approved_by = NULL, approved_at = NULL
        WHERE role_key = p_role_key;
        
        INSERT INTO public.treasury_transactions (
            transaction_type, source_type, direction, amount_coins,
            details, created_at
        ) VALUES (
            'role_perk_change', 'president_proposal', 'info', 0,
            jsonb_build_object(
                'role_key', p_role_key,
                'proposed_amount', p_weekly_coin_amount,
                'requires_approval', true,
                'president_id', p_president_id
            ),
            now()
        );
        
        RETURN jsonb_build_object('success', true, 'message', 'Perk change submitted for admin approval');
    END IF;
    
    RETURN jsonb_build_object('success', true, 'message', 'Perk updated successfully');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 11. Grant permissions
GRANT SELECT, INSERT, UPDATE ON TABLE public.role_perk_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.role_perk_claims TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_week_range() TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_weekly_role_perk(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_weekly_role_perk_claim(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_weekly_role_perk_claim(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.president_update_role_perk(TEXT, INTEGER) TO authenticated;

-- 12. RLS Policies
-- Users can view their own claims and approved perk settings
CREATE POLICY "Users view own perk claims"
    ON public.role_perk_claims
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users create own perk claims"
    ON public.role_perk_claims
    FOR INSERT
    WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- President can view/manage president-controlled roles
CREATE POLICY "President manage controlled roles"
    ON public.role_perk_settings
    FOR ALL
    USING (
        controlled_by_president = true AND
        NOT EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND (role IN ('admin', 'ceo', 'owner', 'system', 'superadmin') OR is_admin = true)
        )
    );

-- Admin/CEO can manage all
CREATE POLICY "Admin manage all role perks"
    ON public.role_perk_settings
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND (role IN ('admin', 'ceo', 'owner', 'system', 'superadmin') OR is_admin = true)
        )
    );

CREATE POLICY "Admin manage all perk claims"
    ON public.role_perk_claims
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles 
            WHERE id = auth.uid() AND (role IN ('admin', 'ceo', 'owner', 'system', 'superadmin') OR is_admin = true)
        )
    );

SELECT '✅ Weekly role perk system installed' AS status;
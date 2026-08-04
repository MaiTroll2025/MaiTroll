-- Appeals System Migration
-- Creates the complete appeals system for transaction disputes
-- Integrated with existing escrow and delivery tracking

-- ==========================================
-- ENUM TYPES
-- ==========================================

DO $$ BEGIN
    CREATE TYPE appeal_status AS ENUM (
        'pending', 
        'under_review', 
        'approved', 
        'denied', 
        'escalated', 
        'withdrawn'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE appeal_category AS ENUM (
        'non_delivery', 
        'not_as_described', 
        'damaged_item', 
        'seller_issue', 
        'buyer_issue', 
        'payment_issue',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ==========================================
-- MAIN APPEALS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.transaction_appeals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Appeal Reference
    appeal_number SERIAL,
    appeal_token UUID DEFAULT gen_random_uuid(),
    
    -- User who filed the appeal
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    
    -- Related Transaction/Order
    order_id UUID,
    transaction_id UUID,
    shop_id UUID REFERENCES public.Mai Troll_shops(id) ON DELETE SET NULL,
    
    -- Appeal Details
    category appeal_category NOT NULL,
    description TEXT NOT NULL,
    evidence_urls TEXT[], -- Array of image URLs or document links
    desired_resolution TEXT, -- What the appellant wants (refund, replacement, etc.)
    
    -- Status Tracking
    status appeal_status DEFAULT 'pending' NOT NULL,
    
    -- Reviewer Info (Admin or Secretary)
    reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Related User (the other party in the transaction)
    related_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    
    -- Coin amounts involved
    amount_in_dispute BIGINT DEFAULT 0,
    escrow_release_status TEXT DEFAULT 'pending', -- pending, released, refunded, held
    
    -- Constraint
    CONSTRAINT transaction_appeals_status_check CHECK (status IN ('pending', 'under_review', 'approved', 'denied', 'escalated', 'withdrawn'))
);

-- Indexes
CREATE INDEX idx_appeals_user ON public.transaction_appeals(user_id);
CREATE INDEX idx_appeals_order ON public.transaction_appeals(order_id);
CREATE INDEX idx_appeals_status ON public.transaction_appeals(status);
CREATE INDEX idx_appeals_created ON public.transaction_appeals(created_at);
CREATE INDEX idx_appeals_shop ON public.transaction_appeals(shop_id);
CREATE INDEX idx_appeals_reviewer ON public.transaction_appeals(reviewer_id);

-- ==========================================
-- APPEAL WEEKLY LIMITS TRACKING
-- ==========================================

CREATE TABLE IF NOT EXISTS public.appeal_weekly_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    week_start_date DATE NOT NULL, -- Monday of the week
    appeals_filed INTEGER DEFAULT 0,
    max_appeals INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, week_start_date)
);

CREATE INDEX idx_appeal_limits_user_week ON public.appeal_weekly_limits(user_id, week_start_date);

-- ==========================================
-- APPEAL ACTIONS/AUDIT LOG
-- ==========================================

CREATE TABLE IF NOT EXISTS public.appeal_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    appeal_id UUID REFERENCES public.transaction_appeals(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL, -- Who took the action
    action_type TEXT NOT NULL, -- created, status_changed, evidence_added, note_added, etc.
    previous_status TEXT,
    new_status TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appeal_actions_appeal ON public.appeal_actions(appeal_id);
CREATE INDEX idx_appeal_actions_user ON public.appeal_actions(user_id);

-- ==========================================
-- ESCROW INTEGRATION FOR ORDERS
-- ==========================================

-- Add appeal-related columns to shop_orders if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_orders' AND column_name = 'delivery_status') THEN
        ALTER TABLE public.shop_orders ADD COLUMN delivery_status TEXT DEFAULT 'pending' CHECK (delivery_status IN ('pending', 'shipped', 'in_transit', 'delivered', 'returned', 'disputed'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_orders' AND column_name = 'delivery_tracking_number') THEN
        ALTER TABLE public.shop_orders ADD COLUMN delivery_tracking_number TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_orders' AND column_name = 'delivered_at') THEN
        ALTER TABLE public.shop_orders ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shop_orders' AND column_name = 'appeal_id') THEN
        ALTER TABLE public.shop_orders ADD COLUMN appeal_id UUID REFERENCES public.transaction_appeals(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Function to check and increment weekly appeal limit
CREATE OR REPLACE FUNCTION check_appeal_limit(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_week_start DATE;
    v_limit_record RECORD;
    v_current_count INTEGER;
    v_max_appeals INTEGER := 5;
BEGIN
    -- Get the Monday of current week
    v_week_start := DATE_TRUNC('week', CURRENT_DATE);
    
    -- Check existing limit record
    SELECT * INTO v_limit_record 
    FROM public.appeal_weekly_limits 
    WHERE user_id = p_user_id AND week_start_date = v_week_start;
    
    IF NOT FOUND THEN
        -- Create new record for this week
        INSERT INTO public.appeal_weekly_limits (user_id, week_start_date, appeals_filed, max_appeals)
        VALUES (p_user_id, v_week_start, 1, v_max_appeals)
        RETURNING appeals_filed INTO v_current_count;
        
        RETURN jsonb_build_object(
            'success', true,
            'allowed', true,
            'appeals_remaining', v_max_appeals - v_current_count,
            'appeals_used', v_current_count
        );
    END IF;
    
    -- Check if limit reached
    IF v_limit_record.appeals_filed >= v_max_appeals THEN
        RETURN jsonb_build_object(
            'success', false,
            'allowed', false,
            'appeals_remaining', 0,
            'appeals_used', v_limit_record.appeals_filed,
            'error', 'Weekly appeal limit of 5 reached. Please try again next week.'
        );
    END IF;
    
    -- Increment counter
    UPDATE public.appeal_weekly_limits 
    SET appeals_filed = appeals_filed + 1, updated_at = NOW()
    WHERE user_id = p_user_id AND week_start_date = v_week_start
    RETURNING appeals_filed INTO v_current_count;
    
    RETURN jsonb_build_object(
        'success', true,
        'allowed', true,
        'appeals_remaining', v_max_appeals - v_current_count,
        'appeals_used', v_current_count
    );
END;
$$;

-- Function to create an appeal
CREATE OR REPLACE FUNCTION create_transaction_appeal(
    p_user_id UUID,
    p_order_id UUID,
    p_category appeal_category,
    p_description TEXT,
    p_desired_resolution TEXT DEFAULT NULL,
    p_evidence_urls TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limit_check JSONB;
    v_order RECORD;
    v_appeal_id UUID;
    v_escrow_status TEXT;
BEGIN
    -- Check weekly limit
    v_limit_check := check_appeal_limit(p_user_id);
    IF NOT (v_limit_check->>'allowed')::BOOLEAN THEN
        RETURN v_limit_check;
    END IF;
    
    -- Get order details
    SELECT * INTO v_order FROM public.shop_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Verify user is part of this transaction (buyer or seller)
    IF v_order.buyer_id != p_user_id AND v_order.seller_id != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You are not authorized to appeal this order');
    END IF;
    
    -- Get escrow status
    v_escrow_status := COALESCE(v_order.escrow_status, 'none');
    
    -- Create the appeal
    INSERT INTO public.transaction_appeals (
        user_id,
        order_id,
        shop_id,
        category,
        description,
        desired_resolution,
        evidence_urls,
        related_user_id,
        amount_in_dispute,
        escrow_release_status
    ) VALUES (
        p_user_id,
        p_order_id,
        v_order.shop_id,
        p_category,
        p_description,
        p_desired_resolution,
        p_evidence_urls,
        CASE WHEN v_order.buyer_id = p_user_id THEN v_order.seller_id ELSE v_order.buyer_id END,
        v_order.total_coins,
        v_escrow_status
    )
    RETURNING id INTO v_appeal_id;
    
    -- Update order to show appeal
    UPDATE public.shop_orders 
    SET appeal_id = v_appeal_id, delivery_status = 'disputed'
    WHERE id = p_order_id;
    
    -- Log the action
    INSERT INTO public.appeal_actions (appeal_id, user_id, action_type, new_status, notes)
    VALUES (v_appeal_id, p_user_id, 'created', 'pending', 'Appeal filed by user');
    
    RETURN jsonb_build_object(
        'success', true,
        'appeal_id', v_appeal_id,
        'message', 'Appeal filed successfully',
        'appeals_remaining', (v_limit_check->>'appeals_remaining')::INTEGER
    );
END;
$$;

-- Function to update appeal status (for admin/secretary)
CREATE OR REPLACE FUNCTION review_appeal(
    p_appeal_id UUID,
    p_reviewer_id UUID,
    p_new_status appeal_status,
    p_review_notes TEXT DEFAULT NULL,
    p_action TEXT DEFAULT 'status_changed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appeal RECORD;
    v_previous_status TEXT;
BEGIN
    -- Get current appeal
    SELECT * INTO v_appeal FROM public.transaction_appeals WHERE id = p_appeal_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appeal not found');
    END IF;
    
    v_previous_status := v_appeal.status;
    
    -- Update appeal
    UPDATE public.transaction_appeals
    SET status = p_new_status,
        reviewer_id = p_reviewer_id,
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        updated_at = NOW()
    WHERE id = p_appeal_id;
    
    -- Handle escrow based on decision
    IF p_new_status = 'approved' AND v_appeal.escrow_release_status = 'held' THEN
        -- Refund to buyer
        UPDATE public.shop_orders
        SET escrow_status = 'refunded', delivery_status = 'returned', updated_at = NOW()
        WHERE id = v_appeal.order_id;
        
        UPDATE public.transaction_appeals
        SET escrow_release_status = 'refunded'
        WHERE id = p_appeal_id;
        
    ELSIF p_new_status = 'denied' AND v_appeal.escrow_release_status = 'held' THEN
        -- Release to seller
        UPDATE public.shop_orders
        SET escrow_status = 'released', delivery_status = 'delivered', delivered_at = NOW(), updated_at = NOW()
        WHERE id = v_appeal.order_id;
        
        UPDATE public.transaction_appeals
        SET escrow_release_status = 'released'
        WHERE id = p_appeal_id;
    END IF;
    
    -- Log the action
    INSERT INTO public.appeal_actions (appeal_id, user_id, action_type, previous_status, new_status, notes)
    VALUES (p_appeal_id, p_reviewer_id, p_action, v_previous_status, p_new_status, p_review_notes);
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Appeal reviewed successfully',
        'previous_status', v_previous_status,
        'new_status', p_new_status
    );
END;
$$;

-- Function to release escrow on delivery confirmation
CREATE OR REPLACE FUNCTION confirm_delivery_and_release_escrow(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_seller_id UUID;
BEGIN
    SELECT * INTO v_order FROM public.shop_orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;
    
    -- Only release if there's escrow and no active appeal
    IF v_order.escrow_status != 'held' THEN
        RETURN jsonb_build_object('success', true, 'message', 'No escrow to release');
    END IF;
    
    -- Check for active appeal
    IF EXISTS (SELECT 1 FROM public.transaction_appeals WHERE order_id = p_order_id AND status IN ('pending', 'under_review')) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot release escrow while appeal is active');
    END IF;
    
    v_seller_id := v_order.seller_id;
    
    -- Release escrow to seller
    UPDATE public.shop_orders
    SET escrow_status = 'released',
        escrow_released_at = NOW(),
        delivery_status = 'delivered',
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;
    
    -- Credit seller
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + v_order.total_coins
    WHERE id = v_seller_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Escrow released to seller',
        'amount', v_order.total_coins
    );
END;
$$;

-- Function to get user's appeal history with weekly limit info
CREATE OR REPLACE FUNCTION get_user_appeals(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    appeal_number INTEGER,
    order_id UUID,
    category appeal_category,
    description TEXT,
    status appeal_status,
    amount_in_dispute BIGINT,
    created_at TIMESTAMPTZ,
    escrow_release_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ta.id,
        ta.appeal_number,
        ta.order_id,
        ta.category,
        ta.description,
        ta.status,
        ta.amount_in_dispute,
        ta.created_at,
        ta.escrow_release_status
    FROM public.transaction_appeals ta
    WHERE ta.user_id = p_user_id
    ORDER BY ta.created_at DESC;
END;
$$;

-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

ALTER TABLE public.transaction_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeal_weekly_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appeal_actions ENABLE ROW LEVEL SECURITY;

-- Users can view their own appeals
CREATE POLICY "users_view_own_appeals" ON public.transaction_appeals
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own appeals
CREATE POLICY "users_insert_own_appeals" ON public.transaction_appeals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins and secretaries can view all appeals
CREATE POLICY "admin_view_all_appeals" ON public.transaction_appeals
    FOR SELECT 
    USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'secretary'))
    );

-- Admins and secretaries can update appeals
CREATE POLICY "admin_update_appeals" ON public.transaction_appeals
    FOR UPDATE 
    USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'secretary'))
    );

-- Appeal actions - users can view their own
CREATE POLICY "users_view_own_appeal_actions" ON public.appeal_actions
    FOR SELECT 
    USING (
        auth.uid() IN (
            SELECT user_id FROM public.transaction_appeals WHERE id = appeal_id
            UNION
            SELECT reviewer_id FROM public.transaction_appeals WHERE id = appeal_id
        )
        OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin' OR role = 'secretary'))
    );

-- Weekly limits - users can view their own
CREATE POLICY "users_view_own_limits" ON public.appeal_weekly_limits
    FOR SELECT USING (auth.uid() = user_id);

-- ==========================================
-- TRIGGER FOR UPDATED_AT
-- ==========================================

CREATE OR REPLACE FUNCTION fn_touch_appeal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appeal_updated_at ON public.transaction_appeals;
CREATE TRIGGER trg_appeal_updated_at
    BEFORE UPDATE ON public.transaction_appeals
    FOR EACH ROW EXECUTE FUNCTION fn_touch_appeal_updated_at();

-- ==========================================
-- GRANT PERMISSIONS
-- ==========================================

GRANT ALL ON TABLE public.transaction_appeals TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.transaction_appeals TO authenticated;

GRANT ALL ON TABLE public.appeal_weekly_limits TO service_role;
GRANT SELECT, INSERT ON TABLE public.appeal_weekly_limits TO authenticated;

GRANT ALL ON TABLE public.appeal_actions TO service_role;
GRANT SELECT, INSERT ON TABLE public.appeal_actions TO authenticated;

GRANT ALL ON FUNCTION check_appeal_limit(UUID) TO service_role, authenticated;
GRANT ALL ON FUNCTION create_transaction_appeal(UUID, UUID, appeal_category, TEXT, TEXT, TEXT[]) TO service_role, authenticated;
GRANT ALL ON FUNCTION review_appeal(UUID, UUID, appeal_status, TEXT, TEXT) TO service_role, authenticated;
GRANT ALL ON FUNCTION confirm_delivery_and_release_escrow(UUID) TO service_role, authenticated;
GRANT ALL ON FUNCTION get_user_appeals(UUID) TO service_role, authenticated;

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_appeals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.appeal_actions;

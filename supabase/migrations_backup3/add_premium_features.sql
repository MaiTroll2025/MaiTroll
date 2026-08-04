l-- ==========================================
-- Premium Features for Trollifieds Listings
-- Featured listing — 50 coins
-- Pin to top — 100 coins
-- Highlight — 150 coins
-- Auto promo in streams — 200 coins
-- ==========================================

BEGIN;

-- Add premium feature columns to marketplace_items
ALTER TABLE public.marketplace_items 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_auto_promo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Add premium feature columns to vehicle_listings
ALTER TABLE public.vehicle_listings 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_auto_promo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Add premium feature columns to service_listings
ALTER TABLE public.service_listings 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_highlighted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_auto_promo BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ;

-- Create indexes for premium features
CREATE INDEX IF NOT EXISTS idx_marketplace_items_premium ON public.marketplace_items(is_featured, is_pinned, is_highlighted, is_auto_promo, premium_expires_at) 
WHERE premium_expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_vehicle_listings_premium ON public.vehicle_listings(is_featured, is_pinned, is_highlighted, is_auto_promo, premium_expires_at)
WHERE premium_expires_at > NOW();

CREATE INDEX IF NOT EXISTS idx_service_listings_premium ON public.service_listings(is_featured, is_pinned, is_highlighted, is_auto_promo, premium_expires_at)
WHERE premium_expires_at > NOW();

-- Create function to purchase premium features
CREATE OR REPLACE FUNCTION purchase_listing_premium(
    p_listing_id UUID,
    p_listing_type TEXT,
    p_feature_type TEXT,
    p_seller_id UUID,
    p_duration_days INTEGER DEFAULT 7
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_cost INTEGER;
    v_table_name TEXT;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- Determine cost based on feature type
    CASE p_feature_type
        WHEN 'featured' THEN v_cost := 50;
        WHEN 'pinned' THEN v_cost := 100;
        WHEN 'highlighted' THEN v_cost := 150;
        WHEN 'auto_promo' THEN v_cost := 200;
        ELSE RAISE EXCEPTION 'Invalid feature type: %', p_feature_type;
    END CASE;

    -- Determine which table to update
    CASE p_listing_type
        WHEN 'marketplace' THEN v_table_name := 'marketplace_items';
        WHEN 'vehicle' THEN v_table_name := 'vehicle_listings';
        WHEN 'service' THEN v_table_name := 'service_listings';
        ELSE RAISE EXCEPTION 'Invalid listing type: %', p_listing_type;
    END CASE;

    -- Calculate expiration date
    v_expires_at := NOW() + (p_duration_days || ' days')::INTERVAL;

    -- Check if seller has enough coins (would need to integrate with coin system)
    -- For now, we'll just update the listing
    
    -- Update the listing with the premium feature
    EXECUTE format(
        'UPDATE %I SET 
            is_%s = true, 
            premium_expires_at = GREATEST(COALESCE(premium_expires_at, NOW()), $1),
            updated_at = NOW()
         WHERE id = $2 AND seller_id = $3',
        v_table_name, p_feature_type
    ) USING v_expires_at, p_listing_id, p_seller_id;

    RETURN TRUE;
END;
$$;

-- Create function to get premium features cost
CREATE OR REPLACE FUNCTION get_premium_feature_cost(p_feature_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
BEGIN
    CASE p_feature_type
        WHEN 'featured' THEN RETURN 50;
        WHEN 'pinned' THEN RETURN 100;
        WHEN 'highlighted' THEN RETURN 150;
        WHEN 'auto_promo' THEN RETURN 200;
        ELSE RETURN 0;
    END CASE;
END;
$$;

-- Create function to get all premium feature costs
CREATE OR REPLACE FUNCTION get_all_premium_costs()
RETURNS TABLE(feature_type TEXT, cost INTEGER, description TEXT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM (
        VALUES 
            ('featured', 50, 'Featured listing - appear at top of search results'),
            ('pinned', 100, 'Pin to top - stay at the very top of listings'),
            ('highlighted', 150, 'Highlight - make your listing stand out with special styling'),
            ('auto_promo', 200, 'Auto promo in streams - automatically promoted in live streams')
    ) AS t(feature_type, cost, description);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION purchase_listing_premium TO authenticated;
GRANT EXECUTE ON FUNCTION get_premium_feature_cost TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_premium_costs TO authenticated;

COMMIT;

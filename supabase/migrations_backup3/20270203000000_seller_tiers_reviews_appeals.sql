-- ==========================================
-- SELLER TIERS + REVIEWS + APPEALS MEDIA ADD-ON
-- ==========================================
-- Mai Troll Marketplace - Seller Tier System
-- Includes: Seller Tiers, Buyer Reviews, Appeals Media Upload

BEGIN;

-- ==========================================
-- SECTION 1: USER PROFILES - SELLER TIER COLUMNS
-- ==========================================

-- Add seller tier columns (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'seller_tier') THEN
        ALTER TABLE public.user_profiles ADD COLUMN seller_tier TEXT DEFAULT 'standard' CHECK (seller_tier IN ('standard', 'verified', 'verified_pro', 'merchant', 'enterprise'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'fraud_flags') THEN
        ALTER TABLE public.user_profiles ADD COLUMN fraud_flags INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'completed_sales') THEN
        ALTER TABLE public.user_profiles ADD COLUMN completed_sales INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'dispute_count') THEN
        ALTER TABLE public.user_profiles ADD COLUMN dispute_count INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'positive_reviews') THEN
        ALTER TABLE public.user_profiles ADD COLUMN positive_reviews INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'negative_reviews') THEN
        ALTER TABLE public.user_profiles ADD COLUMN negative_reviews INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'tier_updated_at') THEN
        ALTER TABLE public.user_profiles ADD COLUMN tier_updated_at TIMESTAMPTZ;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_positive_reviews') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_positive_reviews INTEGER DEFAULT 0;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'total_negative_reviews') THEN
        ALTER TABLE public.user_profiles ADD COLUMN total_negative_reviews INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for seller tier columns
CREATE INDEX IF NOT EXISTS idx_user_profiles_seller_tier ON public.user_profiles(seller_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_completed_sales ON public.user_profiles(completed_sales DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_fraud_flags ON public.user_profiles(fraud_flags);

-- ==========================================
-- SECTION 2: MARKETPLACE REVIEWS TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS public.marketplace_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    listing_id UUID,
    listing_type TEXT CHECK (listing_type IN ('marketplace', 'vehicle', 'service')) DEFAULT 'marketplace',
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    images JSONB DEFAULT '[]',
    delivery_rating INTEGER CHECK (delivery_rating >= 1 AND delivery_rating <= 5),
    item_as_described BOOLEAN DEFAULT true,
    would_recommend BOOLEAN DEFAULT true,
    is_verified_purchase BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_order_seller_review UNIQUE (order_id, seller_id)
);

-- Indexes
CREATE INDEX idx_marketplace_reviews_seller ON public.marketplace_reviews(seller_id);
CREATE INDEX idx_marketplace_reviews_buyer ON public.marketplace_reviews(buyer_id);
CREATE INDEX idx_marketplace_reviews_order ON public.marketplace_reviews(order_id);
CREATE INDEX idx_marketplace_reviews_rating ON public.marketplace_reviews(rating DESC);
CREATE INDEX idx_marketplace_reviews_created ON public.marketplace_reviews(created_at DESC);

-- ==========================================
-- SECTION 3: TRANSACTION APPEALS - MEDIA EXTENSION
-- ==========================================

-- Add media columns to transaction_appeals (only if they don't exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_appeals' AND column_name = 'images') THEN
        ALTER TABLE public.transaction_appeals ADD COLUMN images JSONB DEFAULT '[]';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_appeals' AND column_name = 'videos') THEN
        ALTER TABLE public.transaction_appeals ADD COLUMN videos JSONB DEFAULT '[]';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_appeals' AND column_name = 'image_metadata') THEN
        ALTER TABLE public.transaction_appeals ADD COLUMN image_metadata JSONB DEFAULT '[]';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_appeals' AND column_name = 'video_metadata') THEN
        ALTER TABLE public.transaction_appeals ADD COLUMN video_metadata JSONB DEFAULT '[]';
    END IF;
END $$;

-- ==========================================
-- SECTION 4: STORAGE BUCKETS
-- ==========================================

-- Create storage buckets for reviews and appeals media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('review-images', 'review-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
    ('appeal-media', 'appeal-media', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for review-images
CREATE POLICY IF NOT EXISTS "Anyone can view review images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'review-images');

CREATE POLICY "Authenticated users can upload review images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'review-images' AND auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Service role can delete review images"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'review-images' AND auth.role() = 'service_role');

-- Storage policies for appeal-media
CREATE POLICY "Anyone can view appeal media"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'appeal-media');

CREATE POLICY "Authenticated users can upload appeal media"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'appeal-media' AND auth.role() IN ('authenticated', 'service_role'));

CREATE POLICY "Service role can delete appeal media"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'appeal-media' AND auth.role() = 'service_role');

-- ==========================================
-- SECTION 5: AUTO TIER UPGRADE/DOWNGRADE FUNCTIONS
-- ==========================================

-- Function to evaluate and update seller tier
CREATE OR REPLACE FUNCTION public.evaluate_seller_tier(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller RECORD;
    v_old_tier TEXT;
    v_new_tier TEXT;
    v_upgraded BOOLEAN := false;
    v_downgraded BOOLEAN := false;
BEGIN
    -- Get current seller data
    SELECT * INTO v_seller 
    FROM public.user_profiles 
    WHERE id = p_seller_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Seller not found');
    END IF;
    
    v_old_tier := COALESCE(v_seller.seller_tier, 'standard');
    v_new_tier := v_old_tier;
    
    -- DOWNGRADE RULES (take priority)
    IF v_seller.fraud_flags > 1 THEN
        v_new_tier := 'standard';
        v_downgraded := true;
    ELSIF v_seller.dispute_count >= 5 THEN
        -- Excessive disputes - downgrade
        IF v_seller.seller_tier IN ('enterprise', 'merchant') THEN
            v_new_tier := 'verified_pro';
            v_downgraded := true;
        ELSIF v_seller.seller_tier = 'verified_pro' THEN
            v_new_tier := 'verified';
            v_downgraded := true;
        END IF;
    ELSE
        -- UPGRADE LOGIC (only if no fraud flags and good standing)
        IF v_seller.completed_sales >= 500 AND v_seller.fraud_flags = 0 THEN
            v_new_tier := 'enterprise';
        ELSIF v_seller.completed_sales >= 100 AND v_seller.fraud_flags = 0 THEN
            v_new_tier := 'merchant';
        ELSIF v_seller.completed_sales >= 20 AND v_seller.fraud_flags = 0 AND v_seller.dispute_count < 3 THEN
            v_new_tier := 'verified_pro';
        ELSIF v_seller.completed_sales >= 20 AND v_seller.fraud_flags <= 1 THEN
            v_new_tier := 'verified';
        ELSE
            v_new_tier := 'standard';
        END IF;
        
        -- Only upgrade if new tier is higher
        IF v_new_tier > v_old_tier THEN
            v_upgraded := true;
        ELSE
            v_new_tier := v_old_tier;
        END IF;
    END IF;
    
    -- Update seller tier
    UPDATE public.user_profiles
    SET seller_tier = v_new_tier,
        tier_updated_at = NOW()
    WHERE id = p_seller_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'seller_id', p_seller_id,
        'old_tier', v_old_tier,
        'new_tier', v_new_tier,
        'upgraded', v_upgraded,
        'downgraded', v_downgraded,
        'completed_sales', v_seller.completed_sales,
        'fraud_flags', v_seller.fraud_flags,
        'dispute_count', v_seller.dispute_count
    );
END;
$$;

-- Function to increment completed sales and re-evaluate tier
CREATE OR REPLACE FUNCTION public.record_completed_sale(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Increment completed sales
    UPDATE public.user_profiles
    SET completed_sales = COALESCE(completed_sales, 0) + 1
    WHERE id = p_seller_id;
    
    -- Re-evaluate tier
    SELECT * INTO v_result FROM public.evaluate_seller_tier(p_seller_id);
    
    RETURN v_result;
END;
$$;

-- Function to record fraud flag
CREATE OR REPLACE FUNCTION public.record_fraud_flag(p_seller_id UUID, p_flag_count INTEGER DEFAULT 1)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Increment fraud flags
    UPDATE public.user_profiles
    SET fraud_flags = COALESCE(fraud_flags, 0) + p_flag_count
    WHERE id = p_seller_id;
    
    -- Re-evaluate tier (may trigger downgrade)
    SELECT * INTO v_result FROM public.evaluate_seller_tier(p_seller_id);
    
    RETURN v_result;
END;
$$;

-- Function to record dispute
CREATE OR REPLACE FUNCTION public.record_dispute(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
BEGIN
    -- Increment dispute count
    UPDATE public.user_profiles
    SET dispute_count = COALESCE(dispute_count, 0) + 1
    WHERE id = p_seller_id;
    
    -- Re-evaluate tier
    SELECT * INTO v_result FROM public.evaluate_seller_tier(p_seller_id);
    
    RETURN v_result;
END;
$$;

-- ==========================================
-- SECTION 6: REVIEW FUNCTIONS
-- ==========================================

-- Function to create a marketplace review
CREATE OR REPLACE FUNCTION public.create_marketplace_review(
    p_order_id UUID,
    p_seller_id UUID,
    p_buyer_id UUID,
    p_listing_id UUID,
    p_listing_type TEXT,
    p_rating INTEGER,
    p_comment TEXT DEFAULT NULL,
    p_images JSONB DEFAULT '[]',
    p_delivery_rating INTEGER DEFAULT NULL,
    p_item_as_described BOOLEAN DEFAULT true,
    p_would_recommend BOOLEAN DEFAULT true
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_review_id UUID;
    v_existing_review RECORD;
    v_seller_avg_rating NUMERIC(3,2);
    v_seller_total_reviews INTEGER;
BEGIN
    -- Check if review already exists for this order/seller
    SELECT * INTO v_existing_review
    FROM public.marketplace_reviews
    WHERE order_id = p_order_id AND seller_id = p_seller_id;
    
    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Review already exists for this order');
    END IF;
    
    -- Create the review
    INSERT INTO public.marketplace_reviews (
        order_id, seller_id, buyer_id, listing_id, listing_type,
        rating, comment, images, delivery_rating, item_as_described, would_recommend
    )
    VALUES (
        p_order_id, p_seller_id, p_buyer_id, p_listing_id, p_listing_type,
        p_rating, p_comment, p_images, p_delivery_rating, p_item_as_described, p_would_recommend
    )
    RETURNING id INTO v_review_id;
    
    -- Update seller review counts
    UPDATE public.user_profiles
    SET positive_reviews = COALESCE(positive_reviews, 0) + 
        CASE WHEN p_rating >= 4 THEN 1 ELSE 0 END,
        negative_reviews = COALESCE(negative_reviews, 0) + 
        CASE WHEN p_rating <= 2 THEN 1 ELSE 0 END,
        total_positive_reviews = COALESCE(total_positive_reviews, 0) + 
        CASE WHEN p_rating >= 4 THEN 1 ELSE 0 END,
        total_negative_reviews = COALESCE(total_negative_reviews, 0) + 
        CASE WHEN p_rating <= 2 THEN 1 ELSE 0 END
    WHERE id = p_seller_id;
    
    -- Calculate new average rating
    SELECT AVG(rating)::NUMERIC(3,2), COUNT(*)
    INTO v_seller_avg_rating, v_seller_total_reviews
    FROM public.marketplace_reviews
    WHERE seller_id = p_seller_id;
    
    -- Update seller's average rating on their profile
    UPDATE public.user_profiles
    SET rating = v_seller_avg_rating,
        total_reviews = v_seller_total_reviews
    WHERE id = p_seller_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'review_id', v_review_id,
        'seller_avg_rating', v_seller_avg_rating,
        'seller_total_reviews', v_seller_total_reviews
    );
END;
$$;

-- Function to get seller reviews
CREATE OR REPLACE FUNCTION public.get_seller_reviews(
    p_seller_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    order_id UUID,
    buyer_id UUID,
    listing_id UUID,
    listing_type TEXT,
    rating INTEGER,
    comment TEXT,
    images JSONB,
    delivery_rating INTEGER,
    item_as_described BOOLEAN,
    would_recommend BOOLEAN,
    is_verified_purchase BOOLEAN,
    created_at TIMESTAMPTZ,
    buyer_username TEXT,
    buyer_avatar TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.order_id,
        r.buyer_id,
        r.listing_id,
        r.listing_type,
        r.rating,
        r.comment,
        r.images,
        r.delivery_rating,
        r.item_as_described,
        r.would_recommend,
        r.is_verified_purchase,
        r.created_at,
        u.username as buyer_username,
        u.avatar_url as buyer_avatar
    FROM public.marketplace_reviews r
    JOIN public.user_profiles u ON r.buyer_id = u.id
    WHERE r.seller_id = p_seller_id
    ORDER BY r.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- ==========================================
-- SECTION 7: APPEAL MEDIA FUNCTIONS
-- ==========================================

-- Function to update appeal with media
CREATE OR REPLACE FUNCTION public.update_appeal_media(
    p_appeal_id UUID,
    p_images JSONB DEFAULT '[]',
    p_videos JSONB DEFAULT '[]',
    p_image_metadata JSONB DEFAULT '[]',
    p_video_metadata JSONB DEFAULT '[]'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_appeal RECORD;
    v_user_id UUID;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Get appeal details
    SELECT * INTO v_appeal
    FROM public.transaction_appeals
    WHERE id = p_appeal_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Appeal not found');
    END IF;
    
    -- Verify user owns the appeal
    IF v_appeal.user_id != v_user_id THEN
        -- Check if admin
        IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id AND is_admin = true) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized to update this appeal');
        END IF;
    END IF;
    
    -- Check appeal is still pending
    IF v_appeal.status NOT IN ('pending', 'under_review') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot update appeal that is already decided');
    END IF;
    
    -- Update appeal with media
    UPDATE public.transaction_appeals
    SET images = p_images,
        videos = p_videos,
        image_metadata = p_image_metadata,
        video_metadata = p_video_metadata,
        updated_at = NOW()
    WHERE id = p_appeal_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'appeal_id', p_appeal_id,
        'images_count', jsonb_array_length(p_images),
        'videos_count', jsonb_array_length(p_videos)
    );
END;
$$;

-- ==========================================
-- SECTION 8: NOTIFICATION TYPES
-- ==========================================

-- Add notification types for seller tiers and reviews
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'type') THEN
        -- Check if notifications table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
            ALTER TABLE public.notifications ADD COLUMN type TEXT DEFAULT 'general';
        END IF;
    END IF;
END $$;

-- ==========================================
-- SECTION 9: ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS on marketplace_reviews
ALTER TABLE public.marketplace_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Anyone can read marketplace reviews"
    ON public.marketplace_reviews
    FOR SELECT
    USING (true);

-- Buyers can create reviews
CREATE POLICY "Buyers can create marketplace reviews"
    ON public.marketplace_reviews
    FOR INSERT
    WITH CHECK (auth.uid() = buyer_id);

-- No one can update reviews (immutable)
CREATE POLICY "No update on marketplace reviews"
    ON public.marketplace_reviews
    FOR UPDATE
    USING (false)
    WITH CHECK (false);

-- Only service role can delete
CREATE POLICY "Service role can delete marketplace reviews"
    ON public.marketplace_reviews
    FOR DELETE
    USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON public.marketplace_reviews TO service_role;
GRANT SELECT, INSERT ON public.marketplace_reviews TO authenticated;
GRANT SELECT ON public.marketplace_reviews TO anon;

GRANT ALL ON FUNCTION public.evaluate_seller_tier(UUID) TO service_role, authenticated;
GRANT ALL ON FUNCTION public.record_completed_sale(UUID) TO service_role, authenticated;
GRANT ALL ON FUNCTION public.record_fraud_flag(UUID, INTEGER) TO service_role, authenticated;
GRANT ALL ON FUNCTION public.record_dispute(UUID) TO service_role, authenticated;
GRANT ALL ON FUNCTION public.create_marketplace_review(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, JSONB, INTEGER, BOOLEAN, BOOLEAN) TO service_role, authenticated;
GRANT ALL ON FUNCTION public.get_seller_reviews(UUID, INTEGER, INTEGER) TO service_role, authenticated, anon;
GRANT ALL ON FUNCTION public.update_appeal_media(UUID, JSONB, JSONB, JSONB, JSONB) TO service_role, authenticated;

-- Add to realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_reviews;

-- ==========================================
-- SECTION 10: COMMENTS
-- ==========================================

COMMENT ON COLUMN public.user_profiles.seller_tier IS 'Seller tier level: standard, verified, verified_pro, merchant, enterprise';
COMMENT ON COLUMN public.user_profiles.fraud_flags IS 'Number of fraud flags on seller account';
COMMENT ON COLUMN public.user_profiles.completed_sales IS 'Total completed sales as a seller';
COMMENT ON COLUMN public.user_profiles.dispute_count IS 'Number of disputes filed against seller';
COMMENT ON COLUMN public.user_profiles.positive_reviews IS 'Count of positive reviews (rating 4-5)';
COMMENT ON COLUMN public.user_profiles.negative_reviews IS 'Count of negative reviews (rating 1-2)';
COMMENT ON COLUMN public.user_profiles.tier_updated_at IS 'Timestamp when seller tier was last updated';
COMMENT ON COLUMN public.user_profiles.total_positive_reviews IS 'Lifetime positive reviews';
COMMENT ON COLUMN public.user_profiles.total_negative_reviews IS 'Lifetime negative reviews';

COMMENT ON TABLE public.marketplace_reviews IS 'Buyer reviews for marketplace purchases';
COMMENT ON COLUMN public.marketplace_reviews.order_id IS 'The order being reviewed';
COMMENT ON COLUMN public.marketplace_reviews.seller_id IS 'Seller being reviewed';
COMMENT ON COLUMN public.marketplace_reviews.buyer_id IS 'Buyer leaving the review';
COMMENT ON COLUMN public.marketplace_reviews.listing_id IS 'Item being reviewed';
COMMENT ON COLUMN public.marketplace_reviews.listing_type IS 'Type of listing: marketplace, vehicle, service';
COMMENT ON COLUMN public.marketplace_reviews.rating IS 'Star rating 1-5';
COMMENT ON COLUMN public.marketplace_reviews.images IS 'Array of image URLs from buyer';
COMMENT ON COLUMN public.marketplace_reviews.delivery_rating IS 'Delivery experience rating 1-5';
COMMENT ON COLUMN public.marketplace_reviews.item_as_described IS 'Whether item matched description';
COMMENT ON COLUMN public.marketplace_reviews.would_recommend IS 'Would buyer recommend seller';

COMMENT ON COLUMN public.transaction_appeals.images IS 'Array of image URLs uploaded with appeal';
COMMENT ON COLUMN public.transaction_appeals.videos IS 'Array of video URLs uploaded with appeal';
COMMENT ON COLUMN public.transaction_appeals.image_metadata IS 'EXIF metadata for uploaded images';
COMMENT ON COLUMN public.transaction_appeals.video_metadata IS 'Metadata for uploaded videos';

-- ==========================================
-- END OF MIGRATION
-- ==========================================

COMMIT;

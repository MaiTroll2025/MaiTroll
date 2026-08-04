
BEGIN;

-- ==========================================
-- MARKETPLACE ITEMS (Physical Goods)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.marketplace_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price_coins INTEGER,
    price_usd NUMERIC,
    category TEXT,
    subcategory TEXT,
    condition TEXT CHECK (condition IN ('new', 'like_new', 'good', 'fair', 'poor')),
    delivery_type TEXT CHECK (delivery_type IN ('shipping', 'pickup', 'both')) DEFAULT 'both',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    images JSONB DEFAULT '[]',
    stock INTEGER DEFAULT 1,
    status TEXT CHECK (status IN ('active', 'sold', 'hidden', 'flagged')) DEFAULT 'active',
    is_vehicle BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_marketplace_items_seller ON public.marketplace_items(seller_id);
CREATE INDEX idx_marketplace_items_status ON public.marketplace_items(status);
CREATE INDEX idx_marketplace_items_category ON public.marketplace_items(category);
CREATE INDEX idx_marketplace_items_location ON public.marketplace_items(latitude, longitude);
CREATE INDEX idx_marketplace_items_created ON public.marketplace_items(created_at DESC);

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
    status TEXT CHECK (status IN ('active', 'sold', 'hidden', 'flagged')) DEFAULT 'active',
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_vehicle_listings_seller ON public.vehicle_listings(seller_id);
CREATE INDEX idx_vehicle_listings_status ON public.vehicle_listings(status);
CREATE INDEX idx_vehicle_listings_make_model ON public.vehicle_listings(make, model);
CREATE INDEX idx_vehicle_listings_year ON public.vehicle_listings(year);
CREATE INDEX idx_vehicle_listings_location ON public.vehicle_listings(latitude, longitude);
CREATE INDEX idx_vehicle_listings_price ON public.vehicle_listings(price_usd);

-- ==========================================
-- CONVERSATIONS (Marketplace Messaging)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.marketplace_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    listing_id UUID,
    listing_type TEXT CHECK (listing_type IN ('marketplace', 'vehicle', 'service')),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT unique_buyer_seller_listing UNIQUE (buyer_id, seller_id, listing_id)
);

CREATE INDEX idx_marketplace_conversations_buyer ON public.marketplace_conversations(buyer_id);
CREATE INDEX idx_marketplace_conversations_seller ON public.marketplace_conversations(seller_id);
CREATE INDEX idx_marketplace_conversations_listing ON public.marketplace_conversations(listing_id);

-- ==========================================
-- MESSAGES (Marketplace Messaging)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.marketplace_conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    attachments JSONB DEFAULT '[]',
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_marketplace_messages_conversation ON public.marketplace_messages(conversation_id);
CREATE INDEX idx_marketplace_messages_sender ON public.marketplace_messages(sender_id);
CREATE INDEX idx_marketplace_messages_created ON public.marketplace_messages(created_at);
CREATE INDEX idx_marketplace_messages_unread ON public.marketplace_messages(conversation_id, is_read) WHERE is_read = false;

-- ==========================================
-- LISTING FLAGS (Moderation)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.listing_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    listing_id UUID NOT NULL,
    listing_type TEXT NOT NULL CHECK (listing_type IN ('marketplace', 'vehicle', 'service')),
    reason TEXT NOT NULL,
    reported_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')) DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_listing_flags_listing ON public.listing_flags(listing_id, listing_type);
CREATE INDEX idx_listing_flags_status ON public.listing_flags(status);
CREATE INDEX idx_listing_flags_reported_by ON public.listing_flags(reported_by);

-- ==========================================
-- BUSINESS PROFILES (Local Services)
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

CREATE INDEX idx_business_profiles_owner ON public.business_profiles(owner_id);
CREATE INDEX idx_business_profiles_category ON public.business_profiles(category);
CREATE INDEX idx_business_profiles_location ON public.business_profiles(latitude, longitude);
CREATE INDEX idx_business_profiles_status ON public.business_profiles(status);
CREATE INDEX idx_business_profiles_rating ON public.business_profiles(rating DESC);

-- ==========================================
-- SERVICE LISTINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.service_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price_type TEXT CHECK (price_type IN ('fixed', 'hourly', 'quote', 'free')) DEFAULT 'quote',
    price_coins INTEGER,
    price_usd NUMERIC,
    category TEXT,
    subcategory TEXT,
    is_remote BOOLEAN DEFAULT false,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    city TEXT,
    state TEXT,
    duration_minutes INTEGER,
    images JSONB DEFAULT '[]',
    status TEXT CHECK (status IN ('active', 'paused', 'flagged')) DEFAULT 'active',
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_listings_business ON public.service_listings(business_id);
CREATE INDEX idx_service_listings_category ON public.service_listings(category);
CREATE INDEX idx_service_listings_status ON public.service_listings(status);
CREATE INDEX idx_service_listings_location ON public.service_listings(latitude, longitude);
CREATE INDEX idx_service_listings_price ON public.service_listings(price_coins);

-- ==========================================
-- SERVICE BOOKINGS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.service_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.service_listings(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    business_id UUID NOT NULL REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMPTZ,
    scheduled_time TEXT,
    status TEXT CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'disputed')) DEFAULT 'pending',
    total_coins INTEGER,
    total_usd NUMERIC,
    escrow_status TEXT CHECK (escrow_status IN ('none', 'held', 'released', 'refunded')) DEFAULT 'none',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

CREATE INDEX idx_service_bookings_service ON public.service_bookings(service_id);
CREATE INDEX idx_service_bookings_buyer ON public.service_bookings(buyer_id);
CREATE INDEX idx_service_bookings_seller ON public.service_bookings(seller_id);
CREATE INDEX idx_service_bookings_business ON public.service_bookings(business_id);
CREATE INDEX idx_service_bookings_status ON public.service_bookings(status);
CREATE INDEX idx_service_bookings_scheduled ON public.service_bookings(scheduled_date);

-- ==========================================
-- SERVICE REVIEWS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.service_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id UUID NOT NULL REFERENCES public.service_listings(id) ON DELETE CASCADE,
    booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
    reviewer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    is_verified_booking BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_service_reviews_service ON public.service_reviews(service_id);
CREATE INDEX idx_service_reviews_reviewer ON public.service_reviews(reviewer_id);
CREATE INDEX idx_service_reviews_seller ON public.service_reviews(seller_id);
CREATE INDEX idx_service_reviews_rating ON public.service_reviews(rating DESC);

-- ==========================================
-- BROADCAST PINNED SERVICES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.broadcast_pinned_services (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.service_listings(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.business_profiles(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 1
);

CREATE INDEX idx_broadcast_pinned_services_stream ON public.broadcast_pinned_services(stream_id);
CREATE INDEX idx_broadcast_pinned_services_active ON public.broadcast_pinned_services(stream_id, is_active);

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================
ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_pinned_services ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES FOR MARKETPLACE ITEMS
-- ==========================================
CREATE POLICY "Anyone can read active marketplace items" ON public.marketplace_items
    FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can create marketplace items" ON public.marketplace_items
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their marketplace items" ON public.marketplace_items
    FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their marketplace items" ON public.marketplace_items
    FOR DELETE USING (auth.uid() = seller_id);

-- ==========================================
-- RLS POLICIES FOR VEHICLE LISTINGS
-- ==========================================
CREATE POLICY "Anyone can read active vehicle listings" ON public.vehicle_listings
    FOR SELECT USING (status = 'active');

CREATE POLICY "Sellers can create vehicle listings" ON public.vehicle_listings
    FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their vehicle listings" ON public.vehicle_listings
    FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their vehicle listings" ON public.vehicle_listings
    FOR DELETE USING (auth.uid() = seller_id);

-- ==========================================
-- RLS POLICIES FOR CONVERSATIONS
-- ==========================================
CREATE POLICY "Participants can read their conversations" ON public.marketplace_conversations
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Users can create conversations" ON public.marketplace_conversations
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- ==========================================
-- RLS POLICIES FOR MESSAGES
-- ==========================================
CREATE POLICY "Participants can read messages" ON public.marketplace_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.marketplace_conversations mc
            WHERE mc.id = conversation_id 
            AND (mc.buyer_id = auth.uid() OR mc.seller_id = auth.uid())
        )
    );

CREATE POLICY "Participants can send messages" ON public.marketplace_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.marketplace_conversations mc
            WHERE mc.id = conversation_id 
            AND (mc.buyer_id = auth.uid() OR mc.seller_id = auth.uid())
        )
    );

-- ==========================================
-- RLS POLICIES FOR LISTING FLAGS
-- ==========================================
CREATE POLICY "Anyone can read pending flags" ON public.listing_flags
    FOR SELECT USING (status = 'pending');

CREATE POLICY "Anyone can create flags" ON public.listing_flags
    FOR INSERT WITH CHECK (reported_by = auth.uid() OR reported_by IS NULL);

CREATE POLICY "Admins can manage all flags" ON public.listing_flags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND troll_role IN ('admin', 'moderator'))
    );

-- ==========================================
-- RLS POLICIES FOR BUSINESS PROFILES
-- ==========================================
CREATE POLICY "Anyone can read active business profiles" ON public.business_profiles
    FOR SELECT USING (status = 'active');

CREATE POLICY "Business owners can create profiles" ON public.business_profiles
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Business owners can update their profiles" ON public.business_profiles
    FOR UPDATE USING (auth.uid() = owner_id);

-- ==========================================
-- RLS POLICIES FOR SERVICE LISTINGS
-- ==========================================
CREATE POLICY "Anyone can read active service listings" ON public.service_listings
    FOR SELECT USING (status = 'active');

CREATE POLICY "Business owners can create service listings" ON public.service_listings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.business_profiles bp
            WHERE bp.id = business_id AND bp.owner_id = auth.uid()
        )
    );

CREATE POLICY "Business owners can update their service listings" ON public.service_listings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.business_profiles bp
            WHERE bp.id = business_id AND bp.owner_id = auth.uid()
        )
    );

-- ==========================================
-- RLS POLICIES FOR SERVICE BOOKINGS
-- ==========================================
CREATE POLICY "Buyers and sellers can read their bookings" ON public.service_bookings
    FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create bookings" ON public.service_bookings
    FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update their bookings" ON public.service_bookings
    FOR UPDATE USING (auth.uid() = seller_id);

-- ==========================================
-- RLS POLICIES FOR SERVICE REVIEWS
-- ==========================================
CREATE POLICY "Anyone can read service reviews" ON public.service_reviews
    FOR SELECT USING (true);

CREATE POLICY "Buyers can create reviews after booking" ON public.service_reviews
    FOR INSERT WITH CHECK (
        auth.uid() = reviewer_id 
        AND is_verified_booking = true
    );

-- ==========================================
-- RLS POLICIES FOR BROADCAST PINNED SERVICES
-- ==========================================
CREATE POLICY "Anyone can read pinned services" ON public.broadcast_pinned_services
    FOR SELECT USING (true);

CREATE POLICY "Broadcasters can manage pinned services" ON public.broadcast_pinned_services
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.streams 
            WHERE id = stream_id 
            AND user_id = auth.uid()
        )
    );

-- ==========================================
-- FUNCTIONS
-- ==========================================

-- Function to create marketplace listing with auto-flagging
CREATE OR REPLACE FUNCTION create_marketplace_listing(
    p_title TEXT,
    p_description TEXT,
    p_price_coins INTEGER,
    p_price_usd NUMERIC,
    p_category TEXT,
    p_condition TEXT,
    p_delivery_type TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_city TEXT,
    p_state TEXT,
    p_images JSONB,
    p_stock INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing_id UUID;
    v_seller_id UUID;
    v_flag_reason TEXT;
BEGIN
    -- Get seller ID from auth
    SELECT auth.uid() INTO v_seller_id;
    
    IF v_seller_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Check for prohibited keywords
    v_flag_reason := NULL;
    IF LOWER(p_title) ~ '(gun|weapon|ammo|drug|cocaine|weed|pills|fentanyl|explosive|illegal)' THEN
        v_flag_reason := 'Prohibited keyword in title';
    ELSIF LOWER(p_description) ~ '(gun|weapon|ammo|drug|cocaine|weed|pills|fentanyl|explosive|illegal)' THEN
        v_flag_reason := 'Prohibited keyword in description';
    END IF;

    -- Insert listing
    INSERT INTO public.marketplace_items (
        seller_id, title, description, price_coins, price_usd, 
        category, condition, delivery_type, latitude, longitude, 
        city, state, images, stock, status
    ) VALUES (
        v_seller_id, p_title, p_description, p_price_coins, p_price_usd,
        p_category, p_condition, p_delivery_type, p_latitude, p_longitude,
        p_city, p_state, p_images, p_stock, 
        CASE WHEN v_flag_reason IS NOT NULL THEN 'flagged' ELSE 'active' END
    )
    RETURNING id INTO v_listing_id;

    -- Create flag if prohibited content detected
    IF v_flag_reason IS NOT NULL THEN
        INSERT INTO public.listing_flags (listing_id, listing_type, reason, reported_by, status)
        VALUES (v_listing_id, 'marketplace', v_flag_reason, v_seller_id, 'pending');
    END IF;

    RETURN v_listing_id;
END;
$$;

-- Function to create vehicle listing with auto-flagging
CREATE OR REPLACE FUNCTION create_vehicle_listing(
    p_title TEXT,
    p_price_coins INTEGER,
    p_price_usd NUMERIC,
    p_make TEXT,
    p_model TEXT,
    p_year INTEGER,
    p_mileage INTEGER,
    p_vin TEXT,
    p_condition TEXT,
    p_body_type TEXT,
    p_fuel_type TEXT,
    p_transmission TEXT,
    p_color TEXT,
    p_description TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_city TEXT,
    p_state TEXT,
    p_images JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_listing_id UUID;
    v_seller_id UUID;
    v_flag_reason TEXT;
BEGIN
    SELECT auth.uid() INTO v_seller_id;
    
    IF v_seller_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Check for prohibited keywords
    v_flag_reason := NULL;
    IF LOWER(p_title) ~ '(gun|weapon|ammo|drug|cocaine|weed|pills|fentanyl|explosive|illegal)' THEN
        v_flag_reason := 'Prohibited keyword in title';
    ELSIF LOWER(p_description) ~ '(gun|weapon|ammo|drug|cocaine|weed|pills|fentanyl|explosive|illegal)' THEN
        v_flag_reason := 'Prohibited keyword in description';
    END IF;

    INSERT INTO public.vehicle_listings (
        seller_id, title, price_coins, price_usd, make, model, year, mileage, vin,
        condition, body_type, fuel_type, transmission, color, description,
        latitude, longitude, city, state, images, status
    ) VALUES (
        v_seller_id, p_title, p_price_coins, p_price_usd, p_make, p_model, p_year, p_mileage, p_vin,
        p_condition, p_body_type, p_fuel_type, p_transmission, p_color, p_description,
        p_latitude, p_longitude, p_city, p_state, p_images,
        CASE WHEN v_flag_reason IS NOT NULL THEN 'flagged' ELSE 'active' END
    )
    RETURNING id INTO v_listing_id;

    IF v_flag_reason IS NOT NULL THEN
        INSERT INTO public.listing_flags (listing_id, listing_type, reason, reported_by, status)
        VALUES (v_listing_id, 'vehicle', v_flag_reason, v_seller_id, 'pending');
    END IF;

    RETURN v_listing_id;
END;
$$;

-- Function to get nearby marketplace items
CREATE OR REPLACE FUNCTION get_nearby_marketplace_items(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_km INTEGER DEFAULT 50,
    p_category TEXT DEFAULT NULL,
    p_delivery_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    price_coins INTEGER,
    price_usd NUMERIC,
    category TEXT,
    condition TEXT,
    delivery_type TEXT,
    city TEXT,
    state TEXT,
    images JSONB,
    seller_id UUID,
    distance_km DOUBLE PRECISION,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mi.id,
        mi.title,
        mi.description,
        mi.price_coins,
        mi.price_usd,
        mi.category,
        mi.condition,
        mi.delivery_type,
        mi.city,
        mi.state,
        mi.images,
        mi.seller_id,
        (
            6371 * acos(
                cos(radians(p_latitude)) * cos(radians(mi.latitude)) * 
                cos(radians(mi.longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * sin(radians(mi.latitude))
            )
        ) AS distance_km,
        mi.created_at
    FROM public.marketplace_items mi
    WHERE mi.status = 'active'
        AND mi.latitude IS NOT NULL
        AND mi.longitude IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(p_latitude)) * cos(radians(mi.latitude)) * 
                cos(radians(mi.longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * sin(radians(mi.latitude))
            )
        ) <= p_radius_km
        AND (p_category IS NULL OR mi.category = p_category)
        AND (p_delivery_type IS NULL OR mi.delivery_type = p_delivery_type OR mi.delivery_type = 'both')
    ORDER BY distance_km ASC
    LIMIT 100;
END;
$$;

-- Function to get nearby vehicle listings
CREATE OR REPLACE FUNCTION get_nearby_vehicles(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_km INTEGER DEFAULT 50,
    p_make TEXT DEFAULT NULL,
    p_max_price NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    price_coins INTEGER,
    price_usd NUMERIC,
    make TEXT,
    model TEXT,
    year INTEGER,
    mileage INTEGER,
    condition TEXT,
    body_type TEXT,
    city TEXT,
    state TEXT,
    images JSONB,
    seller_id UUID,
    distance_km DOUBLE PRECISION,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        vl.id,
        vl.title,
        vl.price_coins,
        vl.price_usd,
        vl.make,
        vl.model,
        vl.year,
        vl.mileage,
        vl.condition,
        vl.body_type,
        vl.city,
        vl.state,
        vl.images,
        vl.seller_id,
        (
            6371 * acos(
                cos(radians(p_latitude)) * cos(radians(vl.latitude)) * 
                cos(radians(vl.longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * sin(radians(vl.latitude))
            )
        ) AS distance_km,
        vl.created_at
    FROM public.vehicle_listings vl
    WHERE vl.status = 'active'
        AND vl.latitude IS NOT NULL
        AND vl.longitude IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(p_latitude)) * cos(radians(vl.latitude)) * 
                cos(radians(vl.longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * sin(radians(vl.latitude))
            )
        ) <= p_radius_km
        AND (p_make IS NULL OR vl.make ILIKE p_make)
        AND (p_max_price IS NULL OR vl.price_usd <= p_max_price)
    ORDER BY distance_km ASC
    LIMIT 50;
END;
$$;

-- Function to get nearby services
CREATE OR REPLACE FUNCTION get_nearby_services(
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_radius_km INTEGER DEFAULT 50,
    p_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    price_type TEXT,
    price_coins INTEGER,
    price_usd NUMERIC,
    category TEXT,
    is_remote BOOLEAN,
    city TEXT,
    state TEXT,
    business_id UUID,
    business_name TEXT,
    rating NUMERIC,
    distance_km DOUBLE PRECISION,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sl.id,
        sl.title,
        sl.description,
        sl.price_type,
        sl.price_coins,
        sl.price_usd,
        sl.category,
        sl.is_remote,
        sl.city,
        sl.state,
        sl.business_id,
        bp.business_name,
        bp.rating,
        (
            6371 * acos(
                cos(radians(p_latitude)) * cos(radians(sl.latitude)) * 
                cos(radians(sl.longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * sin(radians(sl.latitude))
            )
        ) AS distance_km,
        sl.created_at
    FROM public.service_listings sl
    JOIN public.business_profiles bp ON bp.id = sl.business_id
    WHERE sl.status = 'active'
        AND bp.status = 'active'
        AND sl.latitude IS NOT NULL
        AND sl.longitude IS NOT NULL
        AND (
            6371 * acos(
                cos(radians(p_latitude)) * cos(radians(sl.latitude)) * 
                cos(radians(sl.longitude) - radians(p_longitude)) + 
                sin(radians(p_latitude)) * sin(radians(sl.latitude))
            )
        ) <= p_radius_km
        AND (p_category IS NULL OR sl.category = p_category)
    ORDER BY distance_km ASC
    LIMIT 50;
END;
$$;

-- Function to send marketplace message
CREATE OR REPLACE FUNCTION send_marketplace_message(
    p_recipient_id UUID,
    p_message TEXT,
    p_listing_id UUID DEFAULT NULL,
    p_listing_type TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sender_id UUID;
    v_conversation_id UUID;
    v_message_id UUID;
BEGIN
    SELECT auth.uid() INTO v_sender_id;
    
    IF v_sender_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    IF v_sender_id = p_recipient_id THEN
        RAISE EXCEPTION 'Cannot message yourself';
    END IF;

    -- Find or create conversation
    SELECT id INTO v_conversation_id
    FROM public.marketplace_conversations
    WHERE buyer_id = v_sender_id 
        AND seller_id = p_recipient_id
        AND (listing_id = p_listing_id OR (listing_id IS NULL AND p_listing_id IS NULL))
    LIMIT 1;

    IF v_conversation_id IS NULL THEN
        -- Check if conversation exists the other way
        SELECT id INTO v_conversation_id
        FROM public.marketplace_conversations
        WHERE buyer_id = p_recipient_id 
            AND seller_id = v_sender_id
            AND (listing_id = p_listing_id OR (listing_id IS NULL AND p_listing_id IS NULL))
        LIMIT 1;

        IF v_conversation_id IS NULL THEN
            -- Create new conversation
            INSERT INTO public.marketplace_conversations (buyer_id, seller_id, listing_id, listing_type)
            VALUES (v_sender_id, p_recipient_id, p_listing_id, p_listing_type)
            RETURNING id INTO v_conversation_id;
        ELSE
            -- Swap buyer/seller roles
            UPDATE public.marketplace_conversations
            SET buyer_id = v_sender_id, seller_id = p_recipient_id, updated_at = NOW()
            WHERE id = v_conversation_id;
        END IF;
    END IF;

    -- Insert message
    INSERT INTO public.marketplace_messages (conversation_id, sender_id, message)
    VALUES (v_conversation_id, v_sender_id, p_message)
    RETURNING id INTO v_message_id;

    -- Update conversation timestamp
    UPDATE public.marketplace_conversations
    SET updated_at = NOW()
    WHERE id = v_conversation_id;

    RETURN v_message_id;
END;
$$;

-- Function to mark message as read
CREATE OR REPLACE FUNCTION mark_marketplace_message_read(p_message_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT auth.uid() INTO v_user_id;
    
    UPDATE public.marketplace_messages
    SET is_read = true
    WHERE id = p_message_id
        AND sender_id != v_user_id
        AND is_read = false;

    RETURN FOUND;
END;
$$;

-- Function to get unread message count
CREATE OR REPLACE FUNCTION get_unread_message_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_count INTEGER;
BEGIN
    SELECT auth.uid() INTO v_user_id;
    
    IF v_user_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*)::INTEGER INTO v_count
    FROM public.marketplace_messages mm
    JOIN public.marketplace_conversations mc ON mc.id = mm.conversation_id
    WHERE (mc.buyer_id = v_user_id OR mc.seller_id = v_user_id)
        AND mm.sender_id != v_user_id
        AND mm.is_read = false;

    RETURN v_count;
END;
$$;

-- Function to create business profile
CREATE OR REPLACE FUNCTION create_business_profile(
    p_business_name TEXT,
    p_description TEXT,
    p_category TEXT,
    p_phone TEXT,
    p_email TEXT,
    p_website TEXT,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_city TEXT,
    p_state TEXT,
    p_address TEXT,
    p_logo_url TEXT,
    p_banner_url TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID;
    v_business_id UUID;
    v_flag_reason TEXT;
BEGIN
    SELECT auth.uid() INTO v_owner_id;
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Check for prohibited keywords
    v_flag_reason := NULL;
    IF LOWER(p_business_name) ~ '(drug|weapon|escort|illegal|hack|stolen|fraud|scam)' THEN
        v_flag_reason := 'Prohibited keyword in business name';
    ELSIF LOWER(p_description) ~ '(drug|weapon|escort|illegal|hack|stolen|fraud|scam)' THEN
        v_flag_reason := 'Prohibited keyword in business description';
    END IF;

    INSERT INTO public.business_profiles (
        owner_id, business_name, description, category, phone, email, website,
        latitude, longitude, city, state, address, logo_url, banner_url, status
    ) VALUES (
        v_owner_id, p_business_name, p_description, p_category, p_phone, p_email, p_website,
        p_latitude, p_longitude, p_city, p_state, p_address, p_logo_url, p_banner_url,
        CASE WHEN v_flag_reason IS NOT NULL THEN 'suspended' ELSE 'active' END
    )
    RETURNING id INTO v_business_id;

    RETURN v_business_id;
END;
$$;

-- Function to create service listing
CREATE OR REPLACE FUNCTION create_service_listing(
    p_business_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_price_type TEXT,
    p_price_coins INTEGER,
    p_price_usd NUMERIC,
    p_category TEXT,
    p_subcategory TEXT,
    p_is_remote BOOLEAN,
    p_latitude DOUBLE PRECISION,
    p_longitude DOUBLE PRECISION,
    p_city TEXT,
    p_state TEXT,
    p_duration_minutes INTEGER,
    p_images JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_service_id UUID;
    v_owner_id UUID;
    v_flag_reason TEXT;
BEGIN
    SELECT auth.uid() INTO v_owner_id;
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Verify business ownership
    IF NOT EXISTS (
        SELECT 1 FROM public.business_profiles 
        WHERE id = p_business_id AND owner_id = v_owner_id
    ) THEN
        RAISE EXCEPTION 'You do not own this business';
    END IF;

    -- Check for prohibited keywords
    v_flag_reason := NULL;
    IF LOWER(p_title) ~ '(drug|weapon|escort|illegal|hack|stolen|fraud|scam)' THEN
        v_flag_reason := 'Prohibited keyword in service title';
    ELSIF LOWER(p_description) ~ '(drug|weapon|escort|illegal|hack|stolen|fraud|scam)' THEN
        v_flag_reason := 'Prohibited keyword in service description';
    END IF;

    INSERT INTO public.service_listings (
        business_id, title, description, price_type, price_coins, price_usd,
        category, subcategory, is_remote, latitude, longitude, city, state,
        duration_minutes, images, status
    ) VALUES (
        p_business_id, p_title, p_description, p_price_type, p_price_coins, p_price_usd,
        p_category, subcategory, p_is_remote, p_latitude, p_longitude, p_city, p_state,
        p_duration_minutes, p_images,
        CASE WHEN v_flag_reason IS NOT NULL THEN 'flagged' ELSE 'active' END
    )
    RETURNING id INTO v_service_id;

    IF v_flag_reason IS NOT NULL THEN
        INSERT INTO public.listing_flags (listing_id, listing_type, reason, status)
        VALUES (v_service_id, 'service', v_flag_reason, 'pending');
    END IF;

    RETURN v_service_id;
END;
$$;

-- Function to create service booking
CREATE OR REPLACE FUNCTION create_service_booking(
    p_service_id UUID,
    p_scheduled_date TIMESTAMPTZ,
    p_scheduled_time TEXT,
    p_total_coins INTEGER,
    p_total_usd NUMERIC,
    p_notes TEXT,
    p_use_escrow BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_buyer_id UUID;
    v_booking_id UUID;
    v_seller_id UUID;
    v_business_id UUID;
    v_buyer_balance INTEGER;
BEGIN
    SELECT auth.uid() INTO v_buyer_id;
    
    IF v_buyer_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    -- Get service and business info
    SELECT sl.seller_id, bp.owner_id, sl.business_id INTO v_seller_id, v_seller_id, v_business_id
    FROM public.service_listings sl
    JOIN public.business_profiles bp ON bp.id = sl.business_id
    WHERE sl.id = p_service_id;

    IF v_seller_id IS NULL THEN
        RAISE EXCEPTION 'Service not found';
    END IF;

    IF v_buyer_id = v_seller_id THEN
        RAISE EXCEPTION 'Cannot book your own service';
    END IF;

    -- Check balance if using escrow
    IF p_use_escrow AND p_total_coins > 0 THEN
        SELECT COALESCE(coins, 0) INTO v_buyer_balance
        FROM public.user_profiles
        WHERE id = v_buyer_id;

        IF v_buyer_balance < p_total_coins THEN
            RAISE EXCEPTION 'Insufficient coins';
        END IF;

        -- Deduct coins
        UPDATE public.user_profiles
        SET coins = coins - p_total_coins
        WHERE id = v_buyer_id;
    END IF;

    -- Create booking
    INSERT INTO public.service_bookings (
        service_id, buyer_id, seller_id, business_id,
        scheduled_date, scheduled_time, status, total_coins, total_usd,
        notes, escrow_status
    ) VALUES (
        p_service_id, v_buyer_id, v_seller_id, v_business_id,
        p_scheduled_date, p_scheduled_time, 'pending', p_total_coins, p_total_usd,
        p_notes, CASE WHEN p_use_escrow THEN 'held' ELSE 'none' END
    )
    RETURNING id INTO v_booking_id;

    RETURN v_booking_id;
END;
$$;

-- Function to update service booking status
CREATE OR REPLACE FUNCTION update_service_booking_status(
    p_booking_id UUID,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_booking RECORD;
    v_escrow_status TEXT;
BEGIN
    SELECT auth.uid() INTO v_user_id;
    
    -- Get booking info
    SELECT * INTO v_booking
    FROM public.service_bookings
    WHERE id = p_booking_id;

    IF v_booking IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- Verify permission
    IF v_user_id != v_booking.buyer_id AND v_user_id != v_booking.seller_id THEN
        RAISE EXCEPTION 'Not authorized';
    END IF;

    -- Validate status transition
    IF v_booking.status = 'pending' AND p_status NOT IN ('accepted', 'cancelled') THEN
        RAISE EXCEPTION 'Invalid status transition';
    END IF;

    -- Handle escrow release
    v_escrow_status := v_booking.escrow_status;
    IF p_status = 'completed' AND v_escrow_status = 'held' THEN
        -- Release escrow to seller
        UPDATE public.user_profiles
        SET coins = coins + v_booking.total_coins
        WHERE id = v_booking.seller_id;
        
        v_escrow_status := 'released';
    ELSIF p_status = 'cancelled' AND v_escrow_status = 'held' THEN
        -- Refund to buyer
        UPDATE public.user_profiles
        SET coins = coins + v_booking.total_coins
        WHERE id = v_booking.buyer_id;
        
        v_escrow_status := 'refunded';
    END IF;

    -- Update booking
    UPDATE public.service_bookings
    SET status = p_status,
        escrow_status = v_escrow_status,
        updated_at = NOW(),
        completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE NULL END,
        cancelled_at = CASE WHEN p_status = 'cancelled' THEN NOW() ELSE NULL END
    WHERE id = p_booking_id;

    RETURN FOUND;
END;
$$;

-- Function to create service review
CREATE OR REPLACE FUNCTION create_service_review(
    p_service_id UUID,
    p_booking_id UUID,
    p_rating INTEGER,
    p_comment TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reviewer_id UUID;
    v_review_id UUID;
    v_booking RECORD;
    v_existing_review BOOLEAN;
BEGIN
    SELECT auth.uid() INTO v_reviewer_id;
    
    IF v_reviewer_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    IF p_rating < 1 OR p_rating > 5 THEN
        RAISE EXCEPTION 'Rating must be between 1 and 5';
    END IF;

    -- Get booking info
    SELECT * INTO v_booking
    FROM public.service_bookings
    WHERE id = p_booking_id AND service_id = p_service_id;

    IF v_booking IS NULL THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    IF v_booking.buyer_id != v_reviewer_id THEN
        RAISE EXCEPTION 'Only the buyer can leave a review';
    END IF;

    IF v_booking.status != 'completed' THEN
        RAISE EXCEPTION 'Can only review completed bookings';
    END IF;

    -- Check for existing review
    SELECT EXISTS (
        SELECT 1 FROM public.service_reviews
        WHERE booking_id = p_booking_id
    ) INTO v_existing_review;

    IF v_existing_review THEN
        RAISE EXCEPTION 'Already reviewed this booking';
    END IF;

    -- Create review
    INSERT INTO public.service_reviews (
        service_id, booking_id, reviewer_id, seller_id, rating, comment, is_verified_booking
    ) VALUES (
        p_service_id, p_booking_id, v_reviewer_id, v_booking.seller_id, p_rating, p_comment, true
    )
    RETURNING id INTO v_review_id;

    -- Update business rating
    UPDATE public.business_profiles
    SET rating = (
        SELECT AVG(sr.rating)::NUMERIC(3,2)
        FROM public.service_reviews sr
        WHERE sr.seller_id = v_booking.seller_id
    ),
    total_reviews = total_reviews + 1
    WHERE id = v_booking.business_id;

    RETURN v_review_id;
END;
$$;

-- Function to mark marketplace item as sold
CREATE OR REPLACE FUNCTION mark_listing_sold(
    p_listing_id UUID,
    p_listing_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT auth.uid() INTO v_user_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated';
    END IF;

    IF p_listing_type = 'marketplace' THEN
        UPDATE public.marketplace_items
        SET status = 'sold', updated_at = NOW()
        WHERE id = p_listing_id AND seller_id = v_user_id;
    ELSIF p_listing_type = 'vehicle' THEN
        UPDATE public.vehicle_listings
        SET status = 'sold', updated_at = NOW()
        WHERE id = p_listing_id AND seller_id = v_user_id;
    END IF;

    RETURN FOUND;
END;
$$;

-- Function to flag a listing
CREATE OR REPLACE FUNCTION flag_listing(
    p_listing_id UUID,
    p_listing_type TEXT,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_flag_id UUID;
BEGIN
    SELECT auth.uid() INTO v_user_id;

    INSERT INTO public.listing_flags (listing_id, listing_type, reason, reported_by, status)
    VALUES (p_listing_id, p_listing_type, p_reason, v_user_id, 'pending')
    RETURNING id INTO v_flag_id;

    -- Auto-flag if contains prohibited keywords
    IF LOWER(p_reason) ~ '(gun|weapon|ammo|drug|cocaine|weed|pills|fentanyl|explosive|illegal|escort)' THEN
        -- Update listing status to flagged
        IF p_listing_type = 'marketplace' THEN
            UPDATE public.marketplace_items SET status = 'flagged' WHERE id = p_listing_id;
        ELSIF p_listing_type = 'vehicle' THEN
            UPDATE public.vehicle_listings SET status = 'flagged' WHERE id = p_listing_id;
        ELSIF p_listing_type = 'service' THEN
            UPDATE public.service_listings SET status = 'flagged' WHERE id = p_listing_id;
        END IF;
    END IF;

    RETURN v_flag_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION create_marketplace_listing TO authenticated;
GRANT EXECUTE ON FUNCTION create_vehicle_listing TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_marketplace_items TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_vehicles TO authenticated;
GRANT EXECUTE ON FUNCTION get_nearby_services TO authenticated;
GRANT EXECUTE ON FUNCTION send_marketplace_message TO authenticated;
GRANT EXECUTE ON FUNCTION mark_marketplace_message_read TO authenticated;
GRANT EXECUTE ON FUNCTION get_unread_message_count TO authenticated;
GRANT EXECUTE ON FUNCTION create_business_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_service_listing TO authenticated;
GRANT EXECUTE ON FUNCTION create_service_booking TO authenticated;
GRANT EXECUTE ON FUNCTION update_service_booking_status TO authenticated;
GRANT EXECUTE ON FUNCTION create_service_review TO authenticated;
GRANT EXECUTE ON FUNCTION mark_listing_sold TO authenticated;
GRANT EXECUTE ON FUNCTION flag_listing TO authenticated;

COMMIT;

-- Add broadcast pinned products table and pin/unpin functions
-- Required for shop items to be pinned to broadcasts

BEGIN;

CREATE TABLE IF NOT EXISTS public.broadcast_pinned_products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stream_id UUID NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.shop_items(id) ON DELETE CASCADE,
    pinned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    pinned_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true,
    position INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_broadcast_pinned_products_stream ON public.broadcast_pinned_products(stream_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_pinned_products_active ON public.broadcast_pinned_products(stream_id, is_active);

ALTER TABLE public.broadcast_pinned_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pinned products" ON public.broadcast_pinned_products;
DROP POLICY IF EXISTS "Broadcasters can manage pinned products" ON public.broadcast_pinned_products;

CREATE POLICY "Anyone can read pinned products" ON public.broadcast_pinned_products
    FOR SELECT USING (true);

CREATE POLICY "Broadcasters can manage pinned products" ON public.broadcast_pinned_products
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.streams
            WHERE id = stream_id
            AND user_id = auth.uid()
        )
    );

CREATE OR REPLACE FUNCTION public.pin_product_to_broadcast(
    p_stream_id UUID,
    p_product_id UUID,
    p_pinned_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pinned_id UUID;
    v_existing_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.shop_items si
        JOIN public."MaiTroll_shops" ts ON ts.id = si.shop_id
        WHERE si.id = p_product_id AND ts.owner_id = p_pinned_by
    ) THEN
        RAISE EXCEPTION 'Product not found or does not belong to you';
    END IF;

    SELECT id INTO v_pinned_id
    FROM public.broadcast_pinned_products
    WHERE stream_id = p_stream_id AND product_id = p_product_id AND is_active = true;

    IF v_pinned_id IS NOT NULL THEN
        RETURN v_pinned_id;
    END IF;

    SELECT COUNT(*) INTO v_existing_count
    FROM public.broadcast_pinned_products
    WHERE stream_id = p_stream_id AND is_active = true;

    INSERT INTO public.broadcast_pinned_products (stream_id, product_id, pinned_by, position)
    VALUES (p_stream_id, p_product_id, p_pinned_by, v_existing_count + 1)
    RETURNING id INTO v_pinned_id;

    RETURN v_pinned_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unpin_product_from_broadcast(
    p_stream_id UUID,
    p_product_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.broadcast_pinned_products
    SET is_active = false
    WHERE stream_id = p_stream_id AND product_id = p_product_id AND is_active = true;

    RETURN FOUND;
END;
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_pinned_products;

COMMIT;

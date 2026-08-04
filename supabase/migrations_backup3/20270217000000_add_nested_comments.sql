-- Migration: Add support for nested comments and post gifting
-- Description: Adds parent_id to troll_post_comments and creates support for post gifts

-- 1. Add parent_id to troll_post_comments for nested replies
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'troll_post_comments') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_post_comments' AND column_name = 'parent_id') THEN
            ALTER TABLE public.troll_post_comments ADD COLUMN parent_id UUID REFERENCES public.troll_post_comments(id) ON DELETE CASCADE;
        END IF;
        
        -- Add updated_at if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_post_comments' AND column_name = 'updated_at') THEN
            ALTER TABLE public.troll_post_comments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        END IF;
    END IF;
END $$;

-- 2. Add gifts tracking to troll_posts if not exists (we can calculate from ledger/transactions, but a counter is faster)
-- We'll use a separate table for post gifts to track who gifted what
CREATE TABLE IF NOT EXISTS public.troll_post_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.troll_posts(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    gift_type TEXT NOT NULL, -- 'coin', 'item', etc.
    amount NUMERIC NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_post_id ON public.troll_post_gifts(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_sender_id ON public.troll_post_gifts(sender_id);

ALTER TABLE public.troll_post_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read post gifts" ON public.troll_post_gifts FOR SELECT USING (true);
CREATE POLICY "Users can send gifts" ON public.troll_post_gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 3. Function to gift a post
CREATE OR REPLACE FUNCTION public.gift_post(
    p_post_id UUID,
    p_amount NUMERIC,
    p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_post_owner_id UUID;
    v_sender_id UUID := auth.uid();
    v_spend_result JSONB;
BEGIN
    -- Get post owner
    SELECT user_id INTO v_post_owner_id
    FROM public.troll_posts
    WHERE id = p_post_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Post not found');
    END IF;

    IF v_sender_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    IF v_sender_id = v_post_owner_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot gift your own post');
    END IF;

    -- Spend coins from sender
    v_spend_result := public.troll_bank_spend_coins_secure(
        v_sender_id,
        p_amount,
        'gift',
        'post_gift',
        p_post_id::text,
        jsonb_build_object('post_id', p_post_id, 'message', p_message)
    );

    IF (v_spend_result->>'success')::boolean = false THEN
        RETURN v_spend_result;
    END IF;

    -- Credit coins to post owner
    PERFORM public.troll_bank_credit_coins(
        v_post_owner_id,
        p_amount,
        'gifted',
        'post_gift_received',
        p_post_id::text,
        jsonb_build_object('sender_id', v_sender_id, 'post_id', p_post_id, 'message', p_message)
    );

    -- Record the gift
    INSERT INTO public.troll_post_gifts (post_id, sender_id, gift_type, amount, metadata)
    VALUES (p_post_id, v_sender_id, 'coins', p_amount, jsonb_build_object('message', p_message));

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Migration: Fix missing RPC functions for Post interactions
-- Description: Re-applies the definitions for toggle_post_like and gift_post to ensure they exist in the schema cache.

-- ==========================================
-- 1. Toggle Post Like (and dependencies)
-- ==========================================

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.troll_post_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.troll_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reaction_type TEXT DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id, reaction_type)
);

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_troll_post_reactions_post_id ON public.troll_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_reactions_user_id ON public.troll_post_reactions(user_id);

-- Enable RLS
ALTER TABLE public.troll_post_reactions ENABLE ROW LEVEL SECURITY;

-- Policies (using DO block to avoid error if they exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read reactions' AND tablename = 'troll_post_reactions') THEN
        CREATE POLICY "Public read reactions" ON public.troll_post_reactions FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can react' AND tablename = 'troll_post_reactions') THEN
        CREATE POLICY "Users can react" ON public.troll_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can unreact' AND tablename = 'troll_post_reactions') THEN
        CREATE POLICY "Users can unreact" ON public.troll_post_reactions FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Define toggle_post_like function
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_liked BOOLEAN;
    v_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Check if already liked (reaction_type = 'like')
    IF EXISTS (SELECT 1 FROM public.troll_post_reactions WHERE post_id = p_post_id AND user_id = v_user_id AND reaction_type = 'like') THEN
        DELETE FROM public.troll_post_reactions WHERE post_id = p_post_id AND user_id = v_user_id AND reaction_type = 'like';
        v_liked := false;
    ELSE
        INSERT INTO public.troll_post_reactions (post_id, user_id, reaction_type) VALUES (p_post_id, v_user_id, 'like');
        v_liked := true;
    END IF;

    -- Get new count
    SELECT count(*) INTO v_count FROM public.troll_post_reactions WHERE post_id = p_post_id AND reaction_type = 'like';

    RETURN jsonb_build_object('success', true, 'liked', v_liked, 'count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID) TO service_role;


-- ==========================================
-- 2. Gift Post (and dependencies)
-- ==========================================

-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.troll_post_gifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.troll_posts(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    gift_type TEXT NOT NULL, -- 'coin', 'item', etc.
    amount NUMERIC NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_post_id ON public.troll_post_gifts(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_gifts_sender_id ON public.troll_post_gifts(sender_id);

-- Enable RLS
ALTER TABLE public.troll_post_gifts ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read post gifts' AND tablename = 'troll_post_gifts') THEN
        CREATE POLICY "Public read post gifts" ON public.troll_post_gifts FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can send gifts' AND tablename = 'troll_post_gifts') THEN
        CREATE POLICY "Users can send gifts" ON public.troll_post_gifts FOR INSERT WITH CHECK (auth.uid() = sender_id);
    END IF;
END $$;

-- Define gift_post function
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
    -- Note: Ensure troll_bank_spend_coins_secure exists. If not, this function creation might warn but will succeed.
    -- Execution will fail if the dependent function is missing.
    v_spend_result := public.troll_bank_spend_coins_secure(
        v_sender_id,
        p_amount,
        'paid', -- default bucket
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

GRANT EXECUTE ON FUNCTION public.gift_post(UUID, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_post(UUID, NUMERIC, TEXT) TO service_role;

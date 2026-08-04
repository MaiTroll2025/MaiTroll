-- Migration: Ensure post reactions table and toggle function
-- Description: Creates troll_post_reactions if missing and adds toggle_post_like RPC

-- 1. Create table if not exists
CREATE TABLE IF NOT EXISTS public.troll_post_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.troll_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    reaction_type TEXT DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(post_id, user_id, reaction_type)
);

-- 2. Add indexes
CREATE INDEX IF NOT EXISTS idx_troll_post_reactions_post_id ON public.troll_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_troll_post_reactions_user_id ON public.troll_post_reactions(user_id);

-- 3. Enable RLS
ALTER TABLE public.troll_post_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read reactions" ON public.troll_post_reactions FOR SELECT USING (true);
CREATE POLICY "Users can react" ON public.troll_post_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unreact" ON public.troll_post_reactions FOR DELETE USING (auth.uid() = user_id);

-- 4. Toggle Like Function
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

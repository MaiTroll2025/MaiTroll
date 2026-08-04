-- Fix for missing columns in troll_posts table
-- The ProfileFeed component expects post_type, image_url, video_url, and content columns.

-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS public.troll_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
    content TEXT,
    post_type TEXT DEFAULT 'text',
    image_url TEXT,
    video_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add columns if they are missing (for existing table)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_posts' AND column_name = 'post_type') THEN
        ALTER TABLE public.troll_posts ADD COLUMN post_type TEXT DEFAULT 'text';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_posts' AND column_name = 'image_url') THEN
        ALTER TABLE public.troll_posts ADD COLUMN image_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_posts' AND column_name = 'video_url') THEN
        ALTER TABLE public.troll_posts ADD COLUMN video_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'troll_posts' AND column_name = 'content') THEN
        ALTER TABLE public.troll_posts ADD COLUMN content TEXT;
    END IF;
    
    -- Ensure indexes exist
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename = 'troll_posts' AND indexname = 'idx_troll_posts_user_id') THEN
        CREATE INDEX idx_troll_posts_user_id ON public.troll_posts(user_id);
    END IF;
END $$;

-- 3. Enable RLS and Policies
ALTER TABLE public.troll_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'troll_posts' AND policyname = 'Public read access'
  ) THEN
    CREATE POLICY "Public read access" ON public.troll_posts FOR SELECT USING (true);
  END IF;
END $$;

-- Policy: Users can create their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'troll_posts' AND policyname = 'Users can create posts'
  ) THEN
    CREATE POLICY "Users can create posts" ON public.troll_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Users can delete their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'troll_posts' AND policyname = 'Users can delete own posts'
  ) THEN
    CREATE POLICY "Users can delete own posts" ON public.troll_posts FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Policy: Users can update their own posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'troll_posts' AND policyname = 'Users can update own posts'
  ) THEN
    CREATE POLICY "Users can update own posts" ON public.troll_posts FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

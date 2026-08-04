-- Gaming broadcast system: seed gaming gifts + storage bucket for recordings

-- 1. Add description column to gift_items if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gift_items' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.gift_items ADD COLUMN description text;
  END IF;
END $$;

-- 2. Insert gaming-specific gift items if they don't already exist
-- id column is uuid, so use gen_random_uuid() and match on gift_slug for idempotency
INSERT INTO public.gift_items (id, name, icon, value, animation_type, gift_slug, category, status, description)
VALUES
  (gen_random_uuid(), 'GG',             '👋', 10,   'emoji',    'gaming-gg',         'gaming', 'active', 'Good Game!'),
  (gen_random_uuid(), 'Headshot',       '🎯', 25,   'particle', 'gaming-headshot',   'gaming', 'active', 'Clean headshot!'),
  (gen_random_uuid(), 'Clutch',         '🔥', 50,   'particle', 'gaming-clutch',     'gaming', 'active', 'Insane clutch play!'),
  (gen_random_uuid(), 'MVP',            '🏆', 100,  'particle', 'gaming-mvp',        'gaming', 'active', 'Most Valuable Player!'),
  (gen_random_uuid(), 'Penta Kill',     '⚡', 250,  'particle', 'gaming-penta',      'gaming', 'active', 'Penta Kill!'),
  (gen_random_uuid(), 'Raid Boss',      '🐉', 500,  'particle', 'gaming-raidboss',   'gaming', 'active', 'Raid Boss defeated!'),
  (gen_random_uuid(), 'Legendary Play', '👑', 1000, 'particle', 'gaming-legendary',  'gaming', 'active', 'A play for the ages!')
ON CONFLICT (gift_slug) DO NOTHING;

-- 3. Add category column to gift_items if missing (supports filtering gaming gifts)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gift_items' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.gift_items ADD COLUMN category text DEFAULT 'general';
  END IF;
END $$;

-- 4. Update gaming gift categories to 'gaming'
UPDATE public.gift_items SET category = 'gaming' WHERE gift_slug LIKE 'gaming-%';

-- 5. Create index on gift_items.category for fast gaming gift lookups
CREATE INDEX IF NOT EXISTS idx_gift_items_category
  ON public.gift_items(category);

-- 6. Add recording_url column to streams if missing (for saved broadcast URLs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'streams' AND column_name = 'recording_url'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN recording_url text;
  END IF;
END $$;

-- 7. Create storage bucket for stream recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stream-recordings', 'stream-recordings', true, 536870912, '{"video/webm","video/mp4","video/x-matroska"}')
ON CONFLICT (id) DO NOTHING;

-- 8. Storage policy: authenticated users can upload their own recordings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'auth upload own recordings' AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "auth upload own recordings" ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'stream-recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- 9. Storage policy: anyone can view (public bucket, but explicit policy for safety)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy WHERE polname = 'public view recordings' AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "public view recordings" ON storage.objects
      FOR SELECT USING (bucket_id = 'stream-recordings');
  END IF;
END $$;

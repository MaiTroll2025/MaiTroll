-- ============================================================
-- Post Media Video Support
-- Date: 2026-06-14
-- Purpose: Enable video uploads in post-media bucket with
--          proper size limits, MIME types, and RLS policies
-- ============================================================

-- 1. Update post-media bucket: enable file size limit and video MIME types
UPDATE storage.buckets SET
  file_size_limit = 104857600,  -- 100MB max file size (5 min video @ ~20Mbps)
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-matroska'
  ]
WHERE id = 'post-media';

-- 2. Ensure bucket is public
UPDATE storage.buckets SET public = true WHERE id = 'post-media';

-- 3. RLS Policies for post-media bucket
-- Public can view post media
CREATE POLICY "Public can view post media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-media');

-- Authenticated users can upload post media
CREATE POLICY "Authenticated users can upload post media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update their own post media
CREATE POLICY "Users can update own post media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own post media
CREATE POLICY "Users can delete own post media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-media'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 4. Add video_url column to troll_wall_posts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_wall_posts'
    AND column_name = 'video_url'
  ) THEN
    ALTER TABLE public.troll_wall_posts
      ADD COLUMN video_url text,
      ADD COLUMN thumbnail_url text,
      ADD COLUMN media_type text DEFAULT 'image' CHECK (media_type IN ('image', 'video'));
  END IF;
END $$;

-- 5. Add video_url column to troll_posts if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_posts'
    AND column_name = 'video_url'
  ) THEN
    ALTER TABLE public.troll_posts
      ADD COLUMN video_url text,
      ADD COLUMN thumbnail_url text;
  END IF;
END $$;

BEGIN;

-- ============================================================================
-- Create post-images storage bucket for product images
-- ============================================================================

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- RLS Policies for storage.objects on post-images bucket
-- ============================================================================

-- Policy: Authenticated users can upload product images to their own shop-items folder
CREATE POLICY "Users can upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = 'shop-items'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Public can view product images (needed for marketplace browsing)
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- Policy: Users can update their own product images
CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = 'shop-items'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = 'shop-items'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Policy: Users can delete their own product images
CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = 'shop-items'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

NOTIFY pgrst, 'reload schema';

COMMIT;

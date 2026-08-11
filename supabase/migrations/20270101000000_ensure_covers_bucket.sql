-- ============================================================================
-- Migration: ensure_covers_bucket
-- Creates the 'covers' storage bucket for profile cover photos and its RLS
-- policies. This bucket was referenced by CoverPhotoUpload.tsx / uploadCover.ts
-- but was never created in the active migrations, causing
-- "Failed to upload cover photo: Bucket not found".
-- ============================================================================

-- Create the covers bucket (public) if it doesn't already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('covers', 'covers', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Users can upload their own cover photos (covers/{userId}/...)
DROP POLICY IF EXISTS "Users can upload their own cover photos" ON storage.objects;
CREATE POLICY "Users can upload their own cover photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own cover photos
DROP POLICY IF EXISTS "Users can update their own cover photos" ON storage.objects;
CREATE POLICY "Users can update their own cover photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own cover photos
DROP POLICY IF EXISTS "Users can delete their own cover photos" ON storage.objects;
CREATE POLICY "Users can delete their own cover photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone (authenticated) can view cover photos
DROP POLICY IF EXISTS "Anyone can view cover photos" ON storage.objects;
CREATE POLICY "Anyone can view cover photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'covers');

-- Public (anon) can view cover photos
DROP POLICY IF EXISTS "Public access to covers" ON storage.objects;
CREATE POLICY "Public access to covers"
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'covers');

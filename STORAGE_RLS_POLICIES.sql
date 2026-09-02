-- ============================================================================
-- Camera-Off Images Storage Bucket - RLS Policies
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to set up RLS policies
-- 
-- Prerequisites:
-- 1. Bucket "camera-off-images" must already exist and be PUBLIC
-- 2. Run this AFTER creating the bucket via dashboard
-- ============================================================================

-- Policy 1: Authenticated users can upload their own camera-off images
CREATE POLICY "Users can upload camera-off images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'camera-off-images' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Public can view all camera-off images (needed for broadcasts)
CREATE POLICY "Public can view camera-off images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'camera-off-images');

-- Policy 3: Users can update their own camera-off images
CREATE POLICY "Users can update own camera-off images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'camera-off-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 4: Users can delete their own camera-off images
CREATE POLICY "Users can delete own camera-off images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'camera-off-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================================
-- Verification Query - Run this after applying policies
-- ============================================================================
-- This confirms the bucket exists and policies are in place:
--
-- SELECT id, name, owner, public FROM storage.buckets WHERE name = 'camera-off-images';
-- SELECT policy_name, definition FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

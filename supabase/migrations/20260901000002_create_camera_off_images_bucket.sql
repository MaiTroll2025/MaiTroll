-- Create camera-off-images storage bucket and set RLS policies

-- Create the bucket (if it doesn't exist, this is idempotent via edge function)
-- Note: Bucket creation is typically done via Supabase dashboard or edge function
-- This file documents the structure. Run via supabase CLI or dashboard.

-- ============================================================================
-- BUCKET SETUP (via Supabase Dashboard):
-- ============================================================================
-- 1. Go to Storage > New Bucket
-- 2. Bucket name: camera-off-images
-- 3. Make it PUBLIC (allow public access to view images)
-- 4. Create bucket

-- ============================================================================
-- RLS POLICIES (run these SQL statements)
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

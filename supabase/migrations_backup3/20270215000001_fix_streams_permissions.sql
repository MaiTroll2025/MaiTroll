-- Fix permission denied for table streams (Error 42501)
-- This migration enables RLS and adds comprehensive policies for streams.

-- 1. Enable RLS on streams
ALTER TABLE streams ENABLE ROW LEVEL SECURITY;

-- 2. Grant permissions
-- Allow authenticated users to insert/update/delete (policies will restrict this)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE streams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE streams TO service_role;
-- Allow anonymous users to view streams (public read access for live streams)
GRANT SELECT ON TABLE streams TO anon;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view streams" ON streams;
DROP POLICY IF EXISTS "Users can insert their own streams" ON streams;
DROP POLICY IF EXISTS "Users can update their own streams" ON streams;
DROP POLICY IF EXISTS "Users can delete their own streams" ON streams;
DROP POLICY IF EXISTS "Admins can manage all streams" ON streams;

-- 4. Create new policies

-- Policy: Public Read Access
-- Everyone can view streams (needed for listing page)
CREATE POLICY "Anyone can view streams"
ON streams
FOR SELECT
USING (true);

-- Policy: Users can insert their own streams
-- Ensures broadcaster_id matches the authenticated user
CREATE POLICY "Users can insert their own streams"
ON streams
FOR INSERT
WITH CHECK (
  auth.uid() = broadcaster_id
);

-- Policy: Users can update their own streams
CREATE POLICY "Users can update their own streams"
ON streams
FOR UPDATE
USING (
  auth.uid() = broadcaster_id
);

-- Policy: Users can delete their own streams
CREATE POLICY "Users can delete their own streams"
ON streams
FOR DELETE
USING (
  auth.uid() = broadcaster_id
);

-- Policy: Admins can manage all streams
CREATE POLICY "Admins can manage all streams"
ON streams
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

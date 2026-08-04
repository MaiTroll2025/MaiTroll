-- Fix streams RLS policy to allow updates by user_id OR broadcaster_id
-- This fixes the "failed to update rgb setting" error if the policy was only checking broadcaster_id

DO $$
BEGIN
  -- Drop the existing policy if it exists (handling potential naming variations)
  DROP POLICY IF EXISTS "Users can update their own streams" ON streams;
  DROP POLICY IF EXISTS "Broadcasters manage streams" ON streams;
  
  -- Re-create the policy checking both columns
  CREATE POLICY "Users can update their own streams"
  ON streams
  FOR UPDATE
  USING (
    auth.uid() = user_id 
    OR 
    auth.uid() = broadcaster_id
  )
  WITH CHECK (
    auth.uid() = user_id 
    OR 
    auth.uid() = broadcaster_id
  );
  
  -- Also ensure the insert policy covers both
  DROP POLICY IF EXISTS "Users can insert their own streams" ON streams;
  CREATE POLICY "Users can insert their own streams"
  ON streams
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id 
    OR 
    auth.uid() = broadcaster_id
  );

END $$;

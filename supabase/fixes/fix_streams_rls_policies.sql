-- Fix RLS policies for streams table to allow public viewing
BEGIN;

-- Drop the overly restrictive read policy
DROP POLICY IF EXISTS authenticated_read ON public.streams;

-- Allow public read access to unprotected streams (anyone, including anonymous)
CREATE POLICY public_read_streams ON public.streams
  FOR SELECT
  TO public
  USING (is_protected = false OR is_protected IS NULL);

-- Keep authenticated users able to read their own protected streams too
CREATE POLICY authenticated_read_own_protected ON public.streams
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR broadcaster_id = auth.uid() OR streamer_id = auth.uid());

-- Ensure INSERT is only allowed for authenticated users creating their own streams
CREATE POLICY authenticated_create_streams ON public.streams
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR broadcaster_id = auth.uid() OR streamer_id = auth.uid());

-- Ensure UPDATE is only allowed for stream owners
CREATE POLICY authenticated_update_own_streams ON public.streams
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR broadcaster_id = auth.uid() OR streamer_id = auth.uid());

-- Ensure DELETE is only allowed for stream owners
CREATE POLICY authenticated_delete_own_streams ON public.streams
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR broadcaster_id = auth.uid() OR streamer_id = auth.uid());

COMMIT;

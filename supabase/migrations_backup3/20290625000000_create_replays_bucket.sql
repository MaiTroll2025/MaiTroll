-- Create storage bucket for broadcast replays
INSERT INTO storage.buckets (id, name, public)
VALUES ('replays', 'replays', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for Treelz clips (used by clips from broadcast recorder)
INSERT INTO storage.buckets (id, name, public)
VALUES ('treelz-videos', 'treelz-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Public can view broadcast replays
CREATE POLICY "Public can view broadcast replays"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'replays');

-- Policy: Authenticated users can upload their own broadcast recordings
CREATE POLICY "Users can upload broadcast replays"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'replays' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own broadcast recordings
CREATE POLICY "Users can update own broadcast replays"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'replays' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own broadcast recordings
CREATE POLICY "Users can delete own broadcast replays"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'replays' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Public can view Treelz clips
CREATE POLICY "Public can view Treelz clips"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'treelz-videos');

-- Policy: Authenticated users can upload Treelz clips
CREATE POLICY "Users can upload Treelz clips"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'treelz-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can update their own Treelz clips
CREATE POLICY "Users can update own Treelz clips"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'treelz-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy: Users can delete their own Treelz clips
CREATE POLICY "Users can delete own Treelz clips"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'treelz-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
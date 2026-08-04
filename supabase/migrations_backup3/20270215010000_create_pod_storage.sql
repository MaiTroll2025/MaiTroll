
-- Create storage bucket for TrollPods covers
INSERT INTO storage.buckets (id, name, public)
VALUES ('pod-covers', 'pod-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload covers
-- CREATE POLICY "Authenticated users can upload pod covers"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'pod-covers');

-- Policy to allow public to view covers
-- CREATE POLICY "Public can view pod covers"
-- ON storage.objects FOR SELECT
-- TO public
-- USING (bucket_id = 'pod-covers');

-- Policy to allow users to update their own covers (if they are the owner)
-- Note: managing ownership of files can be tricky, often just allowing overwrite by same user name or path convention
-- CREATE POLICY "Users can update their own pod covers"
-- ON storage.objects FOR UPDATE
-- TO authenticated
-- USING (bucket_id = 'pod-covers' AND owner = auth.uid());

-- Policy to allow users to delete their own pod covers
-- CREATE POLICY "Users can delete their own pod covers"
-- ON storage.objects FOR DELETE
-- TO authenticated
-- USING (bucket_id = 'pod-covers' AND owner = auth.uid());

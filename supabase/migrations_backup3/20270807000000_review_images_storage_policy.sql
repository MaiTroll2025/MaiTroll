-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view review images" ON storage.objects;

-- Create policy allowing anyone to view review images
CREATE POLICY "Anyone can view review images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-images');

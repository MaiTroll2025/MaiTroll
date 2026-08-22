-- Create city-ads storage bucket for promo ads
-- Fixes "Bucket not found" / "NoSuchBucket" error for promo ad image uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'city-ads',
  'city-ads',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read access for city-ads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload to city-ads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update city-ads" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete city-ads" ON storage.objects;

CREATE POLICY "Public read access for city-ads"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'city-ads');

CREATE POLICY "Admins can upload to city-ads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'city-ads'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

CREATE POLICY "Admins can update city-ads"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'city-ads'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

CREATE POLICY "Admins can delete city-ads"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'city-ads'
  AND EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'secretary')
  )
);

-- ============================================================
-- Storage Bucket Policies
-- Create policies for buckets that have no SQL-defined policies
-- All policies follow the pattern: INSERT scoped to user's own
-- folder, SELECT public (for media) or authenticated, UPDATE/DELETE
-- only by owner.
-- ============================================================

-- ============================================================
-- 1. verification_docs (private bucket)
-- Used for: ID verification documents
-- Access: Users upload to own folder. Only service_role/admin can read.
-- ============================================================

-- INSERT: Users can upload to their own folder
CREATE POLICY "Users can upload own verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'verification_docs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- SELECT: Only service_role can read (admin review via backend)
-- No SELECT policy for authenticated users = only service_role can read

-- ============================================================
-- 2. avatars (public bucket)
-- Used for: User profile avatars
-- Access: Users upload to own folder. Anyone can view.
-- ============================================================

CREATE POLICY "Users can upload own avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- ============================================================
-- 3. troll-city-assets (public bucket)
-- Used for: Fallback asset storage (avatars, covers, etc.)
-- Access: Users upload to own folder. Anyone can view.
-- ============================================================

CREATE POLICY "Users can upload to own troll-city-assets folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'troll-city-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own troll-city-assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'troll-city-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own troll-city-assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'troll-city-assets'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view troll-city-assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'troll-city-assets');

-- ============================================================
-- 4. auction-items (public bucket)
-- Used for: Auction lot/item images
-- Access: Auctioneers/admins upload. Anyone can view.
-- ============================================================

CREATE POLICY "Auctioneers can upload auction items"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'auction-items'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_auctioneer = true OR is_admin = true OR role IN ('admin', 'secretary'))
  )
);

CREATE POLICY "Auctioneers can update auction items"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'auction-items'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_auctioneer = true OR is_admin = true OR role IN ('admin', 'secretary'))
  )
);

CREATE POLICY "Auctioneers can delete auction items"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'auction-items'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_auctioneer = true OR is_admin = true OR role IN ('admin', 'secretary'))
  )
);

CREATE POLICY "Anyone can view auction items"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'auction-items');

-- ============================================================
-- 5. payout_receipts (private bucket)
-- Used for: Payout receipt uploads (admin only)
-- Access: Only admins/secretaries can upload and read.
-- ============================================================

CREATE POLICY "Admins can upload payout receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payout_receipts'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role IN ('admin', 'secretary'))
  )
);

CREATE POLICY "Admins can read payout receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payout_receipts'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR role IN ('admin', 'secretary'))
  )
);

-- ============================================================
-- 6. music_tracks (public bucket)
-- Used for: User-uploaded music tracks
-- Access: Verified creators upload. Anyone can view.
-- ============================================================

CREATE POLICY "Creators can upload music tracks"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'music_tracks'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Creators can delete own music tracks"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'music_tracks'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view music tracks"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'music_tracks');

-- ============================================================
-- 7. post-images (public bucket)
-- Used for: Shop products, vehicle photos, marketplace listings
-- Access: Users upload to own folder. Anyone can view.
-- ============================================================

CREATE POLICY "Users can upload own post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own post images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');

-- ============================================================
-- 8. family-banners (public bucket)
-- Used for: Troll Family profile banners
-- Access: Family members upload. Anyone can view.
-- ============================================================

CREATE POLICY "Users can upload family banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'family-banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update own family banners"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'family-banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete own family banners"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'family-banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Anyone can view family banners"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'family-banners');

-- ============================================================
-- 9. vehicle-documents (private bucket)
-- Used for: VIN verification PDFs
-- Access: Users upload own docs. Only officers/admins can read.
-- ============================================================

CREATE POLICY "Users can upload own vehicle documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Officers can view vehicle documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-documents'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR is_troll_officer = true OR role IN ('admin', 'secretary'))
  )
);

-- ============================================================
-- 10. tax_forms (private bucket)
-- Used for: W9 tax form PDFs
-- Access: Users upload own forms. Only officers/admins can read.
-- ============================================================

CREATE POLICY "Users can upload own tax forms"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tax_forms'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Officers can view tax forms"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tax_forms'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR is_troll_officer = true OR role IN ('admin', 'secretary'))
  )
);

-- ============================================================
-- 11. user-verification (private bucket)
-- Used for: Generic verification file uploads
-- Access: Users upload own files. Only officers/admins can read.
-- ============================================================

CREATE POLICY "Users can upload own verification files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'user-verification'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Officers can view verification files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'user-verification'
  AND EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (is_admin = true OR is_troll_officer = true OR role IN ('admin', 'secretary'))
  )
);

-- ============================================================
-- 12. gift-videos (public bucket)
-- Used for: Gift animation videos
-- Access: Service role only (uploaded by scripts). Anyone can view.
-- ============================================================

CREATE POLICY "Anyone can view gift videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'gift-videos');

-- ============================================================
-- 13. Fix treelz-videos: Add owner-scoped UPDATE/DELETE
-- Currently any authenticated user can delete ANY file
-- ============================================================

-- Add UPDATE policy scoped to owner
CREATE POLICY "Users can update own treelz videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'treelz-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Replace the overly permissive DELETE policy
DROP POLICY IF EXISTS "treelz_videos_delete" ON storage.objects;

CREATE POLICY "Users can delete own treelz videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'treelz-videos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 14. Fix review-images: Add owner-scoped INSERT
-- Currently any authenticated user can upload without folder restriction
-- ============================================================

-- Add owner-scoped INSERT
DROP POLICY IF EXISTS "Authenticated users can upload review images" ON storage.objects;

CREATE POLICY "Users can upload own review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================================
-- 15. Fix appeal-media: Add owner-scoped INSERT
-- Currently any authenticated user can upload without folder restriction
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can upload appeal media" ON storage.objects;

CREATE POLICY "Users can upload own appeal media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'appeal-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

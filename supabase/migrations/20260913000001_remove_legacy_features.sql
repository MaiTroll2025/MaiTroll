-- Migration: Remove Legacy Celeb, Mai Record Label, and Auctions Features
-- Date: 2026-09-13
-- Description: Drops tables, policies, and storage exclusively used by removed features

-- 1. Drop RLS policies for record_label tables
DROP POLICY IF EXISTS "Record labels are viewable by everyone" ON record_labels;
DROP POLICY IF EXISTS "Users can create record labels" ON record_labels;
DROP POLICY IF EXISTS "Owners can update their record labels" ON record_labels;
DROP POLICY IF EXISTS "Owners can delete their record labels" ON record_labels;

-- 2. Drop record_label tables (exclusive to removed feature)
DROP TABLE IF EXISTS record_label_tracks CASCADE;
DROP TABLE IF EXISTS record_label_albums CASCADE;
DROP TABLE IF EXISTS record_label_artist_profiles CASCADE;
DROP TABLE IF EXISTS record_label_applications CASCADE;
DROP TABLE IF EXISTS record_label_contracts CASCADE;
DROP TABLE IF EXISTS record_label_transactions CASCADE;
DROP TABLE IF EXISTS record_label_track_likes CASCADE;
DROP TABLE IF EXISTS record_labels CASCADE;

-- 3. Drop celeb-related tables (exclusive to removed feature)
DROP TABLE IF EXISTS celeb_applications CASCADE;
DROP TABLE IF EXISTS celeb_profiles CASCADE;
DROP TABLE IF EXISTS celeb_stream_sessions CASCADE;

-- 4. Drop auction-related tables (exclusive to removed feature)
DROP TABLE IF EXISTS auction_lots CASCADE;
DROP TABLE IF EXISTS auction_bidders CASCADE;
DROP TABLE IF EXISTS auction_sales CASCADE;
DROP TABLE IF EXISTS auction_shows CASCADE;
DROP TABLE IF EXISTS auction_applications CASCADE;
DROP TABLE IF EXISTS auction_inventory CASCADE;
DROP TABLE IF EXISTS auction_orders CASCADE;
DROP TABLE IF EXISTS auction_packing CASCADE;
DROP TABLE IF EXISTS auction_devices CASCADE;

-- 5. Remove celeb_role and auctioneer columns from user_profiles if they exist
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'celeb_role') THEN
        ALTER TABLE user_profiles DROP COLUMN celeb_role;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_auctioneer') THEN
        ALTER TABLE user_profiles DROP COLUMN is_auctioneer;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_record_label_artist') THEN
        ALTER TABLE user_profiles DROP COLUMN is_record_label_artist;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'is_record_label_admin') THEN
        ALTER TABLE user_profiles DROP COLUMN is_record_label_admin;
    END IF;
END $$;

-- 6. Drop legacy storage policies (storage buckets must be removed via Storage API, not SQL)
DROP POLICY IF EXISTS "Record label tracks are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Record label albums are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Celeb assets are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "Auction items are viewable by everyone" ON storage.objects;

-- 7. Drop legacy RPCs
DROP FUNCTION IF EXISTS submit_celeb_application CASCADE;
DROP FUNCTION IF EXISTS get_celeb_profile CASCADE;
DROP FUNCTION IF EXISTS create_record_label_application CASCADE;
DROP FUNCTION IF EXISTS get_record_label_artist CASCADE;
DROP FUNCTION IF EXISTS submit_auction_application CASCADE;
DROP FUNCTION IF EXISTS get_auction_show CASCADE;
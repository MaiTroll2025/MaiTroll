-- Fix foreign key relationship between payout_requests and user_profiles
-- The existing foreign key incorrectly references user_profiles.user_id instead of user_profiles.id

-- Drop the incorrect foreign key constraint that references user_profiles.user_id
ALTER TABLE IF EXISTS "public"."payout_requests"
    DROP CONSTRAINT IF EXISTS "payout_requests_user_profiles_fkey";

-- Add the correct foreign key constraint referencing user_profiles.id
-- Using a different name to avoid conflict with existing payout_requests_user_id_fkey (references auth.users)
ALTER TABLE ONLY "public"."payout_requests"
    ADD CONSTRAINT "payout_requests_user_id_fkey_to_user_profiles" 
    FOREIGN KEY ("user_id") 
    REFERENCES "public"."user_profiles"("id") 
    ON DELETE SET NULL;

-- Note: The existing payout_requests_user_id_fkey constraint remains unchanged
-- It continues to reference auth.users.id for authentication purposes.
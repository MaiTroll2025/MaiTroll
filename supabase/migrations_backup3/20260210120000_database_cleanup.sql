-- Database Cleanup Migration
-- Removes unused tables and columns from user_profiles
-- Generated: 2026-02-10

-- =============================================================================
-- DROP UNUSED TABLES
-- =============================================================================

DROP TABLE IF EXISTS public.visitor_stats CASCADE;
DROP TABLE IF EXISTS public.troll_events CASCADE;
DROP TABLE IF EXISTS public.user_health_records CASCADE;
DROP TABLE IF EXISTS public.staff_profiles CASCADE;
DROP TABLE IF EXISTS public.troll_dna_profiles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =============================================================================
-- REMOVE UNUSED ECONOMY COLUMNS
-- =============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS sav_bonus_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS owc_balance;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_owc_earned;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS vivied_bonus_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS reserved_paid_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS trollmonds;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS earned_coins;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_coins_earned;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_coins_spent;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS coin_balance;

-- =============================================================================
-- REMOVE MULTIPLIERS
-- =============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_active;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_value;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS multiplier_expires;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS coin_multiplier;

-- =============================================================================
-- REMOVE PAYOUT/FINANCIAL COLUMNS
-- =============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_method;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_details;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_destination_masked;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS preferred_payout_method;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_paypal_email;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_id_last4;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS tax_classification;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS w9_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS w9_verified_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_frozen;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_freeze_reason;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS payout_freeze_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS last_payout_at;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS lifetime_payout_total;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS total_earned_usd;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS creator_trust_score;

-- =============================================================================
-- REMOVE EMPIRE/PARTNER COLUMNS
-- =============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS empire_role;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS empire_partner;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS partner_status;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS is_empire_partner;

-- =============================================================================
-- REMOVE TROLL OFFICER COLUMNS (use role column instead)
-- =============================================================================



-- =============================================================================
-- REMOVE RESTRICTIONS COLUMNS
-- =============================================================================



-- =============================================================================
-- REMOVE INFLUENCER/TIER COLUMNS
-- =============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS influence_tier;

-- =============================================================================
-- REMOVE ID VERIFICATION COLUMNS
-- =============================================================================



-- =============================================================================
-- REMOVE EMPLOYMENT COLUMNS
-- =============================================================================


-- =============================================================================
-- REMOVE USERNAME EFFECTS COLUMNS
-- =============================================================================


-- =============================================================================
-- REMOVE ADDRESS FIELDS
-- =============================================================================

ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS address_line1;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS address_line2;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS state_region;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS postal_code;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS street_address;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS city;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS state;
ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS country;

-- =============================================================================
-- REMOVE IP ADDRESS HISTORY
-- =============================================================================



-- =============================================================================
-- REMOVE OTHER UNUSED COLUMNS
-- =============================================================================


-- =============================================================================
-- NOTE: INSURANCE COLUMNS SHOULD BE IMPLEMENTED WITH KTAUTO DEALERSHIP/PROPERTIES
-- Uncomment below if implementing separate insurance system:
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS has_insurance;
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS insurance_type;
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS insurance_expires_at;
-- ALTER TABLE public.user_profiles DROP COLUMN IF EXISTS insurance_level;
-- =============================================================================

-- Verification complete
DO $$
BEGIN
    RAISE NOTICE 'Database cleanup migration completed successfully';
END $$;

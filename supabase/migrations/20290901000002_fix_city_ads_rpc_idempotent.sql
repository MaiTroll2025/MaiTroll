-- ============================================================================
-- Migration: Make city ads increment RPCs idempotent and remove overloads
-- Date: 2026-09-01
-- Purpose: Prevent "Advertisement not found" errors when flushing batched
--          impressions/clicks for ads that have been deleted or expired.
--          Also resolve PostgREST overloading ambiguity by dropping any
--          existing parameter-type variants before recreating with BIGINT.
-- ============================================================================

-- Drop all possible overloads to avoid PostgREST ambiguity
DROP FUNCTION IF EXISTS public.increment_ad_impressions(UUID, BIGINT);
DROP FUNCTION IF EXISTS public.increment_ad_impressions(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.increment_ad_impressions(UUID);
DROP FUNCTION IF EXISTS public.increment_ad_clicks(UUID, BIGINT);
DROP FUNCTION IF EXISTS public.increment_ad_clicks(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.increment_ad_clicks(UUID);

CREATE OR REPLACE FUNCTION public.increment_ad_impressions(ad_id UUID, count BIGINT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE public.city_ads
    SET impressions_count = impressions_count + count
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_ad_clicks(ad_id UUID, count BIGINT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE public.city_ads
    SET clicks_count = clicks_count + count
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_ad_impressions(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ad_clicks(UUID, BIGINT) TO authenticated;

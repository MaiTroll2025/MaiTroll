-- ============================================================================
-- Bug Center Fixes — 2026-07-20
-- Addresses reproducible schema/function issues from the bug center export.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. increment_ad_clicks: accept an optional aggregated `count` argument.
--    The frontend (src/lib/batchWrites.ts) batches clicks and calls
--    increment_ad_clicks(ad_id, count), but the deployed function only
--    accepted (ad_id), producing PGRST202
--    "Could not find the function public.increment_ad_clicks(ad_id, count)".
--    We add the (ad_id, count) overload and keep a single-arg wrapper.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_ad_clicks(ad_id UUID, count BIGINT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE public.city_ads
    SET clicks_count = clicks_count + count
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_ad_clicks(UUID, BIGINT) TO anon, authenticated;

-- Keep impressions in sync / idempotent as well (same shape as clicks).
CREATE OR REPLACE FUNCTION public.increment_ad_impressions(ad_id UUID, count BIGINT DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE public.city_ads
    SET impressions_count = impressions_count + count
    WHERE id = ad_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_ad_impressions(UUID, BIGINT) TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. Ask PostgREST to reload its schema cache so newly created/updated
--    functions (e.g. is_universe_admin, increment_ad_clicks) become visible.
--    PGRST202 for public.is_universe_admin indicates the function migration
--    (20260718000002_universe_battles_rls.sql) had not been picked up by the
--    running API's schema cache.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    -- Re-assert is_universe_admin in case the battles migration was skipped.
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'is_universe_admin'
    ) THEN
        RAISE NOTICE 'is_universe_admin missing — ensure 20260718000002_universe_battles_rls.sql was applied';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';

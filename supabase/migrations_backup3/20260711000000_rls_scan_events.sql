-- ============================================================================
-- RLS POLICIES — AUCTION SCAN EVENTS / DEVICE SESSIONS
-- Forward-only supplement for policies that failed in the prior migration.
-- Self-contained: re-creates the guarded helper, applies policies, drops helper.
-- ============================================================================

-- Generic guarded policy helper (idempotent).
CREATE OR REPLACE FUNCTION create_rls_policy(
  p_table TEXT, p_policy TEXT, p_cmd TEXT, p_using TEXT, p_check TEXT DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=p_table AND policyname=p_policy) THEN
    RETURN;
  END IF;
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR %s%s%s',
    p_policy, p_table, p_cmd,
    CASE WHEN p_using IS NOT NULL THEN ' USING (' || p_using || ')' ELSE '' END,
    CASE WHEN p_check IS NOT NULL THEN ' WITH CHECK (' || p_check || ')' ELSE '' END
  );
END;
$$ LANGUAGE plpgsql;

-- Ensure RLS is enabled on both tables.
ALTER TABLE IF EXISTS auction_device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS auction_scan_events ENABLE ROW LEVEL SECURITY;

-- Device sessions: auctioneer owner only.
SELECT create_rls_policy('auction_device_sessions','dev_owner_all','ALL',
  'auctioneer_id = (SELECT id FROM auctioneer_profiles WHERE user_id = auth.uid())',
  'auctioneer_id = (SELECT id FROM auctioneer_profiles WHERE user_id = auth.uid())');

-- Scan events: show auctioneer owner only (auction_scan_events.auction_id -> auction_shows.id).
SELECT create_rls_policy('auction_scan_events','scan_owner_read','SELECT','is_show_auctioneer(auction_id)');

DROP FUNCTION IF EXISTS create_rls_policy(TEXT, TEXT, TEXT, TEXT, TEXT);

-- ============================================================
-- PAGE VISIBILITY / UNDER CONSTRUCTION SYSTEM
-- ============================================================
-- Allows admins to mark pages as "Under Construction" so that
-- non-admin users are blocked from accessing them.
-- Admins can still access all pages for testing.
-- ============================================================

-- Drop if exists for idempotency
DROP TABLE IF EXISTS public.page_visibility;

CREATE TABLE public.page_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_path TEXT NOT NULL UNIQUE,
  page_name TEXT NOT NULL,
  is_under_construction BOOLEAN NOT NULL DEFAULT false,
  uc_message TEXT DEFAULT 'This page is currently under construction.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_page_visibility_route ON public.page_visibility(route_path);
CREATE INDEX idx_page_visibility_uc ON public.page_visibility(is_under_construction) WHERE is_under_construction = true;

-- RLS: Everyone can read (needed for route guards)
ALTER TABLE public.page_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read page visibility"
  ON public.page_visibility
  FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can insert page visibility"
  ON public.page_visibility
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'superadmin', 'ceo') OR is_admin = true)
    )
  );

CREATE POLICY "Only admins can update page visibility"
  ON public.page_visibility
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'superadmin', 'ceo') OR is_admin = true)
    )
  );

CREATE POLICY "Only admins can delete page visibility"
  ON public.page_visibility
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (role IN ('admin', 'superadmin', 'ceo') OR is_admin = true)
    )
  );

-- ============================================================
-- Seed all known public-facing routes
-- ============================================================
INSERT INTO public.page_visibility (route_path, page_name, is_under_construction) VALUES
  -- Core pages
  ('/', 'Home', false),
  ('/home', 'Home', false),
  ('/live', 'Live Feed', false),
  ('/wall', 'Mai Troll Wall', false),
  ('/search', 'Search', false),
  ('/notifications', 'Notifications', false),
  ('/following', 'Following', false),

  -- Profile
  ('/profile', 'My Profile', false),
  ('/profile/settings', 'Profile Settings', false),
  ('/profile/delete', 'Delete Account', false),

  -- Broadcast / Watch
  ('/broadcast', 'Broadcast', false),
  ('/watch', 'Watch Stream', false),

  -- Marketplace & Commerce
  ('/marketplace', 'Marketplace', false),
  ('/shop', 'Shop', false),
  ('/inventory', 'User Inventory', false),
  ('/sell', 'Sell on Mai Troll', false),

  -- Gaming
  ('/troll-games', 'Troll Games', false),
  ('/troll-wheel', 'Troll Wheel', false),
  ('/gaming', 'Gaming', false),

  -- City & Government
  ('/city-registry', 'City Registry', false),
  ('/government', 'Government', false),
  ('/president', 'President', false),
  ('/map', 'City Map', false),
  ('/district', 'District Tour', false),

  -- Social
  ('/utromail', 'UTroMail', false),
  ('/tromail', 'Tromail', false),
  ('/tcps', 'TCPS', false),
  ('/match', 'Troll Match', false),
  ('/trollifications', 'Trollifications', false),
  ('/trollifieds', 'Trollifieds', false),

  -- Finance
  ('/bank', 'Troll Bank', false),
  ('/wallet', 'Wallet', false),
  ('/coin-store', 'Coin Store', false),
  ('/earnings', 'My Earnings', false),
  ('/cashout', 'Cashout', false),
  ('/credit-scores', 'Credit Scores', false),
  ('/leaderboard', 'Leaderboard', false),

  -- Family
  ('/families', 'Troll Families', false),
  ('/family', 'Family Profile', false),
  ('/family-wars', 'Family Wars', false),

  -- Academy
  ('/academy', 'Academy', false),
  ('/academy/courses', 'Course Catalog', false),

  -- Church
  ('/church', 'Church', false),

  -- Court & Jail
  ('/court', 'Troll Court', false),
  ('/jail', 'Jail', false),
  ('/inmates', 'Inmates', false),

  -- Auctions
  ('/auctions', 'Live Auctions', false),

  -- Podcast
  ('/podcast', 'Podcast Central', false),

  -- TCNN
  ('/tcnn', 'TCNN News', false),

  -- Car Dealership
  ('/ktauto', 'Car Dealership', false),

  -- Insurance
  ('/insurance', 'Insurance', false),

  -- Troting
  ('/troting', 'Troting', false),

  -- Public Pool
  ('/pool', 'Public Pool', false),

  -- Safety
  ('/safety', 'Safety', false),

  -- Support
  ('/support', 'Support', false),

  -- Career
  ('/career', 'Career', false),

  -- Agency
  ('/agencies', 'Agencies', false),
  ('/agency-dashboard', 'Agency Dashboard', false),

  -- Officer
  ('/officer', 'Officer Dashboard', false),
  ('/officer-scheduling', 'Officer Scheduling', false),

  -- Legal
  ('/terms', 'Terms of Service', false),
  ('/privacy', 'Privacy Policy', false),
  ('/refund-policy', 'Refund Policy', false),

  -- Other
  ('/giveaways', 'Giveaways', false),
  ('/universe-event', 'Universe Event', false),
  ('/neighborhood-map', 'Neighborhood Map', false),
  ('/living', 'Living', false),
  ('/blocked-users', 'Blocked Users', false),
  ('/changelog', 'Changelog', false),
  ('/stream-swipe', 'Stream Swipe', false),
  ('/explore', 'Explore Feed', false),
  ('/stats', 'Stats', false),
  ('/tax-onboarding', 'Tax Onboarding', false),
  ('/bonuses', 'Bonuses', false),
  ('/transactions', 'Transaction History', false),
  ('/payout-request', 'Payout Request', false),
  ('/payout-status', 'Payout Status', false),
  ('/verification', 'Verification', false),
  ('/apply', 'Application', false),
  ('/join', 'Join Page', false),
  ('/safety-guidelines', 'Safety Guidelines', false),
  ('/gambling-disclosure', 'Gambling Disclosure', false),
  ('/creator-earnings', 'Creator Earnings', false),
  ('/creator-onboarding', 'Creator Onboarding', false),
  ('/creator-switch', 'Creator Switch Program', false),
  ('/shop-partner', 'Shop Partner', false),
  ('/shop-earnings', 'Shop Earnings', false),
  ('/my-orders', 'My Orders', false),
  ('/seller-orders', 'Seller Orders', false),
  ('/coins-complete', 'Coins Complete', false),
  ('/withdraw', 'Withdraw', false),
  ('/driver-test', 'Driver Test', false),
  ('/neighborhood-setup', 'Neighborhood Onboarding', false),
  ('/embed', 'Embed Page', false),
  ('/kick-fee', 'Kick Fee', false),
  ('/shareathon', 'Share-A-Thon', false),
  ('/rfc', 'RFC', false),
  ('/ceo-assistant', 'CEO Assistant', false),
  ('/noah-assistant', 'Noah Assistant', false),
  ('/treasury', 'Treasury', false),
  ('/secretary', 'Secretary Dashboard', false),
  ('/prosecutor', 'Prosecutor Dashboard', false),
  ('/attorney', 'Attorney Dashboard', false),
  ('/officer-owc', 'Officer OWC', false),
  ('/officer-vote', 'Officer Vote', false),
  ('/officer-payroll', 'Officer Payroll', false),
  ('/lead-officer', 'Lead Officer Dashboard', false),
  ('/pastor', 'Pastor Dashboard', false),
  ('/family-shop', 'Family Shop', false),
  ('/family-leaderboard', 'Family Leaderboard', false),
  ('/officer-moderation', 'Officer Moderation', false),
  ('/officer-lounge', 'Officer Lounge', false),
  ('/live-command', 'Live Command Center', false),
  ('/audio-settings', 'Audio Settings', false),
  ('/auction-studio', 'Auction Studio', false),
  ('/auctioneer', 'Auctioneer Dashboard', false),
  ('/my-auction-shows', 'My Auction Shows', false),
  ('/auction-reports', 'Auction Reports', false),
  ('/auction-bidders', 'Auction Bidders', false),
  ('/auction-sales', 'Auction Sales', false),
  ('/auction-analytics', 'Auction Analytics', false),
  ('/auction-settings', 'Auction Settings', false),
  ('/auction-inventory', 'Auction Inventory', false),
  ('/admin-auction-apps', 'Admin Auction Apps', false),
  ('/tax-upload', 'Tax Upload', false),
  ('/tax-review', 'Tax Review', false),
  ('/payout-setup', 'Payout Setup', false),
  ('/payout-callback', 'Payment Callback', false),
  ('/report', 'Report Details', false),
  ('/password-reset', 'Password Reset', false),
  ('/exit', 'Exit Page', false),
  ('/founding-officer', 'Founding Officer Trial', false),
  ('/tm-family-invite', 'TrollMatch Family Invite', false),
  ('/homepage-backgrounds', 'Homepage Backgrounds', false),
  ('/theme-preview', 'Theme Preview', false)
ON CONFLICT (route_path) DO NOTHING;

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_page_visibility_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_page_visibility_timestamp
  BEFORE UPDATE ON public.page_visibility
  FOR EACH ROW
  EXECUTE FUNCTION update_page_visibility_timestamp();

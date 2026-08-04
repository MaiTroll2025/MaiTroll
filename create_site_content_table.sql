-- ============================================================================
-- SITE CONTENT TABLE — Admin-managed floating poster content
-- ============================================================================
-- Stores the cashout tiers display, weekly pay info, and quick coin store
-- configuration for the homepage FloatingPoster component.
--
-- RLS Policy: Everyone (anon + authenticated) can SELECT.
--             Only users with role = 'admin' can INSERT/UPDATE/DELETE.
-- ============================================================================

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.site_content (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_key     text NOT NULL UNIQUE,          -- e.g. 'homepage_poster'
  title           text NOT NULL DEFAULT '',
  subtitle        text NOT NULL DEFAULT '',
  -- Cashout tiers JSON array: [{ "coins": 7500, "usd": 25, "label": "Tier 1", "color": "#cd7f32" }, ...]
  cashout_tiers   jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Weekly pay info
  weekly_pay_title    text NOT NULL DEFAULT 'Weekly Pay',
  weekly_pay_subtitle text NOT NULL DEFAULT 'Payouts processed every Friday',
  -- Quick coin store: array of package IDs to feature
  featured_packages   text[] NOT NULL DEFAULT '{}',
  -- Free-form extra sections (breakdown percentages, promo text, etc.)
  extra               jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Status
  is_active       boolean NOT NULL DEFAULT true,
  -- Audit
  updated_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- 3. Policies

  -- Everyone can read active content
DROP POLICY IF EXISTS "site_content_select_all" ON public.site_content;
CREATE POLICY "site_content_select_all"
  ON public.site_content
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

  -- Only admins can insert
DROP POLICY IF EXISTS "site_content_insert_admin" ON public.site_content;
CREATE POLICY "site_content_insert_admin"
  ON public.site_content
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

  -- Only admins can update
DROP POLICY IF EXISTS "site_content_update_admin" ON public.site_content;
CREATE POLICY "site_content_update_admin"
  ON public.site_content
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

  -- Only admins can delete
DROP POLICY IF EXISTS "site_content_delete_admin" ON public.site_content;
CREATE POLICY "site_content_delete_admin"
  ON public.site_content
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'admin'
    )
  );

-- 4. updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_site_content_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_content_updated_at ON public.site_content;
CREATE TRIGGER site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.handle_site_content_updated_at();

-- 5. Seed default homepage poster content (based on current CASHOUT_TIERS)
INSERT INTO public.site_content (
  content_key,
  title,
  subtitle,
  cashout_tiers,
  weekly_pay_title,
  weekly_pay_subtitle,
  featured_packages,
  extra,
  is_active
)
VALUES (
  'homepage_poster',
  'Earn & Cash Out',
  'Mai Troll Rewards Hub',
  '[
    {"coins": 7500,  "usd": 25,  "label": "Tier 1", "color": "#cd7f32"},
    {"coins": 15000, "usd": 50,  "label": "Tier 2", "color": "#c0c0c0"},
    {"coins": 30000, "usd": 150, "label": "Tier 3", "color": "#ffd700"},
    {"coins": 60000, "usd": 300, "label": "Tier 4", "color": "#ff4dd2"},
    {"coins": 120000,"usd": 600, "label": "Tier 5", "color": "#00ff00"},
    {"coins": 200000,"usd": 1000,"label": "Tier 6", "color": "#ff0000", "note": "Manual Review"},
    {"coins": 400000,"usd": 2000,"label": "Tier 7", "color": "#ff0000", "note": "Manual Review"},
    {"coins": 600000,"usd": 3000,"label": "Tier 8", "color": "#ff0000", "note": "Manual Review"}
  ]'::jsonb,
  'Weekly Pay',
  'Payouts processed every Friday',
  ARRAY['pkg-500', 'pkg-1000', 'pkg-2500', 'pkg-5000', 'pkg-10000'],
  '{
    "breakdown": [
      {"label": "Gifts Received",    "value": "70%", "color": "from-pink-500 to-rose-500"},
      {"label": "Battle Winnings",   "value": "15%", "color": "from-yellow-500 to-orange-500"},
      {"label": "Missions & Tasks",  "value": "10%", "color": "from-cyan-500 to-blue-500"},
      {"label": "Other",             "value": "5%",  "color": "from-slate-400 to-slate-500"}
    ]
  }'::jsonb,
  true
)
ON CONFLICT (content_key) DO NOTHING;

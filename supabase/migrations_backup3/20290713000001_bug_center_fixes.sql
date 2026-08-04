-- Bug Center Fixes Migration
-- Fixes multiple schema issues reported in bug center export
-- Date: 2026-07-13

-- ============================================================================
-- 1. Create city_ads table (missing from migrations)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.city_ads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  image_url text NOT NULL,
  cta_text text,
  cta_link text,
  placement text NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  start_at timestamp with time zone,
  end_at timestamp with time zone,
  priority integer DEFAULT 0 NOT NULL,
  display_order integer DEFAULT 0 NOT NULL,
  label text,
  campaign_type text,
  background_style text,
  impressions_count integer DEFAULT 0 NOT NULL,
  clicks_count integer DEFAULT 0 NOT NULL,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  maitalent_campaign_id text,
  maitalent_platform text DEFAULT 'maitalent'::text,
  maitalent_target_audience jsonb
);

ALTER TABLE public.city_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "city_ads_select_policy" ON public.city_ads FOR SELECT USING (true);
CREATE POLICY "city_ads_insert_policy" ON public.city_ads FOR INSERT WITH CHECK (auth.uid() = created_by OR is_admin(auth.uid()));
CREATE POLICY "city_ads_update_policy" ON public.city_ads FOR UPDATE USING (auth.uid() = created_by OR is_admin(auth.uid()));
CREATE POLICY "city_ads_delete_policy" ON public.city_ads FOR DELETE USING (auth.uid() = created_by OR is_admin(auth.uid()));

-- ============================================================================
-- 2. Fix daily_logins foreign key - should reference public.users, not auth.users
-- ============================================================================
ALTER TABLE public.daily_logins DROP CONSTRAINT IF EXISTS daily_logins_user_id_fkey;

ALTER TABLE ONLY public.daily_logins
  ADD CONSTRAINT daily_logins_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- ============================================================================
-- 3. Add missing title column to shop_items (frontend queries use 'title', schema has 'name')
-- ============================================================================
ALTER TABLE public.shop_items ADD COLUMN IF NOT EXISTS title text;

-- Backfill title from name where title is null
UPDATE public.shop_items SET title = name WHERE title IS NULL;

-- ============================================================================
-- 4. Add missing replies column to troll_wall_posts
-- ============================================================================
ALTER TABLE public.troll_wall_posts ADD COLUMN IF NOT EXISTS replies integer DEFAULT 0 NOT NULL;

-- ============================================================================
-- 5. Fix JWT user_not_found - ensure user_profiles syncs with auth.users
-- ============================================================================
-- This creates a trigger to auto-create user_profiles when auth.users is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, username, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    NEW.email,
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. Create missing neighborhoods table and related tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.neighborhoods (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zip_code TEXT NOT NULL DEFAULT '00001',
  officer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.neighborhoods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view neighborhoods" ON public.neighborhoods FOR SELECT USING (true);
CREATE POLICY "Users can create neighborhoods" ON public.neighborhoods FOR INSERT WITH CHECK (auth.uid() = leader_user_id);
CREATE POLICY "Leaders can update neighborhoods" ON public.neighborhoods FOR UPDATE USING (auth.uid() = leader_user_id);
CREATE POLICY "Leaders can delete neighborhoods" ON public.neighborhoods FOR DELETE USING (auth.uid() = leader_user_id);

CREATE TABLE IF NOT EXISTS public.neighborhood_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  neighborhood_id UUID NOT NULL REFERENCES public.neighborhoods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'follower' CHECK (role IN ('leader', 'officer', 'follower')),
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(neighborhood_id, user_id)
);

ALTER TABLE public.neighborhood_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public view neighborhood members" ON public.neighborhood_members FOR SELECT USING (true);
CREATE POLICY "Leaders can manage members" ON public.neighborhood_members FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.neighborhoods WHERE id = neighborhood_id AND leader_user_id = auth.uid())
);
CREATE POLICY "Leaders can update members" ON public.neighborhood_members FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.neighborhoods WHERE id = neighborhood_id AND leader_user_id = auth.uid())
);
CREATE POLICY "Leaders can remove members" ON public.neighborhood_members FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.neighborhoods WHERE id = neighborhood_id AND leader_user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.neighborhood_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  leader_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  follower_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMPTZ,
  UNIQUE(leader_user_id, follower_user_id)
);

ALTER TABLE public.neighborhood_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invites" ON public.neighborhood_invites FOR SELECT USING (
  auth.uid() = leader_user_id OR auth.uid() = follower_user_id
);
CREATE POLICY "Leaders can send invites" ON public.neighborhood_invites FOR INSERT WITH CHECK (
  auth.uid() = leader_user_id
);
CREATE POLICY "Followers can accept invites" ON public.neighborhood_invites FOR UPDATE USING (
  auth.uid() = follower_user_id
);

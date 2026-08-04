CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text,
    title text,
    message text,
    content text,
    metadata jsonb DEFAULT '{}'::jsonb,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    is_read boolean DEFAULT false,
    is_sent boolean DEFAULT false,
    body text
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- homeowners_insurances table
CREATE TABLE IF NOT EXISTS public.homeowners_insurances (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    house_id uuid,
    status text DEFAULT 'active',
    is_active boolean DEFAULT true,
    plan_id text,
    coverage_type text DEFAULT 'basic',
    cost_paid integer DEFAULT 0,
    deductible integer DEFAULT 25,
    duration_hours integer DEFAULT 720,
    purchased_at timestamptz,
    claims_made integer DEFAULT 0,
    expires_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.homeowners_insurances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own homeowners insurance" ON public.homeowners_insurances;
CREATE POLICY "Users can view their own homeowners insurance"
  ON public.homeowners_insurances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own homeowners insurance" ON public.homeowners_insurances;
CREATE POLICY "Users can insert their own homeowners insurance"
  ON public.homeowners_insurances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own homeowners insurance" ON public.homeowners_insurances;
CREATE POLICY "Users can update their own homeowners insurance"
  ON public.homeowners_insurances FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_homeowners_insurances_user_id ON public.homeowners_insurances(user_id);

-- profile_views table
CREATE TABLE IF NOT EXISTS public.profile_views (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    viewed_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, viewed_user_id, created_at)
);

ALTER TABLE public.profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile views" ON public.profile_views;
CREATE POLICY "Users can view their own profile views"
  ON public.profile_views FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own profile views" ON public.profile_views;
CREATE POLICY "Users can insert their own profile views"
  ON public.profile_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_profile_views_user_id ON public.profile_views(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_user_id ON public.profile_views(viewed_user_id);

-- user_relationships table
CREATE TABLE IF NOT EXISTS public.user_relationships (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    related_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, related_user_id)
);

ALTER TABLE public.user_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own relationships" ON public.user_relationships;
CREATE POLICY "Users can view their own relationships"
  ON public.user_relationships FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = related_user_id);

DROP POLICY IF EXISTS "Users can insert their own relationships" ON public.user_relationships;
CREATE POLICY "Users can insert their own relationships"
  ON public.user_relationships FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own relationships" ON public.user_relationships;
CREATE POLICY "Users can update their own relationships"
  ON public.user_relationships FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = related_user_id);

CREATE INDEX IF NOT EXISTS idx_user_relationships_user_id ON public.user_relationships(user_id);
CREATE INDEX IF NOT EXISTS idx_user_relationships_related_user_id ON public.user_relationships(related_user_id);

-- trollmin_profiles table
CREATE TABLE IF NOT EXISTS public.trollmin_profiles (
    user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    level integer DEFAULT 1,
    xp integer DEFAULT 0,
    coins_earned integer DEFAULT 0,
    streak integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.trollmin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own trollmin profile" ON public.trollmin_profiles;
CREATE POLICY "Users can view their own trollmin profile"
  ON public.trollmin_profiles FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own trollmin profile" ON public.trollmin_profiles;
CREATE POLICY "Users can update their own trollmin profile"
  ON public.trollmin_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- trollmin_actions table
CREATE TABLE IF NOT EXISTS public.trollmin_actions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    action_type text NOT NULL,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trollmin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own trollmin actions" ON public.trollmin_actions;
CREATE POLICY "Users can view their own trollmin actions"
  ON public.trollmin_actions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own trollmin actions" ON public.trollmin_actions;
CREATE POLICY "Users can insert their own trollmin actions"
  ON public.trollmin_actions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_trollmin_actions_user_id ON public.trollmin_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_trollmin_actions_created_at ON public.trollmin_actions(created_at);

-- entrance_effects table
CREATE TABLE IF NOT EXISTS public.entrance_effects (
    id text PRIMARY KEY,
    name text NOT NULL,
    icon text NOT NULL,
    coin_cost integer NOT NULL,
    rarity text NOT NULL,
    description text,
    animation_type text,
    sound_effect text,
    duration_seconds integer DEFAULT 5,
    image_url text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.entrance_effects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active entrance effects" ON public.entrance_effects;
CREATE POLICY "Anyone can view active entrance effects"
  ON public.entrance_effects FOR SELECT
  USING (is_active = true);

-- Grant permissions
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.homeowners_insurances TO authenticated;
GRANT ALL ON TABLE public.profile_views TO authenticated;
GRANT ALL ON TABLE public.user_relationships TO authenticated;
GRANT ALL ON TABLE public.trollmin_profiles TO authenticated;
GRANT ALL ON TABLE public.trollmin_actions TO authenticated;
GRANT ALL ON TABLE public.entrance_effects TO authenticated;

-- Troll Church Migration

-- 1. Update user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_pastor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS church_notifications_enabled BOOLEAN DEFAULT true;

-- 2. Church Passages (for caching and archive)
CREATE TABLE IF NOT EXISTS public.church_passages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,
    reference TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.church_passages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view church passages" ON public.church_passages
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors/Admins can manage passages" ON public.church_passages
        FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Church Prayers
CREATE TABLE IF NOT EXISTS public.church_prayers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    likes_count INTEGER DEFAULT 0
);

ALTER TABLE public.church_prayers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view prayers" ON public.church_prayers
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can create prayers" ON public.church_prayers
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Users can delete own prayers" ON public.church_prayers
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors/Admins can delete any prayer" ON public.church_prayers
        FOR DELETE USING (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Prayer Likes
CREATE TABLE IF NOT EXISTS public.church_prayer_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL REFERENCES public.church_prayers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(prayer_id, user_id)
);

ALTER TABLE public.church_prayer_likes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can like" ON public.church_prayer_likes
        FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Authenticated users can unlike" ON public.church_prayer_likes
        FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Anyone can view likes" ON public.church_prayer_likes
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Add Church Attendee Badge
INSERT INTO public.badge_catalog (slug, name, description, icon_url, category, created_at)
VALUES (
    'church_attendee',
    'Church Attendee',
    'Attended a Troll Church service.',
    'church', -- Will map to an icon in frontend
    'social',
    now()
) ON CONFLICT (slug) DO NOTHING;

-- 6. Trigger to update likes count
CREATE OR REPLACE FUNCTION update_prayer_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.church_prayers
        SET likes_count = likes_count + 1
        WHERE id = NEW.prayer_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.church_prayers
        SET likes_count = likes_count - 1
        WHERE id = OLD.prayer_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_prayer_likes_trigger ON public.church_prayer_likes;
CREATE TRIGGER update_prayer_likes_trigger
AFTER INSERT OR DELETE ON public.church_prayer_likes
FOR EACH ROW EXECUTE FUNCTION update_prayer_likes_count();

-- 7. Pastor Sermon Notes (Optional, for Pastor Dashboard)
CREATE TABLE IF NOT EXISTS public.church_sermon_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pastor_id UUID NOT NULL REFERENCES public.user_profiles(id),
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(pastor_id, date)
);

ALTER TABLE public.church_sermon_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Pastors can manage own notes" ON public.church_sermon_notes
        FOR ALL USING (auth.uid() = pastor_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Ensure church_prayer_replies table exists (idempotent safeguard)
-- Original definition: 20260530000000_church_live_and_mod.sql

CREATE TABLE IF NOT EXISTS public.church_prayer_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prayer_id UUID NOT NULL REFERENCES public.church_prayers(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.church_prayer_replies ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Anyone can view prayer replies" ON public.church_prayer_replies
        FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors can create replies" ON public.church_prayer_replies
        FOR INSERT WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (is_pastor = true OR role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE POLICY "Pastors can manage own replies" ON public.church_prayer_replies
        FOR ALL USING (
            auth.uid() = pastor_id OR EXISTS (
                SELECT 1 FROM public.user_profiles
                WHERE id = auth.uid() AND (role = 'admin' OR is_admin = true)
            )
        );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_church_prayer_replies_prayer ON public.church_prayer_replies(prayer_id);

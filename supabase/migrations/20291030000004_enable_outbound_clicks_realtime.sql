-- Enable realtime on outbound_clicks so the admin monitor can subscribe live.
-- The table itself was created by 20260422000000_add_admin_analytics.sql (backup
-- migration). This migration is idempotent: it (re)creates the table with
-- IF NOT EXISTS and adds it to supabase_realtime if not already present.

CREATE TABLE IF NOT EXISTS public.outbound_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_user_id ON public.outbound_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_url ON public.outbound_clicks(url);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_clicked_at ON public.outbound_clicks(clicked_at);

ALTER TABLE public.outbound_clicks ENABLE ROW LEVEL SECURITY;

-- Policies: CREATE POLICY does not support IF NOT EXISTS, so guard them in a
-- DO block and only create them when they don't already exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Allow all to insert outbound clicks'
      AND polrelid = 'public.outbound_clicks'::regclass
  ) THEN
    CREATE POLICY "Allow all to insert outbound clicks" ON public.outbound_clicks
      FOR INSERT WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Admins can view outbound clicks'
      AND polrelid = 'public.outbound_clicks'::regclass
  ) THEN
    CREATE POLICY "Admins can view outbound clicks" ON public.outbound_clicks
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles
          WHERE id = auth.uid()
          AND (is_admin = true OR role = 'admin')
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can view own clicks'
      AND polrelid = 'public.outbound_clicks'::regclass
  ) THEN
    CREATE POLICY "Users can view own clicks" ON public.outbound_clicks
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'outbound_clicks'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.outbound_clicks;
    RAISE NOTICE 'Added outbound_clicks to supabase_realtime';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
SELECT 'outbound_clicks realtime enabled' AS result;
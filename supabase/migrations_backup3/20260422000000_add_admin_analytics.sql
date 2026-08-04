-- Admin Analytics: Track outbound link clicks
-- Migration: 20260422000000_add_admin_analytics.sql

-- Table: outbound_clicks
-- Tracks when users click on external links (e.g., maiMai Troll.com)
CREATE TABLE IF NOT EXISTS public.outbound_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_user_id ON public.outbound_clicks(user_id);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_url ON public.outbound_clicks(url);
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_clicked_at ON public.outbound_clicks(clicked_at);

-- RLS: admins can view all, users can insert their own clicks
ALTER TABLE public.outbound_clicks ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to insert (tracking)
CREATE POLICY "Allow all to insert outbound clicks" ON public.outbound_clicks
  FOR INSERT WITH CHECK (true);

-- Policy: Only admins can view
CREATE POLICY "Admins can view outbound clicks" ON public.outbound_clicks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
      AND (is_admin = true OR role = 'admin')
    )
  );

-- Policy: Users can view their own clicks (optional)
CREATE POLICY "Users can view own clicks" ON public.outbound_clicks
  FOR SELECT USING (auth.uid() = user_id);

-- Refresh schema
NOTIFY pgrst, 'reload schema';

SELECT 'Analytics tables created' AS result;

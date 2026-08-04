-- ============================================================================
-- CLEAN NOTIFICATION SYSTEM SETUP
-- ============================================================================
-- This creates the offline_notifications table for the queue processor.
-- The web_push_subscriptions table already exists with correct schema.
-- ============================================================================

-- OFFLINE_NOTIFICATIONS TABLE (for queued push notifications)
CREATE TABLE IF NOT EXISTS public.offline_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT,
  url TEXT,
  data JSONB,
  priority TEXT DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'delivered', 'failed')),
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  delivered_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offline_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own offline notifications"
  ON public.offline_notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own offline notifications"
  ON public.offline_notifications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own offline notifications"
  ON public.offline_notifications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can update all (for Edge Function)
CREATE POLICY "Service role can update all offline notifications"
  ON public.offline_notifications
  FOR UPDATE
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_offline_notifications_user_id ON public.offline_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_offline_notifications_status ON public.offline_notifications(status);
CREATE INDEX IF NOT EXISTS idx_offline_notifications_created_at ON public.offline_notifications(created_at DESC);
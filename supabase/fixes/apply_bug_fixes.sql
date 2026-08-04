-- Apply bug fixes directly to remote database

-- 1. Add missing streams columns
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS microphone_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_reason TEXT,
  ADD COLUMN IF NOT EXISTS rtc_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 2. Add missing broadcast_league_stats columns
ALTER TABLE public.broadcast_league_stats
  ADD COLUMN IF NOT EXISTS sub_tier TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS league_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gifts_sent INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_xp BIGINT DEFAULT 0;

-- 3. Create missing tables
CREATE TABLE IF NOT EXISTS public.user_promo_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  source_type TEXT,
  token_amount INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_info JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  session_id TEXT,
  user_agent TEXT,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Add missing FK constraints (only for existing tables)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'president_proposals') THEN
    ALTER TABLE public.president_proposals
      ADD CONSTRAINT president_proposals_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stream_seat_sessions') THEN
    ALTER TABLE public.stream_seat_sessions
      ADD CONSTRAINT stream_seat_sessions_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stream_viewers') THEN
    ALTER TABLE public.stream_viewers
      ADD CONSTRAINT stream_viewers_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_subscriptions') THEN
    ALTER TABLE public.user_subscriptions
      ADD CONSTRAINT user_subscriptions_subscriber_id_fkey
        FOREIGN KEY (subscriber_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Create missing RPC functions
CREATE OR REPLACE FUNCTION public.update_stream_viewer_count(
  p_count INTEGER,
  p_stream_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.streams
  SET current_viewers = p_count,
      viewer_count = p_count,
      updated_at = now()
  WHERE id = p_stream_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.issue_promo_card(
  p_metadata JSONB,
  p_source_type TEXT,
  p_token_amount INTEGER,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_promo_id UUID;
BEGIN
  INSERT INTO public.user_promo_cards (user_id, metadata, source_type, token_amount, created_at)
  VALUES (p_user_id, p_metadata, p_source_type, p_token_amount, now())
  RETURNING id INTO v_promo_id;
  
  RETURN v_promo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_session(
  p_device_info JSONB,
  p_ip_address TEXT,
  p_session_id TEXT,
  p_user_agent TEXT,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_session_id UUID;
BEGIN
  INSERT INTO public.user_sessions (device_info, ip_address, session_id, user_agent, user_id, created_at, is_active)
  VALUES (p_device_info, p_ip_address, p_session_id, p_user_agent, p_user_id, now(), true)
  RETURNING id INTO v_session_id;
  
  RETURN v_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_broadcast_with_capacity_check(
  p_stream_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_stream RECORD;
  v_viewer_count INTEGER;
BEGIN
  SELECT * INTO v_stream FROM public.streams WHERE id = p_stream_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
  END IF;
  
  v_viewer_count := COALESCE(v_stream.current_viewers, 0);
  
  IF v_viewer_count >= 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Broadcast capacity reached');
  END IF;
  
  UPDATE public.streams
  SET status = 'live',
      is_live = true,
      started_at = now()
  WHERE id = p_stream_id;
  
  RETURN jsonb_build_object('success', true, 'viewer_count', v_viewer_count);
END;
$$;

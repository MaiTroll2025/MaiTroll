-- Create missing tables and RPC functions referenced by frontend/backend code

-- Table: user_promo_cards
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

-- Table: user_sessions
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

-- 1. update_stream_viewer_count
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

-- 2. issue_promo_card
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

-- 3. register_session
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

-- 4. start_broadcast_with_capacity_check
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

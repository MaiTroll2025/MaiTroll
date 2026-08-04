-- Migration: Remove Gamerz, Add TrollPods

-- 1. Drop Gamerz Tables
DROP TABLE IF EXISTS public.trollg_applications CASCADE;
DROP TABLE IF EXISTS public.gift_votes CASCADE;
DROP TABLE IF EXISTS public.vote_events CASCADE;
DROP TABLE IF EXISTS public.user_event_dismissals CASCADE;
-- gift_sends depends on user_gifts. We drop both.
DROP TABLE IF EXISTS public.gift_sends CASCADE;
DROP TABLE IF EXISTS public.user_gifts CASCADE;

-- 2. Fix get_gift_stats to use coin_transactions (since gift_sends is gone)
CREATE OR REPLACE FUNCTION public.get_gift_stats(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_total_gifts int;
  v_total_amount numeric;
  v_unique_recipients int;
BEGIN
  -- Count gifts from coin_transactions
  SELECT 
    count(*), 
    coalesce(sum(abs(amount)), 0), 
    count(distinct (metadata->>'receiver_id')::uuid)
  INTO v_total_gifts, v_total_amount, v_unique_recipients
  FROM public.coin_transactions
  WHERE user_id = p_user_id
    AND type IN ('gift_sent', 'gift_sent_wall', 'gift');

  RETURN jsonb_build_object(
    'total_gifts', v_total_gifts,
    'total_gift_amount', v_total_amount,
    'unique_recipients', v_unique_recipients
  );
END;
$$;

-- 3. Create TrollPods Tables

-- Pod Rooms
CREATE TABLE IF NOT EXISTS public.pod_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    host_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    is_live BOOLEAN DEFAULT false,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    viewer_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pod_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active rooms" ON public.pod_rooms;
CREATE POLICY "Anyone can view active rooms" ON public.pod_rooms
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Hosts can manage their rooms" ON public.pod_rooms;
CREATE POLICY "Hosts can manage their rooms" ON public.pod_rooms
    FOR ALL USING (auth.uid() = host_id);

-- Pod Participants (Listeners/Speakers)
CREATE TABLE IF NOT EXISTS public.pod_room_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES public.pod_rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'listener', -- 'host', 'speaker', 'listener'
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(room_id, user_id)
);

ALTER TABLE public.pod_room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view participants" ON public.pod_room_participants;
CREATE POLICY "Anyone can view participants" ON public.pod_room_participants
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join/leave" ON public.pod_room_participants;
CREATE POLICY "Users can join/leave" ON public.pod_room_participants
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove themselves" ON public.pod_room_participants;
CREATE POLICY "Users can remove themselves" ON public.pod_room_participants
    FOR DELETE USING (auth.uid() = user_id);

-- Pod Episodes (Recordings/Archives)
CREATE TABLE IF NOT EXISTS public.pod_episodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.pod_rooms(id) ON DELETE SET NULL,
    host_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    audio_url TEXT,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.pod_episodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view episodes" ON public.pod_episodes;
CREATE POLICY "Anyone can view episodes" ON public.pod_episodes FOR SELECT USING (true);

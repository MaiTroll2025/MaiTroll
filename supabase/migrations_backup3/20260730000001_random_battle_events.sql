-- ============================================================
-- Random Battle Events System
-- Migration: 20260730000001
-- ============================================================

-- ============================================================
-- 1. battle_random_events — scheduled/running events per battle
-- ============================================================
CREATE TABLE IF NOT EXISTS public.battle_random_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('triple_points', 'turtle_mode', 'turbo_mode', 'glow_mode', 'ceo_mode')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'expired', 'cancelled')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds > 0),
  affected_team TEXT CHECK (affected_team IN ('challenger', 'opponent', 'both')),
  affected_host_id UUID REFERENCES public.user_profiles(id),
  multiplier NUMERIC DEFAULT 1.0,
  minimum_paid_gift INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(battle_id, event_type, status)
);

CREATE INDEX IF NOT EXISTS idx_battle_random_events_battle_id ON public.battle_random_events(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_random_events_status ON public.battle_random_events(status);
CREATE INDEX IF NOT EXISTS idx_battle_random_events_starts_at ON public.battle_random_events(starts_at);
CREATE INDEX IF NOT EXISTS idx_battle_random_events_ends_at ON public.battle_random_events(ends_at);

-- ============================================================
-- 2. battle_event_history — audit log of all event lifecycle changes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.battle_event_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.battle_random_events(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  status_from TEXT,
  status_to TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system', 'schedule', 'activate', 'expire', 'complete')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_event_history_battle_id ON public.battle_event_history(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_event_history_event_id ON public.battle_event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_battle_event_history_created_at ON public.battle_event_history(created_at);

-- ============================================================
-- 3. battle_gifts — add event-related columns if missing
-- ============================================================
CREATE TABLE IF NOT EXISTS public.battle_gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id UUID NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id),
  receiver_id UUID NOT NULL REFERENCES public.user_profiles(id),
  gift_id TEXT,
  gift_amount INTEGER NOT NULL DEFAULT 0,
  paid_coin_amount INTEGER DEFAULT 0,
  free_coin_amount INTEGER DEFAULT 0,
  cashout_eligible_amount INTEGER DEFAULT 0,
  battle_point_amount INTEGER DEFAULT 0,
  event_bonus_amount INTEGER DEFAULT 0,
  active_event TEXT,
  stream_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_battle_gifts_battle_id ON public.battle_gifts(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_gifts_sender_id ON public.battle_gifts(sender_id);
CREATE INDEX IF NOT EXISTS idx_battle_gifts_receiver_id ON public.battle_gifts(receiver_id);

-- ============================================================
-- 3b. Add event-related columns to existing battle_gifts if table exists
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'paid_coin_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN paid_coin_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'free_coin_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN free_coin_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'cashout_eligible_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN cashout_eligible_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'battle_point_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN battle_point_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'event_bonus_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN event_bonus_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'active_event') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN active_event TEXT;
  END IF;
END $$;

-- ============================================================
-- 4. Add event-control columns to battles table
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'timer_rate') THEN
    ALTER TABLE public.battles ADD COLUMN timer_rate NUMERIC DEFAULT 1.0 CHECK (timer_rate > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'active_event_type') THEN
    ALTER TABLE public.battles ADD COLUMN active_event_type TEXT CHECK (active_event_type IN ('triple_points', 'turtle_mode', 'turbo_mode', 'glow_mode', 'ceo_mode'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'active_event_started_at') THEN
    ALTER TABLE public.battles ADD COLUMN active_event_started_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'active_event_ends_at') THEN
    ALTER TABLE public.battles ADD COLUMN active_event_ends_at TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'gift_locked_host_id') THEN
    ALTER TABLE public.battles ADD COLUMN gift_locked_host_id UUID REFERENCES public.user_profiles(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battles' AND column_name = 'event_sequence') THEN
    ALTER TABLE public.battles ADD COLUMN event_sequence INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 4. battle_gifts — add event-related columns if missing
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'paid_coin_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN paid_coin_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'free_coin_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN free_coin_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'cashout_eligible_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN cashout_eligible_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'battle_point_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN battle_point_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'event_bonus_amount') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN event_bonus_amount INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'battle_gifts' AND column_name = 'active_event') THEN
    ALTER TABLE public.battle_gifts ADD COLUMN active_event TEXT;
  END IF;
END $$;

-- ============================================================
-- 5. coin_transactions — add event source type if missing
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'event_type') THEN
    ALTER TABLE public.coin_transactions ADD COLUMN event_type TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coin_transactions' AND column_name = 'battle_id') THEN
    ALTER TABLE public.coin_transactions ADD COLUMN battle_id UUID REFERENCES public.battles(id);
  END IF;
END $$;

-- ============================================================
-- 6. RLS Policies for battle_random_events
-- ============================================================
ALTER TABLE public.battle_random_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_random_events_select_authenticated"
  ON public.battle_random_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "battle_random_events_insert_service_role"
  ON public.battle_random_events FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "battle_random_events_update_service_role"
  ON public.battle_random_events FOR UPDATE
  TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- 7. RLS Policies for battle_event_history
-- ============================================================
ALTER TABLE public.battle_event_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "battle_event_history_select_authenticated"
  ON public.battle_event_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "battle_event_history_insert_service_role"
  ON public.battle_event_history FOR INSERT
  TO service_role
  WITH CHECK (true);

-- ============================================================
-- 8. Grant permissions
-- ============================================================
GRANT ALL ON public.battle_random_events TO service_role;
GRANT SELECT ON public.battle_random_events TO authenticated;
GRANT ALL ON public.battle_event_history TO service_role;
GRANT SELECT ON public.battle_event_history TO authenticated;
-- Add all missing columns referenced by the frontend/backend code

-- conversations
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS is_group BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS name TEXT;

-- conversation_members
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- conversation_messages
ALTER TABLE public.conversation_messages
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- coin_transactions
ALTER TABLE public.coin_transactions
  ADD COLUMN IF NOT EXISTS coin_delta INTEGER,
  ADD COLUMN IF NOT EXISTS coin_type TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT,
  ADD COLUMN IF NOT EXISTS source_id TEXT,
  ADD COLUMN IF NOT EXISTS balance_after BIGINT,
  ADD COLUMN IF NOT EXISTS platform_profit INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liability INTEGER DEFAULT 0;

-- stream_seat_sessions
ALTER TABLE public.stream_seat_sessions
  ADD COLUMN IF NOT EXISTS livekit_participant_identity TEXT;

-- streams
ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
  ADD COLUMN IF NOT EXISTS viewer_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS hls_url TEXT,
  ADD COLUMN IF NOT EXISTS current_viewers INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS total_likes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_battle BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS battle_id UUID,
  ADD COLUMN IF NOT EXISTS battle_mode TEXT,
  ADD COLUMN IF NOT EXISTS battle_status TEXT,
  ADD COLUMN IF NOT EXISTS battle_start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS battle_end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS side_a_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS side_b_score INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS quality_cap TEXT,
  ADD COLUMN IF NOT EXISTS is_azgora BOOLEAN DEFAULT false;

-- notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS is_dismissed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;

-- user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
-- Migration: Add missing columns for enhanced moderation
-- These columns were lost during a prior restore and are required by the
-- moderation-actions Edge Function and ModActionsPopup audit flow.

-- ==========================================
-- 1. Add expires_at to user_driver_licenses
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_driver_licenses' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE public.user_driver_licenses
      ADD COLUMN expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- ==========================================
-- 2. Add stream_session_id to stream_kicks
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stream_kicks' AND column_name = 'stream_session_id'
  ) THEN
    ALTER TABLE public.stream_kicks
      ADD COLUMN stream_session_id TEXT;
  END IF;
END $$;

-- ==========================================
-- 3. Add missing audit columns to broadcast_mod_actions
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'broadcast_mod_actions' AND column_name = 'action_name'
  ) THEN
    ALTER TABLE public.broadcast_mod_actions
      ADD COLUMN action_name TEXT,
      ADD COLUMN target_role_before TEXT,
      ADD COLUMN target_role_after TEXT,
      ADD COLUMN broadcast_id UUID REFERENCES public.streams(id),
      ADD COLUMN livekit_room_name TEXT,
      ADD COLUMN previous_status TEXT,
      ADD COLUMN new_status TEXT,
      ADD COLUMN failure_reason TEXT,
      ADD COLUMN original_action_id UUID REFERENCES public.broadcast_mod_actions(id),
      ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ==========================================
-- 4. Indexes for new columns
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_bma_broadcast_id
  ON public.broadcast_mod_actions(broadcast_id);
CREATE INDEX IF NOT EXISTS idx_bma_stream_session_id
  ON public.broadcast_mod_actions((metadata->>'stream_session_id'));
CREATE INDEX IF NOT EXISTS idx_bma_livekit_room
  ON public.broadcast_mod_actions(livekit_room_name);

-- =============================================================================
-- Mai Voice — personalized TTS + recorded voice chat
-- =============================================================================
-- Creates:
--   * mai_voice_profiles        - per-user authorized voice profile (cloned voice)
--   * mai_voice_consents        - explicit, versioned consent records
--   * mai_voice_room_settings   - per-room broadcaster switches (stream or battle)
--   * mai_voice_room_optins     - per-user, per-room "speak my messages" opt-in
--   * mai_voice_messages        - recorded voice-chat metadata (audio lives in storage)
--   * mai_voice_queue           - the single authoritative playback queue per room
--   * mai_voice_publishers      - rooms that currently have a LiveKit voice publisher
--   * storage bucket 'mai-voice' (private) + storage policies
--
-- Everything except mai_voice_room_optins / mai_voice_room_settings reads is
-- server-only (edge function 'mai-voice' uses the service role). RLS is enabled
-- on every table so a client can never assert consent, moderation approval or
-- queue state directly.
-- =============================================================================

BEGIN;

DO $preflight$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF to_regclass('public.user_profiles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.user_profiles');
  END IF;
  IF to_regclass('public.streams') IS NULL THEN
    v_missing := array_append(v_missing, 'public.streams');
  END IF;
  IF to_regclass('public.battles') IS NULL THEN
    v_missing := array_append(v_missing, 'public.battles');
  END IF;
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Mai Voice migration requires existing tables: %',
      array_to_string(v_missing, ', ');
  END IF;
END
$preflight$;

-- -----------------------------------------------------------------------------
-- 1. Voice profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  provider_voice_id TEXT,
  status TEXT NOT NULL DEFAULT 'not_set_up' CHECK (status IN (
    'not_set_up', 'awaiting_consent', 'processing', 'ready', 'failed',
    'disabled', 'deletion_pending', 'deleted'
  )),
  display_name TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  consent_version TEXT,
  consented_at TIMESTAMPTZ,
  consent_revoked_at TIMESTAMPTZ,
  sample_path TEXT,
  sample_duration_seconds NUMERIC(6, 2),
  sample_mime_type TEXT,
  failure_reason TEXT,
  provider_error TEXT,
  provider_requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT mai_voice_profiles_user_unique UNIQUE (user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS mai_voice_profiles_provider_voice_idx
  ON public.mai_voice_profiles (provider_voice_id)
  WHERE provider_voice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS mai_voice_profiles_ready_idx
  ON public.mai_voice_profiles (user_id)
  WHERE status = 'ready' AND is_enabled = TRUE AND deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- 2. Consent records (profile creation is separate from broadcast usage)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  consent_version TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN (
    'voice_profile_creation', 'broadcast_usage'
  )),
  scope_room_kind TEXT CHECK (scope_room_kind IN ('stream', 'battle')),
  scope_room_id UUID,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  ip_hash TEXT,
  user_agent_hash TEXT,
  CONSTRAINT mai_voice_consents_broadcast_scope_chk CHECK (
    purpose <> 'broadcast_usage'
    OR (scope_room_kind IS NOT NULL AND scope_room_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS mai_voice_consents_user_idx
  ON public.mai_voice_consents (user_id, purpose, granted_at DESC);

-- -----------------------------------------------------------------------------
-- 3. Per-room broadcaster settings (a "room" is a broadcast or a battle)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_room_settings (
  room_kind TEXT NOT NULL CHECK (room_kind IN ('stream', 'battle')),
  room_id UUID NOT NULL,
  owner_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  tts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  chat_tts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  flying_chat_tts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  voice_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  playback_volume NUMERIC(3, 2) NOT NULL DEFAULT 1.00
    CHECK (playback_volume >= 0 AND playback_volume <= 1),
  playback_paused BOOLEAN NOT NULL DEFAULT FALSE,
  max_queue_size INTEGER NOT NULL DEFAULT 10 CHECK (max_queue_size BETWEEN 1 AND 50),
  cooldown_seconds INTEGER NOT NULL DEFAULT 10 CHECK (cooldown_seconds BETWEEN 0 AND 600),
  max_text_length INTEGER NOT NULL DEFAULT 280 CHECK (max_text_length BETWEEN 20 AND 1000),
  fallback_voice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  fallback_voice_id TEXT,
  room_generation_budget INTEGER NOT NULL DEFAULT 200 CHECK (room_generation_budget >= 0),
  room_generation_used INTEGER NOT NULL DEFAULT 0,
  room_budget_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (room_kind, room_id)
);

-- -----------------------------------------------------------------------------
-- 4. Per-user, per-room "speak my messages" opt-in
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_room_optins (
  room_kind TEXT NOT NULL CHECK (room_kind IN ('stream', 'battle')),
  room_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_kind, room_id, user_id)
);

-- -----------------------------------------------------------------------------
-- 5. Recorded voice-chat messages (audio bytes live in private storage)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_kind TEXT NOT NULL CHECK (room_kind IN ('stream', 'battle')),
  room_id UUID NOT NULL,
  stream_id UUID REFERENCES public.streams(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0 AND duration_ms <= 20000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'queued', 'played', 'expired', 'removed', 'failed'
  )),
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed')),
  moderation_reason TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Recorded voice messages expire 1 minute after they were sent.
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 minute'),
  played_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  report_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT mai_voice_messages_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS mai_voice_messages_room_idx
  ON public.mai_voice_messages (room_kind, room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mai_voice_messages_expiry_idx
  ON public.mai_voice_messages (expires_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS mai_voice_messages_sender_idx
  ON public.mai_voice_messages (sender_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. The single authoritative playback queue per room
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_kind TEXT NOT NULL CHECK (room_kind IN ('stream', 'battle')),
  room_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('voice_message', 'tts')),
  message_id UUID REFERENCES public.mai_voice_messages(id) ON DELETE CASCADE,
  source_message_id UUID,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  text TEXT,
  storage_path TEXT,
  duration_ms INTEGER,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'generating', 'ready', 'playing', 'played', 'expired',
    'failed', 'rejected', 'removed', 'skipped'
  )),
  delivery TEXT NOT NULL DEFAULT 'auto' CHECK (delivery IN ('auto', 'livekit', 'local')),
  play_token UUID,
  play_at TIMESTAMPTZ,
  played_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  idempotency_key TEXT NOT NULL,
  is_personalized BOOLEAN NOT NULL DEFAULT FALSE,
  voice_profile_id UUID REFERENCES public.mai_voice_profiles(id) ON DELETE SET NULL,
  provider TEXT,
  provider_voice_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  claimed_by TEXT,
  claimed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT mai_voice_queue_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS mai_voice_queue_pick_idx
  ON public.mai_voice_queue (room_kind, room_id, status, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS mai_voice_queue_user_idx
  ON public.mai_voice_queue (room_kind, room_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS mai_voice_queue_expiry_idx
  ON public.mai_voice_queue (expires_at) WHERE status IN ('pending', 'ready');

-- -----------------------------------------------------------------------------
-- 7. LiveKit voice publishers (rooms that currently have an authorized publisher)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mai_voice_publishers (
  room_kind TEXT NOT NULL CHECK (room_kind IN ('stream', 'battle')),
  room_id UUID NOT NULL,
  publisher_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  livekit_room_name TEXT,
  last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_kind, room_id, publisher_user_id)
);

CREATE INDEX IF NOT EXISTS mai_voice_publishers_room_idx
  ON public.mai_voice_publishers (room_kind, room_id, last_heartbeat_at DESC);

-- -----------------------------------------------------------------------------
-- 8. Helper functions
-- -----------------------------------------------------------------------------

-- Resolve the broadcaster/owner of a room. For a stream this is the stream owner;
-- for a battle it is the owner of the challenger side (the "primary" side).
CREATE OR REPLACE FUNCTION public.mai_voice_room_owner(
  p_room_kind TEXT,
  p_room_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_owner UUID;
BEGIN
  IF p_room_kind = 'stream' THEN
    SELECT COALESCE(broadcaster_id, user_id, host_id, owner_id) INTO v_owner
    FROM public.streams WHERE id = p_room_id;
  ELSIF p_room_kind = 'battle' THEN
    SELECT COALESCE(s.broadcaster_id, s.user_id, s.host_id, s.owner_id) INTO v_owner
    FROM public.battles b
    JOIN public.streams s ON s.id = b.challenger_stream_id
    WHERE b.id = p_room_id;
  END IF;
  RETURN v_owner;
END;
$$;

-- Is the user a moderator (broadcaster, officer or admin) for this room?
CREATE OR REPLACE FUNCTION public.mai_voice_can_moderate_room(
  p_room_kind TEXT,
  p_room_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_owner UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF COALESCE(v_profile.is_admin, FALSE)
     OR COALESCE(v_profile.is_super_admin, FALSE)
     OR COALESCE(v_profile.is_superadmin, FALSE)
     OR COALESCE(v_profile.is_staff, FALSE)
     OR COALESCE(v_profile.is_troll_officer, FALSE)
     OR COALESCE(v_profile.is_lead_officer, FALSE)
     OR LOWER(COALESCE(v_profile.role, '')) IN
        ('admin', 'superadmin', 'owner', 'staff', 'ceo', 'ceo_assistant',
         'noah_assistant', 'lead_troll_officer', 'troll_officer', 'secretary',
         'prosecutor', 'attorney')
     OR LOWER(COALESCE(v_profile.troll_role, '')) IN
        ('admin', 'superadmin', 'owner', 'staff', 'ceo', 'ceo_assistant',
         'noah_assistant', 'lead_troll_officer', 'troll_officer', 'secretary',
         'prosecutor', 'attorney') THEN
    RETURN TRUE;
  END IF;

  v_owner := public.mai_voice_room_owner(p_room_kind, p_room_id);
  IF v_owner IS NOT NULL AND v_owner = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Battle: the opposing side's broadcaster may moderate the shared battle room.
  IF p_room_kind = 'battle' THEN
    SELECT COALESCE(s.broadcaster_id, s.user_id, s.host_id, s.owner_id) INTO v_owner
    FROM public.battles b
    JOIN public.streams s ON s.id = b.opponent_stream_id
    WHERE b.id = p_room_id;
    IF v_owner IS NOT NULL AND v_owner = p_user_id THEN
      RETURN TRUE;
    END IF;
  END IF;

  RETURN FALSE;
END;
$$;

-- Fetch (creating if needed) the settings row for a room.
CREATE OR REPLACE FUNCTION public.mai_voice_get_room_settings(
  p_room_kind TEXT,
  p_room_id UUID
) RETURNS public.mai_voice_room_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.mai_voice_room_settings%ROWTYPE;
BEGIN
  INSERT INTO public.mai_voice_room_settings (room_kind, room_id, owner_id)
  VALUES (p_room_kind, p_room_id, public.mai_voice_room_owner(p_room_kind, p_room_id))
  ON CONFLICT (room_kind, room_id) DO NOTHING;

  SELECT * INTO v_row
  FROM public.mai_voice_room_settings
  WHERE room_kind = p_room_kind AND room_id = p_room_id;

  RETURN v_row;
END;
$$;

-- Atomically claim the next playable queue item for a room.
-- Returns the claimed row (or NULL). Uses FOR UPDATE SKIP LOCKED so that
-- concurrent workers never double-claim the same item.
CREATE OR REPLACE FUNCTION public.mai_voice_claim_next_item(
  p_room_kind TEXT,
  p_room_id UUID,
  p_worker_id TEXT,
  p_claim_status TEXT DEFAULT 'ready'
) RETURNS public.mai_voice_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_row public.mai_voice_queue%ROWTYPE;
BEGIN
  UPDATE public.mai_voice_queue q
  SET status = p_claim_status,
      claimed_by = p_worker_id,
      claimed_at = NOW(),
      updated_at = NOW(),
      attempt_count = q.attempt_count + 1
  WHERE q.id = (
    SELECT id FROM public.mai_voice_queue
    WHERE room_kind = p_room_kind
      AND room_id = p_room_id
      AND status IN ('pending', 'ready')
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY priority DESC, created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- Expire stale items. Returns the storage paths that should be deleted.
CREATE OR REPLACE FUNCTION public.mai_voice_expire_due()
RETURNS TABLE(storage_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  WITH expired AS (
    UPDATE public.mai_voice_messages m
    SET status = 'expired', deleted_at = NOW()
    WHERE m.deleted_at IS NULL
      AND m.status NOT IN ('played', 'removed', 'rejected', 'expired')
      AND m.expires_at <= NOW()
    RETURNING m.storage_path
  )
  SELECT DISTINCT e.storage_path FROM expired e;

  UPDATE public.mai_voice_queue q
  SET status = 'expired', updated_at = NOW()
  WHERE q.status IN ('pending', 'generating', 'ready')
    AND q.expires_at IS NOT NULL
    AND q.expires_at <= NOW();
END;
$$;

-- Drop publisher heartbeats that went stale.
CREATE OR REPLACE FUNCTION public.mai_voice_prune_publishers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_removed INTEGER;
BEGIN
  DELETE FROM public.mai_voice_publishers
  WHERE last_heartbeat_at < NOW() - INTERVAL '45 seconds';
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  RETURN v_removed;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Row level security
-- -----------------------------------------------------------------------------
ALTER TABLE public.mai_voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_voice_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_voice_room_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_voice_room_optins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_voice_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_voice_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_voice_publishers ENABLE ROW LEVEL SECURITY;

-- Voice profiles: a user may read their own profile only. All writes go through
-- the 'mai-voice' edge function with the service role, so a client can never
-- assert that a profile is 'ready' or that consent was granted.
DROP POLICY IF EXISTS mai_voice_profiles_select_own ON public.mai_voice_profiles;
CREATE POLICY mai_voice_profiles_select_own ON public.mai_voice_profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Consent records: read your own only. Writes are server-only.
DROP POLICY IF EXISTS mai_voice_consents_select_own ON public.mai_voice_consents;
CREATE POLICY mai_voice_consents_select_own ON public.mai_voice_consents
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Room settings: everyone in the app may read them (clients need to know
-- whether the feature is on); only the room owner may change them.
DROP POLICY IF EXISTS mai_voice_room_settings_select_all ON public.mai_voice_room_settings;
CREATE POLICY mai_voice_room_settings_select_all ON public.mai_voice_room_settings
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS mai_voice_room_settings_update_owner ON public.mai_voice_room_settings;
CREATE POLICY mai_voice_room_settings_update_owner ON public.mai_voice_room_settings
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS mai_voice_room_settings_insert_owner ON public.mai_voice_room_settings;
CREATE POLICY mai_voice_room_settings_insert_owner ON public.mai_voice_room_settings
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Opt-ins: a user manages their own opt-in row.
DROP POLICY IF EXISTS mai_voice_room_optins_select_own ON public.mai_voice_room_optins;
CREATE POLICY mai_voice_room_optins_select_own ON public.mai_voice_room_optins
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS mai_voice_room_optins_insert_own ON public.mai_voice_room_optins;
CREATE POLICY mai_voice_room_optins_insert_own ON public.mai_voice_room_optins
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mai_voice_room_optins_update_own ON public.mai_voice_room_optins;
CREATE POLICY mai_voice_room_optins_update_own ON public.mai_voice_room_optins
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS mai_voice_room_optins_delete_own ON public.mai_voice_room_optins;
CREATE POLICY mai_voice_room_optins_delete_own ON public.mai_voice_room_optins
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Voice messages: metadata only (never audio). Visible to the sender and, while
-- live, to other authenticated participants so chat can render the bubble.
DROP POLICY IF EXISTS mai_voice_messages_select_live ON public.mai_voice_messages;
CREATE POLICY mai_voice_messages_select_live ON public.mai_voice_messages
  FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR (deleted_at IS NULL AND expires_at > NOW())
  );

-- Queue: server-only. No client policy => no client access at all.
-- Publishers: readable so a client can tell whether LiveKit delivery is live.
DROP POLICY IF EXISTS mai_voice_publishers_select_all ON public.mai_voice_publishers;
CREATE POLICY mai_voice_publishers_select_all ON public.mai_voice_publishers
  FOR SELECT TO authenticated
  USING (TRUE);

-- -----------------------------------------------------------------------------
-- 10. Private storage bucket
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mai-voice',
  'mai-voice',
  FALSE,
  5242880,
  ARRAY[
    'audio/webm', 'audio/webm;codecs=opus', 'audio/ogg', 'audio/ogg;codecs=opus',
    'audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/mpeg', 'audio/mp3',
    'audio/wav', 'audio/x-m4a', 'audio/aac', 'video/webm', 'video/webm;codecs=opus'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = FALSE,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No client-side read/write on the bucket: every byte moves through the
-- 'mai-voice' edge function, which returns short-lived signed URLs.
DROP POLICY IF EXISTS mai_voice_storage_read ON storage.objects;
DROP POLICY IF EXISTS mai_voice_storage_insert ON storage.objects;
DROP POLICY IF EXISTS mai_voice_storage_update ON storage.objects;
DROP POLICY IF EXISTS mai_voice_storage_delete ON storage.objects;

-- -----------------------------------------------------------------------------
-- 11. Realtime broadcast support
-- -----------------------------------------------------------------------------
-- The Mai Voice channel uses Supabase Realtime *broadcast* (not postgres_changes),
-- so no publication change is required. The topic is:
--     mai-voice:<room_kind>:<room_id>
-- e.g. mai-voice:stream:<uuid> / mai-voice:battle:<uuid>
--
-- Events: voice_play, voice_state, voice_removed, voice_settings

COMMIT;

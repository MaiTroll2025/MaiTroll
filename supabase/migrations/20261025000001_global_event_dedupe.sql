-- Migration: Global ticker event deduplication & metadata columns
-- Adds server-side dedupe so the same genuine event is never published twice
-- across clients, page reloads, or Realtime reconnects.

BEGIN;

-- 1. New columns on global_events
ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS source_event_id TEXT;

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'published';

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS route TEXT;

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS source TEXT;

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS actor_id UUID;

ALTER TABLE IF EXISTS public.global_events
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- 2. Indexes for bounded, performant ticker queries
CREATE INDEX IF NOT EXISTS idx_global_events_created_at_desc
  ON public.global_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_global_events_status_created_at
  ON public.global_events (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_global_events_source_created_at
  ON public.global_events (source, created_at DESC);

-- 3. Server-side dedupe: one row per dedupe_key (null keys never conflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_events_dedupe_key_unique
  ON public.global_events (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

-- 4. RLS: keep public read; service_role write only (existing policy already)
--    No change needed — frontend writes exclusively via create_global_event RPC.

-- 5. Extend create_global_event RPC with optional dedupe/route fields.
--    All new params are optional with defaults so existing callers are unbroken.
CREATE OR REPLACE FUNCTION public.create_global_event(
    p_title         TEXT,
    p_type          TEXT    DEFAULT 'system',
    p_icon          TEXT    DEFAULT NULL,
    p_priority      INTEGER DEFAULT 1,
    p_metadata      JSONB   DEFAULT '{}'::JSONB,
    p_dedupe_key    TEXT    DEFAULT NULL,
    p_source_event_id TEXT DEFAULT NULL,
    p_status        TEXT    DEFAULT 'published',
    p_route         TEXT    DEFAULT NULL,
    p_source        TEXT    DEFAULT NULL,
    p_expires_at    TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id  UUID;
    v_event_id UUID;
BEGIN
    -- Require an authenticated caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
        USING ERRCODE = 'P0001';
    END IF;

    -- Tag every event with its originating actor
    p_metadata := COALESCE(p_metadata, '{}'::JSONB)
                || jsonb_build_object('actor_id', v_user_id);

    -- Idempotent insert: a genuine event with the same dedupe_key is published once.
    -- Events without a dedupe_key always insert (unique index is partial on non-null).
    INSERT INTO public.global_events
        (type, title, icon, priority, metadata, dedupe_key, source_event_id, status, route, source, actor_id, expires_at)
    VALUES
        (p_type, p_title, p_icon, p_priority, p_metadata,
         p_dedupe_key, p_source_event_id, p_status, p_route, p_source, v_user_id, p_expires_at)
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id INTO v_event_id;

    -- If the insert was suppressed by dedupe, return the existing event id.
    IF v_event_id IS NULL THEN
        SELECT id INTO v_event_id
        FROM public.global_events
        WHERE dedupe_key = p_dedupe_key
        LIMIT 1;
    END IF;

    RETURN v_event_id;
END;
$$;

-- Only authenticated users can call this RPC
GRANT EXECUTE ON FUNCTION public.create_global_event(
    TEXT, TEXT, TEXT, INTEGER, JSONB, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ
) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

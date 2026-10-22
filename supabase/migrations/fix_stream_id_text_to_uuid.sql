BEGIN;

-- 0) Drop dependent view first (it references stream_audience_presence.stream_id)
DROP VIEW IF EXISTS public.stream_audience_presence_public;

-- 1) stream_audience_presence: stream_id TEXT -> UUID
ALTER TABLE public.stream_audience_presence
  DROP CONSTRAINT IF EXISTS stream_audience_presence_stream_id_fkey;

ALTER TABLE public.stream_audience_presence
  ALTER COLUMN stream_id TYPE UUID USING stream_id::UUID;

-- Delete orphaned presence rows whose stream_id no longer matches any stream
DELETE FROM public.stream_audience_presence
WHERE stream_id NOT IN (SELECT id FROM public.streams);

ALTER TABLE public.stream_audience_presence
  ADD CONSTRAINT stream_audience_presence_stream_id_fkey
    FOREIGN KEY (stream_id) REFERENCES public.streams(id) ON DELETE CASCADE;

-- 2) stream_seats: stream_id TEXT -> UUID
ALTER TABLE public.stream_seats
  DROP CONSTRAINT IF EXISTS stream_seats_pkey;

ALTER TABLE public.stream_seats
  ALTER COLUMN stream_id TYPE UUID USING stream_id::UUID;

ALTER TABLE public.stream_seats
  ADD PRIMARY KEY (stream_id, seat_index);

-- 3) broadcast_active_effects: stream_id TEXT -> UUID
ALTER TABLE public.broadcast_active_effects
  ALTER COLUMN stream_id TYPE UUID USING stream_id::UUID;

-- 4) broadcast_ability_logs: stream_id TEXT -> UUID
ALTER TABLE public.broadcast_ability_logs
  ALTER COLUMN stream_id TYPE UUID USING stream_id::UUID;

-- 5) Recreate the dependent view
CREATE OR REPLACE VIEW public.stream_audience_presence_public
WITH (security_barrier = true)
AS
SELECT
  presence.id,
  presence.stream_id,
  presence.user_id,
  CASE
    WHEN entitlement.user_id IS NOT NULL
      AND entitlement.starts_at <= now()
      AND (entitlement.expires_at IS NULL OR entitlement.expires_at > now())
      AND auth.uid() IS DISTINCT FROM presence.user_id
      AND NOT public.is_ghost_mode_staff()
      AND NOT public.has_active_mai_supreme_entitlement()
    THEN 'xxxxx'
    ELSE presence.username
  END AS username,
  CASE
    WHEN entitlement.user_id IS NOT NULL
      AND entitlement.starts_at <= now()
      AND (entitlement.expires_at IS NULL OR entitlement.expires_at > now())
      AND auth.uid() IS DISTINCT FROM presence.user_id
      AND NOT public.is_ghost_mode_staff()
      AND NOT public.has_active_mai_supreme_entitlement()
    THEN CASE WHEN entitlement.tier = 'supreme' THEN '/ghost-supreme.svg' ELSE '/ghost-basic.svg' END
    ELSE presence.avatar_url
  END AS avatar_url,
  presence.joined_at,
  presence.left_at,
  presence.is_active,
  presence.gift_total,
  presence.seat_id,
  presence.role,
  presence.last_seen_at
FROM public.stream_audience_presence presence
LEFT JOIN public.ghost_mode_entitlements entitlement ON entitlement.user_id = presence.user_id;

REVOKE ALL ON public.stream_audience_presence_public FROM PUBLIC;
GRANT SELECT ON public.stream_audience_presence_public TO anon, authenticated;

COMMIT;

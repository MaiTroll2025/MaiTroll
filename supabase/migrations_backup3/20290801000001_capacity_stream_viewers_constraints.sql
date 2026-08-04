-- Capacity enforcement: extend stream_viewers to also track anonymous guests,
-- and add the unique constraints / indexes needed for an authoritative,
-- race-free viewer-cap count (one active row per viewer per stream).

-- Add a nullable guest_id so fully-unauthenticated viewers (no auth.users row)
-- can still occupy a counted, de-duplicated capacity slot.
ALTER TABLE public.stream_viewers
  ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- Drop the original simple unique constraint and replace with:
--   * a UNIQUE constraint on (stream_id, user_id) — one row per authenticated viewer
--   * a PARTIAL UNIQUE INDEX on (stream_id, guest_id) WHERE guest_id IS NOT NULL
--     (PostgreSQL does not support WHERE inside ADD CONSTRAINT, so the guest
--     uniqueness is enforced via a partial unique index instead).
-- Together these guarantee a single slot per viewer and let the capacity RPC
-- use INSERT ... ON CONFLICT DO NOTHING for idempotency.
ALTER TABLE public.stream_viewers
  DROP CONSTRAINT IF EXISTS stream_viewers_stream_id_user_id_key;

ALTER TABLE public.stream_viewers
  ADD CONSTRAINT stream_viewers_stream_user_uniq
    UNIQUE (stream_id, user_id);

DROP INDEX IF EXISTS stream_viewers_stream_guest_uniq;
CREATE UNIQUE INDEX IF NOT EXISTS stream_viewers_stream_guest_uniq
  ON public.stream_viewers(stream_id, guest_id)
  WHERE guest_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_user
  ON public.stream_viewers(stream_id, user_id);

CREATE INDEX IF NOT EXISTS idx_stream_viewers_stream_guest
  ON public.stream_viewers(stream_id, guest_id)
  WHERE guest_id IS NOT NULL;

-- Helper: parse a numeric value out of an admin_settings setting_value which
-- may be a JSON object {enabled,value}, a JSON string of that object, or a
-- plain number/text. Used by the capacity RPCs below.
--
-- Robustness: the column may be jsonb or text holding a JSON string. Casting
-- to jsonb handles both. The ->> operator works on jsonb; the COALESCE chain
-- pulls 'value' (and, for a bare scalar/array, ->>0), falling back to p_default.
CREATE OR REPLACE FUNCTION public._cap_setting_numeric(p_key text, p_default numeric)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(
        NULLIF((s.setting_value::jsonb->>'value'), '')::numeric,
        NULLIF((s.setting_value::jsonb->>0), '')::numeric
      )
      FROM public.admin_settings s
      WHERE s.setting_key = p_key
      LIMIT 1
    ),
    p_default
  );
$$;

-- Helper: read a boolean flag out of an admin_settings setting_value.
-- Same jsonb-cast robustness as _cap_setting_numeric.
CREATE OR REPLACE FUNCTION public._cap_setting_bool(p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(
        (s.setting_value::jsonb->>'enabled')::boolean,
        (s.setting_value::jsonb->>'value')::boolean
      )
      FROM public.admin_settings s
      WHERE s.setting_key = p_key
      LIMIT 1
    ),
    p_default
  );
$$;

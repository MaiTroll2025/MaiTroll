CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO postgres, service_role;

CREATE TABLE IF NOT EXISTS private.broadcast_passwords (
  stream_id uuid PRIMARY KEY REFERENCES public.streams(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.broadcast_passwords ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE private.broadcast_passwords FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.broadcast_passwords TO service_role;

INSERT INTO private.broadcast_passwords (stream_id, password_hash)
SELECT id, password_hash
FROM public.streams
WHERE password_hash IS NOT NULL
ON CONFLICT (stream_id) DO NOTHING;

UPDATE public.streams
SET password_hash = NULL
WHERE password_hash IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_broadcast_password(
  p_stream_id uuid,
  p_password text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_password IS NULL
    OR char_length(p_password) < 4
    OR octet_length(p_password) > 72 THEN
    RAISE EXCEPTION 'A valid broadcast password is required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.streams
    WHERE id = p_stream_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Broadcast not found or access denied';
  END IF;

  INSERT INTO private.broadcast_passwords (stream_id, password_hash)
  VALUES (p_stream_id, extensions.crypt(p_password, extensions.gen_salt('bf', 12)))
  ON CONFLICT (stream_id) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        created_at = now();

  UPDATE public.streams
  SET is_protected = true,
      password_hash = NULL
  WHERE id = p_stream_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_broadcast_password(
  p_stream_id uuid,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  stored_hash text;
BEGIN
  IF p_stream_id IS NULL OR p_password IS NULL OR octet_length(p_password) > 72 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect password');
  END IF;

  SELECT bp.password_hash INTO stored_hash
  FROM private.broadcast_passwords bp
  JOIN public.streams s ON s.id = bp.stream_id
  WHERE bp.stream_id = p_stream_id
    AND s.is_protected IS TRUE;

  IF stored_hash IS NOT NULL
    AND extensions.crypt(p_password, stored_hash) = stored_hash THEN
    RETURN jsonb_build_object('success', true);
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Incorrect password');
END;
$$;

REVOKE ALL ON FUNCTION public.set_broadcast_password(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_broadcast_password(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.validate_broadcast_password(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_broadcast_password(uuid, text) TO anon, authenticated;

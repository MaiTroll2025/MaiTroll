BEGIN;

ALTER FUNCTION public.find_random_battle_match(uuid, uuid)
  RENAME TO find_random_battle_match_unserialized;

CREATE OR REPLACE FUNCTION public.find_random_battle_match(
  p_stream_id uuid,
  p_broadcaster_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Serialize matchmaking so simultaneous broadcasters cannot skip each
  -- other after each RPC has locked its own stream row.
  PERFORM pg_advisory_xact_lock(2029101902, 1);

  RETURN public.find_random_battle_match_unserialized(
    p_stream_id,
    p_broadcaster_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.find_random_battle_match_unserialized(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.find_random_battle_match(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_random_battle_match(uuid, uuid)
  TO authenticated;

COMMENT ON FUNCTION public.find_random_battle_match(uuid, uuid) IS
  'Serializes matchmaking RPC calls to prevent simultaneous broadcasters from skipping one another.';

COMMIT;

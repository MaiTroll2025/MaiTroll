-- Compare the RPC's text ID argument with stream_gifts.id consistently,
-- including databases where that column is bigint rather than UUID.
DO $migration$
DECLARE
  v_function_definition TEXT;
  v_fixed_definition TEXT;
BEGIN
  v_function_definition := pg_get_functiondef(
    'public.undo_gift_transaction(text, uuid)'::regprocedure
  );

  IF position('id = p_stream_gift_id' IN v_function_definition) = 0 THEN
    RAISE EXCEPTION 'Could not locate the stream gift ID comparison in undo_gift_transaction';
  END IF;

  v_fixed_definition := replace(
    v_function_definition,
    'id = p_stream_gift_id',
    'id::TEXT = p_stream_gift_id'
  );

  EXECUTE v_fixed_definition;
END;
$migration$;

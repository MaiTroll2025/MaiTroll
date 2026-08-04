-- RPC function for battle score increment
CREATE OR REPLACE FUNCTION increment_battle_score(
  p_stream_id UUID,
  p_side TEXT,
  p_amount BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_side = 'A' THEN
    UPDATE streams 
    SET side_a_score = side_a_score + p_amount 
    WHERE id = p_stream_id;
  ELSE
    UPDATE streams 
    SET side_b_score = side_b_score + p_amount 
    WHERE id = p_stream_id;
  END IF;
END;
$$;
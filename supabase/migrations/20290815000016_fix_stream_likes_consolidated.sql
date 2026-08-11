-- Migration: Fix increment_stream_likes function and consolidate likes per stream
-- Fixes: function signature mismatch (was stream_id UUID / RETURNS void)
--        frontend calls with p_stream_id + p_like_count and expects bigint return
-- Goal: consolidate likes per stream (no rows per like sent, no per-user tracking)

-- 1. Ensure total_likes column exists on streams
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'streams' AND column_name = 'total_likes'
  ) THEN
    ALTER TABLE public.streams ADD COLUMN total_likes INTEGER DEFAULT 0;
  END IF;
END $$;

-- 2. Drop per-user like tracking tables (from old batched approach) to consolidate per stream
DROP TABLE IF EXISTS public.stream_user_likes;
DROP TABLE IF EXISTS public.user_stream_likes;

-- 3. Replace increment_stream_likes with corrected, batched per-stream version
DROP FUNCTION IF EXISTS public.increment_stream_likes(uuid);
DROP FUNCTION IF EXISTS public.increment_stream_likes(uuid, integer);

CREATE OR REPLACE FUNCTION public.increment_stream_likes(
  p_stream_id uuid,
  p_like_count integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_total bigint;
BEGIN
  -- Require authenticated user
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Validate like count
  IF p_like_count < 1 OR p_like_count > 100 THEN
    RAISE EXCEPTION 'Invalid like count';
  END IF;

  -- Consolidate likes per stream: just bump the aggregate counter on
  -- the streams row. No rows are inserted per like sent.
  UPDATE public.streams
  SET total_likes = COALESCE(total_likes, 0) + p_like_count
  WHERE id = p_stream_id
  RETURNING total_likes INTO v_new_total;

  RETURN COALESCE(v_new_total, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_stream_likes(uuid, integer) TO authenticated;

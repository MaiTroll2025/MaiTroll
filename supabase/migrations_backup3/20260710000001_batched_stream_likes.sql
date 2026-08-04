-- Migration: Batched stream likes system
-- Timestamp: 20260710000001

-- 1. Create stream_user_likes table
CREATE TABLE IF NOT EXISTS public.stream_user_likes (
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  like_count bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_stream_user_likes_stream ON public.stream_user_likes(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_user_likes_user ON public.stream_user_likes(user_id);

-- 2. Drop old increment_stream_likes and create new batched version
DROP FUNCTION IF EXISTS public.increment_stream_likes(UUID);

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
  v_user_id uuid := auth.uid();
  v_new_stream_total bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_like_count < 1 OR p_like_count > 100 THEN
    RAISE EXCEPTION 'Invalid like count';
  END IF;

  INSERT INTO public.stream_user_likes (
    stream_id,
    user_id,
    like_count,
    updated_at
  )
  VALUES (
    p_stream_id,
    v_user_id,
    p_like_count,
    now()
  )
  ON CONFLICT (stream_id, user_id)
  DO UPDATE SET
    like_count = stream_user_likes.like_count + excluded.like_count,
    updated_at = now()
  RETURNING stream_user_likes.like_count INTO v_new_stream_total;

  UPDATE public.streams
  SET total_likes = COALESCE(total_likes, 0) + p_like_count
  WHERE id = p_stream_id
  RETURNING total_likes INTO v_new_stream_total;

  RETURN v_new_stream_total;
END;
$$;

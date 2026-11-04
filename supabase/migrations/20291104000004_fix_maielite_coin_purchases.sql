CREATE OR REPLACE FUNCTION public.shop_buy_call_minutes(
  p_user_id uuid,
  p_package_id text,
  p_minutes integer,
  p_cost integer,
  p_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid boolean;
BEGIN
  IF auth.uid() <> p_user_id
    OR p_minutes <> 30
    OR p_cost <> 10
    OR p_type NOT IN ('audio', 'video') THEN
    RAISE EXCEPTION 'Invalid call package';
  END IF;

  v_paid := public.try_pay_coins_secure(p_cost, 'call_minutes', p_metadata);
  IF NOT v_paid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient Troll Coins');
  END IF;

  INSERT INTO public.call_minutes (user_id, audio_minutes, video_minutes, updated_at)
  VALUES (
    p_user_id,
    CASE WHEN p_type = 'audio' THEN p_minutes ELSE 0 END,
    CASE WHEN p_type = 'video' THEN p_minutes ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET audio_minutes = public.call_minutes.audio_minutes + EXCLUDED.audio_minutes,
      video_minutes = public.call_minutes.video_minutes + EXCLUDED.video_minutes,
      updated_at = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.shop_buy_call_minutes(uuid, text, integer, integer, text, jsonb) TO authenticated;

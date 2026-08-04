CREATE OR REPLACE FUNCTION public.set_stream_box_count(
  p_stream_id UUID,
  p_new_box_count INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE public.streams
  SET box_count = p_new_box_count
  WHERE id = p_stream_id;

  INSERT INTO public.messages (stream_id, type, content)
  VALUES (p_stream_id, 'BOX_COUNT_UPDATE', jsonb_build_object('box_count', p_new_box_count));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
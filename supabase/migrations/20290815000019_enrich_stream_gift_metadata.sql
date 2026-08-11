-- Auto-enrich stream_gifts with animation metadata from gift_items
-- This ensures the broadcaster always has video URLs without needing client-side gift_items queries
CREATE OR REPLACE FUNCTION public.enrich_stream_gift_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_animation_url text;
  v_animation_type text;
  v_animation_duration_ms integer;
  v_sound_url text;
  v_animation_key text;
  v_rarity text;
  v_is_fullscreen boolean;
  v_gift_name text;
  v_icon text;
BEGIN
  SELECT animation_url, animation_type, animation_duration_ms, sound_url, animation_key, rarity, is_fullscreen, name, icon
    INTO v_animation_url, v_animation_type, v_animation_duration_ms, v_sound_url, v_animation_key, v_rarity, v_is_fullscreen, v_gift_name, v_icon
    FROM public.gift_items
   WHERE gift_slug = NEW.gift_id
      OR id::text = NEW.gift_id
   LIMIT 1;

  IF FOUND THEN
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'animation_url', v_animation_url,
      'animation_type', COALESCE(v_animation_type, 'video'),
      'animation_duration_ms', v_animation_duration_ms,
      'sound_url', v_sound_url,
      'animation_key', v_animation_key,
      'rarity', v_rarity,
      'is_fullscreen', v_is_fullscreen,
      'gift_name', COALESCE(v_gift_name, NEW.gift_id),
      'icon', v_icon
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enrich_stream_gift_metadata ON public.stream_gifts;
CREATE TRIGGER trg_enrich_stream_gift_metadata
  BEFORE INSERT ON public.stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.enrich_stream_gift_metadata();

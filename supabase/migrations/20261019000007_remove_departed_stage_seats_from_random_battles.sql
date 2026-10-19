BEGIN;

CREATE OR REPLACE FUNCTION public.remove_departed_random_battle_stage_seat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_stream_id uuid;
  v_user_id uuid;
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_stream_id := OLD.stream_id;
    v_user_id := OLD.user_id;
    v_old_status := OLD.status;
    v_new_status := 'left';
  ELSE
    v_stream_id := NEW.stream_id;
    v_user_id := NEW.user_id;
    v_old_status := OLD.status;
    v_new_status := NEW.status;
  END IF;

  IF v_user_id IS NOT NULL
     AND lower(COALESCE(v_old_status, '')) IN ('reserved', 'camera_starting', 'active', 'live')
     AND lower(COALESCE(v_new_status, '')) NOT IN ('reserved', 'camera_starting', 'active', 'live') THEN
    DELETE FROM public.battle_participants AS participant
    USING public.streams AS stream
    WHERE participant.battle_id = stream.battle_id
      AND participant.source_stream_id = v_stream_id
      AND participant.user_id = v_user_id
      AND participant.role = 'stage'
      AND stream.id = v_stream_id
      AND stream.battle_mode = 'random_queue'
      AND stream.battle_status IN ('starting', 'ready', 'active');
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS remove_departed_random_battle_stage_seat
  ON public.stream_seat_sessions;

CREATE TRIGGER remove_departed_random_battle_stage_seat
AFTER UPDATE OF status OR DELETE ON public.stream_seat_sessions
FOR EACH ROW
EXECUTE FUNCTION public.remove_departed_random_battle_stage_seat();

COMMIT;

-- Strict moderation enforcement for broadcast chat, wall posts, kicks, and timed mutes.

ALTER TABLE public.stream_kicks
  ADD COLUMN IF NOT EXISTS kicked_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.stream_bans
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.stream_mutes
  ADD COLUMN IF NOT EXISTS muted_by uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text;

ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS blocked_by uuid,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text;

CREATE OR REPLACE FUNCTION public.is_user_chat_blocked(
  p_user_id uuid,
  p_stream_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_blocks cb
    WHERE cb.user_id = p_user_id
      AND cb.expires_at > now()
      AND (p_stream_id IS NULL OR cb.stream_id = p_stream_id OR cb.stream_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_blocked_stream_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.is_user_chat_blocked(NEW.user_id, NEW.stream_id) THEN
    RAISE EXCEPTION 'Your chat is disabled by moderation action'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_blocked_stream_chat ON public.stream_messages;
CREATE TRIGGER trg_prevent_blocked_stream_chat
BEFORE INSERT ON public.stream_messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_blocked_stream_chat();

CREATE OR REPLACE FUNCTION public.prevent_blocked_wall_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL AND public.is_user_chat_blocked(NEW.user_id, NULL) THEN
    RAISE EXCEPTION 'Your chat is disabled by moderation action'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_blocked_wall_chat ON public.troll_wall_posts;
CREATE TRIGGER trg_prevent_blocked_wall_chat
BEFORE INSERT ON public.troll_wall_posts
FOR EACH ROW
EXECUTE FUNCTION public.prevent_blocked_wall_chat();

CREATE OR REPLACE FUNCTION public.trigger_notify_stream_ban()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_banned_user text;
  v_banned_by text;
BEGIN
  SELECT username INTO v_banned_user FROM public.user_profiles WHERE id = NEW.user_id;
  SELECT username INTO v_banned_by FROM public.user_profiles WHERE id = COALESCE(NEW.created_by, NEW.banned_by);

  PERFORM public.notify_staff(
    'stream.ban',
    'User Banned from Stream',
    COALESCE(v_banned_user, 'User') || ' was banned by ' || COALESCE(v_banned_by, 'Staff') || '. Reason: ' || COALESCE(NEW.reason, 'No reason'),
    jsonb_build_object(
      'stream_id', NEW.stream_id,
      'user_id', NEW.user_id,
      'route', '/watch/' || NEW.stream_id
    )
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_chat_blocked(uuid, uuid) TO authenticated;

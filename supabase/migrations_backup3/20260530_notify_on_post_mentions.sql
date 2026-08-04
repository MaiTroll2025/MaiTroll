-- Notify users when they are #tagged in a troll wall post
-- Date: 2026-05-30

-- Function: scan post content for #username tags and create notifications
CREATE OR REPLACE FUNCTION public.notify_users_on_post_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_text TEXT := COALESCE(NEW.content, '');
  v_usernames TEXT[];
  v_username TEXT;
  v_user_id UUID;
  v_actor_username TEXT;
BEGIN
  -- Quick exit if no # present
  IF v_text NOT LIKE '%#%' THEN
    RETURN NEW;
  END IF;

  -- Extract unique usernames (alphanumeric + underscore)
  SELECT ARRAY(SELECT DISTINCT m[1] FROM regexp_matches(v_text, '#([A-Za-z0-9_]+)', 'g') AS m)
  INTO v_usernames;

  IF v_usernames IS NULL OR array_length(v_usernames, 1) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT username INTO v_actor_username FROM public.user_profiles WHERE id = NEW.user_id LIMIT 1;
  v_actor_username := COALESCE(v_actor_username, 'Someone');

  FOREACH v_username IN ARRAY v_usernames LOOP
    -- Resolve username to user id
    SELECT id INTO v_user_id FROM public.user_profiles WHERE lower(username) = lower(v_username) LIMIT 1;

    IF FOUND AND v_user_id IS NOT NULL AND v_user_id <> NEW.user_id THEN
      PERFORM public.create_notification(
        v_user_id,
        'someone_mentioned',
        '📣 You Were Mentioned',
        format('%s tagged you in a post', v_actor_username),
        jsonb_build_object('post_id', NEW.id, 'mentioned_by', NEW.user_id, 'mentioned_username', v_username, 'action_url', '/profile')
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_users_on_post_mentions() TO authenticated;

-- Remove legacy post mention triggers on the old table, if present
DROP TRIGGER IF EXISTS trg_notify_on_post_mentions_insert ON public.troll_posts;
DROP TRIGGER IF EXISTS trg_notify_on_post_mentions_update ON public.troll_posts;

-- Trigger: after insert -> notify mentioned users
DROP TRIGGER IF EXISTS trg_notify_on_post_mentions_insert ON public.troll_wall_posts;
CREATE TRIGGER trg_notify_on_post_mentions_insert
AFTER INSERT ON public.troll_wall_posts
FOR EACH ROW
WHEN (NEW.content IS NOT NULL)
EXECUTE FUNCTION public.notify_users_on_post_mentions();

-- Trigger: after update of content -> notify newly mentioned users
DROP TRIGGER IF EXISTS trg_notify_on_post_mentions_update ON public.troll_wall_posts;
CREATE TRIGGER trg_notify_on_post_mentions_update
AFTER UPDATE OF content ON public.troll_wall_posts
FOR EACH ROW
WHEN (NEW.content IS NOT NULL AND NEW.content IS DISTINCT FROM OLD.content)
EXECUTE FUNCTION public.notify_users_on_post_mentions();

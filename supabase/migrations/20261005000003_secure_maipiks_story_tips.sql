BEGIN;

CREATE OR REPLACE FUNCTION public.maipiks_validate_story_tip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_story public.maipiks_stories%ROWTYPE;
  v_item_story_id UUID;
  v_viewer UUID := auth.uid();
BEGIN
  IF v_viewer IS NULL OR NEW.tipper_user_id <> v_viewer THEN
    RAISE EXCEPTION 'Tipper must be the authenticated user';
  END IF;

  IF NEW.story_id IS NULL AND NEW.story_item_id IS NOT NULL THEN
    SELECT story_id INTO NEW.story_id
    FROM public.maipiks_story_items
    WHERE id = NEW.story_item_id;
  END IF;

  SELECT * INTO v_story
  FROM public.maipiks_stories
  WHERE id = NEW.story_id
  FOR SHARE;

  IF NOT FOUND
    OR v_story.deleted_at IS NOT NULL
    OR v_story.expires_at <= NOW()
    OR NEW.owner_user_id <> v_story.user_id THEN
    RAISE EXCEPTION 'Story is unavailable';
  END IF;

  IF NEW.story_item_id IS NOT NULL THEN
    SELECT story_id INTO v_item_story_id
    FROM public.maipiks_story_items
    WHERE id = NEW.story_item_id
      AND deleted_at IS NULL
      AND expires_at > NOW();

    IF v_item_story_id IS DISTINCT FROM v_story.id THEN
      RAISE EXCEPTION 'Story media is unavailable';
    END IF;
  END IF;

  IF v_story.user_id <> v_viewer THEN
    IF v_story.visibility = 'followers' AND NOT EXISTS (
      SELECT 1 FROM public.user_follows
      WHERE follower_id = v_viewer
        AND following_id = v_story.user_id
    ) THEN
      RAISE EXCEPTION 'You cannot tip this story';
    END IF;

    IF v_story.visibility = 'private' AND NOT EXISTS (
      SELECT 1 FROM public.user_subscriptions
      WHERE subscriber_id = v_viewer
        AND broadcaster_id = v_story.user_id
        AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'You cannot tip this story';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS maipiks_story_tips_validate_access ON public.maipiks_story_tips;
CREATE TRIGGER maipiks_story_tips_validate_access
  BEFORE INSERT ON public.maipiks_story_tips
  FOR EACH ROW
  EXECUTE FUNCTION public.maipiks_validate_story_tip();

REVOKE ALL ON FUNCTION public.maipiks_validate_story_tip() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.maipiks_ensure_tip_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE user_id = NEW.tipper_user_id
      AND type = 'spend'
      AND metadata->>'tip_id' = NEW.id::TEXT
  ) THEN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
    VALUES (
      NEW.tipper_user_id,
      'spend',
      NEW.coins,
      'MAI Piks story tip sent',
      jsonb_build_object(
        'tip_id', NEW.id,
        'story_id', NEW.story_id,
        'owner_user_id', NEW.owner_user_id,
        'owner_coins', NEW.owner_coins,
        'platform_coins', NEW.platform_coins
      ),
      NEW.created_at
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.coin_transactions
    WHERE user_id = NEW.owner_user_id
      AND type = 'earn'
      AND metadata->>'tip_id' = NEW.id::TEXT
  ) THEN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
    VALUES (
      NEW.owner_user_id,
      'earn',
      NEW.owner_coins,
      'MAI Piks story tip received',
      jsonb_build_object(
        'tip_id', NEW.id,
        'story_id', NEW.story_id,
        'tipper_user_id', NEW.tipper_user_id,
        'gross_coins', NEW.coins,
        'platform_coins', NEW.platform_coins
      ),
      NEW.created_at
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.maipiks_ensure_tip_ledger() FROM PUBLIC;

DROP TRIGGER IF EXISTS maipiks_story_tips_ensure_ledger ON public.maipiks_story_tips;
CREATE CONSTRAINT TRIGGER maipiks_story_tips_ensure_ledger
  AFTER INSERT ON public.maipiks_story_tips
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION public.maipiks_ensure_tip_ledger();

COMMIT;
-- Stop cloning every user notification to admins.
DROP TRIGGER IF EXISTS trg_clone_notification_to_admins ON public.notifications;

CREATE OR REPLACE FUNCTION public.clone_notification_to_admins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Bail must release the user immediately and notify only that user.
CREATE OR REPLACE FUNCTION public.release_user_when_bail_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF COALESCE(NEW.bond_posted, false) = true
     AND COALESCE(OLD.bond_posted, false) = false THEN
    NEW.status := 'released_pending_trial';
    NEW.release_time := LEAST(COALESCE(NEW.release_time, NOW()), NOW());

    UPDATE public.user_profiles
    SET is_jailed = false,
        updated_at = NOW()
    WHERE id = NEW.user_id;

    INSERT INTO public.notifications (user_id, type, title, message, metadata, priority, is_read, created_at)
    SELECT
      NEW.user_id,
      'jail_release_completed',
      'Released on Bail',
      'You have been released. Make sure you show up for court to avoid being arrested for failure to appear.',
      jsonb_build_object(
        'jail_id', NEW.id,
        'bond_amount', COALESCE(NEW.bond_amount, 0),
        'court_date', NEW.court_date,
        'action_url', '/troll-court'
      ),
      'high',
      false,
      NOW()
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.notifications
      WHERE user_id = NEW.user_id
        AND type = 'jail_release_completed'
        AND metadata->>'jail_id' = NEW.id::text
        AND created_at > NOW() - INTERVAL '5 minutes'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_user_when_bail_paid ON public.jail;
CREATE TRIGGER trg_release_user_when_bail_paid
  BEFORE UPDATE OF bond_posted ON public.jail
  FOR EACH ROW
  EXECUTE FUNCTION public.release_user_when_bail_paid();

-- Reserve payout coins at request time so finance liability and user balance stay honest.
CREATE OR REPLACE FUNCTION public.reserve_payout_request_coins()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins BIGINT := 0;
  v_balance BIGINT := 0;
  v_reserved BIGINT := 0;
BEGIN
  v_coins := COALESCE(
    to_jsonb(NEW)->>'requested_coins',
    to_jsonb(NEW)->>'coins_amount',
    to_jsonb(NEW)->>'coin_amount',
    to_jsonb(NEW)->>'coins_used',
    '0'
  )::BIGINT;

  IF v_coins <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(troll_coins, 0), COALESCE(reserved_troll_coins, 0)
  INTO v_balance, v_reserved
  FROM public.user_profiles
  WHERE id = NEW.user_id
  FOR UPDATE;

  IF v_balance < v_coins THEN
    RAISE EXCEPTION 'Insufficient coins for payout request';
  END IF;

  UPDATE public.user_profiles
  SET troll_coins = v_balance - v_coins,
      reserved_troll_coins = v_reserved + v_coins,
      updated_at = NOW()
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reserve_payout_request_coins ON public.payout_requests;
CREATE TRIGGER trg_reserve_payout_request_coins
  BEFORE INSERT ON public.payout_requests
  FOR EACH ROW
  WHEN (NEW.status IS NULL OR NEW.status IN ('pending', 'requested', 'review'))
  EXECUTE FUNCTION public.reserve_payout_request_coins();

BEGIN;

CREATE OR REPLACE FUNCTION public.apply_gift_to_battle_pot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_broadcaster_id UUID;
  v_round_id UUID;
  v_target INTEGER;
  v_collected INTEGER;
  v_gift_coins INTEGER;
  v_accepted INTEGER;
  v_idempotency_key TEXT;
  v_contribution_id UUID;
BEGIN
  IF NEW.stream_id IS NULL
     OR NEW.sender_id IS NULL
     OR COALESCE(NEW.currency_used, 'coins') <> 'coins'
     OR COALESCE(NEW.coins_spent, NEW.amount, 0) <= 0
     OR COALESCE(NEW.metadata->>'platform_controlled', 'false') = 'true'
     OR COALESCE(NEW.metadata->>'is_platform_controlled', 'false') = 'true'
     OR COALESCE(NEW.metadata->>'source', '') = 'automated_audience' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(user_id, broadcaster_id)
    INTO v_broadcaster_id
  FROM public.streams
  WHERE id = NEW.stream_id;

  IF v_broadcaster_id IS NULL
     OR COALESCE(NEW.recipient_id, NEW.receiver_id) IS DISTINCT FROM v_broadcaster_id THEN
    RETURN NEW;
  END IF;

  v_gift_coins := COALESCE(NEW.coins_spent, NEW.amount, 0);
  v_idempotency_key := 'gift:' || NEW.id::TEXT;

  SELECT id, target_coins, collected_coins
    INTO v_round_id, v_target, v_collected
  FROM public.battle_pot_rounds
  WHERE broadcaster_id = v_broadcaster_id
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_round_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_accepted := LEAST(v_gift_coins, GREATEST(v_target - v_collected, 0));
  IF v_accepted <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.battle_pot_contributions (
    round_id,
    contributor_id,
    amount,
    broadcaster_share,
    admin_share,
    idempotency_key
  ) VALUES (
    v_round_id,
    NEW.sender_id,
    v_accepted,
    v_accepted,
    0,
    v_idempotency_key
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_contribution_id;

  IF v_contribution_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.battle_pot_rounds
  SET collected_coins = collected_coins + v_accepted,
      status = CASE
        WHEN collected_coins + v_accepted >= target_coins THEN 'reached'
        ELSE status
      END,
      reached_at = CASE
        WHEN collected_coins + v_accepted >= target_coins THEN COALESCE(reached_at, NOW())
        ELSE reached_at
      END,
      updated_at = NOW()
  WHERE id = v_round_id;

  IF v_collected + v_accepted >= v_target
     AND EXISTS (
       SELECT 1
       FROM public.battle_pot_rounds
       WHERE id = v_round_id
         AND round_type = 'initial_unlock'
     ) THEN
    UPDATE public.user_profiles
    SET battle_unlocked = TRUE,
        battle_unlocked_at = COALESCE(battle_unlocked_at, NOW())
    WHERE id = v_broadcaster_id;

    INSERT INTO public.broadcaster_battle_unlocks (user_id, unlocked_at, initial_target_coins)
    VALUES (v_broadcaster_id, NOW(), v_target)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS apply_gift_to_battle_pot_after_insert ON public.stream_gifts;
CREATE TRIGGER apply_gift_to_battle_pot_after_insert
  AFTER INSERT ON public.stream_gifts
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_gift_to_battle_pot();

CREATE OR REPLACE FUNCTION public.prevent_self_battle_unlock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated')
     AND auth.uid() = OLD.id
     AND (
       NEW.battle_unlocked IS DISTINCT FROM OLD.battle_unlocked
       OR NEW.battle_unlocked_at IS DISTINCT FROM OLD.battle_unlocked_at
     ) THEN
    RAISE EXCEPTION 'Battle unlock status is controlled by gift-funded Battle Pot rounds.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_battle_unlock_change_trigger ON public.user_profiles;
CREATE TRIGGER prevent_self_battle_unlock_change_trigger
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_battle_unlock_change();

DROP POLICY IF EXISTS "battle_contributions_insert" ON public.battle_pot_contributions;
DROP POLICY IF EXISTS "battle_rounds_broadcaster_write" ON public.battle_pot_rounds;
DROP POLICY IF EXISTS "battle_unlocks_broadcaster_write" ON public.broadcaster_battle_unlocks;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.battle_pot_contributions
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.battle_pot_rounds
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.broadcaster_battle_unlocks
  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.apply_gift_to_battle_pot() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_battle_unlock_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contribute_to_battle_pot(UUID, BIGINT, TEXT)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.apply_gift_to_battle_pot() IS
  'Counts paid coin gifts sent to the broadcaster toward the open Battle Pot round without charging or crediting any additional coins.';
COMMENT ON FUNCTION public.prevent_self_battle_unlock_change() IS
  'Prevents authenticated users from bypassing the gift-funded Battle Pot to unlock battles on their own profile.';

COMMENT ON TABLE public.battle_pot_contributions IS
  'Audit records of gift-funded Battle Pot progress. Gift contributions track the already-paid gift value and do not move coins a second time.';

COMMIT;

-- Unify coin economy: eliminate free coins, make troll_coins the single paid-coin balance
-- All existing coin values become cashable paid coins in troll_coins

-- 1. Merge free_coin_balance into troll_coins and zero it out
UPDATE public.user_profiles
SET
  troll_coins = COALESCE(troll_coins, 0) + COALESCE(free_coin_balance, 0),
  free_coin_balance = 0
WHERE COALESCE(free_coin_balance, 0) > 0;

-- 2. If a separate paid_coin_balance column exists, merge it into troll_coins too
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'paid_coin_balance'
  ) THEN
    UPDATE public.user_profiles
    SET
      troll_coins = COALESCE(troll_coins, 0) + COALESCE(paid_coin_balance, 0),
      paid_coin_balance = 0
    WHERE COALESCE(paid_coin_balance, 0) > 0;
  END IF;
END $$;

-- 3. If a separate coin_balance column exists, merge it into troll_coins too
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND column_name = 'coin_balance'
  ) THEN
    UPDATE public.user_profiles
    SET
      troll_coins = COALESCE(troll_coins, 0) + COALESCE(coin_balance, 0),
      coin_balance = 0
    WHERE COALESCE(coin_balance, 0) > 0;
  END IF;
END $$;

-- 4. Ensure troll_coins is non-negative after merges
UPDATE public.user_profiles
SET troll_coins = GREATEST(COALESCE(troll_coins, 0), 0)
WHERE troll_coins < 0;

-- 5. Replace add_free_coins with a paid-coin version that credits troll_coins
CREATE OR REPLACE FUNCTION public.add_free_coins(p_user_id uuid, p_amount bigint)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + p_amount,
      updated_at = now()
  WHERE id = p_user_id;
$$;

-- 6. Ensure add_paid_coins also credits troll_coins (the canonical paid balance)
CREATE OR REPLACE FUNCTION public.add_paid_coins(user_id_input uuid, coins_to_add integer)
RETURNS void
LANGUAGE sql
SET search_path TO 'public', 'extensions'
AS $$
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + coins_to_add
  WHERE id = user_id_input;
$$;

-- 7. Make sure the main coin deduction path uses troll_coins
CREATE OR REPLACE FUNCTION public.deduct_user_paid_coins(
  p_user_id uuid,
  p_amount bigint,
  p_coin_type text DEFAULT 'troll_coins'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF p_coin_type = 'troll_coins' OR p_coin_type IS NULL OR p_coin_type = '' THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) - p_amount,
        updated_at = now()
    WHERE id = p_user_id
      AND COALESCE(troll_coins, 0) >= p_amount;
  END IF;
END;
$$;

-- 8. Update adjust_balance to treat troll_coins as the paid currency
CREATE OR REPLACE FUNCTION public.adjust_balance(
  p_user_id uuid,
  p_currency text,
  p_amount bigint,
  p_event text DEFAULT NULL
)
RETURNS TABLE(troll_coins bigint, trollmonds bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF p_currency = 'troll_coins' OR p_currency IS NULL OR p_currency = '' THEN
    UPDATE public.user_profiles
    SET troll_coins = COALESCE(troll_coins, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id
    RETURNING COALESCE(troll_coins, 0) INTO troll_coins;

    SELECT COALESCE(trollmonds, 0) INTO trollmonds
    FROM public.user_profiles
    WHERE id = p_user_id;

    RETURN NEXT;
    RETURN;
  END IF;

  IF p_currency = 'trollmonds' THEN
    UPDATE public.user_profiles
    SET trollmonds = COALESCE(trollmonds, 0) + p_amount,
        updated_at = now()
    WHERE id = p_user_id
    RETURNING COALESCE(trollmonds, 0) INTO trollmonds;

    SELECT COALESCE(troll_coins, 0) INTO troll_coins
    FROM public.user_profiles
    WHERE id = p_user_id;

    RETURN NEXT;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Invalid currency: %. Only troll_coins and trollmonds allowed.', p_currency;
END;
$$;

-- 9. Grant permissions on updated functions
GRANT EXECUTE ON FUNCTION public.add_free_coins(uuid, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_free_coins(uuid, bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_paid_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_paid_coins(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_user_paid_coins(uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_user_paid_coins(uuid, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_balance(uuid, text, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.adjust_balance(uuid, text, bigint, text) TO authenticated;

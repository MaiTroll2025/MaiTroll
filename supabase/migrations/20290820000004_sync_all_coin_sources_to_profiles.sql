-- ============================================================================
-- Migration: Sync all legacy coin sources into user_profiles.troll_coins
-- Date: 2026-08-17
-- Purpose: Users may have coins in legacy columns that the cashout UI doesn't
--          read from. This backfills user_profiles.troll_coins from:
--          1. public.user_balances.troll_coins (legacy adjust_balance path)
--          2. public.profiles.troll_coins (old auth-linked profile table)
--          3. public.user_profiles.paid_coin_balance (legacy paid coins)
--          4. public.user_profiles.free_coin_balance (legacy free/trollmond coins)
--          5. public.user_profiles.coin_balance (older balance column)
--          And ensures cashout_coins mirrors the final troll_coins value.
-- ============================================================================

-- 1. Sync from user_balances if it exists and has troll_coins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_balances'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_balances' AND column_name = 'troll_coins'
  ) THEN
    UPDATE public.user_profiles up
    SET
      troll_coins = GREATEST(COALESCE(up.troll_coins, 0), COALESCE(ub.troll_coins, 0)),
      cashout_coins = GREATEST(COALESCE(up.cashout_coins, 0), COALESCE(ub.troll_coins, 0)),
      updated_at = NOW()
    FROM public.user_balances ub
    WHERE up.id = ub.user_id
      AND COALESCE(ub.troll_coins, 0) > COALESCE(up.troll_coins, 0);
  END IF;
END $$;

-- 2. Sync from public.profiles if it exists and has troll_coins
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'troll_coins'
  ) THEN
    UPDATE public.user_profiles up
    SET
      troll_coins = GREATEST(COALESCE(up.troll_coins, 0), COALESCE(p.troll_coins, 0)),
      cashout_coins = GREATEST(COALESCE(up.cashout_coins, 0), COALESCE(p.troll_coins, 0)),
      updated_at = NOW()
    FROM public.profiles p
    WHERE up.user_id = p.id
      AND COALESCE(p.troll_coins, 0) > COALESCE(up.troll_coins, 0);
  END IF;
END $$;

-- 3. Merge paid_coin_balance into troll_coins if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'paid_coin_balance'
  ) THEN
    UPDATE public.user_profiles
    SET
      troll_coins = COALESCE(troll_coins, 0) + COALESCE(paid_coin_balance, 0),
      paid_coin_balance = 0,
      updated_at = NOW()
    WHERE COALESCE(paid_coin_balance, 0) > 0;
  END IF;
END $$;

-- 4. Merge free_coin_balance into troll_coins if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'free_coin_balance'
  ) THEN
    UPDATE public.user_profiles
    SET
      troll_coins = COALESCE(troll_coins, 0) + COALESCE(free_coin_balance, 0),
      free_coin_balance = 0,
      updated_at = NOW()
    WHERE COALESCE(free_coin_balance, 0) > 0;
  END IF;
END $$;

-- 5. Merge coin_balance into troll_coins if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'coin_balance'
  ) THEN
    UPDATE public.user_profiles
    SET
      troll_coins = COALESCE(troll_coins, 0) + COALESCE(coin_balance, 0),
      coin_balance = 0,
      updated_at = NOW()
    WHERE COALESCE(coin_balance, 0) > 0;
  END IF;
END $$;

-- 6. Ensure cashout_coins mirrors troll_coins for everyone
UPDATE public.user_profiles
SET cashout_coins = COALESCE(troll_coins, 0)
WHERE COALESCE(cashout_coins, 0) = 0
  AND COALESCE(troll_coins, 0) > 0;

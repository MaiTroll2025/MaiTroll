BEGIN;

DROP TRIGGER IF EXISTS grant_battle_starter_coins_on_signup
  ON public.user_profiles;

COMMIT;

-- Fix coin_transactions_source_check constraint to allow all valid source values
-- The existing constraint only allows: purchase, gift, wheel, bonus
-- But the application uses many more source values like: battle, cashout, reward, etc.

ALTER TABLE coin_transactions
  DROP CONSTRAINT IF EXISTS coin_transactions_source_check;

ALTER TABLE coin_transactions
  ADD CONSTRAINT coin_transactions_source_check
  CHECK (source = ANY(ARRAY[
    'purchase'::text,
    'gift'::text,
    'wheel'::text,
    'bonus'::text,
    'battle'::text,
    'cashout'::text,
    'reward'::text,
    'daily'::text,
    'weekly'::text,
    'event'::text,
    'tournament'::text,
    'league'::text,
    'family'::text,
    'entrance_effect'::text,
    'perk_purchase'::text,
    'insurance_purchase'::text,
    'call_minutes'::text,
    'troll_pass'::text,
    'coin_package'::text,
    'admin_grant'::text,
    'admin_deduct'::text,
    'refund'::text,
    'transfer_in'::text,
    'transfer_out'::text,
    'stream_reward'::text,
    'achievement'::text,
    'level_up'::text,
    'welcome_bonus'::text,
    'referral'::text,
    'signup_bonus'::text
  ]));

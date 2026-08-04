-- Extend coin_transactions.type CHECK constraint to support Troll Town types
-- and other newer transaction categories used by the application.
-- This prevents constraint violations like:
--   "new row for relation \"coin_transactions\" violates check constraint \"coin_transactions_type_check\""
-- when inserting rows with types such as 'troll_town_purchase'.

DO $$
BEGIN
  -- Drop existing type constraint if it exists
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'coin_transactions'
      AND constraint_name = 'coin_transactions_type_check'
  ) THEN
    ALTER TABLE public.coin_transactions
      DROP CONSTRAINT coin_transactions_type_check;
  END IF;

  -- Recreate constraint with an expanded, forward-compatible set of types.
  -- This list is a superset of the types defined in the baseline schema,
  -- plus all Troll Town–related types currently used in the frontend.
  ALTER TABLE public.coin_transactions
    ADD CONSTRAINT coin_transactions_type_check
    CHECK (
      type = ANY (
        ARRAY[
          -- Legacy / core types from baseline
          'store_purchase',
          'wheel_spin',
          'perk_purchase',
          'admin_adjustment',
          'reward',
          'entrance_effect',
          'gift',
          'purchase',
          'insurance_purchase',
          'broadcast_theme_purchase',
          'call_sound_purchase',

          -- Additional admin / system types used in newer flows
          'admin_grant',
          'admin_deduct',
          'refund',
          'lucky_gift_win',

          -- Troll Town ecosystem types
          'troll_town_purchase',
          'troll_town_sale',
          'troll_town_upgrade',
          'troll_town_bank_sale',
          'troll_town_bank'
        ]
      )
    );
END $$;


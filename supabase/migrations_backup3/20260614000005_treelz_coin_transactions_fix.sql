-- Add treelz_tip to coin_transactions type check if constraint exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'coin_transactions' AND constraint_name = 'coin_transactions_type_check'
  ) THEN
    ALTER TABLE coin_transactions DROP CONSTRAINT IF EXISTS coin_transactions_type_check;
    ALTER TABLE coin_transactions ADD CONSTRAINT coin_transactions_type_check
      CHECK (type IN ('spend', 'earn', 'purchase', 'reward', 'bonus', 'gift', 'gift_received', 'trollmond_gift', 'treelz_tip', 'admin_grant', 'daily_login', 'store_purchase'));
  END IF;
END $$;

BEGIN;

ALTER TABLE public.pet_feed_refund_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_weekly_refund_payouts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pet_feed_refund_entries'
      AND policyname = 'Users can read their pet refund entries'
  ) THEN
    CREATE POLICY "Users can read their pet refund entries"
      ON public.pet_feed_refund_entries
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pet_weekly_refund_payouts'
      AND policyname = 'Users can read their pet refund payouts'
  ) THEN
    CREATE POLICY "Users can read their pet refund payouts"
      ON public.pet_weekly_refund_payouts
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

GRANT SELECT ON public.pet_feed_refund_entries TO authenticated;
GRANT SELECT ON public.pet_weekly_refund_payouts TO authenticated;

COMMIT;
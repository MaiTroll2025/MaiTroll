BEGIN;

REVOKE ALL ON TABLE public.user_profiles FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_profiles FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.user_profiles TO authenticated;

DROP POLICY IF EXISTS "Public can read user profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Public can read user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS user_profiles_hide_active_ghost_identity ON public.user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.user_profiles;
CREATE POLICY "Users can read own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

REVOKE ALL ON TABLE public.payout_requests FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payout_requests FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.payout_requests TO authenticated;

REVOKE ALL ON TABLE public.payment_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.payment_logs FROM authenticated;
GRANT SELECT ON TABLE public.payment_logs TO authenticated;

COMMIT;

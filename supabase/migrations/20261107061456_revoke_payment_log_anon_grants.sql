-- Remove residual explicit privileges from anonymous payment-log access.
BEGIN;

REVOKE ALL ON TABLE public.payment_logs FROM anon;
REVOKE ALL ON TABLE public.payment_logs FROM PUBLIC;
GRANT SELECT ON TABLE public.payment_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payment_logs TO service_role;

COMMIT;

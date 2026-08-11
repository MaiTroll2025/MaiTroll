-- Launch Hardening Migration: Retention Policy & Indexes
-- Created: 2027-03-06

-- 1. Retention Policy Function (Scheduled Cleanup)
-- Can be called via cron or Edge Function
CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Messages: 30 days retention
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_messages') THEN
    DELETE FROM public.stream_messages WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;

  -- Viewer Sessions: 7 days retention
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_seat_sessions') THEN
    DELETE FROM public.stream_seat_sessions WHERE created_at < NOW() - INTERVAL '7 days';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_viewers') THEN
    DELETE FROM public.stream_viewers WHERE last_seen < NOW() - INTERVAL '7 days';
  END IF;

  -- System Errors: 30 days retention
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_errors') THEN
    DELETE FROM public.system_errors WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;

  -- Audit Logs: 90 days retention
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    DELETE FROM public.audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
  END IF;
  
  -- Notifications: 30 days retention (optional but good for hygiene)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications') THEN
    DELETE FROM public.notifications WHERE created_at < NOW() - INTERVAL '30 days';
  END IF;
  
  -- Rate Limits cleanup
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'rate_limits') THEN
    DELETE FROM public.rate_limits WHERE expires_at < NOW();
  END IF;

END;
$$;

-- 2. Performance Indexes
-- streams (status, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_streams_status_created_at ON public.streams(status, created_at DESC);

-- streams (broadcaster_id, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_streams_broadcaster_created_at ON public.streams(broadcaster_id, created_at DESC);

-- messages (stream_id, created_at DESC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stream_messages') THEN
        CREATE INDEX IF NOT EXISTS idx_stream_messages_stream_created_at ON public.stream_messages(stream_id, created_at DESC);
    END IF;
END $$;

-- payments (user_id, created_at DESC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_created_at ON public.payment_transactions(user_id, created_at DESC);
    END IF;
END $$;

-- gift_ledger (stream_id, created_at DESC)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'gift_ledger') THEN
        CREATE INDEX IF NOT EXISTS idx_gift_ledger_stream_created_at ON public.gift_ledger(stream_id, created_at DESC);
    END IF;
END $$;

-- 3. HLS URL Correction (One-time Fix)
UPDATE public.streams
SET hls_url = REPLACE(hls_url, 'https://gejtbllazzighxwxudyu.supabase.co/storage/v1/object/public/hls', 'https://cdn.maiMai Troll.com')
WHERE hls_url LIKE '%supabase.co%';

-- 4. Rate Limiting Support
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count int DEFAULT 1,
  expires_at timestamptz NOT NULL
);

-- Function to check and increment rate limit
-- Returns TRUE if request is allowed, FALSE if limit exceeded
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  -- Delete expired entries for this key (lazy cleanup)
  DELETE FROM public.rate_limits WHERE key = p_key AND expires_at < now();

  -- Upsert new window if not exists
  INSERT INTO public.rate_limits (key, expires_at, count)
  VALUES (p_key, now() + (p_window_seconds || ' seconds')::interval, 0)
  ON CONFLICT (key) DO NOTHING;

  -- Increment and check
  UPDATE public.rate_limits
  SET count = count + 1
  WHERE key = p_key
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- 5. Security Hardening (RLS & Permissions)

-- Revoke dangerous permissions on financial tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coin_transactions') THEN
    REVOKE INSERT, UPDATE, DELETE ON public.coin_transactions FROM authenticated;
    REVOKE INSERT, UPDATE, DELETE ON public.coin_transactions FROM anon;
  END IF;
END $$;

-- Ensure audit_logs are append-only (revoke update/delete)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
    REVOKE UPDATE, DELETE ON public.audit_logs FROM anon;
  END IF;
END $$;


-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.cleanup_old_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_old_data TO service_role;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;

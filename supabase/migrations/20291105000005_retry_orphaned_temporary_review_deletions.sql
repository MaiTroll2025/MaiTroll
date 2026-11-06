CREATE OR REPLACE FUNCTION public.claim_expired_temporary_review_accounts(p_limit integer DEFAULT 25)
RETURNS TABLE (user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH due AS (
    SELECT audit.user_id
    FROM public.temporary_review_account_audit audit
    WHERE audit.is_temporary_review_account
      AND audit.status <> 'deleted'
      AND audit.expires_at <= clock_timestamp()
      AND (
        audit.deletion_claimed_until IS NULL
        OR audit.deletion_claimed_until <= clock_timestamp()
      )
      AND (
        audit.status = 'deletion_pending'
        OR NOT EXISTS (
          SELECT 1
          FROM public.user_profiles profile
          WHERE profile.id = audit.user_id
            AND profile.is_temporary_review_account
            AND profile.temporary_review_expires_at > clock_timestamp()
        )
      )
    ORDER BY audit.expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
  )
  UPDATE public.temporary_review_account_audit audit
  SET status = 'deletion_pending',
      deletion_claimed_until = clock_timestamp() + interval '10 minutes',
      deletion_attempts = audit.deletion_attempts + 1
  FROM due
  WHERE audit.user_id = due.user_id
  RETURNING audit.user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_expired_temporary_review_accounts(integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_expired_temporary_review_accounts(integer)
  TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS trollmonds bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_temporary_review_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_review_activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS temporary_review_expires_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.user_profiles'::regclass
      AND conname = 'user_profiles_temporary_review_window_check'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_temporary_review_window_check
      CHECK (
        NOT is_temporary_review_account
        OR (
          temporary_review_activated_at IS NOT NULL
          AND temporary_review_expires_at = temporary_review_activated_at + interval '60 minutes'
        )
      );
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.temporary_review_account_audit (
  user_id uuid PRIMARY KEY,
  is_temporary_review_account boolean NOT NULL DEFAULT true
    CHECK (is_temporary_review_account),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'deletion_pending', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  activated_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  deletion_attempts integer NOT NULL DEFAULT 0 CHECK (deletion_attempts >= 0),
  deletion_claimed_until timestamptz,
  deleted_at timestamptz,
  last_failure_code text,
  last_alerted_at timestamptz,
  CHECK (expires_at = activated_at + interval '60 minutes'),
  CHECK ((status = 'deleted') = (deleted_at IS NOT NULL))
);

ALTER TABLE public.temporary_review_account_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.temporary_review_account_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.temporary_review_account_audit TO service_role;

CREATE OR REPLACE FUNCTION public.guard_temporary_review_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_temporary_review_account
       OR NEW.temporary_review_activated_at IS NOT NULL
       OR NEW.temporary_review_expires_at IS NOT NULL THEN
      RAISE EXCEPTION 'Temporary review fields can only be set by the activation workflow'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_temporary_review_account IS DISTINCT FROM OLD.is_temporary_review_account
     OR NEW.temporary_review_activated_at IS DISTINCT FROM OLD.temporary_review_activated_at
     OR NEW.temporary_review_expires_at IS DISTINCT FROM OLD.temporary_review_expires_at THEN
    IF current_setting('app.temporary_review_activation', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Temporary review fields can only be changed by the activation workflow'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_temporary_review_profile_fields ON public.user_profiles;
CREATE TRIGGER guard_temporary_review_profile_fields
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_temporary_review_profile_fields();

CREATE OR REPLACE FUNCTION public.activate_temporary_review_account(
  p_user_id uuid,
  p_marker text
)
RETURNS TABLE (activated_at timestamptz, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_profile_json jsonb;
  v_auth_user auth.users%ROWTYPE;
  v_now timestamptz;
  v_child record;
  v_has_related_data boolean;
  v_balance_field text;
  v_role_flag text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND (
        admin_profile.role IN ('admin', 'lead_troll_officer')
        OR admin_profile.is_admin IS TRUE
        OR admin_profile.is_lead_officer IS TRUE
      )
  ) THEN
    RAISE EXCEPTION 'Administrator access required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_profile
  FROM public.user_profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Review account profile was not found';
  END IF;

  SELECT * INTO v_auth_user
  FROM auth.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND
     OR v_auth_user.raw_app_meta_data ->> 'temporary_review_created' IS DISTINCT FROM 'true'
     OR v_auth_user.raw_app_meta_data ->> 'temporary_review_marker' IS DISTINCT FROM p_marker
     OR v_auth_user.created_at < clock_timestamp() - interval '10 minutes' THEN
    RAISE EXCEPTION 'Account was not freshly created by the temporary review workflow'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.temporary_review_account_audit
    WHERE user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Review access has already been activated for this account';
  END IF;

  v_profile_json := to_jsonb(v_profile);
  IF COALESCE(v_profile_json ->> 'role', '') <> 'user' THEN
    RAISE EXCEPTION 'Accounts with employment or elevated roles cannot enter review mode'
      USING ERRCODE = '42501';
  END IF;

  FOREACH v_role_flag IN ARRAY ARRAY[
    'is_admin', 'is_superadmin', 'is_lead_officer', 'is_lead_troll_officer',
    'is_troll_officer', 'is_troller', 'is_broadcaster', 'is_creator',
    'is_creator_onboarded', 'is_agency_hr', 'is_agency_hr_manager',
    'is_pastor', 'is_journalist', 'is_news_caster', 'is_chief_news_caster'
  ] LOOP
    IF COALESCE((v_profile_json ->> v_role_flag)::boolean, false) THEN
      RAISE EXCEPTION 'Accounts with employment or elevated roles cannot enter review mode'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOREACH v_balance_field IN ARRAY ARRAY[
    'troll_coins', 'trollmonds', 'paid_coin_balance', 'free_coin_balance',
    'total_earned_coins', 'total_spent_coins', 'hype_coins'
  ] LOOP
    IF COALESCE((v_profile_json ->> v_balance_field)::numeric, 0) <> 0 THEN
      RAISE EXCEPTION 'Accounts with balances cannot enter review mode'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  FOR v_child IN
    SELECT child_ns.nspname AS schema_name,
           child.relname AS table_name,
           child_col.attname AS column_name
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_attribute child_col
      ON child_col.attrelid = child.oid AND child_col.attnum = fk.conkey[1]
    JOIN pg_attribute parent_col
      ON parent_col.attrelid = parent.oid AND parent_col.attnum = fk.confkey[1]
    WHERE fk.contype = 'f'
      AND array_length(fk.conkey, 1) = 1
      AND array_length(fk.confkey, 1) = 1
      AND child_ns.nspname IN ('public', 'storage')
      AND parent.oid IN ('auth.users'::regclass, 'public.user_profiles'::regclass)
      AND parent_col.attname = 'id'
      AND child.oid NOT IN (
        'public.user_profiles'::regclass,
        'public.temporary_review_account_audit'::regclass
      )
  LOOP
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
      v_child.schema_name,
      v_child.table_name,
      v_child.column_name
    ) INTO v_has_related_data USING p_user_id;

    IF v_has_related_data THEN
      RAISE EXCEPTION 'Accounts with existing account-specific records cannot enter review mode'
        USING ERRCODE = '42501';
    END IF;
  END LOOP;

  v_now := clock_timestamp();
  PERFORM set_config('app.temporary_review_activation', 'on', true);
  UPDATE public.user_profiles
  SET is_temporary_review_account = true,
      temporary_review_activated_at = v_now,
      temporary_review_expires_at = v_now + interval '60 minutes',
      updated_at = v_now
  WHERE id = p_user_id;

  INSERT INTO public.temporary_review_account_audit (
    user_id, is_temporary_review_account, status, activated_at, expires_at
  ) VALUES (
    p_user_id, true, 'active', v_now, v_now + interval '60 minutes'
  );

  RETURN QUERY SELECT v_now, v_now + interval '60 minutes';
END;
$$;

REVOKE ALL ON FUNCTION public.activate_temporary_review_account(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_temporary_review_account(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_created_for_review boolean;
  v_is_temporary boolean;
  v_expires_at timestamptz;
  v_claims jsonb;
  v_exp bigint;
BEGIN
  SELECT auth_user.raw_app_meta_data ->> 'temporary_review_created' = 'true',
         profile.is_temporary_review_account,
         profile.temporary_review_expires_at
  INTO v_created_for_review, v_is_temporary, v_expires_at
  FROM auth.users auth_user
  LEFT JOIN public.user_profiles profile ON profile.id = auth_user.id
  WHERE auth_user.id = (event ->> 'user_id')::uuid;

  v_claims := event -> 'claims';
  IF NOT COALESCE(v_created_for_review, false)
     AND NOT COALESCE(v_is_temporary, false) THEN
    RETURN jsonb_build_object('claims', v_claims);
  END IF;

  IF NOT COALESCE(v_is_temporary, false)
     OR v_expires_at IS NULL
     OR v_expires_at <= clock_timestamp() THEN
    RETURN jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'Temporary review access has expired'
      )
    );
  END IF;

  v_exp := LEAST(
    (v_claims ->> 'exp')::bigint,
    floor(extract(epoch FROM v_expires_at))::bigint
  );
  v_claims := jsonb_set(v_claims, '{exp}', to_jsonb(v_exp), true);
  RETURN jsonb_build_object('claims', v_claims);
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
GRANT SELECT ON public.user_profiles TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.enforce_temporary_review_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subject uuid;
  v_claims jsonb;
  v_is_temporary boolean;
  v_expires_at timestamptz;
  v_method text;
BEGIN
  BEGIN
    v_subject := NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    v_subject := NULL;
  END;

  IF v_subject IS NULL THEN
    BEGIN
      v_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
      v_subject := NULLIF(v_claims ->> 'sub', '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_subject := NULL;
    END;
  END IF;

  IF v_subject IS NULL THEN
    RETURN;
  END IF;

  SELECT is_temporary_review_account, temporary_review_expires_at
  INTO v_is_temporary, v_expires_at
  FROM public.user_profiles
  WHERE id = v_subject;

  IF NOT COALESCE(v_is_temporary, false) THEN
    RETURN;
  END IF;

  IF v_expires_at IS NULL OR v_expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Temporary review access has expired'
      USING ERRCODE = '42501';
  END IF;

  v_method := upper(COALESCE(current_setting('request.method', true), ''));
  IF v_method NOT IN ('GET', 'HEAD') THEN
    RAISE EXCEPTION 'Temporary review accounts are read-only'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_temporary_review_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_temporary_review_request()
  TO anon, authenticated, service_role, authenticator;

DO $$
DECLARE
  v_existing text;
BEGIN
  SELECT split_part(config, '=', 2)
  INTO v_existing
  FROM pg_db_role_setting role_setting
  JOIN pg_roles role_name ON role_name.oid = role_setting.setrole
  CROSS JOIN LATERAL unnest(role_setting.setconfig) AS setting(config)
  WHERE role_name.rolname = 'authenticator'
    AND config LIKE 'pgrst.db_pre_request=%'
  LIMIT 1;

  IF v_existing IS NOT NULL
     AND v_existing <> 'public.enforce_temporary_review_request' THEN
    RAISE EXCEPTION 'An existing PostgREST pre-request hook must be composed with temporary review enforcement';
  END IF;

  ALTER ROLE authenticator
    SET pgrst.db_pre_request = 'public.enforce_temporary_review_request';
  NOTIFY pgrst, 'reload config';
END;
$$;

CREATE OR REPLACE FUNCTION public.block_temporary_review_storage_mutations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_temporary boolean;
  v_expires_at timestamptz;
BEGIN
  SELECT is_temporary_review_account, temporary_review_expires_at
  INTO v_is_temporary, v_expires_at
  FROM public.user_profiles
  WHERE id = auth.uid();

  IF COALESCE(v_is_temporary, false) THEN
    IF v_expires_at IS NULL OR v_expires_at <= clock_timestamp() THEN
      RAISE EXCEPTION 'Temporary review access has expired'
        USING ERRCODE = '42501';
    END IF;

    RAISE EXCEPTION 'Temporary review accounts cannot modify Storage'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS block_temporary_review_storage_mutations ON storage.objects;
CREATE TRIGGER block_temporary_review_storage_mutations
  BEFORE INSERT OR UPDATE OR DELETE ON storage.objects
  FOR EACH ROW EXECUTE FUNCTION public.block_temporary_review_storage_mutations();

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
        OR EXISTS (
          SELECT 1
          FROM public.user_profiles profile
          WHERE profile.id = audit.user_id
            AND profile.is_temporary_review_account
            AND profile.temporary_review_expires_at <= clock_timestamp()
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

CREATE OR REPLACE FUNCTION public.list_temporary_review_storage_objects(
  p_user_id uuid,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 500
)
RETURNS TABLE (bucket_id text, object_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     OR NOT EXISTS (
       SELECT 1
       FROM public.temporary_review_account_audit
       WHERE user_id = p_user_id
         AND is_temporary_review_account
         AND status <> 'deleted'
     ) THEN
    RAISE EXCEPTION 'Verified temporary review account required'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT objects.bucket_id, objects.name
  FROM storage.objects objects
  WHERE objects.owner_id::text = p_user_id::text
  ORDER BY objects.bucket_id, objects.name
  OFFSET GREATEST(COALESCE(p_offset, 0), 0)
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 500), 500));
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_temporary_review_owned_records(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_child record;
BEGIN
  IF auth.role() <> 'service_role'
     OR NOT EXISTS (
       SELECT 1
       FROM public.temporary_review_account_audit
       WHERE user_id = p_user_id
         AND is_temporary_review_account
         AND status <> 'deleted'
     ) THEN
    RAISE EXCEPTION 'Verified temporary review account required'
      USING ERRCODE = '42501';
  END IF;

  FOR v_child IN
    SELECT child_ns.nspname AS schema_name,
           child.relname AS table_name,
           child_col.attname AS column_name
    FROM pg_constraint fk
    JOIN pg_class child ON child.oid = fk.conrelid
    JOIN pg_namespace child_ns ON child_ns.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = fk.confrelid
    JOIN pg_attribute child_col
      ON child_col.attrelid = child.oid AND child_col.attnum = fk.conkey[1]
    JOIN pg_attribute parent_col
      ON parent_col.attrelid = parent.oid AND parent_col.attnum = fk.confkey[1]
    WHERE fk.contype = 'f'
      AND array_length(fk.conkey, 1) = 1
      AND array_length(fk.confkey, 1) = 1
      AND child_ns.nspname = 'public'
      AND parent.oid IN ('auth.users'::regclass, 'public.user_profiles'::regclass)
      AND parent_col.attname = 'id'
      AND child.oid NOT IN (
        'public.user_profiles'::regclass,
        'public.temporary_review_account_audit'::regclass
      )
      AND child.relname ~* '(presence|subscription|permission|active_session)'
  LOOP
    EXECUTE format(
      'DELETE FROM %I.%I WHERE %I = $1',
      v_child.schema_name,
      v_child.table_name,
      v_child.column_name
    ) USING p_user_id;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_temporary_review_account_deletion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     OR NOT EXISTS (
       SELECT 1
       FROM public.temporary_review_account_audit
       WHERE user_id = p_user_id
         AND is_temporary_review_account
         AND status = 'deletion_pending'
     ) THEN
    RAISE EXCEPTION 'Verified pending temporary review account required'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.user_profiles
  WHERE id = p_user_id
    AND is_temporary_review_account;

  UPDATE public.temporary_review_account_audit
  SET status = 'deleted',
      deleted_at = clock_timestamp(),
      deletion_claimed_until = NULL,
      last_failure_code = NULL
  WHERE user_id = p_user_id
    AND is_temporary_review_account;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_temporary_review_deletion_failure(
  p_user_id uuid,
  p_failure_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_should_alert boolean;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_failure_code NOT IN (
    'storage_cleanup_failed',
    'owned_record_cleanup_failed',
    'auth_delete_failed',
    'profile_cleanup_failed'
  ) THEN
    RAISE EXCEPTION 'Invalid cleanup failure code';
  END IF;

  UPDATE public.temporary_review_account_audit
  SET status = 'deletion_pending',
      deletion_claimed_until = NULL,
      last_failure_code = p_failure_code,
      last_alerted_at = CASE
        WHEN last_alerted_at IS NULL
          OR last_alerted_at < v_now - interval '30 minutes'
        THEN v_now
        ELSE last_alerted_at
      END
  WHERE user_id = p_user_id
    AND is_temporary_review_account
    AND status <> 'deleted'
  RETURNING last_alerted_at = v_now
  INTO v_should_alert;

  RETURN COALESCE(v_should_alert, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_expired_temporary_review_accounts(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_temporary_review_storage_objects(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_temporary_review_owned_records(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_temporary_review_account_deletion(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_temporary_review_deletion_failure(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_expired_temporary_review_accounts(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.list_temporary_review_storage_objects(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_temporary_review_owned_records(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_temporary_review_account_deletion(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_temporary_review_deletion_failure(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_set_trollmonds_balance(
  p_user_id uuid,
  p_trollmonds bigint,
  p_admin_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_trollmonds < 0 OR p_admin_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.user_profiles admin_profile
    WHERE admin_profile.id = p_admin_id
      AND (
        admin_profile.role IN ('admin', 'lead_troll_officer')
        OR admin_profile.is_admin IS TRUE
        OR admin_profile.is_lead_officer IS TRUE
      )
  ) THEN
    RAISE EXCEPTION 'Invalid balance or administrator' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_profiles
  SET trollmonds = p_trollmonds,
      updated_at = clock_timestamp()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile was not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_trollmonds_balance(uuid, bigint, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_trollmonds_balance(uuid, bigint, uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.invoke_expired_review_account_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault, net, pg_temp
AS $$
DECLARE
  v_project_url text;
  v_cleanup_secret text;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url';

  SELECT decrypted_secret INTO v_cleanup_secret
  FROM vault.decrypted_secrets
  WHERE name = 'temporary_review_cleanup_secret';

  IF NULLIF(v_project_url, '') IS NULL OR NULLIF(v_cleanup_secret, '') IS NULL THEN
    RAISE EXCEPTION 'Temporary review cleanup URL and secret must be configured in Vault';
  END IF;

  PERFORM net.http_post(
    url := rtrim(v_project_url, '/') || '/functions/v1/cleanup-expired-review-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cleanup_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_expired_review_account_cleanup() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'cleanup-expired-review-accounts';

  PERFORM cron.schedule(
    'cleanup-expired-review-accounts',
    '* * * * *',
    'SELECT public.invoke_expired_review_account_cleanup();'
  );
END;
$$;

-- Re-assert native_push_tokens RLS policies for authenticated users.
-- The original migration (20260907000008) defines INSERT/UPDATE/SELECT/DELETE
-- policies, but production may be missing or out of sync, causing the
-- registerNativePush upsert to fail with
-- "new row violates row-level security policy" on every phone app start.
--
-- This migration is idempotent: DROP POLICY IF EXISTS before CREATE so it can
-- be re-applied safely regardless of current production state.

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

-- INSERT: an authenticated user may only insert rows they own.
DROP POLICY IF EXISTS native_push_tokens_insert_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_insert_own
  ON public.native_push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: an authenticated user may only update their own rows.
DROP POLICY IF EXISTS native_push_tokens_update_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_update_own
  ON public.native_push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- SELECT: an authenticated user may only read their own rows.
DROP POLICY IF EXISTS native_push_tokens_select_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_select_own
  ON public.native_push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- DELETE: an authenticated user may only delete their own rows.
DROP POLICY IF EXISTS native_push_tokens_delete_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_delete_own
  ON public.native_push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
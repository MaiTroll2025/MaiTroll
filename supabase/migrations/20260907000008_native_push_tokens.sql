-- Store FCM/APNs tokens for installed Android and iOS builds.
CREATE TABLE IF NOT EXISTS public.native_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  user_agent text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

CREATE INDEX IF NOT EXISTS native_push_tokens_user_id_idx
  ON public.native_push_tokens (user_id)
  WHERE is_active = true;

ALTER TABLE public.native_push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS native_push_tokens_insert_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_insert_own
  ON public.native_push_tokens FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS native_push_tokens_update_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_update_own
  ON public.native_push_tokens FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS native_push_tokens_select_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_select_own
  ON public.native_push_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS native_push_tokens_delete_own ON public.native_push_tokens;
CREATE POLICY native_push_tokens_delete_own
  ON public.native_push_tokens FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
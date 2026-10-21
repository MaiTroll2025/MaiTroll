-- Add listener tracking to mai_voice_messages
ALTER TABLE public.mai_voice_messages
  ADD COLUMN IF NOT EXISTS listener_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.mai_voice_message_listens (
  message_id UUID NOT NULL REFERENCES public.mai_voice_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS mai_voice_message_listens_message_idx
  ON public.mai_voice_message_listens (message_id);
CREATE INDEX IF NOT EXISTS mai_voice_message_listens_user_idx
  ON public.mai_voice_message_listens (user_id);

-- Enable RLS
ALTER TABLE public.mai_voice_message_listens ENABLE ROW LEVEL SECURITY;

-- Users can see their own listen records
DROP POLICY IF EXISTS mai_voice_message_listens_select_own ON public.mai_voice_message_listens;
CREATE POLICY mai_voice_message_listens_select_own ON public.mai_voice_message_listens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Function to record a listen (server only via service role)
CREATE OR REPLACE FUNCTION public.mai_voice_record_listen(
  p_message_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS 
DECLARE
  v_inserted BOOLEAN;
BEGIN
  IF p_message_id IS NULL OR p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Missing parameters');
  END IF;

  INSERT INTO public.mai_voice_message_listens (message_id, user_id)
  VALUES (p_message_id, p_user_id)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted THEN
    UPDATE public.mai_voice_messages
    SET listener_count = COALESCE(listener_count, 0) + 1
    WHERE id = p_message_id
      AND (status IS DISTINCT FROM 'removed')
      AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_listener', v_inserted);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
;

GRANT EXECUTE ON FUNCTION public.mai_voice_record_listen(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.award_stream_gift_xp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receiver_id uuid := COALESCE(NEW.receiver_id, NEW.recipient_id);
  v_amount numeric := GREATEST(COALESCE(NEW.coins_amount, NEW.coins_spent, NEW.amount, 0), 0);
BEGIN
  IF NEW.sender_id IS NULL OR v_receiver_id IS NULL OR NEW.sender_id = v_receiver_id OR v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  BEGIN
    PERFORM public.grant_xp(
      NEW.sender_id,
      floor(v_amount * 1.1),
      'gift_sent',
      NEW.id::text,
      jsonb_build_object('receiver_id', v_receiver_id, 'stream_id', NEW.stream_id, 'stream_gift_id', NEW.id),
      'Live gift sent'
    );

    PERFORM public.grant_xp(
      v_receiver_id,
      floor(v_amount * 0.55),
      'gift_received',
      NEW.id::text,
      jsonb_build_object('sender_id', NEW.sender_id, 'stream_id', NEW.stream_id, 'stream_gift_id', NEW.id),
      'Live gift received'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'award_stream_gift_xp failed for stream_gift %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_award_stream_gift_xp ON public.stream_gifts;
CREATE TRIGGER trg_award_stream_gift_xp
AFTER INSERT ON public.stream_gifts
FOR EACH ROW
EXECUTE FUNCTION public.award_stream_gift_xp();

CREATE OR REPLACE FUNCTION public.update_stream_viewer_count(p_stream_id uuid, p_count integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.streams
  SET current_viewers = GREATEST(COALESCE(p_count, 0), 0),
      viewer_count = GREATEST(COALESCE(p_count, 0), 0)
  WHERE id = p_stream_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_stream_viewer_count(uuid, integer) TO anon, authenticated;

-- Launch hardening: schema compatibility for gift/replay/recording paths.
ALTER TABLE public.stream_gifts
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS recipient_id uuid,
  ADD COLUMN IF NOT EXISTS amount integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS coins_back integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency_used text,
  ADD COLUMN IF NOT EXISTS transaction_type text;

ALTER TABLE public.streams
  ADD COLUMN IF NOT EXISTS mux_asset_id text;

NOTIFY pgrst, 'reload schema';

-- Remove the recursive stream_mutes policies that can query stream_mutes while
-- authorizing stream_mutes. SECURITY DEFINER moderation RPCs remain the write path.
DROP POLICY IF EXISTS " Officers can manage stream_mutes" ON public.stream_mutes;
DROP POLICY IF EXISTS "Stream participants can read stream_mutes" ON public.stream_mutes;
DROP POLICY IF EXISTS "Hosts and Mods manage mutes" ON public.stream_mutes;
DROP POLICY IF EXISTS "Public read mutes" ON public.stream_mutes;

CREATE POLICY "stream_mutes_select_non_recursive" ON public.stream_mutes
FOR SELECT
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.streams s
    WHERE s.id = stream_mutes.stream_id
      AND s.user_id = auth.uid()
  )
  OR public.can_moderate_stream(stream_id, auth.uid())
);

CREATE POLICY "stream_mutes_write_via_moderation" ON public.stream_mutes
FOR ALL
USING (public.can_moderate_stream(stream_id, auth.uid()))
WITH CHECK (public.can_moderate_stream(stream_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.is_user_chat_blocked(
  p_user_id uuid,
  p_stream_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_blocks cb
    WHERE cb.user_id = p_user_id
      AND cb.expires_at > now()
      AND (p_stream_id IS NULL OR cb.stream_id = p_stream_id OR cb.stream_id IS NULL)
  )
  OR EXISTS (
    SELECT 1
    FROM public.stream_mutes sm
    WHERE sm.user_id = p_user_id
      AND (p_stream_id IS NULL OR sm.stream_id = p_stream_id)
      AND (sm.expires_at IS NULL OR sm.expires_at > now())
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_user_chat_blocked(uuid, uuid) TO authenticated;

-- Canonical family stats RPC signature. Drop the int overload that PostgREST can
-- confuse with bigint calls, then expose one bigint version.
DROP FUNCTION IF EXISTS public.increment_family_stats(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.increment_family_stats(
  p_family_id uuid,
  p_coin_bonus bigint,
  p_xp_bonus bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_coins bigint;
  v_new_xp bigint;
BEGIN
  UPDATE public.family_stats
  SET family_coins = COALESCE(family_coins, 0) + COALESCE(p_coin_bonus, 0),
      total_coins = COALESCE(total_coins, 0) + COALESCE(p_coin_bonus, 0),
      family_xp = COALESCE(family_xp, 0) + COALESCE(p_xp_bonus, 0),
      updated_at = now()
  WHERE family_id = p_family_id
  RETURNING family_coins, family_xp INTO v_new_coins, v_new_xp;

  IF NOT FOUND THEN
    INSERT INTO public.family_stats (family_id, family_coins, total_coins, family_xp)
    VALUES (p_family_id, COALESCE(p_coin_bonus, 0), COALESCE(p_coin_bonus, 0), COALESCE(p_xp_bonus, 0))
    RETURNING family_coins, family_xp INTO v_new_coins, v_new_xp;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_coins', v_new_coins, 'new_xp', v_new_xp);
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_family_stats(uuid, bigint, bigint) TO authenticated;

-- =============================================================================
-- MIGRATION: MAI Piks Story Tips (Troll Coins, 80 / 20 split)
-- Date: 2026-09-04
-- =============================================================================
-- Viewers can tip troll coins on any MAI Piks story.
--   * 80% goes to the story owner
--   * 20% is a platform fee, credited to the admin account and recorded in the
--     platform fee pool (see 20290904000001_platform_fee_pool.sql)
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Tips table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maipiks_story_tips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID REFERENCES public.maipiks_stories(id) ON DELETE SET NULL,
    story_item_id UUID REFERENCES public.maipiks_story_items(id) ON DELETE SET NULL,
    tipper_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    coins BIGINT NOT NULL CHECK (coins > 0),
    owner_coins BIGINT NOT NULL DEFAULT 0,
    platform_coins BIGINT NOT NULL DEFAULT 0,
    platform_fee_percent NUMERIC(6, 3) NOT NULL DEFAULT 20,
    fee_pool_id UUID REFERENCES public.platform_fee_pool(id) ON DELETE SET NULL,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maipiks_story_tips_story ON public.maipiks_story_tips(story_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_tips_item ON public.maipiks_story_tips(story_item_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_tips_owner ON public.maipiks_story_tips(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_tips_tipper ON public.maipiks_story_tips(tipper_user_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_tips_created ON public.maipiks_story_tips(created_at DESC);

COMMENT ON TABLE public.maipiks_story_tips IS
  'Troll coin tips sent on MAI Piks stories. 80% owner / 20% platform fee pool.';

ALTER TABLE public.maipiks_story_tips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "maipiks_story_tips_read_participants" ON public.maipiks_story_tips;
CREATE POLICY "maipiks_story_tips_read_participants" ON public.maipiks_story_tips
  FOR SELECT USING (auth.uid() = tipper_user_id OR auth.uid() = owner_user_id);

-- =============================================================================
-- PART 2: tip_maipiks_story
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tip_maipiks_story(
  p_story_id UUID,
  p_amount BIGINT,
  p_story_item_id UUID DEFAULT NULL,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipper UUID := auth.uid();
  v_owner UUID;
  v_story_id UUID := p_story_id;
  v_balance BIGINT;
  v_owner_coins BIGINT;
  v_platform_coins BIGINT;
  v_tip_id UUID;
  v_fee_id UUID;
  v_tipper_username TEXT;
  v_new_balance BIGINT;
BEGIN
  IF v_tipper IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'Tip amount must be at least 1 troll coin';
  END IF;

  IF p_amount > 1000000 THEN
    RAISE EXCEPTION 'Tip amount is too large';
  END IF;

  IF p_story_id IS NULL AND p_story_item_id IS NULL THEN
    RAISE EXCEPTION 'A story is required';
  END IF;

  -- Resolve the story owner (story id or story media id both work)
  IF v_story_id IS NOT NULL THEN
    SELECT user_id INTO v_owner FROM public.maipiks_stories WHERE id = v_story_id;
  END IF;

  IF v_owner IS NULL AND p_story_item_id IS NOT NULL THEN
    SELECT s.user_id, s.id
    INTO v_owner, v_story_id
    FROM public.maipiks_story_items i
    JOIN public.maipiks_stories s ON s.id = i.story_id
    WHERE i.id = p_story_item_id;
  END IF;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Story not found or no longer available';
  END IF;

  IF v_owner = v_tipper THEN
    RAISE EXCEPTION 'You cannot tip your own story';
  END IF;

  -- Lock the tipper's wallet row before spending
  SELECT COALESCE(troll_coins, 0), username
  INTO v_balance, v_tipper_username
  FROM public.user_profiles
  WHERE id = v_tipper
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'Not enough troll coins. Balance: %, needed: %', v_balance, p_amount;
  END IF;

  v_owner_coins := FLOOR(p_amount * 0.80);
  v_platform_coins := p_amount - v_owner_coins;

  -- Deduct from the tipper
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) - p_amount,
      total_spent_coins = COALESCE(total_spent_coins, 0) + p_amount
  WHERE id = v_tipper
  RETURNING troll_coins INTO v_new_balance;

  -- Credit the story owner (80%)
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_owner_coins,
      total_earned_coins = COALESCE(total_earned_coins, 0) + v_owner_coins
  WHERE id = v_owner;

  INSERT INTO public.maipiks_story_tips (
    story_id, story_item_id, tipper_user_id, owner_user_id,
    coins, owner_coins, platform_coins, platform_fee_percent, message
  ) VALUES (
    v_story_id, p_story_item_id, v_tipper, v_owner,
    p_amount, v_owner_coins, v_platform_coins, 20, NULLIF(btrim(COALESCE(p_message, '')), '')
  )
  RETURNING id INTO v_tip_id;

  -- 20% platform fee -> admin account + fee pool
  v_fee_id := public.record_platform_fee(
    p_fee_type       => 'maipiks_story_tip',
    p_coins          => v_platform_coins,
    p_gross_coins    => p_amount,
    p_idempotency_key=> 'maipiks_story_tip:' || v_tip_id::text,
    p_fee_percent    => 20,
    p_payer_user_id  => v_tipper,
    p_earner_user_id => v_owner,
    p_reference_table=> 'maipiks_story_tips',
    p_reference_id   => v_tip_id,
    p_fee_label      => 'MAI Piks Story Tip',
    p_metadata       => jsonb_build_object('story_id', v_story_id, 'story_item_id', p_story_item_id)
  );

  UPDATE public.maipiks_story_tips SET fee_pool_id = v_fee_id WHERE id = v_tip_id;

  -- Running totals for the UI
  UPDATE public.maipiks_stories
  SET tips_received_coins = COALESCE(tips_received_coins, 0) + v_owner_coins,
      updated_at = NOW()
  WHERE id = v_story_id;

  IF p_story_item_id IS NOT NULL THEN
    UPDATE public.maipiks_story_items
    SET tips_received_coins = COALESCE(tips_received_coins, 0) + v_owner_coins
    WHERE id = p_story_item_id;
  END IF;

  -- Coin ledger entries
  BEGIN
    INSERT INTO public.coin_transactions (user_id, type, amount, description, metadata, created_at)
    VALUES
      (v_tipper, 'spend', p_amount,
       'MAI Piks story tip sent',
       jsonb_build_object('tip_id', v_tip_id, 'story_id', v_story_id, 'owner_user_id', v_owner,
                          'owner_coins', v_owner_coins, 'platform_coins', v_platform_coins), NOW()),
      (v_owner, 'earn', v_owner_coins,
       'MAI Piks story tip received',
       jsonb_build_object('tip_id', v_tip_id, 'story_id', v_story_id, 'tipper_user_id', v_tipper,
                          'gross_coins', p_amount, 'platform_coins', v_platform_coins), NOW());
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Notify the story owner
  BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, metadata, read, created_at)
    VALUES (
      v_owner,
      'maipiks_story_tip',
      'Story Tip Received',
      '@' || COALESCE(v_tipper_username, 'someone') || ' tipped ' || v_owner_coins || ' troll coins on your MAI Piks story.',
      jsonb_build_object('actor_id', v_tipper, 'actor_username', v_tipper_username,
                         'tip_id', v_tip_id, 'story_id', v_story_id,
                         'coins', v_owner_coins, 'gross_coins', p_amount),
      FALSE,
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', TRUE,
    'tip_id', v_tip_id,
    'coins', p_amount,
    'owner_coins', v_owner_coins,
    'platform_coins', v_platform_coins,
    'platform_fee_percent', 20,
    'new_balance', COALESCE(v_new_balance, v_balance - p_amount)
  );
END;
$$;

COMMENT ON FUNCTION public.tip_maipiks_story(UUID, BIGINT, UUID, TEXT) IS
  'Tip troll coins on a MAI Piks story. 80% to the owner, 20% platform fee to the fee pool.';

GRANT EXECUTE ON FUNCTION public.tip_maipiks_story(UUID, BIGINT, UUID, TEXT) TO authenticated, service_role;

-- =============================================================================
-- PART 3: Story tip totals for the viewer UI
-- =============================================================================

CREATE OR REPLACE FUNCTION public.maipiks_get_story_tip_total(p_story_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(owner_coins), 0)::BIGINT
  FROM public.maipiks_story_tips
  WHERE story_id = p_story_id;
$$;

GRANT EXECUTE ON FUNCTION public.maipiks_get_story_tip_total(UUID) TO authenticated, service_role;

COMMIT;

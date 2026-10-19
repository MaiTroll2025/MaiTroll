-- =============================================================================
-- MIGRATION: Battle Pot System - Permanent Random Battle Unlock + Battle Economy
-- Date: 2026-10-19
-- =============================================================================
-- Creates the Battle Pot system that gates Mai Troll's existing random battle
-- feature behind viewer-contributed coin targets.
--
-- Design:
--   * broadcaster_battle_unlocks: permanent entitlement per broadcaster
--   * battle_pot_rounds: each contribution target (initial unlock or battle round)
--   * battle_pot_contributions: individual viewer contributions
--   * contribute_to_battle_pot(): atomic RPC for contributions with 50/50 split
--
-- Revenue split: 50% broadcaster, 50% Mai Troll admin pool (via record_platform_fee)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- PART 1: Permanent battle unlock entitlement on user_profiles
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS battle_unlocked BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS battle_unlocked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_user_profiles_battle_unlocked
  ON public.user_profiles(battle_unlocked) WHERE battle_unlocked = TRUE;

-- ---------------------------------------------------------------------------
-- PART 2: broadcaster_battle_unlocks table (auditable entitlement record)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcaster_battle_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initial_target_coins INTEGER NOT NULL DEFAULT 2000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcaster_battle_unlocks_user_id
  ON public.broadcaster_battle_unlocks(user_id);

-- ---------------------------------------------------------------------------
-- PART 3: battle_pot_rounds table - each contribution target round
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.battle_pot_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcaster_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  round_type TEXT NOT NULL CHECK (round_type IN ('initial_unlock', 'subsequent_battle')),
  target_coins INTEGER NOT NULL CHECK (target_coins > 0),
  collected_coins INTEGER NOT NULL DEFAULT 0 CHECK (collected_coins >= 0),
  status TEXT NOT NULL CHECK (status IN ('open', 'reached', 'battle_started', 'failed', 'closed'))
    DEFAULT 'open',
  battle_id UUID REFERENCES public.battles(id) ON DELETE SET NULL,
  idempotency_key TEXT UNIQUE,
  reached_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_pot_rounds_broadcaster_id
  ON public.battle_pot_rounds(broadcaster_id);
CREATE INDEX IF NOT EXISTS idx_battle_pot_rounds_stream_id
  ON public.battle_pot_rounds(stream_id);
CREATE INDEX IF NOT EXISTS idx_battle_pot_rounds_status
  ON public.battle_pot_rounds(status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_battle_pot_rounds_type
  ON public.battle_pot_rounds(round_type);

-- ---------------------------------------------------------------------------
-- PART 4: battle_pot_contributions table - individual viewer contributions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.battle_pot_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.battle_pot_rounds(id) ON DELETE CASCADE,
  contributor_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  broadcaster_share INTEGER NOT NULL,
  admin_share INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_battle_pot_contributions_round_id
  ON public.battle_pot_contributions(round_id);
CREATE INDEX IF NOT EXISTS idx_battle_pot_contributions_contributor_id
  ON public.battle_pot_contributions(contributor_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_battle_pot_contributions_idempotency
  ON public.battle_pot_contributions(idempotency_key);

-- ---------------------------------------------------------------------------
-- PART 5: RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE public.broadcaster_battle_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_pot_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.battle_pot_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "battle_unlocks_public_read" ON public.broadcaster_battle_unlocks;
CREATE POLICY "battle_unlocks_public_read" ON public.broadcaster_battle_unlocks
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "battle_unlocks_broadcaster_write" ON public.broadcaster_battle_unlocks;
CREATE POLICY "battle_unlocks_broadcaster_write" ON public.broadcaster_battle_unlocks
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "battle_rounds_public_read" ON public.battle_pot_rounds;
CREATE POLICY "battle_rounds_public_read" ON public.battle_pot_rounds
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "battle_rounds_broadcaster_write" ON public.battle_pot_rounds;
CREATE POLICY "battle_rounds_broadcaster_write" ON public.battle_pot_rounds
  FOR ALL USING (auth.uid() = broadcaster_id);

DROP POLICY IF EXISTS "battle_contributions_public_read" ON public.battle_pot_contributions;
CREATE POLICY "battle_contributions_public_read" ON public.battle_pot_contributions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "battle_contributions_insert" ON public.battle_pot_contributions;
CREATE POLICY "battle_contributions_insert" ON public.battle_pot_contributions
  FOR INSERT WITH CHECK (auth.uid() = contributor_id);

-- ---------------------------------------------------------------------------
-- PART 6: contribute_to_battle_pot RPC - atomic contribution with 50/50 split
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.contribute_to_battle_pot(
  p_round_id UUID,
  p_amount BIGINT,
  p_idempotency_key TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_round RECORD;
  v_remaining INTEGER;
  v_accepted BIGINT;
  v_broadcaster_share BIGINT;
  v_admin_share BIGINT;
  v_contributor_balance BIGINT;
  v_already_contributed BOOLEAN := FALSE;
  v_contribution_id UUID;
BEGIN
  -- 1. Authentication
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- 2. Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Idempotency key required');
  END IF;

  -- 3. Lock the round row to prevent concurrent modifications
  SELECT *
    INTO v_round
  FROM public.battle_pot_rounds
  WHERE id = p_round_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round not found');
  END IF;

  -- 4. Round must be open
  IF v_round.status <> 'open' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round is not open');
  END IF;

  -- 5. Idempotency: reject duplicate contribution requests
  SELECT EXISTS (
    SELECT 1 FROM public.battle_pot_contributions
    WHERE idempotency_key = p_idempotency_key
  ) INTO v_already_contributed;

  IF v_already_contributed THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Duplicate contribution detected',
      'duplicate', true,
      'collected', v_round.collected_coins,
      'target', v_round.target_coins,
      'status', v_round.status
    );
  END IF;

  -- 6. Verify contributor balance
  SELECT COALESCE(troll_coins, 0)::BIGINT
    INTO v_contributor_balance
  FROM public.user_profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_contributor_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins');
  END IF;

  -- 7. Calculate accepted amount (cap at remaining target)
  v_remaining := v_round.target_coins - v_round.collected_coins;
  IF p_amount > v_remaining THEN
    v_accepted := v_remaining;
  ELSE
    v_accepted := p_amount;
  END IF;

  IF v_accepted <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Round already complete');
  END IF;

  -- 8. Compute 50/50 split (integer-safe)
  v_broadcaster_share := v_accepted / 2;
  v_admin_share := v_accepted - v_broadcaster_share;

  -- 9. Deduct from contributor
  UPDATE public.user_profiles
  SET troll_coins = troll_coins - v_accepted
  WHERE id = v_user_id
    AND troll_coins >= v_accepted;

  -- 10. Credit broadcaster 50%
  UPDATE public.user_profiles
  SET troll_coins = COALESCE(troll_coins, 0) + v_broadcaster_share
  WHERE id = v_round.broadcaster_id;

  -- 11. Credit admin pool 50% via record_platform_fee
  PERFORM public.record_platform_fee(
    p_fee_type := 'battle_pot',
    p_coins := v_admin_share,
    p_gross_coins := v_accepted,
    p_fee_percent := 50,
    p_payer_user_id := v_user_id,
    p_earner_user_id := v_round.broadcaster_id,
    p_reference_table := 'battle_pot_rounds',
    p_reference_id := p_round_id,
    p_fee_label := 'Battle Pot ' || v_round.round_type || ' platform fee',
    p_metadata := jsonb_build_object(
      'round_id', p_round_id,
      'round_type', v_round.round_type,
      'contributor_id', v_user_id,
      'broadcaster_id', v_round.broadcaster_id,
      'broadcaster_share', v_broadcaster_share,
      'accepted_amount', v_accepted
    ),
    p_credit_admin := TRUE,
    p_idempotency_key := 'battle_pot_fee_' || p_idempotency_key
  );

  -- 12. Record the contribution
  INSERT INTO public.battle_pot_contributions (
    round_id, contributor_id, amount, broadcaster_share, admin_share, idempotency_key
  ) VALUES (
    p_round_id, v_user_id, v_accepted, v_broadcaster_share, v_admin_share, p_idempotency_key
  )
  RETURNING id INTO v_contribution_id;

  -- 13. Update round collected coins
  UPDATE public.battle_pot_rounds
  SET collected_coins = collected_coins + v_accepted,
      updated_at = NOW()
  WHERE id = p_round_id;

  -- 14. Check if target reached
  IF (v_round.collected_coins + v_accepted) >= v_round.target_coins THEN
    UPDATE public.battle_pot_rounds
    SET status = 'reached',
        reached_at = NOW(),
        updated_at = NOW()
    WHERE id = p_round_id;

    -- If this is the initial unlock round, grant permanent entitlement
    IF v_round.round_type = 'initial_unlock' THEN
      UPDATE public.user_profiles
      SET battle_unlocked = TRUE,
          battle_unlocked_at = NOW()
      WHERE id = v_round.broadcaster_id;

      INSERT INTO public.broadcaster_battle_unlocks (user_id, unlocked_at, initial_target_coins)
      VALUES (v_round.broadcaster_id, NOW(), v_round.target_coins)
      ON CONFLICT (user_id) DO NOTHING;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Contribution accepted',
    'accepted', v_accepted,
    'requested', p_amount,
    'broadcaster_share', v_broadcaster_share,
    'admin_share', v_admin_share,
    'collected', v_round.collected_coins + v_accepted,
    'target', v_round.target_coins,
    'remaining', GREATEST(0, v_round.target_coins - (v_round.collected_coins + v_accepted)),
    'status', CASE WHEN (v_round.collected_coins + v_accepted) >= v_round.target_coins THEN 'reached' ELSE 'open' END,
    'round_id', p_round_id,
    'contribution_id', v_contribution_id,
    'duplicate', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.contribute_to_battle_pot(UUID, BIGINT, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- PART 7: create_next_battle_round RPC - opens a new 100-coin round after a battle
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_next_battle_round(
  p_broadcaster_id UUID,
  p_stream_id UUID DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round_id UUID;
  v_existing_open BOOLEAN := FALSE;
BEGIN
  -- Only the broadcaster can call this
  IF auth.uid() IS DISTINCT FROM p_broadcaster_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Verify broadcaster has permanent unlock
  SELECT battle_unlocked INTO v_existing_open
  FROM public.user_profiles
  WHERE id = p_broadcaster_id;

  IF NOT v_existing_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'Broadcaster has not unlocked battles');
  END IF;

  -- Check for an existing open round for this broadcaster
  SELECT EXISTS (
    SELECT 1 FROM public.battle_pot_rounds
    WHERE broadcaster_id = p_broadcaster_id
      AND round_type = 'subsequent_battle'
      AND status = 'open'
  ) INTO v_existing_open;

  IF v_existing_open THEN
    RETURN jsonb_build_object('success', false, 'error', 'Open round already exists');
  END IF;

  -- Create new 100-coin round
  INSERT INTO public.battle_pot_rounds (
    broadcaster_id, stream_id, round_type, target_coins, collected_coins, status,
    idempotency_key
  ) VALUES (
    p_broadcaster_id, p_stream_id, 'subsequent_battle', 100, 0, 'open',
    gen_random_uuid()::text
  )
  RETURNING id INTO v_round_id;

  RETURN jsonb_build_object(
    'success', true,
    'round_id', v_round_id,
    'target_coins', 100,
    'collected_coins', 0,
    'remaining', 100,
    'status', 'open'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_next_battle_round(UUID, UUID)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- PART 8: get_battle_pot_state RPC - fetch current round state for a broadcaster
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_battle_pot_state(
  p_broadcaster_id UUID
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlocked BOOLEAN := FALSE;
  v_round RECORD;
  v_collected INTEGER := 0;
  v_target INTEGER := 0;
  v_status TEXT := 'locked';
  v_round_type TEXT;
  v_round_id UUID;
BEGIN
  -- Check permanent unlock
  SELECT battle_unlocked INTO v_unlocked
  FROM public.user_profiles
  WHERE id = p_broadcaster_id;

  IF NOT v_unlocked THEN
    -- Find or create initial unlock round
    SELECT id, target_coins, collected_coins, status, round_type
      INTO v_round_id, v_target, v_collected, v_status, v_round_type
    FROM public.battle_pot_rounds
    WHERE broadcaster_id = p_broadcaster_id
      AND round_type = 'initial_unlock'
      AND status IN ('open', 'reached')
    ORDER BY created_at DESC
    LIMIT 1;

    IF NOT FOUND THEN
      -- Create initial unlock round
      INSERT INTO public.battle_pot_rounds (
        broadcaster_id, round_type, target_coins, collected_coins, status, idempotency_key
      ) VALUES (
        p_broadcaster_id, 'initial_unlock', 2000, 0, 'open', gen_random_uuid()::text
      )
      RETURNING id, target_coins, collected_coins, status, round_type
      INTO v_round_id, v_target, v_collected, v_status, v_round_type;
    END IF;

    RETURN jsonb_build_object(
      'unlocked', false,
      'round_id', v_round_id,
      'round_type', v_round_type,
      'target_coins', v_target,
      'collected_coins', v_collected,
      'remaining', GREATEST(0, v_target - v_collected),
      'status', v_status
    );
  END IF;

  -- Unlocked: find current subsequent battle round
  SELECT id, target_coins, collected_coins, status, round_type
    INTO v_round_id, v_target, v_collected, v_status, v_round_type
  FROM public.battle_pot_rounds
  WHERE broadcaster_id = p_broadcaster_id
    AND round_type = 'subsequent_battle'
    AND status = 'open'
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'unlocked', true,
      'round_id', null,
      'round_type', null,
      'target_coins', 100,
      'collected_coins', 0,
      'remaining', 100,
      'status', 'no_open_round'
    );
  END IF;

  RETURN jsonb_build_object(
    'unlocked', true,
    'round_id', v_round_id,
    'round_type', v_round_type,
    'target_coins', v_target,
    'collected_coins', v_collected,
    'remaining', GREATEST(0, v_target - v_collected),
    'status', v_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_battle_pot_state(UUID)
  TO authenticated;

COMMENT ON TABLE public.broadcaster_battle_unlocks IS
  'Permanent random battle unlock entitlement per broadcaster. One row per broadcaster.';
COMMENT ON TABLE public.battle_pot_rounds IS
  'Each Battle Pot contribution target round. initial_unlock (2000 coins, one-time) or subsequent_battle (100 coins, per battle).';
COMMENT ON TABLE public.battle_pot_contributions IS
  'Individual viewer contributions to Battle Pot rounds, with 50/50 broadcaster/admin split recorded.';
COMMENT ON FUNCTION public.contribute_to_battle_pot(UUID, BIGINT, TEXT) IS
  'Atomically contributes coins to a Battle Pot round, splits 50/50 between broadcaster and admin pool, and updates round progress.';
COMMENT ON FUNCTION public.get_battle_pot_state(UUID) IS
  'Returns the current Battle Pot state for a broadcaster: unlock status, active round, collected/target coins.';

COMMIT;

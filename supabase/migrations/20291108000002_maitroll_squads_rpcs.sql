-- ============================================================================
-- Migration: MaiTroll Squads — Financial RPCs (security definer)
-- Date: 2026-11-08
-- Purpose: Atomic, idempotent squad creation, joining, leaving, kicking,
-- Squad Cash accrual, weekly settlement, and privacy-aware balance reads.
--
-- Authorization: every RPC checks auth.uid() and enforces that an earning
-- belongs to exactly one cashout path (Bank OR Squad Cash, never both).
-- ============================================================================

-- ─── Helper: read a scalar config value from squad_config ─────────────────
CREATE OR REPLACE FUNCTION public.squad_config_value(p_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v JSONB;
BEGIN
  SELECT value INTO v FROM public.squad_config WHERE key = p_key;
  IF v IS NULL THEN
    RETURN '{}'::JSONB;
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.squad_config_value(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.squad_config_value(TEXT) TO authenticated, service_role;

-- ─── Create a Squad ────────────────────────────────────────────────────────
-- Costs 3,000 Troll Coins. Atomically deducts the fee and creates the squad
-- plus the creator's leader membership. No charge if creation fails.
CREATE OR REPLACE FUNCTION public.create_squad(
  p_name TEXT,
  p_tag TEXT,
  p_description TEXT DEFAULT NULL,
  p_rules TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_cover_url TEXT DEFAULT NULL,
  p_block_name TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_fee BIGINT := 3000;
  v_balance BIGINT;
  v_squad_id UUID;
  v_existing BOOLEAN;
  v_leader_squad UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Configurable creation fee (default 3,000 TC)
  SELECT COALESCE((squad_config_value('creation_fee_coins')->>'coins')::BIGINT, 3000) INTO v_fee;

  -- Authenticated account eligibility: not already leading an active squad
  SELECT s.id INTO v_leader_squad
  FROM public.squads s
  JOIN public.squad_memberships sm ON sm.squad_id = s.id AND sm.user_id = v_user_id AND sm.role = 'leader' AND sm.left_at IS NULL
  WHERE s.status = 'active'
  LIMIT 1;

  IF v_leader_squad IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already lead an active Squad');
  END IF;

  -- Sufficient spendable coins
  SELECT COALESCE(Troll_coins, 0)::BIGINT INTO v_balance
  FROM public.user_profiles WHERE id = v_user_id;

  IF v_balance < v_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough Troll Coins', 'required', v_fee, 'available', v_balance);
  END IF;

  -- Slug / tag uniqueness
  IF EXISTS (SELECT 1 FROM public.squads WHERE tag = p_tag) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Squad tag already taken');
  END IF;

  -- Deduct creation fee atomically
  UPDATE public.user_profiles
  SET Troll_coins = GREATEST(0, COALESCE(Troll_coins, 0) - v_fee),
      total_spent_coins = COALESCE(total_spent_coins, 0) + v_fee,
      updated_at = NOW()
  WHERE id = v_user_id AND COALESCE(Troll_coins, 0) >= v_fee;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins (concurrent update)');
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata, created_at)
  VALUES (
    v_user_id, -v_fee, 'squad_creation',
    'Squad creation fee',
    jsonb_build_object('squad_name', p_name, 'squad_tag', p_tag, 'fee_coins', v_fee, 'source', 'squad_creation'),
    NOW()
  );

  -- Create squad
  INSERT INTO public.squads (slug, name, tag, description, rules, logo_url, cover_url, block_name, leader_id, status, created_at, updated_at)
  VALUES (
    lower(regexp_replace(p_name, '\s+', '-', 'g')) || '-' || substr(gen_random_uuid()::TEXT, 1, 8),
    p_name, p_tag, p_description, p_rules, p_logo_url, p_cover_url, p_block_name, v_user_id, 'active', NOW(), NOW()
  )
  RETURNING id INTO v_squad_id;

  -- Creator becomes the leader (membership fee not charged to the leader)
  INSERT INTO public.squad_memberships (squad_id, user_id, role, joined_at, join_fee_paid)
  VALUES (v_squad_id, v_user_id, 'leader', NOW(), TRUE);

  RETURN jsonb_build_object(
    'success', true,
    'squad_id', v_squad_id,
    'fee_coins', v_fee,
    'message', 'Squad created'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.create_squad(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_squad(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;

-- ─── Join a Squad ──────────────────────────────────────────────────────────
-- Costs 100 Troll Coins: 50 TC to the Squad Leader, 50 TC to the admin pool.
-- Idempotent: re-joining an active membership you already paid for is free.
CREATE OR REPLACE FUNCTION public.join_squad(p_squad_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_fee BIGINT := 100;
  v_balance BIGINT;
  v_leader_id UUID;
  v_membership_id UUID;
  v_fee_paid BOOLEAN;
  v_squad_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT COALESCE((squad_config_value('join_fee_coins')->>'coins')::BIGINT, 100) INTO v_fee;

  SELECT s.status, s.leader_id INTO v_squad_status, v_leader_id
  FROM public.squads s WHERE s.id = p_squad_id;

  IF v_squad_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Squad not found');
  END IF;
  IF v_squad_status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Squad is not active');
  END IF;

  -- User cannot belong to more than one active Squad
  IF EXISTS (
    SELECT 1 FROM public.squad_memberships sm
    WHERE sm.user_id = v_user_id AND sm.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already belong to an active Squad');
  END IF;

  -- Idempotent: already a paid member of this squad
  SELECT id, join_fee_paid INTO v_membership_id, v_fee_paid
  FROM public.squad_memberships
  WHERE squad_id = p_squad_id AND user_id = v_user_id
  LIMIT 1;

  IF v_membership_id IS NOT NULL THEN
    IF v_fee_paid THEN
      UPDATE public.squad_memberships SET left_at = NULL WHERE id = v_membership_id;
      RETURN jsonb_build_object('success', true, 'squad_id', p_squad_id, 'fee_coins', 0, 'message', 'Rejoined Squad (no charge)');
    END IF;
    -- Unpaid membership: require payment below
  END IF;

  -- Sufficient coins
  SELECT COALESCE(Troll_coins, 0)::BIGINT INTO v_balance
  FROM public.user_profiles WHERE id = v_user_id;

  IF v_balance < v_fee THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough Troll Coins', 'required', v_fee, 'available', v_balance);
  END IF;

  -- Deduct joining fee
  UPDATE public.user_profiles
  SET Troll_coins = GREATEST(0, COALESCE(Troll_coins, 0) - v_fee),
      total_spent_coins = COALESCE(total_spent_coins, 0) + v_fee,
      updated_at = NOW()
  WHERE id = v_user_id AND COALESCE(Troll_coins, 0) >= v_fee;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient coins (concurrent update)');
  END IF;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata, created_at)
  VALUES (
    v_user_id, -v_fee, 'squad_join_fee',
    'Squad joining fee',
    jsonb_build_object('squad_id', p_squad_id, 'fee_coins', v_fee, 'source', 'squad_join'),
    NOW()
  );

  -- 50% to Squad Leader
  UPDATE public.user_profiles
  SET Troll_coins = COALESCE(Troll_coins, 0) + (v_fee / 2),
      updated_at = NOW()
  WHERE id = v_leader_id;

  INSERT INTO public.coin_transactions (user_id, amount, type, description, metadata, created_at)
  VALUES (
    v_leader_id, v_fee / 2, 'squad_join_share',
    'Squad member join share',
    jsonb_build_object('squad_id', p_squad_id, 'member_id', v_user_id, 'share_coins', v_fee / 2, 'source', 'squad_join_leader_share'),
    NOW()
  );

  -- 50% to MaiTroll administrative pool
  UPDATE public.admin_pool
  SET trollcoins_balance = COALESCE(trollcoins_balance, 0) + (v_fee / 2), updated_at = NOW()
  WHERE id = (SELECT id FROM public.admin_pool ORDER BY created_at DESC LIMIT 1);

  INSERT INTO public.admin_pool_transactions (pool_id, amount_cents, type, description, created_at)
  SELECT ap.id, v_fee / 2, 'squad_join_share',
         format('Squad join platform share for squad %s', p_squad_id::TEXT), NOW()
  FROM public.admin_pool ap ORDER BY ap.created_at DESC LIMIT 1;

  -- Upsert membership
  IF v_membership_id IS NOT NULL THEN
    UPDATE public.squad_memberships
    SET role = 'member', joined_at = NOW(), left_at = NULL, join_fee_paid = TRUE, kick_until = NULL, city_jail_until = NULL
    WHERE id = v_membership_id;
  ELSE
    INSERT INTO public.squad_memberships (squad_id, user_id, role, joined_at, join_fee_paid)
    VALUES (p_squad_id, v_user_id, 'member', NOW(), TRUE);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'squad_id', p_squad_id,
    'fee_coins', v_fee,
    'leader_share_coins', v_fee / 2,
    'platform_share_coins', v_fee / 2,
    'message', 'Joined Squad'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.join_squad(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_squad(UUID) TO authenticated;

-- ─── Leave a Squad ─────────────────────────────────────────────────────────
-- Preserves Squad Cash and the original weekly settlement assignment. No
-- early unlock of Squad Cash.
CREATE OR REPLACE FUNCTION public.leave_squad(p_squad_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_membership_id UUID;
  v_is_leader BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT sm.id, sm.role = 'leader' INTO v_membership_id, v_is_leader
  FROM public.squad_memberships sm
  WHERE sm.squad_id = p_squad_id AND sm.user_id = v_user_id AND sm.left_at IS NULL;

  IF v_membership_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not an active member of this Squad');
  END IF;

  IF v_is_leader THEN
    -- Leaders must disband rather than leave; prevent orphaned squads
    RETURN jsonb_build_object('success', false, 'error', 'Leaders must disband the Squad instead of leaving');
  END IF;

  UPDATE public.squad_memberships
  SET left_at = NOW(), kick_until = NULL, city_jail_until = NULL
  WHERE id = v_membership_id;

  -- Squad Cash remains locked under its original weekly settlement; nothing
  -- is converted to daily Bank here.
  RETURN jsonb_build_object('success', true, 'squad_id', p_squad_id, 'message', 'Left Squad');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_squad(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_squad(UUID) TO authenticated;

-- ─── Kick a Squad Member ───────────────────────────────────────────────────
-- Requires a reason, applies 15-minute server-side City Jail, blocks joining
-- another Squad until the restriction expires. Squad Cash is preserved.
CREATE OR REPLACE FUNCTION public.kick_squad_member(
  p_squad_id UUID,
  p_target_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_target_membership_id UUID;
  v_jail_until TIMESTAMPTZ := NOW() + INTERVAL '15 minutes';
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_reason IS NULL OR trim(p_reason) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A removal reason is required');
  END IF;

  -- Only the Squad leader or an authorized admin may kick
  SELECT sm.role INTO v_actor_role
  FROM public.squad_memberships sm
  WHERE sm.squad_id = p_squad_id AND sm.user_id = v_actor_id AND sm.left_at IS NULL;

  IF v_actor_role <> 'leader' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = v_actor_id AND (up.is_admin OR up.role = 'admin' OR up.role = 'superadmin' OR up.role = 'ceo')
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Only the Squad leader can kick members');
    END IF;
  END IF;

  -- Cannot kick the leader
  IF EXISTS (
    SELECT 1 FROM public.squad_memberships sm
    WHERE sm.squad_id = p_squad_id AND sm.user_id = p_target_user_id AND sm.role = 'leader' AND sm.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot kick the Squad leader');
  END IF;

  SELECT sm.id INTO v_target_membership_id
  FROM public.squad_memberships sm
  WHERE sm.squad_id = p_squad_id AND sm.user_id = p_target_user_id AND sm.left_at IS NULL;

  IF v_target_membership_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target is not an active member of this Squad');
  END IF;

  UPDATE public.squad_memberships
  SET left_at = NOW(), kick_until = v_jail_until, city_jail_until = v_jail_until
  WHERE id = v_target_membership_id;

  -- Record moderation event
  INSERT INTO public.broadcast_mod_actions (
    actor_id, actor_role, target_user_id, action_type, reason, severity,
    created_at
  ) VALUES (
    v_actor_id, COALESCE(v_actor_role, 'leader'), p_target_user_id,
    'kick', p_reason, 'moderate', NOW()
  );

  -- Squad Cash is preserved and stays on the original weekly settlement.
  RETURN jsonb_build_object('success', true, 'squad_id', p_squad_id, 'message', 'Member kicked');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.kick_squad_member(UUID,UUID,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kick_squad_member(UUID,UUID,TEXT) TO authenticated;

-- ─── Accrue Squad Earnings ─────────────────────────────────────────────────
-- Credits Squad Cash for a verified Squad-earning activity. Idempotent via
-- source_transaction_id. An earning allocated here is Squad Cash only and
-- can never simultaneously become available in daily Bank.
CREATE OR REPLACE FUNCTION public.accrue_squad_earnings(
  p_user_id UUID,
  p_squad_id UUID,
  p_amount_cents BIGINT,
  p_source_type TEXT,
  p_source_transaction_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_exists BOOLEAN;
  v_member_role TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  IF p_amount_cents IS NULL OR p_amount_cents <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid earning amount');
  END IF;

  IF p_source_type IS NULL OR trim(p_source_type) = '' THEN
    p_source_type := 'broadcast';
  END IF;

  IF p_source_transaction_id IS NULL OR trim(p_source_transaction_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'source_transaction_id is required');
  END IF;

  -- Only the earning owner, their Squad leader, or service role may accrue
  IF v_actor_id <> p_user_id THEN
    SELECT sm.role INTO v_member_role
    FROM public.squad_memberships sm
    WHERE sm.squad_id = p_squad_id AND sm.user_id = v_actor_id AND sm.left_at IS NULL;

    IF v_member_role <> 'leader' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Not authorized to accrue earnings for this user');
    END IF;
  END IF;

  -- Verify target user is an active member of the squad
  IF NOT EXISTS (
    SELECT 1 FROM public.squad_memberships sm
    WHERE sm.squad_id = p_squad_id AND sm.user_id = p_user_id AND sm.left_at IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not an active member of this Squad');
  END IF;

  -- Idempotency: same source transaction already credited
  SELECT EXISTS (SELECT 1 FROM public.squad_cash_ledger WHERE source_transaction_id = p_source_transaction_id) INTO v_exists;
  IF v_exists THEN
    RETURN jsonb_build_object('success', true, 'already_credited', true, 'message', 'Earning already recorded');
  END IF;

  INSERT INTO public.squad_cash_ledger (
    user_id, squad_id, amount_cents, type, source_transaction_id, settlement_period_id, status, created_at
  ) VALUES (
    p_user_id, p_squad_id, p_amount_cents, 'earning', p_source_transaction_id,
    NULL, 'pending', NOW()
  );

  RETURN jsonb_build_object('success', true, 'amount_cents', p_amount_cents, 'message', 'Squad Cash accrued');
EXCEPTION WHEN unique_violation THEN
  RETURN jsonb_build_object('success', true, 'already_credited', true, 'message', 'Earning already recorded (race)');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.accrue_squad_earnings(UUID,UUID,BIGINT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accrue_squad_earnings(UUID,UUID,BIGINT,TEXT,TEXT) TO authenticated, service_role;

-- ─── Get Squad Cash Balance (privacy-aware) ────────────────────────────────
-- Returns the user's Squad Cash balance only to authorized viewers:
--   - the account owner (always)
--   - same-Squad members when the owner enables show_squad_cash_to_squad_members
--   - authorized platform administrators
-- Returns hidden (null amount) otherwise. Never reveals hidden amounts.
CREATE OR REPLACE FUNCTION public.get_squad_cash_balance(p_target_user_id UUID, p_viewer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_total BIGINT := 0;
  v_visible BOOLEAN := FALSE;
  v_privacy_show BOOLEAN := FALSE;
  v_same_squad BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_viewer_id IS NULL THEN
    RETURN jsonb_build_object('visible', false, 'amount_cents', 0, 'usd', 0.00, 'reason', 'authentication required');
  END IF;

  -- Owner always sees their own balance
  IF p_viewer_id = p_target_user_id THEN
    v_visible := TRUE;
  ELSE
    -- Authorized administrators
    SELECT EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = p_viewer_id AND (up.is_admin OR up.role = 'admin' OR up.role = 'superadmin' OR up.role = 'ceo')
    ) INTO v_is_admin;

    IF v_is_admin THEN
      v_visible := TRUE;
    ELSE
      -- Same-Squad member with owner's permission
      SELECT EXISTS (
        SELECT 1 FROM public.squad_memberships a
        JOIN public.squad_memberships b ON b.squad_id = a.squad_id AND b.user_id = p_target_user_id AND b.left_at IS NULL
        WHERE a.user_id = p_viewer_id AND a.left_at IS NULL
      ) INTO v_same_squad;

      IF v_same_squad THEN
        SELECT COALESCE(show_squad_cash_to_squad_members, FALSE) INTO v_privacy_show
        FROM public.user_financial_privacy WHERE user_id = p_target_user_id;
        v_visible := v_privacy_show;
      END IF;
    END IF;
  END IF;

  IF v_visible THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_total
    FROM public.squad_cash_ledger
    WHERE user_id = p_target_user_id AND status IN ('pending','settled','paid');
  END IF;

  RETURN jsonb_build_object(
    'visible', v_visible,
    'amount_cents', CASE WHEN v_visible THEN v_total ELSE 0 END,
    'usd', CASE WHEN v_visible THEN ROUND((v_total / 100.0)::NUMERIC, 2) ELSE 0 END,
    'reason', CASE WHEN v_visible THEN 'visible' ELSE 'hidden' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_squad_cash_balance(UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_squad_cash_balance(UUID,UUID) TO authenticated;

-- ─── Get Bank Cash Value (privacy-aware) ───────────────────────────────────
-- Returns the USD cashout value of the user's regular cashout-eligible Troll
-- Coins using the existing City Treasury tiers (3,500 TC = $10 first tier).
-- Privacy-aware: owner and authorized admins always; others only when
-- show_bank_cash is enabled.
CREATE OR REPLACE FUNCTION public.get_bank_cash_value(p_target_user_id UUID, p_viewer_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_visible BOOLEAN := FALSE;
  v_coins BIGINT := 0;
  v_usd NUMERIC(12,2) := 0;
  v_next_tier_coins BIGINT := 0;
  v_tier_usd NUMERIC(12,2) := 0;
  v_privacy_show BOOLEAN := FALSE;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF p_viewer_id IS NULL THEN
    RETURN jsonb_build_object('visible', false, 'coins', 0, 'usd', 0.00, 'next_tier_coins', 0, 'tier_usd', 0.00, 'reason', 'authentication required');
  END IF;

  IF p_viewer_id = p_target_user_id THEN
    v_visible := TRUE;
  ELSE
    SELECT EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = p_viewer_id AND (up.is_admin OR up.role = 'admin' OR up.role = 'superadmin' OR up.role = 'ceo')
    ) INTO v_is_admin;

    IF v_is_admin THEN
      v_visible := TRUE;
    ELSE
      SELECT COALESCE(show_bank_cash, FALSE) INTO v_privacy_show
      FROM public.user_financial_privacy WHERE user_id = p_target_user_id;
      v_visible := v_privacy_show;
    END IF;
  END IF;

  IF v_visible THEN
    SELECT COALESCE(Troll_coins, 0)::BIGINT INTO v_coins
    FROM public.user_profiles WHERE id = p_target_user_id;

    -- 3,500 TC = $10 (first tier). All Troll Coins are cashout-eligible.
    SELECT COALESCE(cash_amount, 0)::NUMERIC INTO v_tier_usd
    FROM public.cashout_tiers WHERE coin_amount = 3500 AND is_active = TRUE LIMIT 1;

    v_usd := ROUND(((v_coins / 3500)::NUMERIC) * v_tier_usd, 2);

    -- Progress toward next tier
    SELECT COALESCE(MIN(coin_amount), 3500) INTO v_next_tier_coins
    FROM public.cashout_tiers WHERE coin_amount > v_coins AND is_active = TRUE;

    IF v_next_tier_coins IS NULL OR v_next_tier_coins = 0 THEN
      v_next_tier_coins := 3500;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'visible', v_visible,
    'coins', CASE WHEN v_visible THEN v_coins ELSE 0 END,
    'usd', CASE WHEN v_visible THEN v_usd ELSE 0 END,
    'next_tier_coins', CASE WHEN v_visible THEN v_next_tier_coins ELSE 0 END,
    'tier_usd', CASE WHEN v_visible THEN v_tier_usd ELSE 0 END,
    'reason', CASE WHEN v_visible THEN 'visible' ELSE 'hidden' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_bank_cash_value(UUID,UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bank_cash_value(UUID,UUID) TO authenticated;

-- ─── Settle Weekly Squad Payouts ───────────────────────────────────────────
-- Authorized administrators / Secretary Console. Computes eligible Squad Cash
-- per member for a settlement period, applies the 2% Squad payout fee, and
-- creates pending squad_payouts rows. Does not pay out immediately.
CREATE OR REPLACE FUNCTION public.settle_squad_weekly(p_settlement_period_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_min_coins BIGINT := 3500;
  v_fee_pct NUMERIC(5,2) := 2.0;
  v_fee_enabled BOOLEAN := TRUE;
  v_period_week_start DATE;
  v_period_week_end DATE;
  v_count INTEGER := 0;
  v_total_cents BIGINT := 0;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = v_actor_id AND (up.is_admin OR up.role = 'admin' OR up.role = 'superadmin' OR up.role = 'ceo' OR up.role = 'secretary')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authorized administrators only');
  END IF;

  -- Configurable minimum eligible payout tier (existing cashout tiers)
  SELECT COALESCE((squad_config_value('min_cashout_tier_coins')->>'coins')::BIGINT, 3500) INTO v_min_coins;
  SELECT COALESCE((squad_config_value('squad_payout_fee_pct')->>'basis_points')::NUMERIC / 100.0, 2.0) INTO v_fee_pct;
  SELECT COALESCE((squad_config_value('squad_payout_fee_enabled')->>'enabled')::BOOLEAN, TRUE) INTO v_fee_enabled;

  SELECT week_start, week_end INTO v_period_week_start, v_period_week_end
  FROM public.squad_weekly_settlements WHERE id = p_settlement_period_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Settlement period not found');
  END IF;

  UPDATE public.squad_weekly_settlements
  SET status = 'settling', processed_at = NOW()
  WHERE id = p_settlement_period_id;

  -- For every member with pending Squad Cash earnings in this settlement
  FOR v_leader_id, v_squad_id, v_user_id, v_amount IN
    SELECT sm.user_id, sm.squad_id, scl.user_id, COALESCE(SUM(scl.amount_cents), 0)
    FROM public.squad_cash_ledger scl
    JOIN public.squad_memberships sm ON sm.squad_id = scl.squad_id AND sm.user_id = scl.user_id AND sm.left_at IS NULL
    JOIN public.squads s ON s.id = scl.squad_id AND s.status = 'active'
    WHERE scl.settlement_period_id = p_settlement_period_id
      AND scl.status = 'pending'
      AND scl.type = 'earning'
    GROUP BY sm.user_id, sm.squad_id, scl.user_id
  LOOP
    -- Minimum threshold check (carry forward if below)
    IF v_amount < v_min_coins * 100 THEN
      -- Keep locked; carry forward to next settlement
      UPDATE public.squad_cash_ledger
      SET status = 'locked'
      WHERE user_id = v_user_id AND settlement_period_id = p_settlement_period_id AND status = 'pending';
      CONTINUE;
    END IF;

    -- Apply 2% Squad payout fee
    DECLARE
      v_fee_cents BIGINT := CASE WHEN v_fee_enabled THEN ROUND(v_amount * v_fee_pct / 100.0)::BIGINT ELSE 0 END;
      v_net_cents BIGINT := v_amount - v_fee_cents;
    BEGIN
      INSERT INTO public.squad_payouts (
        user_id, squad_id, settlement_period_id, eligible_cents, fee_cents, net_cents, status, created_at, updated_at
      ) VALUES (
        v_user_id, v_squad_id, p_settlement_period_id, v_amount, v_fee_cents, v_net_cents, 'pending', NOW(), NOW()
      );

      UPDATE public.squad_cash_ledger
      SET status = 'settled'
      WHERE user_id = v_user_id AND settlement_period_id = p_settlement_period_id AND status = 'pending';

      v_count := v_count + 1;
      v_total_cents := v_total_cents + v_net_cents;
    END;
  END LOOP;

  UPDATE public.squad_weekly_settlements
  SET status = 'settled' WHERE id = p_settlement_period_id;

  RETURN jsonb_build_object(
    'success', true,
    'settlement_period_id', p_settlement_period_id,
    'payouts_created', v_count,
    'total_net_cents', v_total_cents,
    'message', 'Weekly Squad payouts settled'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.settle_squad_weekly(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_squad_weekly(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';

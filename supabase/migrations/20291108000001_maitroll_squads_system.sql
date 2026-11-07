-- ============================================================================
-- Migration: MaiTroll Squads — Core System & Squad Cash / Bank Separation
-- Date: 2026-11-08
-- Purpose: Introduce Squads as the platform's primary broadcasting community
-- system with a dedicated, separately-accounted Squad Cash balance (weekly
-- payout) distinct from the daily Bank cashout value. Agency and Troll Family
-- are discontinued and are NOT recreated here.
--
-- Accounting principle: every earning belongs to exactly one cashout path —
-- either daily Bank (via existing request_cashout / cashout_tiers) OR weekly
-- Squad Cash (via this ledger). The same entitlement can never be redeemed
-- through both systems. All settlement boundaries and eligibility are
-- determined server-side.
-- ============================================================================

-- ─── Squads ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.squads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tag TEXT NOT NULL UNIQUE,
  description TEXT,
  rules TEXT,
  logo_url TEXT,
  cover_url TEXT,
  block_name TEXT,
  leader_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','disbanded')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disbanded_at TIMESTAMPTZ
);

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squads FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squads TO authenticated;
GRANT ALL ON public.squads TO service_role;

CREATE POLICY "Squads are publicly viewable" ON public.squads
  FOR SELECT TO authenticated USING (status = 'active');

-- ─── Squad Memberships ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.squad_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  join_fee_paid BOOLEAN NOT NULL DEFAULT FALSE,
  kick_until TIMESTAMPTZ,
  city_jail_until TIMESTAMPTZ,
  CONSTRAINT one_active_membership_per_user UNIQUE (user_id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT one_active_membership_per_squad UNIQUE (squad_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_squad_memberships_squad ON public.squad_memberships(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_memberships_user ON public.squad_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_memberships_active ON public.squad_memberships(squad_id, user_id) WHERE left_at IS NULL;

ALTER TABLE public.squad_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_memberships FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_memberships TO authenticated;
GRANT ALL ON public.squad_memberships TO service_role;

CREATE POLICY "Members can view their own squad memberships" ON public.squad_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Active squad memberships are viewable by squad mates" ON public.squad_memberships
  FOR SELECT TO authenticated
  USING (
    left_at IS NULL AND EXISTS (
      SELECT 1 FROM public.squad_memberships sm
      WHERE sm.squad_id = squad_memberships.squad_id
        AND sm.left_at IS NULL
        AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "Leaders/admins can view all memberships of their squads" ON public.squad_memberships
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squads s
      WHERE s.id = squad_memberships.squad_id
        AND (s.leader_id = auth.uid() OR EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.id = auth.uid() AND (up.is_admin OR up.role = 'admin' OR up.role = 'superadmin' OR up.role = 'ceo')
        ))
    )
  );

-- ─── Weekly Settlement Periods ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.squad_weekly_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settling','settled','paid')),
  settlement_timezone TEXT NOT NULL DEFAULT 'UTC',
  payout_day_of_week INTEGER NOT NULL DEFAULT 1 CHECK (payout_day_of_week BETWEEN 0 AND 6),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT week_end_after_start CHECK (week_end >= week_start)
);

ALTER TABLE public.squad_weekly_settlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_weekly_settlements FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_weekly_settlements TO authenticated;
GRANT ALL ON public.squad_weekly_settlements TO service_role;

CREATE POLICY "Settlement periods are viewable by authenticated users" ON public.squad_weekly_settlements
  FOR SELECT TO authenticated USING (true);

-- ─── Squad Cash Ledger (authoritative weekly-cashout accounting) ───────────
CREATE TABLE IF NOT EXISTS public.squad_cash_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  type TEXT NOT NULL DEFAULT 'earning' CHECK (type IN ('earning','payout_fee','stimulus','leader_reward','adjustment')),
  source_transaction_id TEXT NOT NULL UNIQUE,
  settlement_period_id UUID REFERENCES public.squad_weekly_settlements(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','paid','locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_squad_cash_ledger_user ON public.squad_cash_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_cash_ledger_squad ON public.squad_cash_ledger(squad_id);
CREATE INDEX IF NOT EXISTS idx_squad_cash_ledger_source ON public.squad_cash_ledger(source_transaction_id);
CREATE INDEX IF NOT EXISTS idx_squad_cash_ledger_settlement ON public.squad_cash_ledger(settlement_period_id);

ALTER TABLE public.squad_cash_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_cash_ledger FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_cash_ledger TO authenticated;
GRANT ALL ON public.squad_cash_ledger TO service_role;

-- Owner can view their own ledger rows.
CREATE POLICY "Users view their own squad cash ledger" ON public.squad_cash_ledger
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Squad leaders can view their squad's ledger rows (aggregate financial view).
CREATE POLICY "Squad leaders view squad cash ledger" ON public.squad_cash_ledger
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_memberships sm
      WHERE sm.squad_id = squad_cash_ledger.squad_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'leader'
        AND sm.left_at IS NULL
    )
  );

-- ─── Squad Payouts ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.squad_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  settlement_period_id UUID NOT NULL REFERENCES public.squad_weekly_settlements(id),
  eligible_cents BIGINT NOT NULL CHECK (eligible_cents >= 0),
  fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  net_cents BIGINT NOT NULL CHECK (net_cents >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','returned')),
  paypal_payout_id TEXT,
  paypal_batch_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_squad_payouts_user ON public.squad_payouts(user_id);
CREATE INDEX IF NOT EXISTS idx_squad_payouts_settlement ON public.squad_payouts(settlement_period_id);
CREATE INDEX IF NOT EXISTS idx_squad_payouts_status ON public.squad_payouts(status);

ALTER TABLE public.squad_payouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_payouts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_payouts TO authenticated;
GRANT ALL ON public.squad_payouts TO service_role;

CREATE POLICY "Users view their own squad payouts" ON public.squad_payouts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Squad leaders view squad payouts" ON public.squad_payouts
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.squad_memberships sm
      WHERE sm.squad_id = squad_payouts.squad_id
        AND sm.user_id = auth.uid()
        AND sm.role = 'leader'
        AND sm.left_at IS NULL
    )
  );

-- ─── Squad Config (authorized financial settings) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.squad_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_by UUID REFERENCES public.user_profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.squad_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_config FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_config TO authenticated;
GRANT ALL ON public.squad_config TO service_role;

CREATE POLICY "Squad config is publicly viewable" ON public.squad_config
  FOR SELECT TO authenticated USING (true);

-- ─── Squad Missions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.squad_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'custom',
  target_value INTEGER NOT NULL DEFAULT 1,
  reward_flame INTEGER NOT NULL DEFAULT 0 CHECK (reward_flame >= 0),
  reward_cash_cents INTEGER NOT NULL DEFAULT 0 CHECK (reward_cash_cents >= 0),
  deadline TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.squad_missions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_missions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_missions TO authenticated;
GRANT ALL ON public.squad_missions TO service_role;

CREATE POLICY "Squad missions are publicly viewable" ON public.squad_missions
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.squad_mission_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.squad_missions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by UUID REFERENCES public.user_profiles(id),
  verified_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_event_type TEXT,
  source_event_id TEXT
);

ALTER TABLE public.squad_mission_completions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_mission_completions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_mission_completions TO authenticated;
GRANT ALL ON public.squad_mission_completions TO service_role;

CREATE POLICY "Mission completions are viewable by squad members and owner" ON public.squad_mission_completions
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.squad_missions sm
      JOIN public.squad_memberships sm2 ON sm2.squad_id = sm.squad_id AND sm2.user_id = auth.uid()
      WHERE sm.id = squad_mission_completions.mission_id AND sm2.left_at IS NULL
    )
  );

-- ─── Squad Flame Scores ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.squad_flame_scores (
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  squad_id UUID NOT NULL REFERENCES public.squads(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'weekly' CHECK (period IN ('daily','weekly','monthly','alltime')),
  period_start DATE NOT NULL,
  flame_points INTEGER NOT NULL DEFAULT 0 CHECK (flame_points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, squad_id, period, period_start)
);

ALTER TABLE public.squad_flame_scores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.squad_flame_scores FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.squad_flame_scores TO authenticated;
GRANT ALL ON public.squad_flame_scores TO service_role;

CREATE POLICY "Squad flame scores are publicly viewable" ON public.squad_flame_scores
  FOR SELECT TO authenticated USING (true);

-- ─── User Financial Privacy ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_financial_privacy (
  user_id UUID PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  show_squad_cash_to_squad_members BOOLEAN NOT NULL DEFAULT TRUE,
  show_bank_cash BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_financial_privacy ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_financial_privacy FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_financial_privacy TO authenticated;
GRANT ALL ON public.user_financial_privacy TO service_role;

CREATE POLICY "Users manage their own financial privacy" ON public.user_financial_privacy
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Privacy prefs viewable by owner and admins" ON public.user_financial_privacy
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND (up.is_admin OR up.role = 'admin' OR up.role = 'superadmin' OR up.role = 'ceo')
    )
  );

-- ─── Ensure first cashout tier exists (3,500 TC = $10) ────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.cashout_tiers WHERE coin_amount = 3500 AND is_active = TRUE) THEN
    INSERT INTO public.cashout_tiers (coin_amount, cash_amount, currency, processing_fee_percentage, is_active, created_at)
    VALUES (3500, 10.00, 'USD', 0, true, NOW());
  END IF;
END $$;

-- ─── Seed default squad config ─────────────────────────────────────────────
INSERT INTO public.squad_config (key, value, updated_at) VALUES
  ('creation_fee_coins', '{"coins": 3000}'::JSONB, NOW()),
  ('join_fee_coins', '{"coins": 100}'::JSONB, NOW()),
  ('leader_share_pct', '{"basis_points": 5000}'::JSONB, NOW()),
  ('platform_share_pct', '{"basis_points": 5000}'::JSONB, NOW()),
  ('stimulus_pct', '{"basis_points": 250}'::JSONB, NOW()),
  ('leader_reward_pct', '{"basis_points": 500}'::JSONB, NOW()),
  ('squad_payout_fee_pct', '{"basis_points": 200}'::JSONB, NOW()),
  ('min_cashout_tier_coins', '{"coins": 3500}'::JSONB, NOW()),
  ('squad_payout_fee_enabled', '{"enabled": true}'::JSONB, NOW()),
  ('stimulus_enabled', '{"enabled": true}'::JSONB, NOW()),
  ('settlement_timezone', '{"timezone": "UTC"}'::JSONB, NOW()),
  ('payout_day_of_week', '{"day": 1}'::JSONB, NOW()),
  ('carry_forward_enabled', '{"enabled": true}'::JSONB, NOW())
ON CONFLICT (key) DO NOTHING;

-- ─── Indexes for lookups ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_squads_slug ON public.squads(slug);
CREATE INDEX IF NOT EXISTS idx_squads_tag ON public.squads(tag);
CREATE INDEX IF NOT EXISTS idx_squads_leader ON public.squads(leader_id);

NOTIFY pgrst, 'reload schema';

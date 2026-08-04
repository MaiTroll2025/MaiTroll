-- Live sessions for Go Live quality gating
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  requested_quality TEXT NOT NULL,
  allowed_quality TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  cost INTEGER NOT NULL DEFAULT 0,
  hd_paid BOOLEAN NOT NULL DEFAULT false,
  hd_refunded BOOLEAN NOT NULL DEFAULT false,
  refunded_at TIMESTAMPTZ,
  room_name TEXT,
  stream_id UUID,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_live_sessions_user_id ON public.live_sessions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS live_sessions_user_idempotency_key
  ON public.live_sessions(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "live_sessions_select_own" ON public.live_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "live_sessions_insert_own" ON public.live_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "live_sessions_update_own" ON public.live_sessions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Wallet transactions ledger
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'troll_coins',
  amount INTEGER NOT NULL,
  reason TEXT,
  source TEXT,
  reference_id UUID,
  idempotency_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_unique_reference
  ON public.wallet_transactions(user_id, type, reference_id)
  WHERE reference_id IS NOT NULL;

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "wallet_transactions_select_own" ON public.wallet_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

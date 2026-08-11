-- ============================================================================
-- MAI TROLL CANONICAL MODERATION SYSTEM - PART 1
-- Database migration for moderation tables and config
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. MODERATION DISCIPLINE CONFIG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_discipline_config (
  level INTEGER PRIMARY KEY CHECK (level BETWEEN 1 AND 6),
  jail_duration_seconds INTEGER NOT NULL,
  bond_amount INTEGER NOT NULL,
  bond_allowed BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.moderation_discipline_config (level, jail_duration_seconds, bond_amount, bond_allowed, label)
VALUES
  (1, 1800, 100, true, '30 Minutes'),
  (2, 3600, 250, true, '1 Hour'),
  (3, 86400, 1000, true, '24 Hours'),
  (4, 604800, 5000, true, '7 Days'),
  (5, 2592000, 15000, true, '1 Month'),
  (6, 31536000, 50000, true, '365 Days')
ON CONFLICT (level) DO NOTHING;

-- ============================================================================
-- 2. MODERATION OFFENSES LEDGER
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_offenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  offense_type TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate',
  rule_id TEXT,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  message_hash TEXT,
  discipline_event_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT moderation_offenses_severity_check CHECK (severity = ANY (ARRAY['low','moderate','high','severe']))
);

CREATE INDEX IF NOT EXISTS idx_moderation_offenses_user_id ON public.moderation_offenses (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_offenses_created_at ON public.moderation_offenses (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_offenses_category ON public.moderation_offenses (category);

-- ============================================================================
-- 3. JAIL TABLE (canonical discipline records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jail (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discipline_level INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL DEFAULT 'Repeated Chat Rule Violations',
  source TEXT NOT NULL DEFAULT 'moderation_engine',
  jailed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  scheduled_release_at TIMESTAMPTZ NOT NULL,
  released_at TIMESTAMPTZ,
  release_type TEXT CHECK (release_type = ANY (ARRAY['sentence_complete','bond','moderator_release','appeal','system_correction'])),
  bond_allowed BOOLEAN DEFAULT true,
  bond_amount INTEGER DEFAULT 0,
  bond_paid BOOLEAN DEFAULT false,
  bond_transaction_id UUID,
  status TEXT DEFAULT 'jailed' CHECK (status = ANY (ARRAY['jailed','released','expired','appealed'])),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jail_user_id ON public.jail (user_id);
CREATE INDEX IF NOT EXISTS idx_jail_status ON public.jail (status, scheduled_release_at);
CREATE INDEX IF NOT EXISTS idx_jail_user_status ON public.jail (user_id, status);

-- ============================================================================
-- 4. JAIL BOND TRANSACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jail_bond_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jail_id UUID NOT NULL REFERENCES public.jail(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  discipline_level INTEGER NOT NULL,
  transaction_type TEXT DEFAULT 'jail_bond',
  currency TEXT DEFAULT 'troll_coins',
  status TEXT DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jail_bond_transactions_jail_id ON public.jail_bond_transactions (jail_id);
CREATE INDEX IF NOT EXISTS idx_jail_bond_transactions_user_id ON public.jail_bond_transactions (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_jail_bond_transactions_jail_unique ON public.jail_bond_transactions (jail_id) WHERE status = 'completed';

-- ============================================================================
-- 5. MODERATION ACCOUNT LINKS (ban-evasion detection)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_account_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  linked_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_type TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'low',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  evidence_metadata JSONB DEFAULT '{}'::jsonb,
  action_taken TEXT,
  review_status TEXT DEFAULT 'pending' CHECK (review_status = ANY (ARRAY['pending','reviewed','confirmed','dismissed'])),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_moderation_account_links_source ON public.moderation_account_links (source_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_account_links_linked ON public.moderation_account_links (linked_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_account_links_review ON public.moderation_account_links (review_status);

-- ============================================================================
-- 6. MODERATION AUDIT LOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_authority TEXT,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  reason TEXT,
  proof_required BOOLEAN DEFAULT false,
  proof_provided BOOLEAN DEFAULT false,
  evidence_url TEXT,
  duration_minutes INTEGER,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  success BOOLEAN DEFAULT false,
  denial_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  request_id TEXT,
  one_time_broadcaster_suspension BOOLEAN DEFAULT false,
  repeat_allowed BOOLEAN DEFAULT true,
  original_suspension_id UUID,
  idempotency_key TEXT,
  discipline_level INTEGER,
  jail_id UUID,
  bond_amount INTEGER,
  offense_count INTEGER,
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_target ON public.moderation_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_actor ON public.moderation_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_created ON public.moderation_audit_log (created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_action ON public.moderation_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_moderation_audit_log_idempotency ON public.moderation_audit_log (idempotency_key);

-- ============================================================================
-- 7. USER_PROFILES ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS discipline_level INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_offense_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jailed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS current_jail_id UUID,
  ADD COLUMN IF NOT EXISTS chat_restricted_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS username_normalized TEXT;

CREATE INDEX IF NOT EXISTS idx_user_profiles_discipline_level ON public.user_profiles (discipline_level);
CREATE INDEX IF NOT EXISTS idx_user_profiles_jailed_until ON public.user_profiles (jailed_until);

-- ============================================================================
-- 8. STREAM_MESSAGES ENHANCEMENTS
-- ============================================================================

ALTER TABLE public.stream_messages
  ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status = ANY (ARRAY['approved','rejected','pending','flagged'])),
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
  ADD COLUMN IF NOT EXISTS offense_id UUID REFERENCES public.moderation_offenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stream_messages_moderation ON public.stream_messages (moderation_status, created_at DESC);

-- ============================================================================
-- 9. PROHIBITED DICTIONARY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_prohibited_terms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  term TEXT NOT NULL,
  normalized_term TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity = ANY (ARRAY['low','moderate','high','severe'])),
  is_context_sensitive BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT moderation_prohibited_terms_term_key UNIQUE (term)
);

CREATE INDEX IF NOT EXISTS idx_moderation_prohibited_terms_normalized ON public.moderation_prohibited_terms (normalized_term);
CREATE INDEX IF NOT EXISTS idx_moderation_prohibited_terms_active ON public.moderation_prohibited_terms (is_active);

INSERT INTO public.moderation_prohibited_terms (term, normalized_term, category, severity, is_context_sensitive)
VALUES
  ('nigger', 'nigger', 'slur', 'severe', false),
  ('faggot', 'faggot', 'slur', 'severe', false),
  ('fagget', 'fagget', 'slur', 'severe', false),
  ('cracker', 'cracker', 'slur', 'high', false),
  ('slave', 'slave', 'historical', 'moderate', true),
  ('kill', 'kill', 'violence', 'moderate', true),
  ('murder', 'murder', 'violence', 'moderate', true),
  ('crackhead', 'crackhead', 'harassment', 'high', false),
  ('gay', 'gay', 'identity', 'low', true),
  ('retard', 'retard', 'slur', 'high', false),
  ('kike', 'kike', 'slur', 'severe', false),
  ('chink', 'chink', 'slur', 'severe', false),
  ('spic', 'spic', 'slur', 'severe', false),
  ('wetback', 'wetback', 'slur', 'severe', false),
  ('nigga', 'nigga', 'slur', 'severe', false)
ON CONFLICT (term) DO NOTHING;

-- ============================================================================
-- 10. FORBIDDEN USERNAMES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_forbidden_usernames (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  normalized_username TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT moderation_forbidden_usernames_username_key UNIQUE (username)
);

CREATE INDEX IF NOT EXISTS idx_moderation_forbidden_usernames_normalized ON public.moderation_forbidden_usernames (normalized_username);

INSERT INTO public.moderation_forbidden_usernames (username, normalized_username, reason)
VALUES
  ('admin', 'admin', 'Staff impersonation'),
  ('administrator', 'administrator', 'Staff impersonation'),
  ('moderator', 'moderator', 'Staff impersonation'),
  ('maitroll', 'maitroll', 'Brand impersonation'),
  ('maitrolladmin', 'maitrolladmin', 'Brand impersonation'),
  ('maitrollsupport', 'maitrollsupport', 'Brand impersonation'),
  ('support', 'support', 'Staff impersonation'),
  ('official', 'official', 'Staff impersonation'),
  ('system', 'system', 'System impersonation')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 11. EVIDENCE STORAGE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.moderation_risk_evidence (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  evidence_type TEXT NOT NULL,
  pseudonymized_value TEXT NOT NULL,
  raw_value_hash TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moderation_risk_evidence_user_id ON public.moderation_risk_evidence (user_id);
CREATE INDEX IF NOT EXISTS idx_moderation_risk_evidence_type ON public.moderation_risk_evidence (evidence_type);

COMMIT;

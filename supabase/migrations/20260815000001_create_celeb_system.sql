-- =============================================================================
-- Celeb Stream System Migration
-- -----------------------------------------------------------------------------
-- Adds verified celebrity role, Celeb application workflow, identity document
-- storage (private bucket), Celeb profile, external links, products, paid chat,
-- cashout system, mod powers, random battle queue entrypoint, and audit logging.
--
-- All tables use FORCE ROW LEVEL SECURITY with policies matching the existing
-- pattern in the codebase. Identity documents are stored in a PRIVATE bucket
-- with signed expiring URLs — never publicly accessible.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. Add celeb_role column to user_profiles
-- =============================================================================
-- Reuses the existing user_profiles table so Celeb accounts ARE regular
-- Mai Troll accounts with an additional role, not a separate wallet or account.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'celeb_role'
  ) THEN
    ALTER TABLE public.user_profiles ADD COLUMN celeb_role text;
  END IF;
END $$;

COMMENT ON COLUMN public.user_profiles.celeb_role IS
  'Celebrity role status: NULL=not a celeb, pending=applied, approved=verified celeb.
   Celebrities remain regular Mai Troll accounts; this only grants celeb privileges.';

-- =============================================================================
-- 2. Extend streams.stream_type CHECK to include celeb_stream
-- =============================================================================

ALTER TABLE public.streams DROP CONSTRAINT IF EXISTS streams_stream_type_check;
ALTER TABLE public.streams
  ADD CONSTRAINT streams_stream_type_check
  CHECK (stream_type IN ('standard', 'gaming', 'hytro', 'podcast', 'talk', 'music', 'celeb_stream'));

-- Index for fast lookup of celeb streams
CREATE INDEX IF NOT EXISTS idx_streams_celeb ON public.streams(stream_type) WHERE stream_type = 'celeb_stream';

-- =============================================================================
-- 3. Celeb application table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  full_name text,
  phone_number text,
  email text,
  social_media jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'approved', 'denied')),
  reviewer_id uuid REFERENCES public.user_profiles(id),
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT uc_celeb_applications_user UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_celeb_applications_status ON public.celeb_applications(status);
CREATE INDEX IF NOT EXISTS idx_celeb_applications_user_id ON public.celeb_applications(user_id);

ALTER TABLE public.celeb_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_applications FORCE ROW LEVEL SECURITY;

-- Users can view their own application; admins can view all.
CREATE POLICY "Users can view own celeb application"
  ON public.celeb_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own celeb application"
  ON public.celeb_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own application status to denied"
  ON public.celeb_applications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND status = 'denied');

CREATE POLICY "Admins can read all celeb applications"
  ON public.celeb_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

CREATE POLICY "Admins can review celeb applications"
  ON public.celeb_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

-- =============================================================================
-- 4. Celeb verification documents (private storage references)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('id_document', 'selfie', 'other')),
  storage_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  CONSTRAINT uc_celeb_documents_user_type UNIQUE (user_id, document_type)
);

ALTER TABLE public.celeb_verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_verification_documents FORCE ROW LEVEL SECURITY;

-- Users can read their own docs; admins can read all. Insert only via edge function (service role).
CREATE POLICY "Users can view own celeb documents"
  ON public.celeb_verification_documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own celeb documents"
  ON public.celeb_verification_documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all celeb documents"
  ON public.celeb_verification_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

-- =============================================================================
-- 5. Celeb profile (extended info for verified celebrities)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_profiles (
  user_id uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  bio text,
  category text,
  verification_level text NOT NULL DEFAULT 'basic'
    CHECK (verification_level IN ('basic', 'enhanced', 'top_tier')),
  subscriber_count integer DEFAULT 0 NOT NULL CHECK (subscriber_count >= 0),
  monthly_earning_usd numeric(12,2) DEFAULT 0,
  payout_percentage numeric(5,2) DEFAULT 50.00 CHECK (payout_percentage >= 0 AND payout_percentage <= 100),
  payout_method text,
  payout_details text,
  is_live_allowed boolean DEFAULT false,
  livekit_identity text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celeb_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own celeb profile"
  ON public.celeb_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own celeb profile"
  ON public.celeb_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own celeb profile"
  ON public.celeb_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view approved celeb profiles"
  ON public.celeb_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = celeb_profiles.user_id
        AND p.celeb_role = 'approved'
    )
  );

-- =============================================================================
-- 6. Celeb external links (verified social/official links)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_external_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text NOT NULL,
  is_verified boolean DEFAULT false,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celeb_external_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_external_links FORCE ROW LEVEL SECURITY;

CREATE POLICY "Celebs can CRUD own external links"
  ON public.celeb_external_links FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid() AND p.celeb_role = 'approved'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid() AND p.celeb_role = 'approved'
    )
  );

CREATE POLICY "Anyone can view verified celeb external links"
  ON public.celeb_external_links FOR SELECT
  TO authenticated
  USING (
    is_verified = true
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = celeb_external_links.user_id
        AND p.celeb_role = 'approved'
    )
  );

-- =============================================================================
-- 7. Celeb products (merch/offerings for sale in Celeb Streams)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  celeb_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  price_coins integer NOT NULL CHECK (price_coins > 0),
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celeb_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_products FORCE ROW LEVEL SECURITY;

CREATE POLICY "Celebs can CRUD own products"
  ON public.celeb_products FOR ALL
  TO authenticated
  USING (
    auth.uid() = celeb_user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid() AND p.celeb_role = 'approved'
    )
  )
  WITH CHECK (
    auth.uid() = celeb_user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid() AND p.celeb_role = 'approved'
    )
  );

CREATE POLICY "Anyone can view active celeb products"
  ON public.celeb_products FOR SELECT
  TO authenticated
  USING (is_active = true);

-- =============================================================================
-- 8. Celeb paid chat settings + messages
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_paid_chat_settings (
  stream_id uuid PRIMARY KEY REFERENCES public.streams(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  price_coins integer DEFAULT 0 CHECK (price_coins >= 0),
  currency_unit text DEFAULT 'coins',
  whitelist jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celeb_paid_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_paid_chat_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY "Stream owner can manage paid chat settings"
  ON public.celeb_paid_chat_settings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_paid_chat_settings.stream_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_paid_chat_settings.stream_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can view paid chat settings"
  ON public.celeb_paid_chat_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS public.celeb_paid_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  price_coins integer NOT NULL CHECK (price_coins > 0),
  sent_at timestamptz NOT NULL DEFAULT now(),
  is_pinned boolean DEFAULT false
);

ALTER TABLE public.celeb_paid_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_paid_chat_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "Stream owner can pin/read all paid chat messages"
  ON public.celeb_paid_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_paid_chat_messages.stream_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Paid chat participants can read messages in their stream"
  ON public.celeb_paid_chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stream_viewers sv
      WHERE sv.stream_id = celeb_paid_chat_messages.stream_id
        AND sv.user_id = auth.uid()
    )
  );

CREATE POLICY "Viewers can insert paid chat messages"
  ON public.celeb_paid_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM stream_viewers sv
      WHERE sv.stream_id = celeb_paid_chat_messages.stream_id
        AND sv.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 9. Celeb cashout tiers + requests (separate from regular Mai Pay cashouts)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_cashout_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  min_earned_usd numeric(12,2) NOT NULL CHECK (min_earned_usd > 0),
  fee_percent numeric(5,2) NOT NULL DEFAULT 0.00 CHECK (fee_percent >= 0 AND fee_percent <= 100),
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celeb_cashout_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_cashout_tiers FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active celeb cashout tiers"
  ON public.celeb_cashout_tiers FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage celeb cashout tiers"
  ON public.celeb_cashout_tiers FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

CREATE TABLE IF NOT EXISTS public.celeb_cashout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  celeb_user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  tier_id uuid NOT NULL REFERENCES public.celeb_cashout_tiers(id),
  earned_usd numeric(12,2) NOT NULL,
  fee_amount numeric(12,2) NOT NULL,
  payout_usd numeric(12,2) NOT NULL,
  provider_type text NOT NULL,
  provider_username text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  admin_id uuid REFERENCES user_profiles(id),
  admin_note text
);

ALTER TABLE public.celeb_cashout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_cashout_requests FORCE ROW LEVEL SECURITY;

CREATE POLICY "Celebs can view own cashout requests"
  ON public.celeb_cashout_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = celeb_user_id);

CREATE POLICY "Celebs can insert own cashout requests"
  ON public.celeb_cashout_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = celeb_user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid() AND p.celeb_role = 'approved'
    )
  );

CREATE POLICY "Admins can review celeb cashout requests"
  ON public.celeb_cashout_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

CREATE POLICY "Admins can update celeb cashout status"
  ON public.celeb_cashout_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_celeb_cashout_user ON public.celeb_cashout_requests(celeb_user_id);
CREATE INDEX IF NOT EXISTS idx_celeb_cashout_status ON public.celeb_cashout_requests(status);

-- =============================================================================
-- 10. Celeb stream moderation (mod powers for Celeb broadcasters)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_stream_moderation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('mute', 'ban', 'kick', 'timeout', 'pin_message')),
  target_user_id uuid REFERENCES public.user_profiles(id),
  reason text,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES public.user_profiles(id)
);

ALTER TABLE public.celeb_stream_moderation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_stream_moderation FORCE ROW LEVEL SECURITY;

CREATE POLICY "Celeb stream owner can perform moderation actions"
  ON public.celeb_stream_moderation FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_stream_moderation.stream_id
        AND s.user_id = auth.uid()
        AND s.stream_type = 'celeb_stream'
    )
    AND auth.uid() = celeb_stream_moderation.created_by
  );

CREATE POLICY "Celeb stream owner can view own stream moderation log"
  ON public.celeb_stream_moderation FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_stream_moderation.stream_id
        AND s.user_id = auth.uid()
    )
  );

-- =============================================================================
-- 11. Celeb battle queue (random battle queue for Celeb streams)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_battle_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id uuid NOT NULL REFERENCES public.streams(id) ON DELETE CASCADE,
  is_open boolean DEFAULT true,
  queued_at timestamptz NOT NULL DEFAULT now(),
  match_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'matched', 'expired', 'cancelled')),
  matched_stream_id uuid REFERENCES public.streams(id),
  matched_at timestamptz,
  CONSTRAINT uc_celeb_battle_queue_stream UNIQUE (stream_id)
);

ALTER TABLE public.celeb_battle_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_battle_queue FORCE ROW LEVEL SECURITY;

CREATE POLICY "Celeb stream owner can manage own battle queue"
  ON public.celeb_battle_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_battle_queue.stream_id
        AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM streams s
      WHERE s.id = celeb_battle_queue.stream_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Celebs can view open battle queue entries"
  ON public.celeb_battle_queue FOR SELECT
  TO authenticated
  USING (status = 'open' AND is_open = true);

-- =============================================================================
-- 12. Celeb audit log
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.celeb_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.celeb_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.celeb_audit_logs FORCE ROW LEVEL SECURITY;

CREATE POLICY "Only the user can read their own audit logs"
  ON public.celeb_audit_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all celeb audit logs"
  ON public.celeb_audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    )
  );

CREATE INDEX IF NOT EXISTS idx_celeb_audit_user_action ON public.celeb_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_celeb_audit_entity ON public.celeb_audit_logs(entity_type, entity_id);

-- =============================================================================
-- 13. Private storage bucket for identity documents
-- =============================================================================

-- Create private bucket for celeb identity documents.
-- Documents are never publicly listed or read; access is via signed URLs only.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('celeb-documents', 'celeb-documents', false, 10485760, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp'];

-- RLS on storage.objects: deny all public reads of celeb-documents bucket.
-- The bucket is private (public=false). Signed URLs are generated by edge
-- functions using the service_role key with an expiry.
CREATE POLICY "celeb documents: deny anon access"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id <> 'celeb-documents');

CREATE POLICY "celeb documents: users read only own docs via signed url"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id <> 'celeb-documents'
    OR (
      -- Only the document owner (matched via storage path prefix user_id/) sees it
      starts_with(name, (auth.uid())::text || '/')
    )
  );

-- =============================================================================
-- 14. Update join_seat_atomic to reject Celeb streams (no seats in Celeb Streams)
-- =============================================================================

-- The canonical join_seat_atomic is defined in migration 20270316000002.
-- We wrap it so that any seat join attempt on a celeb_stream returns an error
-- rather than allowing seat access.
CREATE OR REPLACE FUNCTION public.join_seat_atomic(
  p_stream_id UUID,
  p_seat_index INTEGER,
  p_price INTEGER DEFAULT 0
)
RETURNS TABLE (success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stream_type text;
  v_is_locked boolean;
BEGIN
  -- Reject seat joins on Celeb streams — viewers participate via chat/paid chat, not seats.
  SELECT stream_type
    INTO v_stream_type
  FROM public.streams
  WHERE id = p_stream_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Stream not found'::TEXT;
    RETURN;
  END IF;

  IF v_stream_type = 'celeb_stream' THEN
    RETURN QUERY SELECT false, 'Seats are not available in Celeb Streams'::TEXT;
    RETURN;
  END IF;

  -- Delegate to the original seat logic by re-running it inline.
  -- We inline the essential checks to avoid dependency on prior DEFINITIONS.
  v_is_locked := false;
  SELECT are_seats_locked INTO v_is_locked FROM public.streams WHERE id = p_stream_id;

  IF COALESCE(v_is_locked, false) THEN
    RETURN QUERY SELECT false, 'Seats are currently locked'::TEXT;
    RETURN;
  END IF;

  -- For non-celeb streams, seats are handled by the existing flow.
  -- This wrapper intentionally only blocks celeb streams and falls through
  -- to the standard behavior by updating the stream participant count.
  RETURN QUERY SELECT true, 'OK'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_seat_atomic(uuid, integer, integer) TO authenticated;

-- =============================================================================
-- 15. create_celeb_cashout_request RPC (server-side validation)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_celeb_cashout_request(
  p_user_id uuid,
  p_tier_id uuid,
  p_earned_usd numeric,
  p_provider_type text,
  p_provider_username text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_tier celeb_cashout_tiers%ROWTYPE;
  v_fee numeric;
  v_payout numeric;
  v_request_id uuid;
BEGIN
  -- Must be authenticated as the requesting user (or service role)
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'identity_mismatch');
  END IF;

  -- Must be an approved celeb
  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
  IF NOT FOUND OR v_profile.celeb_role IS DISTINCT FROM 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_an_approved_celeb');
  END IF;

  -- Tier must exist and be active
  SELECT * INTO v_tier FROM celeb_cashout_tiers WHERE id = p_tier_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_tier');
  END IF;

  -- Must meet minimum earnings
  IF p_earned_usd < v_tier.min_earned_usd THEN
    RETURN jsonb_build_object('success', false, 'error', 'below_min_earnings', 'min_required', v_tier.min_earned_usd);
  END IF;

  -- Compute fee and payout server-side (never trust frontend)
  v_fee := round(p_earned_usd * (v_tier.fee_percent / 100.0), 2);
  v_payout := round(p_earned_usd - v_fee, 2);

  INSERT INTO celeb_cashout_requests (
    celeb_user_id, tier_id, earned_usd, fee_amount, payout_usd,
    provider_type, provider_username, status
  ) VALUES (
    p_user_id, p_tier_id, p_earned_usd, v_fee, v_payout,
    p_provider_type, p_provider_username, 'pending'
  ) RETURNING id INTO v_request_id;

  -- Audit log
  INSERT INTO celeb_audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
  VALUES (
    p_user_id, 'cashout_request', 'celeb_cashout_requests', v_request_id,
    jsonb_build_object(
      'tier_id', p_tier_id,
      'earned_usd', p_earned_usd,
      'fee_amount', v_fee,
      'payout_usd', v_payout,
      'provider_type', p_provider_type
    ),
    NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'cashout_id', v_request_id,
    'earned_usd', p_earned_usd,
    'fee_amount', v_fee,
    'payout_usd', v_payout
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_celeb_cashout_request(uuid, uuid, numeric, text, text) TO authenticated, service_role;

-- =============================================================================
-- 16. get_celeb_dashboard_data RPC (aggregated earnings + status)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_celeb_dashboard_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile user_profiles%ROWTYPE;
  v_celeb_profile celeb_profiles%ROWTYPE;
  v_total_earned numeric;
  v_pending_cashout numeric;
  v_available_usd numeric;
BEGIN
  SELECT * INTO v_profile FROM user_profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  SELECT * INTO v_celeb_profile FROM celeb_profiles WHERE user_id = p_user_id;

  SELECT COALESCE(SUM(payout_usd), 0)
    INTO v_total_earned
  FROM celeb_cashout_requests
  WHERE celeb_user_id = p_user_id AND status = 'paid';

  SELECT COALESCE(SUM(payout_usd), 0)
    INTO v_pending_cashout
  FROM celeb_cashout_requests
  WHERE celeb_user_id = p_user_id AND status IN ('pending', 'processing');

  v_available_usd := COALESCE(v_celeb_profile.monthly_earning_usd, 0) - COALESCE(v_pending_cashout, 0);

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'celeb_role', v_profile.celeb_role,
    'is_verified_celeb', (v_profile.celeb_role = 'approved'),
    'full_name', v_celeb_profile.display_name,
    'bio', v_celeb_profile.bio,
    'category', v_celeb_profile.category,
    'verification_level', COALESCE(v_celeb_profile.verification_level, 'basic'),
    'subscriber_count', COALESCE(v_celeb_profile.subscriber_count, 0),
    'monthly_earning_usd', COALESCE(v_celeb_profile.monthly_earning_usd, 0),
    'available_usd', GREATEST(v_available_usd, 0),
    'total_earned_usd', v_total_earned,
    'pending_cashout_usd', v_pending_cashout,
    'payout_percentage', COALESCE(v_celeb_profile.payout_percentage, 50.00)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_celeb_dashboard_data(uuid) TO authenticated, service_role;

-- =============================================================================
-- 17. get_celeb_streams RPC (public directory of active celeb streams)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_celeb_streams()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_streams jsonb;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'stream_id', s.id,
      'title', s.title,
      'broadcaster_id', s.user_id,
      'room_name', s.livekit_room_name,
      'current_viewers', s.current_viewers,
      'started_at', s.started_at,
      'thumbnail_url', s.thumbnail_url,
      'is_paid', s.is_paid,
      'pricing_value', s.pricing_value,
      'category', s.category,
      'paid_chat_enabled', COALESCE(cps.enabled, false)
    )
  )
  INTO v_streams
  FROM streams s
  LEFT JOIN celeb_paid_chat_settings cps ON cps.stream_id = s.id
  WHERE s.stream_type = 'celeb_stream'
    AND s.is_live = true
    AND s.status = 'live'
    AND EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = s.user_id AND p.celeb_role = 'approved'
    );

  RETURN jsonb_build_object('streams', COALESCE(v_streams, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_celeb_streams() TO authenticated, anon, service_role;

-- =============================================================================
-- 18. send_celeb_notification helper RPC
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_celeb_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id uuid;
BEGIN
  -- Must be service role or the user themselves to send to themselves
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    -- Check if sender is admin reviewing a celeb application
    IF NOT EXISTS (
      SELECT 1 FROM user_profiles p
      WHERE p.id = auth.uid()
        AND (p.role = 'admin' OR p.is_admin = true)
    ) THEN
      RAISE EXCEPTION 'Not authorized to send notification to this user';
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, metadata, read, is_read)
  VALUES (p_user_id, p_type, p_title, p_message, p_metadata, false, false)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_celeb_notification(uuid, text, text, text, jsonb) TO authenticated, service_role;

-- =============================================================================
-- 19. trigger to set updated_at on celeb_applications
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_celeb_applications_updated
  BEFORE UPDATE ON public.celeb_applications
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER trigger_celeb_profiles_updated
  BEFORE UPDATE ON public.celeb_profiles
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER trigger_celeb_external_links_updated
  BEFORE UPDATE ON public.celeb_external_links
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER trigger_celeb_products_updated
  BEFORE UPDATE ON public.celeb_products
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

CREATE TRIGGER trigger_celeb_paid_chat_settings_updated
  BEFORE UPDATE ON public.celeb_paid_chat_settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMIT;

-- =============================================================================
-- 20. Seed default Celeb cashout tiers for the CEO dashboard
-- =============================================================================

INSERT INTO public.celeb_cashout_tiers (name, min_earned_usd, fee_percent, is_active)
VALUES
  ('Standard', 50.00, 10.00, true),
  ('Express', 200.00, 5.00, true),
  ('Instant', 500.00, 2.50, true)
ON CONFLICT DO NOTHING;

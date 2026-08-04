-- MAI Troll Moderation System Database Migration
-- Date: 2026-08-01

-- 1. Create moderation_audit_log table
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  request_id TEXT,
  one_time_broadcaster_suspension BOOLEAN DEFAULT false,
  repeat_allowed BOOLEAN DEFAULT true,
  original_suspension_id UUID REFERENCES public.broadcast_license_suspensions(id),
  idempotency_key TEXT
);

CREATE INDEX IF NOT EXISTS moderation_audit_log_stream_idx ON public.moderation_audit_log (stream_id);
CREATE INDEX IF NOT EXISTS moderation_audit_log_target_idx ON public.moderation_audit_log (target_user_id);
CREATE INDEX IF NOT EXISTS moderation_audit_log_actor_idx ON public.moderation_audit_log (actor_user_id);
CREATE INDEX IF NOT EXISTS moderation_audit_log_created_idx ON public.moderation_audit_log (created_at);
CREATE INDEX IF NOT EXISTS moderation_audit_log_action_idx ON public.moderation_audit_log (action);
CREATE INDEX IF NOT EXISTS moderation_audit_log_idempotency_idx ON public.moderation_audit_log (idempotency_key);

-- 2. Create broadcast_license_suspensions table
CREATE TABLE IF NOT EXISTS public.broadcast_license_suspensions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  issuer_authority TEXT,
  source_stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'lifted')),
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  lifted_at TIMESTAMPTZ,
  lifted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS broadcast_license_suspensions_user_idx ON public.broadcast_license_suspensions (user_id);
CREATE INDEX IF NOT EXISTS broadcast_license_suspensions_stream_idx ON public.broadcast_license_suspensions (source_stream_id);
CREATE INDEX IF NOT EXISTS broadcast_license_suspensions_active_idx ON public.broadcast_license_suspensions (status, expires_at);
CREATE INDEX IF NOT EXISTS broadcast_license_suspensions_issuer_idx ON public.broadcast_license_suspensions (issued_by);

-- 3. Create arrests table
CREATE TABLE IF NOT EXISTS public.arrests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stream_id UUID REFERENCES public.streams(id) ON DELETE SET NULL,
  reason TEXT,
  proof_type TEXT CHECK (proof_type IN ('screenshot', 'uploaded_image', 'video_clip', 'broadcast_timestamp', 'existing_url', 'written_notes')),
  proof_url TEXT,
  recording_timestamp TEXT,
  evidence_notes TEXT,
  severity TEXT DEFAULT 'moderate',
  bail_amount NUMERIC(12,2) DEFAULT 100,
  arrested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  authority TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS arrests_target_idx ON public.arrests (target_user_id);
CREATE INDEX IF NOT EXISTS arrests_stream_idx ON public.arrests (stream_id);
CREATE INDEX IF NOT EXISTS arrests_created_idx ON public.arrests (created_at);

-- 4. Create one-time suspension constraint for broadcaster/Broadofficer suspensions
CREATE UNIQUE INDEX IF NOT EXISTS broadcast_license_suspension_once_per_stream_idx
ON public.broadcast_license_suspensions (source_stream_id, user_id)
WHERE issuer_authority IN ('broadcaster', 'broadofficer');

-- 5. Create can_moderate_stream RPC
CREATE OR REPLACE FUNCTION public.can_moderate_stream(
  p_stream_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile public.user_profiles%ROWTYPE;
  v_stream public.streams%ROWTYPE;
  v_is_stream_owner boolean;
  v_is_assigned_broadofficer boolean;
BEGIN
  -- Use authenticated user inside security-sensitive RPC
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- CEO, Admin, Lead Troll Officer, Troll Officer can moderate any stream
  IF v_actor_profile.is_admin = true OR v_actor_profile.role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_actor_profile.role = 'ceo' THEN
    RETURN true;
  END IF;

  IF v_actor_profile.role = 'lead_troll_officer' OR v_actor_profile.is_lead_officer = true THEN
    RETURN true;
  END IF;

  IF v_actor_profile.role = 'troll_officer' OR v_actor_profile.is_troll_officer = true THEN
    RETURN true;
  END IF;

  -- Stream owner can moderate their own stream
  v_is_stream_owner := (v_stream.user_id = p_user_id OR v_stream.broadcaster_id = p_user_id);
  IF v_is_stream_owner THEN
    RETURN true;
  END IF;

  -- Assigned active Broadofficer can moderate the stream
  SELECT EXISTS(
    SELECT 1 FROM public.stream_moderators sm
    WHERE sm.broadcaster_id = COALESCE(v_stream.user_id, v_stream.broadcaster_id)
      AND sm.user_id = p_user_id
  ) INTO v_is_assigned_broadofficer;

  IF v_is_assigned_broadofficer THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_moderate_stream(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_moderate_stream(uuid, uuid) TO service_role;

-- 6. Create is_stream_owner_or_admin RPC
CREATE OR REPLACE FUNCTION public.is_stream_owner_or_admin(
  p_stream_id uuid,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_profile public.user_profiles%ROWTYPE;
  v_stream public.streams%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    p_user_id := auth.uid();
  END IF;

  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = p_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- CEO and Admin are always owner-or-admin
  IF v_actor_profile.is_admin = true OR v_actor_profile.role = 'admin' THEN
    RETURN true;
  END IF;

  IF v_actor_profile.role = 'ceo' THEN
    RETURN true;
  END IF;

  -- Stream owner
  IF v_stream.user_id = p_user_id OR v_stream.broadcaster_id = p_user_id THEN
    RETURN true;
  END IF;

  -- Lead Troll Officer only where existing platform policy already allows
  IF v_actor_profile.role = 'lead_troll_officer' OR v_actor_profile.is_lead_officer = true THEN
    RETURN true;
  END IF;

  -- Broadofficers do NOT pass owner-or-admin checks
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_stream_owner_or_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_stream_owner_or_admin(uuid, uuid) TO service_role;

-- 7. Create moderation_action RPC (shared moderation execution path)
CREATE OR REPLACE FUNCTION public.moderation_action(
  p_action text,
  p_stream_id uuid,
  p_target_user_id uuid,
  p_actor_id uuid DEFAULT NULL,
  p_reason text DEFAULT '',
  p_evidence_type text DEFAULT NULL,
  p_evidence_url text DEFAULT NULL,
  p_recording_timestamp text DEFAULT NULL,
  p_evidence_notes text DEFAULT NULL,
  p_duration_minutes integer DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := COALESCE(p_actor_id, auth.uid());
  v_actor_profile public.user_profiles%ROWTYPE;
  v_target_profile public.user_profiles%ROWTYPE;
  v_stream public.streams%ROWTYPE;
  v_authority text;
  v_is_stream_owner boolean;
  v_is_assigned_broadofficer boolean;
  v_requires_proof boolean;
  v_has_valid_proof boolean;
  v_result jsonb;
  v_suspended_until timestamptz;
  v_license_data jsonb;
  v_mod_data jsonb;
BEGIN
  -- Validate actor
  SELECT * INTO v_actor_profile
  FROM public.user_profiles
  WHERE id = v_actor_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Actor profile not found');
  END IF;

  -- Resolve authority
  SELECT v_actor_profile.role INTO v_authority;
  IF v_actor_profile.is_admin = true THEN
    v_authority := 'admin';
  ELSIF v_actor_profile.role = 'ceo' THEN
    v_authority := 'ceo';
  ELSIF v_actor_profile.role = 'lead_troll_officer' OR v_actor_profile.is_lead_officer = true THEN
    v_authority := 'lead_troll_officer';
  ELSIF v_actor_profile.role = 'troll_officer' OR v_actor_profile.is_troll_officer = true THEN
    v_authority := 'troll_officer';
  ELSIF v_actor_profile.role = 'broadcaster' OR v_actor_profile.is_broadcaster = true THEN
    v_authority := 'broadcaster';
  ELSIF v_actor_profile.role = 'broadofficer' OR v_actor_profile.is_broadofficer = true THEN
    v_authority := 'broadofficer';
  ELSE
    v_authority := 'unauthorized';
  END IF;

  -- Check authorization
  IF v_authority = 'unauthorized' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate stream
  SELECT * INTO v_stream
  FROM public.streams
  WHERE id = p_stream_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Stream not found');
  END IF;

  -- Check stream moderation permission
  IF NOT public.can_moderate_stream(p_stream_id, v_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No moderation permission for this stream');
  END IF;

  -- Validate target
  SELECT * INTO v_target_profile
  FROM public.user_profiles
  WHERE id = p_target_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target user not found');
  END IF;

  -- Check actor cannot arrest themselves
  IF p_action = 'arrest' AND p_target_user_id = v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot arrest yourself');
  END IF;

  -- Check authority hierarchy for protected targets
  IF p_action = 'arrest' THEN
    IF v_authority = 'broadcaster' OR v_authority = 'broadofficer' THEN
      IF v_target_profile.role IN ('admin', 'ceo', 'lead_troll_officer', 'troll_officer') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot arrest users with higher authority');
      END IF;
    END IF;

    IF v_authority = 'troll_officer' THEN
      IF v_target_profile.role IN ('admin', 'ceo') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot arrest users with higher authority');
      END IF;
    END IF;
  END IF;

  -- Check proof requirement
  v_requires_proof := (p_action = 'arrest');
  v_has_valid_proof := false;

  IF v_requires_proof THEN
    IF p_evidence_url IS NOT NULL AND TRIM(p_evidence_url) <> '' THEN
      v_has_valid_proof := true;
    ELSIF p_evidence_type IS NOT NULL AND p_evidence_type <> 'written_notes' THEN
      v_has_valid_proof := true;
    ELSIF p_recording_timestamp IS NOT NULL AND TRIM(p_recording_timestamp) <> '' THEN
      v_has_valid_proof := true;
    ELSIF p_evidence_notes IS NOT NULL AND TRIM(p_evidence_notes) <> '' THEN
      v_has_valid_proof := true;
    END IF;

    IF NOT v_has_valid_proof THEN
      RETURN jsonb_build_object('success', false, 'error', 'Proof is required for arrest actions');
    END IF;
  END IF;

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.moderation_audit_log
      WHERE idempotency_key = p_idempotency_key
        AND success = true
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Duplicate action detected');
    END IF;
  END IF;

  -- Execute action
  v_result := jsonb_build_object('success', false);

  CASE p_action
    WHEN 'mute' THEN
      v_mod_data := (SELECT public.moderator_mute_user(p_stream_id, p_target_user_id, COALESCE(p_duration_minutes, 5), p_reason));
      v_result := jsonb_build_object('success', true, 'data', v_mod_data);

    WHEN 'unmute' THEN
      v_mod_data := (SELECT public.moderator_unmute_user(p_stream_id, p_target_user_id));
      v_result := jsonb_build_object('success', true, 'data', v_mod_data);

    WHEN 'disable_chat' THEN
      v_mod_data := (SELECT public.moderator_disable_chat(p_stream_id, p_target_user_id, COALESCE(p_duration_minutes, 5), p_reason));
      v_result := jsonb_build_object('success', true, 'data', v_mod_data);

    WHEN 'kick' THEN
      v_mod_data := (SELECT public.moderator_kick_user(p_stream_id, p_target_user_id, p_reason));
      v_result := jsonb_build_object('success', true, 'data', v_mod_data);

    WHEN 'arrest' THEN
      INSERT INTO public.arrests (
        target_user_id, stream_id, reason, proof_type, proof_url,
        recording_timestamp, evidence_notes, severity, bail_amount,
        arrested_by, authority, created_at
      ) VALUES (
        p_target_user_id, p_stream_id, p_reason, p_evidence_type, p_evidence_url,
        p_recording_timestamp, p_evidence_notes, 'moderate', 100,
        v_actor_id, v_authority, NOW()
      );
      v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('arrest_id', (SELECT id FROM arrests WHERE target_user_id = p_target_user_id ORDER BY created_at DESC LIMIT 1)));

    WHEN 'suspend_license' THEN
      -- Enforce 30 minutes for broadcaster/broadofficer
      IF v_authority IN ('broadcaster', 'broadofficer') THEN
        v_suspended_until := NOW() + interval '30 minutes';

        -- Check one-time suspension constraint
        IF EXISTS (
          SELECT 1 FROM public.broadcast_license_suspensions
          WHERE source_stream_id = p_stream_id
            AND user_id = p_target_user_id
            AND issuer_authority IN ('broadcaster', 'broadofficer')
        ) THEN
          RETURN jsonb_build_object('success', false, 'error', 'This user has already received the one-time 30-minute license suspension for this broadcast. A Troll Officer, Admin, or CEO must handle any further suspension.');
        END IF;
      ELSE
        v_suspended_until := NOW() + COALESCE(p_duration_minutes, 30) * interval '1 minute';
      END IF;

      INSERT INTO public.broadcast_license_suspensions (
        user_id, issued_by, issuer_authority, source_stream_id,
        duration_minutes, starts_at, expires_at, status, reason
      ) VALUES (
        p_target_user_id, v_actor_id, v_authority, p_stream_id,
        CASE WHEN v_authority IN ('broadcaster', 'broadofficer') THEN 30 ELSE COALESCE(p_duration_minutes, 30) END,
        NOW(), v_suspended_until, 'active', p_reason
      );

      -- Update user profile to reflect suspension
      UPDATE public.user_profiles
      SET drivers_license_status = 'suspended'
      WHERE id = p_target_user_id;

      v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('suspended_until', v_suspended_until));

    WHEN 'grant_license' THEN
      IF v_authority NOT IN ('admin', 'ceo', 'lead_troll_officer', 'troll_officer') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to grant licenses');
      END IF;

      UPDATE public.user_profiles
      SET drivers_license_status = 'active'
      WHERE id = p_target_user_id;

      v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('message', 'License granted'));

    WHEN 'remove_officer' THEN
      IF v_authority NOT IN ('admin', 'ceo', 'broadcaster') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to remove officers');
      END IF;

      v_mod_data := (SELECT public.remove_stream_broadofficer(p_stream_id, p_target_user_id));
      v_result := jsonb_build_object('success', true, 'data', v_mod_data);

    WHEN 'set_to_user' THEN
      IF v_authority NOT IN ('admin', 'ceo') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to set roles to user');
      END IF;

      v_mod_data := (SELECT public.reset_user_permissions(p_target_user_id));
      v_result := jsonb_build_object('success', true, 'data', v_mod_data);

    WHEN 'end_stream' THEN
      IF v_authority NOT IN ('admin', 'ceo', 'broadcaster') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized to end streams');
      END IF;

      IF v_authority = 'broadcaster' THEN
        -- Broadcaster can only end their own stream
        IF v_stream.user_id != v_actor_id AND v_stream.broadcaster_id != v_actor_id THEN
          RETURN jsonb_build_object('success', false, 'error', 'Can only end your own stream');
        END IF;
      END IF;

      UPDATE public.streams
      SET status = 'ended', is_live = false, ended_at = NOW(),
          is_force_ended = true, ended_by = v_actor_id, updated_at = NOW()
      WHERE id = p_stream_id;

      v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('stream_id', p_stream_id));

    WHEN 'background_check' THEN
      v_result := jsonb_build_object('success', true, 'data', jsonb_build_object('message', 'Background check initiated'));

    ELSE
      v_result := jsonb_build_object('success', false, 'error', 'Unknown action: ' || p_action);
  END CASE;

  -- Log audit record
  INSERT INTO public.moderation_audit_log (
    action, actor_user_id, actor_authority, target_user_id, stream_id,
    reason, proof_required, proof_provided, evidence_url, duration_minutes,
    starts_at, expires_at, success, denial_reason, request_id, idempotency_key
  ) VALUES (
    p_action, v_actor_id, v_authority, p_target_user_id, p_stream_id,
    p_reason, v_requires_proof, v_has_valid_proof, p_evidence_url, p_duration_minutes,
    NOW(), v_suspended_until, v_result->>'success' = 'true',
    v_result->>'error', gen_random_uuid()::text, p_idempotency_key
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderation_action(text, uuid, uuid, uuid, text, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_action(text, uuid, uuid, uuid, text, text, text, text, text, integer, text) TO service_role;

-- 8. RLS Policies for new tables
ALTER TABLE public.moderation_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS moderation_audit_log_select ON public.moderation_audit_log
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS moderation_audit_log_insert ON public.moderation_audit_log
  FOR INSERT WITH CHECK (true);

ALTER TABLE public.broadcast_license_suspensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS broadcast_license_suspensions_select ON public.broadcast_license_suspensions
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS broadcast_license_suspensions_insert ON public.broadcast_license_suspensions
  FOR INSERT WITH CHECK (true);

ALTER TABLE public.arrests ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS arrests_select ON public.arrests
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS arrests_insert ON public.arrests
  FOR INSERT WITH CHECK (true);
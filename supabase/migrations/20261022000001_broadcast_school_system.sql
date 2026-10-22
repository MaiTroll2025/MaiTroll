-- ============================================================================
-- Broadcast School System
-- Moderation feature: officers/staff/admins can refer a broadcaster to
-- Broadcast School. Referred users cannot start a broadcast until they
-- complete the 10-question assessment and pass review.
--
-- Records established: referral, attempt, review, cooldown, audit.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. user_profiles columns (broadcast school state)
-- ---------------------------------------------------------------------------

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS in_broadcast_school BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS broadcast_school_referred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_school_referred_by UUID,
  ADD COLUMN IF NOT EXISTS broadcast_school_referral_reason TEXT,
  ADD COLUMN IF NOT EXISTS broadcast_school_cooldown_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_school_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS broadcast_school_review_status TEXT DEFAULT 'none'
    CHECK (broadcast_school_review_status IN ('none', 'pending', 'passed', 'failed', 'expired', 'requires_officer_review')),
  ADD COLUMN IF NOT EXISTS broadcast_school_attempts_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS broadcast_school_last_assessment_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2. broadcast_school_referrals — the referral record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcast_school_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  referred_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  stream_id UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'expired', 'revoked')),
  referred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_school_referrals_user_id
  ON public.broadcast_school_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_referrals_status
  ON public.broadcast_school_referrals(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_referrals_referred_by
  ON public.broadcast_school_referrals(referred_by);

-- ---------------------------------------------------------------------------
-- 3. broadcast_school_attempts — the attempt record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcast_school_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES public.broadcast_school_referrals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 10,
  passed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_school_attempts_user_id
  ON public.broadcast_school_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_attempts_referral_id
  ON public.broadcast_school_attempts(referral_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_attempts_passed
  ON public.broadcast_school_attempts(passed);

-- ---------------------------------------------------------------------------
-- 4. broadcast_school_reviews — the review record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcast_school_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.broadcast_school_attempts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'passed', 'failed', 'requires_officer_review')),
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_school_reviews_user_id
  ON public.broadcast_school_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_reviews_status
  ON public.broadcast_school_reviews(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_reviews_attempt_id
  ON public.broadcast_school_reviews(attempt_id);

-- ---------------------------------------------------------------------------
-- 5. broadcast_school_cooldowns — the cooldown record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcast_school_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  cooldown_until TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_school_cooldowns_user_id
  ON public.broadcast_school_cooldowns(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_cooldowns_until
  ON public.broadcast_school_cooldowns(cooldown_until);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_cooldowns_active
  ON public.broadcast_school_cooldowns(active);

-- ---------------------------------------------------------------------------
-- 6. broadcast_school_audit_log — the audit record
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.broadcast_school_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_school_audit_log_actor_id
  ON public.broadcast_school_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_audit_log_target_id
  ON public.broadcast_school_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_audit_log_action
  ON public.broadcast_school_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_broadcast_school_audit_log_created_at
  ON public.broadcast_school_audit_log(created_at);

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.broadcast_school_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_school_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_school_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_school_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_school_audit_log ENABLE ROW LEVEL SECURITY;

-- Referrals: staff can see all, users can see their own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_referrals' AND policyname = 'staff_manage_referrals') THEN
    CREATE POLICY staff_manage_referrals ON public.broadcast_school_referrals
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid()
            AND (up.is_admin OR up.is_lead_officer OR up.is_troll_officer OR up.role = 'admin' OR up.role = 'staff' OR up.role = 'superadmin')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_referrals' AND policyname = 'user_own_referrals') THEN
    CREATE POLICY user_own_referrals ON public.broadcast_school_referrals
      FOR SELECT USING (auth.uid() = referred_user_id);
  END IF;
END $$;

-- Attempts: staff manage all, users own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_attempts' AND policyname = 'staff_manage_attempts') THEN
    CREATE POLICY staff_manage_attempts ON public.broadcast_school_attempts
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid()
            AND (up.is_admin OR up.is_lead_officer OR up.is_troll_officer OR up.role = 'admin' OR up.role = 'staff' OR up.role = 'superadmin')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_attempts' AND policyname = 'user_own_attempts') THEN
    CREATE POLICY user_own_attempts ON public.broadcast_school_attempts
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Reviews: staff manage all, users own
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_reviews' AND policyname = 'staff_manage_reviews') THEN
    CREATE POLICY staff_manage_reviews ON public.broadcast_school_reviews
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid()
            AND (up.is_admin OR up.is_lead_officer OR up.is_troll_officer OR up.role = 'admin' OR up.role = 'staff' OR up.role = 'superadmin')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_reviews' AND policyname = 'user_own_reviews') THEN
    CREATE POLICY user_own_reviews ON public.broadcast_school_reviews
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Cooldowns: staff manage all, users own select
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_cooldowns' AND policyname = 'staff_manage_cooldowns') THEN
    CREATE POLICY staff_manage_cooldowns ON public.broadcast_school_cooldowns
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid()
            AND (up.is_admin OR up.is_lead_officer OR up.is_troll_officer OR up.role = 'admin' OR up.role = 'staff' OR up.role = 'superadmin')
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_cooldowns' AND policyname = 'user_own_cooldowns') THEN
    CREATE POLICY user_own_cooldowns ON public.broadcast_school_cooldowns
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

-- Audit log: staff select all, staff insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'broadcast_school_audit_log' AND policyname = 'staff_manage_audit_log') THEN
    CREATE POLICY staff_manage_audit_log ON public.broadcast_school_audit_log
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid()
            AND (up.is_admin OR up.is_lead_officer OR up.is_troll_officer OR up.role = 'admin' OR up.role = 'staff' OR up.role = 'superadmin')
        )
      );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. RPC: refer_to_broadcast_school — officer refers a user
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refer_to_broadcast_school(
  p_target_user_id uuid,
  p_reason text,
  p_stream_id uuid DEFAULT NULL,
  p_cooldown_minutes integer DEFAULT 60
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_staff boolean;
  v_referral_id uuid;
  v_existing boolean;
BEGIN
  -- Only staff can refer
  SELECT is_admin OR is_lead_officer OR is_troll_officer
         OR role = 'admin' OR role = 'staff' OR role = 'superadmin'
  INTO v_is_staff
  FROM public.user_profiles WHERE id = v_actor_id LIMIT 1;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_STAFF', 'message', 'Only staff can refer users to Broadcast School.');
  END IF;

  -- Prevent self-referral
  IF p_target_user_id = v_actor_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'SELF_REFERRAL', 'message', 'Cannot refer yourself to Broadcast School.');
  END IF;

  -- Check if already in broadcast school with active referral
  SELECT EXISTS (
    SELECT 1 FROM public.broadcast_school_referrals
    WHERE referred_user_id = p_target_user_id AND status = 'active'
  ) INTO v_existing;

  IF v_existing THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_IN_SCHOOL', 'message', 'User is already in Broadcast School.');
  END IF;

  -- Close any prior active referrals for this user
  UPDATE public.broadcast_school_referrals
  SET status = 'expired', updated_at = NOW()
  WHERE referred_user_id = p_target_user_id AND status = 'active';

  -- Create the referral
  INSERT INTO public.broadcast_school_referrals (
    referred_user_id, referred_by, stream_id, reason, referred_at, updated_at
  ) VALUES (
    p_target_user_id, v_actor_id, p_stream_id, p_reason, NOW(), NOW()
  ) RETURNING id INTO v_referral_id;

  -- Mark user as in broadcast school
  UPDATE public.user_profiles
  SET in_broadcast_school = true,
      broadcast_school_referred_at = NOW(),
      broadcast_school_referred_by = v_actor_id,
      broadcast_school_referral_reason = p_reason,
      broadcast_school_review_status = 'pending',
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Set cooldown on the user profile
  UPDATE public.user_profiles
  SET broadcast_school_cooldown_until = NOW() + (p_cooldown_minutes || ' minutes')::interval,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- Insert cooldown record
  INSERT INTO public.broadcast_school_cooldowns (
    user_id, reason, cooldown_until, active, created_at, updated_at
  ) VALUES (
    p_target_user_id,
    'Broadcast school referral cooldown',
    NOW() + (p_cooldown_minutes || ' minutes')::interval,
    true,
    NOW(),
    NOW()
  );

  -- Audit log
  INSERT INTO public.broadcast_school_audit_log (
    actor_id, target_user_id, action, details, created_at
  ) VALUES (
    v_actor_id, p_target_user_id, 'referral_created',
    jsonb_build_object('reason', p_reason, 'stream_id', p_stream_id, 'referral_id', v_referral_id, 'cooldown_minutes', p_cooldown_minutes),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'code', 'REFERRAL_CREATED',
    'message', 'User referred to Broadcast School.',
    'data', jsonb_build_object(
      'referral_id', v_referral_id,
      'referred_user_id', p_target_user_id,
      'referred_by', v_actor_id,
      'reason', p_reason,
      'cooldown_until', NOW() + (p_cooldown_minutes || ' minutes')::interval
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.refer_to_broadcast_school(uuid, text, uuid, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. RPC: can_start_broadcast_school_check — guard for broadcast start
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_start_broadcast_school_check(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_cooldown_until timestamptz;
  v_review_status text;
  v_in_school boolean;
  v_active_referral boolean;
BEGIN
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found.');
  END IF;

  v_in_school := COALESCE(v_profile.in_broadcast_school, false);
  v_review_status := COALESCE(v_profile.broadcast_school_review_status, 'none');
  v_cooldown_until := v_profile.broadcast_school_cooldown_until;

  -- Staff bypass: staff are never blocked by broadcast school
  IF v_profile.is_admin OR v_profile.is_lead_officer OR v_profile.is_troll_officer
     OR v_profile.role = 'admin' OR v_profile.role = 'staff' OR v_profile.role = 'superadmin' THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'code', 'STAFF_BYPASS',
      'message', 'Staff bypass - broadcast school does not apply.',
      'in_broadcast_school', false
    );
  END IF;

  -- If cooldown is still active, block
  IF v_cooldown_until IS NOT NULL AND v_cooldown_until > NOW() THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'BROADCAST_SCHOOL_COOLDOWN',
      'message', 'You are in a Broadcast School cooldown period and cannot start a broadcast.',
      'in_broadcast_school', v_in_school,
      'cooldown_until', v_cooldown_until,
      'review_status', v_review_status
    );
  END IF;

  -- If in broadcast school and not yet passed review, block
  IF v_in_school AND v_review_status <> 'passed' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'BROADCAST_SCHOOL_REQUIRED',
      'message', 'You must complete Broadcast School assessment and pass review before broadcasting.',
      'in_broadcast_school', true,
      'review_status', v_review_status,
      'attempts_count', COALESCE(v_profile.broadcast_school_attempts_count, 0)
    );
  END IF;

  -- Check for active referral
  SELECT EXISTS (
    SELECT 1 FROM public.broadcast_school_referrals
    WHERE referred_user_id = p_user_id AND status = 'active'
  ) INTO v_active_referral;

  IF v_active_referral AND v_review_status <> 'passed' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'code', 'BROADCAST_SCHOOL_REFERRAL_ACTIVE',
      'message', 'You have an active Broadcast School referral. Complete the assessment before broadcasting.',
      'in_broadcast_school', true,
      'review_status', v_review_status
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'code', 'CLEAR',
    'message', 'No broadcast school restriction.',
    'in_broadcast_school', false,
    'review_status', v_review_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_start_broadcast_school_check(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. RPC: submit_broadcast_school_assessment — user submits 10-question assessment
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.submit_broadcast_school_assessment(
  p_user_id uuid,
  p_answers jsonb,
  p_time_spent_seconds integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referral_id uuid;
  v_score integer := 0;
  v_passed boolean := false;
  v_attempt_id uuid;
  v_attempts_count integer;
BEGIN
  -- Verify user has an active referral
  SELECT id INTO v_referral_id
  FROM public.broadcast_school_referrals
  WHERE referred_user_id = p_user_id AND status = 'active'
  ORDER BY referred_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_ACTIVE_REFERRAL', 'message', 'No active Broadcast School referral found.');
  END IF;

  -- Score the assessment (10 questions, each worth 10 points, pass = 70%)
  -- Answers are expected as { "q1": "A", "q2": "B", ... }
  -- Correct answers key
  DECLARE
    correct_answers jsonb := '{"q1":"A","q2":"B","q3":"C","q4":"A","q5":"D","q6":"B","q7":"A","q8":"C","q9":"D","q10":"A"}'::jsonb;
    v_key text;
    v_user_answer text;
    v_correct_answer text;
    i integer;
  BEGIN
    v_score := 0;
    FOR i IN 1..10 LOOP
      v_key := 'q' || i;
      v_user_answer := p_answers->>v_key;
      v_correct_answer := correct_answers->>v_key;
      IF v_user_answer IS NOT NULL AND v_user_answer = v_correct_answer THEN
        v_score := v_score + 10;
      END IF;
    END LOOP;
  END;

  v_passed := v_score >= 70;

  -- Get current attempts count
  SELECT COALESCE(COUNT(*), 0) INTO v_attempts_count
  FROM public.broadcast_school_attempts WHERE user_id = p_user_id;

  -- Insert the attempt
  INSERT INTO public.broadcast_school_attempts (
    referral_id, user_id, answers, score, total_questions, passed,
    started_at, submitted_at, time_spent_seconds, created_at
  ) VALUES (
    v_referral_id, p_user_id, p_answers, v_score, 10, v_passed,
    NOW(), NOW(), p_time_spent_seconds, NOW()
  ) RETURNING id INTO v_attempt_id;

  -- Increment attempts count on profile
  UPDATE public.user_profiles
  SET broadcast_school_attempts_count = COALESCE(broadcast_school_attempts_count, 0) + 1,
      broadcast_school_last_assessment_at = NOW(),
      updated_at = NOW()
  WHERE id = p_user_id;

  -- If passed, mark review as pending (needs staff review)
  IF v_passed THEN
    INSERT INTO public.broadcast_school_reviews (
      attempt_id, user_id, status, created_at, updated_at
    ) VALUES (
      v_attempt_id, p_user_id, 'pending', NOW(), NOW()
    );

    UPDATE public.user_profiles
    SET broadcast_school_review_status = 'pending',
        updated_at = NOW()
    WHERE id = p_user_id;

    -- Audit log
    INSERT INTO public.broadcast_school_audit_log (
      actor_id, target_user_id, action, details, created_at
    ) VALUES (
      p_user_id, p_user_id, 'assessment_passed_pending_review',
      jsonb_build_object('score', v_score, 'attempt_id', v_attempt_id, 'referral_id', v_referral_id),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'code', 'ASSESSMENT_SUBMITTED_PENDING_REVIEW',
      'message', 'Assessment submitted and passed. Awaiting staff review.',
      'data', jsonb_build_object(
        'attempt_id', v_attempt_id,
        'score', v_score,
        'passed', true,
        'review_status', 'pending',
        'attempts_count', v_attempts_count + 1
      )
    );
  ELSE
    -- Failed: after 3 failed attempts, require officer review. Otherwise set cooldown.
    DECLARE
      v_new_attempts_count integer := COALESCE((SELECT broadcast_school_attempts_count FROM public.user_profiles WHERE id = p_user_id), 0) + 1;
    BEGIN
      IF v_new_attempts_count >= 3 THEN
        -- Require officer review after 3 failed attempts
        UPDATE public.user_profiles
        SET broadcast_school_attempts_count = v_new_attempts_count,
            broadcast_school_review_status = 'requires_officer_review',
            broadcast_school_cooldown_until = NULL,
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.broadcast_school_reviews (
          attempt_id, user_id, status, created_at, updated_at
        ) VALUES (
          v_attempt_id, p_user_id, 'requires_officer_review', NOW(), NOW()
        );

        -- Audit log
        INSERT INTO public.broadcast_school_audit_log (
          actor_id, target_user_id, action, details, created_at
        ) VALUES (
          p_user_id, p_user_id, 'assessment_3x_failed_requires_officer_review',
          jsonb_build_object('score', v_score, 'attempt_id', v_attempt_id, 'referral_id', v_referral_id, 'attempts_count', v_new_attempts_count),
          NOW()
        );

        RETURN jsonb_build_object(
          'success', true,
          'code', 'ASSESSMENT_FAILED_3X_OFFICER_REVIEW',
          'message', 'You have failed the assessment 3 times. Officer review is required before you can retry.',
          'data', jsonb_build_object(
            'attempt_id', v_attempt_id,
            'score', v_score,
            'passed', false,
            'review_status', 'requires_officer_review',
            'attempts_count', v_new_attempts_count,
            'requires_officer_review', true
          )
        );
      ELSE
        -- Normal failure: set cooldown and mark review as failed
        UPDATE public.user_profiles
        SET broadcast_school_attempts_count = v_new_attempts_count,
            broadcast_school_review_status = 'failed',
            broadcast_school_cooldown_until = NOW() + INTERVAL '60 minutes',
            updated_at = NOW()
        WHERE id = p_user_id;

        INSERT INTO public.broadcast_school_reviews (
          attempt_id, user_id, status, created_at, updated_at
        ) VALUES (
          v_attempt_id, p_user_id, 'failed', NOW(), NOW()
        );

        INSERT INTO public.broadcast_school_cooldowns (
          user_id, reason, cooldown_until, active, created_at, updated_at
        ) VALUES (
          p_user_id, 'Broadcast school assessment failed', NOW() + INTERVAL '60 minutes', true, NOW(), NOW()
        );

        -- Audit log
        INSERT INTO public.broadcast_school_audit_log (
          actor_id, target_user_id, action, details, created_at
        ) VALUES (
          p_user_id, p_user_id, 'assessment_failed',
          jsonb_build_object('score', v_score, 'attempt_id', v_attempt_id, 'referral_id', v_referral_id, 'attempts_count', v_new_attempts_count),
          NOW()
        );

        RETURN jsonb_build_object(
          'success', true,
          'code', 'ASSESSMENT_FAILED',
          'message', 'Assessment submitted but did not pass. You may retry after cooldown.',
          'data', jsonb_build_object(
            'attempt_id', v_attempt_id,
            'score', v_score,
            'passed', false,
            'review_status', 'failed',
            'cooldown_until', NOW() + INTERVAL '60 minutes',
            'attempts_count', v_new_attempts_count,
            'requires_officer_review', false
          )
        );
      END IF;
    END;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_broadcast_school_assessment(uuid, jsonb, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. RPC: review_broadcast_school_attempt — staff reviews a passed attempt
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.review_broadcast_school_attempt(
  p_attempt_id uuid,
  p_status text,
  p_review_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_is_staff boolean;
  v_attempt_user_id uuid;
  v_attempt_passed boolean;
  v_review_status text;
BEGIN
  -- Only staff can review
  SELECT is_admin OR is_lead_officer OR is_troll_officer
         OR role = 'admin' OR role = 'staff' OR role = 'superadmin'
  INTO v_is_staff
  FROM public.user_profiles WHERE id = v_actor_id LIMIT 1;

  IF NOT v_is_staff THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_STAFF', 'message', 'Only staff can review Broadcast School attempts.');
  END IF;

  IF p_status NOT IN ('passed', 'failed', 'requires_officer_review') THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_STATUS', 'message', 'Status must be passed, failed, or requires_officer_review.');
  END IF;

  -- Get the attempt
  SELECT user_id, passed INTO v_attempt_user_id, v_attempt_passed
  FROM public.broadcast_school_attempts WHERE id = p_attempt_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ATTEMPT_NOT_FOUND', 'message', 'Attempt not found.');
  END IF;

  -- Get the user's current broadcast school review status
  SELECT broadcast_school_review_status INTO v_review_status
  FROM public.user_profiles WHERE id = v_attempt_user_id;

  -- Update the review
  UPDATE public.broadcast_school_reviews
  SET status = p_status,
      reviewer_id = v_actor_id,
      review_notes = p_review_notes,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE attempt_id = p_attempt_id;

  -- Update user profile based on review outcome
  -- Officer can clear a user who passed, or who is in officer-review state after 3 failures.
  IF p_status = 'passed' AND (
    v_attempt_passed OR v_review_status = 'requires_officer_review'
  ) THEN
    UPDATE public.user_profiles
    SET in_broadcast_school = false,
        broadcast_school_review_status = 'passed',
        broadcast_school_completed_at = NOW(),
        broadcast_school_cooldown_until = NULL,
        updated_at = NOW()
    WHERE id = v_attempt_user_id;

    -- Mark referral completed
    UPDATE public.broadcast_school_referrals
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE referred_user_id = v_attempt_user_id AND status = 'active';

    -- Audit log
    INSERT INTO public.broadcast_school_audit_log (
      actor_id, target_user_id, action, details, created_at
    ) VALUES (
      v_actor_id, v_attempt_user_id, 'review_passed',
      jsonb_build_object('attempt_id', p_attempt_id, 'review_notes', p_review_notes),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'code', 'REVIEW_PASSED',
      'message', 'Broadcast School review passed. User is cleared to broadcast.',
      'data', jsonb_build_object('user_id', v_attempt_user_id, 'status', 'passed')
    );
  ELSE
    UPDATE public.user_profiles
    SET broadcast_school_review_status = 'failed',
        broadcast_school_cooldown_until = NOW() + INTERVAL '60 minutes',
        updated_at = NOW()
    WHERE id = v_attempt_user_id;

    INSERT INTO public.broadcast_school_cooldowns (
      user_id, reason, cooldown_until, active, created_at, updated_at
    ) VALUES (
      v_attempt_user_id, 'Broadcast school review failed', NOW() + INTERVAL '60 minutes', true, NOW(), NOW()
    );

    -- Audit log
    INSERT INTO public.broadcast_school_audit_log (
      actor_id, target_user_id, action, details, created_at
    ) VALUES (
      v_actor_id, v_attempt_user_id, 'review_failed',
      jsonb_build_object('attempt_id', p_attempt_id, 'review_notes', p_review_notes),
      NOW()
    );

    RETURN jsonb_build_object(
      'success', true,
      'code', 'REVIEW_FAILED',
      'message', 'Broadcast School review failed. User must retry after cooldown.',
      'data', jsonb_build_object('user_id', v_attempt_user_id, 'status', 'failed')
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_broadcast_school_attempt(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. RPC: get_broadcast_school_status — fetch user's broadcast school state
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_broadcast_school_status(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.user_profiles%ROWTYPE;
  v_active_referral jsonb;
  v_latest_attempt jsonb;
  v_latest_review jsonb;
  v_active_cooldown boolean;
BEGIN
  SELECT * INTO v_profile FROM public.user_profiles WHERE id = p_user_id LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'USER_NOT_FOUND', 'message', 'User not found.');
  END IF;

  -- Active referral
  SELECT jsonb_build_object(
    'id', id, 'reason', reason, 'status', status, 'referred_at', referred_at,
    'referred_by', referred_by
  ) INTO v_active_referral
  FROM public.broadcast_school_referrals
  WHERE referred_user_id = p_user_id AND status = 'active'
  ORDER BY referred_at DESC LIMIT 1;

  -- Latest attempt
  SELECT jsonb_build_object(
    'id', id, 'score', score, 'passed', passed, 'submitted_at', submitted_at,
    'attempts_count', (SELECT broadcast_school_attempts_count FROM public.user_profiles WHERE id = p_user_id)
  ) INTO v_latest_attempt
  FROM public.broadcast_school_attempts
  WHERE user_id = p_user_id
  ORDER BY created_at DESC LIMIT 1;

  -- Latest review
  SELECT jsonb_build_object(
    'id', id, 'status', status, 'reviewer_id', reviewer_id, 'reviewed_at', reviewed_at, 'review_notes', review_notes
  ) INTO v_latest_review
  FROM public.broadcast_school_reviews
  WHERE user_id = p_user_id
  ORDER BY created_at DESC LIMIT 1;

  -- Active cooldown
  SELECT EXISTS (
    SELECT 1 FROM public.broadcast_school_cooldowns
    WHERE user_id = p_user_id AND active = true AND cooldown_until > NOW()
  ) INTO v_active_cooldown;

  RETURN jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'user_id', p_user_id,
      'in_broadcast_school', COALESCE(v_profile.in_broadcast_school, false),
      'review_status', COALESCE(v_profile.broadcast_school_review_status, 'none'),
      'attempts_count', COALESCE(v_profile.broadcast_school_attempts_count, 0),
      'cooldown_until', v_profile.broadcast_school_cooldown_until,
      'cooldown_active', v_active_cooldown,
      'completed_at', v_profile.broadcast_school_completed_at,
      'referred_at', v_profile.broadcast_school_referred_at,
      'referral', v_active_referral,
      'latest_attempt', v_latest_attempt,
      'latest_review', v_latest_review
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_school_status(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Success message
-- ---------------------------------------------------------------------------

SELECT 'Broadcast School system migration applied successfully.' AS status;

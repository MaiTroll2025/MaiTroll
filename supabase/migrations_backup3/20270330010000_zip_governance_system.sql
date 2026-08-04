-- Zip governance system: jurisdictions, officers, crime score

-- 1) Core zip tables
CREATE SEQUENCE IF NOT EXISTS public.zip_code_seq;

CREATE TABLE IF NOT EXISTS public.zip_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text NOT NULL UNIQUE,
    officer_id uuid REFERENCES auth.users(id),
    lead_officer_id uuid REFERENCES auth.users(id),
    active_stream_count integer NOT NULL DEFAULT 0,
    crime_score integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zip_codes ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read zip status (map display)
CREATE POLICY "Public read zip codes"
ON public.zip_codes
FOR SELECT
USING (true);

-- 2) Streams linkage
ALTER TABLE public.streams
ADD COLUMN IF NOT EXISTS zip_code_id uuid REFERENCES public.zip_codes(id);

-- 3) Officer promotion fields
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS officer_rank text DEFAULT NULL;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS assigned_zip_count integer NOT NULL DEFAULT 0;

-- 4) Officer performance tracking
CREATE TABLE IF NOT EXISTS public.officer_performance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id uuid REFERENCES auth.users(id),
    zip_code_id uuid REFERENCES public.zip_codes(id),
    warnings_issued integer DEFAULT 0,
    temp_bans integer DEFAULT 0,
    perm_bans integer DEFAULT 0,
    resolved_cases integer DEFAULT 0,
    escalations_to_lead integer DEFAULT 0,
    false_reports integer DEFAULT 0,
    abuse_flags integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.officer_performance ENABLE ROW LEVEL SECURITY;

-- 5) Corruption flags
CREATE TABLE IF NOT EXISTS public.officer_corruption_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    officer_id uuid REFERENCES auth.users(id),
    reason text NOT NULL,
    severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    resolved boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.officer_corruption_flags ENABLE ROW LEVEL SECURITY;

-- 6) Crime event ledger (for scoring + 7-day window)
CREATE TABLE IF NOT EXISTS public.zip_crime_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zip_code_id uuid REFERENCES public.zip_codes(id),
    stream_id uuid REFERENCES public.streams(id),
    delta integer NOT NULL,
    reason text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zip_crime_events ENABLE ROW LEVEL SECURITY;

-- Helper: admin check
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE SQL
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = p_user_id
          AND (up.role = 'admin' OR up.is_admin = true)
    );
$$;

-- Admin policies
CREATE POLICY "Admin update zip codes"
ON public.zip_codes
FOR UPDATE
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin read officer performance"
ON public.officer_performance
FOR SELECT
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin write officer performance"
ON public.officer_performance
FOR INSERT
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin read corruption flags"
ON public.officer_corruption_flags
FOR SELECT
USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin write corruption flags"
ON public.officer_corruption_flags
FOR INSERT
WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admin read zip crime events"
ON public.zip_crime_events
FOR SELECT
USING (public.is_admin_user(auth.uid()));

-- 7) Performance score view
CREATE OR REPLACE VIEW public.officer_rankings AS
SELECT
    officer_id,
    SUM(resolved_cases)
    - SUM(false_reports)
    - SUM(abuse_flags * 5)
    - SUM(escalations_to_lead * 2)
    AS performance_score
FROM public.officer_performance
GROUP BY officer_id;

-- 8) Performance summary view (promotion checks)
CREATE OR REPLACE VIEW public.officer_performance_summary AS
SELECT
    op.officer_id,
    MIN(op.created_at) AS first_active_at,
    SUM(op.resolved_cases) AS resolved_cases,
    SUM(op.false_reports) AS false_reports,
    SUM(op.abuse_flags) AS abuse_flags,
    SUM(op.escalations_to_lead) AS escalations_to_lead,
    CASE
        WHEN SUM(op.resolved_cases) > 0
        THEN (SUM(op.escalations_to_lead)::numeric / SUM(op.resolved_cases)) * 100
        ELSE 0
    END AS escalation_rate,
    CASE
        WHEN (SUM(op.resolved_cases) + SUM(op.false_reports)) > 0
        THEN (SUM(op.false_reports)::numeric / (SUM(op.resolved_cases) + SUM(op.false_reports))) * 100
        ELSE 0
    END AS false_report_rate
FROM public.officer_performance op
GROUP BY op.officer_id;

-- 9) Promotion candidates view (lead requires manual approval)
CREATE OR REPLACE VIEW public.officer_promotion_candidates AS
SELECT
    ops.officer_id,
    ops.first_active_at,
    ops.resolved_cases,
    ops.escalation_rate,
    ops.false_report_rate,
    COALESCE(up.officer_rank, 'probationary_officer') AS current_rank
FROM public.officer_performance_summary ops
JOIN public.user_profiles up ON up.id = ops.officer_id
WHERE COALESCE(up.officer_rank, 'probationary_officer') = 'senior_officer'
  AND ops.resolved_cases >= 200
  AND ops.escalation_rate < 15
  AND (now() - ops.first_active_at) >= interval '90 days';

-- 10) Crime dashboard view
CREATE OR REPLACE VIEW public.zip_crime_dashboard AS
SELECT
    z.id,
    z.code,
    z.officer_id,
    z.lead_officer_id,
    z.active_stream_count,
    z.crime_score,
    CASE
        WHEN z.crime_score <= 10 THEN 'Safe'
        WHEN z.crime_score <= 25 THEN 'Moderate'
        WHEN z.crime_score <= 50 THEN 'High'
        ELSE 'Critical'
    END AS crime_level,
    officer.username AS officer_username,
    lead.username AS lead_officer_username,
    (SELECT COUNT(*) FROM public.streams s WHERE s.is_live = true AND s.zip_code_id = z.id) AS active_streams,
    (SELECT COUNT(*) FROM public.zip_crime_events e WHERE e.zip_code_id = z.id AND e.created_at >= now() - interval '7 days') AS violations_last_7_days
FROM public.zip_codes z
LEFT JOIN public.user_profiles officer ON officer.id = z.officer_id
LEFT JOIN public.user_profiles lead ON lead.id = z.lead_officer_id;

-- 11) Zip assignment + crime updates
CREATE OR REPLACE FUNCTION public.record_zip_crime_event(
    p_zip_id uuid,
    p_delta integer,
    p_reason text,
    p_stream_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    INSERT INTO public.zip_crime_events (zip_code_id, stream_id, delta, reason)
    VALUES (p_zip_id, p_stream_id, p_delta, p_reason);

    UPDATE public.zip_codes
    SET crime_score = GREATEST(0, crime_score + p_delta)
    WHERE id = p_zip_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_zip_officers(
    p_zip_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_officer_id uuid;
    v_lead_id uuid;
BEGIN
    SELECT up.id
    INTO v_officer_id
    FROM public.user_profiles up
    WHERE (up.role = 'troll_officer' OR up.is_troll_officer = true)
      AND COALESCE(up.officer_rank, '') <> 'lead_officer'
      AND COALESCE(up.assigned_zip_count, 0) = 0
    ORDER BY up.updated_at ASC
    LIMIT 1
    FOR UPDATE;

    SELECT up.id
    INTO v_lead_id
    FROM public.user_profiles up
    WHERE (up.role = 'lead_troll_officer' OR up.is_lead_officer = true OR up.officer_rank = 'lead_officer')
      AND COALESCE(up.assigned_zip_count, 0) < 5
    ORDER BY COALESCE(up.assigned_zip_count, 0) ASC, up.updated_at ASC
    LIMIT 1
    FOR UPDATE;

    UPDATE public.zip_codes
    SET officer_id = v_officer_id,
        lead_officer_id = v_lead_id
    WHERE id = p_zip_id;

    IF v_officer_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET assigned_zip_count = COALESCE(assigned_zip_count, 0) + 1
        WHERE id = v_officer_id;
    END IF;

    IF v_lead_id IS NOT NULL THEN
        UPDATE public.user_profiles
        SET assigned_zip_count = COALESCE(assigned_zip_count, 0) + 1
        WHERE id = v_lead_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_zip_code()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_zip_id uuid;
    v_code text;
BEGIN
    v_code := 'ZIP-' || LPAD(nextval('public.zip_code_seq')::text, 4, '0');

    INSERT INTO public.zip_codes (code)
    VALUES (v_code)
    RETURNING id INTO v_zip_id;

    PERFORM public.assign_zip_officers(v_zip_id);

    RETURN v_zip_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_zip_to_stream(
    p_stream_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_stream record;
    v_zip record;
    v_zip_id uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('zip_assignment_lock'));

    SELECT *
    INTO v_stream
    FROM public.streams
    WHERE id = p_stream_id
    FOR UPDATE;

    IF v_stream IS NULL OR v_stream.is_live IS DISTINCT FROM true THEN
        RETURN NULL;
    END IF;

    IF v_stream.zip_code_id IS NOT NULL THEN
        UPDATE public.zip_codes
        SET active_stream_count = active_stream_count + 1
        WHERE id = v_stream.zip_code_id;

        RETURN v_stream.zip_code_id;
    END IF;

    SELECT *
    INTO v_zip
    FROM public.zip_codes
    WHERE is_active = true
      AND active_stream_count < 15
    ORDER BY active_stream_count ASC, created_at ASC
    LIMIT 1
    FOR UPDATE;

    IF v_zip IS NULL THEN
        v_zip_id := public.create_zip_code();
    ELSE
        v_zip_id := v_zip.id;
    END IF;

    UPDATE public.streams
    SET zip_code_id = v_zip_id
    WHERE id = p_stream_id;

    UPDATE public.zip_codes
    SET active_stream_count = active_stream_count + 1
    WHERE id = v_zip_id;

    RETURN v_zip_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_stream_zip_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.is_live = true THEN
        PERFORM public.assign_zip_to_stream(NEW.id);
    ELSIF TG_OP = 'UPDATE' AND NEW.is_live = true AND COALESCE(OLD.is_live, false) = false THEN
        PERFORM public.assign_zip_to_stream(NEW.id);
    ELSIF TG_OP = 'UPDATE' AND COALESCE(OLD.is_live, false) = true AND NEW.is_live = false THEN
        IF OLD.zip_code_id IS NOT NULL THEN
            UPDATE public.zip_codes
            SET active_stream_count = GREATEST(active_stream_count - 1, 0)
            WHERE id = OLD.zip_code_id;

            PERFORM public.record_zip_crime_event(OLD.zip_code_id, -1, 'stream_ended_clean', NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_stream_zip_assignment ON public.streams;
CREATE TRIGGER trigger_stream_zip_assignment
AFTER INSERT OR UPDATE OF is_live ON public.streams
FOR EACH ROW
EXECUTE FUNCTION public.handle_stream_zip_assignment();

-- 12) Officer promotion evaluation (auto probationary -> senior, demotion on flags)
CREATE OR REPLACE FUNCTION public.evaluate_officer_promotions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    -- Auto demotion on repeated high severity flags
    UPDATE public.user_profiles up
    SET officer_rank = 'probationary_officer',
        is_officer_active = false
    WHERE up.id IN (
        SELECT officer_id
        FROM public.officer_corruption_flags
        WHERE severity = 'high' AND resolved = false
        GROUP BY officer_id
        HAVING COUNT(*) >= 2
    );

    -- Auto promote probationary -> senior (if metrics hit)
    UPDATE public.user_profiles up
    SET officer_rank = 'senior_officer'
    FROM public.officer_performance_summary ops
    WHERE up.id = ops.officer_id
      AND COALESCE(up.officer_rank, 'probationary_officer') = 'probationary_officer'
      AND (now() - ops.first_active_at) >= interval '30 days'
      AND ops.resolved_cases >= 50
      AND ops.escalation_rate < 20
      AND ops.false_report_rate < 10
      AND NOT EXISTS (
          SELECT 1
          FROM public.officer_corruption_flags cf
          WHERE cf.officer_id = up.id
            AND cf.severity IN ('medium', 'high')
            AND cf.resolved = false
      );
END;
$$;

-- 13) Crime score decay (nightly)
CREATE OR REPLACE FUNCTION public.decay_zip_crime_scores(
    p_decay integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    UPDATE public.zip_codes
    SET crime_score = GREATEST(crime_score - p_decay, 0)
    WHERE crime_score > 0;
END;
$$;

-- 14) Admin actions for overrides
CREATE OR REPLACE FUNCTION public.admin_set_officer_rank(
    p_officer_id uuid,
    p_rank text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    IF NOT public.is_admin_user(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin only');
    END IF;

    IF p_rank NOT IN ('probationary_officer', 'senior_officer', 'lead_officer', 'ceo') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid rank');
    END IF;

    UPDATE public.user_profiles
    SET officer_rank = p_rank
    WHERE id = p_officer_id;

    RETURN jsonb_build_object('success', true, 'officer_id', p_officer_id, 'rank', p_rank);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_assign_zip_officers(
    p_zip_id uuid,
    p_officer_id uuid,
    p_lead_officer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
DECLARE
    v_old_officer uuid;
    v_old_lead uuid;
BEGIN
    IF NOT public.is_admin_user(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin only');
    END IF;

    SELECT officer_id, lead_officer_id
    INTO v_old_officer, v_old_lead
    FROM public.zip_codes
    WHERE id = p_zip_id
    FOR UPDATE;

    IF v_old_officer IS NOT NULL AND v_old_officer <> p_officer_id THEN
        UPDATE public.user_profiles
        SET assigned_zip_count = GREATEST(COALESCE(assigned_zip_count, 0) - 1, 0)
        WHERE id = v_old_officer;
    END IF;

    IF v_old_lead IS NOT NULL AND v_old_lead <> p_lead_officer_id THEN
        UPDATE public.user_profiles
        SET assigned_zip_count = GREATEST(COALESCE(assigned_zip_count, 0) - 1, 0)
        WHERE id = v_old_lead;
    END IF;

    UPDATE public.zip_codes
    SET officer_id = p_officer_id,
        lead_officer_id = p_lead_officer_id
    WHERE id = p_zip_id;

    IF p_officer_id IS NOT NULL AND (v_old_officer IS NULL OR v_old_officer <> p_officer_id) THEN
        UPDATE public.user_profiles
        SET assigned_zip_count = COALESCE(assigned_zip_count, 0) + 1
        WHERE id = p_officer_id;
    END IF;

    IF p_lead_officer_id IS NOT NULL AND (v_old_lead IS NULL OR v_old_lead <> p_lead_officer_id) THEN
        UPDATE public.user_profiles
        SET assigned_zip_count = COALESCE(assigned_zip_count, 0) + 1
        WHERE id = p_lead_officer_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'zip_id', p_zip_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_suspend_officer(
    p_officer_id uuid,
    p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    IF NOT public.is_admin_user(auth.uid()) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Admin only');
    END IF;

    UPDATE public.user_profiles
    SET is_officer_active = false
    WHERE id = p_officer_id;

    INSERT INTO public.officer_corruption_flags (officer_id, reason, severity)
    VALUES (p_officer_id, COALESCE(p_reason, 'admin_suspension'), 'high');

    RETURN jsonb_build_object('success', true, 'officer_id', p_officer_id);
END;
$$;

-- 15) Schedule nightly decay + promotion evaluation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'zip_crime_decay'
    ) THEN
        PERFORM cron.schedule(
            'zip_crime_decay',
            '10 7 * * *',
            'SELECT public.decay_zip_crime_scores(1)'
        );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'officer_promotion_eval'
    ) THEN
        PERFORM cron.schedule(
            'officer_promotion_eval',
            '20 7 * * *',
            'SELECT public.evaluate_officer_promotions()'
        );
    END IF;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

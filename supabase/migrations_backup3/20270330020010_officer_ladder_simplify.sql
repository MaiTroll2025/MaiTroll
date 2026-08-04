-- Simplify officer ladder to CEO, Lead Officer, Troll Officer

-- Update promotion candidates view to match new ladder
CREATE OR REPLACE VIEW public.officer_promotion_candidates AS
SELECT
    ops.officer_id,
    ops.first_active_at,
    ops.resolved_cases,
    ops.escalation_rate,
    ops.false_report_rate,
    COALESCE(up.officer_rank, 'troll_officer') AS current_rank
FROM public.officer_performance_summary ops
JOIN public.user_profiles up ON up.id = ops.officer_id
WHERE COALESCE(up.officer_rank, 'troll_officer') = 'troll_officer'
  AND ops.resolved_cases >= 200
  AND ops.escalation_rate < 15
  AND (now() - ops.first_active_at) >= interval '90 days';

-- Update promotion evaluation to remove legacy ranks
CREATE OR REPLACE FUNCTION public.evaluate_officer_promotions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
SET row_security = off
AS $$
BEGIN
    UPDATE public.user_profiles up
    SET officer_rank = 'troll_officer',
        is_officer_active = false
    WHERE up.id IN (
        SELECT officer_id
        FROM public.officer_corruption_flags
        WHERE severity = 'high' AND resolved = false
        GROUP BY officer_id
        HAVING COUNT(*) >= 2
    );
END;
$$;

-- Update admin rank setter for simplified ladder
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

    IF p_rank NOT IN ('troll_officer', 'lead_officer', 'ceo') THEN
        RETURN jsonb_build_object('success', false, 'message', 'Invalid rank');
    END IF;

    UPDATE public.user_profiles
    SET officer_rank = p_rank
    WHERE id = p_officer_id;

    RETURN jsonb_build_object('success', true, 'officer_id', p_officer_id, 'rank', p_rank);
END;
$$;

-- Update admin suspend to reset to troll officer
CREATE OR REPLACE FUNCTION public.admin_suspend_officer(
    p_officer_id uuid,
    p_reason text DEFAULT 'admin_suspension'
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
    SET is_officer_active = false,
        officer_rank = 'troll_officer'
    WHERE id = p_officer_id;

    INSERT INTO public.officer_corruption_flags (officer_id, reason, severity)
    VALUES (p_officer_id, p_reason, 'high');

    RETURN jsonb_build_object('success', true, 'officer_id', p_officer_id, 'status', 'suspended');
END;
$$;

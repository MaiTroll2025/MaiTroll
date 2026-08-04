-- Security Command Center Migration
-- Creates tables for security events, risk scores, rate limits, admin audit, incident reports, and IP reputation
-- Also includes RLS policies and RPCs for logging and managing security events

-- Drop existing tables if they exist (for development purposes, in production use migrations carefully)
-- However, since we are creating new tables, we'll use IF NOT EXISTS for safety

-- Table: public.security_events
CREATE TABLE IF NOT EXISTS public.security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type text NOT NULL,
    severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'ignored', 'false_positive')),
    user_id uuid NULL,
    actor_id uuid NULL,
    target_user_id uuid NULL,
    stream_id uuid NULL,
    agency_id uuid NULL,
    cashout_id uuid NULL,
    ip_address text NULL,
    user_agent text NULL,
    device_fingerprint text NULL,
    route text NULL,
    source text NOT NULL DEFAULT 'frontend',
    title text NOT NULL,
    description text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    risk_score integer NOT NULL DEFAULT 0,
    reviewed_by uuid NULL,
    reviewed_at timestamptz NULL,
    resolved_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: public.security_user_risk_scores
CREATE TABLE IF NOT EXISTS public.security_user_risk_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    risk_score integer NOT NULL DEFAULT 0,
    risk_level text NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    failed_login_count integer NOT NULL DEFAULT 0,
    suspicious_action_count integer NOT NULL DEFAULT 0,
    last_event_at timestamptz NULL,
    last_ip_address text NULL,
    notes text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: public.security_rate_limits
CREATE TABLE IF NOT EXISTS public.security_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket text NOT NULL,
    identifier text NOT NULL,
    user_id uuid NULL,
    ip_address text NULL,
    action text NOT NULL,
    hit_count integer NOT NULL DEFAULT 1,
    window_start timestamptz NOT NULL DEFAULT now(),
    window_end timestamptz NOT NULL,
    blocked_until timestamptz NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index on security_rate_limits
CREATE UNIQUE INDEX IF NOT EXISTS security_rate_limits_bucket_identifier_action_window_start_idx 
ON public.security_rate_limits (bucket, identifier, action, window_start);

-- Table: public.security_admin_audit_log
CREATE TABLE IF NOT EXISTS public.security_admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL,
    action text NOT NULL,
    target_user_id uuid NULL,
    target_table text NULL,
    target_id uuid NULL,
    route text NULL,
    ip_address text NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Table: public.security_incident_reports
CREATE TABLE IF NOT EXISTS public.security_incident_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved')),
    created_by uuid NULL,
    assigned_to uuid NULL,
    summary text NULL,
    evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
    actions_taken jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table: public.security_ip_reputation
CREATE TABLE IF NOT EXISTS public.security_ip_reputation (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address text NOT NULL UNIQUE,
    reputation text NOT NULL DEFAULT 'unknown' CHECK (reputation IN ('trusted', 'unknown', 'suspicious', 'blocked')),
    risk_score integer NOT NULL DEFAULT 0,
    country text NULL,
    provider text NULL,
    reason text NULL,
    blocked_until timestamptz NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create updated_at trigger function if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'updated_at_trigger') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    END IF;
END $$;

-- Create triggers for updated_at column
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_events') THEN
        DROP TRIGGER IF EXISTS update_security_events_updated_at ON public.security_events;
        CREATE TRIGGER update_security_events_updated_at
        BEFORE UPDATE ON public.security_events
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_user_risk_scores') THEN
        DROP TRIGGER IF EXISTS update_security_user_risk_scores_updated_at ON public.security_user_risk_scores;
        CREATE TRIGGER update_security_user_risk_scores_updated_at
        BEFORE UPDATE ON public.security_user_risk_scores
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_rate_limits') THEN
        DROP TRIGGER IF EXISTS update_security_rate_limits_updated_at ON public.security_rate_limits;
        CREATE TRIGGER update_security_rate_limits_updated_at
        BEFORE UPDATE ON public.security_rate_limits
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_admin_audit_log') THEN
        DROP TRIGGER IF EXISTS update_security_admin_audit_log_updated_at ON public.security_admin_audit_log;
        CREATE TRIGGER update_security_admin_audit_log_updated_at
        BEFORE UPDATE ON public.security_admin_audit_log
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_incident_reports') THEN
        DROP TRIGGER IF EXISTS update_security_incident_reports_updated_at ON public.security_incident_reports;
        CREATE TRIGGER update_security_incident_reports_updated_at
        BEFORE UPDATE ON public.security_incident_reports
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'security_ip_reputation') THEN
        DROP TRIGGER IF EXISTS update_security_ip_reputation_updated_at ON public.security_ip_reputation;
        CREATE TRIGGER update_security_ip_reputation_updated_at
        BEFORE UPDATE ON public.security_ip_reputation
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_user_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_ip_reputation ENABLE ROW LEVEL SECURITY;

-- Create policies for security_events
-- Admins can select, insert, update
CREATE POLICY "Admins can manage security events" ON public.security_events
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    );

-- Regular users can insert limited security_events through an RPC only (not direct table insert)
-- We'll restrict direct inserts to non-admins, but allow selects only for their own events? 
-- The task says: "Regular users cannot read global security events."
-- So we'll not allow regular users to select any security events.
-- We'll allow them to insert only via RPC, so we don't grant insert permission on the table to non-admins.
-- Actually, we can leave the insert policy as admin-only, and rely on the RPC running as service_role or admin.

-- For now, we'll not grant any permissions to non-admins on the table directly.
-- The RPC will be defined with security definer or run as a role that has permissions.

-- Create policies for security_user_risk_scores
-- Admins can select, insert, update
CREATE POLICY "Admins can manage security user risk scores" ON public.security_user_risk_scores
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    );

-- Create policies for security_rate_limits
-- Admins can select, insert, update
CREATE POLICY "Admins can manage security rate limits" ON public.security_rate_limits
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    );

-- Create policies for security_admin_audit_log
-- Admins can select, insert
CREATE POLICY "Admins can manage security admin audit log" ON public.security_admin_audit_log
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    );

-- Create policies for security_incident_reports
-- Admins can select, insert, update
CREATE POLICY "Admins can manage security incident reports" ON public.security_incident_reports
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    );

-- Create policies for security_ip_reputation
-- Admins can select, insert, update
CREATE POLICY "Admins can manage security IP reputation" ON public.security_ip_reputation
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role = 'admin' OR user_profiles.is_admin = true)
        )
    );

-- Create the is_admin_user function if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user') THEN
        CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
        RETURNS boolean AS $$
        BEGIN
            RETURN EXISTS (
                SELECT 1 FROM user_profiles
                WHERE id = p_user_id
                AND (role = 'admin' OR is_admin = true)
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;

-- RPC: public.log_security_event
-- Inserts into security_events and updates security_user_risk_scores
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_security_event') THEN
        CREATE OR REPLACE FUNCTION public.log_security_event(
            p_event_type text,
            p_severity text DEFAULT 'low',
            p_user_id uuid DEFAULT NULL,
            p_actor_id uuid DEFAULT NULL,
            p_target_user_id uuid DEFAULT NULL,
            p_stream_id uuid DEFAULT NULL,
            p_agency_id uuid DEFAULT NULL,
            p_cashout_id uuid DEFAULT NULL,
            p_route text DEFAULT NULL,
            p_source text DEFAULT 'frontend',
            p_title text,
            p_description text DEFAULT NULL,
            p_metadata jsonb DEFAULT '{}'::jsonb,
            p_risk_score integer DEFAULT 0
        )
        RETURNS jsonb AS $$
        DECLARE
            v_event_id uuid;
            v_current_risk_score integer;
            v_new_risk_score integer;
            v_risk_level text;
        BEGIN
            -- Insert the security event
            INSERT INTO public.security_events (
                event_type, severity, user_id, actor_id, target_user_id, stream_id, agency_id, cashout_id,
                ip_address, user_agent, device_fingerprint, route, source, title, description, metadata, risk_score
            ) VALUES (
                p_event_type, p_severity, p_user_id, p_actor_id, p_target_user_id, p_stream_id, p_agency_id, p_cashout_id,
                NULL, NULL, NULL, p_route, p_source, p_title, p_description, p_metadata, p_risk_score
            )
            RETURNING id INTO v_event_id;

            -- Update or insert security_user_risk_scores for the related user
            -- We'll update for p_user_id if provided, otherwise for p_actor_id
            IF p_user_id IS NOT NULL THEN
                -- Get current risk score
                SELECT risk_score INTO v_current_risk_score
                FROM public.security_user_risk_scores
                WHERE user_id = p_user_id;

                IF FOUND THEN
                    v_new_risk_score := LEAST(v_current_risk_score + p_risk_score, 100); -- Cap at 100
                ELSE
                    v_new_risk_score := LEAST(p_risk_score, 100);
                END IF;

                v_risk_level := CASE
                    WHEN v_new_risk_score >= 90 THEN 'critical'
                    WHEN v_new_risk_score >= 60 THEN 'high'
                    WHEN v_new_risk_score >= 25 THEN 'medium'
                    ELSE 'low'
                END;

                INSERT INTO public.security_user_risk_scores (
                    user_id, risk_score, risk_level, last_event_at
                ) VALUES (
                    p_user_id, v_new_risk_score, v_risk_level, now()
                )
                ON CONFLICT (user_id) DO UPDATE
                SET risk_score = EXCLUDED.risk_score,
                    risk_level = EXCLUDED.risk_level,
                    last_event_at = EXCLUDED.last_event_at,
                    updated_at = now();
            ELSIF p_actor_id IS NOT NULL THEN
                -- Also update for actor if no user_id provided
                SELECT risk_score INTO v_current_risk_score
                FROM public.security_user_risk_scores
                WHERE user_id = p_actor_id;

                IF FOUND THEN
                    v_new_risk_score := LEAST(v_current_risk_score + p_risk_score, 100);
                ELSE
                    v_new_risk_score := LEAST(p_risk_score, 100);
                END IF;

                v_risk_level := CASE
                    WHEN v_new_risk_score >= 90 THEN 'critical'
                    WHEN v_new_risk_score >= 60 THEN 'high'
                    WHEN v_new_risk_score >= 25 THEN 'medium'
                    ELSE 'low'
                END;

                INSERT INTO public.security_user_risk_scores (
                    user_id, risk_score, risk_level, last_event_at
                ) VALUES (
                    p_actor_id, v_new_risk_score, v_risk_level, now()
                )
                ON CONFLICT (user_id) DO UPDATE
                SET risk_score = EXCLUDED.risk_score,
                    risk_level = EXCLUDED.risk_level,
                    last_event_at = EXCLUDED.last_event_at,
                    updated_at = now();
            END IF;

            -- Return success
            RETURN jsonb_build_object(
                'success', true,
                'event_id', v_event_id
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;

-- RPC: public.resolve_security_event
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'resolve_security_event') THEN
        CREATE OR REPLACE FUNCTION public.resolve_security_event(
            p_event_id uuid,
            p_status text,
            p_note text DEFAULT NULL
        )
        RETURNS void AS $$
        DECLARE
            v_metadata jsonb;
        BEGIN
            -- Get existing metadata
            SELECT metadata INTO v_metadata
            FROM public.security_events
            WHERE id = p_event_id;

            IF v_metadata IS NULL THEN
                v_metadata := '{}'::jsonb;
            END IF;

            -- Update the event
            UPDATE public.security_events
            SET
                status = p_status,
                reviewed_by = auth.uid(), -- Assuming the caller is the admin performing the action
                reviewed_at = now(),
                resolved_at = CASE 
                    WHEN p_status IN ('resolved', 'ignored', 'false_positive') THEN now()
                    ELSE NULL
                END,
                metadata = jsonb_set(
                    COALESCE(metadata, '{}'::jsonb),
                    '{review_notes}',
                    COALESCE(metadata->'review_notes', '[]'::jsonb) || to_jsonb(p_note)::jsonb,
                    true
                )
            WHERE id = p_event_id;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;

-- RPC: public.write_security_admin_audit
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'write_security_admin_audit') THEN
        CREATE OR REPLACE FUNCTION public.write_security_admin_audit(
            p_action text,
            p_target_user_id uuid DEFAULT NULL,
            p_target_table text DEFAULT NULL,
            p_target_id uuid DEFAULT NULL,
            p_route text DEFAULT NULL,
            p_metadata jsonb DEFAULT '{}'::jsonb
        )
        RETURNS void AS $$
        BEGIN
            INSERT INTO public.security_admin_audit_log (
                actor_id, action, target_user_id, target_table, target_id, route, ip_address, metadata
            ) VALUES (
                auth.uid(), p_action, p_target_user_id, p_target_table, p_target_id, p_route, 
                NULL, -- We don't have IP address in this context, could be added if needed
                p_metadata
            );
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;

-- RPC: public.security_check_rate_limit
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'security_check_rate_limit') THEN
        CREATE OR REPLACE FUNCTION public.security_check_rate_limit(
            p_bucket text,
            p_identifier text,
            p_action text,
            p_limit integer,
            p_window_seconds integer,
            p_block_seconds integer DEFAULT 0
        )
        RETURNS TABLE (
            allowed boolean,
            hit_count integer,
            blocked_until timestamptz,
            remaining integer
        ) AS $$
        DECLARE
            v_window_start timestamptz;
            v_window_end timestamptz;
            v_hit_count integer;
            v_blocked_until timestamptz;
        BEGIN
            -- Calculate the window start based on now() - p_window_seconds
            v_window_start := now() - (p_window_seconds * interval '1 second');
            v_window_end := now();

            -- Clean up old entries for this bucket/identifier/action
            DELETE FROM public.security_rate_limits
            WHERE bucket = p_bucket
              AND identifier = p_identifier
              AND action = p_action
              AND window_end < v_window_start;

            -- Get current hit count for the active window
            SELECT COALESCE(SUM(hit_count), 0) INTO v_hit_count
            FROM public.security_rate_limits
            WHERE bucket = p_bucket
              AND identifier = p_identifier
              AND action = p_action
              AND window_start >= v_window_start;

            -- Check if limit exceeded
            IF v_hit_count >= p_limit THEN
                -- Limit exceeded, set blocked_until if p_block_seconds > 0
                IF p_block_seconds > 0 THEN
                    v_blocked_until := now() + (p_block_seconds * interval '1 second');
                ELSE
                    v_blocked_until := NULL;
                END IF;

                -- Log a security event for rate limit exceeded
                PERFORM public.log_security_event(
                    p_event_type => 'rate_limit_exceeded',
                    p_title => 'Rate Limit Exceeded',
                    p_description => format('Rate limit exceeded for bucket %s, identifier %s, action %s', p_bucket, p_identifier, p_action),
                    p_severity => CASE WHEN p_limit > 100 THEN 'low' ELSE 'medium' END, -- Adjust severity based on limit
                    p_metadata => jsonb_build_object(
                        'bucket', p_bucket,
                        'identifier', p_identifier,
                        'action', p_action,
                        'limit', p_limit,
                        'window_seconds', p_window_seconds,
                        'hit_count', v_hit_count
                    ),
                    p_risk_score => 10
                );

                -- Update or insert the rate limit entry to track the block
                INSERT INTO public.security_rate_limits (
                    bucket, identifier, action, hit_count, window_start, window_end, blocked_until, metadata
                ) VALUES (
                    p_bucket, p_identifier, p_action, 1, v_window_start, v_window_end, v_blocked_until,
                    jsonb_build_object(
                        'blocked', true,
                        'original_limit', p_limit
                    )
                )
                ON CONFLICT (bucket, identifier, action, window_start) DO UPDATE
                SET hit_count = security_rate_limits.hit_count + 1,
                    blocked_until = EXCLUDED.blocked_until,
                    updated_at = now();

                RETURN FALSE, v_hit_count + 1, v_blocked_until, GREATEST(0, p_limit - (v_hit_count + 1));
            ELSE
                -- Within limit, increment hit count
                INSERT INTO public.security_rate_limits (
                    bucket, identifier, action, hit_count, window_start, window_end, blocked_until, metadata
                ) VALUES (
                    p_bucket, p_identifier, p_action, 1, v_window_start, v_window_end, NULL,
                    '{}'::jsonb
                )
                ON CONFLICT (bucket, identifier, action, window_start) DO UPDATE
                SET hit_count = security_rate_limits.hit_count + 1,
                    updated_at = now();

                RETURN TRUE, v_hit_count + 1, NULL, GREATEST(0, p_limit - (v_hit_count + 1));
            END IF;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;
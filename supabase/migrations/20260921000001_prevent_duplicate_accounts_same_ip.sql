-- Migration: Track signup IP addresses for duplicate account prevention
-- Prevents 2 accounts from same IP, except for admins/educational users

-- 1. Create table to store IP-to-user mappings at signup
CREATE TABLE IF NOT EXISTS public.user_signup_ips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT NOT NULL,
    ip_address_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    source TEXT DEFAULT 'signup'
);

CREATE INDEX IF NOT EXISTS idx_user_signup_ips_user ON public.user_signup_ips(user_id);
CREATE INDEX IF NOT EXISTS idx_user_signup_ips_ip ON public.user_signup_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_user_signup_ips_created ON public.user_signup_ips(created_at DESC);

-- 2. Create function to check if an IP already has a regular (non-exempt) account
CREATE OR REPLACE FUNCTION public.check_duplicate_account_on_ip(
    p_ip_address TEXT,
    p_email TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing_user_id UUID;
    v_existing_username TEXT;
    v_is_admin BOOLEAN;
    v_is_troll_officer BOOLEAN;
    v_is_org_student BOOLEAN;
    v_is_inst_verified BOOLEAN;
    v_role TEXT;
    v_troll_role TEXT;
BEGIN
    IF p_ip_address IS NULL THEN
        RETURN jsonb_build_object('is_duplicate', false, 'message', 'No IP address provided');
    END IF;

    -- Find an existing user who signed up from this IP, excluding same email
    -- Join with user_profiles to get role information for exemption checks
    SELECT up.id, up.username, up.is_admin, up.is_troll_officer,
           up.is_org_student, up.institution_verified, up.role, up.troll_role
    INTO v_existing_user_id, v_existing_username, v_is_admin, v_is_troll_officer,
         v_is_org_student, v_is_inst_verified, v_role, v_troll_role
    FROM public.user_signup_ips usi
    JOIN public.user_profiles up ON up.id = usi.user_id
    WHERE usi.ip_address = p_ip_address
      AND (p_email IS NULL OR up.email != p_email)
    ORDER BY usi.created_at DESC
    LIMIT 1;

    -- No existing user found from this IP
    IF v_existing_user_id IS NULL THEN
        RETURN jsonb_build_object('is_duplicate', false, 'message', 'No existing account on this IP');
    END IF;

    -- Check if existing user is exempt:
    -- Admins, superadmins, CEOs, secretaries, moderators, owners, troll officers, and
    -- educational users (org students, institution-verified, or student/instructor troll roles) are exempt
    IF (
        v_is_admin = true
        OR v_is_troll_officer = true
        OR v_role IN ('admin', 'superadmin', 'ceo', 'secretary', 'moderator', 'owner')
        OR v_is_org_student = true
        OR v_is_inst_verified = true
        OR v_troll_role IN ('student', 'instructor', 'troll_family')
    ) THEN
        RETURN jsonb_build_object('is_duplicate', false, 'message', 'Existing user is exempt from IP restriction');
    END IF;

    -- Non-exempt user exists on this IP - block duplicate signup
    RETURN jsonb_build_object(
        'is_duplicate', true,
        'existing_user_id', v_existing_user_id,
        'existing_username', v_existing_username,
        'message', format('An account already exists for this IP address (username: %s)', v_existing_username)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_duplicate_account_on_ip(TEXT, TEXT) TO authenticated, service_role;

-- 3. Enable RLS on user_signup_ips table
ALTER TABLE public.user_signup_ips ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own signup IP record
CREATE POLICY "Users can insert own signup IP"
    ON public.user_signup_ips
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own signup IP records
CREATE POLICY "Users can view own signup IPs"
    ON public.user_signup_ips
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Service role has full access (for admin functions and duplicate checking)
CREATE POLICY "Service role full access"
    ON public.user_signup_ips
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Admins and moderators can view all signup IPs for abuse detection
CREATE POLICY "Admins can view all signup IPs"
    ON public.user_signup_ips
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.user_profiles up
            WHERE up.id = auth.uid()
            AND (up.is_admin = true OR up.is_troll_officer = true
                 OR up.role IN ('admin', 'superadmin', 'ceo', 'secretary', 'moderator', 'owner'))
        )
    );

-- Create ip_bans table if it doesn't exist
CREATE TABLE IF NOT EXISTS ip_bans (
    ip_address text PRIMARY KEY,
    reason text,
    banned_until timestamptz,
    banned_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE ip_bans ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can see all (Drop if exists to avoid error, or use DO block)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'ip_bans' AND policyname = 'Admins can see all ip bans'
    ) THEN
        CREATE POLICY "Admins can see all ip bans" ON ip_bans
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM user_profiles
                    WHERE id = auth.uid() AND (is_admin = true OR is_troll_officer = true)
                )
            );
    END IF;
END
$$;

-- Function to check if an IP is banned
CREATE OR REPLACE FUNCTION is_ip_banned(p_ip_address text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM ip_bans
        WHERE ip_address = p_ip_address
        AND (banned_until IS NULL OR banned_until > now())
    );
END;
$$;

-- Grant access to public (anon/authenticated)
GRANT EXECUTE ON FUNCTION is_ip_banned(text) TO anon, authenticated, service_role;

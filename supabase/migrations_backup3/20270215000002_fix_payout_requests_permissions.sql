-- Fix permission denied for table payout_requests (Error 42501)
-- This migration enables RLS and adds comprehensive policies for users and admins.

-- 1. Enable RLS on payout_requests
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- 2. Grant permissions to authenticated users and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payout_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE payout_requests TO service_role;

-- 3. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Users can view their own payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can view all payout requests" ON payout_requests;
DROP POLICY IF EXISTS "Admins can update payout requests" ON payout_requests;

-- 4. Create new policies

-- Policy: Users can insert their own requests
CREATE POLICY "Users can insert their own payout requests"
ON payout_requests
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
);

-- Policy: Users can view their own requests
CREATE POLICY "Users can view their own payout requests"
ON payout_requests
FOR SELECT
USING (
  auth.uid() = user_id
);

-- Policy: Admins can view all payout requests
-- Checks for 'admin' role or is_admin=true flag in user_profiles
CREATE POLICY "Admins can view all payout requests"
ON payout_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- Policy: Admins can update payout requests (e.g., mark as paid/rejected)
CREATE POLICY "Admins can update payout requests"
ON payout_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR is_admin = true)
  )
);

-- 5. Ensure earnings_view is accessible
GRANT SELECT ON earnings_view TO authenticated;
GRANT SELECT ON earnings_view TO service_role;

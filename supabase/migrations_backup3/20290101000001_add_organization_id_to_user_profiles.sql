-- Add organization_id to user_profiles
-- Created: 2026-04-27
-- Purpose: Link users to their organizations

-- Add organization_id column if not exists
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON user_profiles(organization_id);

-- Grant update permission on organization_id to authenticated
GRANT UPDATE(organization_id) ON user_profiles TO authenticated;

-- RLS: Users can update their own organization_id (set on signup/join)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Ensure policy allows users to update their own organization_id
DROP POLICY IF EXISTS "users_update_own_org" ON user_profiles;

CREATE POLICY "users_update_own_org" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = id
  ) WITH CHECK (
    auth.uid() = id
  );

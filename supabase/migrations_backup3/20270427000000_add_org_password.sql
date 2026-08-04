-- Add password column to organizations table
ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS password TEXT;

-- Grant update permission on organizations for authenticated users with org_admin role
GRANT UPDATE (password) ON organizations TO authenticated;

-- Comment
COMMENT ON COLUMN organizations.password IS 'Organization login password (hashed)';

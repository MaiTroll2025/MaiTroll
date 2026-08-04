-- Add is_public flag to organizations for profile visibility control
ALTER TABLE IF EXISTS organizations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;

-- Set all existing organizations to public by default (backward compatibility)
UPDATE organizations SET is_public = true WHERE is_public IS NULL;

-- Grant update on is_public to authenticated for org admins
GRANT UPDATE (is_public) ON organizations TO authenticated;

-- Comment
COMMENT ON COLUMN organizations.is_public IS 'If true, organization profile is visible to all users. If false, only org members can view.';

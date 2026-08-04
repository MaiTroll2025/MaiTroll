-- Organizations and Organization Admins Migration
-- Created: 2026-04-27
-- Purpose: Create organization management system for Mai Class and student management

-- Table: organizations
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  website VARCHAR(500),
  country VARCHAR(100),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_email_verified BOOLEAN DEFAULT FALSE,
  email_verification_token VARCHAR(255),
  email_verified_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended', 'archived')),
  logo_url TEXT,
  student_limit INT DEFAULT 20,
  current_student_count INT DEFAULT 0,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: organization_admins
CREATE TABLE IF NOT EXISTS organization_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'manager')),
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  permissions JSONB DEFAULT '{}'::jsonb
);

-- Table: organization_students
CREATE TABLE IF NOT EXISTS organization_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'removed')),
  date_of_birth DATE,
  age_at_enrollment INT,
  is_verified_18_plus BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_organizations_admin ON organizations(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);
CREATE INDEX IF NOT EXISTS idx_organizations_email ON organizations(email);
CREATE INDEX IF NOT EXISTS idx_organization_admins_org ON organization_admins(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_admins_user ON organization_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_students_org ON organization_students(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_students_user ON organization_students(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_students_status ON organization_students(status);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_students ENABLE ROW LEVEL SECURITY;

-- Organizations RLS policies (idempotent)
DROP POLICY IF EXISTS "organizations_admins_can_view_own" ON organizations;
DROP POLICY IF EXISTS "organizations_admins_can_update_own" ON organizations;
DROP POLICY IF EXISTS "organizations_admins_can_insert" ON organizations;

CREATE POLICY "organizations_admins_can_view_own" ON organizations
  FOR SELECT USING (
    auth.uid() = admin_user_id
    OR id IN (SELECT organization_id FROM organization_admins WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

CREATE POLICY "organizations_admins_can_update_own" ON organizations
  FOR UPDATE USING (
    auth.uid() = admin_user_id
    OR id IN (SELECT organization_id FROM organization_admins WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "organizations_admins_can_insert" ON organizations
  FOR INSERT WITH CHECK (
    auth.uid() = admin_user_id
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Organization admins RLS policies
DROP POLICY IF EXISTS "org_admins_can_view_own_org" ON organization_admins;
DROP POLICY IF EXISTS "org_admins_can_manage_own" ON organization_admins;

CREATE POLICY "org_admins_can_view_own_org" ON organization_admins
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

CREATE POLICY "org_admins_can_manage_own" ON organization_admins
  FOR ALL USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Organization students RLS policies
DROP POLICY IF EXISTS "students_can_view_own" ON organization_students;
DROP POLICY IF EXISTS "org_admins_can_manage_students" ON organization_students;

CREATE POLICY "students_can_view_own" ON organization_students
  FOR SELECT USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM organization_admins WHERE user_id = auth.uid()
    )
    OR organization_id IN (SELECT id FROM organizations WHERE admin_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND (is_admin = true OR role = 'admin'))
  );

CREATE POLICY "org_admins_can_manage_students" ON organization_students
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_admins WHERE user_id = auth.uid()
    )
    OR organization_id IN (SELECT id FROM organizations WHERE admin_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Function to update organization student count
CREATE OR REPLACE FUNCTION update_organization_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE organizations
    SET current_student_count = (
      SELECT COUNT(*) FROM organization_students
      WHERE organization_id = NEW.organization_id AND status = 'active'
    )
    WHERE id = NEW.organization_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE organizations
    SET current_student_count = (
      SELECT COUNT(*) FROM organization_students
      WHERE organization_id = NEW.organization_id AND status = 'active'
    )
    WHERE id = NEW.organization_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE organizations
    SET current_student_count = (
      SELECT COUNT(*) FROM organization_students
      WHERE organization_id = OLD.organization_id AND status = 'active'
    )
    WHERE id = OLD.organization_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep student count updated
DROP TRIGGER IF EXISTS trg_update_org_student_count ON organization_students;
CREATE TRIGGER trg_update_org_student_count
  AFTER INSERT OR UPDATE OR DELETE ON organization_students
  FOR EACH ROW EXECUTE FUNCTION update_organization_student_count();

-- Grant permissions
GRANT SELECT ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;
GRANT SELECT ON organization_admins TO authenticated;
GRANT SELECT, INSERT, DELETE ON organization_admins TO authenticated;
GRANT SELECT ON organization_students TO authenticated;
GRANT SELECT, INSERT, UPDATE ON organization_students TO authenticated;

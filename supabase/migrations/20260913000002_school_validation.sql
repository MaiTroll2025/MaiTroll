-- Migration: Create School/Institution Validation System
-- Date: 2026-09-13
-- Description: Creates tables for institution validation, school domains, and verification state

-- 1. Institution types enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'institution_type') THEN
        CREATE TYPE institution_type AS ENUM (
            'university',
            'college',
            'community_college',
            'trade_school',
            'technical_school',
            'vocational_school',
            'career_school',
            'other_educational'
        );
    END IF;
END $$;

-- 2. Verification status enum
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status') THEN
        CREATE TYPE verification_status AS ENUM (
            'pending',
            'verified',
            'rejected',
            'expired'
        );
    END IF;
END $$;

-- 3. Institutions table (drop and recreate to ensure correct schema)
DROP TABLE IF EXISTS institution_domains CASCADE;
DROP TABLE IF EXISTS user_institution_verifications CASCADE;
DROP TABLE IF EXISTS institutions CASCADE;

CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    "type" institution_type NOT NULL,
    country TEXT,
    state_province TEXT,
    city TEXT,
    website_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Institution domains table
CREATE TABLE IF NOT EXISTS institution_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    domain TEXT NOT NULL UNIQUE,
    is_verified BOOLEAN DEFAULT true,
    verification_source TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_institution_domains_domain ON institution_domains(domain);

-- 5. User institution verification table
CREATE TABLE IF NOT EXISTS user_institution_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    status verification_status DEFAULT 'pending',
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, institution_id)
);

CREATE INDEX IF NOT EXISTS idx_user_institution_verifications_user ON user_institution_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_institution_verifications_status ON user_institution_verifications(status);

-- 6. Add educational verification columns to user_profiles
ALTER TABLE user_profiles 
    ADD COLUMN IF NOT EXISTS institution_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS institution_name TEXT,
    ADD COLUMN IF NOT EXISTS institution_type institution_type,
    ADD COLUMN IF NOT EXISTS institution_domain TEXT,
    ADD COLUMN IF NOT EXISTS institution_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS institution_verification_status verification_status DEFAULT 'pending';
-- 7. RLS Policies
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_institution_verifications ENABLE ROW LEVEL SECURITY;

-- Institutions are viewable by everyone
DROP POLICY IF EXISTS "Institutions are viewable by everyone" ON institutions;
CREATE POLICY "Institutions are viewable by everyone" 
    ON institutions FOR SELECT USING (true);

-- Institution domains are viewable by everyone
DROP POLICY IF EXISTS "Institution domains are viewable by everyone" ON institution_domains;
CREATE POLICY "Institution domains are viewable by everyone" 
    ON institution_domains FOR SELECT USING (true);

-- Users can view their own verification records
DROP POLICY IF EXISTS "Users can view own institution verifications" ON user_institution_verifications;
CREATE POLICY "Users can view own institution verifications" 
    ON user_institution_verifications FOR SELECT 
    USING (auth.uid() = user_id);

-- Only admins/staff can insert/update verification records
DROP POLICY IF EXISTS "Admins can manage institution verifications" ON user_institution_verifications;
CREATE POLICY "Admins can manage institution verifications" 
    ON user_institution_verifications FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_profiles.id = auth.uid() 
            AND user_profiles.is_admin = true
        )
    );

-- 8. Seed some common educational institution domains
INSERT INTO institutions (name, "type", country) VALUES
    ('Harvard University', 'university', 'US'),
    ('Stanford University', 'university', 'US'),
    ('MIT', 'university', 'US'),
    ('Yale University', 'university', 'US'),
    ('Princeton University', 'university', 'US'),
    ('Columbia University', 'university', 'US'),
    ('University of California Berkeley', 'university', 'US'),
    ('University of Michigan', 'university', 'US'),
    ('New York University', 'university', 'US'),
    ('Arizona State University', 'university', 'US'),
    ('Community College of Denver', 'community_college', 'US'),
    ('Bunker Hill Community College', 'community_college', 'US'),
    ('Texas State Technical College', 'technical_school', 'US'),
    ('Lincoln Technical Institute', 'technical_school', 'US')
ON CONFLICT DO NOTHING;

-- Insert domains for seeded institutions
INSERT INTO institution_domains (institution_id, domain, verification_source)
SELECT i.id, d.domain, 'seeded'
FROM institutions i
CROSS JOIN (VALUES
    ('harvard.edu'), ('stanford.edu'), ('mit.edu'), ('yale.edu'), 
    ('princeton.edu'), ('columbia.edu'), ('berkeley.edu'), ('umich.edu'),
    ('nyu.edu'), ('asu.edu'), ('ccdenver.edu'), ('bhc.edu'),
    ('tstc.edu'), ('lincolntech.edu')
) AS d(domain)
WHERE i.name = CASE 
    WHEN d.domain = 'harvard.edu' THEN 'Harvard University'
    WHEN d.domain = 'stanford.edu' THEN 'Stanford University'
    WHEN d.domain = 'mit.edu' THEN 'MIT'
    WHEN d.domain = 'yale.edu' THEN 'Yale University'
    WHEN d.domain = 'princeton.edu' THEN 'Princeton University'
    WHEN d.domain = 'columbia.edu' THEN 'Columbia University'
    WHEN d.domain = 'berkeley.edu' THEN 'University of California Berkeley'
    WHEN d.domain = 'umich.edu' THEN 'University of Michigan'
    WHEN d.domain = 'nyu.edu' THEN 'New York University'
    WHEN d.domain = 'asu.edu' THEN 'Arizona State University'
    WHEN d.domain = 'ccdenver.edu' THEN 'Community College of Denver'
    WHEN d.domain = 'bhc.edu' THEN 'Bunker Hill Community College'
    WHEN d.domain = 'tstc.edu' THEN 'Texas State Technical College'
    WHEN d.domain = 'lincolntech.edu' THEN 'Lincoln Technical Institute'
END
ON CONFLICT DO NOTHING;
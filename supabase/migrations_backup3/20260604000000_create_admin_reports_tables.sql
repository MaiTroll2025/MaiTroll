-- Create admin_reports table for staff/admin reports
-- Used by CEO Assistant Dashboard, Noah Assistant Dashboard, and Agency HR Dashboard

CREATE TABLE IF NOT EXISTS public.admin_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID,
    title TEXT NOT NULL,
    description TEXT,
    details JSONB,
    category VARCHAR(50),
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

CREATE TABLE IF NOT EXISTS public.agency_admin_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    details JSONB,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
    submitted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

ALTER TABLE public.admin_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_admin_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all admin reports" ON public.admin_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator') OR user_profiles.is_admin = true)
        )
    );

CREATE POLICY "Admins can create admin reports" ON public.admin_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator', 'troll_officer', 'secretary', 'lead_troll_officer') OR user_profiles.is_admin = true)
        )
    );

CREATE POLICY "Admins can update admin reports" ON public.admin_reports
    FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator') OR user_profiles.is_admin = true)
        )
    );

CREATE POLICY "Agency admins can view agency reports" ON public.agency_admin_reports
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator') OR user_profiles.is_admin = true)
        )
    );

CREATE POLICY "Agency admins can create agency reports" ON public.agency_admin_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
            AND (user_profiles.role IN ('admin', 'moderator', 'troll_officer', 'secretary', 'lead_troll_officer') OR user_profiles.is_admin = true)
        )
    );

CREATE INDEX IF NOT EXISTS idx_admin_reports_status ON public.admin_reports(status);
CREATE INDEX IF NOT EXISTS idx_admin_reports_submitted_by ON public.admin_reports(submitted_by);
CREATE INDEX IF NOT EXISTS idx_admin_reports_created_at ON public.admin_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agency_admin_reports_status ON public.agency_admin_reports(status);
CREATE INDEX IF NOT EXISTS idx_agency_admin_reports_agency_id ON public.agency_admin_reports(agency_id);
CREATE INDEX IF NOT EXISTS idx_agency_admin_reports_created_at ON public.agency_admin_reports(created_at DESC);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_admin_reports_updated_at BEFORE UPDATE ON public.admin_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agency_admin_reports_updated_at BEFORE UPDATE ON public.agency_admin_reports
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- MAi School Privacy & FERPA Compliance Tables
-- Date: 2026-09-14
-- Phase 1: FERPA & Student Privacy

CREATE TABLE IF NOT EXISTS institution_privacy_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    ferpa_mode_enabled BOOLEAN NOT NULL DEFAULT true,
    restricted_mode BOOLEAN NOT NULL DEFAULT true,
    require_parental_consent BOOLEAN NOT NULL DEFAULT false,
    minor_age_threshold INTEGER NOT NULL DEFAULT 18,
    allow_student_opt_out BOOLEAN NOT NULL DEFAULT true,
    audit_data_access BOOLEAN NOT NULL DEFAULT true,
    require_annual_privacy_agreement BOOLEAN NOT NULL DEFAULT true,
    privacy_agreement_version TEXT NOT NULL DEFAULT '1.0',
    compliance_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(institution_id)
);

CREATE TABLE IF NOT EXISTS instructor_privacy_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    instructor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    agreement_version TEXT NOT NULL,
    status TEXT CHECK (status IN ('signed', 'pending', 'expired', 'declined')) NOT NULL DEFAULT 'pending',
    signed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    signed_ip TEXT,
    signed_user_agent TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(institution_id, instructor_user_id, agreement_version)
);

CREATE TABLE IF NOT EXISTS data_access_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    viewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    description TEXT,
    source TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inst_privacy_inst ON institution_privacy_settings(institution_id);
CREATE INDEX IF NOT EXISTS idx_instructor_privacy_inst ON instructor_privacy_agreements(institution_id);
CREATE INDEX IF NOT EXISTS idx_instructor_privacy_instructor ON instructor_privacy_agreements(instructor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_viewer ON data_access_audit_log(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_viewed ON data_access_audit_log(viewed_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_inst ON data_access_audit_log(institution_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON data_access_audit_log(created_at DESC);
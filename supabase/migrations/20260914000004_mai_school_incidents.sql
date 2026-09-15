-- MAi School Content Moderation & Liability Controls
-- Phase 2: School-scoped incident reporting and institutional rules.
-- Actual muting/takedown/stream control remains in the existing
-- moderation engine (career/mod roles). This layer lets instructors
-- report rule violations and maintain a school code of conduct.

CREATE TABLE IF NOT EXISTS school_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

    -- The instructor/staff member who filed the incident.
    reported_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- The student the incident is about (optional - some incidents are stream-only).
    target_student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- The stream the incident is about (optional).
    stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,

    -- Incident classification.
    incident_type TEXT CHECK (incident_type IN (
        'harassment', 'bullying', 'explicit_content', 'violence',
        'hate_speech', 'spam', 'impersonation', 'rule_violation',
        'other'
    )) NOT NULL DEFAULT 'other',

    -- Severity used for routing/priority.
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL DEFAULT 'medium',

    -- Free-form description from the reporting instructor.
    description TEXT NOT NULL,

    -- School rule(s) violated, if any (free text or rule id).
    rule_violated TEXT,

    -- Status within the school's own tracking (moderation engine has its own state).
    status TEXT CHECK (status IN ('open', 'under_review', 'escalated', 'resolved', 'closed')) NOT NULL DEFAULT 'open',

    -- Link to the moderation_reports row created by submit_report, if any.
    linked_report_id UUID REFERENCES moderation_reports(id) ON DELETE SET NULL,

    -- Resolution tracking.
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Per-institution code of conduct / rules set by staff.
CREATE TABLE IF NOT EXISTS school_institution_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

    -- Rule identifier, e.g. "SC-01".
    rule_code TEXT NOT NULL,

    -- Short title.
    title TEXT NOT NULL,

    -- Full rule text.
    description TEXT NOT NULL,

    -- Category for grouping.
    category TEXT CHECK (category IN (
        'conduct', 'broadcasting', 'financial', 'privacy', 'academic', 'other'
    )) NOT NULL DEFAULT 'conduct',

    -- Enforcement severity if violated.
    enforcement TEXT CHECK (enforcement IN ('warning', 'strike', 'suspension', 'expulsion')) NOT NULL DEFAULT 'warning',

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(institution_id, rule_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_school_incidents_institution ON school_incidents(institution_id);
CREATE INDEX IF NOT EXISTS idx_school_incidents_reporter ON school_incidents(reported_by_user_id);
CREATE INDEX IF NOT EXISTS idx_school_incidents_target ON school_incidents(target_student_id);
CREATE INDEX IF NOT EXISTS idx_school_incidents_stream ON school_incidents(stream_id);
CREATE INDEX IF NOT EXISTS idx_school_incidents_status ON school_incidents(status);
CREATE INDEX IF NOT EXISTS idx_school_incidents_severity ON school_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_school_incidents_created ON school_incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_school_rules_institution ON school_institution_rules(institution_id);
CREATE INDEX IF NOT EXISTS idx_school_rules_active ON school_institution_rules(institution_id, is_active);

COMMENT ON TABLE school_incidents IS 'School-scoped incident reports filed by instructors/staff for rule violations. Routes to moderation engine via linked_report_id.';
COMMENT ON TABLE school_institution_rules IS 'Per-institution code of conduct set by staff. Instructors reference these when filing incidents.';

-- MAi School Financial Transparency & Liability Protection
-- Phase 3: Student earnings tracking, institution financial logs,
-- and compliance reports for school legal review.

CREATE TABLE IF NOT EXISTS student_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

    -- Earnings source
    source_type TEXT CHECK (source_type IN (
        'tips', 'gifts', 'cashout', 'payout', 'ad_revenue', 'other'
    )) NOT NULL DEFAULT 'other',

    -- Amounts
    earnings_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    platform_fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Payout linkage
    payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,
    payout_request_id UUID REFERENCES payout_requests(id) ON DELETE SET NULL,

    -- Tax form tracking
    tax_form_generated BOOLEAN NOT NULL DEFAULT false,
    tax_form_type TEXT, -- e.g. '1099-NEC', '1099-MISC'
    tax_form_generated_at TIMESTAMPTZ,

    -- Period tracking for annual summaries
    earned_at TIMESTAMPTZ DEFAULT now(),
    fiscal_year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM earned_at)::int) STORED,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS institution_financial_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

    -- Transaction type
    transaction_type TEXT CHECK (transaction_type IN (
        'student_earnings_recorded', 'payout_processed', 'platform_fee',
        'institution_pool_contribution', 'tax_form_generated', 'compliance_audit'
    )) NOT NULL,

    -- Related entities
    student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    earnings_id UUID REFERENCES student_earnings(id) ON DELETE SET NULL,
    payout_id UUID REFERENCES payouts(id) ON DELETE SET NULL,

    -- Amounts
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    -- Staff who verified/recorded this
    verified_by_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Free-form notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,

    -- Report type
    report_type TEXT CHECK (report_type IN (
        'student_earnings_summary', 'tax_form_summary', 'financial_audit',
        'privacy_audit', 'moderation_incident_summary', 'full_compliance'
    )) NOT NULL,

    -- Report period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,

    -- Report content
    content_json JSONB NOT NULL DEFAULT '{}',
    summary_text TEXT,

-- Export tracking
    exported_at TIMESTAMPTZ,
    exported_format TEXT, -- e.g. 'csv', 'pdf', 'json'

    -- Who generated it
    generated_by_staff_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_student_earnings_student ON student_earnings(student_id);
CREATE INDEX IF NOT EXISTS idx_student_earnings_institution ON student_earnings(institution_id);
CREATE INDEX IF NOT EXISTS idx_student_earnings_payout ON student_earnings(payout_id);
CREATE INDEX IF NOT EXISTS idx_student_earnings_fiscal_year ON student_earnings(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_student_earnings_earned ON student_earnings(earned_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_financial_logs_institution ON institution_financial_logs(institution_id);
CREATE INDEX IF NOT EXISTS idx_inst_financial_logs_student ON institution_financial_logs(student_id);
CREATE INDEX IF NOT EXISTS idx_inst_financial_logs_created ON institution_financial_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_institution ON compliance_reports(institution_id);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_type ON compliance_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_compliance_reports_generated ON compliance_reports(generated_at DESC);

COMMENT ON TABLE student_earnings IS 'Per-student earnings records for financial transparency. 100% of tips go to the individual student; school has zero tax liability.';
COMMENT ON TABLE institution_financial_logs IS 'Institution-scoped financial transaction ledger verified by staff.';
COMMENT ON TABLE compliance_reports IS 'Generated compliance reports for school legal/finance review.';


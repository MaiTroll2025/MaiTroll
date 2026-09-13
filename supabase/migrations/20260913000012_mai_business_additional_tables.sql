-- Migration: MAI Business — Additional Tables
-- Creates business_plan_sections, faq_items, and funding_applications_ext
-- for standalone (non-program) funding applications.
-- All new tables use the mai_business_ prefix (internal naming preserved).

BEGIN;

-- =========================================================================
-- Business Plan Sections (per-section drafting for the builder UI)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_business_plan_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    title           TEXT,
    content         TEXT,
    status          TEXT NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'draft', 'review', 'approved')),
    order_index     INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- FAQ Items (Help Center)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_faq (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category        TEXT,
    question        TEXT NOT NULL,
    answer          TEXT NOT NULL,
    display_order   INTEGER NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Standalone Funding Applications (non-program specific)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_business_funding (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    funding_type    TEXT NOT NULL,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
    purpose         TEXT,
    business_plan_ref TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- RLS
-- =========================================================================
ALTER TABLE public.mai_business_business_plan_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_faq ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_business_funding ENABLE ROW LEVEL SECURITY;

-- Business plan sections: users manage own; instructors can comment/review
DROP POLICY IF EXISTS "users manage own plan sections" ON public.mai_business_business_plan_sections;
CREATE POLICY "users manage own plan sections"
  ON public.mai_business_business_plan_sections FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "instructors can review plan sections" ON public.mai_business_business_plan_sections;
CREATE POLICY "instructors can review plan sections"
  ON public.mai_business_business_plan_sections FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.mai_business_profiles mp
            WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

DROP POLICY IF EXISTS "admins can manage plan sections" ON public.mai_business_business_plan_sections;
CREATE POLICY "admins can manage plan sections"
  ON public.mai_business_business_plan_sections FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
  );

-- FAQ: authenticated read; admin/instructor write
DROP POLICY IF EXISTS "authenticated read faq" ON public.mai_business_faq;
CREATE POLICY "authenticated read faq"
  ON public.mai_business_faq FOR SELECT USING (
    auth.role() = 'authenticated' AND is_active = true);

DROP POLICY IF EXISTS "admins and instructors manage faq" ON public.mai_business_faq;
CREATE POLICY "admins and instructors manage faq"
  ON public.mai_business_faq FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.id = auth.uid()
            AND (p.is_admin OR p.role IN ('admin','superadmin','ceo','owner')))
    OR EXISTS (SELECT 1 FROM public.mai_business_profiles mp
               WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- Business funding (standalone): users manage own; admins/instructors review
DROP POLICY IF EXISTS "users manage own funding" ON public.mai_business_business_funding;
CREATE POLICY "users manage own funding"
  ON public.mai_business_business_funding FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "instructors can review funding applications" ON public.mai_business_business_funding;
CREATE POLICY "instructors can review funding applications"
  ON public.mai_business_business_funding FOR ALL USING (
    EXISTS (SELECT 1 FROM public.mai_business_profiles mp
            WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor')
  );

-- =========================================================================
-- Triggers
-- =========================================================================
CREATE TRIGGER trg_mai_business_plan_sections_updated
    BEFORE UPDATE ON public.mai_business_business_plan_sections
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_business_funding_updated
    BEFORE UPDATE ON public.mai_business_business_funding
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

-- =========================================================================
-- Indexes
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_mai_bs_plan_sections_user ON public.mai_business_business_plan_sections(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_bs_plan_sections_type ON public.mai_business_business_plan_sections(type);
CREATE INDEX IF NOT EXISTS idx_mai_bs_plan_sections_order ON public.mai_business_business_plan_sections(order_index);
CREATE INDEX IF NOT EXISTS idx_mai_bs_plan_sections_section ON public.mai_business_business_plan_sections(user_id, type);

CREATE INDEX IF NOT EXISTS idx_mai_bs_faq_category ON public.mai_business_faq(category);
CREATE INDEX IF NOT EXISTS idx_mai_bs_faq_order ON public.mai_business_faq(display_order);
CREATE INDEX IF NOT EXISTS idx_mai_bs_faq_active ON public.mai_business_faq(is_active);

CREATE INDEX IF NOT EXISTS idx_mai_bs_funding_user ON public.mai_business_business_funding(user_id);
CREATE INDEX IF NOT EXISTS idx_mai_bs_funding_status ON public.mai_business_business_funding(status);

COMMIT;

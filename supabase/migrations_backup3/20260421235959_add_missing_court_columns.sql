-- Add missing columns to court_cases table for comprehensive case details
-- Migration: 20260421235959_add_missing_court_columns.sql

DO $$
BEGIN
    -- case_number: Unique identifier for the case (e.g., "CV-2026-001")
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'case_number'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN case_number TEXT;
    END IF;

    -- title: Short title/summary of the case
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'title'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN title TEXT;
    END IF;

    -- description: Detailed description of the complaint/charges
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN description TEXT;
    END IF;

    -- filing_date: Date when the case was filed
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'filing_date'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN filing_date DATE;
    END IF;

    -- court_date: Date scheduled for court hearing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'court_date'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN court_date DATE;
    END IF;

    -- evidence_url: Link to evidence submitted
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'evidence_url'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN evidence_url TEXT;
    END IF;

    -- category: Category of case (e.g., "Debt / Unpaid Loan", "Scam / Fraud")
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'category'
    ) THEN
        ALTER TABLE public.court_cases ADD COLUMN category TEXT;
    END IF;

    -- prosecutor_id: Reference to the assigned prosecutor (optional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'court_cases' AND column_name = 'prosecutor_id'
    ) THEN
        ALTER TABLE public.court_cases 
        ADD COLUMN prosecutor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';

SELECT 'Added missing court_cases columns' AS result;

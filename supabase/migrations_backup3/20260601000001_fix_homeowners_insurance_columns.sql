-- Migration: Add missing columns to homeowners_insurances table
-- The onboarding flow inserts these columns but they don't exist in the table

ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS plan_id TEXT;
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS coverage_type TEXT DEFAULT 'basic';
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS cost_paid INTEGER DEFAULT 0;
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS deductible INTEGER DEFAULT 25;
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS duration_hours INTEGER DEFAULT 720;
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMPTZ;
ALTER TABLE homeowners_insurances ADD COLUMN IF NOT EXISTS claims_made INTEGER DEFAULT 0;

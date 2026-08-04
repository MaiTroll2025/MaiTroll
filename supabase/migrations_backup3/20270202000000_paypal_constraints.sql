-- Migration: Add PayPal unique constraints and indexes
-- Date: 2026-02-02
-- Purpose: Add unique constraints and performance indexes to PayPal-related tables

-- ============================================
-- SECTION 1: Cleanup - Identify duplicates
-- ============================================

-- Check for duplicates in paypal_transactions (on paypal_order_id)
-- This table already has UNIQUE on paypal_order_id, but let's verify
DO $$
BEGIN
    RAISE NOTICE 'Checking paypal_transactions for duplicates...';
    
    -- Count duplicates
    PERFORM COUNT(*) 
    FROM (
        SELECT paypal_order_id, COUNT(*) as cnt
        FROM paypal_transactions
        GROUP BY paypal_order_id
        HAVING COUNT(*) > 1
    ) duplicates;
END $$;

-- Check for duplicates in payouts table (on paypal_batch_id)
-- Note: The payouts table may have NULL values, handle accordingly
DO $$
DECLARE
    v_dup_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_dup_count
    FROM (
        SELECT paypal_batch_id, COUNT(*) as cnt
        FROM payouts
        WHERE paypal_batch_id IS NOT NULL
        GROUP BY paypal_batch_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Found % duplicate payout_batch_id values in payouts table', v_dup_count;
END $$;

-- ============================================
-- SECTION 2: paypal_transactions table
-- ============================================

-- The paypal_transactions table already has UNIQUE on paypal_order_id
-- We need to add:
-- - UNIQUE on paypal_capture_id (if not already unique)
-- - INDEX on user_id
-- - INDEX on status
-- - INDEX on created_at

-- First, drop existing indexes if they exist (idempotent)
DROP INDEX IF EXISTS idx_paypal_transactions_user_id;
DROP INDEX IF EXISTS idx_paypal_transactions_status;
DROP INDEX IF EXISTS idx_paypal_transactions_created_at;

-- Add UNIQUE constraint on paypal_capture_id (only if not NULL and not duplicate)
-- Using a partial unique index for non-null values
DO $$
BEGIN
    -- Check if paypal_capture_id has duplicates
    IF EXISTS (
        SELECT 1
        FROM paypal_transactions
        WHERE paypal_capture_id IS NOT NULL
        GROUP BY paypal_capture_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE WARNING 'Duplicates found in paypal_capture_id, skipping UNIQUE constraint';
    ELSE
        -- Create unique index on non-null paypal_capture_id values
        CREATE UNIQUE INDEX IF NOT EXISTS uk_paypal_capture_id 
        ON paypal_transactions(paypal_capture_id) 
        WHERE paypal_capture_id IS NOT NULL;
    END IF;
END $$;

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_paypal_transactions_user_id 
ON paypal_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_paypal_transactions_status 
ON paypal_transactions(status);

CREATE INDEX IF NOT EXISTS idx_paypal_transactions_created_at 
ON paypal_transactions(created_at);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_paypal_transactions_user_status_created 
ON paypal_transactions(user_id, status, created_at DESC);

-- ============================================
-- SECTION 3: payouts table (paypal_payouts equivalent)
-- ============================================

-- Add UNIQUE constraint on payout_batch_id
-- First, clean up any NULL values
UPDATE payouts SET payout_batch_id = gen_random_uuid()::text WHERE payout_batch_id IS NULL;

-- Drop existing indexes
DROP INDEX IF EXISTS idx_payouts_paypal_batch_id;
DROP INDEX IF EXISTS idx_payouts_user_id;
DROP INDEX IF EXISTS idx_payouts_status;
DROP INDEX IF EXISTS idx_payouts_created_at;

-- Add UNIQUE constraint on paypal_batch_id
-- Note: Multiple payouts can share the same batch_id (same PayPal batch)
-- So we don't add a UNIQUE constraint on paypal_batch_id alone
-- Instead, we add UNIQUE on paypal_payout_item_id which is unique per PayPal item

DO $$
BEGIN
    -- Check if paypal_payout_item_id has duplicates
    IF EXISTS (
        SELECT 1
        FROM payouts
        WHERE paypal_payout_item_id IS NOT NULL
        GROUP BY paypal_payout_item_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE WARNING 'Duplicates found in paypal_payout_item_id, skipping UNIQUE constraint';
    ELSE
        -- Create unique index on non-null paypal_payout_item_id values
        CREATE UNIQUE INDEX IF NOT EXISTS uk_paypal_payout_item_id 
        ON payouts(paypal_payout_item_id) 
        WHERE paypal_payout_item_id IS NOT NULL;
    END IF;
END $$;

-- Add UNIQUE constraint on transaction_id (local reference)
-- This is typically the run_id or a local reference
-- Since payouts already has CONSTRAINT unique_run_user UNIQUE (run_id, user_id),
-- we don't need an additional unique constraint on transaction_id

-- Add performance indexes
CREATE INDEX IF NOT EXISTS idx_payouts_paypal_batch_id 
ON payouts(paypal_batch_id);

CREATE INDEX IF NOT EXISTS idx_payouts_user_id 
ON payouts(user_id);

CREATE INDEX IF NOT EXISTS idx_payouts_status 
ON payouts(status);

CREATE INDEX IF NOT EXISTS idx_payouts_created_at 
ON payouts(created_at);

CREATE INDEX IF NOT EXISTS idx_payouts_run_id 
ON payouts(run_id);

-- Composite index for payout processing queries
CREATE INDEX IF NOT EXISTS idx_payouts_status_created 
ON payouts(status, created_at DESC);

-- Index for admin payout report queries
CREATE INDEX IF NOT EXISTS idx_payouts_user_status 
ON payouts(user_id, status);

-- ============================================
-- SECTION 4: payout_runs table
-- ============================================

-- Add performance indexes for payout runs
DROP INDEX IF EXISTS idx_payout_runs_status;
DROP INDEX IF EXISTS idx_payout_runs_run_date;

CREATE INDEX IF NOT EXISTS idx_payout_runs_status 
ON payout_runs(status);

CREATE INDEX IF NOT EXISTS idx_payout_runs_run_date 
ON payout_runs(run_date DESC);

CREATE INDEX IF NOT EXISTS idx_payout_runs_paypal_batch_id 
ON payout_runs(paypal_batch_id) WHERE paypal_batch_id IS NOT NULL;

-- ============================================
-- SECTION 5: user_profiles PayPal email index
-- ============================================

-- Add index on payout_paypal_email for faster lookups
DROP INDEX IF EXISTS idx_user_profiles_payout_paypal_email;

CREATE INDEX IF NOT EXISTS idx_user_profiles_payout_paypal_email 
ON user_profiles(payout_paypal_email) 
WHERE payout_paypal_email IS NOT NULL;

-- ============================================
-- SECTION 6: Rollback Instructions
-- ============================================

-- To rollback this migration, run the following commands:
-- 
-- -- Drop indexes from paypal_transactions
-- DROP INDEX IF EXISTS idx_paypal_transactions_user_id;
-- DROP INDEX IF EXISTS idx_paypal_transactions_status;
-- DROP INDEX IF EXISTS idx_paypal_transactions_created_at;
-- DROP INDEX IF EXISTS idx_paypal_transactions_user_status_created;
-- DROP INDEX IF EXISTS uk_paypal_capture_id;
-- 
-- -- Drop indexes from payouts
-- DROP INDEX IF EXISTS idx_payouts_paypal_batch_id;
-- DROP INDEX IF EXISTS idx_payouts_user_id;
-- DROP INDEX IF EXISTS idx_payouts_status;
-- DROP INDEX IF EXISTS idx_payouts_created_at;
-- DROP INDEX IF EXISTS idx_payouts_run_id;
-- DROP INDEX IF EXISTS idx_payouts_status_created;
-- DROP INDEX IF EXISTS idx_payouts_user_status;
-- DROP INDEX IF EXISTS uk_paypal_payout_item_id;
-- 
-- -- Drop indexes from payout_runs
-- DROP INDEX IF EXISTS idx_payout_runs_status;
-- DROP INDEX IF EXISTS idx_payout_runs_run_date;
-- DROP INDEX IF EXISTS idx_payout_runs_paypal_batch_id;
-- 
-- -- Drop index from user_profiles
-- DROP INDEX IF EXISTS idx_user_profiles_payout_paypal_email;

-- ============================================
-- Verification Query (for documentation)
-- ============================================

-- Run this to verify the migration:
-- SELECT 
--     'paypal_transactions' as table_name,
--     COUNT(*) as total_rows,
--     COUNT(DISTINCT paypal_order_id) as unique_order_id,
--     COUNT(DISTINCT paypal_capture_id) as unique_capture_id
-- FROM paypal_transactions
-- UNION ALL
-- SELECT 
--     'payouts' as table_name,
--     COUNT(*) as total_rows,
--     COUNT(DISTINCT paypal_batch_id) as unique_batch_id,
--     COUNT(DISTINCT paypal_payout_item_id) as unique_item_id
-- FROM payouts;

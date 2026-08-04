-- Migration: Add reason and metadata columns to role_change_log
-- Fixes: column "reason" of relation "role_change_log" does not exist

ALTER TABLE public.role_change_log
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

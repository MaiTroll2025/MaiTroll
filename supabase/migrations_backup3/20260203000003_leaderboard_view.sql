-- Migration 20260203000003_leaderboard_view.sql
-- This migration is superseded by 20260203000004_fix_gift_schema.sql
-- which drops and recreates the broadcaster_stats table/view.
-- Making this a no-op to avoid conflicts during history replay.

SELECT 1;

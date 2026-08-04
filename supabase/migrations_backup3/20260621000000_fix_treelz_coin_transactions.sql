-- Fix: Add missing related_post_id column to coin_transactions
-- The send_treelz_tip RPC function references this column but it doesn't exist yet.

ALTER TABLE coin_transactions
  ADD COLUMN IF NOT EXISTS related_post_id UUID;

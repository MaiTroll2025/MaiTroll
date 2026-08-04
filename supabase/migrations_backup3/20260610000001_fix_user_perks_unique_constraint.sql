-- Fix user_perks unique constraint that causes duplicate key violations
-- The constraint UNIQUE (user_id, perk_id, purchased_at) is too restrictive:
-- 1. NOW() returns transaction-level timestamp, so multiple inserts in the same
--    transaction get identical purchased_at values.
-- 2. Users should be allowed to purchase the same perk multiple times.
-- The primary key (id) already prevents true duplicate rows.

ALTER TABLE public.user_perks
  DROP CONSTRAINT IF EXISTS user_perks_user_id_perk_id_purchased_at_key;

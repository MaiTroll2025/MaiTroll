-- Drop the restrictive check constraint on gift_type
-- It is likely outdated and prevents new or dynamic gifts (like 'troll-laugh' or catalog items) from being sent.
ALTER TABLE public.troll_wall_gifts
DROP CONSTRAINT IF EXISTS troll_wall_gifts_gift_type_check;

-- Optionally, we can add a check that it's just not empty, but dropping it is safest for dynamic gifts.
-- The application logic (send_wall_post_gift) already validates against the 'gifts' or 'gift_items' table.

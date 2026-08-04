-- Fix duplicate neighborhoods per leader and enforce uniqueness

BEGIN;

-- 1. Identify primary neighborhood per leader (most recent)
-- and collect duplicates
WITH primary_nb AS (
  SELECT DISTINCT ON (leader_user_id) id AS keep_id, leader_user_id
  FROM public.neighborhoods
  ORDER BY leader_user_id, created_at DESC, id DESC
),
duplicate_nb AS (
  SELECT n.id AS dup_id, n.leader_user_id
  FROM public.neighborhoods n
  JOIN primary_nb pn ON n.leader_user_id = pn.leader_user_id
  WHERE n.id != pn.keep_id
)

-- 2. Reassign neighborhood_members from duplicates to primary
UPDATE public.neighborhood_members nm
SET neighborhood_id = pn.keep_id
FROM duplicate_nb dn
JOIN primary_nb pn ON dn.leader_user_id = pn.leader_user_id
WHERE nm.neighborhood_id = dn.dup_id;

-- 3. Reassign houses from duplicates to primary
UPDATE public.houses h
SET neighborhood_id = pn.keep_id
FROM duplicate_nb dn
JOIN primary_nb pn ON dn.leader_user_id = pn.leader_user_id
WHERE h.neighborhood_id = dn.dup_id;

-- 4. Delete duplicate neighborhoods
DELETE FROM public.neighborhoods n
USING duplicate_nb dn
WHERE n.id = dn.dup_id;

-- 5. Add unique constraint to prevent future duplicates
ALTER TABLE public.neighborhoods
  ADD CONSTRAINT neighborhoods_leader_user_id_key UNIQUE (leader_user_id);

COMMIT;

-- Dedupe conversation_members and prevent future duplicates

-- 1) Remove duplicate rows (keep earliest joined_at)
WITH ranked AS (
  SELECT
    ctid,
    conversation_id,
    user_id,
    row_number() OVER (
      PARTITION BY conversation_id, user_id
      ORDER BY joined_at ASC
    ) AS rn
  FROM public.conversation_members
)
DELETE FROM public.conversation_members cm
USING ranked r
WHERE cm.ctid = r.ctid
  AND r.rn > 1;

-- 2) Enforce uniqueness going forward
CREATE UNIQUE INDEX IF NOT EXISTS conversation_members_conversation_id_user_id_key
  ON public.conversation_members (conversation_id, user_id);

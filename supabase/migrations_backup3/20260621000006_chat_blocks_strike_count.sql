-- Add explicit strike tracking to chat_blocks and the unique constraint required by
-- moderator_disable_chat upserts.

ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS strike_count integer NOT NULL DEFAULT 1;

ALTER TABLE public.chat_blocks
  ADD COLUMN IF NOT EXISTS is_permanent boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.chat_blocks'::regclass
      AND conname = 'chat_blocks_stream_user_unique'
  ) THEN
    ALTER TABLE public.chat_blocks
      ADD CONSTRAINT chat_blocks_stream_user_unique
      UNIQUE (stream_id, user_id);
  END IF;
END$$;

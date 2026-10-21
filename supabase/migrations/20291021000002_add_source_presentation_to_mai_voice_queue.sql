-- The Mai Voice queue needs to remember how a chat message was presented so the
-- playback can follow the original chat style (regular chat vs. flying chat).
--
-- The deployed database was created from an earlier revision of
-- 20291021000000_mai_voice_system.sql that did not include this column, so
-- every insert into public.mai_voice_queue failed with
-- "column mai_voice_queue.source_presentation does not exist".
--
-- The edge function retries such inserts without the column, so the feature
-- works either way; this migration makes the value persist.

ALTER TABLE public.mai_voice_queue
  ADD COLUMN IF NOT EXISTS source_presentation TEXT;

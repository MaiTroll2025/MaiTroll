-- ============================================================================
-- Mai Troll — Stop auto-posting "stream ended" wall posts
-- ============================================================================
-- The auto_post_stream_ended() trigger created a troll_wall_posts entry
-- ("...'s stream has ended. Watch the replay!") every time a stream ended.
-- We now only keep the single "is now LIVE" announcement, so the ended
-- wall post is no longer needed. Drop the trigger and the function.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_auto_post_stream_ended ON public.streams;
DROP FUNCTION IF EXISTS public.auto_post_stream_ended();

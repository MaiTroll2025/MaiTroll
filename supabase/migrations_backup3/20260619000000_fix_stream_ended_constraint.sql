-- ============================================================================
-- Mai Troll — Fix troll_wall_posts post_type check constraint
-- Bug #1: The auto_post_stream_ended() function inserts 'stream_ended' post_type
-- but the check constraint only allows: text, stream_announce, battle_result,
-- family_announce, badge_earned, system
-- This migration adds 'stream_ended' and 'stream_highlight' to the allowed types.
-- ============================================================================

ALTER TABLE IF EXISTS public.troll_wall_posts
  DROP CONSTRAINT IF EXISTS troll_wall_posts_post_type_check;

ALTER TABLE IF EXISTS public.troll_wall_posts
  ADD CONSTRAINT troll_wall_posts_post_type_check
  CHECK (post_type = ANY(ARRAY[
    'text'::text,
    'stream_announce'::text,
    'battle_result'::text,
    'family_announce'::text,
    'badge_earned'::text,
    'system'::text,
    'stream_ended'::text,
    'stream_highlight'::text
  ]));

COMMENT ON CONSTRAINT troll_wall_posts_post_type_check ON public.troll_wall_posts IS
  'Allowed post types: text, stream_announce, battle_result, family_announce, badge_earned, system, stream_ended, stream_highlight';

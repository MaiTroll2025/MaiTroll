-- =============================================================================
-- MIGRATION: Create MAIPiks system (PHONE-ONLY)
-- =============================================================================
-- Creates tables, storage bucket notes, and RLS for the MAIPiks feature:
--   - maipiks_posts (feed content)
--   - maipiks_stories (story containers)
--   - maipiks_story_items (story media items)
--   - maipiks_story_views (view tracking)
--   - maipiks_story_screenshots (screenshot tracking)
--   - screenshots_allowed on user_profiles
-- =============================================================================

BEGIN;

-- =============================================================================
-- PART 1: Screenshots setting on user_profiles
-- =============================================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS screenshots_allowed BOOLEAN DEFAULT TRUE;

-- =============================================================================
-- PART 2: MAIPiks feed posts
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maipiks_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
    thumbnail_url TEXT,
    caption TEXT,
    visibility TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'followers', 'private')),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maipiks_posts_user_id ON public.maipiks_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_posts_created_at ON public.maipiks_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maipiks_posts_visibility ON public.maipiks_posts(visibility);

-- =============================================================================
-- PART 3: MAIPiks stories
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maipiks_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    visibility TEXT NOT NULL DEFAULT 'everyone' CHECK (visibility IN ('everyone', 'followers', 'private')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maipiks_stories_user_id ON public.maipiks_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_stories_expires_at ON public.maipiks_stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_maipiks_stories_visibility ON public.maipiks_stories(visibility);

-- =============================================================================
-- PART 4: MAIPiks story items
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maipiks_story_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL REFERENCES public.maipiks_stories(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
    thumbnail_url TEXT,
    caption TEXT,
    duration_ms INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_maipiks_story_items_story_id ON public.maipiks_story_items(story_id);

-- =============================================================================
-- PART 5: MAIPiks story views
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maipiks_story_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_item_id UUID NOT NULL REFERENCES public.maipiks_story_items(id) ON DELETE CASCADE,
    viewer_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    view_count INTEGER NOT NULL DEFAULT 1,
    UNIQUE(story_item_id, viewer_user_id)
);

CREATE INDEX IF NOT EXISTS idx_maipiks_story_views_item ON public.maipiks_story_views(story_item_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_story_views_viewer ON public.maipiks_story_views(viewer_user_id);

-- =============================================================================
-- PART 6: MAIPiks story screenshots
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.maipiks_story_screenshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_item_id UUID NOT NULL REFERENCES public.maipiks_story_items(id) ON DELETE CASCADE,
    screenshotter_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(story_item_id, screenshotter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_maipiks_screenshots_item ON public.maipiks_story_screenshots(story_item_id);
CREATE INDEX IF NOT EXISTS idx_maipiks_screenshots_user ON public.maipiks_story_screenshots(screenshotter_user_id);

-- =============================================================================
-- PART 7: RLS policies
-- =============================================================================

ALTER TABLE public.maipiks_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maipiks_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maipiks_story_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maipiks_story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maipiks_story_screenshots ENABLE ROW LEVEL SECURITY;

-- Posts: owner can manage own; viewers can read eligible public/follower posts
DROP POLICY IF EXISTS "maipiks_posts_owner_write" ON public.maipiks_posts;
CREATE POLICY "maipiks_posts_owner_write" ON public.maipiks_posts
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "maipiks_posts_view" ON public.maipiks_posts;
CREATE POLICY "maipiks_posts_view" ON public.maipiks_posts
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      visibility = 'everyone'
      OR visibility = 'followers' AND EXISTS (
        SELECT 1 FROM public.user_follows
        WHERE follower_id = auth.uid() AND following_id = maipiks_posts.user_id
      )
      OR visibility = 'private' AND EXISTS (
        SELECT 1 FROM public.user_subscriptions
        WHERE subscriber_id = auth.uid() AND broadcaster_id = maipiks_posts.user_id AND is_active = true
      )
    )
  );

-- Stories: owner can manage own; viewers can read eligible active stories
DROP POLICY IF EXISTS "maipiks_stories_owner_write" ON public.maipiks_stories;
CREATE POLICY "maipiks_stories_owner_write" ON public.maipiks_stories
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "maipiks_stories_view" ON public.maipiks_stories;
CREATE POLICY "maipiks_stories_view" ON public.maipiks_stories
  FOR SELECT USING (
    auth.uid() = user_id
    OR (
      deleted_at IS NULL
      AND expires_at > NOW()
      AND (
        visibility = 'everyone'
        OR visibility = 'followers' AND EXISTS (
          SELECT 1 FROM public.user_follows
          WHERE follower_id = auth.uid() AND following_id = maipiks_stories.user_id
        )
        OR visibility = 'private' AND EXISTS (
          SELECT 1 FROM public.user_subscriptions
          WHERE subscriber_id = auth.uid() AND broadcaster_id = maipiks_stories.user_id AND is_active = true
        )
      )
    )
  );

-- Story items: readable with parent story
DROP POLICY IF EXISTS "maipiks_story_items_read" ON public.maipiks_story_items;
CREATE POLICY "maipiks_story_items_read" ON public.maipiks_story_items
  FOR SELECT USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.maipiks_stories s
      WHERE s.id = maipiks_story_items.story_id
      AND s.deleted_at IS NULL
      AND s.expires_at > NOW()
      AND (
        s.user_id = auth.uid()
        OR s.visibility = 'everyone'
        OR s.visibility = 'followers' AND EXISTS (
          SELECT 1 FROM public.user_follows
          WHERE follower_id = auth.uid() AND following_id = s.user_id
        )
        OR s.visibility = 'private' AND EXISTS (
          SELECT 1 FROM public.user_subscriptions
          WHERE subscriber_id = auth.uid() AND broadcaster_id = s.user_id AND is_active = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "maipiks_story_items_owner_write" ON public.maipiks_story_items;
CREATE POLICY "maipiks_story_items_owner_write" ON public.maipiks_story_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.maipiks_stories WHERE id = story_id AND user_id = auth.uid()
    )
  );

-- Story views: viewer can insert/update own views; story owner can read views
DROP POLICY IF EXISTS "maipiks_story_views_insert_own" ON public.maipiks_story_views;
CREATE POLICY "maipiks_story_views_insert_own" ON public.maipiks_story_views
  FOR INSERT WITH CHECK (auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "maipiks_story_views_update_own" ON public.maipiks_story_views;
CREATE POLICY "maipiks_story_views_update_own" ON public.maipiks_story_views
  FOR UPDATE USING (auth.uid() = viewer_user_id);

DROP POLICY IF EXISTS "maipiks_story_views_read_owner" ON public.maipiks_story_views;
CREATE POLICY "maipiks_story_views_read_owner" ON public.maipiks_story_views
  FOR SELECT USING (
    auth.uid() = viewer_user_id
    OR EXISTS (
      SELECT 1 FROM public.maipiks_story_items i
      JOIN public.maipiks_stories s ON s.id = i.story_id
      WHERE i.id = maipiks_story_views.story_item_id AND s.user_id = auth.uid()
    )
  );

-- Screenshots: screenshotter owns record; story owner can read
DROP POLICY IF EXISTS "maipiks_screenshots_insert_own" ON public.maipiks_story_screenshots;
CREATE POLICY "maipiks_screenshots_insert_own" ON public.maipiks_story_screenshots
  FOR INSERT WITH CHECK (auth.uid() = screenshotter_user_id);

DROP POLICY IF EXISTS "maipiks_screenshots_read_owner" ON public.maipiks_story_screenshots;
CREATE POLICY "maipiks_screenshots_read_owner" ON public.maipiks_story_screenshots
  FOR SELECT USING (
    auth.uid() = screenshotter_user_id
    OR EXISTS (
      SELECT 1 FROM public.maipiks_story_items i
      JOIN public.maipiks_stories s ON s.id = i.story_id
      WHERE i.id = maipiks_story_screenshots.story_item_id AND s.user_id = auth.uid()
    )
  );

-- =============================================================================
-- PART 8: Storage bucket
-- =============================================================================
--
-- IMPORTANT: Storage bucket and RLS must be created manually in the
-- Supabase Dashboard because `storage.buckets` and `storage.objects` are
-- owned by Supabase's internal role. Regular migration users cannot
-- INSERT into storage.buckets or ALTER storage.objects.
--
-- Manual steps in Supabase Dashboard → Storage:
--
-- 1. Create a new private bucket named `maipiks`.
--    - Public: OFF
--    - File size limit: 50 MB
--    - Allowed MIME types: image/jpeg, image/png, image/webp, video/mp4, video/webm
--
-- 2. Under Storage → maipiks → Policies, add these RLS policies:
--
--    INSERT (upload):
--      bucket_id = 'maipiks'
--      AND auth.uid()::text = (storage.foldername(name))[1]
--
--    SELECT (read):
--      bucket_id = 'maipiks'
--      AND auth.uid()::text = (storage.foldername(name))[1]
--
--    UPDATE:
--      bucket_id = 'maipiks'
--      AND auth.uid()::text = (storage.foldername(name))[1]
--
--    DELETE:
--      bucket_id = 'maipiks'
--      AND auth.uid()::text = (storage.foldername(name))[1]
--
-- This ensures only the bucket owner can manage their own files.
-- =============================================================================

COMMIT;

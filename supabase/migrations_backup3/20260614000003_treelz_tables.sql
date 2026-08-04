-- Treelz Tables
-- Video length: min 15s, default 3min, max 10min
-- Upload size: 250MB max

CREATE TABLE IF NOT EXISTS treelz_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT DEFAULT '',
  video_duration_seconds INTEGER DEFAULT 0,
  video_size_bytes BIGINT DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  saves_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  watch_time_seconds BIGINT DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  gifts_received INTEGER DEFAULT 0,
  coins_received BIGINT DEFAULT 0,
  is_ai_flagged BOOLEAN DEFAULT false,
  ai_detection_score NUMERIC(5,2) DEFAULT 0,
  ai_review_status TEXT DEFAULT 'pending' CHECK (ai_review_status IN ('pending', 'reviewed', 'cleared', 'actioned')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'removed', 'age_restricted')),
  is_featured BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  is_boosted BOOLEAN DEFAULT false,
  boost_expires_at TIMESTAMP WITH TIME ZONE,
  is_live_promotion BOOLEAN DEFAULT false,
  live_stream_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treelz_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES treelz_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS treelz_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES treelz_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treelz_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES treelz_posts(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treelz_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES treelz_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE TABLE IF NOT EXISTS treelz_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES treelz_posts(id) ON DELETE CASCADE,
  platform TEXT DEFAULT 'copy_link',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS treelz_ai_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES treelz_posts(id) ON DELETE CASCADE,
  flagged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confidence NUMERIC(5,2) NOT NULL,
  action_taken TEXT DEFAULT 'pending' CHECK (action_taken IN ('pending', 'cleared', 'removed', 'age_restricted')),
  reviewed_by UUID REFERENCES user_profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS treelz_upload_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  banned_until TIMESTAMP WITH TIME ZONE,
  strike_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add treelz_uploads_enabled to user_profiles if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'treelz_uploads_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN treelz_uploads_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS treelz_posts_user_idx ON treelz_posts(user_id);
CREATE INDEX IF NOT EXISTS treelz_posts_status_idx ON treelz_posts(status);
CREATE INDEX IF NOT EXISTS treelz_posts_featured_idx ON treelz_posts(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS treelz_posts_created_idx ON treelz_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS treelz_likes_post_idx ON treelz_likes(post_id);
CREATE INDEX IF NOT EXISTS treelz_likes_user_post_idx ON treelz_likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS treelz_comments_post_idx ON treelz_comments(post_id);
CREATE INDEX IF NOT EXISTS treelz_tips_post_idx ON treelz_tips(post_id);
CREATE INDEX IF NOT EXISTS treelz_tips_to_user_idx ON treelz_tips(to_user_id);
CREATE INDEX IF NOT EXISTS treelz_saves_user_idx ON treelz_saves(user_id);
CREATE INDEX IF NOT EXISTS treelz_ai_flags_post_idx ON treelz_ai_flags(post_id);
CREATE INDEX IF NOT EXISTS treelz_ai_flags_status_idx ON treelz_ai_flags(action_taken);
CREATE INDEX IF NOT EXISTS treelz_upload_bans_user_idx ON treelz_upload_bans(user_id);

-- Enable RLS
ALTER TABLE treelz_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_ai_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE treelz_upload_bans ENABLE ROW LEVEL SECURITY;

-- Add missing columns to moderation_actions if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'moderation_actions' AND column_name = 'target_post_id'
  ) THEN
    ALTER TABLE moderation_actions ADD COLUMN target_post_id UUID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'moderation_actions' AND column_name = 'target_type'
  ) THEN
    ALTER TABLE moderation_actions ADD COLUMN target_type TEXT DEFAULT 'user';
  END IF;
END $$;

-- Storage bucket for treelz videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('treelz-videos', 'treelz-videos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "treelz_videos_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'treelz-videos');

CREATE POLICY "treelz_videos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'treelz-videos' AND auth.uid() IS NOT NULL);

CREATE POLICY "treelz_videos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'treelz-videos' AND auth.uid() IS NOT NULL);

-- RLS Policies: treelz_posts
CREATE POLICY "treelz_posts_select" ON treelz_posts
  FOR SELECT USING (status = 'active' OR user_id = auth.uid());

CREATE POLICY "treelz_posts_insert" ON treelz_posts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "treelz_posts_update" ON treelz_posts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "treelz_posts_delete" ON treelz_posts
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: treelz_likes
CREATE POLICY "treelz_likes_select" ON treelz_likes FOR SELECT USING (true);
CREATE POLICY "treelz_likes_insert" ON treelz_likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "treelz_likes_delete" ON treelz_likes FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: treelz_comments
CREATE POLICY "treelz_comments_select" ON treelz_comments FOR SELECT USING (true);
CREATE POLICY "treelz_comments_insert" ON treelz_comments FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "treelz_comments_delete" ON treelz_comments FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: treelz_tips
CREATE POLICY "treelz_tips_select" ON treelz_tips FOR SELECT USING (true);
CREATE POLICY "treelz_tips_insert" ON treelz_tips FOR INSERT WITH CHECK (from_user_id = auth.uid());

-- RLS Policies: treelz_saves
CREATE POLICY "treelz_saves_select" ON treelz_saves FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "treelz_saves_insert" ON treelz_saves FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "treelz_saves_delete" ON treelz_saves FOR DELETE USING (user_id = auth.uid());

-- RLS Policies: treelz_shares
CREATE POLICY "treelz_shares_select" ON treelz_shares FOR SELECT USING (true);
CREATE POLICY "treelz_shares_insert" ON treelz_shares FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies: treelz_ai_flags
CREATE POLICY "treelz_ai_flags_select" ON treelz_ai_flags FOR SELECT USING (true);
CREATE POLICY "treelz_ai_flags_insert" ON treelz_ai_flags FOR INSERT WITH CHECK (true);

-- RLS Policies: treelz_upload_bans
CREATE POLICY "treelz_upload_bans_select" ON treelz_upload_bans FOR SELECT USING (true);
CREATE POLICY "treelz_upload_bans_insert" ON treelz_upload_bans FOR INSERT WITH CHECK (true);
CREATE POLICY "treelz_upload_bans_update" ON treelz_upload_bans FOR UPDATE USING (true);

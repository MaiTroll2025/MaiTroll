BEGIN;

-- =============================================================================
-- BADGE SYSTEM MIGRATION
-- Date: 2026-10-07
-- =============================================================================
-- Creates tables for user badges earned through milestones, levels, leagues, etc.

-- Generic updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Badge definitions table
CREATE TABLE IF NOT EXISTS public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT, -- Lucide icon name or emoji
  color TEXT, -- Hex color for badge styling
  category TEXT NOT NULL DEFAULT 'general', -- 'milestone', 'level', 'league', 'gender', 'role', 'event', 'special'
  rarity TEXT NOT NULL DEFAULT 'common', -- 'common', 'rare', 'epic', 'legendary', 'mythic'
  criteria JSONB, -- JSON criteria for auto-awarding
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.badges IS 'Defines all available badges in the system';

-- User badges junction table
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB, -- Additional context (e.g., level reached, league name, etc.)
  UNIQUE(user_id, badge_id)
);

COMMENT ON TABLE public.user_badges IS 'Tracks which badges each user has earned';

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON public.user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON public.user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_badges_category ON public.badges(category);
CREATE INDEX IF NOT EXISTS idx_badges_slug ON public.badges(slug);

-- RLS Policies
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Badges are publicly readable
CREATE POLICY "Badges are publicly readable" ON public.badges
  FOR SELECT USING (true);

-- User badges are readable by everyone (for profile display)
CREATE POLICY "User badges are publicly readable" ON public.user_badges
  FOR SELECT USING (true);

-- Only system can insert badges (via RPC)
CREATE POLICY "System can insert user badges" ON public.user_badges
  FOR INSERT WITH CHECK (false); -- Will be bypassed by SECURITY DEFINER RPC

-- Trigger for updated_at
CREATE TRIGGER update_badges_updated_at
  BEFORE UPDATE ON public.badges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- DEFAULT BADGES
-- =============================================================================

INSERT INTO public.badges (slug, name, description, icon, color, category, rarity, criteria) VALUES
-- Gender badges
('male', 'Male', 'Male gender identity', 'Mars', '#3B82F6', 'gender', 'common', '{"gender": "male"}'),
('female', 'Female', 'Female gender identity', 'Venus', '#EC4899', 'gender', 'common', '{"gender": "female"}'),
('nonbinary', 'Non-Binary', 'Non-binary gender identity', 'Asterisk', '#A855F7', 'gender', 'common', '{"gender": "nonbinary"}'),

-- Level milestones
('level-5', 'Rising Star', 'Reached Level 5', 'Star', '#FBBF24', 'level', 'common', '{"level": 5}'),
('level-10', 'Veteran', 'Reached Level 10', 'Award', '#F59E0B', 'level', 'rare', '{"level": 10}'),
('level-20', 'Elite', 'Reached Level 20', 'Crown', '#EF4444', 'level', 'epic', '{"level": 20}'),
('level-30', 'Legend', 'Reached Level 30', 'Trophy', '#A855F7', 'level', 'legendary', '{"level": 30}'),
('level-50', 'Mythic', 'Reached Level 50', 'Sparkles', '#EC4899', 'level', 'mythic', '{"level": 50}'),

-- League badges
('league-bronze', 'Bronze League', 'Achieved Bronze League', 'Medal', '#CD7F32', 'league', 'common', '{"league": "bronze"}'),
('league-silver', 'Silver League', 'Achieved Silver League', 'Medal', '#C0C0C0', 'league', 'rare', '{"league": "silver"}'),
('league-gold', 'Gold League', 'Achieved Gold League', 'Medal', '#FFD700', 'league', 'epic', '{"league": "gold"}'),
('league-platinum', 'Platinum League', 'Achieved Platinum League', 'Medal', '#E5E4E2', 'league', 'legendary', '{"league": "platinum"}'),
('league-diamond', 'Diamond League', 'Achieved Diamond League', 'Gem', '#B9F2FF', 'league', 'mythic', '{"league": "diamond"}'),

-- Milestone badges
('first-post', 'First Post', 'Created your first post', 'PenTool', '#22C55E', 'milestone', 'common', '{"posts": 1}'),
('hundred-posts', 'Centurion', 'Created 100 posts', 'FileText', '#3B82F6', 'milestone', 'rare', '{"posts": 100}'),
('thousand-posts', 'Prolific Poster', 'Created 1,000 posts', 'BookOpen', '#8B5CF6', 'milestone', 'epic', '{"posts": 1000}'),
('first-follower', 'First Fan', 'Gained your first follower', 'UserPlus', '#EC4899', 'milestone', 'common', '{"followers": 1}'),
('hundred-followers', 'Influencer', 'Gained 100 followers', 'Users', '#F59E0B', 'milestone', 'rare', '{"followers": 100}'),
('thousand-followers', 'Celebrity', 'Gained 1,000 followers', 'Crown', '#FBBF24', 'milestone', 'epic', '{"followers": 1000}'),
('ten-thousand-followers', 'Superstar', 'Gained 10,000 followers', 'Sparkles', '#A855F7', 'milestone', 'legendary', '{"followers": 10000}'),

-- Special badges
('founder', 'Founder', 'Early supporter of Mai Troll', 'Heart', '#EC4899', 'special', 'legendary', '{"founder": true}'),
('verified', 'Verified', 'Verified account', 'ShieldCheck', '#3B82F6', 'special', 'epic', '{"verified": true}'),
('beta-tester', 'Beta Tester', 'Participated in beta testing', 'FlaskConical', '#8B5CF6', 'special', 'rare', '{"beta_tester": true}'),
('event-winner', 'Event Winner', 'Won a community event', 'Trophy', '#FBBF24', 'event', 'epic', '{"event_win": true}'),
('top-gifter', 'Top Gifter', 'Top gifter of the month', 'Gift', '#EC4899', 'milestone', 'rare', '{"top_gifter": true}'),
('streamer', 'Streamer', 'Went live for the first time', 'Radio', '#3B82F6', 'milestone', 'common', '{"broadcasts": 1}'),
('dedicated-streamer', 'Dedicated Streamer', 'Completed 100 broadcasts', 'Tv', '#8B5CF6', 'milestone', 'rare', '{"broadcasts": 100}'),

-- Role badges
('admin', 'Admin', 'Platform administrator', 'Shield', '#EF4444', 'role', 'mythic', '{"role": "admin"}'),
('moderator', 'Moderator', 'Community moderator', 'Gavel', '#F59E0B', 'role', 'epic', '{"role": "moderator"}'),
('president', 'President', 'City President', 'Crown', '#FBBF24', 'role', 'mythic', '{"role": "president"}'),
('mayor', 'Mayor', 'City Mayor', 'Landmark', '#F59E0B', 'role', 'legendary', '{"role": "mayor"}'),

-- Subscription badges
('subscriber', 'Subscriber', 'Active subscriber', 'Crown', '#A855F7', 'special', 'rare', '{"subscriber": true}'),
('top-subscriber', 'Top Supporter', 'Top tier subscriber', 'Gem', '#EC4899', 'special', 'epic', '{"top_subscriber": true}')

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  category = EXCLUDED.category,
  rarity = EXCLUDED.rarity,
  criteria = EXCLUDED.criteria,
  updated_at = NOW();

COMMIT;
BEGIN;

CREATE TABLE IF NOT EXISTS public.badge_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon_url TEXT,
  rarity TEXT NOT NULL DEFAULT 'common',
  sort_order INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.badge_catalog
  ADD COLUMN IF NOT EXISTS icon TEXT,
  ADD COLUMN IF NOT EXISTS color TEXT,
  ADD COLUMN IF NOT EXISTS criteria JSONB,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

DO $$
DECLARE
  fk RECORD;
  has_legacy_badge_fk BOOLEAN := false;
BEGIN
  IF to_regclass('public.badges') IS NOT NULL THEN
    INSERT INTO public.badge_catalog
      (id, slug, name, description, category, icon, color, criteria, rarity, sort_order, is_active)
    SELECT id, slug, name, COALESCE(description, ''), category, icon, color, criteria,
           rarity, 9000, true
    FROM public.badges
    ON CONFLICT (slug) DO NOTHING;

    FOR fk IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.user_badges'::regclass
        AND confrelid = 'public.badges'::regclass
        AND contype = 'f'
    LOOP
      has_legacy_badge_fk := true;
      EXECUTE format('ALTER TABLE public.user_badges DROP CONSTRAINT %I', fk.conname);
    END LOOP;

    IF has_legacy_badge_fk THEN
      DELETE FROM public.user_badges legacy_award
      USING public.badges legacy_badge,
            public.badge_catalog catalog_badge,
            public.user_badges catalog_award
      WHERE legacy_award.badge_id = legacy_badge.id
        AND catalog_badge.slug = legacy_badge.slug
        AND catalog_award.user_id = legacy_award.user_id
        AND catalog_award.badge_id = catalog_badge.id
        AND catalog_award.id <> legacy_award.id;

      UPDATE public.user_badges earned
      SET badge_id = catalog_badge.id
      FROM public.badges legacy_badge
      JOIN public.badge_catalog catalog_badge ON catalog_badge.slug = legacy_badge.slug
      WHERE earned.badge_id = legacy_badge.id;
    END IF;

    DROP TABLE public.badges;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_badges'::regclass
      AND confrelid = 'public.badge_catalog'::regclass
      AND contype = 'f'
  ) THEN
    ALTER TABLE public.user_badges
      ADD CONSTRAINT user_badges_badge_id_badge_catalog_fkey
      FOREIGN KEY (badge_id) REFERENCES public.badge_catalog(id) ON DELETE CASCADE;
  END IF;
END $$;

INSERT INTO public.badge_catalog
  (slug, name, description, category, icon, color, rarity, sort_order, criteria)
VALUES
  ('male', 'Male', 'Male gender identity', 'identity', 'Mars', '#3B82F6', 'common', 10, '{"gender":"male"}'),
  ('female', 'Female', 'Female gender identity', 'identity', 'Venus', '#EC4899', 'common', 11, '{"gender":"female"}'),
  ('nonbinary', 'Non-Binary', 'Non-binary gender identity', 'identity', 'Asterisk', '#A855F7', 'common', 12, '{"gender":"nonbinary"}'),
  ('level-5', 'Rising Star', 'Reach level 5', 'levels', 'Star', '#FBBF24', 'common', 20, '{"level":5}'),
  ('level-10', 'Veteran', 'Reach level 10', 'levels', 'Award', '#F59E0B', 'rare', 21, '{"level":10}'),
  ('level-20', 'Elite', 'Reach level 20', 'levels', 'Crown', '#EF4444', 'epic', 22, '{"level":20}'),
  ('level-30', 'Legend', 'Reach level 30', 'levels', 'Trophy', '#A855F7', 'legendary', 23, '{"level":30}'),
  ('level-50', 'Mythic', 'Reach level 50', 'levels', 'Sparkles', '#EC4899', 'mythic', 24, '{"level":50}'),
  ('league-bronze', 'Bronze League', 'Achieve Bronze League', 'league', 'Medal', '#CD7F32', 'common', 30, '{"league":"bronze"}'),
  ('league-silver', 'Silver League', 'Achieve Silver League', 'league', 'Medal', '#C0C0C0', 'rare', 31, '{"league":"silver"}'),
  ('league-gold', 'Gold League', 'Achieve Gold League', 'league', 'Medal', '#FFD700', 'epic', 32, '{"league":"gold"}'),
  ('league-platinum', 'Platinum League', 'Achieve Platinum League', 'league', 'Medal', '#E5E4E2', 'legendary', 33, '{"league":"platinum"}'),
  ('league-diamond', 'Diamond League', 'Achieve Diamond League', 'league', 'Gem', '#B9F2FF', 'mythic', 34, '{"league":"diamond"}'),
  ('first-post', 'First Post', 'Create your first post', 'treelz', 'PenTool', '#22C55E', 'common', 40, '{"posts":1}'),
  ('hundred-posts', 'Centurion', 'Create 100 posts', 'treelz', 'FileText', '#3B82F6', 'rare', 41, '{"posts":100}'),
  ('thousand-posts', 'Prolific Poster', 'Create 1,000 posts', 'treelz', 'BookOpen', '#8B5CF6', 'epic', 42, '{"posts":1000}'),
  ('first-follower', 'First Fan', 'Gain your first follower', 'community', 'UserPlus', '#EC4899', 'common', 50, '{"followers":1}'),
  ('hundred-followers', 'Influencer', 'Reach 100 followers', 'community', 'Users', '#F59E0B', 'rare', 51, '{"followers":100}'),
  ('thousand-followers', 'Celebrity', 'Reach 1,000 followers', 'community', 'Crown', '#FBBF24', 'epic', 52, '{"followers":1000}'),
  ('ten-thousand-followers', 'Superstar', 'Reach 10,000 followers', 'community', 'Sparkles', '#A855F7', 'legendary', 53, '{"followers":10000}'),
  ('founder', 'Founder', 'Early supporter of Mai Troll', 'special', 'Heart', '#EC4899', 'legendary', 60, '{"founder":true}'),
  ('verified', 'Verified', 'Verified account', 'special', 'ShieldCheck', '#3B82F6', 'epic', 61, '{"verified":true}'),
  ('beta-tester', 'Beta Tester', 'Participated in beta testing', 'special', 'FlaskConical', '#8B5CF6', 'rare', 62, '{"beta_tester":true}'),
  ('event-winner', 'Event Winner', 'Win a community event', 'events', 'Trophy', '#FBBF24', 'epic', 63, '{"event_win":true}'),
  ('top-gifter', 'Top Gifter', 'Top gift sender for a monthly period', 'broadcasts', 'Gift', '#EC4899', 'rare', 64, '{"metric":"monthly_gifts_sent_rank","rank":1}'),
  ('streamer', 'Streamer', 'Host your first broadcast', 'broadcasts', 'Radio', '#3B82F6', 'common', 65, '{"broadcasts":1}'),
  ('dedicated-streamer', 'Dedicated Streamer', 'Host 100 broadcasts', 'broadcasts', 'Tv', '#8B5CF6', 'rare', 66, '{"broadcasts":100}'),
  ('admin', 'Admin', 'Platform administrator', 'staff', 'Shield', '#EF4444', 'mythic', 70, '{"role":"admin"}'),
  ('moderator', 'Moderator', 'Community moderator', 'staff', 'Gavel', '#F59E0B', 'epic', 71, '{"role":"moderator"}'),
  ('president', 'President', 'City President', 'civic', 'Crown', '#FBBF24', 'mythic', 72, '{"role":"president"}'),
  ('mayor', 'Mayor', 'City Mayor', 'civic', 'Landmark', '#F59E0B', 'legendary', 73, '{"role":"mayor"}'),
  ('subscriber', 'Subscriber', 'Active subscriber', 'subscriptions', 'Crown', '#A855F7', 'rare', 80, '{"subscriber":true}'),
  ('top-subscriber', 'Top Supporter', 'Reach the top subscription tier', 'subscriptions', 'Gem', '#EC4899', 'epic', 81, '{"top_subscriber":true}'),
  ('mission-streak-7', 'Mission Regular', 'Complete a full week of missions', 'missions', 'CalendarCheck', '#22C55E', 'common', 100, '{"mission_streak_days":7}'),
  ('mission-streak-30', 'Mission Champion', 'Complete missions for 30 days', 'missions', 'Award', '#F59E0B', 'epic', 101, '{"mission_streak_days":30}'),
  ('oldest-resident', 'Oldest Resident', 'Recognized as the longest-standing active resident', 'city', 'Building', '#FBBF24', 'legendary', 110, '{"metric":"resident_since_rank","rank":1}'),
  ('best-officer', 'Outstanding Officer', 'Monthly staff award for high activity and no substantiated reports', 'staff', 'ShieldCheck', '#60A5FA', 'legendary', 120, '{"metric":"staff_activity_monthly","rank":1,"substantiated_reports":0}'),
  ('troller-50k-month', 'Troll Coin Trailblazer', 'Earn at least 50,000 Troll Coins in a calendar month as a Troller', 'troller', 'Coins', '#A855F7', 'epic', 130, '{"role":"troller","metric":"monthly_troll_coins_earned","minimum":50000}'),
  ('hytro-first-game', 'Hytro Rookie', 'Play your first Hytro game session', 'hytro-game', 'Gamepad2', '#22D3EE', 'common', 140, '{"hytro_sessions":1}'),
  ('hytro-games-100', 'Hytro High Score', 'Complete 100 Hytro game sessions', 'hytro-game', 'Trophy', '#FBBF24', 'rare', 141, '{"hytro_sessions":100}'),
  ('podcast-first', 'Podcast Debut', 'Publish or host your first podcast', 'podcasts', 'Mic2', '#C084FC', 'common', 150, '{"podcasts":1}'),
  ('podcast-episodes-25', 'Podcast Pro', 'Publish or host 25 podcast episodes', 'podcasts', 'Radio', '#F59E0B', 'rare', 151, '{"podcast_episodes":25}'),
  ('first-gift', 'First Gift', 'Send your first gift', 'gifting', 'Gift', '#EC4899', 'common', 160, '{"gifts_sent":1}'),
  ('generous-gifter', 'Generous Gifter', 'Send 10 gifts', 'gifting', 'Heart', '#EC4899', 'common', 161, '{"gifts_sent":10}'),
  ('first-stream', 'First Stream', 'Host a stream lasting at least 20 minutes', 'broadcasts', 'Radio', '#3B82F6', 'common', 162, '{"stream_minutes":20}'),
  ('first-reaction', 'First Reaction', 'Give 10 reactions', 'community', 'Sparkles', '#F59E0B', 'common', 163, '{"reactions":10}'),
  ('first-win', 'Court Victor', 'Win your first Troll Court case', 'court', 'Gavel', '#FBBF24', 'common', 164, '{"court_wins":1}'),
  ('clean-record', 'Clean Record', 'Maintain a clean record for 30 days', 'safety', 'ShieldCheck', '#22C55E', 'rare', 165, '{"clean_days":30}'),
  ('church_attendee', 'Church Attendee', 'Participate in the Mai Troll church community', 'church', 'Heart', '#A855F7', 'common', 170, '{"church_participation":1}')
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  rarity = EXCLUDED.rarity,
  sort_order = EXCLUDED.sort_order,
  criteria = EXCLUDED.criteria,
  is_active = true;

ALTER TABLE public.badge_catalog ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'badge_catalog'
      AND policyname = 'Badge catalog is publicly readable'
  ) THEN
    CREATE POLICY "Badge catalog is publicly readable"
      ON public.badge_catalog FOR SELECT USING (true);
  END IF;
END $$;

GRANT SELECT ON public.badge_catalog TO anon, authenticated;

COMMIT;

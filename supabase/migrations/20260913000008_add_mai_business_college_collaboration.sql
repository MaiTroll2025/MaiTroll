-- Migration: MAI Business — Institutions, Collaboration, Idea Exchange, Feed, College Battles
-- All new tables use the mai_business_ prefix (internal naming preserved).
-- Institutional control architecture prepared for future extension.

BEGIN;

-- =========================================================================
-- Institutions (colleges / universities)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.institutions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    abbreviation      TEXT,
    domain            TEXT UNIQUE,
    country           TEXT,
    state             TEXT,
    city              TEXT,
    institution_type  TEXT CHECK (institution_type IN ('university', 'college', 'community_college', 'technical', 'online', 'other')),
    logo_url          TEXT,
    is_verified       BOOLEAN NOT NULL DEFAULT false,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Institution Members (student/instructor affiliation)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.institution_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    institution_id  UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    membership_type TEXT NOT NULL CHECK (membership_type IN ('student', 'instructor', 'alumni', 'staff', 'affiliate')),
    role_title      TEXT,
    department      TEXT,
    field_of_study  TEXT,
    class_year      TEXT,
    is_verified     BOOLEAN NOT NULL DEFAULT false,
    verified_by     UUID REFERENCES public.user_profiles(id),
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, institution_id)
);

-- =========================================================================
-- MAI Business Collaboration Profiles (student discovery)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_collaboration_profiles (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    institution_id      UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
    field_of_study      TEXT,
    is_discoverable     BOOLEAN NOT NULL DEFAULT false,
    business_interests  TEXT[],
    skills              TEXT[],
    collaboration_interests TEXT,
    idea_categories     TEXT[],
    industries          TEXT[],
    looking_for         TEXT,
    brief_bio           TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Idea Exchange Posts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_idea_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT NOT NULL,
    category        TEXT
                    CHECK (category IN ('idea', 'question', 'feedback', 'suggestion', 'showcase')),
    is_anonymous    BOOLEAN NOT NULL DEFAULT false,
    like_count      INTEGER NOT NULL DEFAULT 0,
    comment_count   INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'moderation')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Idea Exchange Comments
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_idea_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES public.mai_business_idea_posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    parent_comment_id UUID REFERENCES public.mai_business_idea_comments(id) ON DELETE CASCADE,
    is_anonymous    BOOLEAN NOT NULL DEFAULT false,
    like_count      INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'moderation')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Global Student Feed Posts
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_feed_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    institution_id  UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
    content         TEXT NOT NULL,
    scope           TEXT NOT NULL DEFAULT 'global'
                    CHECK (scope IN ('global', 'institution', 'college_battle')),
    is_anonymous    BOOLEAN NOT NULL DEFAULT false,
    like_count      INTEGER NOT NULL DEFAULT 0,
    comment_count   INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'moderation')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- Global Student Feed Comments
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_feed_comments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id         UUID NOT NULL REFERENCES public.mai_business_feed_posts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    parent_comment_id UUID REFERENCES public.mai_business_feed_comments(id) ON DELETE CASCADE,
    is_anonymous    BOOLEAN NOT NULL DEFAULT false,
    like_count      INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'hidden', 'moderation')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- College Battle Participation (extends existing battle infrastructure)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_college_battle_participation (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    institution_id  UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    battle_id       UUID NOT NULL, -- references existing battles table (string/UUID depending on existing schema)
    participated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(user_id, battle_id)
);

-- =========================================================================
-- College Battle Points (per institution per event)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_college_battle_points (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    battle_id       UUID NOT NULL,
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    points          INTEGER NOT NULL,
    qualifying_event TEXT,
    recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================================================================
-- College Weekly Results (persisted, non-overwritable)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.mai_business_college_weekly_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start      DATE NOT NULL,
    week_end        DATE NOT NULL,
    institution_id  UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    rank_position   INTEGER NOT NULL,
    points          INTEGER NOT NULL DEFAULT 0,
    battle_count    INTEGER NOT NULL DEFAULT 0,
    qualifying_wins INTEGER NOT NULL DEFAULT 0,
    contribution_amount NUMERIC(12,2) DEFAULT 0,
    is_locked       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES public.user_profiles(id),
    UNIQUE(week_start, institution_id)
);

-- =========================================================================
-- Colleges are capped at 10 per weekly cycle (configurable via settings)
-- The cap is enforced in the weekly calculation RPC.
-- =========================================================================

ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_collaboration_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_idea_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_idea_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_feed_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_battle_participation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_battle_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mai_business_college_weekly_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read institutions" ON public.institutions;
CREATE POLICY "public read institutions"
  ON public.institutions FOR SELECT USING (true);

DROP POLICY IF EXISTS "admins manage institutions" ON public.institutions;
CREATE POLICY "admins manage institutions"
  ON public.institutions FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users view own membership" ON public.institution_members;
CREATE POLICY "users view own membership"
  ON public.institution_members FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users manage own membership" ON public.institution_members;
CREATE POLICY "users manage own membership"
  ON public.institution_members FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins manage memberships" ON public.institution_members;
CREATE POLICY "admins manage memberships"
  ON public.institution_members FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "users view own collab profile" ON public.mai_business_collaboration_profiles;
CREATE POLICY "users view own collab profile"
  ON public.mai_business_collaboration_profiles FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can create own collab profile" ON public.mai_business_collaboration_profiles;
CREATE POLICY "users can create own collab profile"
  ON public.mai_business_collaboration_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can update own collab profile" ON public.mai_business_collaboration_profiles;
CREATE POLICY "users can update own collab profile"
  ON public.mai_business_collaboration_profiles FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all collab profiles" ON public.mai_business_collaboration_profiles;
CREATE POLICY "admins read all collab profiles"
  ON public.mai_business_collaboration_profiles FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "authenticated read idea posts" ON public.mai_business_idea_posts;
CREATE POLICY "authenticated read idea posts"
  ON public.mai_business_idea_posts FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active'
  );

DROP POLICY IF EXISTS "users manage own idea posts" ON public.mai_business_idea_posts;
CREATE POLICY "users manage own idea posts"
  ON public.mai_business_idea_posts FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins and instructors moderate idea posts" ON public.mai_business_idea_posts;
CREATE POLICY "admins and instructors moderate idea posts"
  ON public.mai_business_idea_posts FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  );

DROP POLICY IF EXISTS "authenticated read idea comments" ON public.mai_business_idea_comments;
CREATE POLICY "authenticated read idea comments"
  ON public.mai_business_idea_comments FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active'
  );

DROP POLICY IF EXISTS "users manage own idea comments" ON public.mai_business_idea_comments;
CREATE POLICY "users manage own idea comments"
  ON public.mai_business_idea_comments FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins and instructors moderate idea comments" ON public.mai_business_idea_comments;
CREATE POLICY "admins and instructors moderate idea comments"
  ON public.mai_business_idea_comments FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  );

DROP POLICY IF EXISTS "authenticated read feed posts" ON public.mai_business_feed_posts;
CREATE POLICY "authenticated read feed posts"
  ON public.mai_business_feed_posts FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active'
  );

DROP POLICY IF EXISTS "users manage own feed posts" ON public.mai_business_feed_posts;
CREATE POLICY "users manage own feed posts"
  ON public.mai_business_feed_posts FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins and instructors moderate feed posts" ON public.mai_business_feed_posts;
CREATE POLICY "admins and instructors moderate feed posts"
  ON public.mai_business_feed_posts FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  );

DROP POLICY IF EXISTS "authenticated read feed comments" ON public.mai_business_feed_comments;
CREATE POLICY "authenticated read feed comments"
  ON public.mai_business_feed_comments FOR SELECT USING (
    auth.role() = 'authenticated' AND status = 'active'
  );

DROP POLICY IF EXISTS "users manage own feed comments" ON public.mai_business_feed_comments;
CREATE POLICY "users manage own feed comments"
  ON public.mai_business_feed_comments FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins and instructors moderate feed comments" ON public.mai_business_feed_comments;
CREATE POLICY "admins and instructors moderate feed comments"
  ON public.mai_business_feed_comments FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
    OR EXISTS (
      SELECT 1 FROM public.mai_business_profiles mp
      WHERE mp.user_id = auth.uid() AND mp.program_role = 'instructor'
    )
  );

DROP POLICY IF EXISTS "users view own college battle participation" ON public.mai_business_college_battle_participation;
CREATE POLICY "users view own college battle participation"
  ON public.mai_business_college_battle_participation FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users can add own participation" ON public.mai_business_college_battle_participation;
CREATE POLICY "users can add own participation"
  ON public.mai_business_college_battle_participation FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all participation" ON public.mai_business_college_battle_participation;
CREATE POLICY "admins read all participation"
  ON public.mai_business_college_battle_participation FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "admins read college battle points" ON public.mai_business_college_battle_points;
CREATE POLICY "admins read college battle points"
  ON public.mai_business_college_battle_points FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

DROP POLICY IF EXISTS "authenticated read weekly results" ON public.mai_business_college_weekly_results;
CREATE POLICY "authenticated read weekly results"
  ON public.mai_business_college_weekly_results FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "admins manage weekly results" ON public.mai_business_college_weekly_results;
CREATE POLICY "admins manage weekly results"
  ON public.mai_business_college_weekly_results FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin OR p.role IN ('admin', 'superadmin', 'ceo', 'owner'))
    )
  );

CREATE TRIGGER trg_mai_business_profiles_updated
    BEFORE UPDATE ON public.institutions
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_inst_members_updated
    BEFORE UPDATE ON public.institution_members
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_collab_profiles_updated
    BEFORE UPDATE ON public.mai_business_collaboration_profiles
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_idea_posts_updated
    BEFORE UPDATE ON public.mai_business_idea_posts
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_idea_comments_updated
    BEFORE UPDATE ON public.mai_business_idea_comments
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_feed_posts_updated
    BEFORE UPDATE ON public.mai_business_feed_posts
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

CREATE TRIGGER trg_mai_business_feed_comments_updated
    BEFORE UPDATE ON public.mai_business_feed_comments
    FOR EACH ROW EXECUTE FUNCTION public.mai_business_updated_at();

COMMIT;

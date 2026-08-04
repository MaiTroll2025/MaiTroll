-- ============================================================================
-- Migration: repair_family_backend
-- Ensures family system tables and relationships exist
-- Applied: 2026-07-30
-- ============================================================================

-- troll_families: ensure key columns
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_families' AND column_name = 'tag'
  ) THEN
    ALTER TABLE public.troll_families ADD COLUMN tag text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_families' AND column_name = 'banner_url'
  ) THEN
    ALTER TABLE public.troll_families ADD COLUMN banner_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_families' AND column_name = 'level'
  ) THEN
    ALTER TABLE public.troll_families ADD COLUMN level integer DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_families' AND column_name = 'xp'
  ) THEN
    ALTER TABLE public.troll_families ADD COLUMN xp bigint DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'troll_families' AND column_name = 'leader_user_id'
  ) THEN
    ALTER TABLE public.troll_families ADD COLUMN leader_user_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_troll_families_leader_user_id ON public.troll_families(leader_user_id);

-- family_members: ensure table exists
CREATE TABLE IF NOT EXISTS public.family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member', 'recruiter')),
  approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'denied')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER helper functions to bypass RLS (prevents infinite recursion
-- in policies that self-reference the family_members table)
CREATE OR REPLACE FUNCTION public.is_family_member_secure(p_family_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_leader_secure(p_family_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = p_family_id AND user_id = p_user_id AND role = 'leader'
  );
$$;

CREATE POLICY "Family members can view own membership"
  ON public.family_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Family leaders can view all members"
  ON public.family_members FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_family_leader_secure(family_id, auth.uid())
  );

CREATE POLICY "Users can insert own membership"
  ON public.family_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON public.family_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Family leaders can update member roles"
  ON public.family_members FOR UPDATE
  USING (
    auth.uid() = user_id
    OR public.is_family_leader_secure(family_id, auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON public.family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family_id ON public.family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_family_members_approval_status ON public.family_members(approval_status);

-- family_members_extended: ensure table exists
CREATE TABLE IF NOT EXISTS public.family_members_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)
);

ALTER TABLE public.family_members_extended ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view own extended profile"
  ON public.family_members_extended FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Family leaders can view all extended profiles"
  ON public.family_members_extended FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.is_family_leader_secure(family_id, auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_family_members_extended_user_id ON public.family_members_extended(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_extended_family_id ON public.family_members_extended(family_id);

-- family_members: ensure FK constraints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'family_members' AND constraint_name = 'family_members_family_id_fkey'
  ) THEN
    ALTER TABLE public.family_members
      ADD CONSTRAINT family_members_family_id_fkey
      FOREIGN KEY (family_id) REFERENCES public.troll_families(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'family_members' AND constraint_name = 'family_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.family_members
      ADD CONSTRAINT family_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- family_invites: ensure table exists and has all required columns
CREATE TABLE IF NOT EXISTS public.family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  message text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(family_id, invited_user_id)
);

-- Add missing columns to existing family_invites table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_invites' AND column_name = 'invited_by'
  ) THEN
    ALTER TABLE public.family_invites ADD COLUMN invited_by uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_invites' AND column_name = 'invited_user_id'
  ) THEN
    ALTER TABLE public.family_invites ADD COLUMN invited_user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'family_invites' AND column_name = 'responded_at'
  ) THEN
    ALTER TABLE public.family_invites ADD COLUMN responded_at timestamptz;
  END IF;
END $$;

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Family members can view invites"
  ON public.family_invites FOR SELECT
  USING (auth.uid() = invited_user_id OR family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Family leaders can send invites"
  ON public.family_invites FOR INSERT
  WITH CHECK (auth.uid() = invited_by);

CREATE INDEX IF NOT EXISTS idx_family_invites_family_id ON public.family_invites(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_invited_user_id ON public.family_invites(invited_user_id);

-- family_applications: create if missing
CREATE TABLE IF NOT EXISTS public.family_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES public.troll_families(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES public.user_profiles(id),
  reviewed_at timestamptz,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.family_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants can view own applications"
  ON public.family_applications FOR SELECT
  USING (auth.uid() = applicant_id);

CREATE POLICY "Family leaders can view applications for their families"
  ON public.family_applications FOR SELECT
  USING (family_id IN (
    SELECT family_id FROM public.family_members WHERE user_id = auth.uid() AND role = 'leader'
  ));

CREATE INDEX IF NOT EXISTS idx_family_applications_family_id ON public.family_applications(family_id);
CREATE INDEX IF NOT EXISTS idx_family_applications_applicant_id ON public.family_applications(applicant_id);
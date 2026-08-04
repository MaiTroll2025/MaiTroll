-- Organization Management Hub
-- Additive compatibility layer for partner organizations, scoped files/messages, MAI Class students, and underage payout locks.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS org_type text,
  ADD COLUMN IF NOT EXISTS primary_contact_name text,
  ADD COLUMN IF NOT EXISTS primary_contact_email text,
  ADD COLUMN IF NOT EXISTS primary_contact_phone text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS assigned_admin_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dropped_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug_unique
  ON public.organizations(slug)
  WHERE slug IS NOT NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.organizations'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

UPDATE public.organizations
SET status = CASE status
  WHEN 'approved' THEN 'active'
  WHEN 'pending' THEN 'onboarding'
  WHEN 'rejected' THEN 'dropped'
  WHEN 'archived' THEN 'dropped'
  ELSE COALESCE(status, 'onboarding')
END;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('onboarding', 'active', 'suspended', 'dropped'));

ALTER TABLE public.organization_students
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS student_email text,
  ADD COLUMN IF NOT EXISTS student_name text,
  ADD COLUMN IF NOT EXISTS guardian_email text,
  ADD COLUMN IF NOT EXISTS cashout_locked_until_18 boolean DEFAULT true;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_org_student boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS student_date_of_birth date,
  ADD COLUMN IF NOT EXISTS cashout_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS organization_profile_visible boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'staff' CHECK (role IN ('org_admin', 'staff', 'viewer')),
  status text DEFAULT 'active' CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  invited_by uuid REFERENCES auth.users(id),
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.organization_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  content text,
  message_type text DEFAULT 'text' CHECK (message_type IN ('text', 'announcement', 'file', 'system')),
  is_urgent boolean DEFAULT false,
  pinned boolean DEFAULT false,
  file_id uuid,
  read_by jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id),
  folder text DEFAULT 'General',
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  file_size bigint,
  access_level text DEFAULT 'org_staff' CHECK (access_level IN ('admin_only', 'org_admin', 'org_staff')),
  version integer DEFAULT 1,
  description text,
  created_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.organization_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  title text NOT NULL,
  body text NOT NULL,
  urgent boolean DEFAULT false,
  audience text DEFAULT 'single_org' CHECK (audience IN ('single_org', 'all_orgs')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text,
  target_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.organization_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_messages_org_created ON public.organization_messages(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_files_org_folder ON public.organization_files(org_id, folder);
CREATE INDEX IF NOT EXISTS idx_org_announcements_org_created ON public.organization_announcements(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_audit_org_created ON public.organization_audit_logs(org_id, created_at DESC);

INSERT INTO storage.buckets (id, name, public)
VALUES ('org-files', 'org-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_tc_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        COALESCE(is_admin, false) = true
        OR COALESCE(is_superadmin, false) = true
        OR role IN ('admin', 'superadmin', 'ceo', 'owner', 'hr_admin')
        OR troll_role IN ('admin', 'superadmin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tc_staff(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tc_admin(p_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles
      WHERE id = p_user_id
        AND (
          role IN ('staff', 'secretary', 'moderator', 'troll_officer', 'lead_troll_officer', 'prosecutor', 'attorney')
          OR troll_role IN ('staff', 'secretary', 'moderator', 'troll_officer', 'lead_troll_officer')
          OR COALESCE(is_troll_officer, false) = true
          OR COALESCE(is_lead_officer, false) = true
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_org_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organizations o
    WHERE o.id = p_org_id
      AND o.status IN ('onboarding', 'active')
      AND (
        o.admin_user_id = p_user_id
        OR EXISTS (
          SELECT 1 FROM public.organization_members om
          WHERE om.org_id = p_org_id AND om.user_id = p_user_id AND om.status = 'active'
        )
        OR EXISTS (
          SELECT 1 FROM public.organization_admins oa
          WHERE oa.organization_id = p_org_id AND oa.user_id = p_user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.organization_students os
          WHERE os.organization_id = p_org_id AND os.user_id = p_user_id AND os.status = 'active'
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_tc_admin(p_user_id)
    OR EXISTS (SELECT 1 FROM public.organizations WHERE id = p_org_id AND admin_user_id = p_user_id AND status IN ('onboarding', 'active'))
    OR EXISTS (SELECT 1 FROM public.organization_members WHERE org_id = p_org_id AND user_id = p_user_id AND role = 'org_admin' AND status = 'active')
    OR EXISTS (SELECT 1 FROM public.organization_admins WHERE organization_id = p_org_id AND user_id = p_user_id AND role IN ('owner', 'admin'));
$$;

CREATE OR REPLACE FUNCTION public.record_organization_audit(
  p_org_id uuid,
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.organization_audit_logs (org_id, actor_id, action, target_type, target_id, metadata)
  VALUES (p_org_id, auth.uid(), p_action, p_target_type, p_target_id, COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.org_storage_org_id(p_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN split_part(p_name, '/', 1)::uuid;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_underage_org_student_cashout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile record;
BEGIN
  SELECT is_org_student, student_date_of_birth, cashout_locked_until
    INTO v_profile
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  IF COALESCE(v_profile.is_org_student, false) = true
    AND (
      (v_profile.student_date_of_birth IS NOT NULL AND v_profile.student_date_of_birth > (CURRENT_DATE - interval '18 years'))
      OR (v_profile.cashout_locked_until IS NOT NULL AND v_profile.cashout_locked_until > now())
    )
  THEN
    RAISE EXCEPTION 'Organization student payouts are locked until age 18. Coins remain saved in the student account.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_underage_org_student_cashout ON public.cashout_requests;
CREATE TRIGGER trg_prevent_underage_org_student_cashout
  BEFORE INSERT ON public.cashout_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_underage_org_student_cashout();

DROP TRIGGER IF EXISTS trg_prevent_underage_org_student_payout ON public.payout_requests;
CREATE TRIGGER trg_prevent_underage_org_student_payout
  BEFORE INSERT ON public.payout_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_underage_org_student_cashout();

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_hub_select ON public.organizations;
CREATE POLICY org_hub_select ON public.organizations
  FOR SELECT USING (
    public.is_tc_staff(auth.uid())
    OR public.is_active_org_member(id, auth.uid())
    OR COALESCE(is_public, false) = true
  );

DROP POLICY IF EXISTS org_hub_insert ON public.organizations;
CREATE POLICY org_hub_insert ON public.organizations
  FOR INSERT WITH CHECK (public.is_tc_admin(auth.uid()));

DROP POLICY IF EXISTS org_hub_update ON public.organizations;
CREATE POLICY org_hub_update ON public.organizations
  FOR UPDATE USING (public.is_tc_admin(auth.uid()) OR public.is_org_admin_member(id, auth.uid()))
  WITH CHECK (public.is_tc_admin(auth.uid()) OR public.is_org_admin_member(id, auth.uid()));

DROP POLICY IF EXISTS org_members_select ON public.organization_members;
CREATE POLICY org_members_select ON public.organization_members
  FOR SELECT USING (public.is_tc_staff(auth.uid()) OR public.is_active_org_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_members_manage ON public.organization_members;
CREATE POLICY org_members_manage ON public.organization_members
  FOR ALL USING (public.is_tc_admin(auth.uid()) OR public.is_org_admin_member(org_id, auth.uid()))
  WITH CHECK (public.is_tc_admin(auth.uid()) OR public.is_org_admin_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_messages_select ON public.organization_messages;
CREATE POLICY org_messages_select ON public.organization_messages
  FOR SELECT USING (public.is_tc_staff(auth.uid()) OR public.is_active_org_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_messages_insert ON public.organization_messages;
CREATE POLICY org_messages_insert ON public.organization_messages
  FOR INSERT WITH CHECK (public.is_tc_staff(auth.uid()) OR public.is_active_org_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_files_select ON public.organization_files;
CREATE POLICY org_files_select ON public.organization_files
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      public.is_tc_staff(auth.uid())
      OR (access_level = 'org_staff' AND public.is_active_org_member(org_id, auth.uid()))
      OR (access_level = 'org_admin' AND public.is_org_admin_member(org_id, auth.uid()))
    )
  );

DROP POLICY IF EXISTS org_files_insert ON public.organization_files;
CREATE POLICY org_files_insert ON public.organization_files
  FOR INSERT WITH CHECK (public.is_tc_staff(auth.uid()) OR public.is_active_org_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_files_update ON public.organization_files;
CREATE POLICY org_files_update ON public.organization_files
  FOR UPDATE USING (public.is_tc_staff(auth.uid()) OR public.is_org_admin_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_announcements_select ON public.organization_announcements;
CREATE POLICY org_announcements_select ON public.organization_announcements
  FOR SELECT USING (
    public.is_tc_staff(auth.uid())
    OR (audience = 'all_orgs' AND EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND organization_id IS NOT NULL))
    OR (org_id IS NOT NULL AND public.is_active_org_member(org_id, auth.uid()))
  );

DROP POLICY IF EXISTS org_announcements_manage ON public.organization_announcements;
CREATE POLICY org_announcements_manage ON public.organization_announcements
  FOR ALL USING (public.is_tc_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_admin_member(org_id, auth.uid())))
  WITH CHECK (public.is_tc_admin(auth.uid()) OR (org_id IS NOT NULL AND public.is_org_admin_member(org_id, auth.uid())));

DROP POLICY IF EXISTS org_audit_select ON public.organization_audit_logs;
CREATE POLICY org_audit_select ON public.organization_audit_logs
  FOR SELECT USING (public.is_tc_staff(auth.uid()) OR public.is_org_admin_member(org_id, auth.uid()));

DROP POLICY IF EXISTS org_storage_read ON storage.objects;
CREATE POLICY org_storage_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'org-files'
    AND (
      public.is_tc_staff(auth.uid())
      OR public.is_active_org_member(public.org_storage_org_id(name), auth.uid())
    )
  );

DROP POLICY IF EXISTS org_storage_write ON storage.objects;
CREATE POLICY org_storage_write ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'org-files'
    AND (
      public.is_tc_staff(auth.uid())
      OR public.is_active_org_member(public.org_storage_org_id(name), auth.uid())
    )
  );

DROP POLICY IF EXISTS org_storage_update ON storage.objects;
CREATE POLICY org_storage_update ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'org-files'
    AND (
      public.is_tc_staff(auth.uid())
      OR public.is_org_admin_member(public.org_storage_org_id(name), auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_members TO authenticated;
GRANT SELECT, INSERT ON public.organization_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_files TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.organization_announcements TO authenticated;
GRANT SELECT, INSERT ON public.organization_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tc_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_tc_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_organization_audit(uuid, text, text, uuid, jsonb) TO authenticated;

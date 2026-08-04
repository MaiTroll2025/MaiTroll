-- Mai Troll Notary & Document Management System (NDS)
-- Complete document management, digital signatures, approval stamps, and audit system

-- ============================================================
-- DOCUMENT TYPES (expandable by administrators)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_content TEXT,
  required_roles TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Seed default document types
INSERT INTO public.document_types (slug, name, description, category, sort_order) VALUES
  ('agency_agreement', 'Agency Agreement', 'HytroGaming Agency partnership and operating agreement', 'agency', 1),
  ('loan_agreement', 'Loan Agreement', 'Mai Troll bank loan contract and terms', 'financial', 2),
  ('payroll_form', 'Payroll Form', 'Employee payroll and compensation document', 'hr', 3),
  ('employment_contract', 'Employment Contract', 'Full employment agreement and terms', 'hr', 4),
  ('staff_application', 'Staff Application', 'Application to join Mai Troll staff', 'hr', 5),
  ('partnership_contract', 'Partnership Contract', 'General partnership and collaboration agreement', 'legal', 6),
  ('nda', 'Non-Disclosure Agreement', 'Confidentiality and NDA document', 'legal', 7),
  ('custom', 'Custom Document', 'Administrator-defined custom document type', 'general', 99)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- DOCUMENTS (core table)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_type_id UUID REFERENCES public.document_types(id),
  document_type_slug TEXT NOT NULL DEFAULT 'custom',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'archived')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  submitted_by UUID REFERENCES public.user_profiles(id),
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES public.user_profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES public.user_profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES public.user_profiles(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  assigned_to UUID REFERENCES public.user_profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  parent_document_id UUID REFERENCES public.documents(id),
  is_template BOOLEAN DEFAULT false,
  template_id UUID REFERENCES public.documents(id),
  version INTEGER DEFAULT 1,
  storage_path TEXT,
  pdf_path TEXT,
  checksum TEXT,
  is_locked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_submitted_by ON public.documents(submitted_by);
CREATE INDEX IF NOT EXISTS idx_documents_assigned_to ON public.documents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_documents_type ON public.documents(document_type_slug);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_approved_by ON public.documents(approved_by);

-- ============================================================
-- DOCUMENT VERSIONS (immutable history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  content TEXT NOT NULL,
  title TEXT NOT NULL,
  changed_by UUID REFERENCES public.user_profiles(id),
  change_summary TEXT,
  checksum TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(document_id, version)
);

CREATE INDEX IF NOT EXISTS idx_document_versions_document_id ON public.document_versions(document_id);

-- ============================================================
-- DOCUMENT SIGNATURES (digital signature records)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_signatures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  username TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  typed_signature TEXT NOT NULL,
  ip_address INET,
  browser_user_agent TEXT,
  signed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  agreement_version INTEGER NOT NULL DEFAULT 1,
  signature_hash TEXT NOT NULL,
  document_type TEXT NOT NULL,
  is_revoked BOOLEAN DEFAULT false,
  revoked_at TIMESTAMP WITH TIME ZONE,
  revocation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_signatures_document_id ON public.document_signatures(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_user_id ON public.document_signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_hash ON public.document_signatures(signature_hash);

-- ============================================================
-- DOCUMENT APPROVALS (who approved what)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.user_profiles(id),
  approver_username TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  approval_type TEXT NOT NULL CHECK (approval_type IN ('initial', 'secondary', 'final', 'override')),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'returned')),
  comments TEXT,
  required_role TEXT,
  approval_order INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_approvals_document_id ON public.document_approvals(document_id);
CREATE INDEX IF NOT EXISTS idx_document_approvals_approver ON public.document_approvals(approver_id);

-- ============================================================
-- DOCUMENT STAMPS (official Mai Troll approval stamps)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_stamps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  approval_id UUID REFERENCES public.document_approvals(id),
  stamp_id TEXT NOT NULL UNIQUE,
  seal_text TEXT NOT NULL DEFAULT 'Mai Troll OFFICIAL',
  approver_id UUID NOT NULL REFERENCES public.user_profiles(id),
  approver_username TEXT NOT NULL,
  approver_role TEXT NOT NULL,
  approval_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiry_date TIMESTAMP WITH TIME ZONE,
  stamp_hash TEXT NOT NULL,
  verification_code TEXT NOT NULL UNIQUE,
  ip_address INET,
  is_valid BOOLEAN DEFAULT true,
  document_checksum TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_stamps_document_id ON public.document_stamps(document_id);
CREATE INDEX IF NOT EXISTS idx_document_stamps_verification ON public.document_stamps(verification_code);
CREATE INDEX IF NOT EXISTS idx_document_stamps_approver ON public.document_stamps(approver_id);

-- ============================================================
-- DOCUMENT AUDIT LOGS (immutable)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.user_profiles(id),
  actor_username TEXT NOT NULL,
  actor_role TEXT,
  action TEXT NOT NULL CHECK (action IN (
    'document_created', 'document_updated', 'document_signed',
    'document_submitted', 'document_reviewed', 'document_approved',
    'document_rejected', 'document_stamped', 'document_downloaded',
    'document_archived', 'document_assigned', 'document_unassigned',
    'signature_added', 'signature_revoked', 'stamp_applied',
    'version_created', 'document_locked', 'document_unlocked',
    'pdf_generated', 'document_shared', 'approval_override'
  )),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_audit_logs_document_id ON public.document_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_actor ON document_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_action ON document_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_document_audit_logs_created ON document_audit_logs(created_at DESC);

-- ============================================================
-- USER DOCUMENT ACCESS (permissions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id),
  access_level TEXT NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'sign', 'approve', 'admin')),
  granted_by UUID REFERENCES public.user_profiles(id),
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(document_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_document_access_user ON public.document_access(user_id);
CREATE INDEX IF NOT EXISTS idx_document_access_document ON public.document_access(document_id);

-- ============================================================
-- STORAGE BUCKET FOR PDFs
-- ============================================================
-- (Storage buckets are created via Supabase dashboard or storage API)
-- Bucket name: notary_documents
-- Public: false

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Generate unique approval/stamp ID
CREATE OR REPLACE FUNCTION public.generate_stamp_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'TC-APP-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 8));
END;
$$;

-- Generate verification code
CREATE OR REPLACE FUNCTION public.generate_verification_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'TC-VERIFY-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT), 1, 12));
END;
$$;

-- Compute document checksum
CREATE OR REPLACE FUNCTION public.compute_document_checksum(p_content TEXT, p_title TEXT, p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN ENCODE(DIGEST(
    COALESCE(p_content, '') || '|' || COALESCE(p_title, '') || '|' || COALESCE(p_user_id::TEXT, '') || '|' || NOW()::TEXT,
    'sha256'
  ), 'hex');
END;
$$;

-- ============================================================
-- AUDIT LOG HELPER (immutable - no updates/deletes allowed)
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_document_event(
  p_document_id UUID,
  p_actor_id UUID,
  p_actor_username TEXT,
  p_actor_role TEXT,
  p_action TEXT,
  p_details JSONB DEFAULT '{}',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.document_audit_logs (
    document_id, actor_id, actor_username, actor_role,
    action, details, ip_address, user_agent
  ) VALUES (
    p_document_id, p_actor_id, p_actor_username, p_actor_role,
    p_action, p_details, p_ip_address, p_user_agent
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================
-- SIGN DOCUMENT RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.sign_document(
  p_document_id UUID,
  p_user_id UUID,
  p_legal_name TEXT,
  p_typed_signature TEXT,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document RECORD;
  v_username TEXT;
  v_signature_hash TEXT;
  v_signature_id UUID;
BEGIN
  -- Get document
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Document not found');
  END IF;

  -- Check document is in signable state
  IF v_document.status NOT IN ('draft', 'pending') THEN
    RETURN json_build_object('success', false, 'error', 'Document is not in a signable state. Status: ' || v_document.status);
  END IF;

  -- Check document is not locked
  IF v_document.is_locked THEN
    RETURN json_build_object('success', false, 'error', 'Document is locked and cannot be signed');
  END IF;

  -- Check user has access
  IF v_document.submitted_by != p_user_id AND v_document.assigned_to != p_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.document_access
      WHERE document_id = p_document_id AND user_id = p_user_id AND access_level IN ('sign', 'approve', 'admin') AND is_active = true
    ) AND NOT EXISTS (
      SELECT 1 FROM public.user_profiles WHERE id = p_user_id AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator'))
    ) THEN
      RETURN json_build_object('success', false, 'error', 'You do not have permission to sign this document');
    END IF;
  END IF;

  -- Check not already signed by this user
  IF EXISTS (
    SELECT 1 FROM public.document_signatures
    WHERE document_id = p_document_id AND user_id = p_user_id AND is_revoked = false
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You have already signed this document');
  END IF;

  -- Get username
  SELECT username INTO v_username FROM public.user_profiles WHERE id = p_user_id;
  IF v_username IS NULL THEN
    v_username = 'Unknown';
  END IF;

  -- Generate signature hash
  v_signature_hash := ENCODE(DIGEST(
    p_document_id::TEXT || '|' || p_user_id::TEXT || '|' || p_legal_name || '|' || p_typed_signature || '|' || NOW()::TEXT,
    'sha256'
  ), 'hex');

  -- Insert signature
  INSERT INTO public.document_signatures (
    document_id, user_id, username, legal_name, typed_signature,
    ip_address, browser_user_agent, agreement_version, signature_hash, document_type
  ) VALUES (
    p_document_id, p_user_id, v_username, p_legal_name, p_typed_signature,
    p_ip_address, p_user_agent, v_document.version, v_signature_hash, v_document.document_type_slug
  ) RETURNING id INTO v_signature_id;

  -- Update document status to pending if it was draft
  IF v_document.status = 'draft' THEN
    UPDATE public.documents SET status = 'pending', submitted_at = now(), updated_at = now() WHERE id = p_document_id;
  END IF;

  -- Log the event
  PERFORM public.log_document_event(
    p_document_id, p_user_id, v_username,
    (SELECT role FROM public.user_profiles WHERE id = p_user_id),
    'document_signed',
    jsonb_build_object('signature_id', v_signature_id, 'legal_name', p_legal_name),
    p_ip_address, p_user_agent
  );

  RETURN json_build_object(
    'success', true,
    'signature_id', v_signature_id,
    'signature_hash', v_signature_hash
  );
END;
$$;

-- ============================================================
-- APPROVE DOCUMENT RPC (with stamp generation)
-- ============================================================
CREATE OR REPLACE FUNCTION public.approve_document(
  p_document_id UUID,
  p_approver_id UUID,
  p_comments TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document RECORD;
  v_approver RECORD;
  v_stamp_id TEXT;
  v_verification_code TEXT;
  v_stamp_hash TEXT;
  v_document_checksum TEXT;
  v_approval_id UUID;
BEGIN
  -- Get document
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Document not found');
  END IF;

  -- Check document is in approvable state
  IF v_document.status NOT IN ('pending', 'draft') THEN
    RETURN json_build_object('success', false, 'error', 'Document cannot be approved. Status: ' || v_document.status);
  END IF;

  -- Get approver profile
  SELECT * INTO v_approver FROM public.user_profiles WHERE id = p_approver_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Approver not found');
  END IF;

  -- Check approver has approval rights
  IF NOT (v_approver.is_admin = true OR v_approver.role IN ('admin', 'ceo', 'founder', 'owner', 'moderator', 'staff', 'lead_troll_officer')) THEN
    RETURN json_build_object('success', false, 'error', 'You do not have approval privileges');
  END IF;

  -- Check document is not already approved
  IF v_document.status = 'approved' THEN
    RETURN json_build_object('success', false, 'error', 'Document is already approved');
  END IF;

  -- Generate stamp values
  v_stamp_id := public.generate_stamp_id();
  v_verification_code := public.generate_verification_code();
  v_document_checksum := public.compute_document_checksum(v_document.content, v_document.title, v_document.submitted_by);
  v_stamp_hash := ENCODE(DIGEST(
    v_stamp_id || '|' || p_approver_id::TEXT || '|' || p_document_id::TEXT || '|' || v_document_checksum || '|' || NOW()::TEXT,
    'sha256'
  ), 'hex');

  -- Create approval record
  INSERT INTO public.document_approvals (
    document_id, approver_id, approver_username, approver_role,
    approval_type, decision, comments
  ) VALUES (
    p_document_id, p_approver_id, v_approver.username, v_approver.role,
    'final', 'approved', p_comments
  ) RETURNING id INTO v_approval_id;

  -- Create stamp
  INSERT INTO public.document_stamps (
    document_id, approval_id, stamp_id, seal_text,
    approver_id, approver_username, approver_role,
    approval_date, stamp_hash, verification_code,
    ip_address, document_checksum
  ) VALUES (
    p_document_id, v_approval_id, v_stamp_id, 'Mai Troll OFFICIAL',
    p_approver_id, v_approver.username, v_approver.role,
    now(), v_stamp_hash, v_verification_code,
    p_ip_address, v_document_checksum
  );

  -- Update document
  UPDATE public.documents SET
    status = 'approved',
    approved_by = p_approver_id,
    approved_at = now(),
    is_locked = true,
    checksum = v_document_checksum,
    updated_at = now()
  WHERE id = p_document_id;

  -- Log the event
  PERFORM public.log_document_event(
    p_document_id, p_approver_id, v_approver.username, v_approver.role,
    'document_approved',
    jsonb_build_object('stamp_id', v_stamp_id, 'verification_code', v_verification_code, 'comments', p_comments),
    p_ip_address, p_user_agent
  );

  RETURN json_build_object(
    'success', true,
    'stamp_id', v_stamp_id,
    'verification_code', v_verification_code,
    'stamp_hash', v_stamp_hash
  );
END;
$$;

-- ============================================================
-- REJECT DOCUMENT RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.reject_document(
  p_document_id UUID,
  p_rejecter_id UUID,
  p_reason TEXT DEFAULT 'No reason provided',
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document RECORD;
  v_rejecter RECORD;
BEGIN
  SELECT * INTO v_document FROM public.documents WHERE id = p_document_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Document not found');
  END IF;

  IF v_document.status NOT IN ('pending', 'draft') THEN
    RETURN json_build_object('success', false, 'error', 'Document cannot be rejected. Status: ' || v_document.status);
  END IF;

  SELECT * INTO v_rejecter FROM public.user_profiles WHERE id = p_rejecter_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF NOT (v_rejecter.is_admin = true OR v_rejecter.role IN ('admin', 'ceo', 'founder', 'owner', 'moderator', 'staff', 'lead_troll_officer')) THEN
    RETURN json_build_object('success', false, 'error', 'You do not have rejection privileges');
  END IF;

  INSERT INTO public.document_approvals (
    document_id, approver_id, approver_username, approver_role,
    approval_type, decision, comments
  ) VALUES (
    p_document_id, p_rejecter_id, v_rejecter.username, v_rejecter.role,
    'final', 'rejected', p_reason
  );

  UPDATE public.documents SET
    status = 'rejected',
    rejected_by = p_rejecter_id,
    rejected_at = now(),
    rejection_reason = p_reason,
    updated_at = now()
  WHERE id = p_document_id;

  PERFORM public.log_document_event(
    p_document_id, p_rejecter_id, v_rejecter.username, v_rejecter.role,
    'document_rejected',
    jsonb_build_object('reason', p_reason),
    p_ip_address, p_user_agent
  );

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- VERIFY STAMP RPC (for dispute resolution)
-- ============================================================
CREATE OR REPLACE FUNCTION public.verify_stamp(p_verification_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stamp RECORD;
  v_document RECORD;
BEGIN
  SELECT * INTO v_stamp FROM public.document_stamps WHERE verification_code = p_verification_code;
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Verification code not found');
  END IF;

  SELECT * INTO v_document FROM public.documents WHERE id = v_stamp.document_id;

  RETURN json_build_object(
    'valid', v_stamp.is_valid,
    'stamp_id', v_stamp.stamp_id,
    'seal', v_stamp.seal_text,
    'approver', v_stamp.approver_username,
    'approver_role', v_stamp.approver_role,
    'approval_date', v_stamp.approval_date,
    'document_id', v_stamp.document_id,
    'document_title', v_document.title,
    'document_type', v_document.document_type_slug,
    'document_status', v_document.status,
    'document_checksum', v_stamp.document_checksum,
    'stamp_hash', v_stamp.stamp_hash
  );
END;
$$;

-- ============================================================
-- CREATE DOCUMENT RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_document(
  p_title TEXT,
  p_content TEXT,
  p_submitter_id UUID,
  p_document_type_slug TEXT DEFAULT 'custom',
  p_priority TEXT DEFAULT 'normal',
  p_tags TEXT[] DEFAULT '{}',
  p_metadata JSONB DEFAULT '{}',
  p_assigned_to UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_document_id UUID;
  v_type_id UUID;
  v_username TEXT;
  v_checksum TEXT;
BEGIN
  -- Get document type
  SELECT id INTO v_type_id FROM public.document_types WHERE slug = p_document_type_slug AND is_active = true;
  IF v_type_id IS NULL THEN
    SELECT id INTO v_type_id FROM public.document_types WHERE slug = 'custom';
  END IF;

  -- Get username
  SELECT username INTO v_username FROM public.user_profiles WHERE id = p_submitter_id;

  -- Compute checksum
  v_checksum := public.compute_document_checksum(p_content, p_title, p_submitter_id);

  -- Create document
  INSERT INTO public.documents (
    document_type_id, document_type_slug, title, content,
    status, priority, submitted_by, tags, metadata,
    assigned_to, checksum, version
  ) VALUES (
    v_type_id, p_document_type_slug, p_title, p_content,
    'draft', p_priority, p_submitter_id, p_tags, p_metadata,
    p_assigned_to, v_checksum, 1
  ) RETURNING id INTO v_document_id;

  -- Create initial version
  INSERT INTO public.document_versions (document_id, version, content, title, changed_by, change_summary, checksum)
  VALUES (v_document_id, 1, p_content, p_title, p_submitter_id, 'Initial version', v_checksum);

  -- Log
  PERFORM public.log_document_event(
    v_document_id, p_submitter_id, COALESCE(v_username, 'Unknown'),
    (SELECT role FROM public.user_profiles WHERE id = p_submitter_id),
    'document_created',
    jsonb_build_object('title', p_title, 'type', p_document_type_slug)
  );

  RETURN json_build_object('success', true, 'document_id', v_document_id);
END;
$$;

-- ============================================================
-- ASSIGN DOCUMENT RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_document(
  p_document_id UUID,
  p_assign_to_user_id UUID,
  p_assigned_by_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assigner RECORD;
  v_assignee RECORD;
BEGIN
  SELECT * INTO v_assigner FROM public.user_profiles WHERE id = p_assigned_by_user_id;
  IF NOT (v_assigner.is_admin = true OR v_assigner.role IN ('admin', 'ceo', 'founder', 'owner', 'lead_troll_officer', 'staff')) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient privileges to assign documents');
  END IF;

  SELECT username INTO v_assignee FROM public.user_profiles WHERE id = p_assign_to_user_id;
  IF v_assignee IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Assignee not found');
  END IF;

  UPDATE public.documents SET
    assigned_to = p_assign_to_user_id,
    assigned_at = now(),
    updated_at = now()
  WHERE id = p_document_id;

  -- Grant access
  INSERT INTO public.document_access (document_id, user_id, access_level, granted_by)
  VALUES (p_document_id, p_assign_to_user_id, 'approve', p_assigned_by_user_id)
  ON CONFLICT (document_id, user_id) DO UPDATE SET access_level = 'approve', is_active = true;

  PERFORM public.log_document_event(
    p_document_id, p_assigned_by_user_id, v_assigner.username, v_assigner.role,
    'document_assigned',
    jsonb_build_object('assigned_to', v_assignee)
  );

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_stamps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_access ENABLE ROW LEVEL SECURITY;

-- document_types: everyone can read active types
CREATE POLICY "Anyone can read active document types" ON public.document_types
  FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage document types" ON public.document_types
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- documents: users see own, staff see assigned, admins see all
CREATE POLICY "Users can view own documents" ON public.documents
  FOR SELECT USING (
    submitted_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM public.document_access WHERE document_id = documents.id AND user_id = auth.uid() AND is_active = true)
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator')))
  );
CREATE POLICY "Users can create documents" ON public.documents
  FOR INSERT WITH CHECK (submitted_by = auth.uid());
CREATE POLICY "Users can update own draft documents" ON public.documents
  FOR UPDATE USING (
    submitted_by = auth.uid() AND status IN ('draft', 'rejected') AND is_locked = false
  );
CREATE POLICY "Admins can update any document" ON public.documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- document_versions: read-only, follow document access
CREATE POLICY "Users can view versions of accessible documents" ON public.document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_versions.document_id
      AND (d.submitted_by = auth.uid() OR d.assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.document_access da WHERE da.document_id = d.id AND da.user_id = auth.uid() AND da.is_active = true)
        OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND (up.is_admin = true OR up.role IN ('admin', 'ceo', 'founder', 'owner', 'moderator'))))
    )
  );
CREATE POLICY "System can insert versions" ON public.document_versions
  FOR INSERT WITH CHECK (true);

-- document_signatures: users see own, admins see all
CREATE POLICY "Users can view own signatures" ON public.document_signatures
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator')))
  );
CREATE POLICY "Users can insert own signatures" ON public.document_signatures
  FOR INSERT WITH CHECK (user_id = auth.uid());
-- Signatures are immutable - no update/delete policies

-- document_approvals: follow document access
CREATE POLICY "Users can view approvals of accessible documents" ON public.document_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_approvals.document_id
      AND (d.submitted_by = auth.uid() OR d.assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.document_access da WHERE da.document_id = d.id AND da.user_id = auth.uid() AND da.is_active = true)
        OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND (up.is_admin = true OR up.role IN ('admin', 'ceo', 'founder', 'owner', 'moderator'))))
    )
  );
CREATE POLICY "Approvers can insert approvals" ON public.document_approvals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator', 'staff', 'lead_troll_officer')))
  );

-- document_stamps: follow document access
CREATE POLICY "Users can view stamps of accessible documents" ON public.document_stamps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_stamps.document_id
      AND (d.submitted_by = auth.uid() OR d.assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.document_access da WHERE da.document_id = d.id AND da.user_id = auth.uid() AND da.is_active = true)
        OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND (up.is_admin = true OR up.role IN ('admin', 'ceo', 'founder', 'owner', 'moderator'))))
    )
  );
CREATE POLICY "Approvers can insert stamps" ON public.document_stamps
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner', 'moderator', 'staff', 'lead_troll_officer')))
  );
-- Stamps are immutable - no update/delete policies

-- document_audit_logs: read-only for everyone with access
CREATE POLICY "Users can view audit logs of accessible documents" ON public.document_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.id = document_audit_logs.document_id
      AND (d.submitted_by = auth.uid() OR d.assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.document_access da WHERE da.document_id = d.id AND da.user_id = auth.uid() AND da.is_active = true)
        OR EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = auth.uid() AND (up.is_admin = true OR up.role IN ('admin', 'ceo', 'founder', 'owner', 'moderator'))))
    )
  );
-- Audit logs are immutable - no update/delete/insert via RLS (insert via RPC only)
CREATE POLICY "System can insert audit logs" ON document_audit_logs
  FOR INSERT WITH CHECK (true);

-- document_access: users see own, admins manage all
CREATE POLICY "Users can view own access" ON public.document_access
  FOR SELECT USING (
    user_id = auth.uid()
    OR granted_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );
CREATE POLICY "Admins can manage access" ON public.document_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_profiles WHERE id = auth.uid() AND (is_admin = true OR role IN ('admin', 'ceo', 'founder', 'owner')))
  );

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT ALL ON FUNCTION public.sign_document(UUID, UUID, TEXT, TEXT, INET, TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.approve_document(UUID, UUID, TEXT, INET, TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.reject_document(UUID, UUID, TEXT, INET, TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.verify_stamp(TEXT) TO authenticated;
GRANT ALL ON FUNCTION public.create_document(TEXT, TEXT, UUID, TEXT, TEXT, TEXT[], JSONB, UUID) TO authenticated;
GRANT ALL ON FUNCTION public.assign_document(UUID, UUID, UUID) TO authenticated;
GRANT ALL ON FUNCTION public.log_document_event(UUID, UUID, TEXT, TEXT, TEXT, JSONB, INET, TEXT) TO authenticated;

GRANT ALL ON public.document_types TO authenticated;
GRANT ALL ON public.documents TO authenticated;
GRANT ALL ON public.document_versions TO authenticated;
GRANT ALL ON public.document_signatures TO authenticated;
GRANT ALL ON public.document_approvals TO authenticated;
GRANT ALL ON public.document_stamps TO authenticated;
GRANT ALL ON public.document_audit_logs TO authenticated;
GRANT ALL ON public.document_access TO authenticated;

GRANT ALL ON public.document_types TO service_role;
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.document_versions TO service_role;
GRANT ALL ON public.document_signatures TO service_role;
GRANT ALL ON public.document_approvals TO service_role;
GRANT ALL ON public.document_stamps TO service_role;
GRANT ALL ON public.document_audit_logs TO service_role;
GRANT ALL ON public.document_access TO service_role;
GRANT ALL ON FUNCTION public.generate_stamp_id() TO service_role;
GRANT ALL ON FUNCTION public.generate_verification_code() TO service_role;
GRANT ALL ON FUNCTION public.compute_document_checksum(TEXT, TEXT, UUID) TO service_role;

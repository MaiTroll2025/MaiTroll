-- ============================================================================
-- Migration: Integrate MAI Record Label contracts with existing notary system
-- Date: 2026-08-18
-- Purpose: Link contracts to the existing notary documents system for
--          signing, approval, and stamping workflow.
-- ============================================================================

-- 0. Ensure notary system tables exist (document_types, documents)
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

INSERT INTO public.document_types (slug, name, description, category, sort_order) VALUES
  ('mai_record_label_contract', 'MAI Record Label Contract', 'Artist contract agreement for MAI Record Label', 'legal', 1)
ON CONFLICT (slug) DO NOTHING;

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

-- 1. Add document_id column to record_label_contracts to link to notary system
ALTER TABLE public.record_label_contracts
  ADD COLUMN IF NOT EXISTS document_id uuid;

-- 2. Create document type for MAI Record Label contracts if not exists
INSERT INTO public.document_types (slug, name, description, category, required_roles, is_active, sort_order)
VALUES (
  'mai_record_label_contract',
  'MAI Record Label Contract',
  'Artist contract agreement for MAI Record Label',
  'legal',
  ARRAY['secretary', 'notary', 'admin'],
  true,
  1
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Create RPC to create a notary document when a contract is created
CREATE OR REPLACE FUNCTION public.create_contract_notary_document(
  p_contract_id uuid,
  p_contract_number text,
  p_artist_id uuid,
  p_artist_stage_name text,
  p_tier text,
  p_artist_split_bps integer,
  p_label_split_bps integer,
  p_effective_at timestamptz,
  p_probation_ends_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_terms_version text DEFAULT '1.0',
  p_content text DEFAULT '',
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_document_id uuid;
  v_document_type_id uuid;
BEGIN
  SELECT id INTO v_document_type_id
  FROM public.document_types
  WHERE slug = 'mai_record_label_contract'
  LIMIT 1;

  INSERT INTO public.documents (
    document_type_id,
    document_type_slug,
    title,
    content,
    status,
    priority,
    submitted_by,
    submitted_at,
    assigned_to,
    tags,
    metadata,
    version
  ) VALUES (
    v_document_type_id,
    'mai_record_label_contract',
    format('MAI Record Label Contract %s - %s', p_contract_number, p_artist_stage_name),
    p_content,
    'pending',
    'high',
    p_created_by,
    now(),
    p_artist_id,
    ARRAY['mai_record_label', 'contract', p_tier],
    jsonb_build_object(
      'contract_id', p_contract_id,
      'contract_number', p_contract_number,
      'artist_id', p_artist_id,
      'artist_stage_name', p_artist_stage_name,
      'tier', p_tier,
      'artist_split_bps', p_artist_split_bps,
      'label_split_bps', p_label_split_bps,
      'effective_at', p_effective_at,
      'probation_ends_at', p_probation_ends_at,
      'expires_at', p_expires_at,
      'terms_version', p_terms_version
    ),
    1
  ) RETURNING id INTO v_document_id;

  UPDATE public.record_label_contracts
  SET document_id = v_document_id
  WHERE id = p_contract_id;

  RETURN v_document_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_contract_notary_document(uuid, text, text, text, text, integer, integer, timestamptz, timestamptz, timestamptz, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_contract_notary_document(uuid, text, text, text, text, integer, integer, timestamptz, timestamptz, timestamptz, text, text, uuid) TO service_role;

-- 4. Create RPC to sign contract and update contract status
CREATE OR REPLACE FUNCTION public.sign_contract_document(
  p_contract_id uuid,
  p_document_id uuid,
  p_user_id uuid,
  p_legal_name text,
  p_typed_signature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signature_id uuid;
  v_contract_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.record_label_contracts WHERE id = p_contract_id AND artist_id IN (
    SELECT id FROM public.record_label_artist_profiles WHERE user_id = p_user_id
  )) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found or not authorized');
  END IF;

  PERFORM sign_document(
    p_document_id,
    p_legal_name,
    p_typed_signature
  );

  UPDATE public.record_label_contracts
  SET
    status = 'pending_notarization',
    artist_signed_at = now(),
    updated_at = now()
  WHERE id = p_contract_id;

  PERFORM notify_secretary_contract_signed(
    p_contract_id,
    (SELECT contract_number FROM public.record_label_contracts WHERE id = p_contract_id),
    (SELECT rap.stage_name FROM public.record_label_artist_profiles rap WHERE rap.id = (SELECT artist_id FROM public.record_label_contracts WHERE id = p_contract_id))
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sign_contract_document(uuid, uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sign_contract_document(uuid, uuid, uuid, text, text) TO service_role;

-- 5. Create RPC to notarize contract (approve the notary document)
CREATE OR REPLACE FUNCTION public.notarize_contract_document(
  p_contract_id uuid,
  p_document_id uuid,
  p_notary_id uuid,
  p_comments text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract_exists boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.record_label_contracts WHERE id = p_contract_id) INTO v_contract_exists;

  IF NOT v_contract_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;

  PERFORM approve_document(
    p_document_id,
    p_comments
  );

  UPDATE public.record_label_contracts
  SET
    status = 'active',
    notarized_at = now(),
    notarized_by = p_notary_id,
    updated_at = now()
  WHERE id = p_contract_id;

  PERFORM notify_artist_contract_notarized(
    p_contract_id,
    (SELECT contract_number FROM public.record_label_contracts WHERE id = p_contract_id)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.notarize_contract_document(uuid, uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notarize_contract_document(uuid, uuid, uuid, text) TO service_role;

-- 6. Update accept_contract to work with notary document signing
CREATE OR REPLACE FUNCTION public.accept_contract_with_notary(
  p_contract_id uuid,
  p_user_id uuid,
  p_legal_name text,
  p_typed_signature text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contract record;
  v_document_id uuid;
BEGIN
  SELECT * INTO v_contract
  FROM public.record_label_contracts
  WHERE id = p_contract_id
    AND artist_id IN (
      SELECT id FROM public.record_label_artist_profiles WHERE user_id = p_user_id
    );

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract not found');
  END IF;

  IF v_contract.status != 'pending_signature' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Contract is not pending signature');
  END IF;

  v_document_id := v_contract.document_id;

  IF v_document_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No notary document linked to this contract');
  END IF;

  PERFORM sign_contract_document(
    p_contract_id,
    v_document_id,
    p_user_id,
    p_legal_name,
    p_typed_signature
  );

  RETURN jsonb_build_object('success', true, 'contract_id', p_contract_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_contract_with_notary(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_contract_with_notary(uuid, uuid, text, text) TO service_role;

-- 7. Notifications
CREATE OR REPLACE FUNCTION public.notify_artist_new_contract(
  p_contract_id uuid,
  p_artist_id uuid,
  p_contract_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_user_id uuid;
BEGIN
  SELECT user_id INTO v_artist_user_id
  FROM public.record_label_artist_profiles
  WHERE id = p_artist_id;

  IF v_artist_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      created_at
    ) VALUES (
      v_artist_user_id,
      'mai_contract_pending_signature',
      'New Contract Ready for Review',
      format('Your MAI Record Label contract %s is ready for review. Please sign to accept the terms.', p_contract_number),
      jsonb_build_object(
        'contract_id', p_contract_id,
        'contract_number', p_contract_number,
        'action_url', format('/artist/contract/%s', p_contract_id)
      ),
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_artist_new_contract(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_artist_new_contract(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_secretary_contract_signed(
  p_contract_id uuid,
  p_contract_number text,
  p_artist_stage_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_secretary_user_id uuid;
BEGIN
  SELECT id INTO v_secretary_user_id
  FROM public.user_profiles
  WHERE role = 'secretary'
  LIMIT 1;

  IF v_secretary_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      created_at
    ) VALUES (
      v_secretary_user_id,
      'mai_contract_signed_by_artist',
      'Contract Signed - Awaiting Notarization',
      format('Artist %s has signed contract %s. Please notarize to make it official.', p_artist_stage_name, p_contract_number),
      jsonb_build_object(
        'contract_id', p_contract_id,
        'contract_number', p_contract_number,
        'action_url', format('/secretary/contracts/%s', p_contract_id)
      ),
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_secretary_contract_signed(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_secretary_contract_signed(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_artist_contract_notarized(
  p_contract_id uuid,
  p_contract_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_artist_user_id uuid;
BEGIN
  SELECT rap.user_id INTO v_artist_user_id
  FROM public.record_label_contracts rlc
  JOIN public.record_label_artist_profiles rap ON rap.id = rlc.artist_id
  WHERE rlc.id = p_contract_id;

  IF v_artist_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      metadata,
      created_at
    ) VALUES (
      v_artist_user_id,
      'mai_contract_notarized',
      'Contract Officially Executed',
      format('Your MAI Record Label contract %s has been notarized and is now official. You can download your signed contract.', p_contract_number),
      jsonb_build_object(
        'contract_id', p_contract_id,
        'contract_number', p_contract_number,
        'action_url', format('/artist/contract/%s', p_contract_id)
      ),
      now()
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notify_artist_contract_notarized(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_artist_contract_notarized(uuid, text) TO service_role;

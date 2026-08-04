-- ============================================================================
-- Beta Feedback system for Mai Troll
-- Tables, constraints, indexes, RLS, and secure RPCs.
-- Reuses existing authoritative sources:
--   * roles via user_profiles columns / user_role_grants (mirrors is_staff)
--   * chat-disabled via user_broadcast_restrictions + broadcast_mod_actions
--   * notifications via existing public.create_notification()
-- ============================================================================

-- Public, human-friendly sequence for visible feedback IDs (TC-BETA-1234)
CREATE SEQUENCE IF NOT EXISTS public.beta_feedback_public_seq START WITH 1000;

-- ----------------------------------------------------------------------------
-- 1. CORE TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id text NOT NULL DEFAULT 'TC-BETA-' || nextval('public.beta_feedback_public_seq')::text,
  user_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  affected_feature text,
  affected_route text,
  device_type text,
  browser_name text,
  user_agent text,
  viewport_width integer,
  viewport_height integer,
  is_pwa boolean DEFAULT false,
  app_version text,
  screenshot_url text,
  severity text,
  priority text DEFAULT 'normal',
  status text DEFAULT 'submitted',
  assigned_to uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  duplicate_of uuid,
  moderator_response text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  archived_at timestamptz
);

-- ----------------------------------------------------------------------------
-- 2. INTERNAL NOTES (staff only)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_feedback_internal_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.beta_feedback(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOG (immutable, written only by trusted functions)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_feedback_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.beta_feedback(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. REPLIES (optional conversation thread)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.beta_feedback_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.beta_feedback(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'user_visible',
  created_at timestamptz DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 5. SELF REFERENCE for duplicates (added after both tables exist)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_duplicate_of_fkey'
  ) THEN
    ALTER TABLE public.beta_feedback
      ADD CONSTRAINT beta_feedback_duplicate_of_fkey
      FOREIGN KEY (duplicate_of) REFERENCES public.beta_feedback(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. CHECK CONSTRAINTS (defense in depth; RPCs also validate)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_category_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_category_check
      CHECK (category IN (
        'Bug Report','Mobile / PWA','Broadcast','Chat','Neighborhoods','Troll Court',
        'Troll Coins','Performance','Account / Login','Design / UI','Feature Request','Other'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_status_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_status_check
      CHECK (status IN (
        'submitted','under_review','needs_information','confirmed','planned','in_progress',
        'fixed','declined','duplicate','closed'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_priority_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_priority_check
      CHECK (priority IN ('low','normal','high','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_severity_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_severity_check
      CHECK (severity IS NULL OR severity IN ('minor','inconvenient','feature_blocking','app_unusable'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_device_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_device_check
      CHECK (device_type IS NULL OR device_type IN (
        'iPhone','iPad','Android Phone','Android Tablet','Windows','macOS','Chromebook','Other'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_title_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_title_check
      CHECK (char_length(btrim(title)) >= 5 AND char_length(btrim(title)) <= 150);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_description_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_description_check
      CHECK (char_length(btrim(description)) >= 10 AND char_length(btrim(description)) <= 5000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_response_check') THEN
    ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_response_check
      CHECK (moderator_response IS NULL OR char_length(moderator_response) <= 5000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_reply_visibility_check') THEN
    ALTER TABLE public.beta_feedback_replies ADD CONSTRAINT beta_feedback_reply_visibility_check
      CHECK (visibility IN ('user_visible','staff_only'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_reply_body_check') THEN
    ALTER TABLE public.beta_feedback_replies ADD CONSTRAINT beta_feedback_reply_body_check
      CHECK (char_length(btrim(body)) >= 1 AND char_length(btrim(body)) <= 5000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'beta_feedback_note_check') THEN
    ALTER TABLE public.beta_feedback_internal_notes ADD CONSTRAINT beta_feedback_note_check
      CHECK (char_length(btrim(note)) >= 1 AND char_length(btrim(note)) <= 5000);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON public.beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON public.beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_category ON public.beta_feedback(category);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_priority ON public.beta_feedback(priority);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_assigned_to ON public.beta_feedback(assigned_to);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON public.beta_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_archived_at ON public.beta_feedback(archived_at);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_public_id ON public.beta_feedback(public_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_internal_notes_feedback ON public.beta_feedback_internal_notes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_audit_feedback ON public.beta_feedback_audit_log(feedback_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_replies_feedback ON public.beta_feedback_replies(feedback_id);

-- ----------------------------------------------------------------------------
-- 8. HELPER FUNCTIONS
-- ----------------------------------------------------------------------------

-- Authoritative moderation role check for beta feedback.
-- Reuses existing role columns / grants. Explicitly excludes broadcasters,
-- landlords, neighborhood owners, and BroadOfficers (they are NOT moderators).
CREATE OR REPLACE FUNCTION public.is_beta_feedback_moderator(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = p_user_id
      AND (
        role IN ('admin','superadmin','ceo','moderator','lead_troll_officer','troll_officer','secretary','pastor')
        OR troll_role IN ('admin','superadmin','ceo','moderator','lead_troll_officer','troll_officer')
        OR COALESCE(is_admin, false) = true
        OR COALESCE(is_lead_officer, false) = true
        OR COALESCE(is_troll_officer, false) = true
      )
  )
  OR EXISTS (
    SELECT 1 FROM public.user_role_grants ur
    JOIN public.system_roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
      AND r.is_staff = true
      AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
      AND ur.revoked_at IS NULL
  );
$$;

-- Authoritative chat-disabled check. Reuses the existing restriction system:
--   * user_broadcast_restrictions.chat_disabled (active, not expired)
--   * broadcast_mod_actions disable_chat (active, not expired)
-- Does NOT rely on any global user_profiles.chat_disabled flag.
CREATE OR REPLACE FUNCTION public.is_user_chat_disabled(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_broadcast_restrictions
    WHERE user_id = p_user_id
      AND chat_disabled = true
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  )
  OR EXISTS (
    SELECT 1 FROM public.broadcast_mod_actions
    WHERE target_user_id = p_user_id
      AND action_type = 'disable_chat'
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

-- Lightweight audit writer used by all beta feedback RPCs.
CREATE OR REPLACE FUNCTION public.log_beta_feedback_audit(
  p_feedback_id uuid,
  p_actor_id uuid,
  p_action text,
  p_old_values jsonb,
  p_new_values jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.beta_feedback_audit_log (feedback_id, actor_id, action, old_values, new_values)
  VALUES (p_feedback_id, p_actor_id, p_action, p_old_values, p_new_values);
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. SECURE SUBMISSION RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_beta_feedback(
  p_category text,
  p_title text,
  p_description text,
  p_affected_feature text DEFAULT NULL,
  p_affected_route text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_browser_name text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_viewport_width integer DEFAULT NULL,
  p_viewport_height integer DEFAULT NULL,
  p_is_pwa boolean DEFAULT false,
  p_app_version text DEFAULT NULL,
  p_screenshot_url text DEFAULT NULL,
  p_severity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_exists boolean := false;
  v_title text := btrim(COALESCE(p_title, ''));
  v_description text := btrim(COALESCE(p_description, ''));
  v_category text := btrim(COALESCE(p_category, ''));
  v_severity text := btrim(COALESCE(p_severity, ''));
  v_device text := btrim(COALESCE(p_device_type, ''));
  v_row public.beta_feedback%ROWTYPE;
  v_existing_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = v_user_id)
    INTO v_profile_exists;
  IF NOT v_profile_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF public.is_user_chat_disabled(v_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'chat_disabled');
  END IF;

  IF v_category = '' OR v_category NOT IN (
    'Bug Report','Mobile / PWA','Broadcast','Chat','Neighborhoods','Troll Court',
    'Troll Coins','Performance','Account / Login','Design / UI','Feature Request','Other'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid category');
  END IF;

  IF char_length(v_title) < 5 OR char_length(v_title) > 150 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Title must be 5-150 characters');
  END IF;

  IF char_length(v_description) < 10 OR char_length(v_description) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Description must be 10-5000 characters');
  END IF;

  IF v_severity IS NOT NULL AND v_severity <> '' AND v_severity NOT IN
    ('minor','inconvenient','feature_blocking','app_unusable') THEN
    v_severity := NULL;
  END IF;

  IF v_device IS NOT NULL AND v_device <> '' AND v_device NOT IN
    ('iPhone','iPad','Android Phone','Android Tablet','Windows','macOS','Chromebook','Other') THEN
    v_device := NULL;
  END IF;

  -- Idempotency: if an identical submission exists in the last 30 seconds, return it.
  SELECT id INTO v_existing_id
  FROM public.beta_feedback
  WHERE user_id = v_user_id
    AND category = v_category
    AND title = v_title
    AND description = v_description
    AND created_at > now() - interval '30 seconds'
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    SELECT * INTO v_row FROM public.beta_feedback WHERE id = v_existing_id;
    RETURN jsonb_build_object('success', true, 'duplicate', true, 'feedback', to_jsonb(v_row));
  END IF;

  INSERT INTO public.beta_feedback (
    user_id, category, title, description, affected_feature, affected_route,
    device_type, browser_name, user_agent, viewport_width, viewport_height,
    is_pwa, app_version, screenshot_url, severity
  ) VALUES (
    v_user_id, v_category, v_title, v_description,
    NULLIF(btrim(COALESCE(p_affected_feature, '')), ''),
    NULLIF(btrim(COALESCE(p_affected_route, '')), ''),
    v_device,
    NULLIF(btrim(COALESCE(p_browser_name, '')), ''),
    NULLIF(btrim(COALESCE(p_user_agent, '')), ''),
    p_viewport_width, p_viewport_height,
    COALESCE(p_is_pwa, false),
    NULLIF(btrim(COALESCE(p_app_version, '')), ''),
    NULLIF(btrim(COALESCE(p_screenshot_url, '')), ''),
    v_severity
  )
  RETURNING * INTO v_row;

  PERFORM public.log_beta_feedback_audit(
    v_row.id, v_user_id, 'submit',
    NULL,
    jsonb_build_object('category', v_row.category, 'title', v_row.title, 'status', v_row.status)
  );

  RETURN jsonb_build_object('success', true, 'duplicate', false, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 10. NOTIFICATION HELPER (reuses public.create_notification)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_beta_feedback_user(
  p_feedback_id uuid,
  p_type text,
  p_title text,
  p_message text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_public_id text;
BEGIN
  SELECT user_id, public_id INTO v_user_id, v_public_id
  FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    PERFORM public.create_notification(
      v_user_id, p_type, p_title, p_message,
      jsonb_build_object('feedback_id', p_feedback_id, 'public_id', v_public_id, 'link', '/beta-feedback')
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
END;
$$;

-- ----------------------------------------------------------------------------
-- 11. MODERATOR RPCs
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_beta_feedback_status(
  p_feedback_id uuid,
  p_status text,
  p_notify_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.beta_feedback%ROWTYPE;
  v_row public.beta_feedback%ROWTYPE;
  v_status text := btrim(COALESCE(p_status, ''));
  v_note text := btrim(COALESCE(p_notify_note, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF v_status = '' OR v_status NOT IN (
    'submitted','under_review','needs_information','confirmed','planned','in_progress',
    'fixed','declined','duplicate','closed'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_old FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_old.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;

  UPDATE public.beta_feedback
  SET status = v_status,
      updated_at = now(),
      resolved_at = CASE
        WHEN v_status IN ('fixed','closed','declined','duplicate') AND v_old.resolved_at IS NULL
          THEN now()
        WHEN v_status NOT IN ('fixed','closed','declined','duplicate')
          THEN NULL
        ELSE v_old.resolved_at
      END
  WHERE id = p_feedback_id
  RETURNING * INTO v_row;

  PERFORM public.log_beta_feedback_audit(
    p_feedback_id, v_actor, 'status_change',
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', v_status)
  );

  IF v_status = 'needs_information' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'More information needed',
      COALESCE(v_note, 'A moderator needs more details about your feedback.') || ' (' || v_row.public_id || ')');
  ELSIF v_status = 'confirmed' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'Feedback confirmed', 'Your feedback ' || v_row.public_id || ' has been confirmed.');
  ELSIF v_status = 'planned' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'Feedback planned', 'Your feedback ' || v_row.public_id || ' is now planned.');
  ELSIF v_status = 'in_progress' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'Work in progress', 'Work has started on your feedback ' || v_row.public_id || '.');
  ELSIF v_status = 'fixed' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'Feedback fixed', 'Your feedback ' || v_row.public_id || ' has been fixed.');
  ELSIF v_status = 'declined' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'Feedback declined', COALESCE(v_note, 'Your feedback ' || v_row.public_id || ' was declined.') || ' (' || v_row.public_id || ')');
  ELSIF v_status = 'duplicate' THEN
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
      'Feedback marked duplicate', 'Your feedback ' || v_row.public_id || ' was marked as a duplicate.');
  END IF;

  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_beta_feedback_priority(
  p_feedback_id uuid,
  p_priority text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.beta_feedback%ROWTYPE;
  v_row public.beta_feedback%ROWTYPE;
  v_priority text := btrim(COALESCE(p_priority, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF v_priority = '' OR v_priority NOT IN ('low','normal','high','critical') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid priority');
  END IF;
  SELECT * INTO v_old FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_old.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  UPDATE public.beta_feedback SET priority = v_priority, updated_at = now()
  WHERE id = p_feedback_id RETURNING * INTO v_row;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'priority_change',
    jsonb_build_object('priority', v_old.priority), jsonb_build_object('priority', v_priority));
  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_beta_feedback(
  p_feedback_id uuid,
  p_assigned_to uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.beta_feedback%ROWTYPE;
  v_row public.beta_feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles WHERE id = p_assigned_to
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Assignee not found');
  END IF;
  SELECT * INTO v_old FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_old.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  UPDATE public.beta_feedback SET assigned_to = p_assigned_to, updated_at = now()
  WHERE id = p_feedback_id RETURNING * INTO v_row;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'assign',
    jsonb_build_object('assigned_to', v_old.assigned_to), jsonb_build_object('assigned_to', p_assigned_to));
  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_beta_feedback(
  p_feedback_id uuid,
  p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.beta_feedback%ROWTYPE;
  v_row public.beta_feedback%ROWTYPE;
  v_response text := btrim(COALESCE(p_response, ''));
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF char_length(v_response) < 1 OR char_length(v_response) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Response must be 1-5000 characters');
  END IF;
  SELECT * INTO v_old FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_old.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  UPDATE public.beta_feedback SET moderator_response = v_response, updated_at = now()
  WHERE id = p_feedback_id RETURNING * INTO v_row;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'respond',
    jsonb_build_object('moderator_response', v_old.moderator_response), jsonb_build_object('moderator_response', v_response));
  PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback_reply',
    'New response to your feedback', 'A moderator replied to your feedback ' || v_row.public_id || '.');
  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_beta_feedback_internal_note(
  p_feedback_id uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_note text := btrim(COALESCE(p_note, ''));
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF char_length(v_note) < 1 OR char_length(v_note) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Note must be 1-5000 characters');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.beta_feedback WHERE id = p_feedback_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  INSERT INTO public.beta_feedback_internal_notes (feedback_id, moderator_id, note)
  VALUES (p_feedback_id, v_actor, v_note) RETURNING id INTO v_id;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'internal_note',
    NULL, jsonb_build_object('note_id', v_id));
  RETURN jsonb_build_object('success', true, 'note_id', v_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_beta_feedback_duplicate(
  p_feedback_id uuid,
  p_duplicate_of uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_old public.beta_feedback%ROWTYPE;
  v_row public.beta_feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF p_duplicate_of IS NULL OR p_duplicate_of = p_feedback_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid duplicate target');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.beta_feedback WHERE id = p_duplicate_of) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate target not found');
  END IF;
  SELECT * INTO v_old FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_old.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  UPDATE public.beta_feedback
  SET duplicate_of = p_duplicate_of, status = 'duplicate', updated_at = now(),
      resolved_at = COALESCE(v_old.resolved_at, now())
  WHERE id = p_feedback_id RETURNING * INTO v_row;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'mark_duplicate',
    jsonb_build_object('duplicate_of', v_old.duplicate_of, 'status', v_old.status),
    jsonb_build_object('duplicate_of', p_duplicate_of, 'status', 'duplicate'));
  PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback',
    'Feedback marked duplicate', 'Your feedback ' || v_row.public_id || ' was marked as a duplicate.');
  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.archive_beta_feedback(
  p_feedback_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.beta_feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  UPDATE public.beta_feedback SET archived_at = now(), updated_at = now()
  WHERE id = p_feedback_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'archive',
    NULL, jsonb_build_object('archived_at', v_row.archived_at));
  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_beta_feedback(
  p_feedback_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_row public.beta_feedback%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  UPDATE public.beta_feedback SET archived_at = NULL, updated_at = now()
  WHERE id = p_feedback_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;
  PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'restore',
    NULL, jsonb_build_object('archived_at', NULL));
  RETURN jsonb_build_object('success', true, 'feedback', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. REPLY RPC (user + moderator thread)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_beta_feedback_reply(
  p_feedback_id uuid,
  p_body text,
  p_visibility text DEFAULT 'user_visible'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '10s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_feedback public.beta_feedback%ROWTYPE;
  v_body text := btrim(COALESCE(p_body, ''));
  v_visibility text := btrim(COALESCE(p_visibility, 'user_visible'));
  v_id uuid;
  v_row public.beta_feedback_replies%ROWTYPE;
BEGIN
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  IF v_visibility NOT IN ('user_visible','staff_only') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid visibility');
  END IF;
  IF char_length(v_body) < 1 OR char_length(v_body) > 5000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reply must be 1-5000 characters');
  END IF;
  SELECT * INTO v_feedback FROM public.beta_feedback WHERE id = p_feedback_id;
  IF v_feedback.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not found');
  END IF;

  IF v_visibility = 'staff_only' THEN
    IF NOT public.is_beta_feedback_moderator(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
  ELSE
    IF v_feedback.user_id <> v_actor THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    IF public.is_user_chat_disabled(v_actor) THEN
      RETURN jsonb_build_object('success', false, 'error', 'chat_disabled');
    END IF;
  END IF;

  INSERT INTO public.beta_feedback_replies (feedback_id, author_id, body, visibility)
  VALUES (p_feedback_id, v_actor, v_body, v_visibility) RETURNING * INTO v_row;

  UPDATE public.beta_feedback SET updated_at = now() WHERE id = p_feedback_id;

  IF v_visibility = 'staff_only' THEN
    PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'staff_reply', NULL, NULL);
  ELSE
    PERFORM public.log_beta_feedback_audit(p_feedback_id, v_actor, 'user_reply', NULL, NULL);
    PERFORM public.notify_beta_feedback_user(p_feedback_id, 'beta_feedback_reply',
      'New reply to your feedback', 'A moderator replied to your feedback ' || v_feedback.public_id || '.');
  END IF;

  RETURN jsonb_build_object('success', true, 'reply', to_jsonb(v_row));
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. BULK MODERATOR ACTIONS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bulk_update_beta_feedback(
  p_ids uuid[],
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_archive boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '30s'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_id uuid;
  v_old public.beta_feedback%ROWTYPE;
  v_updated integer := 0;
  v_valid_status boolean := (p_status IS NULL OR p_status IN (
    'submitted','under_review','needs_information','confirmed','planned','in_progress',
    'fixed','declined','duplicate','closed'));
  v_valid_priority boolean := (p_priority IS NULL OR p_priority IN ('low','normal','high','critical'));
  v_valid_category boolean := (p_category IS NULL OR p_category IN (
    'Bug Report','Mobile / PWA','Broadcast','Chat','Neighborhoods','Troll Court',
    'Troll Coins','Performance','Account / Login','Design / UI','Feature Request','Other'));
BEGIN
  IF v_actor IS NULL OR NOT public.is_beta_feedback_moderator(v_actor) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  IF NOT (v_valid_status AND v_valid_priority AND v_valid_category) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid bulk value');
  END IF;
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No ids provided');
  END IF;

  FOREACH v_id IN ARRAY p_ids LOOP
    SELECT * INTO v_old FROM public.beta_feedback WHERE id = v_id;
    IF v_old.id IS NULL THEN
      CONTINUE;
    END IF;
    UPDATE public.beta_feedback
    SET status = COALESCE(p_status, status),
        priority = COALESCE(p_priority, priority),
        category = COALESCE(p_category, category),
        archived_at = CASE WHEN p_archive IS NULL THEN archived_at
                           WHEN p_archive THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = v_id;
    PERFORM public.log_beta_feedback_audit(v_id, v_actor, 'bulk_update',
      jsonb_build_object('status', v_old.status, 'priority', v_old.priority, 'category', v_old.category),
      jsonb_build_object('status', COALESCE(p_status, v_old.status),
                         'priority', COALESCE(p_priority, v_old.priority),
                         'category', COALESCE(p_category, v_old.category),
                         'archive', p_archive));
    v_updated := v_updated + 1;
  END LOOP;

  RETURN jsonb_build_object('success', true, 'updated', v_updated);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. MODERATOR GROUPING + SUMMARY QUERIES
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_beta_feedback_user_groups(
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  username text,
  avatar_url text,
  submission_count bigint,
  latest_submission_at timestamptz,
  unresolved_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
BEGIN
  IF NOT public.is_beta_feedback_moderator(auth.uid()) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    bf.user_id,
    up.username,
    up.avatar_url,
    COUNT(*) AS submission_count,
    MAX(bf.created_at) AS latest_submission_at,
    COUNT(*) FILTER (WHERE bf.status NOT IN ('fixed','closed','declined','duplicate')) AS unresolved_count
  FROM public.beta_feedback bf
  JOIN public.user_profiles up ON up.id = bf.user_id
  GROUP BY bf.user_id, up.username, up.avatar_url
  ORDER BY latest_submission_at DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_beta_feedback_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET statement_timeout = '15s'
AS $$
DECLARE
  v_total integer := 0;
  v_submitted integer := 0;
  v_under_review integer := 0;
  v_critical integer := 0;
  v_fixed integer := 0;
  v_unique_reporters integer := 0;
BEGIN
  IF NOT public.is_beta_feedback_moderator(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'submitted'),
    COUNT(*) FILTER (WHERE status = 'under_review'),
    COUNT(*) FILTER (WHERE priority = 'critical' AND archived_at IS NULL),
    COUNT(*) FILTER (WHERE status = 'fixed'),
    COUNT(DISTINCT user_id)
  INTO v_total, v_submitted, v_under_review, v_critical, v_fixed, v_unique_reporters
  FROM public.beta_feedback;
  RETURN jsonb_build_object(
    'success', true,
    'total', v_total,
    'submitted', v_submitted,
    'under_review', v_under_review,
    'critical', v_critical,
    'fixed', v_fixed,
    'unique_reporters', v_unique_reporters
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

-- beta_feedback
ALTER TABLE public.beta_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bf_select" ON public.beta_feedback;
CREATE POLICY "bf_select" ON public.beta_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_beta_feedback_moderator(auth.uid()));

DROP POLICY IF EXISTS "bf_insert_denied" ON public.beta_feedback;
CREATE POLICY "bf_insert_denied" ON public.beta_feedback
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "bf_update_denied" ON public.beta_feedback;
CREATE POLICY "bf_update_denied" ON public.beta_feedback
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "bf_delete_denied" ON public.beta_feedback;
CREATE POLICY "bf_delete_denied" ON public.beta_feedback
  FOR DELETE TO authenticated USING (false);

-- internal notes (staff only)
ALTER TABLE public.beta_feedback_internal_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bfn_select" ON public.beta_feedback_internal_notes;
CREATE POLICY "bfn_select" ON public.beta_feedback_internal_notes
  FOR SELECT TO authenticated
  USING (public.is_beta_feedback_moderator(auth.uid()));

DROP POLICY IF EXISTS "bfn_all" ON public.beta_feedback_internal_notes;
CREATE POLICY "bfn_all" ON public.beta_feedback_internal_notes
  FOR ALL TO authenticated
  USING (public.is_beta_feedback_moderator(auth.uid()))
  WITH CHECK (public.is_beta_feedback_moderator(auth.uid()));

-- audit log (read by staff; written only by trusted functions)
ALTER TABLE public.beta_feedback_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bfa_select" ON public.beta_feedback_audit_log;
CREATE POLICY "bfa_select" ON public.beta_feedback_audit_log
  FOR SELECT TO authenticated
  USING (public.is_beta_feedback_moderator(auth.uid()));

DROP POLICY IF EXISTS "bfa_insert_denied" ON public.beta_feedback_audit_log;
CREATE POLICY "bfa_insert_denied" ON public.beta_feedback_audit_log
  FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "bfa_update_denied" ON public.beta_feedback_audit_log;
CREATE POLICY "bfa_update_denied" ON public.beta_feedback_audit_log
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "bfa_delete_denied" ON public.beta_feedback_audit_log;
CREATE POLICY "bfa_delete_denied" ON public.beta_feedback_audit_log
  FOR DELETE TO authenticated USING (false);

-- replies (users read user_visible on own; moderators read all; careful INSERT)
ALTER TABLE public.beta_feedback_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bfr_select" ON public.beta_feedback_replies;
CREATE POLICY "bfr_select" ON public.beta_feedback_replies
  FOR SELECT TO authenticated
  USING (
    visibility = 'user_visible' AND EXISTS (
      SELECT 1 FROM public.beta_feedback bf WHERE bf.id = feedback_id AND bf.user_id = auth.uid()
    )
    OR visibility = 'user_visible' AND auth.uid() = author_id
    OR public.is_beta_feedback_moderator(auth.uid())
  );

DROP POLICY IF EXISTS "bfr_insert_user" ON public.beta_feedback_replies;
CREATE POLICY "bfr_insert_user" ON public.beta_feedback_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    visibility = 'user_visible'
    AND auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.beta_feedback bf WHERE bf.id = feedback_id AND bf.user_id = auth.uid()
    )
    AND NOT public.is_user_chat_disabled(auth.uid())
  );

DROP POLICY IF EXISTS "bfr_insert_staff" ON public.beta_feedback_replies;
CREATE POLICY "bfr_insert_staff" ON public.beta_feedback_replies
  FOR INSERT TO authenticated
  WITH CHECK (
    visibility = 'staff_only'
    AND auth.uid() = author_id
    AND public.is_beta_feedback_moderator(auth.uid())
  );

DROP POLICY IF EXISTS "bfr_delete_staff" ON public.beta_feedback_replies;
CREATE POLICY "bfr_delete_staff" ON public.beta_feedback_replies
  FOR DELETE TO authenticated
  USING (public.is_beta_feedback_moderator(auth.uid()));

-- ----------------------------------------------------------------------------
-- 16. STORAGE BUCKET (optional screenshot uploads)
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('feedback-attachments', 'feedback-attachments', true, 5242880, ARRAY['image/png','image/jpeg','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif'];

DROP POLICY IF EXISTS "bf_attachments_select" ON storage.objects;
CREATE POLICY "bf_attachments_select" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'feedback-attachments');

DROP POLICY IF EXISTS "bf_attachments_insert" ON storage.objects;
CREATE POLICY "bf_attachments_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "bf_attachments_delete" ON storage.objects;
CREATE POLICY "bf_attachments_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ----------------------------------------------------------------------------
-- 17. REALTIME
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['public.beta_feedback', 'public.beta_feedback_replies']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = split_part(v_table, '.', 1)
        AND tablename = split_part(v_table, '.', 2)
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %s', v_table);
    END IF;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 18. GRANTS
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.submit_beta_feedback(
  text, text, text, text, text, text, text, text, integer, integer, boolean, text, text, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_beta_feedback_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_beta_feedback_priority(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_beta_feedback(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_beta_feedback(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_beta_feedback_internal_note(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_beta_feedback_duplicate(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.archive_beta_feedback(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_beta_feedback(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_beta_feedback_reply(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_update_beta_feedback(uuid[], text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_beta_feedback_user_groups(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_beta_feedback_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_beta_feedback_moderator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_user_chat_disabled(uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_feedback_internal_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_feedback_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.beta_feedback_replies TO authenticated;

GRANT ALL ON public.beta_feedback TO service_role;
GRANT ALL ON public.beta_feedback_internal_notes TO service_role;
GRANT ALL ON public.beta_feedback_audit_log TO service_role;
GRANT ALL ON public.beta_feedback_replies TO service_role;
GRANT ALL ON SEQUENCE public.beta_feedback_public_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.beta_feedback_public_seq TO authenticated;


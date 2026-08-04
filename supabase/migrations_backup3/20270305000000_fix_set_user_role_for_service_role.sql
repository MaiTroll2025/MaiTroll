CREATE OR REPLACE FUNCTION public.set_user_role(
  target_user UUID,
  new_role TEXT,
  reason TEXT,
  acting_admin_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_old_role TEXT;
  v_admin_id UUID;
BEGIN
  -- Get current user (admin)
  v_admin_id := auth.uid();
  
  -- If called by service role and acting_admin_id is provided, use it
  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
      v_admin_id := acting_admin_id;
  END IF;
  
  -- Check permissions (simple check, RLS should handle more)
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_admin_id AND (role = 'admin' OR is_admin = true)) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can change roles. (Admin ID: %, Role: %)', v_admin_id, auth.role();
  END IF;

  -- Get old role
  SELECT role INTO v_old_role FROM user_profiles WHERE id = target_user;

  -- Update role
  UPDATE user_profiles 
  SET 
      role = new_role,
      is_admin = (new_role = 'admin'),
      is_lead_officer = (new_role = 'lead_troll_officer'),
      is_troll_officer = (new_role IN ('troll_officer', 'lead_troll_officer')),
      is_troller = (new_role = 'troller'),
      updated_at = now()
  WHERE id = target_user;

  -- Log change
  INSERT INTO role_change_log (target_user, changed_by, old_role, new_role, reason, created_at)
  VALUES (target_user, v_admin_id, v_old_role, new_role, reason, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Soft Delete User
CREATE OR REPLACE FUNCTION public.admin_soft_delete_user(
    p_user_id UUID,
    p_reason TEXT DEFAULT 'Admin deleted user',
    p_acting_admin_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_admin_id UUID;
BEGIN
    v_admin_id := auth.uid();

    -- If called by service role and acting_admin_id is provided, use it
    IF auth.role() = 'service_role' AND p_acting_admin_id IS NOT NULL THEN
        v_admin_id := p_acting_admin_id;
    END IF;

    -- Verify Admin
    IF NOT EXISTS (
        SELECT 1 FROM public.user_profiles 
        WHERE id = v_admin_id 
        AND (role = 'admin' OR is_admin = true)
    ) THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Mark as banned and wipe sensitive info (Soft Delete)
    UPDATE public.user_profiles
    SET 
        is_banned = true,
        banned_until = '2099-01-01 00:00:00+00',
        username = 'Deleted User ' || substring(id::text, 1, 8),
        avatar_url = null,
        bio = null,
        email = 'deleted_' || id || '@deleted.com' -- Obfuscate email if stored here
    WHERE id = p_user_id;

    -- Log it
    INSERT INTO public.moderation_logs (
        admin_id,
        target_user_id,
        action_type,
        reason
    ) VALUES (
        v_admin_id,
        p_user_id,
        'soft_delete',
        p_reason
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ban User
CREATE OR REPLACE FUNCTION public.ban_user(
  target UUID,
  minutes INTEGER,
  reason TEXT,
  acting_admin_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_actor_id UUID;
  v_actor_role TEXT;
  v_is_admin BOOLEAN;
  v_is_lead BOOLEAN;
  v_is_officer BOOLEAN;
  v_target_is_admin BOOLEAN;
  v_until TIMESTAMPTZ;
BEGIN
  v_actor_id := auth.uid();
  
  -- Service Role Bypass
  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
      v_actor_id := acting_admin_id;
  END IF;

  -- Actor permissions
  SELECT role, is_admin, is_lead_officer, is_troll_officer
  INTO v_actor_role, v_is_admin, v_is_lead, v_is_officer
  FROM public.user_profiles
  WHERE id = v_actor_id;

  IF NOT (v_is_admin OR v_is_lead OR v_is_officer OR v_actor_role IN ('admin','lead_troll_officer','troll_officer')) THEN
    INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, status, error_message)
    VALUES (v_actor_id, target, 'ban_user', reason, 'failed', 'Not authorized');
    RETURN jsonb_build_object('status','error','message','Not authorized');
  END IF;

  -- Block banning admin
  SELECT (role = 'admin' OR is_admin = true)
  INTO v_target_is_admin
  FROM public.user_profiles
  WHERE id = target;

  IF v_target_is_admin THEN
    INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, status, error_message)
    VALUES (v_actor_id, target, 'ban_user', reason, 'failed', 'Cannot ban admin');
    RETURN jsonb_build_object('status','error','message','Cannot ban admin');
  END IF;

  -- Duration
  v_until := CASE WHEN minutes > 0 THEN now() + (minutes || ' minutes')::interval ELSE NULL END;

  UPDATE public.user_profiles
  SET
    is_banned = true,
    banned_until = v_until,
    metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('ban_reason', reason),
    updated_at = now()
  WHERE id = target;

  INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, payload, status)
  VALUES (
    v_actor_id,
    target,
    'ban_user',
    reason,
    jsonb_build_object('minutes', minutes, 'banned_until', v_until),
    'completed'
  );

  RETURN jsonb_build_object('status','ok','banned_until', v_until);

EXCEPTION WHEN others THEN
  INSERT INTO public.moderation_actions(actor_id, target_user_id, action_type, reason, status, error_message)
  VALUES (v_actor_id, target, 'ban_user', reason, 'failed', sqlerrm);
  RETURN jsonb_build_object('status','error','message','Ban failed','error', sqlerrm);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

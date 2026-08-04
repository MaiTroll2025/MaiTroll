-- Migration: Allow all users to message admin/staff via utromail
-- Modifies can_send_utromail so that admin/staff recipients can receive
-- messages from any user, bypassing privacy settings.

CREATE OR REPLACE FUNCTION public.can_send_utromail(sender_id uuid, recipient_id uuid)
RETURNS boolean AS $$
DECLARE
  v_privacy text;
  v_blocked boolean;
  v_sender_follows boolean;
  v_recipient_follows boolean;
  v_mutual boolean;
  v_recipient_verified boolean;
  v_sender_staff boolean;
  v_recipient_staff boolean;
BEGIN
  -- Staff can always send
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = sender_id AND (
    is_admin OR role IN ('admin','ceo','superadmin','troll_officer','lead_troll_officer','secretary',
    'academy_teacher','academy_director','admissions_officer','moderator','attorney','prosecutor')
  )) INTO v_sender_staff;
  
  IF v_sender_staff THEN RETURN true; END IF;

  -- Check if sender is utromail_disabled
  IF EXISTS(SELECT 1 FROM public.user_profiles WHERE id = sender_id AND utromail_disabled = true) THEN
    RETURN false;
  END IF;

  -- Check if recipient blocks sender
  SELECT EXISTS(SELECT 1 FROM public.utromail_blocks WHERE blocker_id = recipient_id AND blocked_id = sender_id) INTO v_blocked;
  IF v_blocked THEN RETURN false; END IF;

  -- Allow anyone to message admin/staff recipients
  SELECT EXISTS(SELECT 1 FROM public.user_profiles WHERE id = recipient_id AND (
    is_admin OR role IN ('admin','ceo','superadmin','troll_officer','lead_troll_officer','secretary',
    'academy_teacher','academy_director','admissions_officer','moderator','attorney','prosecutor')
  )) INTO v_recipient_staff;
  
  IF v_recipient_staff THEN RETURN true; END IF;

  -- Get recipient privacy setting
  SELECT mail_privacy_setting INTO v_privacy FROM public.user_profiles WHERE id = recipient_id;
  IF v_privacy IS NULL THEN v_privacy := 'mutual_followers'; END IF;

  -- Check verified status
  SELECT (is_verified = true) INTO v_recipient_verified FROM public.user_profiles WHERE id = sender_id;

  -- Check follow relationships
  SELECT EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = sender_id AND following_id = recipient_id) INTO v_sender_follows;
  SELECT EXISTS(SELECT 1 FROM public.user_follows WHERE follower_id = recipient_id AND following_id = sender_id) INTO v_recipient_follows;
  v_mutual := v_sender_follows AND v_recipient_follows;

  CASE v_privacy
    WHEN 'everyone' THEN RETURN true;
    WHEN 'following' THEN RETURN v_sender_follows;
    WHEN 'mutual_followers' THEN RETURN v_mutual;
    WHEN 'verified_only' THEN RETURN v_recipient_verified;
    ELSE RETURN v_mutual;
  END CASE;
END;
$$ LANGUAGE plpgsql;

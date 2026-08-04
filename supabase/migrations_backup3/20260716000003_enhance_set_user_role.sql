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
  v_admin_id := auth.uid();

  IF auth.role() = 'service_role' AND acting_admin_id IS NOT NULL THEN
      v_admin_id := acting_admin_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = v_admin_id
      AND (role = 'admin' OR is_admin = true OR role = 'superadmin' OR role = 'ceo')
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can change roles. (Admin ID: %, Role: %)', v_admin_id, auth.role();
  END IF;

  SELECT role INTO v_old_role FROM public.user_profiles WHERE id = target_user;

  UPDATE public.user_profiles
  SET
      role = new_role,
      is_admin = (new_role IN ('admin','superadmin','ceo','owner','temp_admin','temp_city_admin')),
      is_lead_officer = (new_role = 'lead_troll_officer'),
      is_troll_officer = (new_role IN ('troll_officer','lead_troll_officer')),
      is_troller = (new_role = 'troller'),
      is_auctioneer = (new_role = 'auctioneer'),
      is_secretary = (new_role = 'secretary'),
      is_pastor = (new_role = 'pastor'),
      is_attorney = (new_role = 'attorney'),
      is_prosecutor = (new_role = 'prosecutor'),
      is_journalist = (new_role = 'journalist'),
      is_news_caster = (new_role IN ('tcnn_news_caster','news_caster')),
      is_chief_news_caster = (new_role IN ('tcnn_chief_news_caster','chief_news_caster')),
      is_agency_hr = (new_role IN ('agency_hr','agency_hr_manager')),
      is_agency_hr_manager = (new_role = 'agency_hr_manager'),
      is_agency_leader = (new_role = 'agency_leader'),
      is_ceo_assistant = (new_role = 'ceo_assistant'),
      is_noah_assistant = (new_role = 'noah_assistant'),
      is_hr_admin = (new_role = 'hr_admin'),
      is_hr_manager = (new_role = 'hr_manager'),
      is_officer_active = (new_role IN ('troll_officer','lead_troll_officer')),
      updated_at = now()
  WHERE id = target_user;

  INSERT INTO public.role_change_log (target_user, changed_by, old_role, new_role, reason, created_at)
  VALUES (target_user, v_admin_id, v_old_role, new_role, reason, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT, UUID) TO service_role;

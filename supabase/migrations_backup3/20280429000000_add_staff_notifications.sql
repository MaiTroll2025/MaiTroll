-- Update can_access_staff_meeting to include all staff/organization roles
CREATE OR REPLACE FUNCTION can_access_staff_meeting(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  profile RECORD;
BEGIN
  -- Get user profile
  SELECT * INTO profile FROM user_profiles WHERE id = p_user_id;

  IF profile IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check for specific staff roles and flags
  IF profile.role = 'admin' OR profile.is_admin = TRUE OR profile.role = 'superadmin' OR profile.is_superadmin = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'ceo' OR profile.is_ceo = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'lead_officer' OR profile.is_lead_officer = TRUE OR profile.officer_role = 'lead_officer' THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'lead_troll_officer' OR profile.troll_role = 'lead_troll_officer' THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'troll_officer' OR profile.is_troll_officer = TRUE OR profile.troll_role = 'troll_officer' THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'officer' OR profile.is_officer = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'secretary' OR profile.is_secretary = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'prosecutor' OR profile.is_prosecutor = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'judge' OR profile.is_judge = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'attorney' OR profile.is_attorney = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'pastor' OR profile.is_pastor = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'auctioneer' OR profile.is_auctioneer = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'moderator' OR profile.is_moderator = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'ceo_assistant' OR profile.is_ceo_assistant = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'noah_assistant' OR profile.is_noah_assistant = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'agency_hr' OR profile.is_agency_hr = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'agency_hr_manager' OR profile.is_agency_hr_manager = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'journalist' OR profile.is_journalist = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'tcnn_news_caster' OR profile.is_tcnn_news_caster = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'tcnn_chief_news_caster' OR profile.is_tcnn_chief_news_caster = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'troller' OR profile.is_troller = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'troll_family_leader' OR profile.is_troll_family_leader = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'agency_leader' OR profile.is_agency_leader = TRUE THEN
    RETURN TRUE;
  END IF;

  IF profile.role = 'noah_admin' OR profile.is_noah_admin = TRUE THEN
    RETURN TRUE;
  END IF;

  -- Check for organization membership
  IF profile.organization_id IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get all staff user IDs for notifications
-- Includes traditional staff roles plus organization members
CREATE OR REPLACE FUNCTION get_staff_user_ids()
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT up.id
  FROM user_profiles up
  WHERE
    -- Role-based staff
    up.role IN ('admin', 'lead_troll_officer', 'troll_officer', 'officer', 'secretary', 'prosecutor', 'judge', 'attorney', 'pastor', 'auctioneer', 'moderator', 'ceo', 'ceo_assistant', 'noah_assistant', 'agency_hr', 'agency_hr_manager', 'journalist', 'tcnn_news_caster', 'tcnn_chief_news_caster', 'troller', 'troll_family_leader', 'agency_leader', 'noah_admin')
    -- Boolean flag staff
    OR up.is_admin = true
    OR up.is_ceo = true
    OR up.is_lead_officer = true
    OR up.is_troll_officer = true
    OR up.is_officer = true
    OR up.is_secretary = true
    OR up.is_prosecutor = true
    OR up.is_judge = true
    OR up.is_attorney = true
    OR up.is_pastor = true
    OR up.is_auctioneer = true
    OR up.is_moderator = true
    OR up.is_ceo_assistant = true
    OR up.is_noah_assistant = true
    OR up.is_agency_hr = true
    OR up.is_agency_hr_manager = true
    OR up.is_journalist = true
    OR up.is_tcnn_news_caster = true
    OR up.is_tcnn_chief_news_caster = true
    OR up.is_troller = true
    OR up.is_troll_family_leader = true
    OR up.is_agency_leader = true
    OR up.is_noah_admin = true
    -- Organization members
    OR up.organization_id IS NOT NULL;
END;
$$;
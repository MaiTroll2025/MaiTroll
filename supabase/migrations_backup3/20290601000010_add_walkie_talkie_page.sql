-- Add walkie_talkie_page column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS walkie_talkie_page integer;

-- Set initial values based on role
UPDATE public.user_profiles
SET walkie_talkie_page = CASE
    WHEN role = 'ceo' THEN 1
    WHEN role = 'admin' THEN 2
    WHEN role = 'moderator' THEN 3
    WHEN role = 'officer' THEN 4
    WHEN role = 'troll_officer' THEN 5
    WHEN role = 'lead_troll_officer' THEN 6
    WHEN role = 'secretary' THEN 7
    WHEN role = 'hr_admin' THEN 8
    WHEN role = 'agency_hr_manager' THEN 9
    WHEN role = 'superadmin' THEN 10
    WHEN role = 'staff' THEN 11
    WHEN role = 'broadofficer' THEN 12
    WHEN role = 'president' THEN 13
    WHEN role = 'agency_hr' THEN 14
    WHEN role = 'agency_leader' THEN 15
    WHEN role = 'attorney' THEN 16
    WHEN role = 'prosecutor' THEN 17
    WHEN role = 'journalist' THEN 18
    WHEN role = 'tcnn_news_caster' THEN 19
    WHEN role = 'tcnn_chief_news_caster' THEN 20
    WHEN role = 'auctioneer' THEN 21
    WHEN role = 'pastor' THEN 22
    WHEN role = 'org_admin' THEN 23
    WHEN role = 'org_student' AND is_staff_enabled = true THEN 24
    WHEN role = 'student' AND is_staff_enabled = true THEN 25
    ELSE 0
END;
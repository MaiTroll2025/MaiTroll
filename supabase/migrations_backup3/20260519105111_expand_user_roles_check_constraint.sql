-- Migration: Expand user_profiles role CHECK constraint to include all roles used by set_user_role RPC and frontend

-- Drop existing constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add expanded constraint with all roles used by the application
ALTER TABLE public.user_profiles
ADD CONSTRAINT user_profiles_role_check
CHECK (
  role = ANY (
    ARRAY[
      'user'::text,
      'creator'::text,
      'broadcaster'::text,
      'broadofficer'::text,
      'moderator'::text,
      'staff'::text,
      'secretary'::text,
      'president'::text,
      'admin'::text,
      'superadmin'::text,
      'owner'::text,
      'ceo'::text,
      'student'::text,
      'org_student'::text,
      'org_admin'::text,
      'troll_officer'::text,
      'lead_troll_officer'::text,
      'troller'::text,
      'marketing_readonly'::text
    ]
  )
);

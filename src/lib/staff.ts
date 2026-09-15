const STAFF_ROLES = new Set([
  'admin',
  'superadmin',
  'owner',
  'ceo',
  'staff',
  'lead_troll_officer',
  'troll_officer',
  'secretary',
  'prosecutor',
  'attorney',
  'agency_hr_manager',
  'agency_hr',
  'hr_admin',
  'marketing_readonly',
  'empire_partner',
]);

const AGENCY_HR_ROLES = new Set([
  'agency_hr',
  'agency_hr_manager',
  'agency hr',
  'agency hr manager',
]);

export function isAgencyHRProfile(profile: any): boolean {
  if (!profile) return false;

  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();

  return AGENCY_HR_ROLES.has(role) || AGENCY_HR_ROLES.has(trollRole);
}

export function isStaffProfile(profile: any): boolean {
  if (!profile) return false;

  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();

  return Boolean(
    profile.is_staff ||
      profile.is_admin ||
      // null-safe even if callers pass unexpected partial profiles
      (profile as any)?.is_superadmin === true ||
      profile.is_troll_officer ||
      profile.is_lead_officer ||
      profile.is_secretary ||
      profile.is_prosecutor ||
      profile.is_attorney ||
      STAFF_ROLES.has(role) ||
      STAFF_ROLES.has(trollRole)
  );
}

export const NIGHT_WATCH_PATROL_ROLES = [
  'admin',
  'ceo',
  'staff',
  'officer',
  'broadofficer',
  'lead_troll_officer',
  'troll_officer',
  'ceo_assistant',
  'noah_assistant',
  'agency_hr',
  'agency_hr_manager',
  'hr_admin',
  'secretary'
] as const;

export const NIGHT_WATCH_PROTECTED_ROLES = [
  'admin',
  'ceo',
  'noah_admin',
  'ceo_assistant',
  'noah_assistant'
] as const;

export const ADMIN_ONLY_RECORDING_ROLES = ['admin', 'ceo'] as const;

export function canAccessNightWatch(profile: any): boolean {
  if (!profile) return false;
  const role = String(profile.role || '').toLowerCase();
  const trollRole = String(profile.troll_role || '').toLowerCase();

  return (
    profile.is_admin === true ||
    role === 'ceo' ||
    role === 'staff' ||
    role === 'officer' ||
    role === 'broadofficer' ||
    role === 'lead_troll_officer' ||
    role === 'troll_officer' ||
    role === 'ceo_assistant' ||
    role === 'noah_assistant' ||
    role === 'agency_hr' ||
    role === 'agency_hr_manager' ||
    role === 'hr_admin' ||
    role === 'secretary' ||
    trollRole === 'admin' ||
    trollRole === 'ceo' ||
    trollRole === 'secretary'
  );
}

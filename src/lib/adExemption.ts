import { UserProfile, UserRole } from '@/lib/supabase';

const AD_EXCLUDED_PATHS = [
  '/broadcast',
  '/watch',
  '/live',
  '/stream',
  '/troll-court',
  '/court',
  '/church',
  '/auction',
  '/auctions',
  '/auction-app',
];

const ADMIN_ROLES: (UserRole | string)[] = [
  UserRole.ADMIN,
  UserRole.SUPERADMIN,
  UserRole.CEO,
  UserRole.OWNER,
  'admin',
  'superadmin',
  'ceo',
  'owner',
];

const CAREER_ROLES: string[] = [
  'lead_troll_officer',
  'troll_officer',
  'secretary',
  'prosecutor',
  'attorney',
  'judge',
  'auctioneer',
  'pastor',
  'journalist',
  'tcnn_news_caster',
  'tcnn_chief_news_caster',
  'agency_hr_manager',
  'agency_leader',
  'hr_manager',
  'hr_admin',
  'ceo_assistant',
  'noah_assistant',
  'academy_teacher',
  'academy_director',
  'troller',
  'troll_family',
];

export function isAdExemptUser(profile: UserProfile | null): boolean {
  if (!profile) return false;

  const role = profile.role || '';
  const isAdmin = profile.is_admin === true ||
    ADMIN_ROLES.includes(role) ||
    profile.is_superadmin === true ||
    profile.is_owner === true;

  if (isAdmin) return true;

  if (CAREER_ROLES.includes(role)) return true;

  if (profile.troll_role && CAREER_ROLES.includes(profile.troll_role)) return true;

  return false;
}

export function isAdExcludedPage(pathname: string): boolean {
  if (!pathname) return false;

  const normalized = pathname.toLowerCase();

  if (AD_EXCLUDED_PATHS.some(p => normalized.startsWith(p))) return true;

  if (normalized.includes('/court-room') || normalized.includes('/court/')) return true;

  if (normalized.includes('/church/live/') || normalized.includes('/church/pastor')) return true;

  return false;
}

export function shouldShowAds(profile: UserProfile | null, pathname: string): boolean {
  if (isAdExemptUser(profile)) return false;
  if (isAdExcludedPage(pathname)) return false;
  return true;
}

export function hasActiveNoAdsSubscription(profile: UserProfile | null): boolean {
  if (!profile) return false;
  const noAdsUntil = profile.no_ads_until;
  if (!noAdsUntil) return false;
  return new Date(noAdsUntil) > new Date();
}

import {
  Home,
  Coins,
  Gavel,
  Scale,
  Building2,
  Gamepad2,
  Trophy,
  Music,
  BookOpen,
  GraduationCap,
  Award,
  Users,
  FileText,
  Wallet,
  TrendingUp,
  Megaphone,
  Briefcase,
  Package,
  Store,
  List,
  Waves,
  ShoppingBag,
  Shuffle,
  Banknote,
  Landmark,
  Radio,
  Crown,
  Church,
  Shield,
  Wrench,
  LayoutDashboard,
  Lock,
  Database,
  Settings,
  Zap,
  Calendar,
  Mail,
  Newspaper,
  Phone,
  Video,
  LifeBuoy,
  Image,
  Warehouse,
  DollarSign,
  type LucideIcon,
} from 'lucide-react'
import { UserRole } from '../lib/supabase'
import type { PhoneRoleAccess } from './usePhoneRoleAccess'

export interface PhoneNavItem {
  label: string
  path: string
  icon: LucideIcon
  show?: boolean
}

export interface PhoneNavSection {
  title: string
  items: PhoneNavItem[]
}

export function getPhoneNavSections(a: PhoneRoleAccess): PhoneNavSection[] {
  const sections: PhoneNavSection[] = []

  const add = (title: string, items: PhoneNavItem[]) => {
    const visible = items.filter((i) => i.show !== false)
    if (visible.length) sections.push({ title, items: visible })
  }

  add('Menu', [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Coins', path: '/store', icon: Coins, show: true },
    { label: 'Mai Pay', path: '/wallet', icon: Wallet },
    { label: 'Mai Piks', path: '/mai-piks', icon: Image },
    { label: 'Troll Court', path: '/troll-court', icon: Scale, show: true },
    { label: 'Treelz', path: '/treelz', icon: Video },
    { label: 'Auctions', path: '/auctions', icon: Gavel, show: true },
    { label: 'HytroGaming', path: '/hytro', icon: Gamepad2 },
    { label: 'Careers', path: '/careers', icon: Briefcase },
    { label: 'Profile', path: '/profile', icon: Users, show: true },
  ])

  add('Broadcasting', [
    {
      label: 'Go Live',
      path: '/broadcast/setup',
      icon: Video,
      show: a.canBroadcast && !a.isShareAThonRestricted,
    },
    { label: 'Live Now', path: '/viewer', icon: Radio },
    { label: 'High Bcasters', path: '/high-bcasters', icon: Crown },
  ])

  add('City Core', [
    { label: 'Neighborhood', path: '/neighborhood-setup', icon: Building2 },
    { label: 'Mai Sing Off', path: '/mai-sing-off', icon: Trophy },
    { label: 'MAI Record Label', path: '/mai-record-label', icon: Music },
  ])

  add('Mai Troll Academy', [
    { label: 'Academy', path: '/academy', icon: BookOpen },
    { label: 'Courses', path: '/academy/courses', icon: GraduationCap },
    { label: 'Certificates', path: '/academy/certificates', icon: Award },
    { label: 'Admissions', path: '/academy/admissions', icon: Users },
    { label: 'Classroom', path: '/academy/classroom', icon: BookOpen },
    {
      label: 'Teacher Dashboard',
      path: '/academy/teacher/dashboard',
      icon: Users,
      show: a.isTeacher,
    },
    {
      label: 'Board of Education',
      path: '/academy/admin',
      icon: Shield,
      show: a.isAdmin,
    },
    { label: 'Assignments', path: '/academy/assignments', icon: FileText },
    { label: 'Teachers', path: '/academy/teachers', icon: GraduationCap },
    { label: 'My Loans', path: '/academy/loans', icon: Wallet },
    { label: 'Transcript', path: '/academy/transcript/official', icon: TrendingUp },
  ])

  add('City Services', [
    { label: 'Advertise', path: '/city-registry/advertise', icon: Megaphone },
    { label: 'Appeals', path: '/city-registry', icon: Scale },
    {
      label: 'TCNN',
      path: '/tcnn/dashboard',
      icon: Newspaper,
      show: a.isJournalist || a.isAdmin || a.role === 'superadmin' || !!(a as any).is_superadmin,
    },
    {
      label: 'Attorney',
      path: '/attorney',
      icon: Briefcase,
      show:
        a.isAttorney ||
        !!(a as any).is_attorney ||
        a.role === 'attorney' ||
        a.trollRole === 'attorney',
    },
    {
      label: 'Auction Studio',
      path: '/auctions/studio',
      icon: Gavel,
      show: a.canSeeAuctionStudio,
    },
    { label: 'Credit', path: '/credit-scores', icon: TrendingUp },
    { label: 'Creator', path: '/creator-switch', icon: Shuffle },
    {
      label: 'Dockets',
      path: '/admin/court-dockets',
      icon: Gavel,
      show: a.canSeeCourt,
    },
  ])

  add('Social + Life', [
    {
      label: 'UTroMail',
      path: '/utromail',
      icon: Mail,
      show: a.canAccessTromail,
    },
    { label: 'Insurance', path: '/insurance', icon: Shield },
    { label: 'Inventory', path: '/inventory', icon: Package },
    { label: 'Troll Family', path: '/family/browse', icon: Users },
    {
      label: 'My Families',
      path: a.isFamilyMember ? '/family/home' : '/family/browse',
      icon: Crown,
      show: a.canSeeTrollFamily || a.role === 'troll_family',
    },
    { label: 'Leaderboard', path: '/leaderboard', icon: Trophy },
    { label: 'Living', path: '/living', icon: Warehouse },
    { label: 'Marketplace', path: '/marketplace', icon: Store },
    {
      label: 'My Shows',
      path: '/auctions/my-shows',
      icon: List,
      show: a.canSeeAuctionStudio,
    },
    { label: 'Pool', path: '/pool', icon: Waves },
    { label: 'Safety', path: '/safety', icon: Shield },
    { label: 'Troll Church', path: '/church', icon: Church },
    { label: 'Trollified', path: '/trollifieds', icon: ShoppingBag },
    { label: 'Wallet', path: '/wallet', icon: Banknote },
    { label: 'Wheel', path: '/troll-wheel', icon: Gamepad2 },
    { label: 'Podcast', path: '/podcast', icon: Music },
  ])

  add('Control Room', [
    {
      label: 'Government',
      path: '/government',
      icon: Landmark,
      show:
        a.isOfficer ||
        a.isSecretary ||
        a.role === String(UserRole.PRESIDENT) ||
        a.trollRole === String(UserRole.PRESIDENT) ||
        a.isAdmin,
    },
    {
      label: 'Inmates',
      path: '/inmates',
      icon: Users,
      show: a.canSeeInmates,
    },
    { label: 'President', path: '/president', icon: Crown },
    {
      label: 'Streams',
      path: '/government/streams',
      icon: Radio,
      show: a.isOfficer || a.isSecretary || a.isAdmin,
    },
    {
      label: 'Treasury',
      path: '/president/treasury',
      icon: Banknote,
      show: a.isAdmin || a.role === 'president' || a.trollRole === 'president',
    },
    {
      label: 'Secretary',
      path: '/secretary',
      icon: LayoutDashboard,
      show: a.isSecretary || a.isAdmin,
    },
    {
      label: 'Department Tools',
      path: '/department-tools',
      icon: Wrench,
      show:
        a.isOfficer ||
        a.isLead ||
        a.isSecretary ||
        a.isAdmin ||
        a.role === String(UserRole.CEO_ASSISTANT) ||
        a.role === String(UserRole.NOAH_ASSISTANT) ||
        a.role === String(UserRole.HR_ADMIN) ||
        a.role === String(UserRole.HR_MANAGER),
    },
    {
      label: 'Coin Purchase Ledger',
      path: '/admin/coinpurchase-ledger',
      icon: Coins,
      show: a.isAdmin,
    },
    {
      label: 'Security Command',
      path: '/admin/security-command-center',
      icon: Shield,
      show: a.isAdmin,
    },
    {
      label: 'Night Watch',
      path: '/admin/night-watch',
      icon: Radio,
      show: a.canAccessNightWatch,
    },
  ])

  add('Talent Offices', [
    { label: 'Agencies', path: '/agencies', icon: Building2 },
    { label: 'My Agency', path: '/agency-dashboard', icon: Users },
    {
      label: 'Attorney',
      path: '/attorney',
      icon: Briefcase,
      show:
        a.isAttorney ||
        !!(a as any).is_attorney ||
        a.role === 'attorney' ||
        a.trollRole === 'attorney',
    },
    {
      label: 'Auction Studio',
      path: '/auctions/studio',
      icon: Gavel,
      show: a.canSeeAuctionStudio,
    },
    {
      label: 'Agency HR',
      path: '/agency-hr-dashboard',
      icon: Briefcase,
      show: a.canSeeAgencyHR,
    },
  ])

  add('Support', [{ label: 'Support', path: '/support', icon: LifeBuoy }])

  add('Dashboards', [
    {
      label: 'CEO Assistant Dashboard',
      path: '/ceo-assistant-dashboard',
      icon: LayoutDashboard,
      show: a.isCEOAssistant || a.isAdmin || a.isCEO,
    },
    {
      label: 'Prosecutor Dashboard',
      path: '/prosecutor',
      icon: Gavel,
      show:
        a.isProsecutor ||
        !!(a as any).is_prosecutor ||
        a.role === 'prosecutor' ||
        a.trollRole === 'prosecutor',
    },
    {
      label: 'Pastor Dashboard',
      path: '/church/pastor',
      icon: Church,
      show: a.isPastor || a.role === 'pastor' || a.trollRole === 'pastor' || a.isAdmin,
    },
  ])

  if (a.isAdmin) {
    add('Admin Library', [
      { label: 'Admin Dashboard', path: '/admin', icon: LayoutDashboard },
      { label: 'Admin Marketplace', path: '/admin/marketplace', icon: Store },
      { label: 'Admin Earnings', path: '/admin/earnings', icon: TrendingUp },
      { label: 'Admin Finance', path: '/admin/finance', icon: Banknote },
      { label: 'Payments Dashboard', path: '/admin/payments', icon: DollarSign },
      { label: 'Economy Dashboard', path: '/admin/economy', icon: TrendingUp },
      { label: 'Tax Review Panel', path: '/admin/tax-reviews', icon: Scale },
      { label: 'Tax Upload', path: '/tax/upload', icon: Banknote },
      { label: 'Payouts', path: '/admin/payouts', icon: Banknote },
      { label: 'Referral Bonuses', path: '/admin/referrals', icon: Trophy },
      { label: 'Verified Users', path: '/admin/verified-users', icon: Users },
      { label: 'Verification Review', path: '/admin/verification', icon: FileText },
      { label: 'Applications', path: '/admin/applications', icon: FileText },
      { label: 'Policy Docs', path: '/admin/docs/policies', icon: FileText },
      { label: 'Store Pricing', path: '/admin/store-pricing', icon: Store },
      { label: 'Cashout Manager', path: '/admin/cashout-manager', icon: Lock },
      { label: 'Security Command', path: '/admin/security-command-center', icon: Shield },
      { label: 'Mobile Admin', path: '/admin-mobile', icon: LayoutDashboard },
      { label: 'Payment Logs', path: '/admin/payment-logs', icon: TrendingUp },
      { label: 'Admin Errors', path: '/admin/errors', icon: Settings },
      { label: 'Database Backup', path: '/admin/system/backup', icon: Database },
      { label: 'System Config', path: '/admin/system/config', icon: Settings },
      { label: 'Load Lab', path: '/admin/load-lab', icon: Zap },
      { label: 'Jail Management', path: '/admin/jail-management', icon: Lock },
      { label: 'User Forms', path: '/admin/user-forms', icon: FileText },
      { label: 'Trollmers Tournament', path: '/admin/trollmers-tournament', icon: Trophy },
      { label: 'Officer Management', path: '/admin/officer-management', icon: Briefcase },
      { label: 'Role Management', path: '/admin/role-management', icon: Users },
      { label: 'Staff Audit', path: '/admin/staff-audit', icon: Shield },
      { label: 'Media Library', path: '/admin/media-library', icon: FileText },
      { label: 'Announcements', path: '/admin/announcements', icon: Megaphone },
      { label: 'Send Notifications', path: '/admin/send-notifications', icon: Mail },
      { label: 'Export Data', path: '/admin/export-data', icon: FileText },
      { label: 'User Search', path: '/admin/user-search', icon: FileText },
      { label: 'Reports Queue', path: '/admin/reports-queue', icon: FileText },
      { label: 'Stream Monitor', path: '/admin/stream-monitor', icon: Video },
      { label: 'Night Watch', path: '/admin/night-watch', icon: Radio },
      { label: 'Voting', path: '/admin/voting', icon: FileText },
      { label: 'Launch Trial', path: '/admin/launch-trial', icon: Banknote },
      { label: 'Buckets', path: '/admin/buckets', icon: Banknote },
      { label: 'Grant Coins', path: '/admin/grant-coins', icon: Coins },
      { label: 'Create Schedule', path: '/admin/create-schedule', icon: Calendar },
      { label: 'Officer Shifts', path: '/admin/officer-shifts', icon: Calendar },
      { label: 'Control Panel', path: '/admin/control-panel', icon: LayoutDashboard },
      { label: 'Test Diagnostics', path: '/admin/test-diagnostics', icon: FileText },
      { label: 'Reset Maintenance', path: '/admin/reset-maintenance', icon: Lock },
      { label: 'HR', path: '/admin/hr', icon: Users },
      { label: 'Appeals', path: '/admin/appeals', icon: Scale },
      { label: 'Meetings', path: '/admin/meetings', icon: Calendar },
      { label: 'RTC Admin Monitor', path: '/rtcadminmonitor', icon: Radio },
      { label: 'RFC', path: '/rfc', icon: FileText },
      { label: 'Changelog', path: '/changelog', icon: FileText },
    ])

    add('Role Dashboards', [
      { label: 'President Dashboard', path: '/president/dashboard', icon: Crown },
      { label: 'Secretary Console', path: '/secretary', icon: LayoutDashboard },
      { label: 'Government Streams', path: '/government/streams', icon: Radio },
      { label: 'Officer Lounge', path: '/officer/lounge', icon: Building2 },
      { label: 'Officer Scheduling', path: '/officer/scheduling', icon: Calendar },
      { label: 'Officer Dashboard', path: '/officer/dashboard', icon: Users },
      { label: 'Lead Officer', path: '/lead-officer', icon: Users },
      { label: 'Attorney', path: '/attorney', icon: Briefcase },
      { label: 'Prosecutor Dashboard', path: '/prosecutor', icon: Gavel },
      { label: 'Pastor Dashboard', path: '/church/pastor', icon: Church },
      { label: 'Agency HR Dashboard', path: '/agency-hr-dashboard', icon: Briefcase },
      { label: 'CEO Assistant Dashboard', path: '/ceo-assistant-dashboard', icon: LayoutDashboard },
    ])
  }

  return sections
}

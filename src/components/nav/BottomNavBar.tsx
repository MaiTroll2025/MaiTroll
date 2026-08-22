import React, { useState, useMemo, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileFrame from '@/components/profile/ProfileFrame';
import { useUserFrame } from '@/hooks/useUserFrame';
import {
  Home,
  Video,
  Coins,
  Gavel,
  Scale,
  Scan,
  Gamepad2,
  GraduationCap,
  LayoutGrid,
  Store,
  Users,
  Crown,
  BookOpen,
  Trophy,
  Vote,
  Shield,
  Star,
  Heart,
  MessageCircle,
  Search,
  Compass,
  Activity,
  BarChart3,
  Settings,
  ScrollText,
  Wallet,
  Newspaper,
  Megaphone,
  ClipboardList,
  MonitorDot,
  Lock,
  Mic,
  Eye,
  DollarSign,
  Bell,
  User,
  LogOut,
  ChevronUp,
  X,
  TrendingUp,
  Building2,
  Landmark,
  Waves,
  Package,
  Shuffle,
  Car,
  Briefcase,
  Receipt,
  Sparkles,
  Radio,
  RefreshCw,
  Gem,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useXPStore } from '@/stores/useXPStore';
import { supabase, UserRole } from '@/lib/supabase';
import { toast } from 'sonner';
import { useNavBadges } from '@/hooks/useNavBadges';

/* --- Role helpers (mirrored from Sidebar/BottomNav) --- */
function useRoleChecks(profile: any) {
  const role = String(profile?.role || '');
  const trollRole = String(profile?.troll_role || '');

  const isAdmin =
    role === String(UserRole.ADMIN) ||
    trollRole === String(UserRole.ADMIN) ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    profile?.is_admin ||
    role === 'superadmin' ||
    trollRole === 'ceo' ||
    !!(profile as any)?.is_superadmin;

  const isSecretary =
    role === String(UserRole.SECRETARY) ||
    trollRole === String(UserRole.SECRETARY) ||
    !!(profile as any)?.is_secretary ||
    isAdmin;

  const isLead =
    role === String(UserRole.LEAD_TROLL_OFFICER) ||
    !!(profile as any)?.is_lead_officer ||
    trollRole === String(UserRole.LEAD_TROLL_OFFICER) ||
    isAdmin;

  const isOfficer =
    role === String(UserRole.TROLL_OFFICER) ||
    !!(profile as any)?.is_troll_officer ||
    trollRole === String(UserRole.TROLL_OFFICER) ||
    isLead ||
    isAdmin;

  const isPresident =
    role === String(UserRole.PRESIDENT) ||
    !!(profile as any)?.is_president ||
    trollRole === String(UserRole.PRESIDENT);

  const isBroadcaster =
    role === 'broadcaster' ||
    trollRole === 'broadcaster' ||
    !!(profile as any)?.is_broadcaster;

  const isAgencyHR =
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    trollRole === String(UserRole.AGENCY_HR_MANAGER) ||
    !!(profile as any)?.is_agency_hr ||
    !!(profile as any)?.is_agency_hr_manager

  const isHRAdmin =
    isAdmin ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.HR_MANAGER) ||
    trollRole === String(UserRole.HR_ADMIN) ||
    trollRole === String(UserRole.HR_MANAGER) ||
    !!(profile as any)?.is_hr_admin ||
    !!(profile as any)?.is_hr_manager

  const isAgencyLeader =
    role === 'agency_leader' ||
    trollRole === 'agency_leader' ||
    !!(profile as any)?.is_agency_leader ||
    isAgencyHR ||
    isAdmin

  const isAttorney =
    role === 'attorney' ||
    trollRole === 'attorney' ||
    !!(profile as any)?.is_attorney

  const isProsecutor =
    role === 'prosecutor' ||
    trollRole === 'prosecutor' ||
    !!(profile as any)?.is_prosecutor

  const isPastor =
    role === 'pastor' ||
    trollRole === 'pastor' ||
    !!(profile as any)?.is_pastor

  const isJournalist =
    role === 'journalist' ||
    trollRole === 'journalist' ||
    !!(profile as any)?.is_journalist

  const isNewsCaster =
    role === 'tcnn_news_caster' ||
    trollRole === 'tcnn_news_caster' ||
    !!(profile as any)?.is_news_caster

  const isChiefNewsCaster =
    role === 'tcnn_chief_news_caster' ||
    trollRole === 'tcnn_chief_news_caster' ||
    !!(profile as any)?.is_chief_news_caster

  const isCEOAssistant =
    role === 'ceo_assistant' ||
    trollRole === 'ceo_assistant' ||
    !!(profile as any)?.is_ceo_assistant

  const isNoahAssistant =
    role === 'noah_assistant' ||
    trollRole === 'noah_assistant' ||
    !!(profile as any)?.is_noah_assistant

  const isAuctioneer =
    role === 'auctioneer' ||
    trollRole === 'auctioneer' ||
    !!(profile as any)?.is_auctioneer

  // Any profile whose role is an approved employee role can open the
  // employee office (mirrors permissions.ts APPROVED_ROLES).
  const isEmployee =
    isAdmin ||
    isLead ||
    isOfficer ||
    isSecretary ||
    isCEOAssistant ||
    isNoahAssistant ||
    isHRAdmin ||
    new Set([
      'troll_officer', 'lead_troll_officer', 'secretary', 'ceo_assistant',
      'noah_assistant', 'hr_admin', 'hr_manager', 'agency_hr_manager',
      'pastor', 'agency_leader', 'attorney', 'prosecutor', 'journalist',
      'auctioneer', 'troller', 'agency_hr', 'president', 'vice_president',
      'troll_city_secretary', 'troll_city_treasurer', 'executive_secretary',
      'academy_teacher', 'admissions_officer', 'employee',
    ]).has(role) ||
    new Set([
      'troll_officer', 'lead_troll_officer', 'secretary', 'ceo_assistant',
      'noah_assistant', 'hr_admin', 'hr_manager', 'agency_hr_manager',
      'pastor', 'agency_leader', 'attorney', 'prosecutor', 'journalist',
      'auctioneer', 'troller', 'agency_hr', 'president', 'vice_president',
      'troll_city_secretary', 'troll_city_treasurer', 'executive_secretary',
      'academy_teacher', 'admissions_officer', 'employee',
    ]).has(trollRole)
    ;

  return { isAdmin, isSecretary, isLead, isOfficer, isPresident, isBroadcaster, isAgencyHR, isHRAdmin, isAgencyLeader, isAttorney, isProsecutor, isPastor, isJournalist, isNewsCaster, isChiefNewsCaster, isCEOAssistant, isNoahAssistant, isAuctioneer, isEmployee, role, trollRole };
}

/* --- Format helpers --- */
function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* --- Profile Module (left section) --- */
function ProfileModule({ collapsed }: { collapsed: boolean }) {
  const { user, profile } = useAuthStore();
  const { balances } = useCoins();
  const xpStore = useXPStore();
  const trollCoins = Number((balances as any)?.troll_coins ?? 0);
  const trollmonds = Number((profile as any)?.trollmonds ?? 0);
  const crowns = Number((profile as any)?.crowns ?? 0);
  const trollmoods = Number((profile as any)?.trollmoods ?? 0);
  const currentLevel = xpStore.level;
  const currentXp = xpStore.xpTotal ?? profile?.xp ?? profile?.total_xp ?? 0;
  const nextXp = xpStore.xpToNext ?? profile?.next_level_xp ?? 1;
  const progress = xpStore.progress ?? (nextXp > 0 ? Math.min((currentXp / nextXp) * 100, 100) : 0);

  useEffect(() => {
    if (user?.id) {
      xpStore.fetchXP(user.id);
      xpStore.subscribeToXP(user.id);
      return () => {
        if (xpStore.unsubscribe) {
          xpStore.unsubscribe();
        }
      };
    }
  }, [user?.id]);
  const displayName = profile?.display_name || profile?.username || 'Citizen';
  const avatarUrl = profile?.avatar_url;
  const equippedFrame = useUserFrame(user?.id);

  if (collapsed) {
    return (
      <div className="flex items-center gap-2 px-2" style={{ overflow: 'visible' }}>
        <div className="relative h-10 w-10 flex items-center justify-center" style={{ overflow: 'visible' }}>
          {avatarUrl ? (
            <ProfileFrame frame={equippedFrame} avatarUrl={avatarUrl} username={displayName} size="sm" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cyan-400/50 bg-gradient-to-br from-purple-600 to-cyan-500 text-xs font-black text-white">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5" style={{ overflow: 'visible' }}>
      {/* Avatar */}
      <div className="relative shrink-0 h-12 w-12 md:h-14 md:w-14 flex items-start justify-start" style={{ overflow: 'visible' }}>
        {avatarUrl ? (
          <ProfileFrame
            frame={equippedFrame}
            avatarUrl={avatarUrl}
            username={displayName}
            size="sm"
            fillParent
          />
        ) : (
          <div className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black text-white ring-2 md:h-14 md:w-14 ring-cyan-400/50`}>
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex flex-col gap-0.5">
        <p className="truncate text-[11px] font-black leading-tight text-white md:text-xs max-w-[120px]">{displayName}</p>
        <p className="text-[9px] font-bold text-cyan-300/80 md:text-[10px]">City Rank Lv. {currentLevel}</p>
        {/* Balances */}
        <div className="flex items-center gap-2 text-[9px] font-bold md:text-[10px]">
          <span className="flex items-center gap-0.5 text-yellow-300">
            <Coins className="h-2.5 w-2.5" /> {formatCoins(trollCoins)}
          </span>
          <span className="flex items-center gap-0.5 text-purple-300">
            <Gem className="h-2.5 w-2.5" /> {formatCoins(trollmonds)}
          </span>
          {crowns > 0 && (
            <span className="flex items-center gap-0.5 text-amber-300">
              <Crown className="h-2.5 w-2.5" /> {crowns}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* --- Nav Button (center section) --- */
interface NavButtonProps {
  icon: React.ElementType;
  label: string;
  to?: string;
  active?: boolean;
  highlight?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'large';
  badge?: number;
  badgeKey?: keyof import('@/hooks/useNavBadges').NavBadges;
  onBadgeDismiss?: (key: keyof import('@/hooks/useNavBadges').NavBadges) => void;
  level?: number;
  showLevelOrb?: boolean;
}

function NavButton({ icon: Icon, label, to, active, highlight, onClick, size = 'normal', badge, badgeKey, onBadgeDismiss, level, showLevelOrb }: NavButtonProps) {
  const isLarge = size === 'large';

  const handleClick = () => {
    if (badgeKey && onBadgeDismiss && badge && badge > 0) {
      onBadgeDismiss(badgeKey);
    }
    if (onClick) onClick();
  };

  const baseClasses = `
    group relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all duration-200
    ${isLarge ? 'h-14 w-14 md:h-20 md:w-20' : 'h-11 w-11 md:h-14 md:w-14'}
    ${active
      ? 'text-cyan-300'
      : 'text-slate-400 hover:text-white'
    }
    ${highlight
      ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
      : ''
    }
  `;

  const content = (
    <>
      <Icon className={`${isLarge ? 'h-5 w-5 md:h-7 md:w-7' : 'h-4 w-4 md:h-6 md:w-6'} transition-transform duration-200 group-hover:scale-110`} />
      <span className={`[font-size:7px] font-bold leading-none md:text-[9px] ${isLarge ? 'text-[8px] md:text-[11px]' : ''}`}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[7px] font-bold text-white">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
      {showLevelOrb && level !== undefined && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-cyan-500 px-0.5 text-[6px] font-black text-white ring-1 ring-cyan-300/60">
          {level}
        </span>
      )}
      {active && (
        <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-cyan-400" />
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={baseClasses} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={baseClasses} onClick={handleClick}>
      {content}
    </button>
  );
}

/* --- More Pages Panel --- */
interface MorePagesPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PageEntry {
  label: string;
  icon: React.ElementType;
  path?: string;
  show?: boolean;
  onClick?: () => void;
}

function MorePagesPanel({ isOpen, onClose }: MorePagesPanelProps) {
  const { user, profile, logout } = useAuthStore();
  const xpStore = useXPStore();
  const { balances } = useCoins();
  const navigate = useNavigate_fixed();
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const trollCoins = Number((balances as any)?.troll_coins ?? 0);
  const trollmonds = Number((profile as any)?.trollmonds ?? 0);
  const crowns = Number((profile as any)?.crowns ?? 0);
  const currentLevel = xpStore.level;
  const displayName = profile?.display_name || profile?.username || 'Citizen';
  const avatarUrl = profile?.avatar_url;
  const equippedFrame = useUserFrame(user?.id);
  const currentXp = xpStore.xpTotal ?? profile?.xp ?? profile?.total_xp ?? 0;
  const nextXp = xpStore.xpToNext ?? profile?.next_level_xp ?? 1;
  const progress = xpStore.progress ?? (nextXp > 0 ? Math.min((currentXp / nextXp) * 100, 100) : 0);
  const {
    isAdmin, isSecretary, isLead, isOfficer, isPresident, isBroadcaster, isAgencyHR, isHRAdmin,
    isAgencyLeader, isAttorney, isProsecutor, isPastor, isJournalist, isNewsCaster,
    isChiefNewsCaster, isCEOAssistant, isNoahAssistant, isAuctioneer, isEmployee,
  } = useRoleChecks(profile);
  const [search, setSearch] = useState('');

  const allPages = useMemo(() => {
    const pages: { category: string; items: PageEntry[] }[] = [
      {
        category: 'All Pages',
        items: [
          { label: 'Home', icon: Home, path: '/home' },
          { label: 'Search', icon: Search, path: '/search' },
          { label: 'Explore', icon: Compass, path: '/explore' },
          { label: 'Notifications', icon: Bell, path: '/notifications' },
          { label: 'Profile', icon: User, path: profile?.username ? `/profile/${profile.username}` : '/profile/setup' },
        ],
      },
      {
        category: 'Discover',
        items: [
          { label: 'Leaderboard', icon: Trophy, path: '/leaderboard' },
          { label: 'Marketplace', icon: Store, path: '/marketplace' },
          { label: 'Inventory', icon: Package, path: '/inventory' },
          { label: 'MAI Pay', icon: DollarSign, path: '/mai-pay' },
          { label: 'Coin Store', icon: Coins, path: '/store' },
          { label: 'My Garage', icon: Car, path: '/garage' },
        ],
      },
      {
        category: 'Community',
        items: [
          { label: 'HydroGaming', icon: Gamepad2, path: '/hytrogaming' },
          { label: 'Live Auctions', icon: Gavel, path: '/auctions' },
          { label: 'Agencies', icon: Building2, path: '/agencies' },
          { label: 'Troll Family', icon: Users, path: '/family/home' },
          { label: 'Pool', icon: Waves, path: '/pool' },
          { label: 'Troll Church', icon: BookOpen, path: '/church' },
          { label: 'Troll Match', icon: Heart, path: '/match' },
          { label: 'Podcast Central', icon: Mic, path: '/podcast' },
           { label: 'TCNN News', icon: Newspaper, path: '/tcnn' },
           { label: 'EPaper', icon: Newspaper, path: '/epaper' },
           { label: 'Troll Wheel', icon: Shuffle, path: '/troll-wheel' },
           { label: 'Mai Sing Off', icon: Mic, path: '/mai-sing-off' },
        ],
      },
       {
          category: 'Government',
          items: [
            { label: 'Troll Court', icon: Scale, path: '/troll-court' },
            { label: 'Inmates', icon: Lock, path: '/inmates' },
            { label: 'City Laws & Fees', icon: FileText_M, path: '/home?tab=laws-fees' },
            { label: 'Mayor Dashboard', icon: Crown, path: '/mayor' },
            { label: 'Town Meeting', icon: Users, path: '/town-meeting' },
            { label: 'City Government', icon: Landmark, path: '/city-government' },
            { label: 'President Candidates', icon: Vote, path: '/president' },
            { label: 'Elections', icon: ClipboardList, path: '/government' },
            { label: 'Proposals', icon: ScrollText, path: '/government/proposals' },
            { label: 'Openings', icon: Briefcase, path: '/government/openings' },
            { label: 'Careers', icon: Briefcase, path: '/careers' },
            { label: 'Newspaper', icon: Newspaper, path: '/government/newspaper' },
          ...(isOfficer || isSecretary || isAdmin
            ? [{ label: 'City Government (Staff)', icon: Landmark as any, path: '/government' }]
            : []),
          ...(isOfficer || isAdmin || isSecretary || isLead
            ? [
                { label: 'Night Watch', icon: Eye as any, path: '/admin/night-watch' },
              ]
            : []),
          ...(isOfficer
            ? [
                { label: 'Officer Dashboard', icon: LayoutGrid as any, path: '/officer/dashboard' },
                { label: 'Moderation', icon: Eye as any, path: '/officer/moderation' },
                { label: 'Payroll', icon: DollarSign as any, path: '/officer/payroll' },
              ]
            : []),
          ...(isLead
            ? [{ label: 'Lead HQ', icon: Star as any, path: '/lead-officer' }]
            : []),
          ...(isSecretary || isAdmin
            ? [{ label: 'Secretary Console', icon: ScrollText as any, path: '/secretary' }]
            : []),
          ...(isPresident || isAdmin
            ? [{ label: 'President', icon: Crown as any, path: '/president' }]
            : []),
          ...(isAttorney || isAdmin
            ? [{ label: 'Attorney Dashboard', icon: Scale as any, path: '/attorney' }]
            : []),
          ...(isProsecutor || isAdmin
            ? [{ label: 'Prosecutor Dashboard', icon: Gavel as any, path: '/prosecutor' }]
            : []),
          ...(isPastor || isAdmin
            ? [{ label: 'Pastor Dashboard', icon: Users as any, path: '/church/pastor' }]
            : []),
          ...(isAgencyHR || isAgencyLeader || isAdmin
            ? [{ label: 'Agency HR', icon: Briefcase as any, path: '/agency-hr-dashboard' }]
            : []),
          ...(isJournalist || isAdmin
            ? [{ label: 'Journalist', icon: Newspaper as any, path: '/tcnn' }]
            : []),
          ...(isNewsCaster || isAdmin
            ? [{ label: 'News Caster', icon: Radio as any, path: '/tcnn/broadcaster' }]
            : []),
          ...(isChiefNewsCaster || isAdmin
            ? [{ label: 'Chief Caster', icon: Star as any, path: '/tcnn/dashboard' }]
            : []),
          ...(isCEOAssistant || isAdmin
            ? [{ label: 'CEO Assistant', icon: Briefcase as any, path: '/ceo-assistant-dashboard' }]
            : []),
           ...(isAuctioneer || isAdmin
              ? [
                  { label: 'Auctioneer', icon: Gavel as any, path: '/auctions/studio' },
                  { label: 'Auction App', icon: Scan as any, path: '/auction-app' },
                ]
              : []),
           ...(isHRAdmin
             ? [{ label: '', icon: Briefcase as any, path: '/hr-center' }]
             : []),
         ],
       },
       {
         category: 'Learning',
        items: [
          { label: 'Academy', icon: GraduationCap, path: '/academy' },
          { label: 'Courses', icon: BookOpen, path: '/academy/courses' },
        ],
      },
        {
          category: 'Tools & Help',
          items: [
            { label: 'Beta Feedback', icon: ClipboardList, path: '/beta-feedback' },
            { label: 'Refresh', icon: RefreshCw, path: '#', onClick: () => window.location.reload() },
            { label: 'Stats', icon: Activity, path: '/stats' },
            { label: 'Support', icon: Heart, path: '/support' },
            { label: 'Safety', icon: Shield, path: '/safety' },
            { label: 'Policies', icon: FileText_M, path: '/legal' },
          ],
        },
      ...(isAdmin
        ? [
            {
              category: 'Analytics & Stats',
              items: [
                 { label: 'My Stats', icon: BarChart3, path: '/stats' },
                { label: 'City Stats', icon: TrendingUp, path: '/admin' },
                { label: 'Admin Panel', icon: Settings, path: '/admin' },
                { label: 'Revenue Dashboard', icon: DollarSign, path: '/admin/earnings' },
                { label: 'Platform Analytics', icon: MonitorDot, path: '/admin/finance' },
              ],
            },
          ]
        : []),
       ...(isAdmin
        ? [
            {
              category: 'Moderation Center',
              items: [
                { label: 'Chat Moderation', icon: MessageCircle, path: '/admin/chat-moderation' },
                { label: 'Jail Management', icon: Lock, path: '/admin/jail-management' },
                { label: 'Reports Queue', icon: ClipboardList, path: '/admin/reports-queue' },
                { label: 'Stream Monitor', icon: MonitorDot, path: '/admin/stream-monitor' },
              ],
            },
          ]
        : []),
    ];

    return pages.map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => item.show !== false),
    }));
  }, [isAdmin, isSecretary, isLead, isOfficer, isPresident, isAgencyHR, isHRAdmin, profile?.username]);

  const filteredPages = useMemo(() => {
    if (!search.trim()) return allPages;
    const q = search.trim().toLowerCase();
    return allPages
      .map((cat) => ({
        ...cat,
        items: cat.items.filter((item) => item.label.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [allPages, search]);

  const handleNavigate = (path: string) => {
    onClose();
    if (path.startsWith('/home?tab=')) {
      const tab = path.split('=')[1];
      // Navigate to home with tab parameter
      navigate(`/home?tab=${tab}`);
    } else {
      navigate(path);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      onClose();
      navigate('/exit');
    } catch {
      toast.error('Error logging out');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[210] max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-[#070b19]/95 backdrop-blur-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
          >
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-2">
              <h2 className="text-lg font-black text-white">More Pages</h2>
              <button
                onClick={onClose}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pages..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/40"
                />
              </div>
            </div>

            {/* User Info Display - Mobile Only */}
            {isMobile && user && (
              <div className="mx-5 mb-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0 h-11 w-11">
                    {avatarUrl ? (
                      <ProfileFrame frame={equippedFrame} avatarUrl={avatarUrl} username={displayName} size="sm" fillParent />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-cyan-500 text-sm font-black text-white ring-2 ring-cyan-400/50">
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-slate-950 px-0.5 text-[7px] font-black text-cyan-300 ring-1 ring-cyan-400/60">
                      {currentLevel}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{displayName}</p>
                    <p className="text-[9px] font-bold text-cyan-300/80">City Rank Lv. {currentLevel}</p>
                    <div className="mt-1 flex items-center gap-2 text-[9px] font-bold">
                      <span className="flex items-center gap-0.5 text-yellow-300">
                        <Coins className="h-2.5 w-2.5" /> {formatCoins(trollCoins)}
                      </span>
                      <span className="flex items-center gap-0.5 text-purple-300">
                        <Gem className="h-2.5 w-2.5" /> {formatCoins(trollmonds)}
                      </span>
                      {crowns > 0 && (
                        <span className="flex items-center gap-0.5 text-amber-300">
                          <Crown className="h-2.5 w-2.5" /> {crowns}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* XP Progress Bar */}
                <div className="mt-2">
                  <div className="flex items-center justify-between text-[8px] text-white/40 mb-0.5">
                    <span>{formatCoins(currentXp)} XP</span>
                    <span>{formatCoins(nextXp)} next</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-400 transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Scrollable content */}
            <div className="overflow-y-auto px-5 pb-8" style={{ maxHeight: isMobile ? 'calc(85vh - 280px)' : 'calc(85vh - 140px)' }}>
              <div className="space-y-6">
                {filteredPages.map((cat) => (
                  <div key={cat.category}>
                    <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300/70">
                      {cat.category}
                    </h3>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
                      {cat.items.map((item) => {
                        const ItemIcon = item.icon;
                        return (
                          <button
                            key={`${cat.category}-${item.label}`}
                            onClick={() => item.onClick ? item.onClick() : handleNavigate(item.path!)}
                            className="flex flex-col items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center transition hover:border-cyan-400/30 hover:bg-white/[0.08]"
                          >
                            <ItemIcon className="h-5 w-5 text-slate-300" />
                            <span className="text-[10px] font-bold leading-tight text-slate-300">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Logout */}
              {user && (
                <div className="mt-6 border-t border-white/10 pt-4">
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20"
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Fixed icon references
function FileText_M(props: any) {
  return <ScrollText {...props} />;
}

// We need useNavigate from react-router-dom
import { useNavigate } from 'react-router-dom';

function useNavigate_fixed() {
  return useNavigate();
}

/* --- Door Nav Button (desktop) --- */
interface DoorNavButtonProps {
  letter: string;
  label: string;
  to: string;
  active: boolean;
  variant?: 'default' | 'goLive';
}

function DoorNavButton({ letter, label, to, active, variant = 'default' }: DoorNavButtonProps) {
  const isGoLive = variant === 'goLive';
  const frameBorder = active
    ? (isGoLive ? '#ef4444' : '#5c3a1e')
    : (isGoLive ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)');
  const frameBg = active
    ? (isGoLive ? 'linear-gradient(135deg, #ef444444, #b91c1c44)' : 'linear-gradient(135deg, #5c3a1e44, #3d241244)')
    : (isGoLive ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.03)');
  const frameShadow = active
    ? (isGoLive ? '0 0 28px rgba(239,68,68,0.55), 0 0 56px rgba(239,68,68,0.25)' : '0 0 20px rgba(192,135,90,0.35)')
    : (isGoLive ? '0 0 14px rgba(239,68,68,0.18)' : 'none');
  const panelBorder = active
    ? (isGoLive ? '#f87171' : '#6b3f22')
    : (isGoLive ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)');
  const panelBg = active
    ? (isGoLive ? 'linear-gradient(180deg, #ef444466, #b91c1c66)' : 'linear-gradient(180deg, #6b3f2266, #4a2a1566)')
    : (isGoLive ? 'linear-gradient(180deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))' : 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))');
  const letterColor = active ? '#fff' : (isGoLive ? 'rgba(239,68,68,0.7)' : 'rgba(255,255,255,0.5)');
  const letterShadow = active
    ? (isGoLive ? '0 0 18px rgba(239,68,68,0.9)' : '0 0 10px rgba(255,255,255,0.4)')
    : (isGoLive ? '0 0 8px rgba(239,68,68,0.25)' : 'none');
  const underlineBg = active
    ? (isGoLive ? '#ef4444' : '#c0875a')
    : (isGoLive ? 'rgba(239,68,68,0.4)' : 'transparent');
  const underlineShadow = active
    ? (isGoLive ? '0 0 10px rgba(239,68,68,0.8)' : '0 0 8px rgba(192,135,90,0.6)')
    : (isGoLive ? '0 0 6px rgba(239,68,68,0.25)' : 'none');
  const labelColor = active ? '#fff' : (isGoLive ? 'rgba(239,68,68,0.8)' : 'rgba(255,255,255,0.4)');
  const labelShadow = active
    ? (isGoLive ? '0 0 10px rgba(239,68,68,0.7)' : '0 0 6px rgba(192,135,90,0.6)')
    : (isGoLive ? '0 0 5px rgba(239,68,68,0.2)' : 'none');

  return (
    <Link
      to={to}
      className="group relative flex flex-col items-center justify-end"
      style={{ perspective: '600px' }}
    >
      {/* Door */}
      <motion.div
        animate={{
          rotateY: active ? -25 : 0,
          scale: active ? 1.05 : 1,
        }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="relative"
        style={{
          width: 60,
          height: 68,
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Door frame / back */}
        <div
          className="absolute inset-0 rounded-lg border-2"
          style={{
            borderColor: frameBorder,
            background: frameBg,
            boxShadow: frameShadow,
          }}
        />

        {/* Door panel */}
        <motion.div
          animate={{
            rotateY: active ? -25 : 0,
            originX: active ? 0 : 0.5,
          }}
          transition={{ type: 'spring', damping: 20, stiffness: 200 }}
          className="absolute inset-0 flex items-center justify-center rounded-md border"
          style={{
            borderColor: panelBorder,
            background: panelBg,
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'hidden',
          }}
        >
          <span
            className="text-lg font-black select-none"
            style={{
              color: letterColor,
              textShadow: letterShadow,
            }}
          >
            {letter}
          </span>
        </motion.div>

        {/* Active glow underline */}
        <div
          className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full"
          style={{ background: underlineBg, boxShadow: underlineShadow }}
        />
      </motion.div>

      {/* Label under door */}
      <span
        className="mt-1 text-[9px] font-bold leading-none transition-colors duration-200"
        style={{
          color: labelColor,
          textShadow: labelShadow,
        }}
      >
        {label}
      </span>
    </Link>
  );
}

/* --- Main Bottom Navigation Bar --- */
export default function BottomNavBar() {
  const location = useLocation();
  const { user, profile } = useAuthStore();
  const { isBroadcaster } = useRoleChecks(profile);
  const xpStore = useXPStore();
  const [morePagesOpen, setMorePagesOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const badges = useNavBadges();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const openMore = () => setMorePagesOpen(true);
    window.addEventListener('open-more-panel', openMore);
    return () => window.removeEventListener('open-more-panel', openMore);
  }, []);

  const isActive = (path: string) => {
    if (path === '/home') return location.pathname === '/home' || location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  // Desktop door tabs config
  const desktopDoorTabs = [
    { letter: 'H', label: 'Home', to: '/home', active: isActive('/home') || isActive('/') },
    { letter: 'G', label: 'Go Live', to: '/broadcast/setup', active: isActive('/broadcast'), variant: 'goLive' as const },
    { letter: 'M', label: 'MAI Pay', to: '/mai-pay', active: isActive('/mai-pay') },
    { letter: 'C', label: 'Coins', to: '/store', active: isActive('/store') || isActive('/coins') },
    { letter: 'C', label: 'Chats', to: '/utromail', active: isActive('/utromail') },
    { letter: 'E', label: 'Explore', to: '/explore', active: isActive('/explore') || isActive('/live') },
    { letter: 'T', label: 'Treelz', to: '/treelz', active: isActive('/treelz') },
    { letter: 'H', label: 'High Bcasters', to: '/high-bcasters', active: isActive('/high-bcasters') },
    { letter: 'A', label: 'Alerts', to: '/notifications', active: isActive('/notifications') },
    { letter: 'B', label: 'Careers', to: '/careers', active: isActive('/careers') },
  ];

  // Hide bottom nav on Treelz pages
  if (location.pathname.startsWith('/treelz')) return null;

  return (
    <>
      <style>{`
        @keyframes rgbPulse {
          0% { border-color: rgb(255, 0, 0); }
          25% { border-color: rgb(0, 255, 0); }
          50% { border-color: rgb(0, 0, 255); }
          75% { border-color: rgb(255, 0, 255); }
          100% { border-color: rgb(255, 0, 0); }
        }
        .rgb-pulsing-nav-bar {
          animation: rgbPulse 3s infinite;
        }
      `}</style>
      {/* Bottom Navigation Bar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[100] transition-all duration-300`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Main bar with RGB pulsing border */}
        <div className="rgb-pulsing-nav-bar relative border-2 bg-[#050715]/95 backdrop-blur-xl" style={{ overflow: 'visible', zIndex: 100 }}>
          <div
            className={`mx-auto flex items-center ${
              isMobile
                ? 'h-16 justify-around px-1'
                : 'h-24 max-w-[1920px] px-2 md:h-28 md:px-6'
            }`}
            style={{ overflow: 'visible' }}
          >
            {/* LEFT: Profile Module */}
            <div
              className="hidden shrink-0 items-center md:flex"
              style={{ overflow: 'visible' }}
            >
              <ProfileModule collapsed={false} />
            </div>


            {/* CENTER: Desktop navigation gets ALL remaining space */}
            {isMobile ? (
              <nav className="flex flex-1 items-center gap-3 overflow-x-auto scrollbar-hide px-2">
                <NavButton icon={Home} label="Home" to="/home" active={isActive('/home') || isActive('/')} size="large" badge={badges.home} badgeKey="home" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={MessageCircle} label="Chats" to="/utromail" active={isActive('/utromail')} size="large" badge={badges.chats} badgeKey="chats" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={Coins} label="Coins" to="/store" active={isActive('/store') || isActive('/coins')} size="large" badge={badges.coins} badgeKey="coins" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={Sparkles} label="Treelz" to="/treelz" active={isActive('/treelz')} size="large" />
                <NavButton icon={Crown} label="High Bcasters" to="/high-bcasters" active={isActive('/high-bcasters')} size="large" />
                <NavButton icon={Video} label="Go Live" to="/broadcast/setup" active={isActive('/broadcast')} size="large" />
                  <NavButton icon={Mic} label="Podcast" to="/podcast" active={isActive('/podcast')} size="large" />
                  <NavButton icon={Briefcase} label="Careers" to="/careers" active={isActive('/careers')} size="large" badge={badges.careers} badgeKey="careers" onBadgeDismiss={badges.dismiss} />
                  <NavButton icon={Newspaper} label="TCNN" to="/tcnn" active={isActive('/tcnn')} size="large" />
                 <NavButton icon={Gavel} label="Auctions" to="/auctions" active={isActive('/auctions')} size="large" badge={badges.auctions} badgeKey="auctions" onBadgeDismiss={badges.dismiss} />
                 <NavButton icon={Scale} label="Court" to="/troll-court" active={isActive('/troll-court')} size="large" badge={badges.court} badgeKey="court" onBadgeDismiss={badges.dismiss} />
                 <NavButton icon={Gamepad2} label="HydroGaming" to="/hytrogaming" active={isActive('/hytrogaming') || isActive('/gaming')} size="large" />
                <NavButton icon={GraduationCap} label="Academy" to="/academy" active={isActive('/academy')} size="large" badge={badges.academy} badgeKey="academy" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={DollarSign} label="MAI Pay" to="/mai-pay" active={isActive('/mai-pay')} size="large" />
                <NavButton icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} size="large" />
                <NavButton icon={Bell} label="Alerts" to="/notifications" active={isActive('/notifications')} size="large" badge={badges.alerts} badgeKey="alerts" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={Search} label="Search" to="/search" active={isActive('/search')} size="large" />
                <NavButton icon={Users} label="Family" to="/family/home" active={isActive('/family')} size="large" badge={badges.family} badgeKey="family" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={Store} label="Shop" to="/marketplace" active={isActive('/marketplace')} size="large" badge={badges.shop} badgeKey="shop" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} size="large" badge={badges.inventory} badgeKey="inventory" onBadgeDismiss={badges.dismiss} />
                <NavButton icon={BookOpen} label="Church" to="/church" active={isActive('/church')} size="large" />
                <NavButton icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} size="large" />
                <NavButton icon={Compass} label="Explore" to="/explore" active={isActive('/explore') || isActive('/live')} size="large" />
                <NavButton icon={ClipboardList} label="Beta" to="/beta-feedback" active={isActive('/beta-feedback')} size="large" />
                <NavButton icon={User} label="Profile" to={profile?.username ? `/profile/${profile.username}` : '/profile'} active={isActive('/profile')} size="large" />
                <NavButton
                  icon={LayoutGrid}
                  label="More"
                  onClick={() => setMorePagesOpen(true)}
                  active={morePagesOpen}
                  size="large"
                  level={xpStore.level}
                  showLevelOrb={isMobile}
                />
              </nav>
            ) : (
              <nav className="flex min-w-0 flex-1 items-center justify-around px-4">
                {desktopDoorTabs.map((tab) => (
                  <DoorNavButton
                    key={tab.to}
                    letter={tab.letter}
                    label={tab.label}
                    to={tab.to}
                    active={tab.active}
                    variant={tab.variant}
                  />
                ))}
              </nav>
            )}


            {/* RIGHT: fixed-size utility buttons */}
            <div className="hidden shrink-0 items-center gap-2 md:flex">
              <NavButton
                icon={ClipboardList}
                label="Beta Feedback"
                to="/beta-feedback"
                active={isActive('/beta-feedback')}
              />


              <NavButton
                icon={LayoutGrid}
                label="More"
                onClick={() => setMorePagesOpen(true)}
                active={morePagesOpen}
              />
            </div>
          </div>
        </div>
      </div>

      {/* More Pages Slide-up Panel */}
      <MorePagesPanel isOpen={morePagesOpen} onClose={() => setMorePagesOpen(false)} />
    </>
  );
}


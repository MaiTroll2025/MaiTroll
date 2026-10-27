import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileFrame from '@/components/profile/ProfileFrame';
import { useUserFrame } from '@/hooks/useUserFrame';
import {
  Home,
  Search,
  Bell,
  User,
  Coins,
  Gem,
  Crown,
  X,
  Trophy,
  Store,
  Package,
  DollarSign,
  Car,
  Zap,
  Sparkles,
  Gamepad2,
  Gavel,
  Building2,
  Users,
  Waves,
  BookOpen,
  Heart,
  Mic,
  Newspaper,
  Shuffle,
  Scale,
  Lock,
  Landmark,
  Vote,
  ClipboardList,
  Briefcase,
  Star,
  Compass,
  LayoutGrid,
  Scan,
  Radio,
  ScrollText as ScrollTextIcon,
  Eye,
  MonitorDot,
  Activity,
  Shield,
  Megaphone,
  RefreshCw,
  TrendingUp,
  Settings,
  BarChart3,
  MessageCircle,
  LogOut,
  Lightbulb,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { useCoins } from '@/lib/hooks/useCoins';
import { useXPStore } from '@/stores/useXPStore';
import { isAdminEmail, isMarketingAgent, UserRole } from '@/lib/supabase';
import { toast } from 'sonner';
import { useIsActiveFounder } from '@/hooks/useFounderProgram';

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

export function MorePagesPanel({ isOpen, onClose }: MorePagesPanelProps) {
  const { user, profile, logout } = useAuthStore();
  const xpStore = useXPStore();
  const { balances } = useCoins();
  const navigate = useNavigate_fixed();
  const [isMobile, _setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const trollCoins = Number((balances as any)?.troll_coins ?? 0);
  const trollmonds = Number((profile as any)?.trollmonds ?? 0);
  const crowns = Number((profile as any)?.crowns ?? 0);
  const _currentLevel = xpStore.level;
  const displayName = profile?.display_name || profile?.username || 'Citizen';
  const avatarUrl = profile?.avatar_url;
  const equippedFrame = useUserFrame(user?.id);
  const currentXp = xpStore.xpTotal ?? profile?.xp ?? profile?.total_xp ?? 0;
  const nextXp = xpStore.xpToNext ?? profile?.next_level_xp ?? 1;
  const progress = xpStore.progress ?? (nextXp > 0 ? Math.min((currentXp / nextXp) * 100, 100) : 0);
  const {
    isAdmin, isSecretary, isLead, isOfficer, isPresident, isBroadcaster: _isBroadcaster, isAgencyHR, isHRAdmin,
    isAgencyLeader, isAttorney, isProsecutor, isPastor, isJournalist, isNewsCaster,
    isChiefNewsCaster, isCEOAssistant, isNoahAssistant: _isNoahAssistant, isAuctioneer, isEmployee: _isEmployee,
  } = useRoleChecks(profile, user?.email);
  const [search, setSearch] = useState('');

  // ⭐ Founder Program: the "More" panel is the real web nav container, so the
  // Founder Hub has to be listed here too or searching "founder" finds nothing.
  // Role-based: active Founders AND Admins (Admins get the in-page
  // "Manage Founders" tab). Status check, not the badge check.
  const isActiveFounder = useIsActiveFounder(user?.id);
  const canSeeFounderHub = isActiveFounder || isAdmin;
  const canSeeMarketingPage = isAdmin || isMarketingAgent(profile);

  const allPages = useMemo(() => {
    const pages: { category: string; items: PageEntry[] }[] = [
      {
        category: 'All Pages',
        items: [
          { label: 'Home', icon: Home, path: '/home' },
          { label: 'Search', icon: Search, path: '/search' },
          { label: 'Explore', icon: Compass as React.ElementType, path: '/explore' },
          { label: 'Insights', icon: Lightbulb, path: '/insights' },
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
          { label: 'Troll Up', icon: Zap, path: '/troll-up' },
          { label: 'MaiLife', icon: Sparkles, path: '/mai-life' },
        ],
      },
      {
        category: 'Community',
        items: [
          { label: 'Community Forum', icon: MessageCircle, path: '/community' },
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
           { label: 'Mai Talent Show', icon: Mic, path: '/mai-sing-off' },
        ],
      },
       {
         category: 'Government',
         items: [
           { label: 'Troll Court', icon: Scale, path: '/troll-court' },
           ...(canSeeFounderHub
             ? [{ label: 'Founder Hub', icon: Sparkles as any, path: '/founder' }]
             : []),
           { label: 'Inmates', icon: Lock, path: '/inmates' },
           { label: 'City Laws & Fees', icon: ScrollTextIcon, path: '/home?tab=laws-fees' },
           { label: 'Mayor Dashboard', icon: Crown, path: '/mayor' },
           { label: 'Town Meeting', icon: Users, path: '/town-meeting' },
           { label: 'City Government', icon: Landmark, path: '/city-government' },
           { label: 'President Candidates', icon: Vote, path: '/president' },
           { label: 'Elections', icon: ClipboardList, path: '/government' },
           { label: 'Proposals', icon: ScrollTextIcon, path: '/government/proposals' },
           { label: 'Openings', icon: Briefcase, path: '/government/openings' },
           { label: 'Careers', icon: Briefcase, path: '/careers' },
           ...(canSeeMarketingPage
             ? [{ label: 'Marketing', icon: Megaphone, path: '/admin/marketing' }]
             : []),
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
           ? [{ label: 'Secretary Console', icon: ScrollTextIcon as any, path: '/secretary' }]
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
       category: 'Tools & Help',
       items: [
         { label: 'Beta Feedback', icon: ClipboardList, path: '/beta-feedback' },
         { label: 'Refresh', icon: RefreshCw, path: '#', onClick: () => window.location.reload() },
         { label: 'Stats', icon: Activity, path: '/stats' },
         { label: 'Support', icon: Heart, path: '/support' },
         { label: 'Safety', icon: Shield, path: '/safety' },
         { label: 'Policies', icon: ScrollTextIcon, path: '/legal' },
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
  }, [profile?.username, canSeeFounderHub, canSeeMarketingPage, isOfficer, isSecretary, isAdmin, isLead, isPresident, isAttorney, isProsecutor, isPastor, isAgencyHR, isAgencyLeader, isJournalist, isNewsCaster, isChiefNewsCaster, isCEOAssistant, isAuctioneer, isHRAdmin]);

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
            className="fixed inset-x-0 bottom-0 z-[210] max-h-[85vh] overflow-hidden rounded-t-3xl border-t border-white/10 bg-transparent backdrop-blur-2xl shadow-[0_-8px_40px_rgba(0,0,0,0.5)]"
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
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-white">{displayName}</p>
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

function formatCoins(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* --- Role helpers (mirrored from Sidebar/BottomNav) --- */
function useRoleChecks(profile: any, userEmail?: string) {
  const role = String(profile?.role || '');
  const trollRole = String(profile?.troll_role || '');

  const isAdmin =
    isAdminEmail(userEmail) ||
    role === String(UserRole.ADMIN) ||
    trollRole === String(UserRole.ADMIN) ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    profile?.is_admin ||
    role === 'superadmin' ||
    role === 'owner' ||
    role === 'ceo' ||
    trollRole === 'ceo' ||
    trollRole === 'owner' ||
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
    trollRole === 'auctioneer'

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
      'employee',
    ]).has(role) ||
    new Set([
      'troll_officer', 'lead_troll_officer', 'secretary', 'ceo_assistant',
      'noah_assistant', 'hr_admin', 'hr_manager', 'agency_hr_manager',
      'pastor', 'agency_leader', 'attorney', 'prosecutor', 'journalist',
      'auctioneer', 'troller', 'agency_hr', 'president', 'vice_president',
      'troll_city_secretary', 'troll_city_treasurer', 'executive_secretary',
      'employee',
    ]).has(trollRole)
    ;

  return { isAdmin, isSecretary, isLead, isOfficer, isPresident, isBroadcaster, isAgencyHR, isHRAdmin, isAgencyLeader, isAttorney, isProsecutor, isPastor, isJournalist, isNewsCaster, isChiefNewsCaster, isCEOAssistant, isNoahAssistant, isAuctioneer, isEmployee, role, trollRole };
}

// We need useNavigate from react-router-dom
function useNavigate_fixed() {
  return useNavigate();
}

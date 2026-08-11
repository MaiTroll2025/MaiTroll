import React, { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SafeLink } from '@/hooks/useSafeNavigate'
import {
   AlertTriangle,
   Award,
   Banknote,
   BookOpen,
   Briefcase,
   Building2,
   Calendar,
   ChevronLeft,
   ChevronRight,
   Church,
   Coins,
   Crown,
   Database,
   DollarSign,
   FileText,
   Gamepad2,
   Gavel,
   GraduationCap,
   Home,
   Landmark,
   LayoutDashboard,
   LifeBuoy,
   List,
   Lock,
   Mail,
   Megaphone,
   MessageSquare,
   Newspaper,
   Package,
   Phone,
   Radio,
   Scale,
   Settings,
   Shield,
   ShoppingBag,
   Shuffle,
   Star,
   Store,
   TrendingUp,
   Trophy,
    Users,
    Video,
    Wallet,
    Warehouse,
    Waves,
    Zap,
  } from 'lucide-react'

import CourtEntryModal from './CourtEntryModal'
import UserProfileWidget from './sidebar/UserProfileWidget'
import { useAuthStore } from '@/lib/store'
import { supabase, UserRole } from '@/lib/supabase'
import { canAccessTromail } from '@/lib/tromail'
import { isPrideMonth } from '@/lib/prideMonth'
import { useCoins } from '@/lib/hooks/useCoins'
import { useXPStore } from '@/stores/useXPStore'
import { useSidebarUpdates } from '@/hooks/useSidebarUpdates'
import { useJailMode } from '@/hooks/useJailMode'
import { useBroadcastLockdown } from '@/hooks/useBroadcastLockdown'
import { useShareAThonRestriction } from '@/hooks/useShareAThonRestriction'
import { useSidebarStore } from '@/stores/useSidebarStore'
import { STORE_USD_PER_COIN } from '@/lib/coinMath'
import { NIGHT_WATCH_PATROL_ROLES } from '@/lib/staff'

type GridGlow = 'green' | 'pink' | 'cyan' | 'red' | 'purple' | 'teal'

type GridItemTone = 'default' | 'green' | 'blue' | 'cyan' | 'pink' | 'red' | 'orange' | 'purple' | 'teal'

type GridItemProps = {
  icon: React.ComponentType<{ size?: number | string; className?: string }>
  label: string
  to: string
  active?: boolean
  highlight?: boolean
  onClick?: () => void
  className?: string
  underConstruction?: boolean
  glow?: GridGlow
  collapsed?: boolean
  tone?: GridItemTone
  badge?: string
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function SectionTitle({ title, collapsed }: { title: string; collapsed: boolean }) {
  if (collapsed) return null

  return (
    <div className="col-span-2 mt-4 first:mt-0 px-1">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/80">
        <span className="h-px flex-1 bg-gradient-to-r from-red-400/60 via-yellow-300/45 via-green-300/35 via-cyan-300/35 to-transparent" />
        {title}
        <span className="h-px flex-1 bg-gradient-to-l from-pink-400/60 via-purple-400/45 via-blue-300/35 via-green-300/30 to-transparent" />
      </div>
    </div>
  )
}

function ShellBackdrop() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-[#13071f] to-slate-950" />
      {isPrideMonth() && (
        <>
          <div className="pointer-events-none absolute inset-0 opacity-45 bg-[linear-gradient(135deg,rgba(239,68,68,0.18)_0%,rgba(249,115,22,0.15)_16%,rgba(250,204,21,0.12)_32%,rgba(34,197,94,0.12)_48%,rgba(34,211,238,0.14)_64%,rgba(59,130,246,0.14)_80%,rgba(168,85,247,0.16)_100%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_18%_12%,rgba(236,72,153,0.28),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_78%_0%,rgba(34,211,238,0.22),transparent_46%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(140%_140%_at_95%_88%,rgba(250,204,21,0.13),transparent_44%)]" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(236,72,153,0.12)_0%,rgba(250,204,21,0.08)_26%,rgba(34,197,94,0.07)_44%,rgba(14,165,233,0.09)_66%,rgba(168,85,247,0.12)_100%)]" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-pink-300/70 via-yellow-200/60 via-cyan-300/70 to-transparent" />
        </>
      )}
    </>
  )
}

export default function Sidebar() {
  const { user, profile } = useAuthStore()
  const { level } = useXPStore()
  const { balances } = useCoins()
  const { isUpdated, markAsViewed } = useSidebarUpdates()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path
  const isHytroGamingActive = location.pathname === '/hytrogaming' || location.pathname.startsWith('/gaming/watch/')

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeTrollFamily, setCanSeeTrollFamily] = useState(false)
  const [hasFamily, setHasFamily] = useState(false)
  const [isFamilyLeader, setIsFamilyLeader] = useState(false)
  const [isFamilyMember, setIsFamilyMember] = useState(false)
  const [canSeeSecretary, setCanSeeSecretary] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isAttorney, setIsAttorney] = useState(false)
  const [isProsecutor, setIsProsecutor] = useState(false)
  const [canSeeInmates, setCanSeeInmates] = useState(false)
  const [isBackgroundJailed, setIsBackgroundJailed] = useState(false)
  const [isApprovedAuctioneer, setIsApprovedAuctioneer] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)

  const [showCourtModal, setShowCourtModal] = useState(false)

  const { isCollapsed, setCollapsed, expandGroup } = useSidebarStore()
  const isSidebarCollapsed = isCollapsed
  const setIsSidebarCollapsed = setCollapsed
  const [sidebarView, setSidebarView] = useState<'main' | 'adminPages'>('main')
  const { isJailed } = useJailMode(profile?.id)
  const { isLocked: isBroadcastLockedDown } = useBroadcastLockdown()

  const role = String(profile?.role || '')
  const trollRole = String(profile?.troll_role || '')

  const canSeeAttorneyDashboard = Boolean(
    isAttorney ||
    profile?.is_attorney ||
    role === 'attorney' ||
    trollRole === 'attorney'
  )

  const isActivePath = (path: string, startsWith = false) => {
    return startsWith ? location.pathname.startsWith(path) : location.pathname === path
  }

  const canSeeAuctionStudio = Boolean(
    isApprovedAuctioneer ||
    (profile?.role as string) === 'auctioneer' ||
    profile?.troll_role === 'auctioneer' ||
    (profile as any)?.is_auctioneer
  )

  const canSeeProsecutorDashboard = Boolean(
    isProsecutor ||
    profile?.is_prosecutor ||
    role === 'prosecutor' ||
    trollRole === 'prosecutor'
  )

  const isAdmin =
    role === String(UserRole.ADMIN) ||
    trollRole === String(UserRole.ADMIN) ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    profile?.is_admin ||
    role === 'superadmin' ||
    trollRole === 'ceo' ||
    !!(profile as { is_superadmin?: boolean })?.is_superadmin

  const isCEO = role === 'ceo' || trollRole === 'ceo' || isAdmin
  const isCEOAssistant = role === 'ceo_assistant' || trollRole === 'ceo_assistant' || (profile as any)?.is_ceo_assistant
  const isNoahAssistant = role === 'noah_assistant' || trollRole === 'noah_assistant' || (profile as any)?.is_noah_assistant
  const isNoahAdmin = role === 'noah_admin' || trollRole === 'noah_admin' || (profile as any)?.is_noah_admin

  const showAdminPagesTab = Boolean(
    isAdmin ||
    isCEOAssistant ||
    isNoahAssistant ||
    canSeeSecretary ||
    canSeeOfficer ||
    canSeeProsecutorDashboard ||
    profile?.role === UserRole.PRESIDENT ||
    (profile as any)?.is_pastor
  )

  const canSeeAgencyHRDashboard = Boolean(
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.ADMIN) ||
    role === 'agency_hr' ||
    trollRole === 'agency_hr' ||
    trollRole === String(UserRole.AGENCY_HR_MANAGER) ||
    trollRole === 'agency_hr_manager' ||
    (profile as any)?.is_agency_hr ||
    (profile as any)?.is_agency_hr_manager
  )

  const isSecretary = role === String(UserRole.SECRETARY) || trollRole === String(UserRole.SECRETARY)

  const isLead =
    role === String(UserRole.LEAD_TROLL_OFFICER) ||
    profile?.is_lead_officer ||
    trollRole === String(UserRole.LEAD_TROLL_OFFICER) ||
    isAdmin

  const canSeeCourt = !!user && !!profile



  const profileRoleLower = String(profile?.role || '').toLowerCase()
  const trollRoleLower = String(profile?.troll_role || '').toLowerCase()

  const canAccessNightWatch = Boolean(
    isAdmin ||
    canSeeOfficer ||
    canSeeSecretary ||
    isCEOAssistant ||
    isNoahAssistant ||
    NIGHT_WATCH_PATROL_ROLES.includes(profileRoleLower as any) ||
    NIGHT_WATCH_PATROL_ROLES.includes(trollRoleLower as any)
  )

  const canBroadcast = () => {
    return !isBroadcastLockedDown &&
      profile?.drivers_license_status !== 'suspended' &&
      (role === 'broadcaster' ||
        profile?.is_broadcaster ||
        trollRole === 'broadcaster')
  }

  // Share-A-Thon restriction check
  const { restricted: isShareAThonRestricted } = useShareAThonRestriction(user?.id);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profile?.id) return

      try {
        const { data: officerData } = await supabase
          .from('officer_members')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle()
        setCanSeeOfficer(!!officerData)



        const { data: familyData } = await supabase
          .from('troll_families')
          .select('*')
          .or(`leader_id.eq.${profile.id}`)
          .maybeSingle()

        let finalFamilyData = familyData

        if (!finalFamilyData) {
          const { data: memberData } = await supabase
            .from('family_members')
            .select('family_id')
            .eq('user_id', profile.id)
            .eq('approval_status', 'approved')
            .limit(1)
            .maybeSingle()

          if (memberData) {
            const { data: familyFromMembers } = await supabase
              .from('troll_families')
              .select('*')
              .eq('id', memberData.family_id)
              .maybeSingle()
            if (familyFromMembers) finalFamilyData = familyFromMembers
          }
        }

        const hasFamilyRole = profile?.role === 'troll_family' || profile?.troll_role === 'troll_family'

        if (finalFamilyData || hasFamilyRole) {
          setHasFamily(true)
          setIsFamilyLeader(finalFamilyData?.leader_id === profile.id)
          setIsFamilyMember(true)
        } else {
          setHasFamily(false)
          setIsFamilyLeader(false)
          setIsFamilyMember(false)
        }

        setCanSeeTrollFamily(!!finalFamilyData || hasFamilyRole || profile?.role === UserRole.ADMIN)

        const { data: secData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', profile.id)
          .single()
        setCanSeeSecretary(
          secData?.role === UserRole.SECRETARY ||
            secData?.role === UserRole.ADMIN ||
            secData?.role === UserRole.EXECUTIVE_SECRETARY ||
            secData?.role === UserRole.TROLL_CITY_SECRETARY ||
            !!(profile?.is_admin as boolean | undefined) ||
            !!(profile?.is_secretary as boolean | undefined) ||
            role === 'superadmin' ||
            role === 'ceo' ||
            !!(trollRole &&
              ['secretary', String(UserRole.EXECUTIVE_SECRETARY), String(UserRole.TROLL_CITY_SECRETARY)].includes(
                trollRole,
              ))
        )
        setIsStaff(secData?.role === UserRole.SECRETARY || secData?.role === UserRole.ADMIN || !!officerData)

        const { data: attorneyData } = await supabase
          .from('user_profiles')
          .select('is_attorney')
          .eq('id', profile.id)
          .single()
        setIsAttorney(attorneyData?.is_attorney === true)

        const { data: prosecutorData } = await supabase
          .from('user_profiles')
          .select('is_prosecutor')
          .eq('id', profile.id)
          .single()
        setIsProsecutor(prosecutorData?.is_prosecutor === true)

        const { data: auctioneerData } = await supabase
          .from('auctioneer_profiles')
          .select('id, is_active')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .maybeSingle()
        setIsApprovedAuctioneer(!!auctioneerData)

        const { data: teacherData } = await supabase
          .from('academy_teachers')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_approved', true)
          .maybeSingle()
        setIsTeacher(!!teacherData)

        setCanSeeInmates(
          !!officerData ||
            isAdmin ||
            profile?.role === UserRole.TROLL_OFFICER ||
            profile?.troll_role === UserRole.TROLL_OFFICER ||
            profile?.is_troll_officer ||
            profile?.role === UserRole.LEAD_TROLL_OFFICER ||
            profile?.troll_role === UserRole.LEAD_TROLL_OFFICER ||
            profile?.is_lead_officer ||
            secData?.role === UserRole.ADMIN ||
            secData?.role === UserRole.LEAD_TROLL_OFFICER
        )

        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('is_background_jailed')
          .eq('id', profile.id)
          .single()
        setIsBackgroundJailed(profileData?.is_background_jailed === true)
      } catch (error) {
        console.error('Error fetching user data:', error)
      }
    }

    fetchUserData()
  }, [profile?.id, profile, isAdmin])

  useEffect(() => {
    const path = location.pathname
    if (path.startsWith('/pool')) {
      expandGroup('Social')
    } else if (path.startsWith('/marketplace')) {
      expandGroup('City Center')
    } else if (path.startsWith('/government')) {
      expandGroup('Government Sector')
    } else if (path.startsWith('/city-registry')) {
      expandGroup('City Registry')
    } else if (path.startsWith('/jobs')) {
      expandGroup('Talent Offices')
    } else if (path.startsWith('/agencies') || path.startsWith('/agency-dashboard')) {
      expandGroup('Talent Offices')
    }
  }, [location.pathname, expandGroup])

  const mainPaths = ['/', '/inventory', '/marketplace', '/leaderboard', '/credit-scores', '/store', '/creator-switch', '/troll-court', '/troll-games']
  const supportPaths = ['/support', '/safety']
  const socialPaths = ['/utromail', '/pool']
  if (profile?.role === 'troll_family') {
    socialPaths.push('/family/home')
  } else {
    socialPaths.push('/family/browse')
    if (canSeeTrollFamily) socialPaths.push('/family/home')
  }
  const specialAccessPaths: string[] = []
  if (canSeeCourt) specialAccessPaths.push('/admin/court-dockets')
  if (canSeeOfficer) specialAccessPaths.push('/officer/dashboard')
  if (isLead) specialAccessPaths.push('/lead-officer')
  if (canSeeSecretary || isAdmin) specialAccessPaths.push('/secretary')
  if (isAdmin) specialAccessPaths.push('/admin/applications')
  if (profile?.role === UserRole.PRESIDENT || profile?.troll_role === UserRole.PRESIDENT) specialAccessPaths.push('/government')
    const systemPaths = ['/apply', '/wallet']
  const isAnyUpdated = (paths: string[]) => paths.some(path => isUpdated(path))

  const jailedLocked = isJailed && !(profile?.role === 'admin' || profile?.is_admin)

  const quickStatus = useMemo(() => {
    const coinBalance = Number((balances as any)?.troll_coins ?? (balances as any)?.balance ?? 0)
    const cashBalance = Number((balances as any)?.troll_coins ?? 0)
    const cashValue = cashBalance * STORE_USD_PER_COIN
    return [
      { label: 'Level', value: String(level || 1) },
      { label: 'Coins', value: coinBalance > 999 ? `${Math.floor(coinBalance / 1000)}K` : coinBalance.toLocaleString(), subValue: cashValue > 0 ? `$${cashValue.toFixed(2)}` : null },
      { label: 'Family', value: hasFamily ? 'Yes' : 'No' },
    ]
  }, [balances, hasFamily, level])

  return (
    <aside
      className={cx(
        'fixed left-0 top-0 z-50 flex h-screen max-h-screen flex-col overflow-y-auto overflow-x-hidden md:overflow-hidden border-r border-pink-300/25 bg-slate-950 text-white shadow-[12px_0_48px_rgba(0,0,0,0.55),0_0_30px_rgba(236,72,153,0.14),0_0_34px_rgba(34,211,238,0.10),inset_0_0_34px_rgba(168,85,247,0.10)] backdrop-blur-2xl transition-all duration-300',
        isSidebarCollapsed ? 'w-20' : 'w-72'
      )}
    >
      <ShellBackdrop />

      <div className="relative z-10 shrink-0 border-b border-white/10 bg-white/[0.025] p-3">
        <div className={cx('flex items-center', isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
          {!isSidebarCollapsed && (
            <SafeLink to="/home" className="group flex min-w-0 items-center gap-3">
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-pink-500 via-yellow-400 via-emerald-400 via-cyan-400 to-purple-600 shadow-[0_0_28px_rgba(236,72,153,0.28),0_0_18px_rgba(34,211,238,0.18)]">
                <span className="text-xl font-black text-white drop-shadow">T</span>
                <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border border-slate-950 bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
              </div>
                <div className="min-w-0 text-left">
                <div className="truncate bg-gradient-to-r from-white via-pink-100 via-yellow-100 via-cyan-100 to-purple-200 bg-clip-text text-lg font-black leading-tight text-transparent">
                  MaiMaiTroll
                </div>
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-white/80">
                  City OS
                </div>
              </div>
              </SafeLink>
          )}

          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className={cx(
              'shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition-all duration-200 hover:border-pink-300/40 hover:bg-white/[0.08] hover:text-white hover:shadow-[0_0_18px_rgba(236,72,153,0.18)]',
              isSidebarCollapsed && 'mx-auto'
            )}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </div>

      {!isSidebarCollapsed && profile && (
        <div className="relative z-10 shrink-0 px-3 pt-3">
          <div className="rounded-2xl border border-pink-300/20 bg-slate-950/60 p-1 shadow-[0_0_18px_rgba(236,72,153,0.08),inset_0_1px_0_rgba(255,255,255,0.05)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <UserProfileWidget />
          </div>
        </div>
      )}

      {!isSidebarCollapsed && profile && (
        <div className="relative z-10 shrink-0 grid grid-cols-3 gap-2 px-3 pt-3">
          {quickStatus.map(item => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.07] via-pink-400/[0.035] to-cyan-400/[0.035] p-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <div className="truncate text-[10px] text-slate-400">{item.label}</div>
              <div className="truncate text-xs font-black text-white">{item.value}</div>
              {item.subValue && (
                <div className="truncate text-[9px] text-green-400 font-medium">{item.subValue}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 pb-6 overscroll-contain custom-scrollbar">
        {!isSidebarCollapsed && showAdminPagesTab && (
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSidebarView('main')}
              className={cx(
                'rounded-2xl border px-3 py-2 text-sm font-semibold transition',
                sidebarView === 'main'
                  ? 'border-pink-300 bg-gradient-to-r from-pink-600/80 via-purple-600/75 to-cyan-500/75 text-white shadow-[0_0_18px_rgba(236,72,153,0.22)]'
                  : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-pink-300/35 hover:text-white'
              )}
            >
              Main
            </button>
            <button
              type="button"
              onClick={() => setSidebarView('adminPages')}
              className={cx(
                'rounded-2xl border px-3 py-2 text-sm font-semibold transition',
                sidebarView === 'adminPages'
                  ? 'border-pink-300 bg-gradient-to-r from-pink-600/80 via-purple-600/75 to-cyan-500/75 text-white shadow-[0_0_18px_rgba(236,72,153,0.22)]'
                  : 'border-white/10 bg-slate-950/70 text-slate-400 hover:border-pink-300/35 hover:text-white'
              )}
            >
              All Pages
            </button>
          </div>
        )}

        {sidebarView === 'main' ? (
          jailedLocked ? (
            <div className={cx('grid gap-2', isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
              {!isSidebarCollapsed && (
                <div className="col-span-2 space-y-4 rounded-2xl border border-red-500/25 bg-red-950/20 px-3 py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-red-500/25 bg-red-500/10">
                    <Lock className="text-red-400" size={32} />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Access Restricted</p>
                    <p className="mt-1 text-[10px] text-gray-400">City services suspended while incarcerated.</p>
                  </div>
                </div>
              )}
              {isBackgroundJailed && (
                <GridItem collapsed={isSidebarCollapsed} icon={AlertTriangle} label="Appeal" to="/jail/appeal?active=false" active={isActive('/jail/appeal')} className="text-orange-300" tone="orange" />
              )}
              <GridItem collapsed={isSidebarCollapsed} icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} tone="blue" />
            </div>
          ) : (
            <div className={cx('grid gap-2', isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
              <div className={isSidebarCollapsed ? 'col-span-1 mb-2' : 'col-span-2 mb-2'}>
                {canBroadcast() && !isShareAThonRestricted ? (
                  <SafeLink
                    to="/broadcast/setup"
                    className={cx(
                      'relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-r from-pink-500 via-purple-600 via-cyan-400 to-emerald-400 font-black text-white shadow-[0_0_24px_rgba(236,72,153,0.26),0_0_18px_rgba(34,211,238,0.20)] transition-all duration-300 hover:scale-[1.02] hover:from-pink-400 hover:via-purple-500 hover:to-cyan-300',
                      isSidebarCollapsed ? 'h-14 p-3' : 'gap-3 p-3.5'
                    )}
                    title="Go Live"
                  >
                    <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.28),transparent)] opacity-50" />
                    <Video size={isSidebarCollapsed ? 22 : 20} className="relative z-10 text-white" />
                    {!isSidebarCollapsed && (
                      <div className="relative z-10 text-left leading-tight">
                        <div className="text-sm uppercase tracking-wide">Go Live</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">Start Broadcast</div>
                      </div>
                    )}
                  </SafeLink>
                ) : (
                  <div
                    className={cx(
                      'flex w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-800/55 font-black text-slate-400',
                      isSidebarCollapsed ? 'h-14 p-3' : 'gap-3 p-3.5'
                    )}
                    title={isShareAThonRestricted ? 'Share-A-Thon: Broadcasting restricted' : isBroadcastLockedDown ? 'Broadcast locked down' : 'Broadcaster access required'}
                  >
                    <Video size={isSidebarCollapsed ? 22 : 20} className="text-slate-500" />
                    {!isSidebarCollapsed && (
                      <div className="text-left leading-tight">
                        <div className="text-sm uppercase tracking-wide">Go Live</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          {isShareAThonRestricted ? 'Share-A-Thon Lock' : isBroadcastLockedDown ? 'Locked' : 'Go TO Neighborhood Page 1st'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <SectionTitle title="City Core" collapsed={isSidebarCollapsed} />
              <GridItem collapsed={isSidebarCollapsed} icon={Home} label="Home" to="/home" active={isActive('/home')} highlight={isUpdated('/home')} onClick={() => markAsViewed('/home')} tone="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={Coins} label="Buy Coins" to="/store" active={isActive('/store')} highlight={isUpdated('/store')} onClick={() => markAsViewed('/store')} tone="green" glow="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Live Auctions" to="/auctions" active={isActive('/auctions')} highlight={isUpdated('/auctions')} onClick={() => markAsViewed('/auctions')} className="text-green-400" tone="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={Scale} label="Troll Court" to="/troll-court" active={isActive('/troll-court')} highlight={isUpdated('/troll-court')} onClick={() => markAsViewed('/troll-court')} tone="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={Building2} label="Neighborhood" to="/neighborhood-setup" active={isActive('/neighborhood-setup')} highlight={isUpdated('/neighborhood-setup')} onClick={() => markAsViewed('/neighborhood-setup')} className="text-cyan-400" tone="cyan" />
              <GridItem collapsed={isSidebarCollapsed} icon={Gamepad2} label="HytroGaming" to="/hytrogaming" active={isHytroGamingActive} highlight={isUpdated('/hytrogaming') || location.pathname.startsWith('/gaming/watch/')} onClick={() => markAsViewed('/hytrogaming')} className="text-purple-400" tone="purple" glow="pink" />

              <SectionTitle title="Mai Troll Academy" collapsed={isSidebarCollapsed} />
              <GridItem collapsed={isSidebarCollapsed} icon={BookOpen} label="Academy" to="/academy" active={isActivePath('/academy')} highlight={isUpdated('/academy')} onClick={() => markAsViewed('/academy')} className="text-emerald-400" tone="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={GraduationCap} label="Courses" to="/academy/courses" active={isActivePath('/academy/courses')} highlight={isUpdated('/academy/courses')} onClick={() => markAsViewed('/academy/courses')} className="text-teal-400" tone="teal" />
              <GridItem collapsed={isSidebarCollapsed} icon={Award} label="Certificates" to="/academy/certificates" active={isActivePath('/academy/certificates')} highlight={isUpdated('/academy/certificates')} onClick={() => markAsViewed('/academy/certificates')} className="text-yellow-400" tone="orange" />
              <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Admissions" to="/academy/admissions" active={isActivePath('/academy/admissions')} highlight={isUpdated('/academy/admissions')} onClick={() => markAsViewed('/academy/admissions')} className="text-cyan-400" tone="cyan" />
              <GridItem collapsed={isSidebarCollapsed} icon={BookOpen} label="Classroom" to="/academy/classroom" active={isActivePath('/academy/classroom', true)} highlight={isUpdated('/academy/classroom')} onClick={() => markAsViewed('/academy/classroom')} className="text-sky-400" tone="cyan" />
              {isTeacher && (
                <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Teacher Dashboard" to="/academy/teacher/dashboard" active={isActivePath('/academy/teacher/dashboard')} highlight={isUpdated('/academy/teacher/dashboard')} onClick={() => markAsViewed('/academy/teacher/dashboard')} className="text-amber-400" tone="orange" />
              )}
              {isAdmin && (
                <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Board of Education" to="/academy/admin" active={isActivePath('/academy/admin')} highlight={isUpdated('/academy/admin')} onClick={() => markAsViewed('/academy/admin')} className="text-purple-400" tone="purple" />
              )}
              <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Assignments" to="/academy/assignments" active={isActivePath('/academy/assignments', true)} highlight={isUpdated('/academy/assignments')} onClick={() => markAsViewed('/academy/assignments')} className="text-pink-400" tone="pink" />
              <GridItem collapsed={isSidebarCollapsed} icon={GraduationCap} label="Teachers" to="/academy/teachers" active={isActivePath('/academy/teachers')} highlight={isUpdated('/academy/teachers')} onClick={() => markAsViewed('/academy/teachers')} className="text-amber-400" tone="orange" />
              <GridItem collapsed={isSidebarCollapsed} icon={Wallet} label="My Loans" to="/academy/loans" active={isActivePath('/academy/loans')} highlight={isUpdated('/academy/loans')} onClick={() => markAsViewed('/academy/loans')} className="text-amber-400" tone="orange" />
              <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Transcript" to="/academy/transcript/official" active={isActivePath('/academy/transcript/official')} highlight={isUpdated('/academy/transcript/official')} onClick={() => markAsViewed('/academy/transcript/official')} className="text-blue-400" tone="blue" />

              <SectionTitle title="City Services" collapsed={isSidebarCollapsed} />
              <GridItem collapsed={isSidebarCollapsed} icon={Megaphone} label="Advertise" to="/city-registry/advertise" active={isActivePath('/city-registry/advertise')} highlight={isUpdated('/city-registry/advertise')} onClick={() => markAsViewed('/city-registry/advertise')} tone="pink" />
              <GridItem collapsed={isSidebarCollapsed} icon={Scale} label="Appeals" to="/city-registry" active={isActive('/city-registry')} highlight={isUpdated('/city-registry')} onClick={() => markAsViewed('/city-registry')} tone="purple" />
              {((profile as any)?.is_journalist || (profile as any)?.is_news_caster || (profile as any)?.is_chief_news_caster || isAdmin || role === 'superadmin' || (profile as any)?.is_superadmin) && (
                <GridItem collapsed={isSidebarCollapsed} icon={Newspaper} label="TCNN" to="/tcnn/dashboard" active={location.pathname.startsWith('/tcnn/dashboard')} highlight={isUpdated('/tcnn/dashboard')} onClick={() => markAsViewed('/tcnn/dashboard')} className="text-blue-400" tone="blue" />
              )}
              {canSeeAttorneyDashboard && (
                <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Attorney" to="/attorney" active={isActive('/attorney')} highlight={isUpdated('/attorney')} onClick={() => markAsViewed('/attorney')} className="text-cyan-200" tone="cyan" />
              )}
              {canSeeAuctionStudio && (
                <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Auction Studio" to="/auctions/studio" active={location.pathname.startsWith('/auctions/studio')} highlight={isUpdated('/auctions/studio')} onClick={() => markAsViewed('/auctions/studio')} className="text-green-400" tone="green" />
              )}
              <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Credit" to="/credit-scores" active={isActive('/credit-scores')} highlight={isUpdated('/credit-scores')} onClick={() => markAsViewed('/credit-scores')} tone="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={Shuffle} label="Creator" to="/creator-switch" active={isActive('/creator-switch')} highlight={isUpdated('/creator-switch')} onClick={() => markAsViewed('/creator-switch')} tone="purple" />
              {canSeeCourt && (
                <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Dockets" to="/admin/court-dockets" active={location.pathname.startsWith('/admin/court-dockets')} highlight={isUpdated('/admin/court-dockets')} onClick={() => markAsViewed('/admin/court-dockets')} className="text-pink-300" tone="pink" />
              )}

              <SectionTitle title="Social + Life" collapsed={isSidebarCollapsed} />
              <GridItem collapsed={isSidebarCollapsed} icon={Mail} label="UTroMail" to="/utromail" active={isActivePath('/utromail')} highlight={isUpdated('/utromail')} onClick={() => markAsViewed('/utromail')} className="text-emerald-400" tone="green" glow="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="Podcast" to="/podcast" active={isActive('/podcast')} highlight={isUpdated('/podcast')} onClick={() => markAsViewed('/podcast')} className="text-purple-400" tone="purple" glow="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Insurance" to="/insurance" active={isActive('/insurance')} highlight={isUpdated('/insurance')} onClick={() => markAsViewed('/insurance')} className="text-cyan-300" tone="cyan" />
              <GridItem collapsed={isSidebarCollapsed} icon={Package} label="Inventory" to="/inventory" active={isActive('/inventory')} highlight={isUpdated('/inventory')} onClick={() => markAsViewed('/inventory')} tone="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Troll Family" to="/family/browse" active={isActive('/family/browse')} highlight={isUpdated('/family/browse')} onClick={() => markAsViewed('/family/browse')} className="text-pink-400" tone="pink" />
              <GridItem collapsed={isSidebarCollapsed} icon={Crown} label="My Families" to={isFamilyMember ? "/family/home" : "/family/browse"} active={isActive('/family/home') || isActive('/family/browse')} highlight={isUpdated('/family/home')} onClick={() => markAsViewed('/family/home')} className="text-purple-400" tone="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={Trophy} label="Leaderboard" to="/leaderboard" active={isActive('/leaderboard')} highlight={isUpdated('/leaderboard')} onClick={() => markAsViewed('/leaderboard')} tone="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={Warehouse} label="Living" to="/living" active={isActive('/living')} highlight={isUpdated('/living')} onClick={() => markAsViewed('/living')} tone="cyan" />
              <GridItem collapsed={isSidebarCollapsed} icon={Store} label="Marketplace" to="/marketplace" active={isActive('/marketplace')} highlight={isUpdated('/marketplace')} onClick={() => markAsViewed('/marketplace')} tone="purple" />
              {canSeeAuctionStudio && (
                <GridItem collapsed={isSidebarCollapsed} icon={List} label="My Shows" to="/auctions/my-shows" active={location.pathname.startsWith('/auctions/my-shows')} highlight={isUpdated('/auctions/my-shows')} onClick={() => markAsViewed('/auctions/my-shows')} className="text-green-400" tone="green" />
              )}
              <GridItem collapsed={isSidebarCollapsed} icon={Waves} label="Pool" to="/pool" active={isActive('/pool')} highlight={isUpdated('/pool')} onClick={() => markAsViewed('/pool')} className="text-cyan-400" tone="cyan" />
              <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Safety" to="/safety" active={isActive('/safety')} highlight={isUpdated('/safety')} onClick={() => markAsViewed('/safety')} tone="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={BookOpen} label="Troll Church" to="/church" active={isActive('/church')} highlight={isUpdated('/church')} onClick={() => markAsViewed('/church')} tone="purple" />
              <GridItem collapsed={isSidebarCollapsed} icon={ShoppingBag} label="Trollified" to="/trollifieds" active={isActive('/trollifieds')} highlight={isUpdated('/trollifieds')} onClick={() => markAsViewed('/trollifieds')} className="text-green-400" tone="green" underConstruction={!isAdmin} />
              <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Wallet" to="/wallet" active={isActive('/wallet')} highlight={isUpdated('/wallet')} onClick={() => markAsViewed('/wallet')} tone="green" />
              <GridItem collapsed={isSidebarCollapsed} icon={Gamepad2} label="Wheel" to="/troll-wheel" active={isActive('/troll-wheel')} highlight={isUpdated('/troll-wheel')} onClick={() => markAsViewed('/troll-wheel')} className="text-cyan-300" tone="cyan" />

              <SectionTitle title="Control Room" collapsed={isSidebarCollapsed} />
              {(canSeeOfficer || canSeeSecretary || profile?.role === UserRole.PRESIDENT || profile?.troll_role === UserRole.PRESIDENT || isAdmin) && (
                <GridItem collapsed={isSidebarCollapsed} icon={Landmark} label="Government" to="/government" active={location.pathname === '/government'} highlight={isUpdated('/government')} onClick={() => markAsViewed('/government')} className="text-cyan-300" tone="cyan" />
              )}
              {canSeeInmates && (
                <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Inmates" to="/inmates" active={isActive('/inmates')} highlight={isUpdated('/inmates')} onClick={() => markAsViewed('/inmates')} className="text-red-300" tone="red" />
              )}

              <GridItem collapsed={isSidebarCollapsed} icon={Crown} label="President" to="/president" active={isActive('/president')} highlight={isUpdated('/president')} onClick={() => markAsViewed('/president')} tone="purple" />
              {(canSeeOfficer || canSeeSecretary || isAdmin) && (
                <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="Streams" to="/government/streams" active={location.pathname.startsWith('/government/streams')} highlight={isUpdated('/government/streams')} onClick={() => markAsViewed('/government/streams')} className="text-red-400" tone="red" />
              )}
              {(isAdmin || profile?.role === UserRole.PRESIDENT || profile?.troll_role === UserRole.PRESIDENT) && (
                <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Treasury" to="/president/treasury" active={isActive('/president/treasury')} highlight={isUpdated('/president/treasury')} onClick={() => markAsViewed('/president/treasury')} className="text-emerald-300" tone="green" />
              )}
              {(canSeeSecretary || isAdmin) && (
                <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Secretary" to="/secretary" active={location.pathname.startsWith('/secretary')} highlight={isUpdated('/secretary')} onClick={() => markAsViewed('/secretary')} className="text-cyan-200" tone="cyan" />
              )}
              {isAdmin && (
                <>
                  <GridItem collapsed={isSidebarCollapsed} icon={Coins} label="Coin Purchase Ledger" to="/admin/coinpurchase-ledger" active={location.pathname.startsWith('/admin/coinpurchase-ledger')} highlight={isUpdated('/admin/coinpurchase-ledger')} onClick={() => markAsViewed('/admin/coinpurchase-ledger')} className="text-cyan-300" tone="cyan" />
                  <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Startup Expense Tracker" to="/admin/startup-expense-tracker" active={location.pathname.startsWith('/admin/startup-expense-tracker')} highlight={isUpdated('/admin/startup-expense-tracker')} onClick={() => markAsViewed('/admin/startup-expense-tracker')} className="text-cyan-300" tone="cyan" />
                  <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Security Command" to="/admin/security-command-center" active={location.pathname.startsWith('/admin/security-command-center')} highlight={isUpdated('/admin/security-command-center')} onClick={() => markAsViewed('/admin/security-command-center')} className="text-cyan-300" tone="cyan" />
                </>
              )}
              {canAccessNightWatch && (
                <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="Night Watch" to="/admin/night-watch" active={isActive('/admin/night-watch')} highlight={isUpdated('/admin/night-watch')} onClick={() => markAsViewed('/admin/night-watch')} className="text-cyan-300" tone="cyan" />
              )}

              {/* 📧 Tromail - Internal Role Email for approved roles */}
              {canAccessTromail && canAccessTromail(profile) && (
                <GridItem collapsed={isSidebarCollapsed} icon={Mail} label="Tromail" to="/tromail" active={isActive('/tromail')} highlight={isUpdated('/tromail')} onClick={() => markAsViewed('/tromail')} className="text-cyan-300" tone="cyan" />
              )}

              <SectionTitle title="Talent Offices" collapsed={isSidebarCollapsed} />
              <GridItem collapsed={isSidebarCollapsed} icon={Building2} label="Agencies" to="/agencies" active={isActive('/agencies')} highlight={isUpdated('/agencies')} onClick={() => markAsViewed('/agencies')} className="text-cyan-400" tone="cyan" />
              <GridItem collapsed={isSidebarCollapsed} icon={Users} label="My Agency" to="/agency-dashboard" active={isActive('/agency-dashboard')} highlight={isUpdated('/agency-dashboard')} onClick={() => markAsViewed('/agency-dashboard')} className="text-cyan-400" tone="cyan" />
              {canSeeAttorneyDashboard && (
                <GridItem
                  collapsed={isSidebarCollapsed}
                  icon={Briefcase}
                  label="Attorney"
                  to="/attorney"
                  active={isActive('/attorney')}
                  highlight={isUpdated('/attorney')}
                  onClick={() => markAsViewed('/attorney')}
                  className="text-teal-300"
                  tone="teal"
                />
              )}
              {canSeeAuctionStudio && (
                <GridItem
                  collapsed={isSidebarCollapsed}
                  icon={Gavel}
                  label="Auction Studio"
                  to="/auctions/studio"
                  active={isActive('/auctions/studio')}
                  highlight={isUpdated('/auctions/studio')}
                  onClick={() => markAsViewed('/auctions/studio')}
                  className="text-orange-300"
                  tone="orange"
                />
              )}
              {canSeeAgencyHRDashboard && (
                <GridItem
                  collapsed={isSidebarCollapsed}
                  icon={Briefcase}
                  label="Agency HR"
                  to="/agency-hr-dashboard"
                  active={isActive('/agency-hr-dashboard')}
                  highlight={isUpdated('/agency-hr-dashboard')}
                  onClick={() => markAsViewed('/agency-hr-dashboard')}
                  className="text-cyan-200"
                  tone="cyan"
                />
              )}

              <SectionTitle title="Support" collapsed={isSidebarCollapsed} />
              <GridItem collapsed={isSidebarCollapsed} icon={LifeBuoy} label="Support" to="/support" active={isActive('/support')} highlight={isUpdated('/support')} onClick={() => markAsViewed('/support')} tone="blue" />

              <SectionTitle title="Dashboards" collapsed={isSidebarCollapsed} />
              {(isCEOAssistant || isAdmin || isCEO) && (
                <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="CEO Assistant Dashboard" to="/ceo-assistant-dashboard" active={isActive('/ceo-assistant-dashboard')} highlight={isUpdated('/ceo-assistant-dashboard')} onClick={() => markAsViewed('/ceo-assistant-dashboard')} tone="cyan" />
              )}
              {(isNoahAssistant || isAdmin || isNoahAdmin || isCEO) && (
                <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Noah Assistant Dashboard" to="/noah-assistant-dashboard" active={isActive('/noah-assistant-dashboard')} highlight={isUpdated('/noah-assistant-dashboard')} onClick={() => markAsViewed('/noah-assistant-dashboard')} tone="purple" />
              )}
              {canSeeProsecutorDashboard && (
                <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Prosecutor Dashboard" to="/prosecutor" active={isActive('/prosecutor')} highlight={isUpdated('/prosecutor')} onClick={() => markAsViewed('/prosecutor')} className="text-red-400" tone="red" />
              )}
              {(profile?.is_pastor || role === 'pastor' || trollRole === 'pastor' || isAdmin) && (
                <GridItem collapsed={isSidebarCollapsed} icon={Church} label="Pastor Dashboard" to="/church/pastor" active={isActive('/church/pastor')} highlight={isUpdated('/church/pastor')} onClick={() => markAsViewed('/church/pastor')} className="text-green-400" tone="green" />
              )}
            </div>
          )
        ) : (
          <div className={cx('grid gap-2', isSidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
            <SectionTitle title="Admin Library" collapsed={isSidebarCollapsed} />
            <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Admin Dashboard" to="/admin" active={isActive('/admin')} highlight={isUpdated('/admin')} onClick={() => markAsViewed('/admin')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Store} label="Admin Marketplace" to="/admin/marketplace" active={isActive('/admin/marketplace')} highlight={isUpdated('/admin/marketplace')} onClick={() => markAsViewed('/admin/marketplace')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Admin Earnings" to="/admin/earnings" active={isActive('/admin/earnings')} highlight={isUpdated('/admin/earnings')} onClick={() => markAsViewed('/admin/earnings')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Admin Finance" to="/admin/finance" active={isActive('/admin/finance')} highlight={isUpdated('/admin/finance')} onClick={() => markAsViewed('/admin/finance')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={DollarSign} label="Payments Dashboard" to="/admin/payments" active={isActive('/admin/payments')} highlight={isUpdated('/admin/payments')} onClick={() => markAsViewed('/admin/payments')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Economy Dashboard" to="/admin/economy" active={isActive('/admin/economy')} highlight={isUpdated('/admin/economy')} onClick={() => markAsViewed('/admin/economy')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Scale} label="Tax Review Panel" to="/admin/tax-reviews" active={isActive('/admin/tax-reviews')} highlight={isUpdated('/admin/tax-reviews')} onClick={() => markAsViewed('/admin/tax-reviews')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Tax Upload" to="/tax/upload" active={isActive('/tax/upload')} highlight={isUpdated('/tax/upload')} onClick={() => markAsViewed('/tax/upload')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={DollarSign} label="Payouts" to="/admin/payouts" active={isActive('/admin/payouts')} highlight={isUpdated('/admin/payouts')} onClick={() => markAsViewed('/admin/payouts')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Referral Bonuses" to="/admin/referrals" active={isActive('/admin/referrals')} highlight={isUpdated('/admin/referrals')} onClick={() => markAsViewed('/admin/referrals')} tone="pink" />
            <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Verified Users" to="/admin/verified-users" active={isActive('/admin/verified-users')} highlight={isUpdated('/admin/verified-users')} onClick={() => markAsViewed('/admin/verified-users')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Verification Review" to="/admin/verification" active={isActive('/admin/verification')} highlight={isUpdated('/admin/verification')} onClick={() => markAsViewed('/admin/verification')} tone="blue" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Applications" to="/admin/applications" active={isActive('/admin/applications')} highlight={isUpdated('/admin/applications')} onClick={() => markAsViewed('/admin/applications')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Policy Docs" to="/admin/docs/policies" active={isActive('/admin/docs/policies')} highlight={isUpdated('/admin/docs/policies')} onClick={() => markAsViewed('/admin/docs/policies')} tone="blue" />
            <GridItem collapsed={isSidebarCollapsed} icon={ShoppingBag} label="Store Pricing" to="/admin/store-pricing" active={isActive('/admin/store-pricing')} highlight={isUpdated('/admin/store-pricing')} onClick={() => markAsViewed('/admin/store-pricing')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Lock} label="Cashout Manager" to="/admin/cashout-manager" active={isActive('/admin/cashout-manager')} highlight={isUpdated('/admin/cashout-manager')} onClick={() => markAsViewed('/admin/cashout-manager')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Security Command" to="/admin/security-command-center" active={isActive('/admin/security-command-center')} highlight={isUpdated('/admin/security-command-center')} onClick={() => markAsViewed('/admin/security-command-center')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Mobile Admin" to="/admin-mobile" active={isActive('/admin-mobile')} highlight={isUpdated('/admin-mobile')} onClick={() => markAsViewed('/admin-mobile')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Payment Logs" to="/admin/payment-logs" active={isActive('/admin/payment-logs')} highlight={isUpdated('/admin/payment-logs')} onClick={() => markAsViewed('/admin/payment-logs')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Settings} label="Admin Errors" to="/admin/errors" active={isActive('/admin/errors')} highlight={isUpdated('/admin/errors')} onClick={() => markAsViewed('/admin/errors')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Database} label="Database Backup" to="/admin/system/backup" active={isActive('/admin/system/backup')} highlight={isUpdated('/admin/system/backup')} onClick={() => markAsViewed('/admin/system/backup')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Settings} label="System Config" to="/admin/system/config" active={isActive('/admin/system/config')} highlight={isUpdated('/admin/system/config')} onClick={() => markAsViewed('/admin/system/config')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Zap} label="Load Lab" to="/admin/load-lab" active={isActive('/admin/load-lab')} highlight={isUpdated('/admin/load-lab')} onClick={() => markAsViewed('/admin/load-lab')} tone="orange" />
            <GridItem collapsed={isSidebarCollapsed} icon={Lock} label="Jail Management" to="/admin/jail-management" active={isActive('/admin/jail-management')} highlight={isUpdated('/admin/jail-management')} onClick={() => markAsViewed('/admin/jail-management')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="User Forms" to="/admin/user-forms" active={isActive('/admin/user-forms')} highlight={isUpdated('/admin/user-forms')} onClick={() => markAsViewed('/admin/user-forms')} tone="blue" />
            <GridItem collapsed={isSidebarCollapsed} icon={Trophy} label="Trollmers Tournament" to="/admin/trollmers-tournament" active={isActive('/admin/trollmers-tournament')} highlight={isUpdated('/admin/trollmers-tournament')} onClick={() => markAsViewed('/admin/trollmers-tournament')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Officer Management" to="/admin/officer-management" active={isActive('/admin/officer-management')} highlight={isUpdated('/admin/officer-management')} onClick={() => markAsViewed('/admin/officer-management')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Role Management" to="/admin/role-management" active={isActive('/admin/role-management')} highlight={isUpdated('/admin/role-management')} onClick={() => markAsViewed('/admin/role-management')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Media Library" to="/admin/media-library" active={isActive('/admin/media-library')} highlight={isUpdated('/admin/media-library')} onClick={() => markAsViewed('/admin/media-library')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Megaphone} label="Announcements" to="/admin/announcements" active={isActive('/admin/announcements')} highlight={isUpdated('/admin/announcements')} onClick={() => markAsViewed('/admin/announcements')} tone="pink" />
            <GridItem collapsed={isSidebarCollapsed} icon={Mail} label="Send Notifications" to="/admin/send-notifications" active={isActive('/admin/send-notifications')} highlight={isUpdated('/admin/send-notifications')} onClick={() => markAsViewed('/admin/send-notifications')} tone="blue" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Export Data" to="/admin/export-data" active={isActive('/admin/export-data')} highlight={isUpdated('/admin/export-data')} onClick={() => markAsViewed('/admin/export-data')} tone="blue" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="User Search" to="/admin/user-search" active={isActive('/admin/user-search')} highlight={isUpdated('/admin/user-search')} onClick={() => markAsViewed('/admin/user-search')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Reports Queue" to="/admin/reports-queue" active={isActive('/admin/reports-queue')} highlight={isUpdated('/admin/reports-queue')} onClick={() => markAsViewed('/admin/reports-queue')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Video} label="Stream Monitor" to="/admin/stream-monitor" active={isActive('/admin/stream-monitor')} highlight={isUpdated('/admin/stream-monitor')} onClick={() => markAsViewed('/admin/stream-monitor')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="Night Watch" to="/admin/night-watch" active={isActive('/admin/night-watch')} highlight={isUpdated('/admin/night-watch')} onClick={() => markAsViewed('/admin/night-watch')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Voting" to="/admin/voting" active={isActive('/admin/voting')} highlight={isUpdated('/admin/voting')} onClick={() => markAsViewed('/admin/voting')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Launch Trial" to="/admin/launch-trial" active={isActive('/admin/launch-trial')} highlight={isUpdated('/admin/launch-trial')} onClick={() => markAsViewed('/admin/launch-trial')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Store} label="Store Pricing" to="/admin/store-pricing" active={isActive('/admin/store-pricing')} highlight={isUpdated('/admin/store-pricing')} onClick={() => markAsViewed('/admin/store-pricing')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Shield} label="Admin Errors" to="/admin/errors" active={isActive('/admin/errors')} highlight={isUpdated('/admin/errors')} onClick={() => markAsViewed('/admin/errors')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Banknote} label="Buckets" to="/admin/buckets" active={isActive('/admin/buckets')} highlight={isUpdated('/admin/buckets')} onClick={() => markAsViewed('/admin/buckets')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={TrendingUp} label="Grant Coins" to="/admin/grant-coins" active={isActive('/admin/grant-coins')} highlight={isUpdated('/admin/grant-coins')} onClick={() => markAsViewed('/admin/grant-coins')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Calendar} label="Create Schedule" to="/admin/create-schedule" active={isActive('/admin/create-schedule')} highlight={isUpdated('/admin/create-schedule')} onClick={() => markAsViewed('/admin/create-schedule')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Calendar} label="Officer Shifts" to="/admin/officer-shifts" active={isActive('/admin/officer-shifts')} highlight={isUpdated('/admin/officer-shifts')} onClick={() => markAsViewed('/admin/officer-shifts')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Referral Bonuses" to="/admin/referral-bonuses" active={isActive('/admin/referral-bonuses')} highlight={isUpdated('/admin/referral-bonuses')} onClick={() => markAsViewed('/admin/referral-bonuses')} tone="pink" />
            <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Control Panel" to="/admin/control-panel" active={isActive('/admin/control-panel')} highlight={isUpdated('/admin/control-panel')} onClick={() => markAsViewed('/admin/control-panel')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Test Diagnostics" to="/admin/test-diagnostics" active={isActive('/admin/test-diagnostics')} highlight={isUpdated('/admin/test-diagnostics')} onClick={() => markAsViewed('/admin/test-diagnostics')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Lock} label="Reset Maintenance" to="/admin/reset-maintenance" active={isActive('/admin/reset-maintenance')} highlight={isUpdated('/admin/reset-maintenance')} onClick={() => markAsViewed('/admin/reset-maintenance')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Users} label="HR" to="/admin/hr" active={isActive('/admin/hr')} highlight={isUpdated('/admin/hr')} onClick={() => markAsViewed('/admin/hr')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Scale} label="Appeals" to="/admin/appeals" active={isActive('/admin/appeals')} highlight={isUpdated('/admin/appeals')} onClick={() => markAsViewed('/admin/appeals')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={Calendar} label="Meetings" to="/admin/meetings" active={isActive('/admin/meetings')} highlight={isUpdated('/admin/meetings')} onClick={() => markAsViewed('/admin/meetings')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="RTC Admin Monitor" to="/rtcadminmonitor" active={isActive('/rtcadminmonitor')} highlight={isUpdated('/rtcadminmonitor')} onClick={() => markAsViewed('/rtcadminmonitor')} tone="teal" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="RFC" to="/rfc" active={isActive('/rfc')} highlight={isUpdated('/rfc')} onClick={() => markAsViewed('/rfc')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={FileText} label="Changelog" to="/changelog" active={isActive('/changelog')} highlight={isUpdated('/changelog')} onClick={() => markAsViewed('/changelog')} tone="cyan" />

            <SectionTitle title="Role Dashboards" collapsed={isSidebarCollapsed} />
            <GridItem collapsed={isSidebarCollapsed} icon={Crown} label="President Dashboard" to="/president/dashboard" active={isActive('/president/dashboard')} highlight={isUpdated('/president/dashboard')} onClick={() => markAsViewed('/president/dashboard')} tone="purple" />
            <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Secretary Console" to="/secretary" active={location.pathname.startsWith('/secretary')} highlight={isUpdated('/secretary')} onClick={() => markAsViewed('/secretary')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Radio} label="Government Streams" to="/government/streams" active={location.pathname.startsWith('/government/streams')} highlight={isUpdated('/government/streams')} onClick={() => markAsViewed('/government/streams')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Building2} label="Officer Lounge" to="/officer/lounge" active={isActive('/officer/lounge')} highlight={isUpdated('/officer/lounge')} onClick={() => markAsViewed('/officer/lounge')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={AlertTriangle} label="Officer Moderation" to="/officer/moderation" active={isActive('/officer/moderation')} highlight={isUpdated('/officer/moderation')} onClick={() => markAsViewed('/officer/moderation')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Calendar} label="Officer Scheduling" to="/officer/scheduling" active={isActive('/officer/scheduling')} highlight={isUpdated('/officer/scheduling')} onClick={() => markAsViewed('/officer/scheduling')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Officer Dashboard" to="/officer/dashboard" active={isActive('/officer/dashboard')} highlight={isUpdated('/officer/dashboard')} onClick={() => markAsViewed('/officer/dashboard')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Users} label="Lead Officer" to="/lead-officer" active={isActive('/lead-officer')} highlight={isUpdated('/lead-officer')} onClick={() => markAsViewed('/lead-officer')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Attorney" to="/attorney" active={isActive('/attorney')} highlight={isUpdated('/attorney')} onClick={() => markAsViewed('/attorney')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={Gavel} label="Prosecutor Dashboard" to="/prosecutor" active={isActive('/prosecutor')} highlight={isUpdated('/prosecutor')} onClick={() => markAsViewed('/prosecutor')} tone="red" />
            <GridItem collapsed={isSidebarCollapsed} icon={Church} label="Pastor Dashboard" to="/church/pastor" active={isActive('/church/pastor')} highlight={isUpdated('/church/pastor')} onClick={() => markAsViewed('/church/pastor')} tone="green" />
            <GridItem collapsed={isSidebarCollapsed} icon={Briefcase} label="Agency HR Dashboard" to="/agency-hr-dashboard" active={isActive('/agency-hr-dashboard')} highlight={isUpdated('/agency-hr-dashboard')} onClick={() => markAsViewed('/agency-hr-dashboard')} tone="cyan" />

            <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="CEO Assistant Dashboard" to="/ceo-assistant-dashboard" active={isActive('/ceo-assistant-dashboard')} highlight={isUpdated('/ceo-assistant-dashboard')} onClick={() => markAsViewed('/ceo-assistant-dashboard')} tone="cyan" />
            <GridItem collapsed={isSidebarCollapsed} icon={LayoutDashboard} label="Noah Assistant Dashboard" to="/noah-assistant-dashboard" active={isActive('/noah-assistant-dashboard')} highlight={isUpdated('/noah-assistant-dashboard')} onClick={() => markAsViewed('/noah-assistant-dashboard')} tone="purple" />
          </div>
        )}
      </div>

      <div className="relative z-10 shrink-0 border-t border-pink-300/15 bg-slate-950/55 p-3">
        <SafeLink
          to="/stats"
          className={cx(
            'group flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-400 transition-all duration-200 hover:border-pink-300/40 hover:bg-white/[0.075] hover:text-white hover:shadow-[0_0_18px_rgba(236,72,153,0.18)]',
            isSidebarCollapsed ? 'h-12 px-2' : 'gap-3 p-2.5'
          )}
          title="Stats"
        >
          <LayoutDashboard size={18} className="group-hover:text-pink-100" />
          {!isSidebarCollapsed && <span className="text-[13px] font-semibold">Stats</span>}
        </SafeLink>
      </div>

      {showCourtModal && <CourtEntryModal isOpen={true} onClose={() => setShowCourtModal(false)} />}
    </aside>
  )
}

function GridItem({
  icon: Icon,
  label,
  to,
  active,
  highlight,
  onClick,
  className = '',
  glow,
  collapsed = false,
  tone = 'default',
  badge,
  underConstruction = false,
}: GridItemProps) {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (underConstruction) {
      e.preventDefault()
      return
    }
    if (onClick) onClick()
  }

  const toneMap: Record<GridItemTone, string> = {
    default: 'from-white/[0.07] via-white/[0.025] to-slate-950/20 border-white/10 hover:border-pink-300/30',
    green: 'from-emerald-400/16 via-yellow-300/[0.035] to-slate-950/20 border-emerald-300/22 hover:border-emerald-200/45',
    blue: 'from-blue-400/16 via-cyan-300/[0.035] to-slate-950/20 border-blue-300/22 hover:border-blue-200/45',
    cyan: 'from-cyan-400/17 via-blue-300/[0.035] to-slate-950/20 border-cyan-300/24 hover:border-cyan-200/50',
    pink: 'from-pink-400/17 via-rose-300/[0.035] to-slate-950/20 border-pink-300/24 hover:border-pink-200/50',
    red: 'from-red-400/16 via-orange-300/[0.035] to-slate-950/20 border-red-300/24 hover:border-red-200/45',
    orange: 'from-orange-400/16 via-yellow-300/[0.04] to-slate-950/20 border-orange-300/22 hover:border-yellow-200/45',
    purple: 'from-purple-400/18 via-pink-300/[0.035] to-slate-950/20 border-purple-300/25 hover:border-purple-200/50',
    teal: 'from-teal-400/17 via-emerald-300/[0.035] to-slate-950/20 border-teal-300/24 hover:border-teal-200/50',
  }

  const glowMap: Record<GridGlow, React.CSSProperties> = {
    green: { boxShadow: '0 0 20px rgba(34,197,94,0.32), 0 0 12px rgba(250,204,21,0.14), inset 0 0 14px rgba(34,197,94,0.08)' },
    pink: { boxShadow: '0 0 20px rgba(236,72,153,0.34), 0 0 12px rgba(168,85,247,0.16), inset 0 0 14px rgba(236,72,153,0.08)' },
    cyan: { boxShadow: '0 0 20px rgba(34,211,238,0.34), 0 0 12px rgba(59,130,246,0.16), inset 0 0 14px rgba(34,211,238,0.08)' },
    red: { boxShadow: '0 0 20px rgba(239,68,68,0.30), 0 0 12px rgba(249,115,22,0.15), inset 0 0 14px rgba(239,68,68,0.08)' },
    purple: { boxShadow: '0 0 20px rgba(168,85,247,0.34), 0 0 12px rgba(236,72,153,0.16), inset 0 0 14px rgba(168,85,247,0.08)' },
    teal: { boxShadow: '0 0 20px rgba(45,212,191,0.34), 0 0 12px rgba(34,197,94,0.16), inset 0 0 14px rgba(45,212,191,0.08)' },
  }

  const isUnderConstruction = underConstruction ?? false
  const effectiveActive = !isUnderConstruction && active

  return (
    <SafeLink
      to={isUnderConstruction ? '#' : to}
      onClick={handleClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      className={cx(
        'group relative z-0 flex overflow-hidden rounded-2xl border bg-gradient-to-br transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.07]',
        toneMap[tone],
        collapsed ? 'h-14 items-center justify-center p-2' : 'min-h-[74px] flex-col items-center justify-center gap-1.5 p-3',
        effectiveActive ? 'border-pink-200/70 bg-white/[0.10] text-white shadow-[0_0_18px_rgba(236,72,153,0.22),0_0_16px_rgba(34,211,238,0.16),inset_0_1px_0_rgba(255,255,255,0.10)]' : 'text-slate-400 hover:text-white',
        isUnderConstruction ? 'opacity-50 cursor-not-allowed' : '',
        className
      )}
      style={glow ? glowMap[glow] : undefined}
    >
      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.16),transparent_48%),linear-gradient(135deg,rgba(239,68,68,0.06),rgba(250,204,21,0.04),rgba(34,197,94,0.04),rgba(34,211,238,0.05),rgba(168,85,247,0.06))] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      {effectiveActive && <span className="absolute left-0 top-2 h-[calc(100%-1rem)] w-1 rounded-r-full bg-gradient-to-b from-red-300 via-yellow-200 via-emerald-300 via-cyan-300 via-blue-300 to-pink-300 shadow-[0_0_12px_rgba(236,72,153,0.50),0_0_10px_rgba(34,211,238,0.35)]" />}

      <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/45 transition-all duration-200 group-hover:border-white/20 group-hover:bg-slate-950/62">
        <Icon size={20} className="shrink-0" />
      </span>

      {!collapsed && <span className="relative z-10 text-center text-[10px] font-bold leading-tight tracking-tight">{label}</span>}

      {highlight && !isUnderConstruction && (
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gradient-to-r from-pink-400 via-yellow-300 to-cyan-300 shadow-[0_0_8px_rgba(236,72,153,0.70),0_0_8px_rgba(34,211,238,0.55)]" />
      )}

      {badge && !collapsed && !isUnderConstruction && (
        <span className="absolute right-1 top-1 rounded bg-gradient-to-r from-pink-300 via-yellow-200 to-cyan-200 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-950 shadow-[0_0_6px_rgba(236,72,153,0.35)]">
          {badge}
        </span>
      )}
    </SafeLink>
  )
}

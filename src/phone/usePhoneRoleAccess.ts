import { useEffect, useState } from 'react'
import { isMarketingAgent, supabase, UserRole } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { NIGHT_WATCH_PATROL_ROLES } from '../lib/staff'
import { canAccessRtcAdminMonitor } from '../lib/rtcAdminAccess'
import { canAccessTromail } from '../lib/tromail'
import { useShareAThonRestriction } from '../hooks/useShareAThonRestriction'
import { useBroadcastLockdown } from '../hooks/useBroadcastLockdown'
import { useJailMode } from '../hooks/useJailMode'
import { useIsActiveFounder } from '../hooks/useFounderProgram'

/**
 * Mirrors the exact role/permission computation used by the web Sidebar
 * (src/components/Sidebar.tsx) so the phone menu shows the same pages each
 * role is allowed to see. Admin => all pages, Secretary => secretary+admin
 * pages, regular user => only public/user pages, etc.
 */
export interface PhoneRoleAccess {
  [x: string]: any
  isAuthenticated: boolean
  role: string
  trollRole: string
  isAdmin: boolean
  isMarketingAgent: boolean
  isCEO: boolean
  isCEOAssistant: boolean
  isNoahAssistant: boolean
  isNoahAdmin: boolean
  isLead: boolean
  isOfficer: boolean
  isSecretary: boolean
  isStaff: boolean
  isAttorney: boolean
  isProsecutor: boolean
  canSeeInmates: boolean
  canSeeCourt: boolean
  canSeeAuctionStudio: boolean
  canAccessNightWatch: boolean
  canAccessTromail: boolean
  isPastor: boolean
  isFounder: boolean
  isJailed: boolean
  isBroadcastLockedDown: boolean
  isShareAThonRestricted: boolean
  canBroadcast: boolean
  showAdminPagesTab: boolean
  canAccessRtcAdminMonitor: boolean
}

const FALSE_ACCESS: PhoneRoleAccess = {
  isAuthenticated: false,
  role: '',
  trollRole: '',
  isAdmin: false,
  isMarketingAgent: false,
  isCEO: false,
  isCEOAssistant: false,
  isNoahAssistant: false,
  isNoahAdmin: false,
  isLead: false,
  isOfficer: false,
  isSecretary: false,
  isStaff: false,
  isAttorney: false,
  isProsecutor: false,
  canSeeInmates: false,
  canSeeCourt: false,
  canSeeAuctionStudio: false,
  isTeacher: false,
  canAccessNightWatch: false,
  canAccessTromail: false,
  isPastor: false,
  isFounder: false,
  isJailed: false,
  isBroadcastLockedDown: false,
  isShareAThonRestricted: false,
  canBroadcast: false,
  showAdminPagesTab: false,
  canAccessRtcAdminMonitor: false,
}

export function usePhoneRoleAccess(): PhoneRoleAccess {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const { restricted: isShareAThonRestricted } = useShareAThonRestriction(user?.id)
  const { isLocked: isBroadcastLockedDown } = useBroadcastLockdown()
  const { isJailed } = useJailMode(profile?.id)

  // ⭐ Founder is NOT a role — it is a separate time-boxed status read from the
  // Founder directory, exactly like the web Sidebar. Founders gain the Hub and
  // the Founder badge; they do not inherit any moderation role.
  const isActiveFounder = useIsActiveFounder(profile?.id)

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeSecretary, setCanSeeSecretary] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isAttorney, setIsAttorney] = useState(false)
  const [isProsecutor, setIsProsecutor] = useState(false)
  const [canSeeInmates, setCanSeeInmates] = useState(false)
  const [canSeeAuctionStudio, setCanSeeAuctionStudio] = useState(false)

  const role = String(profile?.role || '')
  const trollRole = String(profile?.troll_role || '')

  const isAdmin =
    role === String(UserRole.ADMIN) ||
    trollRole === String(UserRole.ADMIN) ||
    role === String(UserRole.HR_ADMIN) ||
    !!(profile as any)?.is_admin ||
    role === 'superadmin' ||
    role === 'owner' ||
    role === 'ceo' ||
    trollRole === 'owner' ||
    trollRole === 'ceo' ||
    !!(profile as any)?.is_superadmin
  const hasMarketingAccess = isMarketingAgent(profile)

  const isCEO = role === 'ceo' || trollRole === 'ceo' || isAdmin
  const isCEOAssistant =
    role === 'ceo_assistant' || trollRole === 'ceo_assistant' || !!(profile as any)?.is_ceo_assistant
  const isNoahAssistant =
    role === 'noah_assistant' || trollRole === 'noah_assistant' || !!(profile as any)?.is_noah_assistant
  const isNoahAdmin =
    role === 'noah_admin' || trollRole === 'noah_admin' || !!(profile as any)?.is_noah_admin
  const isLead =
    role === String(UserRole.LEAD_TROLL_OFFICER) ||
    !!(profile as any)?.is_lead_officer ||
    trollRole === String(UserRole.LEAD_TROLL_OFFICER) ||
    isAdmin
  const _isSecretary = role === String(UserRole.SECRETARY) || trollRole === String(UserRole.SECRETARY)
  const isPastor = !!profile?.is_pastor || role === 'pastor' || trollRole === 'pastor' || isAdmin
  const canSeeCourt = !!user && !!profile

  const _canSeeAttorneyDashboard = Boolean(
    isAttorney || (profile as any)?.is_attorney || role === 'attorney' || trollRole === 'attorney'
  )
  const canSeeProsecutorDashboard = Boolean(
    isProsecutor || (profile as any)?.is_prosecutor || role === 'prosecutor' || trollRole === 'prosecutor'
  )

  const profileRoleLower = role.toLowerCase()
  const trollRoleLower = trollRole.toLowerCase()
  const canAccessNightWatch = Boolean(
    isAdmin ||
      canSeeOfficer ||
      canSeeSecretary ||
      isCEOAssistant ||
      isNoahAssistant ||
      NIGHT_WATCH_PATROL_ROLES.includes(profileRoleLower as any) ||
      NIGHT_WATCH_PATROL_ROLES.includes(trollRoleLower as any)
  )

  const canBroadcast = Boolean(
    !isBroadcastLockedDown &&
      (profile as any)?.drivers_license_status !== 'suspended' &&
      (role === 'broadcaster' || (profile as any)?.is_broadcaster || trollRole === 'broadcaster')
  )

  const showAdminPagesTab = Boolean(
    isAdmin ||
      isCEOAssistant ||
      isNoahAssistant ||
      canSeeSecretary ||
      canSeeOfficer ||
      canSeeProsecutorDashboard ||
      profile?.role === UserRole.PRESIDENT ||
      isPastor
  )

  useEffect(() => {
    if (!profile?.id) return

    let cancelled = false
    const run = async () => {
      try {
        const { data: officerData } = await supabase
          .from('officer_members')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle()
        if (cancelled) return
        setCanSeeOfficer(!!officerData)

        const { data: secData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', profile.id)
          .single()
        if (cancelled) return
        setCanSeeSecretary(
          secData?.role === UserRole.SECRETARY ||
            secData?.role === UserRole.ADMIN ||
            secData?.role === UserRole.EXECUTIVE_SECRETARY ||
            secData?.role === UserRole.TROLL_CITY_SECRETARY ||
            !!(profile as any)?.is_admin ||
            !!(profile as any)?.is_secretary ||
            role === 'superadmin' ||
            role === 'ceo' ||
            !!(trollRole &&
              ['secretary', String(UserRole.EXECUTIVE_SECRETARY), String(UserRole.TROLL_CITY_SECRETARY)].includes(
                trollRole
              ))
        )
        setIsStaff(secData?.role === UserRole.SECRETARY || secData?.role === UserRole.ADMIN || !!officerData)

        const { data: attorneyData } = await supabase
          .from('user_profiles')
          .select('is_attorney')
          .eq('id', profile.id)
          .single()
        if (cancelled) return
        setIsAttorney(attorneyData?.is_attorney === true)

        const { data: prosecutorData } = await supabase
          .from('user_profiles')
          .select('is_prosecutor')
          .eq('id', profile.id)
          .single()
        if (cancelled) return
        setIsProsecutor(prosecutorData?.is_prosecutor === true)

        const { data: auctioneerData } = await supabase
          .from('auctioneer_profiles')
          .select('id, is_active')
          .eq('user_id', profile.id)
          .eq('is_active', true)
          .maybeSingle()
        if (cancelled) return
        setCanSeeAuctionStudio(!!auctioneerData)

        setCanSeeInmates(
          !!officerData ||
            isAdmin ||
            profile?.role === UserRole.TROLL_OFFICER ||
            profile?.troll_role === UserRole.TROLL_OFFICER ||
            !!(profile as any)?.is_troll_officer ||
            profile?.role === UserRole.LEAD_TROLL_OFFICER ||
            profile?.troll_role === UserRole.LEAD_TROLL_OFFICER ||
            !!(profile as any)?.is_lead_officer ||
            secData?.role === UserRole.ADMIN ||
            secData?.role === UserRole.LEAD_TROLL_OFFICER
        )
      } catch (error) {
        console.error('[usePhoneRoleAccess] error:', error)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [profile?.id, profile, isAdmin, role, trollRole])

  return {
    role,
    trollRole,
    isAdmin,
    isMarketingAgent: hasMarketingAccess,
    isCEO,
    isCEOAssistant,
    isNoahAssistant,
    isNoahAdmin,
    isLead,
    isOfficer: canSeeOfficer,
    isSecretary: canSeeSecretary,
    isStaff,
    isAttorney,
    isProsecutor,
    canSeeInmates,
    canSeeCourt,
    canSeeAuctionStudio,
    canAccessNightWatch,
    canAccessTromail: canAccessTromail ? canAccessTromail(profile as any) : false,
    isPastor,
    // ⭐ Founder Hub is role-based: active Founders AND Admins can open it
    // (Admins land on the in-page "Manage Founders" tab). `isActiveFounder` is
    // the status check, not the badge check.
    isFounder: isActiveFounder || isAdmin,
    isAuthenticated: !!user,
    isJailed,
    isBroadcastLockedDown,
    isShareAThonRestricted,
    canBroadcast,
    showAdminPagesTab,
    canAccessRtcAdminMonitor: canAccessRtcAdminMonitor(profile),
  }
}

export function emptyPhoneRoleAccess() {
  return FALSE_ACCESS
}

import { useEffect, useState } from 'react'
import { supabase, UserRole } from '../lib/supabase'
import { useAuthStore } from '../lib/store'
import { NIGHT_WATCH_PATROL_ROLES } from '../lib/staff'
import { canAccessTromail } from '../lib/tromail'
import { useShareAThonRestriction } from '../hooks/useShareAThonRestriction'
import { useBroadcastLockdown } from '../hooks/useBroadcastLockdown'
import { useJailMode } from '../hooks/useJailMode'

/**
 * Mirrors the exact role/permission computation used by the web Sidebar
 * (src/components/Sidebar.tsx) so the phone menu shows the same pages each
 * role is allowed to see. Admin => all pages, Secretary => secretary+admin
 * pages, regular user => only public/user pages, etc.
 */
export interface PhoneRoleAccess {
  role: string
  trollRole: string
  isAdmin: boolean
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
  isTeacher: boolean
  canSeeAgencyHR: boolean
  canSeeTrollFamily: boolean
  isFamilyMember: boolean
  isFamilyLeader: boolean
  canAccessNightWatch: boolean
  canAccessTromail: boolean
  isPastor: boolean
  isJailed: boolean
  isBroadcastLockedDown: boolean
  isShareAThonRestricted: boolean
  canBroadcast: boolean
  showAdminPagesTab: boolean
}

const FALSE_ACCESS: PhoneRoleAccess = {
  role: '',
  trollRole: '',
  isAdmin: false,
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
  canSeeAgencyHR: false,
  canSeeTrollFamily: false,
  isFamilyMember: false,
  isFamilyLeader: false,
  canAccessNightWatch: false,
  canAccessTromail: false,
  isPastor: false,
  isJailed: false,
  isBroadcastLockedDown: false,
  isShareAThonRestricted: false,
  canBroadcast: false,
  showAdminPagesTab: false,
}

export function usePhoneRoleAccess(): PhoneRoleAccess {
  const profile = useAuthStore((s) => s.profile)
  const user = useAuthStore((s) => s.user)
  const { restricted: isShareAThonRestricted } = useShareAThonRestriction(user?.id)
  const { isLocked: isBroadcastLockedDown } = useBroadcastLockdown()
  const { isJailed } = useJailMode(profile?.id)

  const [canSeeOfficer, setCanSeeOfficer] = useState(false)
  const [canSeeTrollFamily, setCanSeeTrollFamily] = useState(false)
  const [isFamilyLeader, setIsFamilyLeader] = useState(false)
  const [isFamilyMember, setIsFamilyMember] = useState(false)
  const [canSeeSecretary, setCanSeeSecretary] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isAttorney, setIsAttorney] = useState(false)
  const [isProsecutor, setIsProsecutor] = useState(false)
  const [canSeeInmates, setCanSeeInmates] = useState(false)
  const [canSeeAuctionStudio, setCanSeeAuctionStudio] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)
  const [canSeeAgencyHR, setCanSeeAgencyHR] = useState(false)

  const role = String(profile?.role || '')
  const trollRole = String(profile?.troll_role || '')

  const isAdmin =
    role === String(UserRole.ADMIN) ||
    trollRole === String(UserRole.ADMIN) ||
    role === String(UserRole.HR_ADMIN) ||
    role === String(UserRole.AGENCY_HR_MANAGER) ||
    !!(profile as any)?.is_admin ||
    role === 'superadmin' ||
    role === 'owner' ||
    role === 'ceo' ||
    trollRole === 'owner' ||
    trollRole === 'ceo' ||
    !!(profile as any)?.is_superadmin

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
  const isSecretary = role === String(UserRole.SECRETARY) || trollRole === String(UserRole.SECRETARY)
  const isPastor = !!profile?.is_pastor || role === 'pastor' || trollRole === 'pastor' || isAdmin
  const canSeeCourt = !!user && !!profile

  const canSeeAttorneyDashboard = Boolean(
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
        if (cancelled) return

        const hasFamilyRole = profile?.role === 'troll_family' || profile?.troll_role === 'troll_family'
        if (finalFamilyData || hasFamilyRole) {
          setCanSeeTrollFamily(true)
          setIsFamilyLeader(finalFamilyData?.leader_id === profile.id)
          setIsFamilyMember(true)
        } else {
          setCanSeeTrollFamily(false)
          setIsFamilyLeader(false)
          setIsFamilyMember(false)
        }

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

        const { data: teacherData } = await supabase
          .from('academy_teachers')
          .select('id')
          .eq('user_id', profile.id)
          .eq('is_approved', true)
          .maybeSingle()
        if (cancelled) return
        setIsTeacher(!!teacherData)

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

        const { data: agencyHRData } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', profile.id)
          .single()
        if (cancelled) return
        setCanSeeAgencyHR(
          agencyHRData?.role === String(UserRole.AGENCY_HR_MANAGER) ||
            agencyHRData?.role === String(UserRole.HR_ADMIN) ||
            agencyHRData?.role === String(UserRole.ADMIN) ||
            role === 'agency_hr' ||
            trollRole === 'agency_hr' ||
            trollRole === String(UserRole.AGENCY_HR_MANAGER) ||
            trollRole === 'agency_hr_manager' ||
            !!(profile as any)?.is_agency_hr ||
            !!(profile as any)?.is_agency_hr_manager
        )
      } catch (error) {
        console.error('[usePhoneRoleAccess] error:', error)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [profile?.id, profile, isAdmin])

  return {
    role,
    trollRole,
    isAdmin,
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
    isTeacher,
    canSeeAgencyHR: canSeeAgencyHR,
    canSeeTrollFamily,
    isFamilyMember,
    isFamilyLeader,
    canAccessNightWatch,
    canAccessTromail: canAccessTromail ? canAccessTromail(profile as any) : false,
    isPastor,
    isJailed,
    isBroadcastLockedDown,
    isShareAThonRestricted,
    canBroadcast,
    showAdminPagesTab,
  }
}

export function emptyPhoneRoleAccess() {
  return FALSE_ACCESS
}

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Session, User } from '@supabase/supabase-js'
import {
  supabase,
  type UserProfile,
  UserRole,
  validateProfile,
  ensureSupabaseSession,
} from '../lib/supabase'
import { handleConcurrentLogin, resetConcurrentLoginCheck } from './sessionUtils'
import { generateUUID } from './uuid'
import { globalRequestScheduler } from './requestScheduler'

/**
 * Mai Troll Auth Store
 * Clean replacement for the duplicate profile / duplicate coin refresh issue.
 *
 * Main protections:
 * - One auth init only.
 * - One profile realtime subscription per user.
 * - One credit realtime subscription per user.
 * - Profile refresh is deduped, debounced, and never stacks.
 * - Realtime profile patches update coins immediately without forcing extra fetches.
 * - user_credit events are throttled before they force a profile refresh.
 * - Missing profile rows do not break auth.
 * - Session recovery does not clear the user unless recovery fails.
 */

const PROFILE_UPDATE_DEBOUNCE_MS = 1_500
const REALTIME_PROFILE_DEBOUNCE_MS = 1_000
const REFRESH_PROFILE_DEBOUNCE_MS = 5_000
const CREDIT_REFRESH_DEBOUNCE_MS = 10_000
const GLOBAL_EVENT_DEDUP_MS = 60_000
const RGB_UPDATE_COOLDOWN_MS = 60_000

let lastProfileUpdateAt = 0
let lastRealtimeProfileAt = 0
let lastRefreshProfileAt = 0
let lastCreditRefreshAt = 0
let lastRealtimePatchHash: string | null = null
let refreshInFlight: Promise<void> | null = null

let initPromise: Promise<void> | null = null
let authSubscription: { unsubscribe: () => void } | null = null

let profileChannel: any = null
let creditChannel: any = null
let subscribedUserId: string | null = null

const announcedGlobalEvents: Record<string, number> = {}

const PROFILE_IGNORED_KEYS = new Set([
  '_lastRgbUpdate',
  'updated_at',
  'last_seen',
  'last_active_at',
  'online_at',
  'presence_state',
  'session_id',
  'last_login_at',
  'last_sign_in_at',
])

const COIN_KEYS = new Set([
  'troll_coins',
  'total_earned_coins',
])

const profilePatchKeys = [
  'troll_coins',
  'total_earned_coins',
  'credit_score',
  'level',
  'xp',
  'total_xp',
  'next_level_xp',
  'role',
  'troll_role',
  'is_admin',
  'is_troll_officer',
  'is_officer_active',
  'is_lead_officer',
  'is_ghost_mode',
  'ghost_mode_until',
  'account_state',
  'muted_until',
  'celeb_role',
  'updated_at',
]

function didProfilePatchActuallyChange(currentProfile: any, patch: any) {
  if (!currentProfile || !patch) return true

  return Object.keys(getProfilePatchDiff(currentProfile, patch)).length > 0
}

function getProfilePatchDiff(currentProfile: any, patch: any) {
  if (!currentProfile || !patch) return {}

  const normalizedCurrent = normalizeProfileCoins(currentProfile)
  const normalizedMerged = normalizeProfileCoins({
    ...currentProfile,
    ...patch,
    terms_accepted:
      patch.terms_accepted === true || currentProfile.terms_accepted === true,
    terms_accepted_at:
      patch.terms_accepted_at || currentProfile.terms_accepted_at || null,
    court_recording_consent:
      patch.court_recording_consent === true ||
      currentProfile.court_recording_consent === true,
  })

  const diff: Record<string, any> = {}
  const keys = new Set([...Object.keys(normalizedCurrent), ...Object.keys(normalizedMerged)])

  for (const key of keys) {
    if (PROFILE_IGNORED_KEYS.has(key)) continue
    if (normalizedCurrent[key] !== normalizedMerged[key]) {
      diff[key] = normalizedMerged[key]
    }
  }

  return diff
}

function toSafeNumber(value: any, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeProfileCoins(profile: any) {
  const total = Math.max(0, Math.floor(toSafeNumber(profile.troll_coins, 0)))

  return {
    ...profile,
    troll_coins: total,
    total_earned_coins: Math.max(0, Math.floor(toSafeNumber(profile.total_earned_coins, 0))),
  }
}

function shouldApplyRealtimeProfilePatch(currentProfile: any, patch: any) {
  return Object.keys(getProfilePatchDiff(currentProfile, patch)).length > 0
}

const USER_PROFILE_SELECT = `
  id,
  email,
  username,
  display_name,
  avatar_url,
  role,
  troll_role,
  job_title,
  is_admin,
  is_troll_officer,
  is_officer_active,
  is_lead_officer,
  is_secretary,
  is_attorney,
  is_prosecutor,
  is_auctioneer,
  is_news_caster,
  is_chief_news_caster,
  is_journalist,
  is_troller,
  is_pastor,
  is_agency_hr_manager,
  is_agency_hr,
  is_agency_leader,
  is_ceo_assistant,
  is_noah_assistant,
  is_ghost_mode,
  ghost_mode_until,
  drivers_license_status,
  organization_id,
  is_org_student,
  organization_profile_visible,
  troll_coins,
  total_earned_coins,
  credit_score,
   credit_limit,
   credit_used,
  level,
  xp,
  total_xp,
  rgb_username_expires_at,
  terms_accepted,
  terms_accepted_at,
  court_recording_consent,
  muted_until,
  account_state,
  account_deleted_at,
  account_deletion_cooldown_until,
  account_reset_after_ban,
  is_test_account,
  insurance_type,
  home_type,
  entrance_join_type,
  created_at,
  updated_at,
  neighborhood_id,
  house_id,
  vehicle_id,
  license_id,
  license_status,
  license_plate,
  car_insurance_expiry,
  drivers_license_expiry,
  driver_test_passed_at,
  homeowners_insurance_expiry,
  homeowners_insurance_deductible,
  insurance_required
`

interface AuthState {
  user: User | null
  session: Session | null
  sessionId: string | null
  profile: UserProfile | null
  isLoading: boolean
  isAdmin: boolean | null
  showLegacySidebar: boolean
  isRefreshing: boolean

  setAuth: (user: User | null, session: Session | null, sessionId?: string | null) => void
  setProfile: (profile: UserProfile | null, options?: { realtime?: boolean; force?: boolean }) => void
  setLoading: (loading: boolean) => void
  setAdmin: (isAdmin: boolean | null) => void
  setShowLegacySidebar: (value: boolean) => void
  refreshProfile: (force?: boolean) => Promise<void>
  logout: () => Promise<void>
}

function isDev() {
  return Boolean((import.meta as any).env?.DEV)
}

function getAdminEmail() {
  return String((import.meta as any).env?.VITE_ADMIN_EMAIL || '').toLowerCase()
}

function getAuthEmail(state: AuthState) {
  return state.user?.email || state.session?.user?.email || null
}

function checkLogoutRequested(): boolean {
  try {
    return sessionStorage.getItem('logout_requested') === 'true'
  } catch {
    return false
  }
}

function setLogoutRequested() {
  try {
    sessionStorage.setItem('logout_requested', 'true')
  } catch {
    // sessionStorage can fail in private modes.
  }
}

function clearLogoutRequested() {
  try {
    sessionStorage.removeItem('logout_requested')
  } catch {
    // sessionStorage can fail in private modes.
  }
}

function setCurrentDeviceSessionId(sessionId: string) {
  try {
    localStorage.setItem('current_device_session_id', sessionId)
  } catch {
    // localStorage can fail in private modes.
  }
}

function clearPersistedAuth() {
  try {
    localStorage.removeItem('troll-city-auth')
  } catch (error) {
    console.warn('[authStore] Failed to clear persisted auth:', error)
  }

  try {
    localStorage.removeItem('current_device_session_id')
  } catch {
    // ignore
  }
}

function shouldAnnounceGlobalEvent(key: string): boolean {
  const now = Date.now()
  const last = announcedGlobalEvents[key]

  if (last && now - last < GLOBAL_EVENT_DEDUP_MS) {
    return false
  }

  announcedGlobalEvents[key] = now
  return true
}

function announceGlobalEvent(event: { title: string; icon: string; priority: number }) {
  const key = event.title.toLowerCase()

  if (!shouldAnnounceGlobalEvent(key)) {
    return
  }

  supabase.from('global_events').insert([event]).then(({ error }) => {
    if (error) {
      console.error('Failed to announce global event:', error)
    }
  })
}

function areProfilesShallowEqual(a: Partial<UserProfile> | null, b: Partial<UserProfile> | null) {
  if (a === b) return true
  if (!a || !b) return false

  const keys = new Set([...Object.keys(a), ...Object.keys(b)])

  for (const key of keys) {
    if (PROFILE_IGNORED_KEYS.has(key)) continue

    if ((a as any)[key] !== (b as any)[key]) {
      return false
    }
  }

  return true
}

function pickProfileComparable(profile: any) {
  return {
    id: profile?.id ?? null,
    username: profile?.username ?? null,
    role: profile?.role ?? null,
    troll_role: profile?.troll_role ?? null,
    troll_coins: toSafeNumber(profile?.troll_coins, 0),
    trollmonds: toSafeNumber(profile?.trollmonds, 0),
    credit_score: toSafeNumber(profile?.credit_score, 0),
    drivers_license_status: profile?.drivers_license_status ?? null,
    drivers_license_expiry: profile?.drivers_license_expiry ?? null,
    car_insurance_expiry: profile?.car_insurance_expiry ?? null,
    homeowners_insurance_expiry: profile?.homeowners_insurance_expiry ?? null,
  }
}

function shallowEqualProfile(a: any, b: any) {
  const left = pickProfileComparable(a)
  const right = pickProfileComparable(b)

  return Object.keys(left).every(
    (key) => left[key as keyof typeof left] === right[key as keyof typeof right]
  )
}

function normalizePatchForHash(patch: Partial<UserProfile>) {
  const normalized: Record<string, any> = {}
  const keys = Object.keys(patch).sort()

  for (const key of keys) {
    if (PROFILE_IGNORED_KEYS.has(key)) continue

    const value = (patch as any)[key]
    normalized[key] = value === undefined ? null : value
  }

  return JSON.stringify(normalized)
}

function mergeAgreementFields(current: Partial<UserProfile> | null, incoming: Partial<UserProfile>) {
  return {
    terms_accepted: incoming.terms_accepted === true || current?.terms_accepted === true,
    terms_accepted_at: (incoming as any).terms_accepted_at || (current as any)?.terms_accepted_at || null,
    court_recording_consent:
      incoming.court_recording_consent === true || current?.court_recording_consent === true,
  }
}

function normalizeProfile(profile: Partial<UserProfile>, state: AuthState): UserProfile {
  let normalized: any = { ...profile }

  const authEmail = getAuthEmail(state)
  if (!normalized.email && authEmail) {
    normalized.email = authEmail
  }

  const profileEmailLower = normalized.email?.toLowerCase()
  const isAdminEmail = Boolean(profileEmailLower && profileEmailLower === getAdminEmail())

  if (isAdminEmail) {
    normalized = {
      ...normalized,
      role: UserRole.ADMIN,
      is_admin: true,
      troll_role: 'admin',
    }
  }

  const hasAdminFlag = normalized.role === UserRole.ADMIN || normalized.is_admin === true

  if (hasAdminFlag) {
    normalized = {
      ...normalized,
      is_admin: true,
      is_troll_officer: true,
      is_officer_active: true,
      is_lead_officer: true,
      troll_role: 'admin',
      officer_level: Math.max(normalized.officer_level || 0, 5),
    }
  }

  return normalized as UserProfile
}

async function registerActiveSession(user: User, sessionId: string) {
  try {
    await supabase.rpc('register_session', {
      p_user_id: user.id,
      p_session_id: sessionId,
      p_device_info: JSON.stringify({
        browser: navigator.userAgent,
        platform: navigator.platform,
      }),
      p_ip_address: null,
      p_user_agent: navigator.userAgent,
    })

    setCurrentDeviceSessionId(sessionId)
  } catch (error) {
    console.warn('[authStore] Failed to register active session:', error)
  }
}

async function recoverSession(): Promise<Session | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession()

    if (error || !data?.session) {
      if (error) {
        console.log('[authStore] Session recovery failed:', error.message)
      }
      return null
    }

    return data.session
  } catch (error) {
    console.log('[authStore] Session recovery threw:', error)
    return null
  }
}

async function fetchProfileWithRetry(userId: string, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const profileResult = await supabase
        .from('user_profiles')
        .select(USER_PROFILE_SELECT)
        .eq('id', userId)
        .maybeSingle()

      if (profileResult.error) throw profileResult.error

      const data = profileResult.data
      if (!data) {
        return { profile: null, error: null, userStats: null, rgbPerk: null }
      }

      return { profile: data, error: null, userStats: null, rgbPerk: null }
    } catch (err: any) {
      if (attempt >= retries) throw err
      await new Promise(r => window.setTimeout(r, 1000 * (attempt + 1)))
    }
  }
  return { profile: null, error: null, userStats: null, rgbPerk: null }
}

async function fetchProfileBundle(userId: string) {
  const { profile, error } = await fetchProfileWithRetry(userId, 2)

  if (error) {
    console.warn('[authStore] fetchProfileBundle error:', error?.message || error)
    return { profile: null, error: null }
  }

  if (!profile) {
    return { profile: null, error: null }
  }

  // Fetch secondary data in background — don't block profile load
  let userStats = null
  let rgbPerk = null
  try {
    const [statsResult, perkResult] = await Promise.allSettled([
      supabase
        .from('user_stats')
        .select('level, xp_total, xp_to_next_level')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_perks')
        .select('expires_at')
        .eq('user_id', userId)
        .eq('perk_id', 'perk_rgb_username')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    if (statsResult.status === 'fulfilled' && !statsResult.value.error) {
      userStats = statsResult.value.data
    }
    if (perkResult.status === 'fulfilled' && !perkResult.value.error) {
      rgbPerk = perkResult.value.data
    }
  } catch {
    // Secondary fetches are optional — ignore errors
  }

  return {
    profile,
    userStats,
    rgbPerk,
    error: null,
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      sessionId: null,
      profile: null,
      isLoading: true,
      isAdmin: null,
      showLegacySidebar: true,
      isRefreshing: false,

      setAuth: (user, session, sessionId = null) => {
        clearLogoutRequested()

        const prev = get()
        const sameUser = (!!prev.user && !!user && prev.user.id === user.id) || (!prev.user && !user)
        const prevToken = prev.session?.access_token
        const nextToken = session?.access_token

        if (sameUser && prevToken === nextToken && prev.sessionId === sessionId) {
          set({ isLoading: false })
          return
        }

        if (isDev()) {
          console.log('[authStore] Auth updated:', { hasUser: Boolean(user), userId: user?.id })
        }

        set({
          user,
          session,
          sessionId,
          isLoading: false,
          isAdmin: user ? get().isAdmin : null,
        })
      },

setProfile: (profile, options = {}) => {
        const prevProfile = get().profile
        const now = Date.now()

        if (!profile) {
          if (!prevProfile && !options.force) return

          lastProfileUpdateAt = now
          set({ profile: null, isAdmin: null })
          return
        }

        if (!options.force && prevProfile && profile && shallowEqualProfile(prevProfile, profile)) {
          if (isDev()) {
            console.debug('[authStore] Profile unchanged, skipping setProfile')
          }
          return
        }

        const mergedProfile = normalizeProfile(
          {
            ...(prevProfile || {}),
            ...profile,
            ...mergeAgreementFields(prevProfile, profile),
          } as unknown as Partial<UserProfile>,
          get()
        )

        const normalizedProfile = normalizeProfileCoins(mergedProfile)

        const isFirstProfile = !prevProfile
        const hasSignificantChange = !areProfilesShallowEqual(prevProfile, normalizedProfile)

        if (!options.force && !isFirstProfile && !hasSignificantChange && now - lastProfileUpdateAt < PROFILE_UPDATE_DEBOUNCE_MS) {
          return
        }

        if (!isFirstProfile && !hasSignificantChange && !options.force) {
          return
        }

        lastProfileUpdateAt = now

        if (options.realtime) {
          lastRealtimeProfileAt = now
        }

        if (!prevProfile && normalizedProfile.username) {
          announceGlobalEvent({
            title: `${normalizedProfile.username} just logged in!`,
            icon: 'login',
            priority: 1,
          })
        }

        try {
          const validation = validateProfile(normalizedProfile)
          if (!validation.isValid) {
            console.warn('[authStore] Profile validation warnings:', validation.warnings)
          }
        } catch {
          // Keep auth resilient if validation helper changes.
        }

        const hasAdminFlag = normalizedProfile.role === UserRole.ADMIN || normalizedProfile.is_admin === true

        if (isDev()) {
          console.log('[authStore] Profile set:', {
            username: normalizedProfile.username,
            role: normalizedProfile.role,
            troll_coins: normalizedProfile.troll_coins,
            credit_score: normalizedProfile.credit_score,
            realtime: options.realtime === true,
          })
        }

        set({
          profile: normalizedProfile,
          isAdmin: hasAdminFlag,
        })
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setAdmin: (isAdmin) => set({ isAdmin }),
      setShowLegacySidebar: (value) => set({ showLegacySidebar: value }),

      refreshProfile: async (force = false) => {
        const state = get()
        const user = state.user

        if (!user) {
          set({ isLoading: false, isRefreshing: false })
          return
        }

        if (refreshInFlight && !force) {
          return refreshInFlight
        }

        const now = Date.now()
        if (!force && now - lastRealtimeProfileAt < REALTIME_PROFILE_DEBOUNCE_MS) {
          set({ isRefreshing: false })
          return
        }
        if (!force && now - lastRefreshProfileAt < REFRESH_PROFILE_DEBOUNCE_MS) {
          set({ isRefreshing: false })
          return
        }

        lastRefreshProfileAt = now
        set({ isRefreshing: true })

        refreshInFlight = (async () => {
          try {
            const bundle: any = await globalRequestScheduler.schedule(
              () => fetchProfileBundle(user.id),
              10
            )

            if (bundle.notLoggedIn) {
              console.log('[authStore] Not logged in, skipping profile refresh')
              set({ isRefreshing: false })
              return
            }

            if (bundle.error) {
              const message = (bundle.error as any).message || ''
              const code = (bundle.error as any).code

              if (code === 'PGRST116' || message.includes('JSON result is empty')) {
                console.log('[authStore] No profile row exists yet for:', user.id)
                return
              }

              console.error('[authStore] Profile fetch error:', bundle.error)
              return
            }

            if (!bundle.profile) {
              console.log('[authStore] No profile returned yet for:', user.id)
              return
            }

            const currentProfile = get().profile
            let finalProfile: any = normalizeProfileCoins({
              ...(currentProfile || {}),
              ...(bundle.profile as any),
              ...mergeAgreementFields(currentProfile, bundle.profile as any),
            })

            if (bundle.userStats) {
              finalProfile = {
                ...finalProfile,
                level: bundle.userStats.level ?? finalProfile.level ?? 1,
                xp: bundle.userStats.xp_total ?? finalProfile.xp ?? 0,
                total_xp: bundle.userStats.xp_total ?? finalProfile.total_xp ?? 0,
                next_level_xp:
                  bundle.userStats.xp_to_next_level ??
                  finalProfile.next_level_xp ??
                  null,
              }
            }

            if (bundle.rgbPerk?.expires_at) {
              const desiredRgb = bundle.rgbPerk.expires_at
              const currentRgb = finalProfile.rgb_username_expires_at || null

              if (desiredRgb !== currentRgb) {
                const lastRgbUpdate = Number(finalProfile._lastRgbUpdate || 0)
                const canWriteRgb = Date.now() - lastRgbUpdate > RGB_UPDATE_COOLDOWN_MS

                finalProfile = {
                  ...finalProfile,
                  rgb_username_expires_at: desiredRgb,
                }

                if (canWriteRgb) {
                  const { error: rgbUpdateError } = await supabase
                    .from('user_profiles')
                    .update({ rgb_username_expires_at: desiredRgb })
                    .eq('id', user.id)

                  if (!rgbUpdateError) {
                    finalProfile._lastRgbUpdate = Date.now()
                  }
                }
              }
            }

            get().setProfile(finalProfile as UserProfile, { force })

          } catch (error) {
            console.error('[authStore] refreshProfile failed:', error)
          } finally {
            refreshInFlight = null
            set({ isRefreshing: false })
          }
        })()

        return refreshInFlight
      },

      logout: async () => {
        setLogoutRequested()

        const currentState = get()
        const userId = currentState.user?.id
        const sessionId = currentState.sessionId

        cleanupProfileRealtime()

        if (currentState.profile?.username) {
          announceGlobalEvent({
            title: `${currentState.profile.username} just logged out!`,
            icon: 'logout',
            priority: 1,
          })
        }

        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession()

          if (session && !error) {
            const { error: signOutError } = await supabase.auth.signOut()

            if (signOutError) {
              const message = signOutError.message || ''
              if (
                message.includes('Auth session missing') ||
                message.includes('Invalid JWT') ||
                message.includes('expired')
              ) {
                console.log('[authStore] Session already invalid; local logout will continue')
              } else {
                console.warn('[authStore] Sign out error:', signOutError.message)
              }
            }
          }
        } catch (error) {
          console.log('[authStore] Session check failed during logout:', error)
        }

        if (userId && sessionId) {
          try {
            await supabase
              .from('active_sessions')
              .update({
                is_active: false,
                last_active: new Date().toISOString(),
              })
              .eq('user_id', userId)
              .eq('session_id', sessionId)
          } catch (error) {
            console.error('[authStore] Failed to mark session inactive:', error)
          }
        }

        set({
          user: null,
          session: null,
          sessionId: null,
          profile: null,
          isLoading: false,
          isAdmin: null,
          isRefreshing: false,
        })

        clearPersistedAuth()
      },
    }),
    {
      name: 'troll-city-auth',
      version: 2,
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        sessionId: state.sessionId,
        profile: state.profile,
        isAdmin: state.isAdmin,
        showLegacySidebar: state.showLegacySidebar,
      }),
    }
  )
)

export function setupProfileRealtime(userId: string) {
  if (subscribedUserId === userId && profileChannel && creditChannel) {
    if (isDev()) {
      console.log('[ProfileRealtime] Already subscribed:', userId)
    }
    return
  }

  cleanupProfileRealtime()
  subscribedUserId = userId

  profileChannel = supabase
    .channel(`profile:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'user_profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => {
        const currentProfile = useAuthStore.getState().profile
        if (!currentProfile || currentProfile.id !== userId) {
          return
        }

        const rawPatch = payload.new || {}
        const diffPatch = getProfilePatchDiff(currentProfile, rawPatch)

        if (Object.keys(diffPatch).length === 0) {
          if (isDev()) {
            console.debug('[ProfileRealtime] Ignoring duplicate/no-op profile patch')
          }
          return
        }

        const updatedProfile = {
          ...currentProfile,
          ...diffPatch,
          ...mergeAgreementFields(currentProfile, rawPatch),
        }

        const normalizedCurrent = normalizeProfileCoins(currentProfile)
        const normalizedUpdated = normalizeProfileCoins(updatedProfile)

        if (areProfilesShallowEqual(normalizedCurrent, normalizedUpdated)) {
          if (isDev()) {
            console.debug('[ProfileRealtime] Ignoring no-op normalized profile update')
          }
          return
        }

        const patchHash = normalizePatchForHash(diffPatch)

        if (patchHash === lastRealtimePatchHash) {
          if (isDev()) {
            console.debug('[ProfileRealtime] Duplicate patch ignored', { userId, patchHash })
          }
          return
        }

        lastRealtimePatchHash = patchHash
        lastRealtimeProfileAt = Date.now()

        const relevantPatch = {
          ...currentProfile,
          ...(diffPatch as any),
        } as any

        const relevantKeys = [
          'troll_coins',
          'credit_score',
          'username',
          'role',
          'troll_role',
          'drivers_license_status',
          'drivers_license_expiry',
          'car_insurance_expiry',
        ]
        const hasRelevantPatchKeys = Object.keys(diffPatch).some((key) => relevantKeys.includes(key))
        const hasRelevantFieldsChanged = !shallowEqualProfile(currentProfile, relevantPatch)

        if (!hasRelevantFieldsChanged && hasRelevantPatchKeys) {
          if (isDev()) {
            console.debug('[ProfileRealtime] Relevant fields unchanged, skipping patch')
          }
          return
        }

        if (isDev()) {
          const normalized = normalizeProfileCoins(updatedProfile)
          console.debug('[ProfileRealtime] Applying profile patch:', {
            userId,
            troll_coins: normalized.troll_coins,
            credit_score: normalized.credit_score,
          })
        }

        useAuthStore.getState().setProfile(updatedProfile as unknown as UserProfile, { realtime: true, force: false } as any)

        // When a change affects employee/permission-bearing fields, force a
        // full profile refresh so newly-hired users instantly unlock the
        // Employee page (and other role-gated surfaces) without a manual
        // refresh or re-login. refreshProfile is internally debounced and
        // deduped, so this will not loop.
        const PERMISSION_PATCH_KEYS = [
          'role',
          'troll_role',
          'is_admin',
          'is_troll_officer',
          'is_officer_active',
          'is_lead_officer',
          'is_secretary',
          'is_ceo_assistant',
          'is_noah_assistant',
          'is_pastor',
          'employment_status',
          'drivers_license_status',
          'drivers_license_expiry',
          'car_insurance_expiry',
        ]

        if (Object.keys(diffPatch).some((key) => PERMISSION_PATCH_KEYS.includes(key))) {
          useAuthStore.getState().refreshProfile(true)
        }
      }
    )
    .subscribe((status) => {
      if (isDev()) {
        console.log('[ProfileRealtime] profile channel status:', status)
      }
    })

  creditChannel = supabase
    .channel(`user-credit:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_credit',
        filter: `user_id=eq.${userId}`,
      },
      () => {
        const now = Date.now()
        if (now - lastCreditRefreshAt < CREDIT_REFRESH_DEBOUNCE_MS) {
          return
        }

        lastCreditRefreshAt = now

        const state = useAuthStore.getState()
        if (state.profile?.id === userId) {
          state.refreshProfile(false)
        }
      }
    )
    .subscribe((status) => {
      if (isDev()) {
        console.log('[ProfileRealtime] credit channel status:', status)
      }
    })

  if (isDev()) {
    console.log('[ProfileRealtime] Subscribed to profile and credit changes:', userId)
  }
}

export function cleanupProfileRealtime() {
  if (profileChannel) {
    supabase.removeChannel(profileChannel)
    profileChannel = null
  }

  if (creditChannel) {
    supabase.removeChannel(creditChannel)
    creditChannel = null
  }

  subscribedUserId = null
  lastRealtimePatchHash = null
  lastRealtimeProfileAt = 0
}

async function acceptSession(session: Session, options: { register?: boolean; checkConcurrentLogin?: boolean; force?: boolean } = {}) {
  const state = useAuthStore.getState()
  const currentSessionId = state.sessionId
  const sessionId = currentSessionId || generateUUID()

  if (options.register !== false) {
    if (!currentSessionId) {
      await registerActiveSession(session.user, sessionId)
    } else {
      setCurrentDeviceSessionId(sessionId)
    }
  } else {
    setCurrentDeviceSessionId(sessionId)
  }

  const priorUserId = state.user?.id
  const priorProfile = state.profile
  const sameUser = priorUserId === session.user.id
  const sameSession = sameUser && Boolean(currentSessionId)

  useAuthStore.getState().setAuth(session.user, session, sessionId)
  setupProfileRealtime(session.user.id)

  if (options.checkConcurrentLogin !== false) {
    resetConcurrentLoginCheck()
    await handleConcurrentLogin(
      session.user.id,
      sessionId,
      () => useAuthStore.getState().logout()
    )
  }

  const shouldForceRefresh =
    options.force ||
    !sameUser ||
    !priorProfile ||
    !sameSession

  if (shouldForceRefresh) {
    await useAuthStore.getState().refreshProfile(true)
  }
}

async function handleNoSession() {
  const state = useAuthStore.getState()

  if (!state.user && !state.session) {
    state.setLoading(false)
    return
  }

  console.log('[authStore] No active session, attempting recovery...')

  const recoveredSession = await recoverSession()

  if (recoveredSession) {
    console.log('[authStore] Session recovery successful')
    await acceptSession(recoveredSession, { register: true, checkConcurrentLogin: true })
    return
  }

  console.log('[authStore] Session recovery failed, clearing stale auth')
  cleanupProfileRealtime()
  state.setAuth(null, null, null)
  state.setProfile(null, { force: true })
  state.setAdmin(null)
  state.setLoading(false)
}

export async function initAuthAndData() {
  if (initPromise) {
    return initPromise
  }

  initPromise = (async () => {
    useAuthStore.getState().setLoading(true)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    clearLogoutRequested()

    if (session?.user) {
      await acceptSession(session, { register: true, checkConcurrentLogin: true })
    } else {
      await handleNoSession()
    }

    if (authSubscription) {
      authSubscription.unsubscribe()
      authSubscription = null
    }

    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const state = useAuthStore.getState()

      const sameUser =
        (!!state.user && !!session?.user && state.user.id === session.user.id) ||
        (!state.user && !session?.user)

      const sameToken = state.session?.access_token === session?.access_token

      if (sameUser && sameToken) {
        state.setLoading(false)
        return
      }

      if (session?.user) {
        await acceptSession(session, { register: true, checkConcurrentLogin: true })
        return
      }

      if (checkLogoutRequested()) {
        clearLogoutRequested()
        cleanupProfileRealtime()
        state.setAuth(null, null, null)
        state.setProfile(null, { force: true })
        state.setAdmin(null)
        state.setLoading(false)
        return
      }

      await handleNoSession()
    })

    authSubscription = data.subscription
  })().catch((error) => {
    console.error('[authStore] initAuthAndData failed:', error)
    useAuthStore.getState().setLoading(false)
    initPromise = null
  })

  return initPromise
}





